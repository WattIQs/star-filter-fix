/**
 * Hooks de movimento da camada HUD.
 *
 * Regras seguidas em todos eles:
 *  - GSAP / Lenis são importados dinamicamente dentro de useEffect,
 *    portanto nunca rodam no SSR e não pesam no bundle inicial.
 *  - Só animamos transform / opacity (nada de reflow).
 *  - prefers-reduced-motion desliga tudo.
 *  - Em telas pequenas reduzimos parallax e desativamos smooth scroll.
 */
import { useEffect, useRef, type RefObject } from "react";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const isSmallScreen = () =>
  typeof window !== "undefined" && window.innerWidth < 768;

/**
 * Botão magnético: o elemento acompanha levemente o cursor.
 * O deslocamento vai para as CSS vars --mx/--my (só transform).
 */
export function useMagnetic<T extends HTMLElement>(strength = 0.22) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || isSmallScreen()) return;

    const onMove = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const dx = (event.clientX - (rect.left + rect.width / 2)) * strength;
      const dy = (event.clientY - (rect.top + rect.height / 2)) * strength;
      // Limita o deslocamento para manter o toque "premium" e discreto.
      el.style.setProperty("--mx", `${Math.max(-10, Math.min(10, dx))}px`);
      el.style.setProperty("--my", `${Math.max(-8, Math.min(8, dy))}px`);
    };
    const reset = () => {
      el.style.setProperty("--mx", "0px");
      el.style.setProperty("--my", "0px");
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", reset);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", reset);
    };
  }, [strength]);

  return ref;
}

/**
 * Ripple no clique: cria um ponto que expande e some.
 * Elemento precisa da classe .hud-ripple (overflow hidden + position relative).
 */
export function useRipple<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;

    const onDown = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const dot = document.createElement("span");
      dot.className = "hud-ripple-dot";
      dot.style.left = `${event.clientX - rect.left}px`;
      dot.style.top = `${event.clientY - rect.top}px`;
      el.appendChild(dot);
      window.setTimeout(() => dot.remove(), 600);
    };

    el.addEventListener("pointerdown", onDown);
    return () => el.removeEventListener("pointerdown", onDown);
  }, []);

  return ref;
}

/**
 * Reveal com GSAP + ScrollTrigger dentro de um container rolável.
 * Cada elemento .hud-reveal entra com fade + slide quando aparece na área visível.
 * `deps` permite reexecutar quando a lista muda (novo scan, novo filtro).
 */
export function useHudReveal(
  containerRef: RefObject<HTMLElement | null>,
  deps: unknown[] = [],
) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (prefersReducedMotion()) return;

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    void (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);

      container.setAttribute("data-hud-reveal-ready", "true");
      const targets = container.querySelectorAll<HTMLElement>(".hud-reveal");

      const ctx = gsap.context(() => {
        targets.forEach((target, index) => {
          gsap.fromTo(
            target,
            { opacity: 0, y: 18, filter: "blur(4px)" },
            {
              opacity: 1,
              y: 0,
              filter: "blur(0px)",
              duration: 0.55,
              ease: "power3.out",
              // Escalonamento leve só nos primeiros itens: evita cascata longa.
              delay: Math.min(index, 8) * 0.045,
              scrollTrigger: {
                trigger: target,
                scroller: container,
                start: "top 96%",
                once: true,
              },
            },
          );
        });
      }, container);

      cleanup = () => {
        ctx.revert();
        container.removeAttribute("data-hud-reveal-ready");
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * Smooth scroll (Lenis) aplicado a um container rolável específico.
 * Desativado em mobile e com reduced-motion — nesses casos o scroll nativo
 * continua sendo o melhor comportamento.
 */
export function useSmoothScroll(containerRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const wrapper = containerRef.current;
    if (!wrapper) return;
    if (prefersReducedMotion() || isSmallScreen()) return;

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    void (async () => {
      const { default: Lenis } = await import("lenis");
      if (cancelled || !containerRef.current) return;

      const lenis = new Lenis({
        wrapper,
        content: (wrapper.firstElementChild as HTMLElement) ?? wrapper,
        duration: 0.9,
        easing: (t: number) => 1 - Math.pow(1 - t, 3),
        smoothWheel: true,
      });

      let frame = 0;
      const raf = (time: number) => {
        lenis.raf(time);
        frame = requestAnimationFrame(raf);
      };
      frame = requestAnimationFrame(raf);

      cleanup = () => {
        cancelAnimationFrame(frame);
        lenis.destroy();
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [containerRef]);
}

/**
 * Parallax sutil por movimento do ponteiro (efeito de profundidade em camadas).
 * `depth` define quanto a camada se desloca — use valores diferentes por camada.
 */
export function usePointerParallax<T extends HTMLElement>(depth = 12) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || isSmallScreen()) return;

    const onMove = (event: PointerEvent) => {
      const x = (event.clientX / window.innerWidth - 0.5) * depth;
      const y = (event.clientY / window.innerHeight - 0.5) * depth;
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [depth]);

  return ref;
}
