use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command as SysCommand;
use std::collections::HashMap;
use sysinfo::{System, CpuRefreshKind, RefreshKind, MemoryRefreshKind};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager, Emitter};
use rusqlite::Connection;
use wmi::{COMLibrary, WMIConnection};


#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Game {
    id: String,
    title: String,
    #[serde(rename = "coverUrl")]
    cover_url: String,
    #[serde(rename = "hoursPlayed")]
    hours_played: f32,
    #[serde(rename = "hltbMain")]
    hltb_main: u32,
    #[serde(rename = "hltbCompletionist")]
    hltb_completionist: u32,
    platform: String,
    #[serde(rename = "lastPlayed")]
    last_played: String,
    // Native properties
    #[serde(rename = "execPath", skip_serializing_if = "Option::is_none")]
    exec_path: Option<String>,
    #[serde(rename = "steamId", skip_serializing_if = "Option::is_none")]
    steam_id: Option<String>,
}

// ─── Icon Extraction ───────────────────────────────────────────────────────────

/// Returns the icon cache directory, creating it if needed.
/// Uses the system temp dir to avoid triggering Tauri's file watcher.
fn icon_cache_dir() -> PathBuf {
    let dir = std::env::temp_dir().join("lumen_icon_cache");
    let _ = fs::create_dir_all(&dir);
    dir
}

/// Find the "main" executable inside a directory — picks the largest .exe.
fn find_main_exe(dir: &Path) -> Option<PathBuf> {
    let mut exes: Vec<PathBuf> = Vec::new();
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.extension().map_or(false, |e| e == "exe") {
                exes.push(p);
            }
        }
    }
    // Sort by file size descending — the main game exe is usually the largest
    exes.sort_by(|a, b| {
        let sa = fs::metadata(a).map(|m| m.len()).unwrap_or(0);
        let sb = fs::metadata(b).map(|m| m.len()).unwrap_or(0);
        sb.cmp(&sa)
    });
    exes.into_iter().next()
}

/// Extract a hi-res (256×256 jumbo) icon from an .exe file via a PowerShell
/// helper script that uses the Windows Shell image list API.  Results are
/// cached to disk as `.txt` files so subsequent scans are instant.
fn extract_exe_icon(exe_path: &str, cache_key: &str) -> Option<String> {
    let safe_key = cache_key
        .replace(|c: char| !c.is_alphanumeric() && c != '-', "_");
    let cache_file = icon_cache_dir().join(format!("{}.txt", safe_key));

    // ── fast-path: return cached data-URL ──
    if cache_file.exists() {
        if let Ok(data) = fs::read_to_string(&cache_file) {
            let data = data.trim().to_string();
            if data.starts_with("data:image") {
                return Some(data);
            }
        }
    }

    // ── ensure the PowerShell helper script exists ──
    let script_path = icon_cache_dir().join("extract_icon.ps1");
    if !script_path.exists() {
        write_icon_script(&script_path);
    }

    // ── run the script ──
    let output = SysCommand::new("powershell")
        .arg("-NoProfile")
        .arg("-NoLogo")
        .arg("-NonInteractive")
        .arg("-ExecutionPolicy")
        .arg("Bypass")
        .arg("-File")
        .arg(&script_path)
        .arg(exe_path)
        .output()
        .ok()?;

    let b64 = String::from_utf8(output.stdout)
        .ok()?
        .trim()
        .to_string();

    if b64.is_empty() || b64.len() < 20 {
        return None;
    }

    let data_url = format!("data:image/png;base64,{}", b64);

    // cache to disk
    let _ = fs::write(&cache_file, &data_url);

    Some(data_url)
}

/// Write the PowerShell icon-extraction helper to disk.
fn write_icon_script(path: &Path) {
    let script = [
        "param([string]$ExePath)",
        "Add-Type -AssemblyName System.Drawing",
        "",
        "# Build inline C# type for jumbo (256x256) icon extraction",
        "$cs = @'",
        "using System;",
        "using System.Drawing;",
        "using System.Runtime.InteropServices;",
        "",
        "public class JumboIconExtractor {",
        "    [DllImport(\"shell32.dll\", EntryPoint = \"#727\")]",
        "    private static extern int SHGetImageList(int iImageList, ref Guid riid, ref IntPtr ppv);",
        "",
        "    [DllImport(\"shell32.dll\", CharSet = CharSet.Auto)]",
        "    private static extern IntPtr SHGetFileInfo(string pszPath, uint dwFileAttributes, ref SHFILEINFO psfi, uint cbSizeFileInfo, uint uFlags);",
        "",
        "    [DllImport(\"comctl32.dll\", SetLastError = true)]",
        "    private static extern IntPtr ImageList_GetIcon(IntPtr himl, int i, int flags);",
        "",
        "    [DllImport(\"user32.dll\")]",
        "    public static extern bool DestroyIcon(IntPtr hIcon);",
        "",
        "    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]",
        "    private struct SHFILEINFO {",
        "        public IntPtr hIcon;",
        "        public int iIcon;",
        "        public uint dwAttributes;",
        "        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)]",
        "        public string szDisplayName;",
        "        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 80)]",
        "        public string szTypeName;",
        "    }",
        "",
        "    public static Bitmap GetIcon(string filePath) {",
        "        SHFILEINFO shfi = new SHFILEINFO();",
        "        SHGetFileInfo(filePath, 0, ref shfi, (uint)Marshal.SizeOf(typeof(SHFILEINFO)), 0x4000);",
        "",
        "        Guid iid = new Guid(\"46EB5926-582E-4017-9FDF-E8998DAA0950\");",
        "        IntPtr hImgList = IntPtr.Zero;",
        "        SHGetImageList(4, ref iid, ref hImgList);",
        "",
        "        if (hImgList != IntPtr.Zero) {",
        "            IntPtr hIcon = ImageList_GetIcon(hImgList, shfi.iIcon, 0);",
        "            if (hIcon != IntPtr.Zero) {",
        "                Icon ico = (Icon)Icon.FromHandle(hIcon).Clone();",
        "                DestroyIcon(hIcon);",
        "                return ico.ToBitmap();",
        "            }",
        "        }",
        "",
        "        Icon fb = Icon.ExtractAssociatedIcon(filePath);",
        "        if (fb != null) return fb.ToBitmap();",
        "        return null;",
        "    }",
        "}",
        "'@",
        "",
        "Add-Type -TypeDefinition $cs -ReferencedAssemblies System.Drawing",
        "",
        "try {",
        "    $bmp = [JumboIconExtractor]::GetIcon($ExePath)",
        "    if ($bmp) {",
        "        $ms = New-Object System.IO.MemoryStream",
        "        $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)",
        "        [Convert]::ToBase64String($ms.ToArray())",
        "        $ms.Dispose()",
        "        $bmp.Dispose()",
        "    }",
        "} catch {",
        "    try {",
        "        $i = [System.Drawing.Icon]::ExtractAssociatedIcon($ExePath)",
        "        if ($i) {",
        "            $b = $i.ToBitmap()",
        "            $ms = New-Object System.IO.MemoryStream",
        "            $b.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)",
        "            [Convert]::ToBase64String($ms.ToArray())",
        "            $ms.Dispose()",
        "            $b.Dispose()",
        "            $i.Dispose()",
        "        }",
        "    } catch {}",
        "}",
    ].join("\n");
    let _ = fs::write(path, script);
}

/// Convenience: given a game directory OR direct exe path, extract its icon.
fn icon_for_path(path: &str, cache_key: &str) -> Option<String> {
    let p = Path::new(path);
    if p.is_file() && p.extension().map_or(false, |e| e == "exe") {
        // Path is already an .exe
        return extract_exe_icon(path, cache_key);
    }
    if p.is_dir() {
        // Find the main exe in the directory
        if let Some(exe) = find_main_exe(p) {
            return extract_exe_icon(&exe.to_string_lossy(), cache_key);
        }
    }
    None
}

// ─── ACF Parser ────────────────────────────────────────────────────────────────

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

// ─── Playtime Parsing ──────────────────────────────────────────────────────────

fn get_steam_playtimes() -> HashMap<String, f32> {
    let mut playtimes = HashMap::new();
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
                        // Look for lines like "12345"
                        if trimmed.starts_with('"') && trimmed.ends_with('"') && trimmed.len() > 2 {
                            let possible_app = &trimmed[1..trimmed.len() - 1];
                            if possible_app.chars().all(|c| c.is_ascii_digit()) {
                                current_app = possible_app.to_string();
                            }
                        }
                        
                        // Look for "Playtime2" "123"
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
    playtimes
}

fn get_epic_playtimes() -> HashMap<String, f32> {
    let mut playtimes = HashMap::new();
    
    // Try legendary SQLite first (common open-source epic launcher)
    let legendary_db = dirs::home_dir()
        .unwrap_or_default()
        .join(".config")
        .join("legendary")
        .join("legendary.db");
        
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
    
    // As a fallback/placeholder, check Epic's official Tracking DB (though encrypted/complex)
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

    playtimes
}

// ─── Scan Command ──────────────────────────────────────────────────────────────

#[tauri::command]
fn scan_local_games() -> Result<Vec<Game>, String> {
    let mut games = Vec::new();
    
    // Fetch playtimes
    let steam_playtimes = get_steam_playtimes();
    let epic_playtimes = get_epic_playtimes();

    // Fetch local playtimes
    let local_playtimes_file = std::env::current_dir()
        .unwrap_or_default()
        .join("local_playtimes.json");
    let mut local_playtimes: HashMap<String, f32> = HashMap::new();
    if local_playtimes_file.exists() {
        if let Ok(content) = fs::read_to_string(&local_playtimes_file) {
            if let Ok(parsed) = serde_json::from_str(&content) {
                local_playtimes = parsed;
            }
        }
    }

    // 0. Load hidden games list
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

    // ───────────────────────────────────────────
    // 1. Steam – dynamic from libraryfolders.vdf
    // ───────────────────────────────────────────
    let mut steam_paths = vec![PathBuf::from(r"C:\Program Files (x86)\Steam\steamapps")];
    let vdf_path = Path::new(r"C:\Program Files (x86)\Steam\steamapps\libraryfolders.vdf");
    if let Ok(content) = fs::read_to_string(vdf_path) {
        for line in content.lines() {
            let line = line.trim();
            if line.starts_with("\"path\"") {
                let parts: Vec<&str> = line.split('"').collect();
                if parts.len() >= 4 {
                    let unescaped = parts[3].replace("\\\\", "\\");
                    let mut p = PathBuf::from(unescaped);
                    p.push("steamapps");
                    if !steam_paths.contains(&p) {
                        steam_paths.push(p);
                    }
                }
            }
        }
    }

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

    // ───────────────────────────────────────────
    // 2. Epic Games – manifest .item files
    // ───────────────────────────────────────────
    let epic_path = Path::new(r"C:\ProgramData\Epic\EpicGamesLauncher\Data\Manifests");
    if epic_path.exists() {
        if let Ok(entries) = fs::read_dir(epic_path) {
            for entry in entries.flatten() {
                let file_name = entry.file_name().into_string().unwrap_or_default();
                if file_name.ends_with(".item") {
                    if let Ok(content) = fs::read_to_string(entry.path()) {
                        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
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

    // ───────────────────────────────────────────
    // 3. Local directories (D:\GG etc.)
    // ───────────────────────────────────────────
    let local_paths = vec![r"C:\Games", r"D:\Games", r"D:\GG"];
    for path_str in local_paths {
        let path = Path::new(path_str);
        if !path.exists() {
            continue;
        }
        if let Ok(entries) = fs::read_dir(path) {
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

    // ───────────────────────────────────────────
    // 4. Custom (user-added) games
    // ───────────────────────────────────────────
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
                    games.push(cg);
                }
            }
        }
    }

    // Filter out hidden
    games.retain(|g| !hidden_games.contains(&g.id));

    Ok(games)
}

// ─── Add / Remove customs ──────────────────────────────────────────────────────

#[tauri::command]
fn add_custom_game(name: String, path: String) -> Result<Game, String> {
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
fn remove_game(game_id: String) -> Result<(), String> {
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

// ─── Launch ────────────────────────────────────────────────────────────────────

#[tauri::command]
fn launch_game(
    game_id: String,
    platform: String,
    exec_path: Option<String>,
    steam_id: Option<String>,
) -> Result<String, String> {
    if platform == "steam" {
        if let Some(id) = steam_id {
            let uri = format!("steam://rungameid/{}", id);
            if let Err(e) = open::that(&uri) {
                return Err(format!("Failed to launch Steam game: {}", e));
            }
            return Ok("Launched successfully".to_string());
        }
    } else if platform == "epic" || platform == "local" {
        if let Some(path) = exec_path {
            if platform == "epic" {
                let epic_uri = format!(
                    "com.epicgames.launcher://apps/{}?action=launch&silent=true",
                    game_id.strip_prefix("epic-").unwrap_or(&game_id)
                );
                if let Err(_e) = open::that(&epic_uri) {
                    let _ = open::that(&path);
                }
                return Ok("Launched Epic game successfully".to_string());
            } else {
                if path.to_lowercase().ends_with(".exe") {
                    let game_id_clone = game_id.clone();
                    let path_clone = path.clone();
                    std::thread::spawn(move || {
                        let start = std::time::Instant::now();
                        let mut cmd = SysCommand::new(&path_clone);
                        if let Some(parent) = std::path::Path::new(&path_clone).parent() {
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
                    if let Err(e) = open::that(&path) {
                        return Err(format!("Failed to open local game folder: {}", e));
                    }
                    return Ok("Opened folder successfully".to_string());
                }
            }
        }
    }

    Err("Unknown platform or missing execution parameters".to_string())
}

// ─── Performance Monitoring ──────────────────────────────────────────────────

#[derive(Clone, Serialize)]
struct PerformanceMetrics {
    cpu_usage: f32,
    ram_usage: f32,
    gpu_usage: f32, 
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "PascalCase")]
struct Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine {
    utilization_percentage: u32,
}

static MONITOR_RUNNING: Mutex<bool> = Mutex::new(false);

#[tauri::command]
fn toggle_performance_monitor(app_handle: AppHandle, enable: bool) -> Result<(), String> {
    let mut running = MONITOR_RUNNING.lock().unwrap();
    
    if enable && !*running {
        *running = true;
        let mut sys = System::new_with_specifics(
            RefreshKind::new()
                .with_cpu(CpuRefreshKind::everything())
                .with_memory(MemoryRefreshKind::everything()),
        );
        
        std::thread::spawn(move || {
            loop {
                {
                    let running_check = MONITOR_RUNNING.lock().unwrap();
                    if !*running_check {
                        break;
                    }
                }
                
                sys.refresh_cpu_usage();
                sys.refresh_memory();
                
                let cpu_usage = sys.global_cpu_info().cpu_usage();
                let total_mem = sys.total_memory() as f32;
                let used_mem = sys.used_memory() as f32;
                let ram_usage = if total_mem > 0.0 { (used_mem / total_mem) * 100.0 } else { 0.0 };
                
                // Fetch GPU via WMI (non-blocking best effort)
                let mut gpu_usage = 0.0;
                if let Ok(com_con) = COMLibrary::new() {
                    if let Ok(wmi_con) = WMIConnection::new(com_con) {
                        let query = "SELECT UtilizationPercentage FROM Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine WHERE Name LIKE '%3D%'";
                        if let Ok(results) = wmi_con.raw_query::<Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine>(query) {
                            let mut total_util = 0;
                            for res in results {
                                total_util += res.utilization_percentage;
                            }
                            gpu_usage = total_util as f32;
                        }
                    }
                }
                
                let metrics = PerformanceMetrics {
                    cpu_usage,
                    ram_usage,
                    gpu_usage, 
                };
                
                let _ = app_handle.emit("performance_metrics", metrics);
                
                std::thread::sleep(std::time::Duration::from_secs(1));
            }
        });
    } else if !enable && *running {
        *running = false;
    }
    
    Ok(())
}

// ─── Tauri Entry ───────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            scan_local_games,
            launch_game,
            add_custom_game,
            remove_game,
            toggle_performance_monitor
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
