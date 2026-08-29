/** Reusable HUD motion hooks. Client-only effects, visual-only behavior. */
import { useEffect, useRef, type RefObject } from "react";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const small = () => typeof window !== "undefined" && window.innerWidth < 768;

export function useMagnetic<T extends HTMLElement>(strength = 0.2) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced() || small()) return;
    const move = (event: PointerEvent) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${Math.max(-8, Math.min(8, (event.clientX - r.left - r.width / 2) * strength))}px`);
      el.style.setProperty("--my", `${Math.max(-6, Math.min(6, (event.clientY - r.top - r.height / 2) * strength))}px`);
    };
    const reset = () => { el.style.setProperty("--mx", "0px"); el.style.setProperty("--my", "0px"); };
    el.addEventListener("pointermove", move, { passive: true });
    el.addEventListener("pointerleave", reset);
    return () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerleave", reset); };
  }, [strength]);
  return ref;
}

export function useRipple<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced()) return;
    const down = (event: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const dot = document.createElement("span");
      dot.className = "hud-ripple-dot";
      dot.style.left = `${event.clientX - r.left}px`;
      dot.style.top = `${event.clientY - r.top}px`;
      el.appendChild(dot);
      window.setTimeout(() => dot.remove(), 560);
    };
    el.addEventListener("pointerdown", down);
    return () => el.removeEventListener("pointerdown", down);
  }, []);
  return ref;
}

export function useHudReveal(containerRef: RefObject<HTMLElement | null>, deps: unknown[] = []) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container || reduced()) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    void (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([import("gsap"), import("gsap/ScrollTrigger")]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);
      const targets = Array.from(container.querySelectorAll<HTMLElement>(".hud-reveal"));
      const ctx = gsap.context(() => {
        targets.forEach((target, index) => {
          gsap.fromTo(target, { opacity: 0, y: 12, filter: "blur(2px)" }, {
            opacity: 1, y: 0, filter: "blur(0px)", duration: 0.75, ease: "power3.out",
            delay: Math.min(index, 7) * 0.055, scrollTrigger: { trigger: target, start: "top 94%", once: true },
          });
        });
      }, container);
      cleanup = () => ctx.revert();
    })();
    return () => { cancelled = true; cleanup?.(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function useSmoothScroll(containerRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const wrapper = containerRef.current;
    if (!wrapper || reduced() || small() || wrapper.scrollHeight <= wrapper.clientHeight) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    void (async () => {
      const { default: Lenis } = await import("lenis");
      if (cancelled) return;
      const lenis = new Lenis({ wrapper, content: (wrapper.firstElementChild as HTMLElement) ?? wrapper, duration: 0.9, smoothWheel: true });
      let frame = 0;
      const raf = (time: number) => { lenis.raf(time); frame = requestAnimationFrame(raf); };
      frame = requestAnimationFrame(raf);
      cleanup = () => { cancelAnimationFrame(frame); lenis.destroy(); };
    })();
    return () => { cancelled = true; cleanup?.(); };
  }, [containerRef]);
  return null;
}

export function usePointerParallax<T extends HTMLElement>(depth = 10) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced() || small()) return;
    let raf = 0;
    const move = (event: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--parallax-x", `${(event.clientX / window.innerWidth - 0.5) * depth}px`);
        el.style.setProperty("--parallax-y", `${(event.clientY / window.innerHeight - 0.5) * depth}px`);
      });
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => { cancelAnimationFrame(raf); window.removeEventListener("pointermove", move); };
  }, [depth]);
  return ref;
}

export function useHudCursor() {
  useEffect(() => {
    if (reduced() || small() || window.matchMedia("(hover: none)").matches) return;
    let active = true;
    let cleanup: (() => void) | undefined;
    void import("gsap").then(({ gsap }) => {
      if (!active) return;
      const ring = document.createElement("div");
      const dot = document.createElement("div");
      ring.className = "hud-cursor";
      dot.className = "hud-cursor-dot";
      document.body.append(ring, dot);
      const rx = gsap.quickTo(ring, "x", { duration: 0.26, ease: "power3.out" });
      const ry = gsap.quickTo(ring, "y", { duration: 0.26, ease: "power3.out" });
      const dx = gsap.quickTo(dot, "x", { duration: 0.09, ease: "power2.out" });
      const dy = gsap.quickTo(dot, "y", { duration: 0.09, ease: "power2.out" });
      const move = (event: PointerEvent) => { rx(event.clientX); ry(event.clientY); dx(event.clientX); dy(event.clientY); };
      const over = (event: PointerEvent) => {
        const target = event.target as HTMLElement | null;
        ring.dataset.active = target?.closest("button,a,[role=button],input,select,textarea") ? "true" : "false";
      };
      window.addEventListener("pointermove", move, { passive: true });
      window.addEventListener("pointerover", over, { passive: true });
      cleanup = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerover", over); gsap.killTweensOf([ring, dot]); ring.remove(); dot.remove(); };
    });
    return () => { active = false; cleanup?.(); };
  }, []);
}

function applyHudClasses(scope: HTMLElement) {
  scope.querySelectorAll<HTMLElement>("article.premium-card:not(.hud-frame)").forEach((el) => el.classList.add("hud-frame", "hud-glass", "hud-surface-interactive", "hud-ripple"));
  scope.querySelectorAll<HTMLElement>(".glass-panel:not(.hud-frame)").forEach((el) => el.classList.add("hud-frame", "hud-glass"));
  scope.querySelectorAll<HTMLElement>("[aria-pressed=\"true\"], [data-state=\"on\"]").forEach((el) => el.classList.add("hud-glow-edge"));
  scope.querySelectorAll<HTMLElement>("button,a,[role=button]").forEach((el) => el.classList.add("hud-control"));
  scope.querySelector("header")?.classList.add("hud-header", "hud-scanlines", "hud-frame", "hud-glass");
  scope.querySelectorAll<HTMLElement>("section").forEach((el) => { if (el.querySelector(".leaflet-container")) el.classList.add("hud-map-surface"); });
  scope.querySelectorAll<HTMLElement>("h1,h2").forEach((el, index) => { if (index < 2) el.classList.add("hud-title"); });
}

/** Global visual runtime. Only adds visual classes and a desktop pointer parallax layer. */
export function useHudAutoMotion(routeKey = "") {
  useEffect(() => {
    if (typeof document === "undefined" || reduced()) return;
    const scope = document.querySelector<HTMLElement>(".route-content-enter");
    if (!scope) return;
    let raf = 0;
    const apply = () => { applyHudClasses(scope); raf = 0; };
    apply();
    const observer = new MutationObserver(() => {
      if (raf === 0) raf = requestAnimationFrame(apply);
    });
    observer.observe(scope, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-pressed", "data-state"] });
    if (small() || window.matchMedia("(hover: none)").matches) {
      return () => { observer.disconnect(); if (raf) cancelAnimationFrame(raf); };
    }
    let pointerRaf = 0;
    const move = (event: PointerEvent) => {
      cancelAnimationFrame(pointerRaf);
      pointerRaf = requestAnimationFrame(() => {
        const x = (event.clientX / window.innerWidth - 0.5) * 7;
        const y = (event.clientY / window.innerHeight - 0.5) * 7;
        scope.querySelectorAll<HTMLElement>(".hud-map-surface").forEach((map) => {
          map.style.setProperty("--parallax-x", `${x}px`);
          map.style.setProperty("--parallax-y", `${y}px`);
        });
      });
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => { observer.disconnect(); if (raf) cancelAnimationFrame(raf); cancelAnimationFrame(pointerRaf); window.removeEventListener("pointermove", move); };
  }, [routeKey]);
}
