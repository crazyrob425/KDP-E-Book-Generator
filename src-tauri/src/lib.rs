use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::{path::PathBuf, sync::Arc};
use tauri::{Emitter, Manager, State};
use thiserror::Error;
use tokio::sync::Mutex;
use uuid::Uuid;

#[derive(Debug, Error)]
enum AppError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("SQLite error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("Tauri error: {0}")]
    Tauri(String),
}

type AppResult<T> = Result<T, String>;

#[derive(Clone)]
struct DbState {
    db_path: PathBuf,
}

#[derive(Clone)]
struct JobsState {
    active: Arc<Mutex<Vec<Uuid>>>,
}

#[derive(Debug, Serialize, Clone)]
struct JobProgressEvent {
    job_id: String,
    stage: String,
    percent: u8,
    message: String,
}

fn get_data_dir(app: &tauri::AppHandle) -> Result<PathBuf, AppError> {
    app.path()
        .app_data_dir()
        .map_err(|e| AppError::Tauri(e.to_string()))
}

fn ensure_sqlite_schema(db_path: &PathBuf) -> Result<(), AppError> {
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let conn = Connection::open(db_path)?;
    conn.execute_batch(
        r#"
        PRAGMA journal_mode=WAL;

        CREATE TABLE IF NOT EXISTS projects (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            created_at  INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS project_notes (
            id          TEXT PRIMARY KEY,
            project_id  TEXT NOT NULL,
            note_type   TEXT NOT NULL,
            content     TEXT NOT NULL,
            created_at  INTEGER NOT NULL,
            FOREIGN KEY(project_id) REFERENCES projects(id)
        );

        CREATE VIRTUAL TABLE IF NOT EXISTS project_text_fts
        USING fts5(project_id, source, content);
        "#,
    )?;
    Ok(())
}

#[tauri::command]
fn get_app_paths(app: tauri::AppHandle) -> AppResult<serde_json::Value> {
    let dir = get_data_dir(&app).map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "appDataDir": dir.to_string_lossy() }))
}

#[tauri::command]
fn sqlite_status(db: State<DbState>) -> AppResult<serde_json::Value> {
    Ok(serde_json::json!({
        "dbPath": db.db_path.to_string_lossy(),
        "ok": true
    }))
}

#[derive(Debug, Deserialize)]
struct StartDemoJobInput {
    stage_count: Option<u8>,
}

#[tauri::command]
async fn start_demo_job(
    app: tauri::AppHandle,
    jobs: State<'_, JobsState>,
    input: StartDemoJobInput,
) -> AppResult<String> {
    let job_id = Uuid::new_v4();
    {
        let mut active = jobs.active.lock().await;
        active.push(job_id);
    }

    let stages = input.stage_count.unwrap_or(5).max(1);

    tauri::async_runtime::spawn(async move {
        for i in 0..stages {
            let percent = (((i + 1) as f32 / stages as f32) * 100.0) as u8;
            let event = JobProgressEvent {
                job_id: job_id.to_string(),
                stage: format!("stage_{}", i + 1),
                percent,
                message: format!("Completed stage {}/{}", i + 1, stages),
            };
            let _ = app.emit("job_progress", event);
            tokio::time::sleep(std::time::Duration::from_millis(600)).await;
        }
        let _ = app.emit(
            "job_done",
            serde_json::json!({ "job_id": job_id.to_string() }),
        );
        // Remove the completed job from the active list
        if let Ok(state) = app.try_state::<JobsState>() {
            let mut active = state.active.lock().await;
            active.retain(|id| *id != job_id);
        }
    });

    Ok(job_id.to_string())
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

            let data_dir = get_data_dir(app.handle())
                .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e.to_string()))?;
            let db_path = data_dir.join("db").join("app.sqlite3");

            ensure_sqlite_schema(&db_path)
                .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e.to_string()))?;

            app.manage(DbState { db_path });
            app.manage(JobsState {
                active: Arc::new(Mutex::new(vec![])),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_app_paths,
            sqlite_status,
            start_demo_job
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

