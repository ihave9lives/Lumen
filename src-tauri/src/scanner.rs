use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use chrono;
use rusqlite::Connection;
use dirs;

use crate::icons::{icon_for_path, find_main_exe};
use crate::platform::{detect_steam_paths, detect_epic_paths, detect_local_game_paths};
use crate::config::AppSettings;
use crate::error::LumenError;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Game {
    pub id: String,
    pub title: String,
    #[serde(rename = "coverUrl")]
    pub cover_url: String,
    #[serde(rename = "hoursPlayed")]
    pub hours_played: f32,
    #[serde(rename = "hltbMain")]
    pub hltb_main: u32,
    #[serde(rename = "hltbCompletionist")]
    pub hltb_completionist: u32,
    pub platform: String,
    #[serde(rename = "lastPlayed")]
    pub last_played: String,
    #[serde(rename = "execPath", skip_serializing_if = "Option::is_none")]
    pub exec_path: Option<String>,
    #[serde(rename = "steamId", skip_serializing_if = "Option::is_none")]
    pub steam_id: Option<String>,
}

fn parse_acf_title_and_id(content: &str) -> Option<(String, String)> {
    let mut title = String::new();
    let mut appid = String::new();

    for line in content.lines() {
        let line = line.trim();
        if line.starts_with("\"appid\"") {
            let parts: Vec<&str> = line.split('"').collect();
            if parts.len() >= 4 {
                appid = parts[3].to_string();
            }
        }
        if line.starts_with("\"name\"") {
            let parts: Vec<&str> = line.split('"').collect();
            if parts.len() >= 4 {
                title = parts[3].to_string();
            }
        }
    }

    if !title.is_empty() && !appid.is_empty() {
        Some((title, appid))
    } else {
        None
    }
}

fn get_steam_playtimes() -> HashMap<String, f32> {
    let mut playtimes = HashMap::new();
    
    #[cfg(target_os = "windows")]
    {
        let userdata_dir = PathBuf::from(r"C:\Program Files (x86)\Steam\userdata");
        if !userdata_dir.exists() {
            return playtimes;
        }

        if let Ok(entries) = fs::read_dir(userdata_dir) {
            for entry in entries.flatten() {
                let localconfig = entry.path().join("config").join("localconfig.vdf");
                if localconfig.exists() {
                    if let Ok(content) = fs::read_to_string(&localconfig) {
                        let mut current_app = String::new();
                        for line in content.lines() {
                            let trimmed = line.trim();
                            if trimmed.starts_with('"') && trimmed.ends_with('"') && trimmed.len() > 2 {
                                let possible_app = &trimmed[1..trimmed.len() - 1];
                                if possible_app.chars().all(|c| c.is_ascii_digit()) {
                                    current_app = possible_app.to_string();
                                }
                            }
                            
                            if trimmed.to_lowercase().starts_with("\"playtime") {
                                let parts: Vec<&str> = trimmed.split('"').collect();
                                if parts.len() >= 4 {
                                    if let Ok(minutes) = parts[3].parse::<f32>() {
                                        if !current_app.is_empty() {
                                            let hours = minutes / 60.0;
                                            let existing = playtimes.entry(current_app.clone()).or_insert(hours);
                                            if hours > *existing {
                                                *existing = hours;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    #[cfg(target_os = "linux")]
    {
        if let Some(home) = dirs::home_dir() {
            let userdata_dir = home.join(".local/share/Steam/userdata");
            if userdata_dir.exists() {
                if let Ok(entries) = fs::read_dir(userdata_dir) {
                    for entry in entries.flatten() {
                        let localconfig = entry.path().join("config").join("localconfig.vdf");
                        if localconfig.exists() {
                            if let Ok(content) = fs::read_to_string(&localconfig) {
                                let mut current_app = String::new();
                                for line in content.lines() {
                                    let trimmed = line.trim();
                                    if trimmed.starts_with('"') && trimmed.ends_with('"') && trimmed.len() > 2 {
                                        let possible_app = &trimmed[1..trimmed.len() - 1];
                                        if possible_app.chars().all(|c| c.is_ascii_digit()) {
                                            current_app = possible_app.to_string();
                                        }
                                    }
                                    
                                    if trimmed.to_lowercase().starts_with("\"playtime") {
                                        let parts: Vec<&str> = trimmed.split('"').collect();
                                        if parts.len() >= 4 {
                                            if let Ok(minutes) = parts[3].parse::<f32>() {
                                                if !current_app.is_empty() {
                                                    let hours = minutes / 60.0;
                                                    let existing = playtimes.entry(current_app.clone()).or_insert(hours);
                                                    if hours > *existing {
                                                        *existing = hours;
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    #[cfg(target_os = "macos")]
    {
        if let Some(home) = dirs::home_dir() {
            let userdata_dir = home.join("Library/Application Support/Steam/userdata");
            if userdata_dir.exists() {
                if let Ok(entries) = fs::read_dir(userdata_dir) {
                    for entry in entries.flatten() {
                        let localconfig = entry.path().join("config").join("localconfig.vdf");
                        if localconfig.exists() {
                            if let Ok(content) = fs::read_to_string(&localconfig) {
                                let mut current_app = String::new();
                                for line in content.lines() {
                                    let trimmed = line.trim();
                                    if trimmed.starts_with('"') && trimmed.ends_with('"') && trimmed.len() > 2 {
                                        let possible_app = &trimmed[1..trimmed.len() - 1];
                                        if possible_app.chars().all(|c| c.is_ascii_digit()) {
                                            current_app = possible_app.to_string();
                                        }
                                    }
                                    
                                    if trimmed.to_lowercase().starts_with("\"playtime") {
                                        let parts: Vec<&str> = trimmed.split('"').collect();
                                        if parts.len() >= 4 {
                                            if let Ok(minutes) = parts[3].parse::<f32>() {
                                                if !current_app.is_empty() {
                                                    let hours = minutes / 60.0;
                                                    let existing = playtimes.entry(current_app.clone()).or_insert(hours);
                                                    if hours > *existing {
                                                        *existing = hours;
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    playtimes
}

fn get_epic_playtimes() -> HashMap<String, f32> {
    let mut playtimes = HashMap::new();
    
    // Try legendary SQLite first (common open-source epic launcher)
    if let Some(home) = dirs::home_dir() {
        let legendary_db = home.join(".config").join("legendary").join("legendary.db");
        
        if legendary_db.exists() {
            if let Ok(conn) = Connection::open(&legendary_db) {
                if let Ok(mut stmt) = conn.prepare("SELECT app_name, playtime FROM games") {
                    if let Ok(mut rows) = stmt.query([]) {
                        while let Ok(Some(row)) = rows.next() {
                            if let (Ok(app), Ok(seconds)) = (row.get::<_, String>(0), row.get::<_, i64>(1)) {
                                playtimes.insert(app, seconds as f32 / 3600.0);
                            }
                        }
                    }
                }
            }
        }
    }
    
    #[cfg(target_os = "windows")]
    {
        // As a fallback, check Epic's official Tracking DB
        let epic_db = PathBuf::from(r"C:\ProgramData\Epic\EpicGamesLauncher\Data\Tracking.db");
        if epic_db.exists() && playtimes.is_empty() {
            if let Ok(conn) = Connection::open(&epic_db) {
                if let Ok(mut stmt) = conn.prepare("SELECT AppName, PlayTime FROM PlaySessions") {
                    if let Ok(mut rows) = stmt.query([]) {
                        while let Ok(Some(row)) = rows.next() {
                            if let (Ok(app), Ok(seconds)) = (row.get::<_, String>(0), row.get::<_, i64>(1)) {
                                playtimes.insert(app, seconds as f32 / 3600.0);
                            }
                        }
                    }
                }
            }
        }
    }

    playtimes
}

fn load_local_playtimes() -> HashMap<String, f32> {
    let mut playtimes = HashMap::new();
    let local_playtimes_file = std::env::current_dir()
        .unwrap_or_default()
        .join("local_playtimes.json");
    if local_playtimes_file.exists() {
        if let Ok(content) = fs::read_to_string(&local_playtimes_file) {
            if let Ok(parsed) = serde_json::from_str(&content) {
                playtimes = parsed;
            }
        }
    }
    playtimes
}

fn load_hidden_games() -> Vec<String> {
    let mut hidden_games = Vec::new();
    let hidden_file = std::env::current_dir()
        .unwrap_or_default()
        .join("hidden_games.json");
    if hidden_file.exists() {
        if let Ok(content) = fs::read_to_string(&hidden_file) {
            if let Ok(parsed) = serde_json::from_str(&content) {
                hidden_games = parsed;
            }
        }
    }
    hidden_games
}

fn load_custom_games() -> Vec<Game> {
    let mut custom_games = Vec::new();
    let custom_file = std::env::current_dir()
        .unwrap_or_default()
        .join("custom_games.json");
    if custom_file.exists() {
        if let Ok(content) = fs::read_to_string(&custom_file) {
            if let Ok(parsed) = serde_json::from_str::<Vec<Game>>(&content) {
                for mut cg in parsed {
                    // If cover is still the generic placeholder, try to extract icon
                    if cg.cover_url.contains("unsplash.com") || cg.cover_url.is_empty() {
                        if let Some(ref ep) = cg.exec_path {
                            if let Some(icon) = icon_for_path(ep, &cg.id) {
                                cg.cover_url = icon;
                            }
                        }
                    }
                    custom_games.push(cg);
                }
            }
        }
    }
    custom_games
}

pub fn scan_steam_games(settings: &AppSettings, steam_playtimes: &HashMap<String, f32>) -> Vec<Game> {
    let mut games = Vec::new();
    
    let steam_paths = if settings.library.steam_paths.is_empty() {
        detect_steam_paths()
    } else {
        settings.library.steam_paths.iter().map(PathBuf::from).collect()
    };

    for steam_path in &steam_paths {
        if !steam_path.exists() {
            continue;
        }
        if let Ok(entries) = fs::read_dir(steam_path) {
            for entry in entries.flatten() {
                let file_name = entry.file_name().into_string().unwrap_or_default();
                if file_name.starts_with("appmanifest_") && file_name.ends_with(".acf") {
                    if let Ok(content) = fs::read_to_string(entry.path()) {
                        if let Some((title, appid)) = parse_acf_title_and_id(&content) {
                            if title == "Steamworks Common Redistributables"
                                || title.starts_with("Proton")
                                || title.starts_with("Steam Linux Runtime")
                            {
                                continue;
                            }
                            let hours = *steam_playtimes.get(&appid).unwrap_or(&0.0);
                            games.push(Game {
                                id: format!("steam-{}", appid),
                                title: title.clone(),
                                cover_url: format!(
                                    "https://cdn.akamai.steamstatic.com/steam/apps/{}/library_600x900_2x.jpg",
                                    appid
                                ),
                                hours_played: hours,
                                hltb_main: 0,
                                hltb_completionist: 0,
                                platform: "steam".to_string(),
                                last_played: chrono::Utc::now().to_rfc3339(),
                                exec_path: None,
                                steam_id: Some(appid),
                            });
                        }
                    }
                }
            }
        }
    }
    
    games
}

pub fn scan_epic_games(settings: &AppSettings, epic_playtimes: &HashMap<String, f32>) -> Vec<Game> {
    let mut games = Vec::new();
    
    let epic_paths = if settings.library.epic_paths.is_empty() {
        detect_epic_paths()
    } else {
        settings.library.epic_paths.iter().map(PathBuf::from).collect()
    };

    for epic_path in &epic_paths {
        if !epic_path.exists() {
            continue;
        }
        if let Ok(entries) = fs::read_dir(epic_path) {
            for entry in entries.flatten() {
                let file_name = entry.file_name().into_string().unwrap_or_default();
                if file_name.ends_with(".item") {
                    if let Ok(content) = fs::read_to_string(entry.path()) {
                        if let Ok(json) = serde_json::from_str::<Value>(&content) {
                            if let (Some(title), Some(install_loc), Some(app_name)) = (
                                json["DisplayName"].as_str(),
                                json["InstallLocation"].as_str(),
                                json["AppName"].as_str(),
                            ) {
                                if title.starts_with("Unreal Engine")
                                    || title.contains("Prerequisites")
                                {
                                    continue;
                                }

                                let game_id = format!("epic-{}", app_name);

                                // Try to extract icon from the install folder
                                let cover = icon_for_path(install_loc, &game_id)
                                    .unwrap_or_else(|| {
                                        "https://images.unsplash.com/photo-1614294149010-950b698f72c0?q=80&w=600&auto=format&fit=crop".to_string()
                                    });

                                let hours = *epic_playtimes.get(&app_name.to_string()).unwrap_or(&0.0);

                                games.push(Game {
                                    id: game_id,
                                    title: title.to_string(),
                                    cover_url: cover,
                                    hours_played: hours,
                                    hltb_main: 0,
                                    hltb_completionist: 0,
                                    platform: "epic".to_string(),
                                    last_played: chrono::Utc::now().to_rfc3339(),
                                    exec_path: Some(install_loc.to_string()),
                                    steam_id: None,
                                });
                            }
                        }
                    }
                }
            }
        }
    }
    
    games
}

pub fn scan_local_games(settings: &AppSettings, local_playtimes: &HashMap<String, f32>) -> Vec<Game> {
    let mut games = Vec::new();
    
    let local_paths = if settings.library.local_paths.is_empty() {
        detect_local_game_paths()
    } else {
        settings.library.local_paths.iter().map(PathBuf::from).collect()
    };

    for path_str in local_paths {
        let path = PathBuf::from(path_str);
        if !path.exists() {
            continue;
        }
        if let Ok(entries) = fs::read_dir(&path) {
            for entry in entries.flatten() {
                if let Ok(ft) = entry.file_type() {
                    if !ft.is_dir() {
                        continue;
                    }
                }
                if let Ok(name) = entry.file_name().into_string() {
                    // Find the main .exe in this subdirectory
                    let dir_path = entry.path();
                    let main_exe = find_main_exe(&dir_path);

                    if main_exe.is_none() {
                        continue; // no exe → not a game folder
                    }
                    
                    let exe_path = main_exe.unwrap();

                    let game_id = format!("local-{}", name);
                    let hours = *local_playtimes.get(&game_id).unwrap_or(&0.0);

                    // Extract icon from the discovered exe
                    let cover = icon_for_path(
                        &dir_path.to_string_lossy(),
                        &game_id,
                    )
                    .unwrap_or_else(|| {
                        "https://images.unsplash.com/photo-1552820728-8b83bb6b773f?q=80&w=600&auto=format&fit=crop".to_string()
                    });

                    games.push(Game {
                        id: game_id,
                        title: name.clone(),
                        cover_url: cover,
                        hours_played: hours,
                        hltb_main: 0,
                        hltb_completionist: 0,
                        platform: "local".to_string(),
                        last_played: chrono::Utc::now().to_rfc3339(),
                        exec_path: Some(exe_path.to_string_lossy().to_string()),
                        steam_id: None,
                    });
                }
            }
        }
    }
    
    games
}

#[tauri::command]
pub fn scan_all_games() -> Result<Vec<Game>, String> {
    let settings = AppSettings::load().map_err(|e| e.to_string())?;
    
    // Fetch playtimes
    let steam_playtimes = get_steam_playtimes();
    let epic_playtimes = get_epic_playtimes();
    let local_playtimes = load_local_playtimes();
    let hidden_games = load_hidden_games();
    let custom_games = load_custom_games();

    let mut games = Vec::new();
    
    // Scan Steam games
    games.extend(scan_steam_games(&settings, &steam_playtimes));
    
    // Scan Epic games
    games.extend(scan_epic_games(&settings, &epic_playtimes));
    
    // Scan local games
    games.extend(scan_local_games(&settings, &local_playtimes));
    
    // Add custom games
    games.extend(custom_games);
    
    // Filter out hidden games
    games.retain(|g| !hidden_games.contains(&g.id));
    
    Ok(games)
}
