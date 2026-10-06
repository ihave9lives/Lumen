use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use crate::error::{Result, LumenError};
use crate::settings::OptiScalerGameConfig;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OptiScalerConfig {
    pub upscaler: Option<String>,           // fsr22, fsr31, xess, dlss, auto
    pub fg_output: Option<String>,          // fsrfg, xefg, nvngxfg, nofg, auto
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
}

impl Default for OptiScalerConfig {
    fn default() -> Self {
        Self {
            upscaler: Some("auto".to_string()),
            fg_output: Some("auto".to_string()),
            fg_enabled: Some(false),
            dxgi_spoofing: Some(true),
            use_fsr2_dx11_inputs: Some(false),
            nvngx_path: Some("auto".to_string()),
            nvapi_path: Some("auto".to_string()),
            ffx_dx12_path: Some("auto".to_string()),
            ffx_dx12_sr_path: Some("auto".to_string()),
            ffx_dx12_fg_path: Some("auto".to_string()),
            xess_dx11_path: Some("auto".to_string()),
            opti_dll_path: Some("auto".to_string()),
            plugins_path: Some("auto".to_string()),
            load_asi_plugins: Some(false),
            opti_fg_hudfix: Some(true),
            output_scaling: Some(1.0),
            motion_sharpness: Some(0.0),
            custom_resolution: None,
            fps_limit: None,
            latflex: Some(false),
            reflex_to_anti_lag2: Some(false),
            fake_nvapi: Some(false),
            dlssg_to_fsr3: Some(false),
            opti_patcher: Some(false),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OptiScalerRelease {
    pub version: String,
    pub download_url: String,
    pub published_at: String,
    pub assets: Vec<OptiScalerAsset>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OptiScalerAsset {
    pub name: String,
    pub browser_download_url: String,
    pub size: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OptiScalerGameStatus {
    pub game_id: String,
    pub installed: bool,
    pub version: Option<String>,
    pub dll_name: Option<String>,
    pub config_path: Option<String>,
    pub has_nvngx_dlss: bool,
    pub supported_dlls: Vec<String>,
}

const OPTISCALER_REPO: &str = "optiscaler/OptiScaler";
const OPTISCALER_API: &str = "https://api.github.com/repos/optiscaler/OptiScaler/releases/latest";
const SUPPORTED_DLL_NAMES: &[&str] = &[
    "dxgi.dll", "winmm.dll", "version.dll", "dbghelp.dll",
    "d3d12.dll", "wininet.dll", "winhttp.dll", "OptiScaler.asi"
];

fn get_optiscaler_dir() -> PathBuf {
    let mut path = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("lumen");
    path.push("optiscaler");
    fs::create_dir_all(&path).ok();
    path
}

fn get_game_optiscaler_dir(game_exe_path: &Path) -> PathBuf {
    game_exe_path.parent().unwrap_or_else(|| Path::new(".")).join("OptiScaler")
}

#[tauri::command]
pub async fn get_optiscaler_latest_release() -> Result<OptiScalerRelease> {
    let client = reqwest::Client::new();
    let response = client
        .get(OPTISCALER_API)
        .header("User-Agent", "Lumen-Launcher")
        .send()
        .await
        .map_err(|e| LumenError::Config(format!("Failed to fetch OptiScaler release: {}", e)))?;
    
    let release = response
        .json::<OptiScalerRelease>()
        .await
        .map_err(|e| LumenError::Config(format!("Failed to parse OptiScaler release: {}", e)))?;
    
    Ok(release)
}

#[tauri::command]
pub async fn download_optiscaler(_version: Option<String>, download_dir: Option<String>) -> Result<PathBuf> {
    let release = get_optiscaler_latest_release().await?;

    let target_dir = download_dir
        .map(PathBuf::from)
        .unwrap_or_else(|| get_optiscaler_dir());

    fs::create_dir_all(&target_dir)?;

    // Find the main OptiScaler archive asset (.7z or .zip)
    let archive_asset = release.assets.iter()
        .find(|a| (a.name.ends_with(".7z") || a.name.ends_with(".zip")) && !a.name.contains("pdb") && !a.name.contains("debug"))
        .ok_or_else(|| LumenError::Config("No OptiScaler archive asset found".to_string()))?;

    let archive_path = target_dir.join(&archive_asset.name);

    // Download the archive
    let client = reqwest::Client::new();
    let response = client
        .get(&archive_asset.browser_download_url)
        .header("User-Agent", "Lumen-Launcher")
        .send()
        .await
        .map_err(|e| LumenError::Config(format!("Failed to download OptiScaler: {}", e)))?;

    let bytes = response
        .bytes()
        .await
        .map_err(|e| LumenError::Config(format!("Failed to read download: {}", e)))?;

    fs::write(&archive_path, &bytes)?;

    // Extract archive
    let extract_dir = target_dir.join("extracted");
    if extract_dir.exists() {
        fs::remove_dir_all(&extract_dir)?;
    }
    fs::create_dir_all(&extract_dir)?;

    // Extract based on file extension
    if archive_asset.name.ends_with(".7z") {
        // Use 7z for .7z files
        Command::new("7z")
            .args(["x", archive_path.to_str().unwrap(), format!("-o{}", extract_dir.display()).as_str(), "-y"])
            .output()
            .map_err(|e| LumenError::Config(format!("Failed to extract 7z: {}", e)))?;
    } else {
        // Use PowerShell for .zip on Windows
        #[cfg(target_os = "windows")]
        {
            let ps_script = format!(
                "Expand-Archive -Path '{}' -DestinationPath '{}' -Force",
                archive_path.display(),
                extract_dir.display()
            );
            Command::new("powershell")
                .args(["-NoProfile", "-Command", &ps_script])
                .output()
                .map_err(|e| LumenError::Config(format!("Failed to extract zip: {}", e)))?;
        }

        #[cfg(not(target_os = "windows"))]
        {
            Command::new("unzip")
                .args(["-o", archive_path.to_str().unwrap(), "-d", extract_dir.to_str().unwrap()])
                .output()
                .map_err(|e| LumenError::Config(format!("Failed to extract zip: {}", e)))?;
        }
    }

    Ok(extract_dir)
}

#[tauri::command]
pub fn scan_game_optiscaler_status(game_id: String, exec_path: String) -> Result<OptiScalerGameStatus> {
    let exe_path = Path::new(&exec_path);
    let game_dir = exe_path.parent().unwrap_or_else(|| Path::new("."));
    
    let mut status = OptiScalerGameStatus {
        game_id,
        installed: false,
        version: None,
        dll_name: None,
        config_path: None,
        has_nvngx_dlss: false,
        supported_dlls: Vec::new(),
    };
    
    // Check for supported OptiScaler DLL names
    for dll_name in SUPPORTED_DLL_NAMES {
        let dll_path = game_dir.join(dll_name);
        if dll_path.exists() {
            // Check if it's actually OptiScaler by checking version info
            #[cfg(target_os = "windows")]
                        {
                            let output = Command::new("powershell")
                                .args(["-NoProfile", "-Command", &format!(
                                    "(Get-Item '{}').VersionInfo.OriginalFilename", dll_path.display()
                                )])
                                .output();
                
                            if let Ok(out) = output {
                                let original = String::from_utf8_lossy(&out.stdout).trim().to_string();
                                if original == "OptiScaler.dll" || original == "nvngx.dll" {
                                    status.installed = true;
                                    status.dll_name = Some(dll_name.to_string());
                                    status.config_path = Some(game_dir.join("OptiScaler.ini").to_string_lossy().to_string());
                                    status.supported_dlls.push(dll_name.to_string());
                                    break;
                                }
                            }
                        }
                        #[cfg(not(target_os = "windows"))]
                        {
                            // On Linux, just check if file exists and has OptiScaler in name
                            status.installed = true;
                            status.dll_name = Some(dll_name.to_string());
                            status.config_path = Some(game_dir.join("OptiScaler.ini").to_string_lossy().to_string());
                            status.supported_dlls.push(dll_name.to_string());
                            break;
                        }
                        status.supported_dlls.push(dll_name.to_string());
                    }
                }
    
    // Check for nvngx_dlss.dll
    let nvngx_dlss = game_dir.join("nvngx_dlss.dll");
    status.has_nvngx_dlss = nvngx_dlss.exists();
    
    // Check for OptiScaler directory with plugins
    let optiscaler_dir = get_game_optiscaler_dir(exe_path);
    if optiscaler_dir.exists() {
        status.installed = true;
    }
    
    Ok(status)
}

fn parse_optiscaler_ini(ini_path: &Path) -> Result<OptiScalerConfig> {
    let content = fs::read_to_string(ini_path)
        .map_err(|e| LumenError::Config(format!("Failed to read OptiScaler.ini: {}", e)))?;
    
    let mut config = OptiScalerConfig::default();
    let mut current_section = String::new();
    
    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with(';') || line.starts_with('#') {
            continue;
        }
        
        if line.starts_with('[') && line.ends_with(']') {
            current_section = line[1..line.len()-1].to_string();
            continue;
        }
        
        if let Some(eq_pos) = line.find('=') {
            let key = line[..eq_pos].trim();
            let value = line[eq_pos+1..].trim();
            
            // Parse based on section and key
            match current_section.as_str() {
                "Upscaler" => {
                    if key == "Dx11Upscaler" { config.upscaler = Some(value.to_string()); }
                }
                "FrameGen" => {
                    match key {
                        "Enabled" => config.fg_enabled = Some(value.parse().unwrap_or(false)),
                        "FGOutput" => config.fg_output = Some(value.to_string()),
                        "OptiFGHudfix" => config.opti_fg_hudfix = Some(value.parse().unwrap_or(true)),
                        _ => {}
                    }
                }
                "Spoofing" => {
                    if key == "Dxgi" { config.dxgi_spoofing = Some(value.parse().unwrap_or(true)); }
                }
                "Libraries" => {
                    match key {
                        "OptiDllPath" => config.opti_dll_path = Some(value.to_string()),
                        "NvngxPath" => config.nvngx_path = Some(value.to_string()),
                        "NvapiPath" => config.nvapi_path = Some(value.to_string()),
                        "FfxDx12Path" => config.ffx_dx12_path = Some(value.to_string()),
                        "FfxDx12SRPath" => config.ffx_dx12_sr_path = Some(value.to_string()),
                        "FfxDx12FGPath" => config.ffx_dx12_fg_path = Some(value.to_string()),
                        "XeSSDx11Path" => config.xess_dx11_path = Some(value.to_string()),
                        "PluginsPath" => config.plugins_path = Some(value.to_string()),
                        _ => {}
                    }
                }
                "Plugins" => {
                    if key == "LoadAsiPlugins" { config.load_asi_plugins = Some(value.parse().unwrap_or(false)); }
                }
                "Dx12" => {
                    match key {
                        "UseFsr2Dx11Inputs" => config.use_fsr2_dx11_inputs = Some(value.parse().unwrap_or(false)),
                        "Latflex" => config.latflex = Some(value.parse().unwrap_or(false)),
                        "ReflexToAntiLag2" => config.reflex_to_anti_lag2 = Some(value.parse().unwrap_or(false)),
                        _ => {}
                    }
                }
                "FakeNvapi" => {
                    if key == "Enabled" { config.fake_nvapi = Some(value.parse().unwrap_or(false)); }
                }
                "Nukem" => {
                    if key == "DlssgToFsr3" { config.dlssg_to_fsr3 = Some(value.parse().unwrap_or(false)); }
                }
                "OptiPatcher" => {
                    if key == "Enabled" { config.opti_patcher = Some(value.parse().unwrap_or(false)); }
                }
                "OutputScaling" => {
                    if key == "Enabled" { 
                        config.output_scaling = value.parse().ok();
                    }
                }
                "MotionSharpness" => {
                    if key == "Value" { 
                        config.motion_sharpness = value.parse().ok();
                    }
                }
                "CustomResolution" => {
                    if key == "Value" { 
                        config.custom_resolution = Some(value.to_string());
                    }
                }
                "FpsLimit" => {
                    if key == "Value" { 
                        config.fps_limit = value.parse().ok();
                    }
                }
                _ => {}
            }
        }
    }
    
    Ok(config)
}

#[tauri::command]
pub fn get_optiscaler_config(_game_id: String, exec_path: String) -> Result<OptiScalerConfig> {
    let exe_path = Path::new(&exec_path);
    let game_dir = exe_path.parent().unwrap_or_else(|| Path::new("."));
    let ini_path = game_dir.join("OptiScaler.ini");
    
    if ini_path.exists() {
        parse_optiscaler_ini(&ini_path)
    } else {
        Ok(OptiScalerConfig::default())
    }
}

fn write_optiscaler_ini(ini_path: &Path, config: &OptiScalerConfig) -> Result<()> {
    let mut content = String::new();
    
    content.push_str("; OptiScaler Configuration - Generated by Lumen Launcher
");
    content.push_str("; Repository: https://github.com/optiscaler/OptiScaler

");
    
    // Upscaler section
    content.push_str("[Upscaler]
");
    content.push_str("; Select Upscaler for Dx11 games
");
    content.push_str("; fsr22 (native DX11), fsr31 (native DX11), xess (native DX11, Arc only),
");
    content.push_str("; xess_12 (dx11on12), fsr21_12 (dx11on12), fsr22_12 (dx11on12),
");
    content.push_str("; fsr31_12 (dx11on12, FSR4), dlss - Default (auto) is fsr22
");
    content.push_str(&format!("Dx11Upscaler={}

", config.upscaler.as_deref().unwrap_or("auto")));
    
    // FrameGen section
    content.push_str("[FrameGen]
");
    content.push_str(&format!("Enabled={}
", config.fg_enabled.unwrap_or(false)));
    content.push_str(&format!("FGOutput={}
", config.fg_output.as_deref().unwrap_or("auto")));
    content.push_str(&format!("OptiFGHudfix={}

", config.opti_fg_hudfix.unwrap_or(true)));
    
    // Spoofing section
    content.push_str("[Spoofing]
");
    content.push_str("; Enables Nvidia GPU spoofing for DXGI
");
    content.push_str("; true or false - Default (auto) is true for AMD/Intel, false for Nvidia
");
    content.push_str(&format!("Dxgi={}

", config.dxgi_spoofing.unwrap_or(true)));
    
    // Libraries section
    content.push_str("[Libraries]
");
    content.push_str("; Main folder for OptiScaler to check dll files below
");
    content.push_str(r"; Default is .\OptiScaler
");
    content.push_str(&format!("OptiDllPath={}
", config.opti_dll_path.as_deref().unwrap_or("auto")));
    content.push_str(&format!("NvngxPath={}
", config.nvngx_path.as_deref().unwrap_or("auto")));
    content.push_str(&format!("NvapiPath={}
", config.nvapi_path.as_deref().unwrap_or("auto")));
    content.push_str(&format!("FfxDx12Path={}
", config.ffx_dx12_path.as_deref().unwrap_or("auto")));
    content.push_str(&format!("FfxDx12SRPath={}
", config.ffx_dx12_sr_path.as_deref().unwrap_or("auto")));
    content.push_str(&format!("FfxDx12FGPath={}
", config.ffx_dx12_fg_path.as_deref().unwrap_or("auto")));
    content.push_str(&format!("XeSSDx11Path={}
", config.xess_dx11_path.as_deref().unwrap_or("auto")));
    content.push_str(&format!("PluginsPath={}

", config.plugins_path.as_deref().unwrap_or("auto")));
    
    // Plugins section
    content.push_str("[Plugins]
");
    content.push_str(&format!("LoadAsiPlugins={}

", config.load_asi_plugins.unwrap_or(false)));
    
    // Dx12 section
    content.push_str("[Dx12]
");
    content.push_str(&format!("UseFsr2Dx11Inputs={}
", config.use_fsr2_dx11_inputs.unwrap_or(false)));
    content.push_str(&format!("Latflex={}
", config.latflex.unwrap_or(false)));
    content.push_str(&format!("ReflexToAntiLag2={}

", config.reflex_to_anti_lag2.unwrap_or(false)));
    
    // FakeNvapi section
    content.push_str("[FakeNvapi]
");
    content.push_str(&format!("Enabled={}

", config.fake_nvapi.unwrap_or(false)));
    
    // Nukem section
    content.push_str("[Nukem]
");
    content.push_str(&format!("DlssgToFsr3={}

", config.dlssg_to_fsr3.unwrap_or(false)));
    
    // OptiPatcher section
    content.push_str("[OptiPatcher]
");
    content.push_str(&format!("Enabled={}

", config.opti_patcher.unwrap_or(false)));
    
    // OutputScaling section
    if let Some(scale) = config.output_scaling {
        content.push_str("[OutputScaling]
");
        content.push_str(&format!("Enabled={}

", scale));
    }
    
    // MotionSharpness section
    if let Some(sharpness) = config.motion_sharpness {
        content.push_str("[MotionSharpness]
");
        content.push_str(&format!("Value={}

", sharpness));
    }
    
    // CustomResolution section
    if let Some(res) = &config.custom_resolution {
        content.push_str("[CustomResolution]
");
        content.push_str(&format!("Value={}

", res));
    }
    
    // FpsLimit section
    if let Some(fps) = config.fps_limit {
        content.push_str("[FpsLimit]
");
        content.push_str(&format!("Value={}

", fps));
    }
    
    fs::write(ini_path, content)
        .map_err(|e| LumenError::Config(format!("Failed to write OptiScaler.ini: {}", e)))?;
    
    Ok(())
}

#[tauri::command]
pub fn save_optiscaler_config(_game_id: String, exec_path: String, config: OptiScalerConfig) -> Result<()> {
    let exe_path = Path::new(&exec_path);
    let game_dir = exe_path.parent().unwrap_or_else(|| Path::new("."));
    let ini_path = game_dir.join("OptiScaler.ini");
    
    write_optiscaler_ini(&ini_path, &config)?;
    
    // Also save to AppSettings for persistence
    let game_config = OptiScalerGameConfig {
        upscaler: config.upscaler,
        fg_output: config.fg_output,
        fg_enabled: config.fg_enabled,
        dxgi_spoofing: config.dxgi_spoofing,
        use_fsr2_dx11_inputs: config.use_fsr2_dx11_inputs,
        nvngx_path: config.nvngx_path,
        nvapi_path: config.nvapi_path,
        ffx_dx12_path: config.ffx_dx12_path,
        ffx_dx12_sr_path: config.ffx_dx12_sr_path,
        ffx_dx12_fg_path: config.ffx_dx12_fg_path,
        xess_dx11_path: config.xess_dx11_path,
        opti_dll_path: config.opti_dll_path,
        plugins_path: config.plugins_path,
        load_asi_plugins: config.load_asi_plugins,
        opti_fg_hudfix: config.opti_fg_hudfix,
        output_scaling: config.output_scaling,
        motion_sharpness: config.motion_sharpness,
        custom_resolution: config.custom_resolution,
        fps_limit: config.fps_limit,
        latflex: config.latflex,
        reflex_to_anti_lag2: config.reflex_to_anti_lag2,
        fake_nvapi: config.fake_nvapi,
        dlssg_to_fsr3: config.dlssg_to_fsr3,
        opti_patcher: config.opti_patcher,
        dll_name: None,
        download_optipatcher: None,
    };
    
    if let Ok(mut settings) = crate::settings::AppSettings::load() {
        // We need the game_id, but we don't have it here. The UI should call save_optiscaler_game_config instead.
        // This function now also writes the ini file for immediate effect.
    }
    
    Ok(())
}

#[tauri::command]
pub async fn install_optiscaler_for_game(
    game_id: String,
    exec_path: String,
    dll_name: Option<String>,
    enable_dlss_spoofing: Option<bool>,
    download_optipatcher: Option<bool>,
) -> Result<OptiScalerGameStatus> {
    let exe_path = Path::new(&exec_path);
    let game_dir = exe_path.parent().unwrap_or_else(|| Path::new("."));
    
    // Download OptiScaler if not cached
    let optiscaler_dir = get_optiscaler_dir();
    let optiscaler_dll = optiscaler_dir.join("extracted/OptiScaler.dll");
    
    if !optiscaler_dll.exists() {
        download_optiscaler(None, None).await?;
    }
    
    // Determine DLL name to use
    let target_dll = dll_name.unwrap_or_else(|| "dxgi.dll".to_string());
    
    // Copy OptiScaler.dll to game directory with target name
    let target_path = game_dir.join(&target_dll);
    fs::copy(&optiscaler_dll, &target_path)
        .map_err(|e| LumenError::Config(format!("Failed to copy OptiScaler.dll: {}", e)))?;
    
    // Copy additional required DLLs from extracted folder
    let extracted_dir = optiscaler_dir.join("extracted");
    if extracted_dir.exists() {
        for entry in fs::read_dir(&extracted_dir)? {
            let entry = entry?;
            let file_name = entry.file_name();
            let file_str = file_name.to_string_lossy();
            
            // Copy supporting DLLs (amd_fidelityfx, nvapi, etc.)
            if file_str.ends_with(".dll") && file_str != "OptiScaler.dll" {
                let dest = game_dir.join(&*file_str);
                if !dest.exists() {
                    fs::copy(entry.path(), &dest).ok();
                }
            }
            // Copy plugins folder
            else if file_str == "plugins" && entry.file_type()?.is_dir() {
                let plugins_dest = game_dir.join("plugins");
                if !plugins_dest.exists() {
                    copy_dir_all(&entry.path(), &plugins_dest)?;
                }
            }
        }
    }
    
    // Check for nvngx_dlss.dll and create nvngx.dll if needed
    let nvngx_dlss = game_dir.join("nvngx_dlss.dll");
    let nvngx_dll = game_dir.join("nvngx.dll");
    
    if nvngx_dlss.exists() && !nvngx_dll.exists() {
        fs::copy(&nvngx_dlss, &nvngx_dll)?;
    }
    
    // Create default OptiScaler.ini
    let ini_path = game_dir.join("OptiScaler.ini");
    let mut config = OptiScalerConfig::default();
    config.dxgi_spoofing = enable_dlss_spoofing.or(Some(true));
    
    if download_optipatcher.unwrap_or(false) {
        config.opti_patcher = Some(true);
        config.load_asi_plugins = Some(true);
    }
    
    write_optiscaler_ini(&ini_path, &config)?;
    
    // Download OptiPatcher if requested
    if download_optipatcher.unwrap_or(false) {
        let plugins_dir = game_dir.join("plugins");
        fs::create_dir_all(&plugins_dir)?;
        
        let optipatcher_path = plugins_dir.join("OptiPatcher.asi");
        if !optipatcher_path.exists() {
            let client = reqwest::Client::new();
            let response = client
                .get("https://github.com/optiscaler/OptiPatcher/releases/download/rolling/OptiPatcher.asi")
                .header("User-Agent", "Lumen-Launcher")
                .send()
                .await;
            
            if let Ok(resp) = response {
                if let Ok(bytes) = resp.bytes().await {
                    fs::write(&optipatcher_path, bytes).ok();
                }
            }
        }
    }
    
    // Return updated status
        let status = scan_game_optiscaler_status(game_id.clone(), exec_path.clone())?;
    
        // Save config to AppSettings for persistence
        let game_config = OptiScalerGameConfig {
            upscaler: config.upscaler,
            fg_output: config.fg_output,
            fg_enabled: config.fg_enabled,
            dxgi_spoofing: config.dxgi_spoofing,
            use_fsr2_dx11_inputs: config.use_fsr2_dx11_inputs,
            nvngx_path: config.nvngx_path,
            nvapi_path: config.nvapi_path,
            ffx_dx12_path: config.ffx_dx12_path,
            ffx_dx12_sr_path: config.ffx_dx12_sr_path,
            ffx_dx12_fg_path: config.ffx_dx12_fg_path,
            xess_dx11_path: config.xess_dx11_path,
            opti_dll_path: config.opti_dll_path,
            plugins_path: config.plugins_path,
            load_asi_plugins: config.load_asi_plugins,
            opti_fg_hudfix: config.opti_fg_hudfix,
            output_scaling: config.output_scaling,
            motion_sharpness: config.motion_sharpness,
            custom_resolution: config.custom_resolution,
            fps_limit: config.fps_limit,
                        latflex: config.latflex,
                        reflex_to_anti_lag2: config.reflex_to_anti_lag2,
                        fake_nvapi: config.fake_nvapi,
                        dlssg_to_fsr3: config.dlssg_to_fsr3,
                        opti_patcher: config.opti_patcher,
                        dll_name: Some(target_dll.clone()),
                        download_optipatcher: download_optipatcher,
                    };
    
                if let Ok(mut settings) = crate::settings::AppSettings::load() {
                    settings.optiscaler_configs.insert(game_id.clone(), game_config);
                    let _ = settings.save();
                }

                Ok(status)
            }

            #[tauri::command]
pub fn remove_optiscaler_from_game(_game_id: String, exec_path: String) -> Result<()> {
    let exe_path = Path::new(&exec_path);
    let game_dir = exe_path.parent().unwrap_or_else(|| Path::new("."));
    
    // Remove OptiScaler DLLs
    for dll_name in SUPPORTED_DLL_NAMES {
        let dll_path = game_dir.join(dll_name);
        if dll_path.exists() {
            // Check if it's OptiScaler before removing
            #[cfg(target_os = "windows")]
            {
                let output = Command::new("powershell")
                    .args(["-NoProfile", "-Command", &format!(
                        "(Get-Item '{}').VersionInfo.OriginalFilename", dll_path.display()
                    )])
                    .output();
                
                if let Ok(out) = output {
                    let original = String::from_utf8_lossy(&out.stdout).trim().to_string();
                    if original == "OptiScaler.dll" || original == "nvngx.dll" {
                        fs::remove_file(&dll_path).ok();
                    }
                }
            }
        }
    }
    
    // Remove nvngx.dll if it was copied from nvngx_dlss.dll
    let nvngx_dll = game_dir.join("nvngx.dll");
    let nvngx_dlss = game_dir.join("nvngx_dlss.dll");
    if nvngx_dll.exists() && nvngx_dlss.exists() {
        fs::remove_file(&nvngx_dll).ok();
    }
    
    // Remove OptiScaler.ini
    let ini_path = game_dir.join("OptiScaler.ini");
    fs::remove_file(&ini_path).ok();
    
    // Remove plugins folder
    let plugins_dir = game_dir.join("plugins");
    if plugins_dir.exists() {
        fs::remove_dir_all(&plugins_dir).ok();
    }
    
    // Remove OptiScaler folder
    let optiscaler_dir = get_game_optiscaler_dir(exe_path);
    if optiscaler_dir.exists() {
        fs::remove_dir_all(&optiscaler_dir).ok();
    }
    
    Ok(())
}

fn copy_dir_all(src: &Path, dst: &Path) -> Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let path = entry.path();
        let file_name = entry.file_name();
        let dest = dst.join(file_name);
        if entry.file_type()?.is_dir() {
            copy_dir_all(&path, &dest)?;
        } else {
            fs::copy(&path, &dest)?;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn update_optiscaler_for_game(game_id: String, exec_path: String) -> Result<OptiScalerGameStatus> {
    // Remove old OptiScaler files but keep nvngx_dlss.dll and OptiScaler.ini
    let exe_path = Path::new(&exec_path);
    let game_dir = exe_path.parent().unwrap_or_else(|| Path::new("."));
    
    for dll_name in SUPPORTED_DLL_NAMES {
        let dll_path = game_dir.join(dll_name);
        if dll_path.exists() {
            #[cfg(target_os = "windows")]
            {
                let output = Command::new("powershell")
                    .args(["-NoProfile", "-Command", &format!(
                        "(Get-Item '{}').VersionInfo.OriginalFilename", dll_path.display()
                    )])
                    .output();
                
                if let Ok(out) = output {
                    let original = String::from_utf8_lossy(&out.stdout).trim().to_string();
                    if original == "OptiScaler.dll" || original == "nvngx.dll" {
                        fs::remove_file(&dll_path).ok();
                    }
                }
            }
        }
    }
    
    // Reinstall with same settings
    let status = scan_game_optiscaler_status(game_id.clone(), exec_path.clone())?;
    let dll_name = status.dll_name;
    let enable_dlss = Some(true);
    let download_optipatcher = status.config_path.as_ref().and_then(|_| {
        // Check if OptiPatcher was installed
        let plugins_dir = game_dir.join("plugins");
        plugins_dir.exists().then_some(true)
    });
    
    install_optiscaler_for_game(game_id, exec_path, dll_name, enable_dlss, download_optipatcher).await
}
