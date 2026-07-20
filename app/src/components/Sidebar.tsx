import { useRef, useState } from "react";
import type { AppState } from "../lib/appState";
import { useBootstrap } from "../lib/appState";
import { currentTheme, setTheme } from "../lib/theme";
import { Icon, type IconName } from "./Icons";
import { Popover } from "./Popover";

export type ViewName = "dashboard" | "inbox" | "backlog" | "progress" | "projects";

const NAV: { view: ViewName; label: string; icon: IconName }[] = [
  { view: "dashboard", label: "Dashboard", icon: "dashboard" },
  { view: "inbox", label: "Inbox", icon: "inbox" },
  { view: "backlog", label: "Backlog", icon: "backlog" },
  { view: "progress", label: "Progress", icon: "progress" },
  { view: "projects", label: "Projects", icon: "folder" }
];

/* Nav geometry (ui r1): the operator's hand sets it — drag the right
   border to resize (clamped), double-click resets, the header toggle
   folds to an icon rail with hover tips. Geometry is operator
   preference, so it persists locally, never in the store. */
const WIDTH_KEY = "trail.nav-width";
const COLLAPSED_KEY = "trail.nav-collapsed";
const WIDTH_DEFAULT = 200; /* 12.5rem, the sheet's resting width */
const WIDTH_MIN = 160;
const WIDTH_MAX = 320;

function readWidth(): number {
  const n = Number(localStorage.getItem(WIDTH_KEY));
  return Number.isFinite(n) && n >= WIDTH_MIN && n <= WIDTH_MAX ? n : WIDTH_DEFAULT;
}

export function Sidebar({ state, view, onNavigate, onOpenConnect }: {
  state: AppState;
  view: ViewName;
  onNavigate: (v: ViewName) => void;
  onOpenConnect: () => void;
}) {
  /* presence dot (D17 r1): something awaits judgment — shown while any
     Ready or Waiting task exists, no number; still, never breathing
     (motion stays liveness's alone) */
  const { tasks } = useBootstrap(state);
  const awaits = tasks.some((t) => t.status === "ready" || t.status === "waiting");
  const [menuOpen, setMenuOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [dark, setDark] = useState(currentTheme() === "dark");
  const [width, setWidth] = useState(readWidth);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === "1");
  const [dragging, setDragging] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const noteTrigger = useRef<HTMLButtonElement>(null);
  /* demo declarations (story 12): the footer chip is the one persistent
     mark on every view; its popover carries the gap documentation; live
     mode renders none of this */
  const demo = state.client.mode === "demo";

  const toggleTheme = () => {
    const next = dark ? "light" : "dark";
    setTheme(next);
    setDark(next === "dark");
  };

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
  };

  /* pointer capture keeps the drag alive past the 6px handle; width
     commits to storage once on release, not per move */
  const onResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const el = e.currentTarget;
    const startX = e.clientX;
    const startW = width;
    let w = startW;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* an already-released pointer can't capture; the drag still works
         while the pointer stays over the handle */
    }
    setDragging(true);
    const move = (ev: PointerEvent) => {
      w = Math.min(WIDTH_MAX, Math.max(WIDTH_MIN, startW + (ev.clientX - startX)));
      setWidth(w);
    };
    const end = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", end);
      el.removeEventListener("pointercancel", end);
      setDragging(false);
      localStorage.setItem(WIDTH_KEY, String(Math.round(w)));
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
  };

  const resetWidth = () => {
    setWidth(WIDTH_DEFAULT);
    localStorage.setItem(WIDTH_KEY, String(WIDTH_DEFAULT));
  };

  const cls = ["sidebar"];
  if (collapsed) cls.push("collapsed");
  if (dragging) cls.push("dragging");
  return (
    <nav className={cls.join(" ")} style={collapsed ? undefined : { width }}>
      <div className="side-head">
        {!collapsed && <span className="wordmark">Trail</span>}
        <button
          type="button"
          className="btn btn-quiet btn-small btn-icon nav-toggle"
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          data-tip="Expand"
          onClick={toggleCollapsed}
        >
          <Icon name={collapsed ? "expand" : "collapse"} />
        </button>
      </div>
      {NAV.map((item) => (
        <button
          key={item.view}
          type="button"
          className={item.view === view ? "nav-item active" : "nav-item"}
          aria-label={item.label}
          data-tip={item.label}
          onClick={() => onNavigate(item.view)}
        >
          <Icon name={item.icon} />
          {!collapsed && item.label}
          {item.view === "inbox" && awaits && <span className="nav-dot" />}
        </button>
      ))}
      {/* the banner sits above the footer separator (r6), the
          update-notification grammar; the popover portals away, so the
          banner and the footer stay adjacent siblings */}
      {demo && (
        <button type="button" ref={noteTrigger} className="demo-banner" aria-label="Demo data" data-tip="Demo data" onClick={() => setNoteOpen(!noteOpen)}>
          <Icon name="demo" />
          {!collapsed && <span className="title">Demo data</span>}
          {!collapsed && <Icon name="chevr" className="go" />}
        </button>
      )}
      {noteOpen && (
        <Popover anchorRef={noteTrigger} onClose={() => setNoteOpen(false)}>
          <div className="menu note">
            <h4>Everything here is fictional</h4>
            <p>Connect and dispatch are simulated, and nothing reads your machine. For the full workflow, watch the recorded demo.</p>
            <div className="foot">
              <button type="button" className="btn btn-secondary btn-small" onClick={() => setNoteOpen(false)}>Got it</button>
            </div>
          </div>
        </Popover>
      )}
      <div className="sidebar-foot">
        <button type="button" ref={trigger} className="nav-item" aria-label="Settings" data-tip="Settings" onClick={() => setMenuOpen(!menuOpen)}>
          <Icon name="settings" />
          {!collapsed && "Settings"}
        </button>
        {menuOpen && (
          <Popover anchorRef={trigger} onClose={() => setMenuOpen(false)}><div className="menu">
            <button
              type="button"
              className="menu-item"
              onClick={() => {
                toggleTheme();
                setMenuOpen(false);
              }}
            >
              <Icon name={dark ? "sun" : "moon"} />
              {dark ? "Switch to light mode" : "Switch to dark mode"}
            </button>
            <button
              type="button"
              className="menu-item"
              onClick={() => {
                setMenuOpen(false);
                onOpenConnect();
              }}
            >
              <Icon name="plug" />
              Connect to agents
            </button>
            {state.client.resetDemo && (
              <button
                type="button"
                className="menu-item"
                onClick={() => {
                  setMenuOpen(false);
                  void state.client.resetDemo!().then(() => state.refresh());
                }}
              >
                <Icon name="refresh" />
                Reset demo data
              </button>
            )}
          </div></Popover>
        )}
      </div>
      {!collapsed && (
        <div
          className="sidebar-rsz"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize navigation"
          onPointerDown={onResizeStart}
          onDoubleClick={resetWidth}
        />
      )}
    </nav>
  );
}
