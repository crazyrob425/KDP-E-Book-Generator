use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{Manager, PhysicalPosition, PhysicalSize};

/// Milliseconds of inactivity after which a pending window-state change is flushed to disk.
const DEBOUNCE_MS: u64 = 500;

/// Persisted window geometry and maximized flag.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct WindowState {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    maximized: bool,
}

impl Default for WindowState {
    fn default() -> Self {
        Self {
            x: 100,
            y: 100,
            width: 1200,
            height: 800,
            maximized: false,
        }
    }
}

fn state_file_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    app.path()
        .app_data_dir()
        .ok()
        .map(|p| p.join("window-state.json"))
}

fn load_window_state(app: &tauri::AppHandle) -> WindowState {
    state_file_path(app)
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save_window_state(app: &tauri::AppHandle, state: &WindowState) {
    if let Some(path) = state_file_path(app) {
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        if let Ok(json) = serde_json::to_string_pretty(state) {
            let _ = fs::write(path, json);
        }
    }
}

/// Clamp `state` bounds so the window stays on a known monitor.
/// Ensures at least 50 px of the title bar are visible.
fn clamp_to_monitors(state: &mut WindowState, monitors: &[tauri::Monitor]) {
    if monitors.is_empty() {
        return;
    }
    // Pick the monitor whose area contains the window's top-left corner,
    // or fall back to the first (primary) monitor.
    let monitor = monitors
        .iter()
        .find(|m| {
            let p = m.position();
            let s = m.size();
            state.x >= p.x
                && state.x < p.x + s.width as i32
                && state.y >= p.y
                && state.y < p.y + s.height as i32
        })
        .unwrap_or(&monitors[0]);

    let mp = monitor.position();
    let ms = monitor.size();

    // Clamp window size to monitor size.
    state.width = state.width.min(ms.width);
    state.height = state.height.min(ms.height);

    // Ensure the title bar (top-left) remains accessible.
    const MIN_VISIBLE: i32 = 50;
    state.x = state.x.clamp(mp.x, mp.x + ms.width as i32 - MIN_VISIBLE);
    state.y = state.y.clamp(mp.y, mp.y + ms.height as i32 - MIN_VISIBLE);
}

/// Apply `state` to `window`, clamping to the current monitor layout.
/// The window is made visible after the geometry is applied.
fn apply_window_state(window: &tauri::WebviewWindow, state: &mut WindowState) {
    let monitors = window.available_monitors().unwrap_or_default();
    clamp_to_monitors(state, &monitors);

    let _ = window.set_size(PhysicalSize::new(state.width, state.height));
    let _ = window.set_position(PhysicalPosition::new(state.x, state.y));

    if state.maximized {
        let _ = window.maximize();
    }

    // Show the window after applying geometry to avoid a position-flicker.
    let _ = window.show();
}

/// Register window-event listeners that persist state with a 500 ms debounce.
fn setup_state_persistence(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    initial_state: WindowState,
) {
    let shared = Arc::new(Mutex::new(initial_state));
    let (tx, rx) = mpsc::channel::<()>();

    // Background thread: drain rapid-fire events then write to disk.
    {
        let shared = Arc::clone(&shared);
        let app = app.clone();
        std::thread::spawn(move || {
            while rx.recv().is_ok() {
                // Absorb any further signals arriving within the debounce window.
                while rx.recv_timeout(Duration::from_millis(DEBOUNCE_MS)).is_ok() {}
                let state = shared.lock().unwrap().clone();
                save_window_state(&app, &state);
            }
        });
    }

    // Window event listener.
    window.on_window_event({
        let shared = Arc::clone(&shared);
        let win = window.clone();
        move |event| match event {
            tauri::WindowEvent::Moved(pos) => {
                let maximized = win.is_maximized().unwrap_or(false);
                let mut s = shared.lock().unwrap();
                s.maximized = maximized;
                if !maximized {
                    s.x = pos.x;
                    s.y = pos.y;
                }
                let _ = tx.send(());
            }
            tauri::WindowEvent::Resized(size) => {
                // Ignore the zero-size event emitted when the window is minimised.
                if size.width == 0 || size.height == 0 {
                    return;
                }
                let maximized = win.is_maximized().unwrap_or(false);
                let mut s = shared.lock().unwrap();
                s.maximized = maximized;
                if !maximized {
                    s.width = size.width;
                    s.height = size.height;
                }
                let _ = tx.send(());
            }
            tauri::WindowEvent::CloseRequested { .. } => {
                // Save immediately so nothing is lost if the process exits quickly.
                let state = shared.lock().unwrap().clone();
                save_window_state(&app, &state);
            }
            _ => {}
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Restore window state from the previous session.
            let mut state = load_window_state(app.handle());
            if let Some(window) = app.get_webview_window("main") {
                apply_window_state(&window, &mut state);
                setup_state_persistence(window, app.handle().clone(), state);
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
