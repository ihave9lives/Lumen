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
    pub auto_check_updates: bool,
    pub enable_background_tracker: bool,
}

impl Default for BehaviorSettings {
    fn default() -> Self {
        Self {
            launch_minimized: false,
            auto_scan_on_startup: true,
            enable_performance_overlay: true,
            auto_check_updates: false,
            enable_background_tracker: false,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OptiScalerGameConfig {
    pub upscaler: Option<String>,
    pub fg_output: Option<String>,
    pub fg_enabled: Option<bool>,
    pub dxgi_spoofing: Option<bool>,
    pub use_fsr2_dx11_inputs: Option<bool>,
    pub nvngx_path: Option<String>,
    pub nvapi_path: Option<String>,
    pub ffx_dx12_path: Option<String>,
    pub ffx_dx12_sr_path: Option<String>,
    pub ffx_dx12_fg_path: Option<String>,
    pub xess_dx11_path: Option<String>,
    pub opti_dll_path: Option<String>,
    pub plugins_path: Option<String>,
    pub load_asi_plugins: Option<bool>,
    pub opti_fg_hudfix: Option<bool>,
    pub output_scaling: Option<f32>,
    pub motion_sharpness: Option<f32>,
    pub custom_resolution: Option<String>,
    pub fps_limit: Option<u32>,
    pub latflex: Option<bool>,
    pub reflex_to_anti_lag2: Option<bool>,
    pub fake_nvapi: Option<bool>,
    pub dlssg_to_fsr3: Option<bool>,
    pub opti_patcher: Option<bool>,
    pub dll_name: Option<String>,
    pub download_optipatcher: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub library: LibraryPaths,
    pub appearance: AppearanceSettings,
    pub behavior: BehaviorSettings,
    pub optiscaler_configs: std::collections::HashMap<String, OptiScalerGameConfig>,
    pub version: u32,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            library: LibraryPaths::default(),
            appearance: AppearanceSettings::default(),
            behavior: BehaviorSettings::default(),
            optiscaler_configs: std::collections::HashMap::new(),
            version: 2,
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

    pub fn load() -> Result<Self, String> {
        let path = Self::config_path();
        if path.exists() {
            let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
            let mut settings: AppSettings = serde_json::from_str(&content).map_err(|e| e.to_string())?;
            // Migration for future versions
            if settings.version < 2 {
                settings = Self::migrate(settings);
            }
            Ok(settings)
        } else {
            Ok(Self::default())
        }
    }

    pub fn save(&self) -> Result<(), String> {
        let path = Self::config_path();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let content = serde_json::to_string_pretty(self).map_err(|e| e.to_string())?;
        std::fs::write(&path, content).map_err(|e| e.to_string())?;
        Ok(())
    }

    fn migrate(mut settings: Self) -> Self {
        settings.version = 2;
        if settings.optiscaler_configs.is_empty() {
            settings.optiscaler_configs = std::collections::HashMap::new();
        }
        settings
    }
}

#[tauri::command]
pub fn get_settings() -> Result<AppSettings, String> {
    AppSettings::load()
}

#[tauri::command]
pub fn update_settings(settings: AppSettings) -> Result<(), String> {
    settings.save()
}

#[tauri::command]
pub fn reset_settings() -> Result<(), String> {
    let settings = AppSettings::default();
    settings.save()
}

#[tauri::command]
pub fn get_optiscaler_game_config(game_id: String) -> Result<Option<OptiScalerGameConfig>, String> {
    let settings = AppSettings::load()?;
    Ok(settings.optiscaler_configs.get(&game_id).cloned())
}

#[tauri::command]
pub fn save_optiscaler_game_config(game_id: String, config: OptiScalerGameConfig) -> Result<(), String> {
    let mut settings = AppSettings::load()?;
    settings.optiscaler_configs.insert(game_id, config);
    settings.save()
}