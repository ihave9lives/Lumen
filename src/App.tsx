import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Play, Trash2, Gamepad2 } from "lucide-react";
import { Routes, Route } from "react-router-dom";
import TitleBar from "./components/TitleBar";
import Sidebar from "./components/Sidebar";
import Library from "./pages/Library";
import Settings from "./pages/Settings";
import Stats from "./pages/Stats";
import Backlog from "./pages/Backlog";
import PerformanceOverlay from "./components/PerformanceOverlay";
import type { Game } from "./data/mockGames";
import { invoke } from "@tauri-apps/api/core";
import "./index.css";

const platformMap: Record<string, { label: string; color: string }> = {
  steam: { label: "Steam", color: "oklch(0.7 0.15 215)" },
  epic: { label: "Epic Games", color: "oklch(0.75 0.12 85)" },
  local: { label: "Local", color: "oklch(0.7 0.1 155)" },
};

function App() {
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);
  const [isOverlayVisible, setIsOverlayVisible] = useState(false);

  const bgStyle = useMemo(
    () => ({
      background: `
        radial-gradient(ellipse 80% 60% at 70% 20%, oklch(0.2 0.08 275 / 0.3), transparent),
        radial-gradient(ellipse 60% 50% at 20% 80%, oklch(0.18 0.06 310 / 0.2), transparent),
        radial-gradient(ellipse 50% 40% at 90% 70%, oklch(0.15 0.05 200 / 0.15), transparent)
      `,
    }),
    []
  );

  const handleLaunch = async (game: Game) => {
    setIsLaunching(true);
    try {
      if (window.__TAURI_INTERNALS__ || ('__TAURI_IPC__' in window)) {
        // Start performance monitor when game launches
        await invoke('toggle_performance_monitor', { enable: true });
        setIsOverlayVisible(true);

        await invoke('launch_game', {
          gameId: game.id,
          platform: game.platform,
          execPath: game.execPath || null,
          steamId: game.steamId || null,
        });
      }
      setSelectedGame(null);
    } catch (err) {
      console.error("Failed to launch game", err);
      alert(`Error launching ${game.title}: ${err}`);
    } finally {
      setIsLaunching(false);
    }
  };

  const handleRemove = async (game: Game) => {
    if (window.__TAURI_INTERNALS__ || ('__TAURI_IPC__' in window)) {
      await invoke('remove_game', { gameId: game.id });
      window.dispatchEvent(new CustomEvent('refresh-games'));
    }
    setSelectedGame(null);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden rounded-lg" style={bgStyle}>
      <TitleBar />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <PerformanceOverlay isVisible={isOverlayVisible} />

        <main className="flex-1 flex flex-col overflow-hidden relative">
          <Routes>
            <Route path="/" element={<Library onGameClick={setSelectedGame} />} />
            <Route path="/library" element={<Library onGameClick={setSelectedGame} />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/backlog" element={<Backlog />} />
          </Routes>
        </main>
      </div>

      {/* Game Detail Modal */}
      <AnimatePresence>
        {selectedGame && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              background: "oklch(0.05 0.02 280 / 0.7)",
              backdropFilter: "blur(12px)",
            }}
            onClick={() => setSelectedGame(null)}
          >
            <motion.div
              className="relative w-full max-w-lg rounded-2xl overflow-hidden"
              initial={{ scale: 0.92, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.92, y: 30, opacity: 0 }}
              transition={{ type: "spring" as const, damping: 25, stiffness: 300 }}
              style={{
                background: "oklch(0.14 0.03 280 / 0.95)",
                border: "1px solid oklch(100% 0 0 / 0.1)",
                boxShadow: "0 32px 80px oklch(0 0 0 / 0.5), 0 0 0 1px oklch(100% 0 0 / 0.05)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Cover art banner with gradient overlay */}
              <div className="relative h-36 overflow-hidden">
                <img
                  src={selectedGame.coverUrl}
                  alt=""
                  className="w-full h-full object-cover"
                  style={{ filter: "brightness(0.7)" }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background: "linear-gradient(to top, oklch(0.14 0.03 280 / 1) 0%, oklch(0.14 0.03 280 / 0.6) 50%, transparent 100%)",
                  }}
                />
                {/* Fallback icon when no image */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <Gamepad2 size={40} style={{ color: "oklch(0.4 0.1 275 / 0.5)" }} />
                </div>

                {/* Close button */}
                <motion.button
                  className="absolute top-3 right-3 p-1.5 rounded-full z-10"
                  style={{
                    background: "oklch(0 0 0 / 0.4)",
                    backdropFilter: "blur(8px)",
                    color: "white",
                    border: "none",
                    outline: "none",
                  }}
                  onClick={() => setSelectedGame(null)}
                  whileHover={{ scale: 1.1, backgroundColor: "oklch(0 0 0 / 0.6)" }}
                  whileTap={{ scale: 0.9 }}
                >
                  <X size={14} />
                </motion.button>
              </div>

              {/* Content */}
              <div className="px-6 pb-6 -mt-4 relative z-10">
                <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--color-text-primary)" }}>
                  {selectedGame.title}
                </h2>

                {/* Platform & Playtime Row */}
                <div className="flex items-center gap-2 mb-4">
                  <span
                    className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                    style={{
                      background: `${(platformMap[selectedGame.platform] || platformMap.local).color}20`,
                      color: (platformMap[selectedGame.platform] || platformMap.local).color,
                      border: `1px solid ${(platformMap[selectedGame.platform] || platformMap.local).color}30`,
                    }}
                  >
                    {(platformMap[selectedGame.platform] || platformMap.local).label}
                  </span>
                  <span className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                    •
                  </span>
                  <span className="text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>
                    {selectedGame.hoursPlayed > 0 ? `${selectedGame.hoursPlayed.toFixed(1)}h played` : "Not played yet"}
                  </span>
                </div>

                {/* Info text */}
                <p className="text-xs leading-relaxed mb-5" style={{ color: "var(--color-text-muted)" }}>
                  {selectedGame.platform === "steam"
                    ? `Launch via Steam (AppID: ${selectedGame.steamId})`
                    : selectedGame.platform === "epic"
                    ? "Launch via Epic Games Launcher"
                    : `Open from: ${selectedGame.execPath || "local directory"}`}
                </p>

                {/* Action buttons */}
                <div className="flex gap-2">
                  <motion.button
                    className="flex-1 h-11 rounded-xl font-bold flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    style={{
                      background: "linear-gradient(135deg, oklch(0.65 0.25 275), oklch(0.7 0.2 310))",
                      color: "white",
                      border: "none",
                      outline: "none",
                      boxShadow: "0 6px 24px oklch(0.65 0.25 275 / 0.35)",
                    }}
                    disabled={isLaunching}
                    onClick={() => handleLaunch(selectedGame)}
                    whileHover={{ scale: 1.02, boxShadow: "0 8px 32px oklch(0.65 0.25 275 / 0.5)" }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Play fill="currentColor" size={16} />
                    {isLaunching ? "Launching..." : "Play Now"}
                  </motion.button>

                  <motion.button
                    className="h-11 w-11 rounded-xl flex items-center justify-center cursor-pointer"
                    style={{
                      background: "oklch(100% 0 0 / 0.06)",
                      border: "1px solid oklch(100% 0 0 / 0.08)",
                      color: "oklch(0.6 0.15 20)",
                      outline: "none",
                    }}
                    onClick={() => handleRemove(selectedGame)}
                    title="Remove from Library"
                    whileHover={{
                      backgroundColor: "oklch(0.5 0.2 20 / 0.15)",
                      borderColor: "oklch(0.6 0.2 20 / 0.3)",
                      scale: 1.05,
                    }}
                    whileTap={{ scale: 0.92 }}
                  >
                    <Trash2 size={16} />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
