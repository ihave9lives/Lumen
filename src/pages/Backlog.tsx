import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { ListChecks, Plus, X, Gamepad2 } from "lucide-react";
import type { Game } from "../data/mockGames";

interface BacklogItem {
  id: string;
  title: string;
  priority: "high" | "medium" | "low";
  added: string;
}

const priorityColors = {
  high: { bg: "oklch(0.5 0.2 20 / 0.15)", text: "oklch(0.75 0.18 20)", border: "oklch(0.6 0.2 20 / 0.3)" },
  medium: { bg: "oklch(0.5 0.15 55 / 0.15)", text: "oklch(0.8 0.13 55)", border: "oklch(0.6 0.15 55 / 0.3)" },
  low: { bg: "oklch(0.5 0.15 215 / 0.15)", text: "oklch(0.75 0.12 215)", border: "oklch(0.6 0.15 215 / 0.3)" },
};

export default function Backlog() {
  const [items, setItems] = useState<BacklogItem[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState("");
  const [selectedPriority, setSelectedPriority] = useState<"high" | "medium" | "low">("medium");

  const fetchGames = useCallback(async () => {
    try {
      if (window.__TAURI_INTERNALS__ || ('__TAURI_IPC__' in window)) {
        const fetched = await invoke<Game[]>('scan_local_games');
        setGames(fetched || []);
      }
    } catch (err) { /* silent */ }
  }, []);

  useEffect(() => { fetchGames(); }, [fetchGames]);

  const addItem = () => {
    const game = games.find(g => g.id === selectedGameId);
    if (!game) return;
    setItems(prev => [...prev, {
      id: game.id,
      title: game.title,
      priority: selectedPriority,
      added: new Date().toLocaleDateString(),
    }]);
    setShowAdd(false);
    setSelectedGameId("");
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.06 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <div className="flex-1 overflow-y-auto px-5 pb-8 pt-2">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ListChecks size={18} style={{ color: "oklch(0.7 0.15 275)" }} />
              <h1 className="text-xl font-bold" style={{ color: "var(--color-text-primary)" }}>
                Backlog
              </h1>
            </div>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              {items.length} games in your backlog
            </p>
          </div>
          <motion.button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer"
            style={{
              background: showAdd ? "oklch(100% 0 0 / 0.1)" : "linear-gradient(135deg, oklch(0.65 0.25 275), oklch(0.7 0.2 310))",
              color: "white",
              border: "none",
              outline: "none",
              boxShadow: showAdd ? "none" : "0 2px 12px oklch(0.65 0.25 275 / 0.3)",
            }}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
          >
            {showAdd ? <X size={14} /> : <Plus size={14} strokeWidth={2.5} />}
            {showAdd ? "Cancel" : "Add to Backlog"}
          </motion.button>
        </div>
      </motion.div>

      <motion.div
        className="max-w-2xl space-y-4"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* Add form */}
        <AnimatePresence>
          {showAdd && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div
                className="p-4 rounded-xl space-y-3"
                style={{
                  background: "oklch(100% 0 0 / 0.03)",
                  border: "1px solid oklch(0.65 0.25 275 / 0.2)",
                }}
              >
                <div>
                  <label className="text-[11px] font-semibold block mb-1.5" style={{ color: "var(--color-text-muted)" }}>
                    Select Game
                  </label>
                  <select
                    value={selectedGameId}
                    onChange={(e) => setSelectedGameId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-xs cursor-pointer"
                    style={{
                      background: "oklch(0.15 0.02 280)",
                      border: "1px solid oklch(100% 0 0 / 0.1)",
                      color: "var(--color-text-primary)",
                      outline: "none",
                    }}
                  >
                    <option value="">Choose a game...</option>
                    {games.filter(g => !items.find(item => item.id === g.id)).map(g => (
                      <option key={g.id} value={g.id}>{g.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold block mb-1.5" style={{ color: "var(--color-text-muted)" }}>
                    Priority
                  </label>
                  <div className="flex gap-2">
                    {(["high", "medium", "low"] as const).map(p => (
                      <motion.button
                        key={p}
                        onClick={() => setSelectedPriority(p)}
                        className="flex-1 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider cursor-pointer"
                        style={{
                          background: selectedPriority === p ? priorityColors[p].bg : "oklch(100% 0 0 / 0.04)",
                          border: selectedPriority === p ? `1px solid ${priorityColors[p].border}` : "1px solid oklch(100% 0 0 / 0.06)",
                          color: selectedPriority === p ? priorityColors[p].text : "var(--color-text-muted)",
                          outline: "none",
                        }}
                        whileTap={{ scale: 0.96 }}
                      >
                        {p}
                      </motion.button>
                    ))}
                  </div>
                </div>
                <motion.button
                  onClick={addItem}
                  disabled={!selectedGameId}
                  className="w-full py-2 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: "linear-gradient(135deg, oklch(0.65 0.25 275), oklch(0.7 0.2 310))",
                    color: "white",
                    border: "none",
                    outline: "none",
                  }}
                  whileHover={{ scale: selectedGameId ? 1.02 : 1 }}
                  whileTap={{ scale: selectedGameId ? 0.98 : 1 }}
                >
                  Add to Backlog
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Backlog list */}
        {items.length === 0 && !showAdd ? (
          <motion.div
            variants={itemVariants}
            className="flex flex-col items-center justify-center py-16 gap-3"
          >
            <Gamepad2 size={40} style={{ color: "oklch(0.35 0.08 275)" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--color-text-secondary)" }}>
              Your backlog is empty
            </p>
            <p className="text-xs text-center max-w-xs" style={{ color: "var(--color-text-muted)" }}>
              Add games from your library to keep track of what you want to play next.
            </p>
          </motion.div>
        ) : (
          <div className="space-y-2">
            {items.map((item, i) => {
              const pc = priorityColors[item.priority];
              return (
                <motion.div
                  key={item.id}
                  variants={itemVariants}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{
                    background: "oklch(100% 0 0 / 0.03)",
                    border: "1px solid oklch(100% 0 0 / 0.08)",
                  }}
                  whileHover={{ borderColor: "oklch(100% 0 0 / 0.15)", y: -1 }}
                  layout
                >
                  <span className="text-xs font-bold w-5 text-center" style={{ color: "var(--color-text-muted)" }}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--color-text-primary)" }}>
                      {item.title}
                    </p>
                    <p className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                      Added {item.added}
                    </p>
                  </div>
                  <span
                    className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase"
                    style={{ background: pc.bg, color: pc.text, border: `1px solid ${pc.border}` }}
                  >
                    {item.priority}
                  </span>
                  <motion.button
                    onClick={() => removeItem(item.id)}
                    className="p-1 rounded cursor-pointer"
                    style={{ background: "transparent", border: "none", outline: "none", color: "var(--color-text-muted)" }}
                    whileHover={{ color: "oklch(0.7 0.2 20)", scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <X size={14} />
                  </motion.button>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
