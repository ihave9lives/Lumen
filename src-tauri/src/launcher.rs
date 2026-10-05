use std::process::Command as SysCommand;
use std::path::Path;
use std::fs;
use std::collections::HashMap;
use open;
use crate::scanner::Game;
use crate::error::LumenError;
use crate::icons::icon_for_path;

#[tauri::command]
pub fn launch_game(
    game_id: String,
    platform: String,
    exec_path: Option<String>,
    steam_id: Option<String>,
) -> Result<String, String> {
    if platform == "steam" {
        if let Some(id) = steam_id {
            let uri = format!("steam://rungameid/{}", id);
            open::that(&uri).map_err(|e| LumenError::LaunchFailed(format!("Failed to launch Steam game: {}", e)).to_string())?;
            return Ok("Launched successfully".to_string());
        }
        return Err(LumenError::LaunchFailed("Missing Steam AppID".to_string()).to_string());
    } else if platform == "epic" || platform == "local" || platform == "custom" {
        if let Some(path) = exec_path {
            if platform == "epic" {
                let app_name = game_id.strip_prefix("epic-").unwrap_or(&game_id);
                let epic_uri = format!(
                    "com.epicgames.launcher://apps/{}?action=launch&silent=true",
                    app_name
                );
                if let Err(_e) = open::that(&epic_uri) {
                    // Fallback to direct path
                    open::that(&path).map_err(|e| LumenError::LaunchFailed(format!("Failed to open Epic game: {}", e)).to_string())?;
                }
                return Ok("Launched Epic game successfully".to_string());
            } else {
                // Local or custom game
                if path.to_lowercase().ends_with(".exe") {
                    let game_id_clone = game_id.clone();
                    let path_clone = path.clone();
                    std::thread::spawn(move || {
                        let start = std::time::Instant::now();
                        let mut cmd = SysCommand::new(&path_clone);
                        if let Some(parent) = Path::new(&path_clone).parent() {
                            cmd.current_dir(parent);
                        }
                        if let Ok(mut child) = cmd.spawn() {
                            let _ = child.wait();
                            let duration = start.elapsed();
                            let hours = duration.as_secs_f32() / 3600.0;
                            update_playtime(&game_id_clone, hours);
                        }
                    });
                    return Ok("Launched local game with tracking".to_string());
                } else {
                    // It's a folder/URL, just open it
                    open::that(&path).map_err(|e| LumenError::LaunchFailed(format!("Failed to open: {}", e)).to_string())?;
                    return Ok("Opened successfully".to_string());
                }
            }
        }
        return Err(LumenError::LaunchFailed("Missing execution path".to_string()).to_string());
    }

    Err(LumenError::LaunchFailed(format!("Unknown platform: {}", platform)).to_string())
}

fn update_playtime(game_id: &str, hours_to_add: f32) {
    if game_id.starts_with("local-") {
        let file = std::env::current_dir().unwrap_or_default().join("local_playtimes.json");
        let mut playtimes: HashMap<String, f32> = HashMap::new();
        if let Ok(content) = fs::read_to_string(&file) {
            if let Ok(parsed) = serde_json::from_str(&content) {
                playtimes = parsed;
            }
        }
        let entry = playtimes.entry(game_id.to_string()).or_insert(0.0);
        *entry += hours_to_add;
        if let Ok(json) = serde_json::to_string_pretty(&playtimes) {
            let _ = fs::write(file, json);
        }
    } else if game_id.starts_with("custom-") {
        let file = std::env::current_dir().unwrap_or_default().join("custom_games.json");
        if let Ok(content) = fs::read_to_string(&file) {
            if let Ok(mut parsed) = serde_json::from_str::<Vec<Game>>(&content) {
                for g in &mut parsed {
                    if g.id == game_id {
                        g.hours_played += hours_to_add;
                        break;
                    }
                }
                if let Ok(json) = serde_json::to_string_pretty(&parsed) {
                    let _ = fs::write(file, json);
                }
            }
        }
    }
}

#[tauri::command]
pub fn add_custom_game(name: String, path: String) -> Result<Game, String> {
    let custom_file = std::env::current_dir()
        .unwrap_or_default()
        .join("custom_games.json");
    let mut custom_games: Vec<Game> = Vec::new();

    if custom_file.exists() {
        if let Ok(content) = fs::read_to_string(&custom_file) {
            if let Ok(parsed) = serde_json::from_str(&content) {
                custom_games = parsed;
            }
        }
    }

    let safe_name = name.replace(' ', "-").to_lowercase();
    let game_id = format!("custom-{}", safe_name);

    // Extract icon from the exe immediately
    let cover = icon_for_path(&path, &game_id).unwrap_or_else(|| {
        "https://images.unsplash.com/photo-1552820728-8b83bb6b773f?q=80&w=600&auto=format&fit=crop"
            .to_string()
    });

    let new_game = Game {
        id: game_id,
        title: name.clone(),
        cover_url: cover,
        hours_played: 0.0,
        hltb_main: 0,
        hltb_completionist: 0,
        platform: "local".to_string(),
        last_played: chrono::Utc::now().to_rfc3339(),
        exec_path: Some(path),
        steam_id: None,
    };

    custom_games.push(new_game.clone());

    if let Ok(json_str) = serde_json::to_string_pretty(&custom_games) {
        let _ = fs::write(custom_file, json_str);
    }

    Ok(new_game)
}

#[tauri::command]
pub fn remove_game(game_id: String) -> Result<(), String> {
    // 1. Remove from custom_games.json if it was a custom game
    let custom_file = std::env::current_dir()
        .unwrap_or_default()
        .join("custom_games.json");
    if custom_file.exists() {
        if let Ok(content) = fs::read_to_string(&custom_file) {
            if let Ok(mut parsed) = serde_json::from_str::<Vec<Game>>(&content) {
                let before = parsed.len();
                parsed.retain(|g| g.id != game_id);
                if parsed.len() < before {
                    let _ = fs::write(
                        custom_file,
                        serde_json::to_string_pretty(&parsed).unwrap_or_default(),
                    );
                    return Ok(());
                }
            }
        }
    }

    // 2. Otherwise hide it from future scans
    let hidden_file = std::env::current_dir()
        .unwrap_or_default()
        .join("hidden_games.json");
    let mut hidden_games: Vec<String> = Vec::new();
    if hidden_file.exists() {
        if let Ok(content) = fs::read_to_string(&hidden_file) {
            if let Ok(parsed) = serde_json::from_str(&content) {
                hidden_games = parsed;
            }
        }
    }

    if !hidden_games.contains(&game_id) {
        hidden_games.push(game_id);
        let _ = fs::write(
            hidden_file,
            serde_json::to_string_pretty(&hidden_games).unwrap_or_default(),
        );
    }

    Ok(())
}

#[tauri::command]
pub fn hide_game(game_id: String) -> Result<(), String> {
    let hidden_file = std::env::current_dir()
        .unwrap_or_default()
        .join("hidden_games.json");
    let mut hidden_games: Vec<String> = Vec::new();
    if hidden_file.exists() {
        if let Ok(content) = fs::read_to_string(&hidden_file) {
            if let Ok(parsed) = serde_json::from_str(&content) {
                hidden_games = parsed;
            }
        }
    }

    if !hidden_games.contains(&game_id) {
        hidden_games.push(game_id);
        let _ = fs::write(
            hidden_file,
            serde_json::to_string_pretty(&hidden_games).unwrap_or_default(),
        );
    }

    Ok(())
}

#[tauri::command]
pub fn unhide_game(game_id: String) -> Result<(), String> {
    let hidden_file = std::env::current_dir()
        .unwrap_or_default()
        .join("hidden_games.json");
    if hidden_file.exists() {
        if let Ok(content) = fs::read_to_string(&hidden_file) {
            if let Ok(mut parsed) = serde_json::from_str::<Vec<String>>(&content) {
                parsed.retain(|g| g != &game_id);
                let _ = fs::write(
                    hidden_file,
                    serde_json::to_string_pretty(&parsed).unwrap_or_default(),
                );
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub fn get_hidden_games() -> Result<Vec<String>, String> {
    let hidden_file = std::env::current_dir()
        .unwrap_or_default()
        .join("hidden_games.json");
    let mut hidden_games: Vec<String> = Vec::new();
    if hidden_file.exists() {
        if let Ok(content) = fs::read_to_string(&hidden_file) {
            if let Ok(parsed) = serde_json::from_str(&content) {
                hidden_games = parsed;
            }
        }
    }
    Ok(hidden_games)
}
