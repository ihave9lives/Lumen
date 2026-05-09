import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cpu, Monitor, MemoryStick } from "lucide-react";
import { listen } from "@tauri-apps/api/event";

interface PerformanceMetrics {
  cpu_usage: number;
  ram_usage: number;
  gpu_usage: number;
}

interface PerformanceOverlayProps {
  isVisible: boolean;
}

export default function PerformanceOverlay({ isVisible }: PerformanceOverlayProps) {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    cpu_usage: 0,
    ram_usage: 0,
    gpu_usage: 0,
  });

  useEffect(() => {
    let unlisten: () => void;

    const setupListener = async () => {
      try {
        if (window.__TAURI_INTERNALS__ || ('__TAURI_IPC__' in window)) {
          unlisten = await listen<PerformanceMetrics>("performance_metrics", (event) => {
            setMetrics(event.payload);
          });
        }
      } catch (err) {
        console.error("Failed to setup performance listener:", err);
      }
    };

    if (isVisible) {
      setupListener();
    }

    return () => {
      if (unlisten) unlisten();
    };
  }, [isVisible]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="fixed top-6 right-6 z-50 p-4 rounded-2xl select-none"
          style={{
            background: "oklch(0.1 0.02 280 / 0.85)",
            backdropFilter: "blur(12px)",
            border: "1px solid oklch(100% 0 0 / 0.1)",
            boxShadow: "0 8px 32px oklch(0 0 0 / 0.3)",
          }}
        >
          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "var(--color-text-secondary)" }}>
              System Performance
            </h3>

            {/* CPU */}
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg" style={{ background: "oklch(0.6 0.2 250 / 0.15)", color: "oklch(0.6 0.2 250)" }}>
                <Cpu size={14} />
              </div>
              <div className="flex-1 w-24">
                <div className="flex justify-between text-xs mb-1">
                  <span style={{ color: "var(--color-text-primary)" }}>CPU</span>
                  <span className="font-mono">{metrics.cpu_usage.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "oklch(100% 0 0 / 0.1)" }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: "oklch(0.6 0.2 250)" }}
                    animate={{ width: `${metrics.cpu_usage}%` }}
                    transition={{ ease: "linear", duration: 0.5 }}
                  />
                </div>
              </div>
            </div>

            {/* RAM */}
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg" style={{ background: "oklch(0.6 0.2 150 / 0.15)", color: "oklch(0.6 0.2 150)" }}>
                <MemoryStick size={14} />
              </div>
              <div className="flex-1 w-24">
                <div className="flex justify-between text-xs mb-1">
                  <span style={{ color: "var(--color-text-primary)" }}>RAM</span>
                  <span className="font-mono">{metrics.ram_usage.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "oklch(100% 0 0 / 0.1)" }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: "oklch(0.6 0.2 150)" }}
                    animate={{ width: `${metrics.ram_usage}%` }}
                    transition={{ ease: "linear", duration: 0.5 }}
                  />
                </div>
              </div>
            </div>

            {/* GPU */}
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg" style={{ background: "oklch(0.6 0.2 30 / 0.15)", color: "oklch(0.6 0.2 30)" }}>
                <Monitor size={14} />
              </div>
              <div className="flex-1 w-24">
                <div className="flex justify-between text-xs mb-1">
                  <span style={{ color: "var(--color-text-primary)" }}>GPU</span>
                  <span className="font-mono">{metrics.gpu_usage.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "oklch(100% 0 0 / 0.1)" }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: "oklch(0.6 0.2 30)" }}
                    animate={{ width: `${Math.min(100, Math.max(0, metrics.gpu_usage))}%` }}
                    transition={{ ease: "linear", duration: 0.5 }}
                  />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
