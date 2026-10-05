use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tauri_plugin_updater::UpdaterExt;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UpdateInfo {
    pub available: bool,
    pub version: Option<String>,
    pub current_version: String,
    pub notes: Option<String>,
    pub download_url: Option<String>,
    pub size: Option<u64>,
    pub pub_date: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UpdateProgress {
    pub status: String, // "checking", "downloading", "installing", "complete", "error"
    pub progress: Option<f32>, // 0.0 to 1.0
    pub message: Option<String>,
}

const CURRENT_VERSION: &str = env!("CARGO_PKG_VERSION");

#[tauri::command]
pub async fn check_for_updates(app_handle: AppHandle) -> Result<UpdateInfo, String> {
    let updater = app_handle.updater_builder()
        .build()
        .map_err(|e| format!("Failed to build updater: {}", e))?;

    let update = updater.check().await.map_err(|e| format!("Failed to check for updates: {}", e))?;

    if let Some(update) = update {
        Ok(UpdateInfo {
            available: true,
            version: Some(update.version.clone()),
            current_version: CURRENT_VERSION.to_string(),
            notes: update.body.clone(),
            download_url: None, // The updater handles download internally
            size: None,
            pub_date: update.date.map(|d| d.to_string()),
        })
    } else {
        Ok(UpdateInfo {
            available: false,
            version: None,
            current_version: CURRENT_VERSION.to_string(),
            notes: None,
            download_url: None,
            size: None,
            pub_date: None,
        })
    }
}

#[tauri::command]
pub async fn download_and_install_update(app_handle: AppHandle) -> Result<(), String> {
    let updater = app_handle.updater_builder()
        .build()
        .map_err(|e| format!("Failed to build updater: {}", e))?;

    let update = updater.check().await.map_err(|e| format!("Failed to check for updates: {}", e))?;

    if let Some(update) = update {
        let mut downloaded = 0u64;
        let total = 0u64; // We'll use the callback for progress

        update.download_and_install(
            |chunk_length, content_length| {
                downloaded += chunk_length as u64;
                if let Some(total) = content_length {
                    if total > 0 {
                        let progress = downloaded as f32 / total as f32;
                        let _ = app_handle.emit("update_progress", UpdateProgress {
                            status: "downloading".to_string(),
                            progress: Some(progress),
                            message: Some(format!("Downloaded {} / {} bytes", downloaded, total)),
                        });
                    }
                }
            },
            || {
                let _ = app_handle.emit("update_progress", UpdateProgress {
                    status: "installing".to_string(),
                    progress: Some(1.0),
                    message: Some("Installing update...".to_string()),
                });
            },
        )
        .await
        .map_err(|e| format!("Failed to download and install update: {}", e))?;

        let _ = app_handle.emit("update_progress", UpdateProgress {
            status: "complete".to_string(),
            progress: Some(1.0),
            message: Some("Update installed successfully. Restart to apply.".to_string()),
        });

        Ok(())
    } else {
        Err("No update available".to_string())
    }
}

#[tauri::command]
pub fn get_current_version() -> Result<String, String> {
    Ok(CURRENT_VERSION.to_string())
}

#[tauri::command]
pub async fn restart_app(app_handle: AppHandle) -> Result<(), String> {
    app_handle.restart();
}