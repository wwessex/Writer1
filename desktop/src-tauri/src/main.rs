#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{fs, sync::atomic::{AtomicBool, Ordering}};

use tauri::{AppHandle, Emitter, Manager, WindowEvent};

static HAS_UNSAVED_EDITS: AtomicBool = AtomicBool::new(false);

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
        .invoke_handler(tauri::generate_handler![set_unsaved_edits, quit_app, read_text_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
