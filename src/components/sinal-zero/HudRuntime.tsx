import { useEffect } from "react";
import { useLocation } from "@tanstack/react-router";
import { useHudCursor } from "@/hooks/use-hud-motion";

/** Visual-only runtime for the HUD layer. It decorates existing DOM nodes without touching app logic. */
export function HudRuntime() {
  const location = useLocation();
  useHudCursor();

  useEffect(() => {
    const root = document.querySelector(".route-content-enter");
    if (!root) return;

    const decorate = () => {
      root.querySelectorAll<HTMLElement>("article.premium-card").forEach((el) => {
        el.classList.add("hud-frame", "hud-glass", "hud-reveal", "hud-surface-interactive");
      });

      root.querySelectorAll<HTMLElement>(".glass-panel").forEach((el) => {
        el.classList.add("hud-frame", "hud-glass", "hud-auth-panel");
      });

      const header = root.querySelector<HTMLElement>("header");
      header?.classList.add("hud-header", "hud-scanlines");
      header?.setAttribute("data-hud-panel", "true");

      root.querySelectorAll<HTMLElement>("button, a").forEach((el) => el.classList.add("hud-control"));
      root.querySelectorAll<HTMLElement>("[data-state=on], [aria-pressed=true]").forEach((el) => {
        el.classList.add("hud-glow-edge");
      });

      const scanButton = Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find((button) =>
        /varrer área|varrendo/i.test(button.getAttribute("aria-label") ?? button.textContent ?? ""),
      );
      if (scanButton) scanButton.classList.add("hud-magnetic", "hud-ripple");

      root.querySelectorAll<HTMLElement>("article.premium-card, .hud-auth-panel, header").forEach((el) => {
        if (!el.classList.contains("hud-stagger-ready")) el.classList.add("hud-stagger-ready");
      });

      root.querySelectorAll<HTMLElement>(".leaflet-container").forEach((el) => el.classList.add("hud-map-surface"));
    };

    decorate();
    const observer = new MutationObserver(decorate);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [location.pathname]);

  return null;
}
