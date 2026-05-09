import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { BarChart3, Gamepad2, Clock, Layers } from "lucide-react";
import type { Game } from "../data/mockGames";

export default function Stats() {
  const [games, setGames] = useState<Game[]>([]);

  const fetchGames = useCallback(async () => {
    try {
      if (window.__TAURI_INTERNALS__ || ('__TAURI_IPC__' in window)) {
        const fetched = await invoke<Game[]>('scan_local_games');
        setGames(fetched || []);
      }
    } catch (err) {
      console.warn("Failed to fetch games for stats:", err);
    }
  }, []);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  const totalGames = games.length;
  const steamGames = games.filter(g => g.platform === "steam").length;
  const epicGames = games.filter(g => g.platform === "epic").length;
  const localGames = games.filter(g => g.platform === "local").length;
  const totalHours = games.reduce((sum, g) => sum + (g.hoursPlayed || 0), 0);

  const statCards = [
    {
      label: "Total Games",
      value: totalGames,
      icon: Gamepad2,
      color: "oklch(0.7 0.2 275)",
      glow: "oklch(0.65 0.25 275 / 0.2)",
    },
    {
      label: "Total Playtime",
      value: `${totalHours.toFixed(0)}h`,
      icon: Clock,
      color: "oklch(0.75 0.15 155)",
      glow: "oklch(0.75 0.15 155 / 0.2)",
    },
    {
      label: "Platforms",
      value: [steamGames > 0, epicGames > 0, localGames > 0].filter(Boolean).length,
      icon: Layers,
      color: "oklch(0.75 0.15 55)",
      glow: "oklch(0.75 0.15 55 / 0.2)",
    },
  ];

  const platformBreakdown = [
    { label: "Steam", count: steamGames, pct: totalGames > 0 ? (steamGames / totalGames) * 100 : 0, color: "oklch(0.7 0.15 215)" },
    { label: "Epic", count: epicGames, pct: totalGames > 0 ? (epicGames / totalGames) * 100 : 0, color: "oklch(0.75 0.12 85)" },
    { label: "Local", count: localGames, pct: totalGames > 0 ? (localGames / totalGames) * 100 : 0, color: "oklch(0.7 0.1 155)" },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 200, damping: 20 } },
  };

  return (
    <div className="flex-1 overflow-y-auto px-5 pb-8 pt-2">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 size={18} style={{ color: "oklch(0.7 0.15 275)" }} />
          <h1 className="text-xl font-bold" style={{ color: "var(--color-text-primary)" }}>
            Statistics
          </h1>
        </div>
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          Overview of your gaming library
        </p>
      </motion.div>

      <motion.div
        className="space-y-5 max-w-3xl"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* Stat Cards */}
        <motion.div variants={itemVariants} className="grid grid-cols-3 gap-3">
          {statCards.map((stat) => (
            <motion.div
              key={stat.label}
              className="p-4 rounded-xl flex flex-col gap-2"
              style={{
                background: "oklch(100% 0 0 / 0.03)",
                border: "1px solid oklch(100% 0 0 / 0.08)",
                boxShadow: `0 0 20px ${stat.glow}`,
              }}
              whileHover={{
                borderColor: "oklch(100% 0 0 / 0.15)",
                boxShadow: `0 0 30px ${stat.glow}`,
                y: -2,
              }}
              transition={{ type: "spring" as const, stiffness: 300 }}
            >
              <stat.icon size={18} style={{ color: stat.color }} />
              <div className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>
                {stat.value}
              </div>
              <div className="text-[11px] font-medium" style={{ color: "var(--color-text-muted)" }}>
                {stat.label}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Platform Breakdown */}
        <motion.div
          variants={itemVariants}
          className="p-5 rounded-xl"
          style={{
            background: "oklch(100% 0 0 / 0.03)",
            border: "1px solid oklch(100% 0 0 / 0.08)",
          }}
        >
          <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--color-text-secondary)" }}>
            Platform Breakdown
          </h2>
          <div className="space-y-3">
            {platformBreakdown.map((plat) => (
              <div key={plat.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>
                    {plat.label}
                  </span>
                  <span className="text-[11px] font-bold" style={{ color: plat.color }}>
                    {plat.count} ({Math.round(plat.pct)}%)
                  </span>
                </div>
                <div
                  className="h-2 rounded-full overflow-hidden"
                  style={{ background: "oklch(100% 0 0 / 0.06)" }}
                >
                  <motion.div
                    className="h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${plat.pct}%` }}
                    transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
                    style={{ background: plat.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Top Games (by hours) */}
        <motion.div
          variants={itemVariants}
          className="p-5 rounded-xl"
          style={{
            background: "oklch(100% 0 0 / 0.03)",
            border: "1px solid oklch(100% 0 0 / 0.08)",
          }}
        >
          <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--color-text-secondary)" }}>
            Library Overview
          </h2>
          {games.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>No games detected yet.</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {games.slice(0, 10).map((game, i) => (
                <motion.div
                  key={game.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg"
                  style={{
                    background: "oklch(100% 0 0 / 0.03)",
                    border: "1px solid oklch(100% 0 0 / 0.05)",
                  }}
                  whileHover={{ borderColor: "oklch(100% 0 0 / 0.12)" }}
                >
                  <span className="text-[10px] font-bold w-5 text-center" style={{ color: "var(--color-text-muted)" }}>
                    {i + 1}
                  </span>
                  <div
                    className="w-8 h-8 rounded-md overflow-hidden shrink-0"
                    style={{ background: "oklch(0.15 0.03 275)" }}
                  >
                    <img
                      src={game.coverUrl}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: "var(--color-text-primary)" }}>
                      {game.title}
                    </p>
                    <p className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                      {game.platform}
                    </p>
                  </div>
                  <span className="text-[11px] font-semibold shrink-0" style={{ color: "oklch(0.7 0.15 275)" }}>
                    {game.hoursPlayed > 0 ? `${game.hoursPlayed.toFixed(1)}h` : "—"}
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}
