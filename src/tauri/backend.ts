import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export type JobProgressEvent = {
  job_id: string;
  stage: string;
  percent: number;
  message: string;
};

export async function getAppPaths() {
  return invoke<{ appDataDir: string }>("get_app_paths");
}

export async function sqliteStatus() {
  return invoke<{ dbPath: string; ok: boolean }>("sqlite_status");
}

export async function startDemoJob(stageCount = 5) {
  return invoke<string>("start_demo_job", { input: { stage_count: stageCount } });
}

export function onJobProgress(cb: (e: JobProgressEvent) => void) {
  return listen<JobProgressEvent>("job_progress", (event) => cb(event.payload));
}

export function onJobDone(cb: (payload: { job_id: string }) => void) {
  return listen<{ job_id: string }>("job_done", (event) => cb(event.payload));
}
