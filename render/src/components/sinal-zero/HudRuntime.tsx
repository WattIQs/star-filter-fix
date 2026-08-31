import { useEffect } from "react";

const LOADING_STYLE_ID = "sinal-zero-loading-fix";
const RADAR_SVG_URL = "/radar-final-palette.svg?v=4";

export function HudRuntime() {
  useEffect(() => {
    if (document.getElementById(LOADING_STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = LOADING_STYLE_ID;
    style.textContent = `
      .loading-state-enter{
        position:relative!important;
        display:flex!important;
        align-items:center!important;
        justify-content:center!important;
        min-height:300px!important;
        width:100%!important;
        margin:12px 0!important;
        padding:36px 20px 32px!important;
        box-sizing:border-box!important;
        overflow:hidden!important;
        text-align:center!important;
      }

      .loading-state-enter::before,
      .loading-state-enter::after{
        display:none!important;
        content:none!important;
        border:0!important;
        background:none!important;
        box-shadow:none!important;
      }

      .loading-state-content{
        position:relative!important;
        z-index:2!important;
        width:min(100%,560px)!important;
        margin:0 auto!important;
        padding:0!important;
        display:flex!important;
        flex-direction:column!important;
        align-items:center!important;
        justify-content:center!important;
        text-align:center!important;
        box-sizing:border-box!important;
        gap:0!important;
      }

      .loading-state-spinner{
        position:relative!important;
        z-index:3!important;
        display:block!important;
        width:176px!important;
        height:176px!important;
        min-width:176px!important;
        min-height:176px!important;
        aspect-ratio:1/1!important;
        margin:0 auto 22px!important;
        padding:0!important;
        box-sizing:border-box!important;
        border:0!important;
        border-radius:0!important;
        overflow:visible!important;
        clip-path:none!important;
        background-color:transparent!important;
        background-image:url("${RADAR_SVG_URL}")!important;
        background-repeat:no-repeat!important;
        background-position:center!important;
        background-size:contain!important;
        box-shadow:none!important;
        animation:sz-logo-spin 7s linear infinite!important;
        transform-origin:50% 50%!important;
        will-change:transform!important;
      }

      .loading-state-spinner::before,
      .loading-state-spinner::after{
        display:none!important;
        content:none!important;
        border:0!important;
        background:none!important;
        box-shadow:none!important;
      }

      .loading-state-title,
      .loading-state-subtitle,
      .loading-state-progress,
      .loading-state-steps{
        position:relative!important;
        z-index:3!important;
        width:100%!important;
        max-width:100%!important;
        box-sizing:border-box!important;
        text-align:center!important;
      }

      .loading-state-title{margin:0 0 8px!important;line-height:1.35!important;font-weight:700!important;letter-spacing:.01em!important}
      .loading-state-subtitle{margin:0 0 20px!important;line-height:1.5!important}
      .loading-state-progress{margin:0 auto 18px!important}
      .loading-state-steps{margin:0 auto!important}

      @keyframes sz-logo-spin{
        from{transform:rotate(0deg)}
        to{transform:rotate(360deg)}
      }

      .loading-state-enter .loading-progress{
        width:min(100%,340px);
        height:2px;
        margin:0 auto 18px;
        overflow:hidden;
        border-radius:99px;
        background:color-mix(in oklab,var(--color-primary) 9%,transparent)
      }

      .loading-state-enter .loading-progress::after{
        content:"";
        display:block;
        width:30%;
        height:100%;
        border-radius:inherit;
        background:linear-gradient(90deg,transparent,var(--color-primary),var(--color-cyan),transparent);
        animation:loading-progress 1.2s ease-in-out infinite
      }

      @keyframes loading-progress{
        0%{transform:translateX(-140%);opacity:0}
        15%{opacity:1}
        85%{opacity:1}
        100%{transform:translateX(460%);opacity:0}
      }

      @media(max-width:640px){
        .loading-state-enter{min-height:225px!important;margin:8px 0!important;padding:26px 16px 22px!important}
        .loading-state-spinner{width:132px!important;height:132px!important;min-width:132px!important;min-height:132px!important;margin-bottom:18px!important}
      }

      @media(prefers-reduced-motion:reduce){
        .loading-state-spinner{animation:none!important}
      }
    `;

    document.head.appendChild(style);
    return () => document.getElementById(LOADING_STYLE_ID)?.remove();
  }, []);

  return null;
}
