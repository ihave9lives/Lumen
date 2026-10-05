use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use dirs;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LibraryPaths {
    pub steam_paths: Vec<String>,
    pub epic_paths: Vec<String>,
    pub local_paths: Vec<String>,
}

impl Default for LibraryPaths {
    fn default() -> Self {
        Self {
            steam_paths: vec!["C:\\Program Files (x86)\\Steam\\steamapps".to_string()],
            epic_paths: vec!["C:\\ProgramData\\Epic\\EpicGamesLauncher\\Data\\Manifests".to_string()],
            local_paths: vec!["C:\\Games".to_string(), "D:\\Games".to_string(), "D:\\GG".to_string()],
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppearanceSettings {
    pub theme: String, // dark, midnight, amoled
}

impl Default for AppearanceSettings {
    fn default() -> Self {
        Self {
            theme: "dark".to_string(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BehaviorSettings {
    pub launch_minimized: bool,
    pub auto_scan_on_startup: bool,
    pub enable_performance_overlay: bool,
}

impl Default for BehaviorSettings {
    fn default() -> Self {
        Self {
            launch_minimized: false,
            auto_scan_on_startup: true,
            enable_performance_overlay: true,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub library: LibraryPaths,
    pub appearance: AppearanceSettings,
    pub behavior: BehaviorSettings,
    pub version: u32,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            library: LibraryPaths::default(),
            appearance: AppearanceSettings::default(),
            behavior: BehaviorSettings::default(),
            version: 1,
        }
    }
}

impl AppSettings {
    pub fn config_path() -> PathBuf {
        let mut path = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
        path.push("lumen");
        path.push("settings.json");
        path
    }

    pub fn load() -> crate::error::Result<Self> {
        let path = Self::config_path();
        if path.exists() {
            let content = std::fs::read_to_string(&path)?;
            let mut settings: AppSettings = serde_json::from_str(&content)?;
            // Migration for future versions
            if settings.version < 1 {
                settings = Self::migrate(settings);
            }
            Ok(settings)
        } else {
            Ok(Self::default())
        }
    }

    pub fn save(&self) -> crate::error::Result<()> {
        let path = Self::config_path();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let content = serde_json::to_string_pretty(self)?;
        std::fs::write(&path, content)?;
        Ok(())
    }

    fn migrate(mut settings: Self) -> Self {
        settings.version = 1;
        settings
    }
}
