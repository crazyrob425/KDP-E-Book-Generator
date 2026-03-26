use std::{
    fs,
    path::PathBuf,
    sync::{Arc, Mutex},
    thread,
    time::Duration,
};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, WindowEvent};

/// How long (ms) to wait after the last move/resize before writing to disk.
const DEBOUNCE_MS: u64 = 500;

/// Small margin (px) kept between the window rectangle and each edge of the
/// monitor work area after shrinking/clamping.  Prevents the window from
/// sitting flush against the taskbar or screen edge.
const EDGE_MARGIN: i32 = 8;

/// Fallback window position / size used only when the window is first
/// maximized before any normal-bounds state has been recorded.  These match
/// Tauri's own default window dimensions from `tauri.conf.json`.
const DEFAULT_X: i32 = 100;
const DEFAULT_Y: i32 = 100;
const DEFAULT_WIDTH: u32 = 800;
const DEFAULT_HEIGHT: u32 = 600;

// ─── Persisted state ────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
struct WindowState {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    maximized: bool,
}

fn state_file_path(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .app_data_dir()
        .ok()
        .map(|d| d.join("window-state.json"))
}

fn load_window_state(app: &AppHandle) -> Option<WindowState> {
    let path = state_file_path(app)?;
    let text = fs::read_to_string(&path).ok()?;
    serde_json::from_str(&text).ok()
}

fn persist_window_state(app: &AppHandle, state: &WindowState) {
    let Some(path) = state_file_path(app) else {
        return;
    };
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    match serde_json::to_string_pretty(state) {
        Ok(json) => {
            if let Err(e) = fs::write(&path, json) {
                log::warn!("Failed to write window state: {e}");
            } else {
                log::info!(
                    "Window state saved → x={} y={} w={} h={} maximized={}",
                    state.x,
                    state.y,
                    state.width,
                    state.height,
                    state.maximized
                );
            }
        }
        Err(e) => log::warn!("Failed to serialize window state: {e}"),
    }
}

// ─── Monitor selection ───────────────────────────────────────────────────────

/// Return the first monitor whose bounds contain the point `(px, py)`.
fn monitor_containing_point(
    monitors: &[tauri::Monitor],
    px: i32,
    py: i32,
) -> Option<&tauri::Monitor> {
    monitors.iter().find(|m| {
        let mx = m.position().x;
        let my = m.position().y;
        let mw = m.size().width as i32;
        let mh = m.size().height as i32;
        px >= mx && px < mx + mw && py >= my && py < my + mh
    })
}

// ─── Restore logic ──────────────────────────────────────────────────────────

fn restore_window(app: &AppHandle) {
    let saved = match load_window_state(app) {
        Some(s) => s,
        None => {
            log::info!("No saved window state; using tauri.conf.json defaults.");
            return;
        }
    };
    log::info!(
        "Restoring window state: x={} y={} w={} h={} maximized={}",
        saved.x,
        saved.y,
        saved.width,
        saved.height,
        saved.maximized
    );

    let window = match app.get_webview_window("main") {
        Some(w) => w,
        None => {
            log::warn!("Could not find 'main' window for restoration.");
            return;
        }
    };

    let monitors: Vec<tauri::Monitor> = window.available_monitors().unwrap_or_default();
    if monitors.is_empty() {
        log::warn!("No monitors enumerated; skipping window restore.");
        return;
    }

    // ── Choose monitor ───────────────────────────────────────────────────────
    // Preference order:
    //   1. Monitor that contains the saved top-left corner (same monitor re-use)
    //   2. Primary monitor
    //   3. First in list
    let monitor: &tauri::Monitor = monitor_containing_point(&monitors, saved.x, saved.y)
        .or_else(|| {
            window
                .primary_monitor()
                .ok()
                .flatten()
                .and_then(|pm| monitors.iter().find(|m| m.name() == pm.name()))
        })
        .unwrap_or_else(|| monitors.first().expect("non-empty list"));

    let mon_x = monitor.position().x;
    let mon_y = monitor.position().y;

    // ── Work area ─────────────────────────────────────────────────────────────
    // Tauri v2.9+ exposes the OS-reported work area (monitor minus taskbar and
    // other reserved areas) via Monitor::work_area().
    let work_area = monitor.work_area();
    let work_x = work_area.position.x + EDGE_MARGIN;
    let work_y = work_area.position.y + EDGE_MARGIN;
    let work_w = work_area.size.width as i32 - EDGE_MARGIN * 2;
    let work_h = work_area.size.height as i32 - EDGE_MARGIN * 2;

    log::info!(
        "Monitor: origin=({mon_x},{mon_y})  work_area: \
         pos=({},{}) size={}x{}",
        work_area.position.x,
        work_area.position.y,
        work_area.size.width,
        work_area.size.height
    );

    // ── Shrink if saved size exceeds the work area ───────────────────────────
    let mut width = saved.width as i32;
    let mut height = saved.height as i32;

    if width > work_w {
        log::info!("Shrinking width from {width} to {work_w} to fit work area.");
        width = work_w;
    }
    if height > work_h {
        log::info!("Shrinking height from {height} to {work_h} to fit work area.");
        height = work_h;
    }

    // ── Clamp position so the entire window is within the work area ───────────
    let mut x = saved.x;
    let mut y = saved.y;

    // Right edge
    if x + width > work_x + work_w {
        x = work_x + work_w - width;
    }
    // Left edge
    if x < work_x {
        x = work_x;
    }
    // Bottom edge
    if y + height > work_y + work_h {
        y = work_y + work_h - height;
    }
    // Top edge
    if y < work_y {
        y = work_y;
    }

    log::info!(
        "Applying bounds: x={x} y={y} w={width} h={height} maximized={}",
        saved.maximized
    );

    // Apply normal (possibly shrunk/clamped) bounds first, then maximize.
    let _ = window.set_size(PhysicalSize::new(width as u32, height as u32));
    let _ = window.set_position(PhysicalPosition::new(x, y));

    if saved.maximized {
        let _ = window.maximize();
    }
}

// ─── Entry point ────────────────────────────────────────────────────────────

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

            // ── Restore saved window state on startup ────────────────────────
            restore_window(app.handle());

            // ── Debounced save on move / resize ──────────────────────────────
            //
            // `pending` holds the most recent window state that needs flushing.
            // A background thread wakes every DEBOUNCE_MS and flushes it.
            let pending: Arc<Mutex<Option<WindowState>>> = Arc::new(Mutex::new(None));

            let pending_bg = Arc::clone(&pending);
            let app_handle_bg = app.handle().clone();
            thread::spawn(move || loop {
                thread::sleep(Duration::from_millis(DEBOUNCE_MS));
                if let Some(state) = pending_bg.lock().unwrap().take() {
                    persist_window_state(&app_handle_bg, &state);
                }
            });

            // Capture the window for the event handler.
            let window = app
                .get_webview_window("main")
                .expect("'main' webview window must exist");

            let window_ev = window.clone();
            let pending_ev = Arc::clone(&pending);
            let app_handle_close = app.handle().clone();

            window.on_window_event(move |event| {
                // On close: flush any pending state synchronously so it is
                // never lost due to the debounce thread still sleeping.
                if matches!(event, WindowEvent::CloseRequested { .. }) {
                    if let Some(state) = pending_ev.lock().unwrap().take() {
                        persist_window_state(&app_handle_close, &state);
                    }
                    return;
                }

                let is_resize_or_move =
                    matches!(event, WindowEvent::Resized(_) | WindowEvent::Moved(_));
                if !is_resize_or_move {
                    return;
                }

                let maximized = window_ev.is_maximized().unwrap_or(false);

                let mut guard = pending_ev.lock().unwrap();

                if maximized {
                    // Window is maximized: preserve the last known normal
                    // bounds but record the maximized flag.
                    if let Some(ref mut s) = *guard {
                        s.maximized = true;
                    } else {
                        // No prior state yet; record placeholder normal bounds
                        // so we have something valid to restore to later.
                        *guard = Some(WindowState {
                            x: DEFAULT_X,
                            y: DEFAULT_Y,
                            width: DEFAULT_WIDTH,
                            height: DEFAULT_HEIGHT,
                            maximized: true,
                        });
                    }
                } else {
                    // Not maximized: capture the current outer bounds.
                    let pos = window_ev
                        .outer_position()
                        .unwrap_or(PhysicalPosition::new(DEFAULT_X, DEFAULT_Y));
                    let size = window_ev
                        .outer_size()
                        .unwrap_or(PhysicalSize::new(DEFAULT_WIDTH, DEFAULT_HEIGHT));
                    *guard = Some(WindowState {
                        x: pos.x,
                        y: pos.y,
                        width: size.width,
                        height: size.height,
                        maximized: false,
                    });
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
