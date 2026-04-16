#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    collections::HashMap,
    fs,
    sync::atomic::{AtomicBool, Ordering},
};

use serde::Deserialize;
use tauri::{
    menu::{Menu, MenuBuilder, MenuId, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder},
    AppHandle, Emitter, Manager, WindowEvent,
};

const KEYRING_SERVICE: &str = "DraftHarbourStudio";

static HAS_UNSAVED_EDITS: AtomicBool = AtomicBool::new(false);

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NativeMenuTemplate {
    label: String,
    submenu: Vec<NativeMenuItemTemplate>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NativeMenuItemTemplate {
    id: Option<String>,
    label: Option<String>,
    accelerator: Option<String>,
    role: Option<String>,
    enabled: Option<bool>,
    separator: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CommandState {
    command_id: String,
    enabled: bool,
}

#[tauri::command]
fn set_unsaved_edits(value: bool) {
    HAS_UNSAVED_EDITS.store(value, Ordering::SeqCst);
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(path).map_err(|err| err.to_string())
}

#[tauri::command]
fn open_project_window(app: AppHandle, novel_id: String) -> Result<(), String> {
    let label = format!("project-{}", novel_id);
    if app.get_webview_window(&label).is_some() {
        return Ok(());
    }

    let url = format!("/?project={}", novel_id);
    let mut window_builder = tauri::WebviewWindowBuilder::new(&app, label, tauri::WebviewUrl::App(url.into()))
        .title("DraftHarbour Studio");

    #[cfg(target_os = "macos")]
    {
        window_builder = window_builder
            .title_bar_style(tauri::TitleBarStyle::Overlay)
            .hidden_title(true)
            .transparent(true);
    }

    window_builder.build().map_err(|err| err.to_string())?;

    Ok(())
}

#[tauri::command]
fn set_secure_secret(key: String, value: String) -> Result<(), String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, &key).map_err(|err| err.to_string())?;
    entry.set_password(&value).map_err(|err| err.to_string())
}

#[tauri::command]
fn get_secure_secret(key: String) -> Result<Option<String>, String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, &key).map_err(|err| err.to_string())?;
    match entry.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(err) => Err(err.to_string()),
    }
}

#[tauri::command]
fn delete_secure_secret(key: String) -> Result<(), String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, &key).map_err(|err| err.to_string())?;
    match entry.delete_credential() {
        Ok(_) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(err) => Err(err.to_string()),
    }
}

fn apply_native_role(role: &str) -> Option<PredefinedMenuItem> {
    match role {
        "undo" => Some(PredefinedMenuItem::undo(None)),
        "redo" => Some(PredefinedMenuItem::redo(None)),
        "cut" => Some(PredefinedMenuItem::cut(None)),
        "copy" => Some(PredefinedMenuItem::copy(None)),
        "paste" => Some(PredefinedMenuItem::paste(None)),
        "selectAll" => Some(PredefinedMenuItem::select_all(None)),
        _ => None,
    }
}

#[tauri::command]
fn set_native_menu(app: AppHandle, menu: Vec<NativeMenuTemplate>, _platform: String) -> Result<(), String> {
    let mut menu_builder = MenuBuilder::new(&app);

    for section in menu {
        let mut submenu_builder = SubmenuBuilder::new(&app, section.label);

        for item in section.submenu {
            if item.separator.unwrap_or(false) {
                submenu_builder = submenu_builder.separator();
                continue;
            }

            if let Some(role) = item.role.as_deref() {
                if let Some(predefined) = apply_native_role(role) {
                    submenu_builder = submenu_builder.item(&predefined);
                    continue;
                }
            }

            if let Some(command_id) = item.id {
                let item_id = MenuId::new(command_id.clone());
                let mut item_builder = MenuItemBuilder::with_id(item_id, item.label.unwrap_or(command_id));
                if let Some(shortcut) = item.accelerator {
                    item_builder = item_builder.accelerator(shortcut);
                }
                if let Some(enabled) = item.enabled {
                    item_builder = item_builder.enabled(enabled);
                }

                let menu_item = item_builder.build(&app).map_err(|err| err.to_string())?;
                submenu_builder = submenu_builder.item(&menu_item);
            }
        }

        let submenu = submenu_builder.build().map_err(|err| err.to_string())?;
        menu_builder = menu_builder.item(&submenu);
    }

    let built_menu: Menu<_> = menu_builder.build().map_err(|err| err.to_string())?;
    app.set_menu(built_menu).map_err(|err| err.to_string())?;
    Ok(())
}

#[tauri::command]
fn set_native_menu_command_state(app: AppHandle, command_states: Vec<CommandState>) -> Result<(), String> {
    let command_state_map: HashMap<_, _> = command_states
        .into_iter()
        .map(|state| (state.command_id, state.enabled))
        .collect();

    if let Some(menu) = app.menu() {
        for (command_id, enabled) in command_state_map {
            if let Some(item) = menu.get(&command_id) {
                let _ = item.set_enabled(enabled);
            }
        }
    }

    Ok(())
}

fn emit_launch_payloads(app: &AppHandle, args: &[String]) {
    for arg in args {
        if arg.ends_with(".dhproj") {
            let _ = app.emit("desktop://open-project", arg.clone());
        } else if arg.starts_with("draftharbour://") {
            let _ = app.emit("desktop://deep-link", arg.clone());
        }
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
            emit_launch_payloads(&app, &argv);
        }))
        .on_menu_event(|app, event| {
            let _ = app.emit("desktop://menu-command", event.id().0.clone());
        })
        .setup(|app| {
            let handle = app.handle().clone();
            let args = std::env::args().collect::<Vec<_>>();
            emit_launch_payloads(&handle, &args);

            if let Some(window) = app.get_webview_window("main") {
                let app_handle = handle.clone();
                window.on_window_event(move |event| match event {
                    WindowEvent::CloseRequested { api, .. } => {
                        if HAS_UNSAVED_EDITS.load(Ordering::SeqCst) {
                            api.prevent_close();
                            let _ = app_handle.emit("desktop://confirm-quit", true);
                        } else {
                            let _ = app_handle.emit("desktop://minimized-to-tray", true);
                            api.prevent_close();
                            if let Some(main_window) = app_handle.get_webview_window("main") {
                                let _ = main_window.hide();
                            }
                        }
                    }
                    _ => {}
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            set_unsaved_edits,
            quit_app,
            read_text_file,
            set_native_menu,
            set_native_menu_command_state,
            open_project_window,
            set_secure_secret,
            get_secure_secret,
            delete_secure_secret
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
