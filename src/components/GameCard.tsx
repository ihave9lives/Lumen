import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Trophy, Play, Monitor, Gamepad2 } from "lucide-react";
import type { Game } from "../data/mockGames";

interface GameCardProps {
  game: Game;
  index: number;
  onClick?: (game: Game) => void;
}

const platformBadge: Record<string, { label: string; color: string; glow: string }> = {
  steam: { label: "Steam", color: "oklch(0.7 0.15 215)", glow: "oklch(0.7 0.15 215 / 0.3)" },
  epic: { label: "Epic", color: "oklch(0.75 0.12 85)", glow: "oklch(0.75 0.12 85 / 0.3)" },
  local: { label: "Local", color: "oklch(0.7 0.1 155)", glow: "oklch(0.7 0.1 155 / 0.3)" },
};

export default function GameCard({ game, index, onClick }: GameCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const progress = game.hltbMain > 0 ? Math.min((game.hoursPlayed / game.hltbMain) * 100, 100) : 0;
  const badge = platformBadge[game.platform] || platformBadge.local;
  const isIconCover = game.coverUrl?.startsWith("data:");

  return (
    <motion.div
      className="relative rounded-xl overflow-hidden cursor-pointer group"
      style={{ aspectRatio: "2 / 3" }}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        type: "spring" as const,
        stiffness: 260,
        damping: 20,
        delay: index * 0.04,
      }}
      whileHover={{ scale: 1.04, y: -6 }}
      whileTap={{ scale: 0.98 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={() => onClick?.(game)}
    >
      {/* Cover Image */}
      <div className="absolute inset-0">
        {!imgLoaded && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, oklch(0.15 0.04 275), oklch(0.12 0.02 310))",
            }}
          >
            <motion.div
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <Gamepad2 size={32} style={{ color: "oklch(0.4 0.1 275)" }} />
            </motion.div>
          </div>
        )}
        {!imgError ? (
          isIconCover ? (
            /* Icon-based cover: centered on gradient, NOT stretched */
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{
                background: "linear-gradient(145deg, oklch(0.16 0.06 275 / 0.9), oklch(0.1 0.04 310 / 0.9), oklch(0.08 0.03 240 / 0.9))",
              }}
            >
              <motion.img
                src={game.coverUrl}
                alt={game.title}
                className="transition-transform duration-500 ease-out"
                style={{
                  width: "55%",
                  height: "55%",
                  objectFit: "contain",
                  transform: isHovered ? "scale(1.15)" : "scale(1)",
                  opacity: imgLoaded ? 1 : 0,
                  filter: "drop-shadow(0 4px 24px oklch(0 0 0 / 0.5))",
                  imageRendering: "auto",
                }}
                onLoad={() => setImgLoaded(true)}
                onError={() => setImgError(true)}
                loading="lazy"
              />
            </div>
          ) : (
            /* HTTP cover art: fills the card */
            <img
              src={game.coverUrl}
              alt={game.title}
              className="w-full h-full object-cover transition-transform duration-700 ease-out"
              style={{
                transform: isHovered ? "scale(1.1)" : "scale(1)",
                opacity: imgLoaded ? 1 : 0,
              }}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
              loading="lazy"
            />
          )
        ) : (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2"
            style={{
              background: "linear-gradient(135deg, oklch(0.15 0.06 275), oklch(0.1 0.04 310))",
            }}
          >
            <Gamepad2 size={36} style={{ color: "oklch(0.45 0.15 275)" }} />
            <span className="text-[10px] font-medium" style={{ color: "oklch(0.5 0.05 275)" }}>
              {game.title.slice(0, 16)}
            </span>
          </div>
        )}
      </div>

      {/* Permanent bottom gradient */}
      <div
        className="absolute inset-x-0 bottom-0 h-2/3 pointer-events-none"
        style={{
          background: "linear-gradient(to top, oklch(0.06 0.02 280 / 0.95) 0%, oklch(0.08 0.02 280 / 0.4) 50%, transparent 100%)",
        }}
      />

      {/* Platform badge */}
      <div className="absolute top-2.5 right-2.5 z-20">
        <motion.div
          className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider"
          style={{
            background: "oklch(0.08 0 0 / 0.7)",
            backdropFilter: "blur(8px)",
            border: `1px solid ${badge.color}50`,
            color: badge.color,
            boxShadow: `0 0 8px ${badge.glow}`,
          }}
          animate={{
            borderColor: isHovered ? `${badge.color}80` : `${badge.color}40`,
          }}
        >
          {badge.label}
        </motion.div>
      </div>

      {/* Title overlay (always visible at bottom) */}
      <motion.div
        className="absolute bottom-0 inset-x-0 p-3 z-10"
        animate={{ opacity: isHovered ? 0 : 1, y: isHovered ? 4 : 0 }}
        transition={{ duration: 0.15 }}
      >
        <h3
          className="text-sm font-semibold leading-tight truncate"
          style={{ color: "var(--color-text-primary)" }}
        >
          {game.title}
        </h3>
        <p className="text-[11px] mt-0.5 font-medium" style={{ color: "var(--color-text-secondary)" }}>
          {game.hoursPlayed > 0 ? `${game.hoursPlayed.toFixed(1)}h played` : "Not played yet"}
        </p>
      </motion.div>

      {/* Hover overlay — clean gradient, no blur */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-20 flex flex-col justify-end p-4"
            style={{
              background: "linear-gradient(to top, oklch(0.04 0.02 280 / 0.97) 0%, oklch(0.08 0.02 280 / 0.85) 40%, oklch(0.1 0.02 280 / 0.3) 70%, transparent 100%)",
            }}
          >
            {/* Title */}
            <motion.h3
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.04 }}
              className="text-base font-bold leading-tight mb-2"
              style={{ color: "var(--color-text-primary)" }}
            >
              {game.title}
            </motion.h3>

            {/* Stats Row */}
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.08 }}
              className="flex flex-col gap-1.5"
            >
              <div className="flex items-center gap-2">
                <Clock size={12} style={{ color: "oklch(0.7 0.15 275)" }} />
                <span className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>Played</span>
                <span className="text-[11px] font-semibold ml-auto" style={{ color: "var(--color-text-primary)" }}>
                  {game.hoursPlayed.toFixed(1)}h
                </span>
              </div>
              {game.hltbMain > 0 && (
                <div className="flex items-center gap-2">
                  <Monitor size={12} style={{ color: "oklch(0.7 0.15 155)" }} />
                  <span className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>Main Story</span>
                  <span className="text-[11px] font-semibold ml-auto" style={{ color: "var(--color-text-primary)" }}>
                    {game.hltbMain}h
                  </span>
                </div>
              )}
              {game.hltbCompletionist > 0 && (
                <div className="flex items-center gap-2">
                  <Trophy size={12} style={{ color: "oklch(0.75 0.15 55)" }} />
                  <span className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>100%</span>
                  <span className="text-[11px] font-semibold ml-auto" style={{ color: "var(--color-text-primary)" }}>
                    {game.hltbCompletionist}h
                  </span>
                </div>
              )}
            </motion.div>

            {/* Progress bar (only if meaningful) */}
            {game.hltbMain > 0 && (
              <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.12 }}
                className="mt-2.5"
              >
                <div
                  className="h-1 rounded-full overflow-hidden"
                  style={{ background: "oklch(100% 0 0 / 0.08)" }}
                >
                  <motion.div
                    className="h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
                    style={{
                      background: progress >= 100
                        ? "linear-gradient(90deg, oklch(0.7 0.2 155), oklch(0.75 0.15 145))"
                        : "linear-gradient(90deg, oklch(0.65 0.25 275), oklch(0.7 0.2 310))",
                    }}
                  />
                </div>
              </motion.div>
            )}

            {/* Play Button */}
            <motion.div
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.16 }}
              className="mt-3"
            >
              <button
                className="w-full h-8 rounded-lg flex items-center justify-center gap-2 text-xs font-bold transition-all duration-200"
                style={{
                  background: "linear-gradient(135deg, oklch(0.65 0.25 275), oklch(0.7 0.2 310))",
                  color: "white",
                  boxShadow: "0 4px 16px oklch(0.65 0.25 275 / 0.4)",
                }}
              >
                <Play size={11} fill="currentColor" />
                Play Now
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Glass border effect */}
      <motion.div
        className="absolute inset-0 rounded-xl pointer-events-none z-30"
        animate={{
          boxShadow: isHovered
            ? `inset 0 0 0 1px oklch(100% 0 0 / 0.2), 0 12px 40px oklch(0.65 0.25 275 / 0.2), 0 0 0 1px ${badge.color}30`
            : "inset 0 0 0 1px oklch(100% 0 0 / 0.08), 0 2px 8px oklch(0 0 0 / 0.2)",
        }}
        transition={{ duration: 0.25 }}
      />
    </motion.div>
  );
}
