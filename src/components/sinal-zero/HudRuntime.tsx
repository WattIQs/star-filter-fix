import { useLocation } from "@tanstack/react-router";
import { useHudAutoMotion, useHudCursor } from "@/hooks/use-hud-motion";

/** Mount-only visual runtime: no business logic or data mutations. */
export function HudRuntime() {
  const location = useLocation();
  useHudCursor();
  useHudAutoMotion(location.pathname);
  return null;
}
