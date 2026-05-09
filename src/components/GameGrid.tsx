import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { Plus, RefreshCw, Gamepad2 } from "lucide-react";
import GameCard from "./GameCard";
import type { Game } from "../data/mockGames";

interface GameGridProps {
  games?: Game[];
  onGameClick: (game: Game) => void;
}

export default function GameGrid({ onGameClick }: GameGridProps) {
  const [localGames, setLocalGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchLocalGames = useCallback(async () => {
    try {
      if (window.__TAURI_INTERNALS__ || ('__TAURI_IPC__' in window)) {
         const fetchedGames = await invoke<Game[]>('scan_local_games');
         setLocalGames(fetchedGames || []);
      }
    } catch (err) {
      console.warn("Failed to scan local games:", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLocalGames();
    
    const handleRefresh = () => fetchLocalGames();
    window.addEventListener('refresh-games', handleRefresh);
    return () => window.removeEventListener('refresh-games', handleRefresh);
  }, [fetchLocalGames]);
  
  const handleAddGame = async () => {
    try {
      const selectedPath = await openDialog({
        multiple: false,
        filters: [{
          name: 'Game Executables',
          extensions: ['exe', 'bat', 'url']
        }]
      });
      
      if (selectedPath && typeof selectedPath === 'string') {
        const gameName = prompt("Enter a name for this game:");
        if (gameName) {
           await invoke('add_custom_game', { name: gameName, path: selectedPath });
           await fetchLocalGames();
        }
      }
    } catch (err) {
      console.error("Failed to add custom game", err);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchLocalGames();
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        >
          <Gamepad2 size={36} style={{ color: "oklch(0.6 0.15 275)" }} />
        </motion.div>
        <p className="text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
          Scanning for games...
        </p>
      </div>
    );
  }

  const steamCount = localGames.filter(g => g.platform === "steam").length;
  const epicCount = localGames.filter(g => g.platform === "epic").length;
  const localCount = localGames.filter(g => g.platform === "local").length;

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 pb-6 pt-2">
      {/* Header with stats */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1
            className="text-xl font-bold"
            style={{ color: "var(--color-text-primary)" }}
          >
            Your Library
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
              {localGames.length} games
            </span>
            {steamCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ background: "oklch(0.7 0.15 215 / 0.15)", color: "oklch(0.7 0.15 215)" }}>
                {steamCount} Steam
              </span>
            )}
            {epicCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ background: "oklch(0.75 0.12 85 / 0.15)", color: "oklch(0.75 0.12 85)" }}>
                {epicCount} Epic
              </span>
            )}
            {localCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ background: "oklch(0.7 0.1 155 / 0.15)", color: "oklch(0.7 0.1 155)" }}>
                {localCount} Local
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Refresh button */}
          <motion.button
            onClick={handleRefresh}
            className="flex items-center justify-center w-8 h-8 rounded-lg cursor-pointer"
            style={{
              background: "oklch(100% 0 0 / 0.05)",
              border: "1px solid oklch(100% 0 0 / 0.08)",
              color: "var(--color-text-secondary)",
            }}
            whileHover={{ backgroundColor: "oklch(100% 0 0 / 0.1)" }}
            whileTap={{ scale: 0.92 }}
            title="Refresh Library"
          >
            <motion.div
              animate={isRefreshing ? { rotate: 360 } : { rotate: 0 }}
              transition={isRefreshing ? { duration: 0.8, repeat: Infinity, ease: "linear" } : {}}
            >
              <RefreshCw size={14} />
            </motion.div>
          </motion.button>

          {/* Add game */}
          <motion.button
            onClick={handleAddGame}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer"
            style={{
              background: "linear-gradient(135deg, oklch(0.65 0.25 275), oklch(0.7 0.2 310))",
              color: "white",
              boxShadow: "0 2px 12px oklch(0.65 0.25 275 / 0.3)",
            }}
            whileHover={{ scale: 1.04, boxShadow: "0 4px 20px oklch(0.65 0.25 275 / 0.5)" }}
            whileTap={{ scale: 0.96 }}
          >
            <Plus size={14} strokeWidth={2.5} />
            Add Game
          </motion.button>
        </div>
      </div>

      {/* Empty state */}
      {localGames.length === 0 ? (
        <motion.div
          className="flex flex-col items-center justify-center py-20 gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Gamepad2 size={48} style={{ color: "oklch(0.4 0.1 275)" }} />
          <p className="text-base font-semibold" style={{ color: "var(--color-text-secondary)" }}>
            No games found
          </p>
          <p className="text-xs max-w-sm text-center" style={{ color: "var(--color-text-muted)" }}>
            Click "Add Game" to manually add a game executable, or check your Steam/Epic installations.
          </p>
        </motion.div>
      ) : (
        <motion.div
          className="grid gap-4"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(165px, 1fr))",
          }}
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: {
              transition: {
                staggerChildren: 0.03,
              },
            },
          }}
        >
          {localGames.map((game, index) => (
            <GameCard key={game.id} game={game} index={index} onClick={onGameClick} />
          ))}
        </motion.div>
      )}
    </div>
  );
}
