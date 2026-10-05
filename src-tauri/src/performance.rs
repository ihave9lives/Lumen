use std::sync::Mutex;
use std::time::Duration;
use sysinfo::{System, CpuRefreshKind, RefreshKind, MemoryRefreshKind};
use tauri::{AppHandle, Emitter};
use serde::{Serialize, Deserialize};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PerformanceMetrics {
    pub cpu_usage: f32,
    pub ram_usage: f32,
    pub gpu_usage: f32,
}

static MONITOR_RUNNING: Mutex<bool> = Mutex::new(false);

#[tauri::command]
pub fn toggle_performance_monitor(app_handle: AppHandle, enable: bool) -> Result<(), String> {
    let mut running = MONITOR_RUNNING.lock().map_err(|_| "Monitor lock poisoned".to_string())?;
    
    if enable && !*running {
        *running = true;
        let mut sys = System::new_with_specifics(
            RefreshKind::new()
                .with_cpu(CpuRefreshKind::everything())
                .with_memory(MemoryRefreshKind::everything()),
        );
        
        std::thread::spawn(move || {
            loop {
                let should_continue = {
                    let running_check = MONITOR_RUNNING.lock().unwrap();
                    *running_check
                };
                
                if !should_continue {
                    break;
                }
                
                sys.refresh_cpu_usage();
                sys.refresh_memory();
                
                let cpu_usage = sys.global_cpu_info().cpu_usage();
                let total_mem = sys.total_memory() as f32;
                let used_mem = sys.used_memory() as f32;
                let ram_usage = if total_mem > 0.0 { (used_mem / total_mem) * 100.0 } else { 0.0 };
                
                // GPU usage not available on Linux without WMI - just use 0
                let gpu_usage = 0.0;
                
                let metrics = PerformanceMetrics {
                    cpu_usage,
                    ram_usage,
                    gpu_usage,
                };
                
                let _ = app_handle.emit("performance_metrics", metrics);
                
                std::thread::sleep(Duration::from_secs(1));
            }
        });
    } else if !enable && *running {
        *running = false;
    }
    
    Ok(())
}

#[tauri::command]
pub fn is_performance_monitor_running() -> Result<bool, String> {
    let running = MONITOR_RUNNING.lock().map_err(|_| "Monitor lock poisoned".to_string())?;
    Ok(*running)
}
