import { useEffect } from "react";

const LOADING_STYLE_ID = "sinal-zero-loading-fix";

export function HudRuntime() {
  useEffect(() => {
    if (document.getElementById(LOADING_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = LOADING_STYLE_ID;
    style.textContent = `
      .loading-state-content{width:min(100%,560px)!important;margin:0 auto!important;padding:0!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;text-align:center!important;box-sizing:border-box!important;gap:0!important}
      .loading-state-content>*{flex:0 0 auto!important;margin-left:auto!important;margin-right:auto!important}
      .loading-state-spinner{width:48px!important;height:48px!important;min-width:48px!important;min-height:48px!important;margin:0 auto 18px!important;display:flex!important;align-items:center!important;justify-content:center!important;box-sizing:border-box!important;border:2px solid color-mix(in oklab,var(--color-primary) 14%,transparent)!important;border-top-color:var(--color-primary)!important;border-right-color:var(--color-cyan)!important;border-radius:50%!important;position:relative!important;animation:sz-search-spin .9s linear infinite!important;box-shadow:0 0 28px -9px color-mix(in oklab,var(--color-primary) 75%,transparent)!important;transform-origin:center center!important;will-change:transform}
      .loading-state-spinner::before{content:"";position:absolute;inset:6px;border:1px dashed color-mix(in oklab,var(--color-cyan) 55%,transparent);border-radius:50%;animation:sz-search-spin-reverse 1.25s linear infinite;pointer-events:none}
      .loading-state-spinner::after{content:"";position:absolute;width:7px;height:7px;border-radius:50%;background:var(--color-primary);box-shadow:0 0 16px color-mix(in oklab,var(--color-primary) 85%,transparent);animation:sz-search-dot 1s ease-in-out infinite;pointer-events:none}
      .loading-state-title,.loading-state-subtitle,.loading-state-progress,.loading-state-steps{width:100%!important;max-width:100%!important;box-sizing:border-box!important;text-align:center!important}
      .loading-state-title{margin:0 0 7px!important;line-height:1.35!important}
      .loading-state-subtitle{margin:0 0 20px!important;line-height:1.5!important}
      .loading-state-progress{margin:0 auto 18px!important}.loading-state-steps{margin:0 auto!important}
      @keyframes sz-search-spin{to{transform:rotate(360deg)}}
      @keyframes sz-search-spin-reverse{to{transform:rotate(-360deg)}}
      @keyframes sz-search-dot{0%,100%{transform:scale(.7);opacity:.65}50%{transform:scale(1.35);opacity:1}}
      @media(max-width:640px){.loading-state-spinner{width:44px!important;height:44px!important;min-width:44px!important;min-height:44px!important;margin-bottom:16px!important}}
    `;
    document.head.appendChild(style);
    return () => document.getElementById(LOADING_STYLE_ID)?.remove();
  }, []);
  return null;
}
