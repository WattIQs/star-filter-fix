/** Reusable HUD motion hooks. Visual-only and client-safe. */
import { useEffect, useRef, type RefObject } from "react";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const small = () => typeof window !== "undefined" && window.innerWidth < 768;

export function useMagnetic<T extends HTMLElement>(strength = 0.2) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced() || small()) return;
    const move = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const x = Math.max(-8, Math.min(8, (event.clientX - rect.left - rect.width / 2) * strength));
      const y = Math.max(-6, Math.min(6, (event.clientY - rect.top - rect.height / 2) * strength));
      el.style.setProperty("--mx", `${x}px`);
      el.style.setProperty("--my", `${y}px`);
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
      const rect = el.getBoundingClientRect();
      const dot = document.createElement("span");
      dot.className = "hud-ripple-dot";
      dot.style.left = `${event.clientX - rect.left}px`;
      dot.style.top = `${event.clientY - rect.top}px`;
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
      const targets = container.querySelectorAll<HTMLElement>(".hud-reveal");
      const ctx = gsap.context(() => {
        targets.forEach((target, index) => {
          gsap.fromTo(target,
            { opacity: 0, y: 12, filter: "blur(2px)" },
            { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.5, ease: "power3.out", delay: Math.min(index, 7) * 0.055,
              scrollTrigger: { trigger: target, scroller: container.scrollHeight > container.clientHeight ? container : undefined, start: "top 94%", once: true } });
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
      const lenis = new Lenis({ wrapper, content: (wrapper.firstElementChild as HTMLElement) ?? wrapper, duration: 0.9, smoothWheel: true, syncTouch: false });
      let frame = 0;
      const raf = (time: number) => { lenis.raf(time); frame = requestAnimationFrame(raf); };
      frame = requestAnimationFrame(raf);
      cleanup = () => { cancelAnimationFrame(frame); lenis.destroy(); };
    })();
    return () => { cancelled = true; cleanup?.(); };
  }, [containerRef]);
}

export function usePointerParallax<T extends HTMLElement>(depth = 10) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced() || small()) return;
    const move = (event: PointerEvent) => {
      const x = (event.clientX / window.innerWidth - 0.5) * depth;
      const y = (event.clientY / window.innerHeight - 0.5) * depth;
      el.style.setProperty("--parallax-x", `${x}px`);
      el.style.setProperty("--parallax-y", `${y}px`);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, [depth]);
  return ref;
}

export function useHudCursor() {
  useEffect(() => {
    if (reduced() || small() || matchMedia("(hover: none)").matches) return;
    void import("gsap").then(({ gsap }) => {
      const ring = document.createElement("div");
      const dot = document.createElement("div");
      ring.className = "hud-cursor";
      dot.className = "hud-cursor-dot";
      document.body.append(ring, dot);
      const rx = gsap.quickTo(ring, "x", { duration: 0.22, ease: "power3.out" });
      const ry = gsap.quickTo(ring, "y", { duration: 0.22, ease: "power3.out" });
      const dx = gsap.quickTo(dot, "x", { duration: 0.08, ease: "power2.out" });
      const dy = gsap.quickTo(dot, "y", { duration: 0.08, ease: "power2.out" });
      const move = (event: PointerEvent) => { rx(event.clientX); ry(event.clientY); dx(event.clientX); dy(event.clientY); };
      const over = (event: PointerEvent) => { const target = event.target as HTMLElement | null; const interactive = target?.closest("button,a,[role=button],input,select,textarea"); ring.dataset.active = interactive ? "true" : "false"; };
      window.addEventListener("pointermove", move, { passive: true });
      window.addEventListener("pointerover", over, { passive: true });
      return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerover", over); ring.remove(); dot.remove(); };
    });
  }, []);
}
