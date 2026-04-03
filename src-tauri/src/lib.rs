use serde::Deserialize;
use std::fs;

#[derive(Deserialize)]
#[serde(rename_all = "lowercase")]
enum WindowAction {
  Minimize,
  Maximize,
  Close,
}

#[tauri::command]
fn window_control(window: tauri::Window, action: WindowAction) -> Result<(), String> {
  match action {
    WindowAction::Minimize => window.minimize().map_err(|e| e.to_string()),
    WindowAction::Maximize => {
      let is_max = window.is_maximized().map_err(|e| e.to_string())?;
      if is_max {
        window.unmaximize().map_err(|e| e.to_string())
      } else {
        window.maximize().map_err(|e| e.to_string())
      }
    }
    WindowAction::Close => window.close().map_err(|e| e.to_string()),
  }
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
  if path.trim().is_empty() {
    return Err("Invalid path".to_string());
  }
  fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_file(path: String, data: String) -> Result<(), String> {
  if path.trim().is_empty() {
    return Err("Invalid path".to_string());
  }
  fs::write(path, data).map_err(|e| e.to_string())
}

#[tauri::command]
fn fetch_google_trends(_keyword: String) -> Option<serde_json::Value> {
  None
}

#[tauri::command]
fn fetch_amazon_competitors(_keyword: String) -> Vec<serde_json::Value> {
  Vec::new()
}

#[tauri::command]
fn fetch_amazon_suggestions(_keyword: String) -> Vec<String> {
  Vec::new()
}

#[tauri::command]
fn start_automation(_payload: serde_json::Value) -> Result<(), String> {
  Err("Automation command not implemented in Tauri yet. Use Electron/backend mode.".to_string())
}

#[tauri::command]
fn captcha_solution(_solution: String) -> Result<(), String> {
  Err("Automation command not implemented in Tauri yet. Use Electron/backend mode.".to_string())
}

#[tauri::command]
fn stop_automation() -> Result<(), String> {
  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      window_control,
      read_file,
      write_file,
      fetch_google_trends,
      fetch_amazon_competitors,
      fetch_amazon_suggestions,
      start_automation,
      captcha_solution,
      stop_automation
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
