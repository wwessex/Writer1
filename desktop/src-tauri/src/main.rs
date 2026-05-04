#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    collections::{HashMap, HashSet},
    fs,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex, OnceLock,
    },
};

use serde::Deserialize;
use tauri::{
    menu::{Menu, MenuBuilder, MenuId, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder},
    AppHandle, Emitter, Manager, WindowEvent,
};

const KEYRING_SERVICE: &str = "DraftHarbourStudio";
const ALLOWED_SECRET_KEYS: &[&str] = &["ai_session_token", "sync_auth_header"];

static HAS_UNSAVED_EDITS: AtomicBool = AtomicBool::new(false);
static ALLOWED_PROJECT_FILES: OnceLock<Mutex<HashSet<PathBuf>>> = OnceLock::new();

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
fn read_project_file(path: String) -> Result<String, String> {
    let canonical_path = validate_allowed_project_file(&path)?;
    fs::read_to_string(canonical_path).map_err(|err| err.to_string())
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
            .hidden_title(true);
    }

    window_builder.build().map_err(|err| err.to_string())?;

    Ok(())
}

#[tauri::command]
fn set_secure_secret(key: String, value: String) -> Result<(), String> {
    let key = validate_secret_key(&key)?;
    let entry = keyring::Entry::new(KEYRING_SERVICE, key).map_err(|err| err.to_string())?;
    entry.set_password(&value).map_err(|err| err.to_string())
}

#[tauri::command]
fn get_secure_secret(key: String) -> Result<Option<String>, String> {
    let key = validate_secret_key(&key)?;
    let entry = keyring::Entry::new(KEYRING_SERVICE, key).map_err(|err| err.to_string())?;
    match entry.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(err) => Err(err.to_string()),
    }
}

#[tauri::command]
fn delete_secure_secret(key: String) -> Result<(), String> {
    let key = validate_secret_key(&key)?;
    let entry = keyring::Entry::new(KEYRING_SERVICE, key).map_err(|err| err.to_string())?;
    match entry.delete_credential() {
        Ok(_) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(err) => Err(err.to_string()),
    }
}

fn validate_secret_key(key: &str) -> Result<&str, String> {
    let trimmed = key.trim();
    if ALLOWED_SECRET_KEYS.contains(&trimmed) {
        Ok(trimmed)
    } else {
        Err("Unsupported secure secret key.".to_string())
    }
}

fn allowed_project_files() -> &'static Mutex<HashSet<PathBuf>> {
    ALLOWED_PROJECT_FILES.get_or_init(|| Mutex::new(HashSet::new()))
}

fn has_dhproj_extension(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.eq_ignore_ascii_case("dhproj"))
        .unwrap_or(false)
}

fn canonical_dhproj_path(path: &str) -> Result<PathBuf, String> {
    let raw_path = Path::new(path);
    if !has_dhproj_extension(raw_path) {
        return Err("Only .dhproj project files can be opened by the desktop bridge.".to_string());
    }

    let canonical_path = fs::canonicalize(raw_path).map_err(|err| err.to_string())?;
    if !has_dhproj_extension(&canonical_path) {
        return Err(
            "Only canonical .dhproj project files can be opened by the desktop bridge.".to_string(),
        );
    }

    if !canonical_path.is_file() {
        return Err("Project path is not a file.".to_string());
    }

    Ok(canonical_path)
}

fn register_project_file(path: &str) -> Option<PathBuf> {
    let canonical_path = canonical_dhproj_path(path).ok()?;
    if let Ok(mut allowed) = allowed_project_files().lock() {
        allowed.insert(canonical_path.clone());
        Some(canonical_path)
    } else {
        None
    }
}

fn validate_allowed_project_file(path: &str) -> Result<PathBuf, String> {
    let canonical_path = canonical_dhproj_path(path)?;
    let allowed = allowed_project_files()
        .lock()
        .map_err(|_| "Unable to validate project file access.".to_string())?;

    if allowed.contains(&canonical_path) {
        Ok(canonical_path)
    } else {
        Err("Project file was not opened by the desktop launcher.".to_string())
    }
}

fn apply_native_role<R: tauri::Runtime, M: Manager<R>>(
    manager: &M,
    role: &str,
) -> Result<Option<PredefinedMenuItem<R>>, String> {
    let item = match role {
        "undo" => Some(PredefinedMenuItem::undo(manager, None)),
        "redo" => Some(PredefinedMenuItem::redo(manager, None)),
        "cut" => Some(PredefinedMenuItem::cut(manager, None)),
        "copy" => Some(PredefinedMenuItem::copy(manager, None)),
        "paste" => Some(PredefinedMenuItem::paste(manager, None)),
        "selectAll" => Some(PredefinedMenuItem::select_all(manager, None)),
        _ => None,
    };

    item.transpose().map_err(|err| err.to_string())
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
                if let Some(predefined) = apply_native_role(&app, role)? {
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
                if let Some(menu_item) = item.as_menuitem() {
                    let _ = menu_item.set_enabled(enabled);
                } else if let Some(check_item) = item.as_check_menuitem() {
                    let _ = check_item.set_enabled(enabled);
                } else if let Some(icon_item) = item.as_icon_menuitem() {
                    let _ = icon_item.set_enabled(enabled);
                } else if let Some(submenu) = item.as_submenu() {
                    let _ = submenu.set_enabled(enabled);
                }
            }
        }
    }

    Ok(())
}

fn emit_launch_payloads(app: &AppHandle, args: &[String]) {
    for arg in args {
        if let Some(project_path) = register_project_file(arg) {
            let _ = app.emit(
                "desktop://open-project",
                project_path.to_string_lossy().to_string(),
            );
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
            read_project_file,
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_dhproj_path(extension: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after UNIX_EPOCH")
            .as_nanos();
        std::env::temp_dir().join(format!("draftharbour-test-{unique}.{extension}"))
    }

    #[test]
    fn secret_key_validation_allows_known_keys_only() {
        assert_eq!(
            validate_secret_key("ai_session_token"),
            Ok("ai_session_token")
        );
        assert_eq!(
            validate_secret_key(" sync_auth_header "),
            Ok("sync_auth_header")
        );
        assert!(validate_secret_key("other_key").is_err());
    }

    #[test]
    fn project_file_validation_requires_dhproj_extension() {
        let path = temp_dhproj_path("txt");
        fs::write(&path, "not a project").expect("test file should be writable");

        let result = canonical_dhproj_path(path.to_str().expect("temp path should be utf-8"));
        let _ = fs::remove_file(path);

        assert!(result.is_err());
    }

    #[cfg(unix)]
    #[test]
    fn project_file_validation_rejects_symlink_to_non_project() {
        let target_path = temp_dhproj_path("txt");
        let link_path = temp_dhproj_path("dhproj");
        fs::write(&target_path, "not a project").expect("test file should be writable");
        std::os::unix::fs::symlink(&target_path, &link_path)
            .expect("test symlink should be writable");

        let result = canonical_dhproj_path(link_path.to_str().expect("temp path should be utf-8"));
        let _ = fs::remove_file(link_path);
        let _ = fs::remove_file(target_path);

        assert!(result.is_err());
    }

    #[test]
    fn project_file_must_be_registered_before_reading() {
        let path = temp_dhproj_path("dhproj");
        fs::write(&path, "{}").expect("test file should be writable");
        let path_string = path
            .to_str()
            .expect("temp path should be utf-8")
            .to_string();

        assert!(validate_allowed_project_file(&path_string).is_err());
        let registered = register_project_file(&path_string).expect("project file should register");
        assert_eq!(validate_allowed_project_file(&path_string), Ok(registered));

        let _ = fs::remove_file(path);
    }
}
