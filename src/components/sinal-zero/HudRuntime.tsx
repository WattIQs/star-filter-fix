import { useEffect } from "react";

const LOADING_STYLE_ID = "sinal-zero-loading-fix";

export function HudRuntime() {
  useEffect(() => {
    if (document.getElementById(LOADING_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = LOADING_STYLE_ID;
    style.textContent = `
      .loading-state-content{width:100%!important;max-width:560px!important;margin:0 auto!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;text-align:center!important;box-sizing:border-box!important}
      .loading-state-content>*{margin-left:auto!important;margin-right:auto!important}
      .loading-state-spinner{width:42px!important;height:42px!important;min-width:42px!important;min-height:42px!important;margin:0 auto 18px!important;display:block!important;box-sizing:border-box!important;border:2px solid color-mix(in oklab,var(--color-primary) 16%,transparent)!important;border-top-color:var(--color-primary)!important;border-right-color:var(--color-signal-zero)!important;border-radius:50%!important;position:relative!important;animation:sz-search-spin .9s linear infinite!important;box-shadow:0 0 24px -8px var(--color-primary)!important;transform-origin:center center!important}
      .loading-state-spinner::before,.loading-state-spinner::after{content:"";position:absolute;left:50%;top:50%;width:100%;height:100%;transform:translate(-50%,-50%) scale(.55);box-sizing:border-box;border-radius:50%;border:1px solid color-mix(in oklab,var(--color-primary) 24%,transparent);animation:sz-search-ring 1.5s ease-out infinite;pointer-events:none}
      .loading-state-spinner::after{width:calc(100% + 16px);height:calc(100% + 16px);border-color:color-mix(in oklab,var(--color-primary) 12%,transparent);animation-delay:.35s}
      .loading-state-title,.loading-state-subtitle,.loading-state-progress,.loading-state-steps{width:100%!important;text-align:center!important;box-sizing:border-box!important}
      .loading-state-title{margin:0 0 8px!important;animation:sz-search-breathe 1.25s ease-in-out infinite!important}
      .loading-state-subtitle{margin:0 0 20px!important;animation:sz-search-breathe 1.5s ease-in-out infinite!important}
      .loading-state-progress{margin:0 auto 18px!important}.loading-state-steps{margin:0 auto!important}
      @keyframes sz-search-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
      @keyframes sz-search-ring{0%{opacity:.7;transform:translate(-50%,-50%) scale(.55)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.35)}}
      @keyframes sz-search-breathe{0%,100%{opacity:.65}50%{opacity:1}}
    `;
    document.head.appendChild(style);
    return () => document.getElementById(LOADING_STYLE_ID)?.remove();
  }, []);
  return null;
}
