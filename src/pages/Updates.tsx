import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { RefreshCw, Download, ArrowUp, CheckCircle, Loader2, Info, Settings } from "lucide-react";

interface UpdateInfo {
  available: boolean;
  version: string | null;
  current_version: string;
  notes: string | null;
  download_url: string | null;
  size: number | null;
  pub_date: string | null;
}

interface UpdateProgress {
  status: string;
  progress: number | null;
  message: string | null;
}

export default function UpdatePage() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState<UpdateProgress | null>(null);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [autoCheck, setAutoCheck] = useState(false);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.06 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0 },
  };

  // Load current version on mount
  useEffect(() => {
    loadCurrentVersion();
    loadAutoCheckSetting();
  }, []);

  // Listen for update progress
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    listen("update_progress", (event: any) => {
      setProgress(event.payload);
      if (event.payload.status === "downloading") {
        setDownloading(true);
        setInstalling(false);
      } else if (event.payload.status === "installing") {
        setDownloading(false);
        setInstalling(true);
      } else if (event.payload.status === "complete") {
        setDownloading(false);
        setInstalling(false);
        setTimeout(() => loadCurrentVersion(), 1000);
      } else if (event.payload.status === "error") {
        setDownloading(false);
        setInstalling(false);
      }
    }).then(fn => { unlisten = fn; });
    return () => { if (unlisten) unlisten(); };
  }, []);

  const loadCurrentVersion = async () => {
    try {
      const version = await invoke<string>("get_current_version");
      setUpdateInfo({
        available: false,
        version: null,
        current_version: version,
        notes: null,
        download_url: null,
        size: null,
        pub_date: null,
      });
    } catch (err) {
      console.error("Failed to get current version:", err);
    }
  };

  const loadAutoCheckSetting = async () => {
    try {
      const settings = await invoke<any>("get_settings");
      setAutoCheck(settings?.behavior?.auto_check_updates || false);
    } catch (err) {
      console.error("Failed to load auto-check setting:", err);
    }
  };

  const checkForUpdates = async () => {
    setChecking(true);
    try {
      const info = await invoke<UpdateInfo>("check_for_updates");
      setUpdateInfo(info);
      setLastChecked(new Date().toLocaleString());
    } catch (err) {
      console.error("Failed to check for updates:", err);
      setUpdateInfo({
        available: false,
        version: null,
        current_version: "Unknown",
        notes: null,
        download_url: null,
        size: null,
        pub_date: null,
      });
    } finally {
      setChecking(false);
    }
  };

  const downloadAndInstall = async () => {
    if (!updateInfo?.available) return;
    
    setDownloading(true);
    setInstalling(false);
    try {
      await invoke("download_and_install_update");
    } catch (err) {
      console.error("Failed to download/install update:", err);
      alert(`Update failed: ${err}`);
    } finally {
      setDownloading(false);
      setInstalling(false);
    }
  };

  const toggleAutoCheck = async () => {
    const newValue = !autoCheck;
    setAutoCheck(newValue);
    try {
      const settings = await invoke<any>("get_settings");
      const updated = {
        ...settings,
        behavior: {
          ...settings.behavior,
          auto_check_updates: newValue,
        },
      };
      await invoke("update_settings", { settings: updated });
    } catch (err) {
      console.error("Failed to save auto-check setting:", err);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-5 pb-8 pt-2">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-xl font-bold" style={{ color: "var(--color-text-primary)" }}>
          Updates
        </h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
          Keep Lumen up to date with the latest features and fixes
        </p>
      </motion.div>

      <motion.div
        className="space-y-5 max-w-3xl"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* Current Version */}
        <motion.section variants={itemVariants} className="space-y-3">
          <div className="flex items-center gap-2">
            <Info size={14} style={{ color: "oklch(0.7 0.15 215)" }} />
            <h2 className="text-sm font-semibold" style={{ color: "var(--color-text-secondary)" }}>
              Current Version
            </h2>
          </div>
          <div
            className="p-4 rounded-xl"
            style={{
              background: "oklch(100% 0 0 / 0.03)",
              border: "1px solid oklch(100% 0 0 / 0.08)",
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg" style={{ background: "oklch(0.65 0.25 275 / 0.15)" }}>
                  <ArrowUp size={20} style={{ color: "oklch(0.75 0.2 275)" }} />
                </div>
                <div>
                  <p className="text-lg font-bold font-mono" style={{ color: "var(--color-text-primary)" }}>
                    v{updateInfo?.current_version || "Loading..."}
                  </p>
                  <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    Currently installed
                  </p>
                </div>
              </div>
              <motion.button
                onClick={checkForUpdates}
                disabled={checking || downloading || installing}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer"
                style={{
                  background: "oklch(0.45 0.2 145 / 0.2)",
                  color: "oklch(0.8 0.15 145)",
                  border: "1px solid oklch(0.65 0.2 145 / 0.2)",
                  outline: "none",
                  opacity: checking || downloading || installing ? 0.6 : 1,
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <RefreshCw size={14} className={checking ? "animate-spin" : ""} />
                {checking ? "Checking..." : "Check for Updates"}
              </motion.button>
            </div>
            {lastChecked && (
              <p className="text-[11px] mt-2" style={{ color: "var(--color-text-muted)" }}>
                Last checked: {lastChecked}
              </p>
            )}
          </div>
        </motion.section>

        {/* Update Available */}
        {updateInfo?.available && (
          <motion.section variants={itemVariants} className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle size={14} style={{ color: "oklch(0.7 0.15 145)" }} />
              <h2 className="text-sm font-semibold" style={{ color: "oklch(0.7 0.15 145)" }}>
                Update Available!
              </h2>
            </div>
            <div
              className="p-4 rounded-xl relative overflow-hidden"
              style={{
                background: "linear-gradient(135deg, oklch(0.7 0.15 145 / 0.1), oklch(0.65 0.2 155 / 0.05))",
                border: "1px solid oklch(0.7 0.15 145 / 0.3)",
              }}
            >
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="px-2 py-0.5 rounded text-xs font-bold"
                    style={{
                      background: "oklch(0.7 0.15 145 / 0.2)",
                      color: "oklch(0.75 0.15 145)",
                    }}
                  >
                    v{updateInfo.version}
                  </span>
                  {updateInfo.pub_date && (
                    <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      Released {new Date(updateInfo.pub_date).toLocaleDateString()}
                    </span>
                  )}
                </div>
                {updateInfo.notes && (
                  <div className="prose prose-sm max-w-none mb-4" style={{ color: "var(--color-text-secondary)" }}>
                    <p>{updateInfo.notes}</p>
                  </div>
                )}
                <motion.button
                  onClick={downloadAndInstall}
                  disabled={downloading || installing}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold cursor-pointer"
                  style={{
                    background: "linear-gradient(135deg, oklch(0.7 0.15 145), oklch(0.65 0.2 155))",
                    color: "white",
                    border: "none",
                    outline: "none",
                    opacity: downloading || installing ? 0.7 : 1,
                    boxShadow: "0 4px 16px oklch(0.7 0.15 145 / 0.3)",
                  }}
                  whileHover={{ scale: 1.02, boxShadow: "0 6px 24px oklch(0.7 0.15 145 / 0.4)" }}
                  whileTap={{ scale: 0.98 }}
                >
                  {downloading && <Loader2 size={16} className="animate-spin" />}
                  {installing && <ArrowUp size={16} className="animate-pulse" />}
                  {!downloading && !installing && <Download size={16} />}
                  {downloading ? "Downloading..." : installing ? "Installing..." : "Download & Install"}
                </motion.button>
              </div>
              {/* Progress Bar */}
              {(downloading || installing) && progress && (
                <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: "oklch(100% 0 0 / 0.1)" }}>
                  <motion.div
                    className="h-full"
                    style={{
                      background: "linear-gradient(90deg, oklch(0.7 0.15 145), oklch(0.65 0.2 155))",
                      width: `${(progress.progress || 0) * 100}%`,
                    }}
                    animate={{ width: `${(progress.progress || 0) * 100}%` }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  />
                </div>
              )}
              {progress?.message && (
                <p className="text-[11px] mt-2 relative z-10" style={{ color: "var(--color-text-muted)" }}>
                  {progress.message}
                </p>
              )}
            </div>
          </motion.section>
        )}

        {/* No Update Available */}
        {!updateInfo?.available && updateInfo?.current_version && (
          <motion.section variants={itemVariants} className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle size={14} style={{ color: "oklch(0.7 0.15 145)" }} />
              <h2 className="text-sm font-semibold" style={{ color: "var(--color-text-secondary)" }}>
                You're Up to Date
              </h2>
            </div>
            <div
              className="p-4 rounded-xl text-center"
              style={{
                background: "oklch(100% 0 0 / 0.03)",
                border: "1px solid oklch(100% 0 0 / 0.08)",
              }}
            >
              <CheckCircle size={32} className="mx-auto mb-3" style={{ color: "oklch(0.7 0.15 145)" }} />
              <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                Lumen v{updateInfo.current_version} is the latest version.
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                We'll notify you when a new release is available.
              </p>
            </div>
          </motion.section>
        )}

        {/* Auto-check Setting */}
        <motion.section variants={itemVariants} className="space-y-3">
          <div className="flex items-center gap-2">
            <Settings size={14} style={{ color: "oklch(0.7 0.15 275)" }} />
            <h2 className="text-sm font-semibold" style={{ color: "var(--color-text-secondary)" }}>
              Update Preferences
            </h2>
          </div>
          <div
            className="p-4 rounded-xl space-y-4"
            style={{
              background: "oklch(100% 0 0 / 0.03)",
              border: "1px solid oklch(100% 0 0 / 0.08)",
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                  Automatic Update Checks
                </p>
                <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                  Check for updates on app startup
                </p>
              </div>
              <motion.button
                onClick={toggleAutoCheck}
                className="relative w-10 h-5 rounded-full cursor-pointer"
                style={{
                  background: autoCheck ? "oklch(0.65 0.25 275)" : "oklch(100% 0 0 / 0.12)",
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
                  animate={{ left: autoCheck ? 22 : 2 }}
                  transition={{ type: "spring" as const, stiffness: 500, damping: 30 }}
                />
              </motion.button>
            </div>
          </div>
        </motion.section>

        {/* Update History */}
        <motion.section variants={itemVariants} className="space-y-3">
          <div className="flex items-center gap-2">
            <Info size={14} style={{ color: "oklch(0.7 0.15 310)" }} />
            <h2 className="text-sm font-semibold" style={{ color: "var(--color-text-secondary)" }}>
              About Updates
            </h2>
          </div>
          <div
            className="p-4 rounded-xl space-y-3"
            style={{
              background: "oklch(100% 0 0 / 0.03)",
              border: "1px solid oklch(100% 0 0 / 0.08)",
            }}
          >
            <div className="space-y-2 text-sm" style={{ color: "var(--color-text-secondary)" }}>
              <div className="flex items-start gap-2">
                <span className="text-[11px] font-mono shrink-0" style={{ color: "oklch(0.65 0.25 275)" }}>1.</span>
                <span>Updates are downloaded securely via GitHub Releases</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[11px] font-mono shrink-0" style={{ color: "oklch(0.65 0.25 275)" }}>2.</span>
                <span>Installation happens in the background - no manual installer needed</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[11px] font-mono shrink-0" style={{ color: "oklch(0.65 0.25 275)" }}>3.</span>
                <span>App restarts automatically after installation</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[11px] font-mono shrink-0" style={{ color: "oklch(0.65 0.25 275)" }}>4.</span>
                <span>All your settings and game library are preserved</span>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Version info */}
        <motion.div
          variants={itemVariants}
          className="text-center pt-4"
        >
          <p className="text-[10px] font-medium" style={{ color: "var(--color-text-muted)" }}>
            Lumen Game Launcher v{updateInfo?.current_version || "0.1.0"} · Built with Tauri + React
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}