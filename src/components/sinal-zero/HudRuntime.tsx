import { useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useHudAutoMotion, useHudCursor } from "@/hooks/use-hud-motion";

const LOADING_STYLE_ID = "sinal-zero-loading-fix";
function LoadingMotionStyle() {
  useEffect(() => {
    if (document.getElementById(LOADING_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = LOADING_STYLE_ID;
    style.textContent = `.loading-state-spinner{width:42px;height:42px;border:2px solid color-mix(in oklab,var(--color-primary) 16%,transparent);border-top-color:var(--color-primary);border-right-color:var(--color-signal-zero);border-radius:50%;position:relative;animation:sinal-zero-search-spin .9s linear infinite;box-shadow:0 0 24px -8px var(--color-primary);will-change:transform}.loading-state-spinner:before,.loading-state-spinner:after{content:"";position:absolute;inset:6px;border-radius:50%;border:1px solid color-mix(in oklab,var(--color-primary) 24%,transparent);animation:sinal-zero-search-pulse 1.5s ease-out infinite}.loading-state-spinner:after{inset:-8px;border-color:color-mix(in oklab,var(--color-primary) 12%,transparent);animation-delay:.35s}@keyframes sinal-zero-search-spin{to{transform:rotate(360deg)}}@keyframes sinal-zero-search-pulse{0%{transform:scale(.55);opacity:.7}100%{transform:scale(1.35);opacity:0}}@media (prefers-reduced-motion:reduce){.loading-state-spinner,.loading-state-spinner:before,.loading-state-spinner:after{animation:none!important}}`;
    document.head.appendChild(style);
    return () => document.getElementById(LOADING_STYLE_ID)?.remove();
  }, []);
  return null;
}
export function HudRuntime() { const location = useLocation(); useHudCursor(); useHudAutoMotion(location.pathname); return <LoadingMotionStyle />; }
