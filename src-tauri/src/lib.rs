//! Lumen — Unified Game Tracker & Launcher
//!
//! A Tauri + React desktop application for managing and launching games
//! from Steam, Epic Games, and local installations.

pub mod config;
pub mod error;
pub mod icons;
pub mod launcher;
pub mod optiscaler;
pub mod performance;
pub mod platform;
pub mod scanner;
pub mod settings;
pub mod updater;

use crate::config::AppSettings;
use crate::launcher::{launch_game, add_custom_game, remove_game, hide_game, unhide_game, get_hidden_games};
use crate::optiscaler::{
    get_optiscaler_latest_release, download_optiscaler, scan_game_optiscaler_status,
    get_optiscaler_config, save_optiscaler_config, install_optiscaler_for_game,
    remove_optiscaler_from_game, update_optiscaler_for_game,
};
use crate::performance::{toggle_performance_monitor, is_performance_monitor_running};
use crate::scanner::scan_all_games;
use crate::settings::{get_settings, update_settings, reset_settings};
use crate::updater::{check_for_updates, download_and_install_update, get_current_version, restart_app};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
                    scan_all_games,
                    launch_game,
                    add_custom_game,
                    remove_game,
                    hide_game,
                    unhide_game,
                    get_hidden_games,
                    toggle_performance_monitor,
                    is_performance_monitor_running,
                    get_settings,
                    update_settings,
                    reset_settings,
                    get_optiscaler_latest_release,
                    download_optiscaler,
                    scan_game_optiscaler_status,
                    get_optiscaler_config,
                    save_optiscaler_config,
                    install_optiscaler_for_game,
                    remove_optiscaler_from_game,
                    update_optiscaler_for_game,
                    check_for_updates,
                    download_and_install_update,
                    get_current_version,
                    restart_app,
                ])
        .setup(|app| {
            // Initialize settings directory on startup
            let _ = AppSettings::load();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
