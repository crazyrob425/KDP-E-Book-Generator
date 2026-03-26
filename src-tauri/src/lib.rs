use serde::{Deserialize, Serialize};
use std::fs;
use tauri::{AppHandle, Manager, Monitor, PhysicalPosition, PhysicalSize};

/// Inset margin (px) kept between the restored window and every edge of the
/// monitor work-area so the window is never flush against the screen border.
const MARGIN: i32 = 16;

/// Minimum restored window dimensions (logical pixels).
const MIN_WIDTH: u32 = 400;
const MIN_HEIGHT: u32 = 300;

/// Persisted window state written to `<AppData>/window-state.json`.
#[derive(Serialize, Deserialize, Debug, Clone)]
struct WindowState {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    maximized: bool,
    /// Monitor name used to re-identify the target monitor on next launch.
    monitor_name: Option<String>,
    /// Top-left pixel of the monitor that held the window when state was saved.
    monitor_x: i32,
    monitor_y: i32,
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/// Return the first monitor in `monitors` whose bounds contain `(x, y)`.
fn find_monitor_containing_point(monitors: &[Monitor], x: i32, y: i32) -> Option<&Monitor> {
    monitors.iter().find(|m| {
        let mp = m.position();
        let ms = m.size();
        x >= mp.x && x < mp.x + ms.width as i32 && y >= mp.y && y < mp.y + ms.height as i32
    })
}

/// Compute the inset work-area size for one axis.
/// Returns `(inset_origin, inset_extent)` where both are >= 0.
fn inset_axis(origin: i32, size: u32) -> (i32, u32) {
    let inset_size = (size as i32 - 2 * MARGIN).max(0) as u32;
    (origin + MARGIN, inset_size)
}

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

fn state_file_path(app: &AppHandle) -> Option<std::path::PathBuf> {
    app.path()
        .app_data_dir()
        .ok()
        .map(|dir| dir.join("window-state.json"))
}

fn load_window_state(app: &AppHandle) -> Option<WindowState> {
    let path = state_file_path(app)?;
    let content = fs::read_to_string(path).ok()?;
    serde_json::from_str(&content).ok()
}

fn save_window_state(app: &AppHandle, state: &WindowState) {
    if let Some(path) = state_file_path(app) {
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        if let Ok(json) = serde_json::to_string_pretty(state) {
            let _ = fs::write(path, json);
        }
    }
}

// ---------------------------------------------------------------------------
// Snapshot: read the current window state and persist it.
// ---------------------------------------------------------------------------

fn snapshot_and_save(window: &tauri::WebviewWindow) {
    let app = window.app_handle();

    let maximized = window.is_maximized().unwrap_or(false);

    if maximized {
        // When maximized, only update the flag so we don't overwrite the saved
        // normal (unmaximized) position and size with the full-screen bounds.
        if let Some(mut existing) = load_window_state(app) {
            existing.maximized = true;
            save_window_state(app, &existing);
        }
        // If there is no prior state there is nothing to anchor the normal rect
        // to, so skip saving until the user restores to a normal window.
        return;
    }

    let pos = match window.outer_position() {
        Ok(p) => p,
        Err(_) => return,
    };
    let size = match window.outer_size() {
        Ok(s) => s,
        Err(_) => return,
    };

    // Find which monitor currently contains the window's top-left corner so we
    // can identify it on the next launch.
    let (mon_name, mon_x, mon_y) = match app.available_monitors() {
        Ok(monitors) => {
            match find_monitor_containing_point(&monitors, pos.x, pos.y) {
                Some(m) => (
                    m.name().map(|n| n.to_owned()),
                    m.position().x,
                    m.position().y,
                ),
                None => (None, 0, 0),
            }
        }
        Err(_) => (None, 0, 0),
    };

    let state = WindowState {
        x: pos.x,
        y: pos.y,
        width: size.width,
        height: size.height,
        maximized: false,
        monitor_name: mon_name,
        monitor_x: mon_x,
        monitor_y: mon_y,
    };

    save_window_state(app, &state);
}

// ---------------------------------------------------------------------------
// Restore: apply a saved state to the window, with monitor selection,
// shrink-to-fit, and 16 px margin clamping.
// ---------------------------------------------------------------------------

fn restore_window_state(window: &tauri::WebviewWindow, state: &WindowState) {
    let app = window.app_handle();

    let monitors = match app.available_monitors() {
        Ok(m) if !m.is_empty() => m,
        _ => {
            // No monitor info available – nothing safe to do.
            return;
        }
    };

    // 1. Prefer the monitor whose name matches the saved one.
    // 2. Otherwise pick a monitor whose bounds contain the saved top-left.
    // 3. Fall back to the primary monitor (or first available).
    let target_monitor = monitors
        .iter()
        .find(|m| {
            state
                .monitor_name
                .as_deref()
                .map(|n| m.name() == Some(n))
                .unwrap_or(false)
        })
        .or_else(|| find_monitor_containing_point(&monitors, state.x, state.y))
        .or_else(|| {
            app.primary_monitor()
                .ok()
                .flatten()
                .and_then(|pm| monitors.iter().find(|m| m.name() == pm.name()))
        })
        .or_else(|| monitors.first());

    let monitor = match target_monitor {
        Some(m) => m,
        None => return,
    };

    // Work-area: full monitor bounds with MARGIN inset on every side.
    let mp = monitor.position();
    let ms = monitor.size();

    let (wa_x, wa_w) = inset_axis(mp.x, ms.width);
    let (wa_y, wa_h) = inset_axis(mp.y, ms.height);

    // Enforce minimum dimensions, then shrink to fit the effective work area.
    let mut w = state.width.max(MIN_WIDTH);
    let mut h = state.height.max(MIN_HEIGHT);

    if wa_w > 0 {
        w = w.min(wa_w);
    }
    if wa_h > 0 {
        h = h.min(wa_h);
    }

    // Clamp the top-left so the window stays fully inside the work area.
    let x = if wa_w > 0 {
        state.x.max(wa_x).min(wa_x + wa_w as i32 - w as i32)
    } else {
        wa_x
    };
    let y = if wa_h > 0 {
        state.y.max(wa_y).min(wa_y + wa_h as i32 - h as i32)
    } else {
        wa_y
    };

    // Apply the sane/clamped normal bounds first (important even when
    // maximized, so un-maximizing later restores a visible rectangle).
    let _ = window.set_size(PhysicalSize::new(w, h));
    let _ = window.set_position(PhysicalPosition::new(x, y));

    if state.maximized {
        let _ = window.maximize();
    }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

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

            // Restore saved window state (if any).
            if let Some(window) = app.get_webview_window("main") {
                if let Some(state) = load_window_state(app.handle()) {
                    restore_window_state(&window, &state);
                }

                // Persist state on every move, resize, or close.
                let window_clone = window.clone();
                window.on_window_event(move |event| {
                    match event {
                        tauri::WindowEvent::Moved(_)
                        | tauri::WindowEvent::Resized(_)
                        | tauri::WindowEvent::CloseRequested { .. } => {
                            snapshot_and_save(&window_clone);
                        }
                        _ => {}
                    }
                });
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Inset margin (px) kept between the restored window and every edge of the
/// monitor work-area so the window is never flush against the screen border.
const MARGIN: i32 = 16;

/// Minimum restored window dimensions (logical pixels).
const MIN_WIDTH: u32 = 400;
const MIN_HEIGHT: u32 = 300;

/// Persisted window state written to `<AppData>/window-state.json`.
#[derive(Serialize, Deserialize, Debug, Clone)]
struct WindowState {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    maximized: bool,
    /// Monitor name used to re-identify the target monitor on next launch.
    monitor_name: Option<String>,
    /// Top-left pixel of the monitor that held the window when state was saved.
    monitor_x: i32,
    monitor_y: i32,
}

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

fn state_file_path(app: &AppHandle) -> Option<std::path::PathBuf> {
    app.path()
        .app_data_dir()
        .ok()
        .map(|dir| dir.join("window-state.json"))
}

fn load_window_state(app: &AppHandle) -> Option<WindowState> {
    let path = state_file_path(app)?;
    let content = fs::read_to_string(path).ok()?;
    serde_json::from_str(&content).ok()
}

fn save_window_state(app: &AppHandle, state: &WindowState) {
    if let Some(path) = state_file_path(app) {
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        if let Ok(json) = serde_json::to_string_pretty(state) {
            let _ = fs::write(path, json);
        }
    }
}

// ---------------------------------------------------------------------------
// Snapshot: read the current window state and persist it.
// ---------------------------------------------------------------------------

fn snapshot_and_save(window: &tauri::WebviewWindow) {
    let app = window.app_handle();

    let maximized = window.is_maximized().unwrap_or(false);

    if maximized {
        // When maximized, only update the flag so we don't overwrite the saved
        // normal (unmaximized) position and size with the full-screen bounds.
        if let Some(mut existing) = load_window_state(app) {
            existing.maximized = true;
            save_window_state(app, &existing);
        }
        // If there is no prior state there is nothing to anchor the normal rect
        // to, so skip saving until the user restores to a normal window.
        return;
    }

    let pos = match window.outer_position() {
        Ok(p) => p,
        Err(_) => return,
    };
    let size = match window.outer_size() {
        Ok(s) => s,
        Err(_) => return,
    };

    // Find which monitor currently contains the window's top-left corner so we
    // can identify it on the next launch.
    let (mon_name, mon_x, mon_y) = match app.available_monitors() {
        Ok(monitors) => {
            let found = monitors.iter().find(|m| {
                let mp = m.position();
                let ms = m.size();
                pos.x >= mp.x
                    && pos.x < mp.x + ms.width as i32
                    && pos.y >= mp.y
                    && pos.y < mp.y + ms.height as i32
            });
            match found {
                Some(m) => (
                    m.name().map(|n| n.to_owned()),
                    m.position().x,
                    m.position().y,
                ),
                None => (None, 0, 0),
            }
        }
        Err(_) => (None, 0, 0),
    };

    let state = WindowState {
        x: pos.x,
        y: pos.y,
        width: size.width,
        height: size.height,
        maximized: false,
        monitor_name: mon_name,
        monitor_x: mon_x,
        monitor_y: mon_y,
    };

    save_window_state(app, &state);
}

// ---------------------------------------------------------------------------
// Restore: apply a saved state to the window, with monitor selection,
// shrink-to-fit, and 16 px margin clamping.
// ---------------------------------------------------------------------------

fn restore_window_state(window: &tauri::WebviewWindow, state: &WindowState) {
    let app = window.app_handle();

    let monitors = match app.available_monitors() {
        Ok(m) if !m.is_empty() => m,
        _ => {
            // No monitor info available – nothing safe to do.
            return;
        }
    };

    // 1. Prefer the monitor whose name matches the saved one.
    // 2. Otherwise pick a monitor whose bounds contain the saved top-left.
    // 3. Fall back to the primary monitor (or first available).
    let target_monitor = monitors
        .iter()
        .find(|m| {
            state
                .monitor_name
                .as_deref()
                .map(|n| m.name() == Some(n))
                .unwrap_or(false)
        })
        .or_else(|| {
            monitors.iter().find(|m| {
                let mp = m.position();
                let ms = m.size();
                state.x >= mp.x
                    && state.x < mp.x + ms.width as i32
                    && state.y >= mp.y
                    && state.y < mp.y + ms.height as i32
            })
        })
        .or_else(|| {
            app.primary_monitor()
                .ok()
                .flatten()
                .and_then(|pm| monitors.iter().find(|m| m.name() == pm.name()))
        })
        .or_else(|| monitors.first());

    let monitor = match target_monitor {
        Some(m) => m,
        None => return,
    };

    // Work-area: full monitor bounds.  Add MARGIN inset on every side.
    let mp = monitor.position();
    let ms = monitor.size();

    // Effective work area after applying the margin inset.
    // Guard against very small monitors: if the work area is too small even for
    // the margin, treat the margin as 0 on that axis.
    let wa_x = mp.x + MARGIN;
    let wa_y = mp.y + MARGIN;
    let wa_w = (ms.width as i32 - 2 * MARGIN).max(0) as u32;
    let wa_h = (ms.height as i32 - 2 * MARGIN).max(0) as u32;

    // Enforce minimum dimensions, then shrink to fit the effective work area.
    let mut w = state.width.max(MIN_WIDTH);
    let mut h = state.height.max(MIN_HEIGHT);

    if wa_w > 0 {
        w = w.min(wa_w);
    }
    if wa_h > 0 {
        h = h.min(wa_h);
    }

    // Clamp the top-left so the window stays fully inside the work area.
    let mut x = state.x;
    let mut y = state.y;

    if wa_w > 0 {
        x = x.max(wa_x).min(wa_x + wa_w as i32 - w as i32);
    } else {
        x = wa_x;
    }
    if wa_h > 0 {
        y = y.max(wa_y).min(wa_y + wa_h as i32 - h as i32);
    } else {
        y = wa_y;
    }

    // Apply the sane/clamped normal bounds first (important even when
    // maximized, so un-maximizing later restores a visible rectangle).
    let _ = window.set_size(PhysicalSize::new(w, h));
    let _ = window.set_position(PhysicalPosition::new(x, y));

    if state.maximized {
        let _ = window.maximize();
    }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

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

            // Restore saved window state (if any).
            if let Some(window) = app.get_webview_window("main") {
                if let Some(state) = load_window_state(app.handle()) {
                    restore_window_state(&window, &state);
                }

                // Persist state on every move, resize, or close.
                let window_clone = window.clone();
                window.on_window_event(move |event| {
                    match event {
                        tauri::WindowEvent::Moved(_)
                        | tauri::WindowEvent::Resized(_)
                        | tauri::WindowEvent::CloseRequested { .. } => {
                            snapshot_and_save(&window_clone);
                        }
                        _ => {}
                    }
                });
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
