import GameGrid from "../components/GameGrid";
import type { Game } from "../data/mockGames";

export default function Library({ onGameClick }: { onGameClick: (game: Game) => void }) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Top bar with greeting */}
      <div className="flex items-center justify-between px-5 h-14 shrink-0">
        <div>
          <h2 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            Good evening, Player
          </h2>
          <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
      </div>

      <GameGrid onGameClick={onGameClick} />
    </div>
  );
}
