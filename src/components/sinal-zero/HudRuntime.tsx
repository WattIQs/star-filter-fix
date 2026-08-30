import { useEffect } from "react";

const LOADING_STYLE_ID = "sinal-zero-loading-fix";

/** Lightweight visual runtime for the search loading state. */
export function HudRuntime() {
  useEffect(() => {
    if (document.getElementById(LOADING_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = LOADING_STYLE_ID;
    style.textContent = `
      .loading-state-enter{animation:sz-search-enter .45s ease-out both!important;}
      .loading-state-enter::before{animation:sz-search-ring 1.5s ease-out infinite!important;}
      .loading-state-enter::after{animation:sz-search-ring 1.5s .6s ease-out infinite!important;}
      .loading-state-spinner{animation:sz-search-spin .75s linear infinite!important;will-change:transform;}
      .loading-state-spinner::before{animation:sz-search-spin-reverse 1.1s linear infinite!important;}
      .loading-state-spinner::after{animation:sz-search-pulse .9s ease-in-out infinite!important;}
      .loading-state-title{animation:sz-search-breathe 1.25s ease-in-out infinite!important;}
      .loading-state-subtitle{animation:sz-search-breathe 1.5s ease-in-out infinite!important;}
      .loading-state-enter .loading-progress::after{animation:sz-search-progress 1.1s ease-in-out infinite!important;}
      @keyframes sz-search-enter{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}
      @keyframes sz-search-spin{to{transform:rotate(360deg)}}
      @keyframes sz-search-spin-reverse{to{transform:rotate(-360deg)}}
      @keyframes sz-search-ring{0%{opacity:.8;transform:translate(-50%,-50%) scale(.45)}70%{opacity:.15;transform:translate(-50%,-50%) scale(1.05)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.45)}}
      @keyframes sz-search-pulse{0%,100%{transform:scale(.7);opacity:.55}50%{transform:scale(1.35);opacity:1}}
      @keyframes sz-search-breathe{0%,100%{opacity:.55}50%{opacity:1}}
      @keyframes sz-search-progress{0%{transform:translateX(-140%);opacity:0}15%{opacity:1}85%{opacity:1}100%{transform:translateX(460%);opacity:0}}
    `;
    document.head.appendChild(style);
    return () => document.getElementById(LOADING_STYLE_ID)?.remove();
  }, []);
  return null;
}
