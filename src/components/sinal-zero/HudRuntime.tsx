import { useEffect } from "react";

const LOADING_STYLE_ID = "sinal-zero-loading-fix";

export function HudRuntime() {
  useEffect(() => {
    if (document.getElementById(LOADING_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = LOADING_STYLE_ID;
    style.textContent = `
      .loading-state-enter{position:relative!important;isolation:isolate!important;display:flex!important;align-items:center!important;justify-content:center!important;min-height:240px!important;width:100%!important;margin:12px 0!important;padding:32px 20px!important;box-sizing:border-box!important;overflow:hidden!important;text-align:center!important;border:1px solid color-mix(in oklab,var(--color-primary) 22%,var(--color-border))!important;border-radius:20px!important;background:radial-gradient(circle at 50% 36%,color-mix(in oklab,var(--color-primary) 11%,transparent),transparent 42%),color-mix(in oklab,var(--color-card) 94%,transparent)!important;box-shadow:0 20px 50px -34px color-mix(in oklab,var(--color-primary) 55%,transparent),inset 0 1px 0 color-mix(in oklab,var(--color-foreground) 8%,transparent)!important;backdrop-filter:blur(8px)!important}
      .loading-state-enter::before,.loading-state-enter::after{content:"";position:absolute;left:50%;top:38%;width:74px;height:74px;border:1px solid color-mix(in oklab,var(--color-primary) 50%,transparent);border-radius:50%;transform:translate(-50%,-50%) scale(.45);pointer-events:none}
      .loading-state-enter::before{animation:sz-search-ring 1.8s cubic-bezier(.2,.75,.2,1) infinite}
      .loading-state-enter::after{width:124px;height:124px;border-color:color-mix(in oklab,var(--color-cyan) 38%,transparent);animation:sz-search-ring 1.8s .6s cubic-bezier(.2,.75,.2,1) infinite}
      .loading-state-content{position:relative!important;z-index:2!important;width:min(100%,560px)!important;margin:0 auto!important;padding:0!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;text-align:center!important;box-sizing:border-box!important;gap:0!important}
      .loading-state-content>*{flex:0 0 auto!important;margin-left:auto!important;margin-right:auto!important}
      .loading-state-spinner{position:relative!important;z-index:3!important;display:flex!important;width:48px!important;height:48px!important;min-width:48px!important;min-height:48px!important;align-items:center!important;justify-content:center!important;margin:0 auto 18px!important;box-sizing:border-box!important;border:2px solid color-mix(in oklab,var(--color-primary) 14%,transparent)!important;border-top-color:var(--color-primary)!important;border-right-color:var(--color-cyan)!important;border-radius:50%!important;background:none!important;box-shadow:0 0 28px -9px color-mix(in oklab,var(--color-primary) 75%,transparent)!important;animation:sz-search-spin .9s linear infinite!important;transform-origin:center center!important;will-change:transform}
      .loading-state-spinner::before{content:"";position:absolute;inset:6px;border:1px dashed color-mix(in oklab,var(--color-cyan) 55%,transparent);border-radius:50%;animation:sz-search-spin-reverse 1.25s linear infinite;pointer-events:none}
      .loading-state-spinner::after{content:"";position:absolute;width:7px;height:7px;border-radius:50%;background:var(--color-primary);box-shadow:0 0 16px color-mix(in oklab,var(--color-primary) 85%,transparent);animation:sz-search-dot 1s ease-in-out infinite;pointer-events:none}
      .loading-state-title,.loading-state-subtitle,.loading-state-progress,.loading-state-steps{position:relative!important;z-index:3!important;width:100%!important;max-width:100%!important;box-sizing:border-box!important;text-align:center!important}
      .loading-state-title{margin:0 0 7px!important;line-height:1.35!important;letter-spacing:.01em!important;animation:loading-text-breathe 1.6s ease-in-out infinite}
      .loading-state-subtitle{margin:0 0 20px!important;line-height:1.5!important;animation:loading-subtitle 1.6s ease-in-out infinite}
      .loading-state-progress{margin:0 auto 18px!important}.loading-state-steps{margin:0 auto!important}
      .loading-state-enter .loading-progress{width:min(100%,340px);height:2px;margin:0 auto 18px;overflow:hidden;border-radius:99px;background:color-mix(in oklab,var(--color-primary) 9%,transparent)}
      .loading-state-enter .loading-progress::after{content:"";display:block;width:30%;height:100%;border-radius:inherit;background:linear-gradient(90deg,transparent,var(--color-primary),var(--color-cyan),transparent);animation:loading-progress 1.2s ease-in-out infinite}
      @keyframes sz-search-spin{to{transform:rotate(360deg)}}
      @keyframes sz-search-spin-reverse{to{transform:rotate(-360deg)}}
      @keyframes sz-search-ring{0%{opacity:.8;transform:translate(-50%,-50%) scale(.45)}65%{opacity:.18;transform:translate(-50%,-50%) scale(1.05)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.45)}}
      @keyframes sz-search-dot{0%,100%{transform:scale(.7);opacity:.65}50%{transform:scale(1.35);opacity:1}}
      @keyframes loading-text-breathe{0%,100%{opacity:.72}50%{opacity:1}}
      @keyframes loading-subtitle{0%,100%{opacity:.48}50%{opacity:.85}}
      @keyframes loading-progress{0%{transform:translateX(-140%);opacity:0}15%{opacity:1}85%{opacity:1}100%{transform:translateX(460%);opacity:0}}
      @media(max-width:640px){.loading-state-enter{min-height:220px!important;margin:8px!important;padding:28px 16px!important}.loading-state-spinner{width:44px!important;height:44px!important;min-width:44px!important;min-height:44px!important;margin-bottom:16px!important}}
      @media(prefers-reduced-motion:reduce){.loading-state-enter,.loading-state-enter::before,.loading-state-enter::after,.loading-state-spinner,.loading-state-spinner::before,.loading-state-spinner::after,.loading-state-title,.loading-state-subtitle,.loading-progress::after{animation:none!important}.loading-state-spinner{border-top-color:var(--color-primary)!important}}
    `;
    document.head.appendChild(style);
    return () => document.getElementById(LOADING_STYLE_ID)?.remove();
  }, []);
  return null;
}
