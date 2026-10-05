import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { 
  Download, 
  Trash2, 
  RefreshCw, 
  Settings, 
  CheckCircle, 
  Loader2,
  Zap,
  Package,
  Monitor,
  ChevronDown,
  Info,
  ExternalLink
} from "lucide-react";

interface OptiScalerRelease {
  version: string;
  download_url: string;
  published_at: string;
  assets: OptiScalerAsset[];
}

interface OptiScalerAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

interface OptiScalerGameStatus {
  game_id: string;
  installed: boolean;
  version: string | null;
  dll_name: string | null;
  config_path: string | null;
  has_nvngx_dlss: boolean;
  supported_dlls: string[];
}

interface OptiScalerConfig {
  upscaler: string | null;
  fg_output: string | null;
  fg_enabled: boolean | null;
  dxgi_spoofing: boolean | null;
  use_fsr2_dx11_inputs: boolean | null;
  nvngx_path: string | null;
  nvapi_path: string | null;
  ffx_dx12_path: string | null;
  ffx_dx12_sr_path: string | null;
  ffx_dx12_fg_path: string | null;
  xess_dx11_path: string | null;
  opti_dll_path: string | null;
  plugins_path: string | null;
  load_asi_plugins: boolean | null;
  opti_fg_hudfix: boolean | null;
  output_scaling: number | null;
  motion_sharpness: number | null;
  custom_resolution: string | null;
  fps_limit: number | null;
  latflex: boolean | null;
  reflex_to_anti_lag2: boolean | null;
  fake_nvapi: boolean | null;
  dlssg_to_fsr3: boolean | null;
  opti_patcher: boolean | null;
}

const upscalerOptions = [
  { value: "auto", label: "Auto (Recommended)", desc: "Automatically select best upscaler" },
  { value: "fsr22", label: "FSR 2.2", desc: "AMD FidelityFX Super Resolution 2.2 (Native DX11)" },
  { value: "fsr31", label: "FSR 3.1", desc: "AMD FidelityFX Super Resolution 3.1 (Native DX11)" },
  { value: "xess", label: "XeSS", desc: "Intel Xe Super Sampling (Native DX11, Arc only)" },
  { value: "dlss", label: "DLSS", desc: "NVIDIA Deep Learning Super Sampling" },
  { value: "xess_12", label: "XeSS (DX11on12)", desc: "Intel XeSS via DX11on12" },
  { value: "fsr21_12", label: "FSR 2.1 (DX11on12)", desc: "AMD FSR 2.1 via DX11on12" },
  { value: "fsr22_12", label: "FSR 2.2 (DX11on12)", desc: "AMD FSR 2.2 via DX11on12" },
  { value: "fsr31_12", label: "FSR 3.1 (DX11on12)", desc: "AMD FSR 3.1/4.0 via DX11on12" },
];

const fgOutputOptions = [
  { value: "auto", label: "Auto", desc: "Automatically select best frame gen" },
  { value: "fsrfg", label: "FSR Frame Gen", desc: "AMD FSR 3 Frame Generation" },
  { value: "xefg", label: "XeSS Frame Gen", desc: "Intel XeSS Frame Generation" },
  { value: "nvngxfg", label: "DLSS Frame Gen", desc: "NVIDIA DLSS 3 Frame Generation" },
  { value: "nofg", label: "Disabled", desc: "No frame generation" },
];

export default function OptiScalerPage() {
  const [release, setRelease] = useState<OptiScalerRelease | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [configuring, setConfiguring] = useState<string | null>(null);
  const [gameConfigs, setGameConfigs] = useState<Record<string, OptiScalerConfig>>({});
  const [gameStatuses, setGameStatuses] = useState<Record<string, OptiScalerGameStatus>>({});
  const [expandedGames, setExpandedGames] = useState<Set<string>>(new Set());
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(true);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.06 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0 },
  };

  // Load OptiScaler release info on mount
  useEffect(() => {
    loadReleaseInfo();
    loadGamesData();
  }, []);

  const loadReleaseInfo = async () => {
    try {
      const data = await invoke<OptiScalerRelease>("get_optiscaler_latest_release");
      setRelease(data);
    } catch (err) {
      console.error("Failed to load OptiScaler release:", err);
    }
  };

  const loadGamesData = async () => {
    try {
      const games = await invoke<any[]>("scan_all_games");
      const statuses: Record<string, OptiScalerGameStatus> = {};
      const configs: Record<string, OptiScalerConfig> = {};

      for (const game of games) {
        if (game.execPath) {
          try {
            const status = await invoke<OptiScalerGameStatus>("scan_game_optiscaler_status", {
              game_id: game.id,
              exec_path: game.execPath,
            });
            statuses[game.id] = status;

            if (status.installed) {
              const config = await invoke<OptiScalerConfig>("get_optiscaler_config", {
                game_id: game.id,
                exec_path: game.execPath,
              });
              configs[game.id] = config;
            }
          } catch (err) {
            console.error(`Failed to load OptiScaler data for ${game.id}:`, err);
          }
        }
      }

      setGameStatuses(statuses);
      setGameConfigs(configs);
    } catch (err) {
      console.error("Failed to load games:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await invoke("download_optiscaler", { version: null, download_dir: null });
      await loadReleaseInfo();
    } catch (err) {
      console.error("Failed to download OptiScaler:", err);
      alert(`Download failed: ${err}`);
    } finally {
      setDownloading(false);
    }
  };

  const handleInstall = async (game: any, dllName: string, enableDlssSpoofing: boolean, downloadOptiPatcher: boolean) => {
    if (!game.execPath) return;
    setInstalling(game.id);
    try {
      await invoke("install_optiscaler_for_game", {
        game_id: game.id,
        exec_path: game.execPath,
        dll_name: dllName,
        enable_dlss_spoofing: enableDlssSpoofing,
        download_optipatcher: downloadOptiPatcher,
      });
      await loadGamesData();
    } catch (err) {
      console.error("Failed to install OptiScaler:", err);
      alert(`Installation failed: ${err}`);
    } finally {
      setInstalling(null);
    }
  };

  const handleUpdate = async (game: any) => {
    if (!game.execPath) return;
    setUpdating(game.id);
    try {
      await invoke("update_optiscaler_for_game", {
        game_id: game.id,
        exec_path: game.execPath,
      });
      await loadGamesData();
    } catch (err) {
      console.error("Failed to update OptiScaler:", err);
      alert(`Update failed: ${err}`);
    } finally {
      setUpdating(null);
    }
  };

  const handleRemove = async (game: any) => {
    if (!game.execPath) return;
    setRemoving(game.id);
    try {
      await invoke("remove_optiscaler_from_game", {
        game_id: game.id,
        exec_path: game.execPath,
      });
      await loadGamesData();
    } catch (err) {
      console.error("Failed to remove OptiScaler:", err);
      alert(`Removal failed: ${err}`);
    } finally {
      setRemoving(null);
    }
  };

  const handleSaveConfig = async (game: any) => {
    if (!game.execPath) return;
    const config = gameConfigs[game.id];
    if (!config) return;
    setConfiguring(game.id);
    try {
      await invoke("save_optiscaler_config", {
        game_id: game.id,
        exec_path: game.execPath,
        config,
      });
    } catch (err) {
      console.error("Failed to save config:", err);
      alert(`Save failed: ${err}`);
    } finally {
      setConfiguring(null);
    }
  };

  const handleConfigChange = (gameId: string, key: keyof OptiScalerConfig, value: any) => {
    setGameConfigs(prev => ({
      ...prev,
      [gameId]: {
        ...prev[gameId],
        [key]: value,
      },
    }));
  };

  const toggleGameExpanded = (gameId: string) => {
    setExpandedGames(prev => {
      const next = new Set(prev);
      if (next.has(gameId)) {
        next.delete(gameId);
      } else {
        next.add(gameId);
      }
      return next;
    });
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin w-8 h-8 border-2 border-current border-t-transparent rounded-full mx-auto mb-3" style={{ borderColor: "oklch(0.65 0.25 275)" }} />
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading OptiScaler data...</p>
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
        <div className="flex items-center gap-2 mb-2">
          <Zap size={20} style={{ color: "oklch(0.75 0.15 85)" }} />
          <h1 className="text-xl font-bold" style={{ color: "var(--color-text-primary)" }}>
            OptiScaler Integration
          </h1>
        </div>
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          Universal upscaler & frame generation for any game - FSR, XeSS, DLSS, Frame Gen & more
        </p>
      </motion.div>

      <motion.div
        className="space-y-5 max-w-4xl"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* OptiScaler Core */}
        <motion.section variants={itemVariants} className="space-y-3">
          <div className="flex items-center gap-2">
            <Package size={14} style={{ color: "oklch(0.75 0.15 85)" }} />
            <h2 className="text-sm font-semibold" style={{ color: "var(--color-text-secondary)" }}>
              OptiScaler Core
            </h2>
          </div>
          <div
            className="p-4 rounded-xl space-y-4"
            style={{
              background: "oklch(100% 0 0 / 0.03)",
              border: "1px solid oklch(100% 0 0 / 0.08)",
            }}
          >
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ background: "oklch(0.75 0.15 85 / 0.15)" }}>
                  <Zap size={18} style={{ color: "oklch(0.8 0.12 85)" }} />
                </div>
                <div>
                  <p className="font-medium" style={{ color: "var(--color-text-primary)" }}>
                    {release ? `v${release.version}` : "Not loaded"}
                  </p>
                  <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    Latest release {release ? `• ${new Date(release.published_at).toLocaleDateString()}` : ""}
                  </p>
                </div>
              </div>
              <motion.button
                onClick={handleDownload}
                disabled={downloading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer"
                style={{
                  background: downloading ? "oklch(100% 0 0 / 0.1)" : "oklch(0.45 0.2 145 / 0.2)",
                  color: downloading ? "var(--color-text-muted)" : "oklch(0.8 0.15 145)",
                  border: `1px solid ${downloading ? "oklch(100% 0 0 / 0.1)" : "oklch(0.65 0.2 145 / 0.2)"}`,
                  outline: "none",
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                {downloading ? "Downloading..." : "Download Core"}
              </motion.button>
            </div>

            {release && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-2 rounded" style={{ background: "oklch(100% 0 0 / 0.04)" }}>
                  <p style={{ color: "var(--color-text-muted)" }}>Assets</p>
                  <p className="font-mono" style={{ color: "var(--color-text-primary)" }}>{release.assets.length}</p>
                </div>
                <div className="p-2 rounded" style={{ background: "oklch(100% 0 0 / 0.04)" }}>
                  <p style={{ color: "var(--color-text-muted)" }}>Total Size</p>
                  <p className="font-mono" style={{ color: "var(--color-text-primary)" }}>
                    {formatBytes(release.assets.reduce((a, b) => a + b.size, 0))}
                  </p>
                </div>
                <div className="p-2 rounded" style={{ background: "oklch(100% 0 0 / 0.04)" }}>
                  <p style={{ color: "var(--color-text-muted)" }}>Published</p>
                  <p className="font-mono" style={{ color: "var(--color-text-primary)" }}>
                    {new Date(release.published_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            )}

            <motion.button
              onClick={() => window.open("https://github.com/optiscaler/OptiScaler", "_blank")}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer w-full sm:w-auto"
              style={{
                background: "oklch(100% 0 0 / 0.05)",
                color: "var(--color-text-secondary)",
                border: "1px solid oklch(100% 0 0 / 0.08)",
                outline: "none",
              }}
              whileHover={{ backgroundColor: "oklch(100% 0 0 / 0.1)", borderColor: "oklch(100% 0 0 / 0.15)" }}
              whileTap={{ scale: 0.98 }}
            >
              <ExternalLink size={14} />
              View on GitHub
            </motion.button>
          </div>
        </motion.section>

        {/* Game-specific OptiScaler Management */}
        <motion.section variants={itemVariants} className="space-y-3">
          <div className="flex items-center gap-2">
            <Monitor size={14} style={{ color: "oklch(0.7 0.15 200)" }} />
            <h2 className="text-sm font-semibold" style={{ color: "var(--color-text-secondary)" }}>
              Game Configurations
            </h2>
          </div>
          <div
            className="p-4 rounded-xl space-y-4"
            style={{
              background: "oklch(100% 0 0 / 0.03)",
              border: "1px solid oklch(100% 0 0 / 0.08)",
            }}
          >
            {Object.keys(gameStatuses).length === 0 ? (
              <div className="text-center py-8">
                <Monitor size={32} className="mx-auto mb-3" style={{ color: "var(--color-text-muted)" }} />
                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                  No games found. Scan your library first.
                </p>
              </div>
            ) : (
              <>
                {Object.entries(gameStatuses).map(([gameId, status]) => {
                  const config = gameConfigs[gameId];
                  const isExpanded = expandedGames.has(gameId);
                  const isProcessing = installing === gameId || updating === gameId || removing === gameId || configuring === gameId;

                  return (
                    <motion.div
                      key={gameId}
                      className="rounded-xl overflow-hidden"
                      style={{
                        background: "oklch(100% 0 0 / 0.04)",
                        border: `1px solid ${status.installed ? "oklch(0.7 0.15 145 / 0.3)" : "oklch(100% 0 0 / 0.06)"}`,
                      }}
                      whileHover={{ borderColor: status.installed ? "oklch(0.7 0.15 145 / 0.5)" : "oklch(100% 0 0 / 0.15)" }}
                    >
                      {/* Game Header */}
                      <motion.button
                        onClick={() => toggleGameExpanded(gameId)}
                        className="w-full flex items-center justify-between p-3 cursor-pointer"
                        style={{ background: "transparent", border: "none", outline: "none" }}
                      >
                        <div className="flex items-center gap-3">
                          <motion.div
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            transition={{ type: "spring", stiffness: 300, damping: 25 }}
                          >
                            <ChevronDown size={16} style={{ color: "var(--color-text-muted)" }} />
                          </motion.div>
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: "oklch(100% 0 0 / 0.05)" }}>
                            {status.installed ? (
                              <CheckCircle size={18} style={{ color: "oklch(0.7 0.15 145)" }} />
                            ) : (
                              <Zap size={18} style={{ color: "oklch(0.6 0.1 275)" }} />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-sm truncate max-w-[300px]" style={{ color: "var(--color-text-primary)" }}>
                              {gameId.replace("steam-", "").replace("epic-", "").replace("local-", "").replace("custom-", "").replace(/-/g, " ")}
                            </p>
                            <p className="text-xs" style={{ color: status.installed ? "oklch(0.7 0.15 145)" : "var(--color-text-muted)" }}>
                              {status.installed ? `Installed • ${status.dll_name || "Unknown DLL"}` : "Not installed"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {status.installed && config && (
                            <motion.button
                              onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleSaveConfig({ id: gameId, execPath: "" }); }}
                              disabled={configuring === gameId}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer flex items-center gap-1.5"
                              style={{
                                background: "oklch(0.45 0.2 145 / 0.2)",
                                color: "oklch(0.8 0.15 145)",
                                border: "1px solid oklch(0.65 0.2 145 / 0.2)",
                                outline: "none",
                                opacity: configuring === gameId ? 0.6 : 1,
                              }}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                            >
                              {configuring === gameId ? <Loader2 size={12} className="animate-spin" /> : <Settings size={12} />}
                              Save Config
                            </motion.button>
                          )}

                          {!status.installed ? (
                            <motion.button
                              onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleInstall({ id: gameId, execPath: "" }, "dxgi.dll", true, false); }}
                              disabled={isProcessing}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1.5"
                              style={{
                                background: "linear-gradient(135deg, oklch(0.7 0.15 145), oklch(0.65 0.2 155))",
                                color: "white",
                                border: "none",
                                outline: "none",
                                boxShadow: "0 4px 12px oklch(0.7 0.15 145 / 0.3)",
                                opacity: isProcessing ? 0.6 : 1,
                              }}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                            >
                              {installing === gameId ? <Loader2 size={12} className="animate-spin" /> : <Package size={12} />}
                              Install
                            </motion.button>
                          ) : (
                            <>
                              <motion.button
                                onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleUpdate({ id: gameId, execPath: "" }); }}
                                disabled={isProcessing}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer flex items-center gap-1.5"
                                style={{
                                  background: "oklch(0.75 0.15 85 / 0.15)",
                                  color: "oklch(0.8 0.12 85)",
                                  border: "1px solid oklch(0.75 0.15 85 / 0.3)",
                                  outline: "none",
                                  opacity: isProcessing ? 0.6 : 1,
                                }}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                              >
                                {updating === gameId ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                Update
                              </motion.button>
                              <motion.button
                                onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleRemove({ id: gameId, execPath: "" }); }}
                                disabled={isProcessing}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer flex items-center gap-1.5"
                                style={{
                                  background: "oklch(0.5 0.2 20 / 0.15)",
                                  color: "oklch(0.75 0.18 20)",
                                  border: "1px solid oklch(0.6 0.2 20 / 0.3)",
                                  outline: "none",
                                  opacity: isProcessing ? 0.6 : 1,
                                }}
                                whileHover={{ backgroundColor: "oklch(0.5 0.2 20 / 0.25)" }}
                                whileTap={{ scale: 0.98 }}
                              >
                                {removing === gameId ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                                Remove
                              </motion.button>
                            </>
                          )}
                        </div>
                      </motion.button>

                      {/* Expanded Config Panel */}
                      <AnimatePresence>
                        {isExpanded && config && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="border-t p-4"
                            style={{ borderColor: "oklch(100% 0 0 / 0.06)" }}
                          >
                            <div className="space-y-4">
                              {/* Basic Settings */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                                    Upscaler
                                  </label>
                                  <select
                                    value={config.upscaler || "auto"}
                                    onChange={(e) => handleConfigChange(gameId, "upscaler", e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg text-sm"
                                    style={{
                                      background: "oklch(100% 0 0 / 0.05)",
                                      border: "1px solid oklch(100% 0 0 / 0.08)",
                                      color: "var(--color-text-primary)",
                                      outline: "none",
                                    }}
                                  >
                                    {upscalerOptions.map(opt => (
                                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                  </select>
                                </div>

                                <div className="space-y-2">
                                  <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                                    Frame Gen Output
                                  </label>
                                  <select
                                    value={config.fg_output || "auto"}
                                    onChange={(e) => handleConfigChange(gameId, "fg_output", e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg text-sm"
                                    style={{
                                      background: "oklch(100% 0 0 / 0.05)",
                                      border: "1px solid oklch(100% 0 0 / 0.08)",
                                      color: "var(--color-text-primary)",
                                      outline: "none",
                                    }}
                                  >
                                    {fgOutputOptions.map(opt => (
                                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              {/* Toggles */}
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={config.fg_enabled || false}
                                    onChange={(e) => handleConfigChange(gameId, "fg_enabled", e.target.checked)}
                                    className="w-4 h-4 rounded accent-[oklch(0.65_0.25_275)]"
                                  />
                                  <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>Enable Frame Gen</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={config.dxgi_spoofing !== false}
                                    onChange={(e) => handleConfigChange(gameId, "dxgi_spoofing", e.target.checked)}
                                    className="w-4 h-4 rounded accent-[oklch(0.65_0.25_275)]"
                                  />
                                  <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>DXGI Spoofing</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={config.opti_fg_hudfix !== false}
                                    onChange={(e) => handleConfigChange(gameId, "opti_fg_hudfix", e.target.checked)}
                                    className="w-4 h-4 rounded accent-[oklch(0.65_0.25_275)]"
                                  />
                                  <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>FG HUD Fix</span>
                                </label>
                              </div>

                              {/* Advanced Settings */}
                              <motion.button
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer w-full sm:w-auto"
                                style={{
                                  background: "oklch(100% 0 0 / 0.05)",
                                  color: "var(--color-text-secondary)",
                                  border: "1px solid oklch(100% 0 0 / 0.08)",
                                  outline: "none",
                                }}
                                whileHover={{ backgroundColor: "oklch(100% 0 0 / 0.1)" }}
                              >
                                <Info size={14} />
                                {showAdvanced ? "Hide Advanced" : "Show Advanced Settings"}
                                <motion.span
                                  animate={{ rotate: showAdvanced ? 180 : 0 }}
                                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                >
                                  <ChevronDown size={12} />
                                </motion.span>
                              </motion.button>

                              <AnimatePresence>
                                {showAdvanced && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="space-y-4 pt-2 border-t"
                                    style={{ borderColor: "oklch(100% 0 0 / 0.06)" }}
                                  >
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                        <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                                          Output Scaling
                                        </label>
                                        <input
                                          type="number"
                                          step="0.01"
                                          min="0.5"
                                          max="2.0"
                                          value={config.output_scaling || 1.0}
                                          onChange={(e) => handleConfigChange(gameId, "output_scaling", parseFloat(e.target.value))}
                                          className="w-full px-3 py-2 rounded-lg text-sm"
                                          style={{
                                            background: "oklch(100% 0 0 / 0.05)",
                                            border: "1px solid oklch(100% 0 0 / 0.08)",
                                            color: "var(--color-text-primary)",
                                            outline: "none",
                                          }}
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                                          Motion Sharpness
                                        </label>
                                        <input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          max="1.0"
                                          value={config.motion_sharpness || 0}
                                          onChange={(e) => handleConfigChange(gameId, "motion_sharpness", parseFloat(e.target.value))}
                                          className="w-full px-3 py-2 rounded-lg text-sm"
                                          style={{
                                            background: "oklch(100% 0 0 / 0.05)",
                                            border: "1px solid oklch(100% 0 0 / 0.08)",
                                            color: "var(--color-text-primary)",
                                            outline: "none",
                                          }}
                                        />
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                      <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={config.latflex || false}
                                          onChange={(e) => handleConfigChange(gameId, "latflex", e.target.checked)}
                                          className="w-4 h-4 rounded accent-[oklch(0.65_0.25_275)]"
                                        />
                                        <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>Latflex</span>
                                      </label>
                                      <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={config.reflex_to_anti_lag2 || false}
                                          onChange={(e) => handleConfigChange(gameId, "reflex_to_anti_lag2", e.target.checked)}
                                          className="w-4 h-4 rounded accent-[oklch(0.65_0.25_275)]"
                                        />
                                        <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>Reflex→Anti-Lag2</span>
                                      </label>
                                      <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={config.fake_nvapi || false}
                                          onChange={(e) => handleConfigChange(gameId, "fake_nvapi", e.target.checked)}
                                          className="w-4 h-4 rounded accent-[oklch(0.65_0.25_275)]"
                                        />
                                        <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>Fake NVAPI</span>
                                      </label>
                                      <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={config.dlssg_to_fsr3 || false}
                                          onChange={(e) => handleConfigChange(gameId, "dlssg_to_fsr3", e.target.checked)}
                                          className="w-4 h-4 rounded accent-[oklch(0.65_0.25_275)]"
                                        />
                                        <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>DLSSG→FSR3</span>
                                      </label>
                                      <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={config.opti_patcher || false}
                                          onChange={(e) => handleConfigChange(gameId, "opti_patcher", e.target.checked)}
                                          className="w-4 h-4 rounded accent-[oklch(0.65_0.25_275)]"
                                        />
                                        <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>OptiPatcher</span>
                                      </label>
                                      <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={config.load_asi_plugins || false}
                                          onChange={(e) => handleConfigChange(gameId, "load_asi_plugins", e.target.checked)}
                                          className="w-4 h-4 rounded accent-[oklch(0.65_0.25_275)]"
                                        />
                                        <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>Load ASI Plugins</span>
                                      </label>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                        <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                                          Custom Resolution
                                        </label>
                                        <input
                                          type="text"
                                          placeholder="e.g., 1920x1080"
                                          value={config.custom_resolution || ""}
                                          onChange={(e) => handleConfigChange(gameId, "custom_resolution", e.target.value || null)}
                                          className="w-full px-3 py-2 rounded-lg text-sm"
                                          style={{
                                            background: "oklch(100% 0 0 / 0.05)",
                                            border: "1px solid oklch(100% 0 0 / 0.08)",
                                            color: "var(--color-text-primary)",
                                            outline: "none",
                                          }}
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <label className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                                          FPS Limit
                                        </label>
                                        <input
                                          type="number"
                                          min="30"
                                          max="500"
                                          value={config.fps_limit || ""}
                                          onChange={(e) => handleConfigChange(gameId, "fps_limit", e.target.value ? parseInt(e.target.value) : null)}
                                          className="w-full px-3 py-2 rounded-lg text-sm"
                                          style={{
                                            background: "oklch(100% 0 0 / 0.05)",
                                            border: "1px solid oklch(100% 0 0 / 0.08)",
                                            color: "var(--color-text-primary)",
                                            outline: "none",
                                          }}
                                        />
                                      </div>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </>
            )}
          </div>
        </motion.section>

        {/* Version info */}
        <motion.div
          variants={itemVariants}
          className="text-center pt-4"
        >
          <p className="text-[10px] font-medium" style={{ color: "var(--color-text-muted)" }}>
            OptiScaler by <a href="https://github.com/optiscaler/OptiScaler" target="_blank" rel="noopener noreferrer" style={{ color: "oklch(0.75 0.12 85)" }}>optiscaler/OptiScaler</a> · Integrated in Lumen
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}