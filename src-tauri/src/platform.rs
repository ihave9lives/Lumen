use std::path::PathBuf;
use dirs;

/// Detect Steam installation paths for the current platform
pub fn detect_steam_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    
    #[cfg(target_os = "windows")]
    {
        paths.push(PathBuf::from(r"C:\Program Files (x86)\Steam\steamapps"));
        paths.push(PathBuf::from(r"C:\Program Files\Steam\steamapps"));
        
        // Check libraryfolders.vdf for additional paths
        let vdf_path = PathBuf::from(r"C:\Program Files (x86)\Steam\steamapps\libraryfolders.vdf");
        if vdf_path.exists() {
            if let Ok(content) = std::fs::read_to_string(&vdf_path) {
                for line in content.lines() {
                    let line = line.trim();
                    if line.starts_with("\"path\"") {
                        let parts: Vec<&str> = line.split('"').collect();
                        if parts.len() >= 4 {
                            let unescaped = parts[3].replace("\\\\", "\\");
                            let mut p = PathBuf::from(unescaped);
                            p.push("steamapps");
                            if !paths.contains(&p) {
                                paths.push(p);
                            }
                        }
                    }
                }
            }
        }
    }
    
    #[cfg(target_os = "linux")]
    {
        // Default Steam paths on Linux
        if let Some(home) = dirs::home_dir() {
            paths.push(home.join(".steam/steam/steamapps"));
            paths.push(home.join(".local/share/Steam/steamapps"));
        }
        
        // Check for additional library folders
        if let Some(home) = dirs::home_dir() {
            let vdf_path = home.join(".local/share/Steam/steamapps/libraryfolders.vdf");
            if vdf_path.exists() {
                if let Ok(content) = std::fs::read_to_string(&vdf_path) {
                    for line in content.lines() {
                        let line = line.trim();
                        if line.starts_with("\"path\"") {
                            let parts: Vec<&str> = line.split('"').collect();
                            if parts.len() >= 4 {
                                let unescaped = parts[3].replace("\\\\", "\\");
                                let mut p = PathBuf::from(unescaped);
                                p.push("steamapps");
                                if !paths.contains(&p) {
                                    paths.push(p);
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
            paths.push(home.join("Library/Application Support/Steam/steamapps"));
        }
    }
    
    // Filter out non-existent paths
    paths.retain(|p| p.exists());
    paths
}

/// Detect Epic Games installation paths for the current platform
pub fn detect_epic_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    
    #[cfg(target_os = "windows")]
    {
        paths.push(PathBuf::from(r"C:\ProgramData\Epic\EpicGamesLauncher\Data\Manifests"));
    }
    
    #[cfg(target_os = "linux")]
    {
        // Legendary (open source Epic launcher) config
        if let Some(home) = dirs::home_dir() {
            paths.push(home.join(".config/legendary"));
        }
    }
    
    #[cfg(target_os = "macos")]
    {
        // Epic Games on Mac
        if let Some(home) = dirs::home_dir() {
            paths.push(home.join("Library/Application Support/Epic/EpicGamesLauncher/Data/Manifests"));
        }
    }
    
    paths.retain(|p| p.exists());
    paths
}

/// Detect common local game directories for the current platform
pub fn detect_local_game_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    
    #[cfg(target_os = "windows")]
    {
        paths.push(PathBuf::from(r"C:\Games"));
        paths.push(PathBuf::from(r"D:\Games"));
        paths.push(PathBuf::from(r"D:\GG"));
        paths.push(PathBuf::from(r"E:\Games"));
        paths.push(PathBuf::from(r"F:\Games"));
    }
    
    #[cfg(target_os = "linux")]
    {
        if let Some(home) = dirs::home_dir() {
            paths.push(home.join("Games"));
            paths.push(home.join("games"));
            paths.push(PathBuf::from("/mnt/games"));
            paths.push(PathBuf::from("/media/games"));
        }
    }
    
    #[cfg(target_os = "macos")]
    {
        if let Some(home) = dirs::home_dir() {
            paths.push(home.join("Games"));
            paths.push(home.join("Applications/Games"));
        }
    }
    
    paths.retain(|p| p.exists());
    paths
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_detect_steam_paths_returns_some() {
        let paths = detect_steam_paths();
        // On CI this might be empty, but should not crash
        assert!(paths.iter().all(|p| p.is_absolute()));
    }
}