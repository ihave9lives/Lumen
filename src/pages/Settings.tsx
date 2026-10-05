import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { FolderOpen, Shield, Monitor, Moon, Check, FolderPlus, X } from "lucide-react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";

const themeOptions = [
  { id: "dark", label: "Dark", icon: Moon, description: "Rich dark surfaces" },
  { id: "midnight", label: "Midnight", icon: Moon, description: "Deep blue tones" },
  { id: "amoled", label: "AMOLED", icon: Monitor, description: "True black" },
];

interface LibraryPaths {
  steam_paths: string[];
  epic_paths: string[];
  local_paths: string[];
}

interface AppearanceSettings {
  theme: string;
}

interface BehaviorSettings {
  launch_minimized: boolean;
  auto_scan_on_startup: boolean;
  enable_performance_overlay: boolean;
}

interface AppSettings {
  library: LibraryPaths;
  appearance: AppearanceSettings;
  behavior: BehaviorSettings;
  version: number;
}

export default function Settings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTheme, setActiveTheme] = useState("dark");
  const [launchMinimized, setLaunchMinimized] = useState(false);
  const [autoScan, setAutoScan] = useState(true);
  const [enableOverlay, setEnableOverlay] = useState(true);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.06 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0 },
  };

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const loaded = await invoke<AppSettings>("get_settings");
      setSettings(loaded);
      setActiveTheme(loaded.appearance.theme);
      setLaunchMinimized(loaded.behavior.launch_minimized);
      setAutoScan(loaded.behavior.auto_scan_on_startup);
      setEnableOverlay(loaded.behavior.enable_performance_overlay);
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (updatedSettings?: AppSettings) => {
      const settingsToSave = updatedSettings || settings;
      if (!settingsToSave) return;
      try {
        const updated: AppSettings = {
          ...settingsToSave,
          appearance: { theme: activeTheme },
          behavior: {
            launch_minimized: launchMinimized,
            auto_scan_on_startup: autoScan,
            enable_performance_overlay: enableOverlay,
          },
        };
        await invoke("update_settings", { settings: updated });
        setSettings(updated);
      } catch (err) {
        console.error("Failed to save settings:", err);
      }
    };

  const addPath = async (type: 'steam' | 'epic' | 'local') => {
    const selected = await openDialog({
      multiple: false,
      directory: true,
      title: `Select ${type === 'steam' ? 'Steam' : type === 'epic' ? 'Epic Games' : 'Local Games'} directory`,
    });
    
    if (selected && typeof selected === 'string' && settings) {
      const newPaths = { ...settings.library };
      const key = `${type}_paths` as keyof LibraryPaths;
      const current = newPaths[key] as string[];
      if (!current.includes(selected)) {
        (newPaths[key] as string[]).push(selected);
        setSettings({ ...settings, library: newPaths });
        await saveSettings();
      }
    }
  };

  const removePath = async (type: 'steam' | 'epic' | 'local', path: string) => {
      if (!settings) return;
      const newPaths = { ...settings.library };
      const key = `${type}_paths` as keyof LibraryPaths;
      (newPaths[key] as string[]) = (newPaths[key] as string[]).filter(p => p !== path);
      const updatedSettings = { ...settings, library: newPaths };
      setSettings(updatedSettings);
      await saveSettings(updatedSettings);
    };

  const handleThemeChange = (theme: string) => {
    setActiveTheme(theme);
    saveSettings();
  };

  const handleToggleChange = async (key: keyof BehaviorSettings, value: boolean) => {
    if (key === 'launch_minimized') setLaunchMinimized(value);
    else if (key === 'auto_scan_on_startup') setAutoScan(value);
    else if (key === 'enable_performance_overlay') setEnableOverlay(value);
    await saveSettings();
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-current border-t-transparent rounded-full mx-auto mb-3" style={{ borderColor: "oklch(0.65 0.25 275)" }} />
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-5 pb-8 pt-2">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-xl font-bold" style={{ color: "var(--color-text-primary)" }}>
          Settings
        </h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
          Configure your launcher and preferences
        </p>
      </motion.div>

      <motion.div
        className="space-y-5 max-w-2xl"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* Library Folders */}
        <motion.section variants={itemVariants} className="space-y-3">
          <div className="flex items-center gap-2">
            <FolderOpen size={14} style={{ color: "oklch(0.7 0.15 275)" }} />
            <h2 className="text-sm font-semibold" style={{ color: "var(--color-text-secondary)" }}>
              Library Folders
            </h2>
          </div>
          <div
            className="p-4 rounded-xl space-y-4"
            style={{
              background: "oklch(100% 0 0 / 0.03)",
              border: "1px solid oklch(100% 0 0 / 0.08)",
            }}
          >
            {/* Steam */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                    Steam Libraries
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                    Auto-detects via libraryfolders.vdf
                  </p>
                </div>
                <motion.button
                  onClick={() => addPath('steam')}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold cursor-pointer"
                  style={{
                    background: "oklch(0.45 0.2 145 / 0.2)",
                    color: "oklch(0.8 0.15 145)",
                    border: "1px solid oklch(0.65 0.2 145 / 0.2)",
                  }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <FolderPlus size={10} />
                  Add Path
                </motion.button>
              </div>
              <div className="space-y-1.5 ml-6">
                {settings?.library.steam_paths.map((p, i) => (
                  <motion.div
                    key={i}
                    className="flex items-center justify-between px-3 py-2 rounded-lg text-xs"
                    style={{
                      background: "oklch(100% 0 0 / 0.04)",
                      border: "1px solid oklch(100% 0 0 / 0.06)",
                      color: "var(--color-text-secondary)",
                    }}
                    whileHover={{ borderColor: "oklch(100% 0 0 / 0.15)" }}
                  >
                    <span className="font-mono text-[11px] truncate max-w-[300px]">{p}</span>
                    <motion.button
                      onClick={() => removePath('steam', p)}
                      className="p-1 rounded cursor-pointer text-[11px]"
                      style={{ color: "oklch(0.6 0.2 20)", background: "transparent", border: "none" }}
                      whileHover={{ scale: 1.1, color: "oklch(0.7 0.25 20)" }}
                    >
                      <X size={12} />
                    </motion.button>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="h-[1px] w-full" style={{ background: "oklch(100% 0 0 / 0.06)" }} />

            {/* Epic */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                    Epic Games
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                    Scans ProgramData manifests
                  </p>
                </div>
                <motion.button
                  onClick={() => addPath('epic')}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold cursor-pointer"
                  style={{
                    background: "oklch(0.45 0.2 145 / 0.2)",
                    color: "oklch(0.8 0.15 145)",
                    border: "1px solid oklch(0.65 0.2 145 / 0.2)",
                  }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <FolderPlus size={10} />
                  Add Path
                </motion.button>
              </div>
              <div className="space-y-1.5 ml-6">
                {settings?.library.epic_paths.map((p, i) => (
                  <motion.div
                    key={i}
                    className="flex items-center justify-between px-3 py-2 rounded-lg text-xs"
                    style={{
                      background: "oklch(100% 0 0 / 0.04)",
                      border: "1px solid oklch(100% 0 0 / 0.06)",
                      color: "var(--color-text-secondary)",
                    }}
                    whileHover={{ borderColor: "oklch(100% 0 0 / 0.15)" }}
                  >
                    <span className="font-mono text-[11px] truncate max-w-[300px]">{p}</span>
                    <motion.button
                      onClick={() => removePath('epic', p)}
                      className="p-1 rounded cursor-pointer text-[11px]"
                      style={{ color: "oklch(0.6 0.2 20)", background: "transparent", border: "none" }}
                      whileHover={{ scale: 1.1, color: "oklch(0.7 0.25 20)" }}
                    >
                      <X size={12} />
                    </motion.button>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="h-[1px] w-full" style={{ background: "oklch(100% 0 0 / 0.06)" }} />

            {/* Local directories */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                    Local Search Directories
                  </p>
                </div>
                <motion.button
                  onClick={() => addPath('local')}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold cursor-pointer"
                  style={{
                    background: "oklch(0.45 0.2 145 / 0.2)",
                    color: "oklch(0.8 0.15 145)",
                    border: "1px solid oklch(0.65 0.2 145 / 0.2)",
                  }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <FolderPlus size={10} />
                  Add Path
                </motion.button>
              </div>
              <div className="space-y-1.5 ml-6">
                {settings?.library.local_paths.map((p, i) => (
                  <motion.div
                    key={i}
                    className="flex items-center justify-between px-3 py-2 rounded-lg text-xs"
                    style={{
                      background: "oklch(100% 0 0 / 0.04)",
                      border: "1px solid oklch(100% 0 0 / 0.06)",
                      color: "var(--color-text-secondary)",
                    }}
                    whileHover={{ borderColor: "oklch(100% 0 0 / 0.15)" }}
                  >
                    <span className="font-mono text-[11px] truncate max-w-[300px]">{p}</span>
                    <motion.button
                      onClick={() => removePath('local', p)}
                      className="p-1 rounded cursor-pointer text-[11px]"
                      style={{ color: "oklch(0.6 0.2 20)", background: "transparent", border: "none" }}
                      whileHover={{ scale: 1.1, color: "oklch(0.7 0.25 20)" }}
                    >
                      <X size={12} />
                    </motion.button>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        {/* Appearance */}
        <motion.section variants={itemVariants} className="space-y-3">
          <div className="flex items-center gap-2">
            <Moon size={14} style={{ color: "oklch(0.7 0.15 310)" }} />
            <h2 className="text-sm font-semibold" style={{ color: "var(--color-text-secondary)" }}>
              Appearance
            </h2>
          </div>
          <div
            className="p-4 rounded-xl"
            style={{
              background: "oklch(100% 0 0 / 0.03)",
              border: "1px solid oklch(100% 0 0 / 0.08)",
            }}
          >
            <p className="text-xs mb-3 font-medium" style={{ color: "var(--color-text-muted)" }}>
              Theme
            </p>
            <div className="flex gap-2">
              {themeOptions.map((theme) => {
                const isActive = activeTheme === theme.id;
                return (
                  <motion.button
                    key={theme.id}
                    onClick={() => handleThemeChange(theme.id)}
                    className="relative flex-1 flex flex-col items-center gap-1.5 py-3 rounded-lg cursor-pointer"
                    style={{
                      background: isActive ? "oklch(0.65 0.25 275 / 0.15)" : "oklch(100% 0 0 / 0.04)",
                      border: isActive ? "1px solid oklch(0.65 0.25 275 / 0.4)" : "1px solid oklch(100% 0 0 / 0.06)",
                      outline: "none",
                    }}
                    whileHover={{ borderColor: isActive ? "oklch(0.65 0.25 275 / 0.6)" : "oklch(100% 0 0 / 0.15)" }}
                    whileTap={{ scale: 0.97 }}
                  >
                    {isActive && (
                      <motion.div
                        className="absolute top-1.5 right-1.5"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring" as const, stiffness: 500 }}
                      >
                        <Check size={10} style={{ color: "oklch(0.75 0.2 275)" }} />
                      </motion.div>
                    )}
                    <theme.icon size={16} style={{ color: isActive ? "oklch(0.8 0.15 275)" : "var(--color-text-secondary)" }} />
                    <span className="text-[11px] font-semibold" style={{ color: isActive ? "var(--color-text-primary)" : "var(--color-text-secondary)" }}>
                      {theme.label}
                    </span>
                    <span className="text-[9px]" style={{ color: "var(--color-text-muted)" }}>
                      {theme.description}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </motion.section>

        {/* Toggles */}
        <motion.section variants={itemVariants} className="space-y-3">
          <div className="flex items-center gap-2">
            <Monitor size={14} style={{ color: "oklch(0.7 0.15 200)" }} />
            <h2 className="text-sm font-semibold" style={{ color: "var(--color-text-secondary)" }}>
              Behavior
            </h2>
          </div>
          <div
            className="p-4 rounded-xl space-y-4"
            style={{
              background: "oklch(100% 0 0 / 0.03)",
              border: "1px solid oklch(100% 0 0 / 0.08)",
            }}
          >
            {/* Toggle: Launch minimized */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                  Minimize on game launch
                </p>
                <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                  Auto-minimize Lumen when a game starts
                </p>
              </div>
              <motion.button
                onClick={() => handleToggleChange('launch_minimized', !launchMinimized)}
                className="relative w-10 h-5 rounded-full cursor-pointer"
                style={{
                  background: launchMinimized ? "oklch(0.65 0.25 275)" : "oklch(100% 0 0 / 0.12)",
                  border: "none",
                  outline: "none",
                }}
                whileTap={{ scale: 0.95 }}
              >
                <motion.div
                  className="absolute top-0.5 w-4 h-4 rounded-full"
                  style={{
                    background: "white",
                    boxShadow: "0 1px 4px oklch(0 0 0 / 0.3)",
                  }}
                  animate={{ left: launchMinimized ? 22 : 2 }}
                  transition={{ type: "spring" as const, stiffness: 500, damping: 30 }}
                />
              </motion.button>
            </div>

            {/* Toggle: Auto scan */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                  Auto-scan on startup
                </p>
                <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                  Automatically scan for new games on launch
                </p>
              </div>
              <motion.button
                onClick={() => handleToggleChange('auto_scan_on_startup', !autoScan)}
                className="relative w-10 h-5 rounded-full cursor-pointer"
                style={{
                  background: autoScan ? "oklch(0.65 0.25 275)" : "oklch(100% 0 0 / 0.12)",
                  border: "none",
                  outline: "none",
                }}
                whileTap={{ scale: 0.95 }}
              >
                <motion.div
                  className="absolute top-0.5 w-4 h-4 rounded-full"
                  style={{
                    background: "white",
                    boxShadow: "0 1px 4px oklch(0 0 0 / 0.3)",
                  }}
                  animate={{ left: autoScan ? 22 : 2 }}
                  transition={{ type: "spring" as const, stiffness: 500, damping: 30 }}
                />
              </motion.button>
            </div>

            {/* Toggle: Performance Overlay */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                  Performance Overlay
                </p>
                <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                  Show CPU/RAM metrics when a game is launched
                </p>
              </div>
              <motion.button
                onClick={() => handleToggleChange('enable_performance_overlay', !enableOverlay)}
                className="relative w-10 h-5 rounded-full cursor-pointer"
                style={{
                  background: enableOverlay ? "oklch(0.65 0.25 275)" : "oklch(100% 0 0 / 0.12)",
                  border: "none",
                  outline: "none",
                }}
                whileTap={{ scale: 0.95 }}
              >
                <motion.div
                  className="absolute top-0.5 w-4 h-4 rounded-full"
                  style={{
                    background: "white",
                    boxShadow: "0 1px 4px oklch(0 0 0 / 0.3)",
                  }}
                  animate={{ left: enableOverlay ? 22 : 2 }}
                  transition={{ type: "spring" as const, stiffness: 500, damping: 30 }}
                />
              </motion.button>
            </div>
          </div>
        </motion.section>

        {/* Danger Zone */}
        <motion.section variants={itemVariants} className="space-y-3">
          <div className="flex items-center gap-2">
            <Shield size={14} style={{ color: "oklch(0.6 0.2 20)" }} />
            <h2 className="text-sm font-semibold" style={{ color: "var(--color-text-secondary)" }}>
              Data Management
            </h2>
          </div>
          <div
            className="p-4 rounded-xl space-y-3"
            style={{
              background: "oklch(100% 0 0 / 0.03)",
              border: "1px solid oklch(100% 0 0 / 0.08)",
            }}
          >
            <motion.button
              onClick={async () => {
                if (confirm("Reset all settings to defaults? This cannot be undone.")) {
                  await invoke("reset_settings");
                  await loadSettings();
                }
              }}
              className="w-full py-2 rounded-lg text-xs font-bold cursor-pointer flex items-center justify-center gap-2"
              style={{
                background: "oklch(0.5 0.2 20 / 0.15)",
                color: "oklch(0.75 0.18 20)",
                border: "1px solid oklch(0.6 0.2 20 / 0.3)",
                outline: "none",
              }}
              whileHover={{ backgroundColor: "oklch(0.5 0.2 20 / 0.25)" }}
              whileTap={{ scale: 0.97 }}
            >
              <X size={12} />
              Reset All Settings
            </motion.button>
          </div>
        </motion.section>

        {/* Version info */}
        <motion.div
          variants={itemVariants}
          className="text-center pt-4"
        >
          <p className="text-[10px] font-medium" style={{ color: "var(--color-text-muted)" }}>
            Lumen Game Launcher v0.1.0 · Built with Tauri + React
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
