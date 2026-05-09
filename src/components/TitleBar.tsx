import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Minus, Square, X, Copy, Gamepad2 } from "lucide-react";

export default function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);

  // Sync maximized state on mount and on resize
  const syncMaxState = useCallback(async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const win = getCurrentWindow();
      const m = await win.isMaximized();
      setIsMaximized(m);
    } catch {}
  }, []);

  useEffect(() => {
    syncMaxState();
    window.addEventListener("resize", syncMaxState);
    return () => window.removeEventListener("resize", syncMaxState);
  }, [syncMaxState]);

  const handleMinimize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().minimize();
    } catch (err) {
      console.error("Minimize failed:", err);
    }
  };

  const handleMaximize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const win = getCurrentWindow();
      const maximized = await win.isMaximized();
      if (maximized) {
        await win.unmaximize();
        setIsMaximized(false);
      } else {
        await win.maximize();
        setIsMaximized(true);
      }
    } catch (err) {
      console.error("Maximize failed:", err);
    }
  };

  const handleClose = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().close();
    } catch (err) {
      console.error("Close failed:", err);
    }
  };

  const controls = [
    {
      id: "minimize",
      icon: Minus,
      action: handleMinimize,
      hoverBg: "oklch(0.75 0.15 275 / 0.2)",
      hoverBorder: "oklch(0.65 0.25 275 / 0.3)",
      hoverColor: "oklch(0.85 0.1 275)",
      tooltip: "Minimize",
    },
    {
      id: "maximize",
      icon: isMaximized ? Copy : Square,
      action: handleMaximize,
      hoverBg: "oklch(0.75 0.12 155 / 0.2)",
      hoverBorder: "oklch(0.65 0.2 155 / 0.3)",
      hoverColor: "oklch(0.85 0.08 155)",
      tooltip: isMaximized ? "Restore" : "Maximize",
    },
    {
      id: "close",
      icon: X,
      action: handleClose,
      hoverBg: "oklch(0.55 0.25 25 / 0.85)",
      hoverBorder: "oklch(0.65 0.3 25 / 0.5)",
      hoverColor: "oklch(0.98 0 0)",
      tooltip: "Close",
    },
  ];

  return (
    <div
      id="titlebar"
      className="flex items-center h-11 select-none shrink-0 relative"
      style={{
        background: "oklch(0.1 0.02 280 / 0.3)",
        backdropFilter: "blur(40px) saturate(1.5)",
        borderBottom: "1px solid oklch(100% 0 0 / 0.06)",
      }}
    >
      {/* Drag region — fills entire titlebar, sits BEHIND buttons */}
      <div
        className="absolute inset-0"
        style={{ zIndex: 0 }}
        data-tauri-drag-region
      />

      {/* App branding */}
      <div
        className="flex items-center gap-2.5 shrink-0 pointer-events-none pl-4"
        style={{ zIndex: 1 }}
      >
        <motion.div
          className="w-5 h-5 rounded-md flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, oklch(0.65 0.25 275), oklch(0.7 0.2 310))",
            boxShadow: "0 0 12px oklch(0.65 0.25 275 / 0.4)",
          }}
          whileHover={{ scale: 1.1 }}
        >
          <Gamepad2 size={11} className="text-white" />
        </motion.div>
        <span
          className="text-xs font-semibold tracking-wider uppercase"
          style={{ color: "oklch(0.65 0 0)" }}
        >
          Lumen
        </span>
      </div>

      <div className="flex-1" />

      {/* ── Window Controls ── */}
      <div
        className="flex items-center shrink-0 h-full"
        style={{
          zIndex: 10,
          position: "relative",
        }}
      >
        {controls.map((ctrl) => {
          const isHovered = hoveredBtn === ctrl.id;
          const isClose = ctrl.id === "close";
          return (
            <motion.button
              key={ctrl.id}
              onClick={ctrl.action}
              onMouseEnter={() => setHoveredBtn(ctrl.id)}
              onMouseLeave={() => setHoveredBtn(null)}
              type="button"
              className="relative flex items-center justify-center cursor-pointer"
              style={{
                width: 46,
                height: "100%",
                background: "transparent",
                border: "none",
                outline: "none",
              }}
              animate={{
                backgroundColor: isHovered ? ctrl.hoverBg : "transparent",
              }}
              whileTap={{ scale: 0.88 }}
              transition={{ duration: 0.15 }}
              title={ctrl.tooltip}
            >
              {/* Icon */}
              <motion.div
                animate={{
                  color: isHovered ? ctrl.hoverColor : "oklch(0.6 0 0)",
                  scale: isHovered ? 1.15 : 1,
                }}
                transition={{ type: "spring" as const, stiffness: 400, damping: 20 }}
              >
                <ctrl.icon
                  size={isClose ? 15 : 13}
                  strokeWidth={isClose ? 2 : 1.8}
                />
              </motion.div>

              {/* Bottom glow bar on hover */}
              <motion.div
                className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-t-full"
                animate={{
                  width: isHovered ? 20 : 0,
                  height: isHovered ? 2 : 0,
                  opacity: isHovered ? 1 : 0,
                }}
                transition={{ duration: 0.2 }}
                style={{
                  background: isClose
                    ? "oklch(0.7 0.3 25)"
                    : ctrl.id === "maximize"
                    ? "oklch(0.7 0.2 155)"
                    : "oklch(0.7 0.25 275)",
                  boxShadow: isClose
                    ? "0 0 8px oklch(0.7 0.3 25 / 0.6)"
                    : ctrl.id === "maximize"
                    ? "0 0 8px oklch(0.7 0.2 155 / 0.6)"
                    : "0 0 8px oklch(0.7 0.25 275 / 0.6)",
                }}
              />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
