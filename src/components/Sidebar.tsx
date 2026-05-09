import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Gamepad2,
  LayoutGrid,
  Clock,
  BarChart3,
  Settings,
  ListChecks,
  ChevronLeft,
  Sparkles,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

interface NavItem {
  id: string;
  icon: React.ElementType;
  label: string;
}

const navItems: NavItem[] = [
  { id: "library", icon: LayoutGrid, label: "Library" },
  { id: "backlog", icon: ListChecks, label: "Backlog" },
  { id: "recent", icon: Clock, label: "Recently Played" },
  { id: "stats", icon: BarChart3, label: "Statistics" },
];

const bottomItems: NavItem[] = [
  { id: "settings", icon: Settings, label: "Settings" },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const currentPath = location.pathname.replace("/", "") || "library";

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 68 : 220 }}
      transition={{ type: "spring" as const, stiffness: 300, damping: 30 }}
      className="flex flex-col h-full shrink-0 relative z-10"
      style={{
        background: "oklch(0.1 0.02 280 / 0.35)",
        backdropFilter: "blur(40px) saturate(1.6)",
        borderRight: "1px solid oklch(100% 0 0 / 0.06)",
      }}
    >
      {/* Logo area */}
      <div
        className="shrink-0 flex items-center h-14"
        style={{
          justifyContent: collapsed ? "center" : "flex-start",
          paddingLeft: collapsed ? 0 : 16,
          paddingRight: collapsed ? 0 : 16,
        }}
      >
        <motion.div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{
            background: "linear-gradient(135deg, oklch(0.65 0.25 275), oklch(0.7 0.2 310))",
            boxShadow: "0 0 20px oklch(0.65 0.25 275 / 0.35)",
          }}
          whileHover={{
            boxShadow: "0 0 28px oklch(0.65 0.25 275 / 0.55)",
            scale: 1.08,
          }}
          transition={{ type: "spring" as const, stiffness: 400, damping: 20 }}
        >
          <Gamepad2 size={18} className="text-white" />
        </motion.div>
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="text-base font-bold tracking-wide ml-3"
              style={{ color: "var(--color-text-primary)" }}
            >
              Lumen
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Search placeholder */}
      <div style={{ padding: collapsed ? "0 8px" : "0 12px", marginBottom: 8 }}>
        <AnimatePresence mode="wait">
          {!collapsed ? (
            <motion.div
              key="search-expanded"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 px-3 h-8 rounded-lg text-xs"
              style={{
                background: "oklch(100% 0 0 / 0.05)",
                border: "1px solid oklch(100% 0 0 / 0.07)",
                color: "var(--color-text-muted)",
              }}
            >
              <Sparkles size={12} style={{ color: "oklch(0.7 0.15 275)" }} />
              <span>Search games...</span>
            </motion.div>
          ) : (
            <motion.div
              key="search-collapsed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center h-8 rounded-lg cursor-pointer"
              style={{
                background: "oklch(100% 0 0 / 0.05)",
                border: "1px solid oklch(100% 0 0 / 0.07)",
              }}
            >
              <Sparkles size={13} style={{ color: "oklch(0.6 0.1 275)" }} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav section label */}
      <AnimatePresence>
        {!collapsed && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: "var(--color-text-muted)" }}
          >
            Navigate
          </motion.p>
        )}
      </AnimatePresence>

      {/* Main navigation */}
      <nav className="flex-1 flex flex-col gap-1" style={{ padding: collapsed ? "0 8px" : "0 8px" }}>
        {navItems.map((item) => {
          const isActive = currentPath === item.id;
          const isHovered = hoveredId === item.id;
          return (
            <motion.button
              key={item.id}
              onClick={() => navigate(`/${item.id}`)}
              onMouseEnter={() => setHoveredId(item.id)}
              onMouseLeave={() => setHoveredId(null)}
              className="relative flex items-center rounded-lg cursor-pointer overflow-hidden"
              style={{
                height: 40,
                justifyContent: collapsed ? "center" : "flex-start",
                paddingLeft: collapsed ? 0 : 10,
                paddingRight: collapsed ? 0 : 10,
                background: isActive ? "oklch(100% 0 0 / 0.08)" : "transparent",
                border: "none",
                outline: "none",
                width: "100%",
              }}
              whileHover={{ backgroundColor: isActive ? "oklch(100% 0 0 / 0.1)" : "oklch(100% 0 0 / 0.06)" }}
              whileTap={{ scale: 0.97 }}
            >
              {/* Active indicator bar */}
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full"
                  style={{
                    width: 3,
                    height: 18,
                    background: "linear-gradient(180deg, oklch(0.65 0.25 275), oklch(0.7 0.2 310))",
                    boxShadow: "0 0 12px oklch(0.65 0.25 275 / 0.6)",
                  }}
                  transition={{ type: "spring" as const, stiffness: 400, damping: 30 }}
                />
              )}

              {/* Glow dot for active + collapsed  */}
              {isActive && collapsed && (
                <motion.div
                  className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full"
                  style={{
                    width: 4,
                    height: 4,
                    background: "oklch(0.7 0.25 275)",
                    boxShadow: "0 0 6px oklch(0.65 0.25 275 / 0.8)",
                  }}
                  animate={{ opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}

              <motion.div
                animate={{
                  color: isActive ? "oklch(0.8 0.15 275)" : isHovered ? "oklch(0.85 0.05 275)" : "oklch(0.6 0.01 275)",
                }}
                className="shrink-0 flex items-center justify-center"
                style={{ width: 20 }}
              >
                <item.icon size={18} strokeWidth={1.8} />
              </motion.div>

              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -5 }}
                    transition={{ duration: 0.12 }}
                    className="text-[13px] font-medium whitespace-nowrap ml-3"
                    style={{
                      color: isActive ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                    }}
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>

              {/* Tooltip on collapsed hover */}
              <AnimatePresence>
                {collapsed && isHovered && (
                  <motion.div
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -4 }}
                    transition={{ duration: 0.12 }}
                    className="absolute left-[calc(100%+8px)] z-50 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap pointer-events-none"
                    style={{
                      background: "oklch(0.18 0.04 280 / 0.95)",
                      border: "1px solid oklch(100% 0 0 / 0.12)",
                      color: "var(--color-text-primary)",
                      boxShadow: "0 4px 16px oklch(0 0 0 / 0.4)",
                    }}
                  >
                    {item.label}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="flex flex-col gap-1 pb-2" style={{ padding: collapsed ? "0 8px 8px" : "0 8px 8px" }}>
        {/* Collapse toggle */}
        <motion.button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center rounded-lg cursor-pointer"
          style={{
            height: 40,
            justifyContent: collapsed ? "center" : "flex-start",
            paddingLeft: collapsed ? 0 : 10,
            paddingRight: collapsed ? 0 : 10,
            background: "transparent",
            border: "none",
            outline: "none",
            width: "100%",
          }}
          whileHover={{ backgroundColor: "oklch(100% 0 0 / 0.06)" }}
          whileTap={{ scale: 0.97 }}
        >
          <motion.div
            animate={{ rotate: collapsed ? 180 : 0 }}
            transition={{ type: "spring" as const, stiffness: 300, damping: 25 }}
            className="shrink-0 flex items-center justify-center"
            style={{ width: 20 }}
          >
            <ChevronLeft size={17} strokeWidth={1.8} style={{ color: "var(--color-text-muted)" }} />
          </motion.div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-[13px] font-medium ml-3"
                style={{ color: "var(--color-text-muted)" }}
              >
                Collapse
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>

        {/* Divider */}
        <div style={{ margin: collapsed ? "2px 8px" : "2px 8px", borderTop: "1px solid oklch(100% 0 0 / 0.06)" }} />

        {bottomItems.map((item) => {
          const isActive = currentPath === item.id;
          const isHovered = hoveredId === `bottom-${item.id}`;
          return (
            <motion.button
              key={item.id}
              onClick={() => navigate(`/${item.id}`)}
              onMouseEnter={() => setHoveredId(`bottom-${item.id}`)}
              onMouseLeave={() => setHoveredId(null)}
              className="relative flex items-center rounded-lg cursor-pointer overflow-visible"
              style={{
                height: 40,
                justifyContent: collapsed ? "center" : "flex-start",
                paddingLeft: collapsed ? 0 : 10,
                paddingRight: collapsed ? 0 : 10,
                background: isActive ? "oklch(100% 0 0 / 0.08)" : "transparent",
                border: "none",
                outline: "none",
                width: "100%",
              }}
              whileHover={{ backgroundColor: "oklch(100% 0 0 / 0.06)" }}
              whileTap={{ scale: 0.97 }}
            >
              <motion.div
                animate={{
                  rotate: isHovered ? 90 : 0,
                }}
                transition={{ type: "spring" as const, stiffness: 300, damping: 20 }}
                className="shrink-0 flex items-center justify-center"
                style={{ width: 20 }}
              >
                <item.icon
                  size={17}
                  strokeWidth={1.8}
                  style={{ color: isActive ? "oklch(0.8 0.15 275)" : "var(--color-text-secondary)" }}
                />
              </motion.div>
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-[13px] font-medium ml-3"
                    style={{ color: isActive ? "var(--color-text-primary)" : "var(--color-text-secondary)" }}
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>

              {/* Tooltip on collapsed hover */}
              <AnimatePresence>
                {collapsed && isHovered && (
                  <motion.div
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -4 }}
                    transition={{ duration: 0.12 }}
                    className="absolute left-[calc(100%+8px)] z-50 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap pointer-events-none"
                    style={{
                      background: "oklch(0.18 0.04 280 / 0.95)",
                      border: "1px solid oklch(100% 0 0 / 0.12)",
                      color: "var(--color-text-primary)",
                      boxShadow: "0 4px 16px oklch(0 0 0 / 0.4)",
                    }}
                  >
                    {item.label}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          );
        })}
      </div>
    </motion.aside>
  );
}
