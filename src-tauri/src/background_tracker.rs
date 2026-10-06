use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use std::collections::HashMap;
use std::thread;
use std::fs;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Emitter};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GameSession {
    pub game_id: String,
    pub start_time: u64, // Unix timestamp
    pub end_time: Option<u64>,
    pub duration_seconds: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct PlaytimeDatabase {
    pub sessions: Vec<GameSession>,
    pub total_playtime: HashMap<String, u64>, // game_id -> total seconds
}

static TRACKER_RUNNING: Mutex<bool> = Mutex::new(false);
static TRACKER_HANDLE: Mutex<Option<thread::JoinHandle<()>>> = Mutex::new(None);

fn get_playtime_db_path() -> std::path::PathBuf {
    let mut path = dirs::data_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
    path.push("lumen");
    path.push("playtime.json");
    path
}

fn load_playtime_db() -> PlaytimeDatabase {
    let path = get_playtime_db_path();
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(db) = serde_json::from_str::<PlaytimeDatabase>(&content) {
                return db;
            }
        }
    }
    PlaytimeDatabase::default()
}

fn save_playtime_db(db: &PlaytimeDatabase) {
    let path = get_playtime_db_path();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Ok(content) = serde_json::to_string_pretty(db) {
        let _ = fs::write(path, content);
    }
}

fn is_process_running(exe_path: &str) -> bool {
    #[cfg(target_os = "windows")]
    {
        let exe_name = std::path::Path::new(exe_path)
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("");
        
        if exe_name.is_empty() {
            return false;
        }
        
        let output = std::process::Command::new("tasklist")
            .args(["/FI", &format!("IMAGENAME eq {}", exe_name), "/NH"])
            .output();
        
        if let Ok(out) = output {
            let stdout = String::from_utf8_lossy(&out.stdout);
            return stdout.contains(exe_name);
        }
        false
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        use std::process::Command;
        let exe_name = std::path::Path::new(exe_path)
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("");
        
        if exe_name.is_empty() {
            return false;
        }
        
        let output = Command::new("pgrep")
            .args(["-f", exe_name])
            .output();
        
        if let Ok(out) = output {
            return !out.stdout.is_empty();
        }
        false
    }
}

fn start_background_tracker(app_handle: AppHandle) {
    let mut running = TRACKER_RUNNING.lock().unwrap();
    if *running {
        return;
    }
    *running = true;
    drop(running);

    let handle = thread::spawn(move || {
        let mut active_sessions: HashMap<String, (String, Instant)> = HashMap::new(); // game_id -> (exe_path, start_instant)
        
        loop {
            let should_continue = {
                let running_check = TRACKER_RUNNING.lock().unwrap();
                *running_check
            };
            
            if !should_continue {
                break;
            }
            
            // Load current games from settings to track
            let games_to_track = {
                let settings = crate::settings::AppSettings::load().unwrap_or_default();
                settings.library.local_paths.iter().flat_map(|path| {
                    std::fs::read_dir(path).ok().into_iter().flat_map(|entries| {
                        entries.flatten().filter_map(|entry| {
                            if let Ok(ft) = entry.file_type() {
                                if ft.is_dir() {
                                    let dir_path = entry.path();
                                    crate::icons::find_main_exe(&dir_path).map(|exe| {
                                        let game_id = format!("local-{}", entry.file_name().to_string_lossy());
                                        (game_id, exe.to_string_lossy().to_string())
                                    })
                                } else {
                                    None
                                }
                            } else {
                                None
                            }
                        })
                    })
                }).collect::<Vec<_>>()
            };
            
            // Check each game
            for (game_id, exe_path) in games_to_track {
                let is_running = is_process_running(&exe_path);
                let now = Instant::now();
                
                if is_running {
                    // Start or continue session
                    if !active_sessions.contains_key(&game_id) {
                        active_sessions.insert(game_id.clone(), (exe_path, now));
                    }
                } else {
                    // Game stopped - end session
                    if let Some((_, start_instant)) = active_sessions.remove(&game_id) {
                        let duration = now.duration_since(start_instant).as_secs();
                        if duration > 10 { // Only record if played for more than 10 seconds
                            let mut db = load_playtime_db();
                            let start_timestamp = chrono::Utc::now().timestamp() - duration as i64;
                            
                            let session = GameSession {
                                game_id: game_id.clone(),
                                start_time: start_timestamp as u64,
                                end_time: Some(chrono::Utc::now().timestamp() as u64),
                                duration_seconds: Some(duration),
                            };
                            
                            db.sessions.push(session);
                            *db.total_playtime.entry(game_id.clone()).or_insert(0) += duration;
                            save_playtime_db(&db);
                            
                            // Emit event to update UI
                            let _ = app_handle.emit("playtime_updated", serde_json::json!({
                                "game_id": game_id,
                                "duration_seconds": duration,
                                "total_seconds": db.total_playtime.get(&game_id).copied().unwrap_or(0)
                            }));
                        }
                    }
                }
            }
            
            thread::sleep(Duration::from_secs(5));
        }
    });
    
    *TRACKER_HANDLE.lock().unwrap() = Some(handle);
}

#[tauri::command]
pub fn start_background_tracker_cmd(app_handle: AppHandle) -> Result<(), String> {
    start_background_tracker(app_handle);
    // Save setting
    let mut settings = crate::settings::AppSettings::load()?;
    settings.behavior.enable_background_tracker = true;
    settings.save()?;
    Ok(())
}

#[tauri::command]
pub fn stop_background_tracker_cmd() -> Result<(), String> {
    let mut running = TRACKER_RUNNING.lock().unwrap();
    *running = false;
    drop(running);
    
    if let Some(handle) = TRACKER_HANDLE.lock().unwrap().take() {
        let _ = handle.join();
    }
    
    // Save setting
    let mut settings = crate::settings::AppSettings::load()?;
    settings.behavior.enable_background_tracker = false;
    settings.save()?;
    Ok(())
}

#[tauri::command]
pub fn is_background_tracker_running() -> Result<bool, String> {
    let running = TRACKER_RUNNING.lock().unwrap();
    Ok(*running)
}

#[tauri::command]
pub fn get_playtime_stats(game_id: String) -> Result<serde_json::Value, String> {
    let db = load_playtime_db();
    let total = db.total_playtime.get(&game_id).copied().unwrap_or(0);
    let sessions: Vec<_> = db.sessions.iter()
        .filter(|s| s.game_id == game_id)
        .cloned()
        .collect();
    
    Ok(serde_json::json!({
        "total_seconds": total,
        "total_hours": total as f32 / 3600.0,
        "sessions": sessions,
        "session_count": sessions.len()
    }))
}

#[tauri::command]
pub fn get_all_playtime_stats() -> Result<serde_json::Value, String> {
    let db = load_playtime_db();
    let mut games: Vec<serde_json::Value> = db.total_playtime.iter()
        .map(|(game_id, &total)| serde_json::json!({
            "game_id": game_id,
            "total_seconds": total,
            "total_hours": total as f32 / 3600.0,
        }))
        .collect();
    
    games.sort_by(|a, b| {
        let a_total = a["total_seconds"].as_u64().unwrap_or(0);
        let b_total = b["total_seconds"].as_u64().unwrap_or(0);
        b_total.cmp(&a_total)
    });
    
    Ok(serde_json::json!({ "games": games }))
}

pub fn init_background_tracker(app_handle: &AppHandle) {
    let settings = crate::settings::AppSettings::load().unwrap_or_default();
    if settings.behavior.enable_background_tracker {
        start_background_tracker(app_handle.clone());
    }
}