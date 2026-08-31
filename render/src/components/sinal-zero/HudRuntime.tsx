import { useEffect } from "react";

const LOADING_STYLE_ID = "sinal-zero-loading-fix";

export function HudRuntime() {
  useEffect(() => {
    if (document.getElementById(LOADING_STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = LOADING_STYLE_ID;
    style.textContent = `
      .loading-state-enter{
        position:relative!important;
        isolation:isolate!important;
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
        content:"";
        position:absolute;
        left:50%;
        top:42%;
        border-radius:50%;
        transform:translate(-50%,-50%);
        pointer-events:none;
      }

      .loading-state-enter::before{
        width:260px;
        height:260px;
        border:1px solid color-mix(in oklab,var(--color-primary) 9%,transparent);
        animation:sz-target-aura 2.8s ease-in-out infinite;
      }

      .loading-state-enter::after{
        width:205px;
        height:205px;
        border:1px solid color-mix(in oklab,var(--color-primary) 6%,transparent);
        animation:sz-target-aura 2.8s .65s ease-in-out infinite reverse;
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

      .loading-state-content>*{
        flex:0 0 auto!important;
        margin-left:auto!important;
        margin-right:auto!important;
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
        border-radius:50%!important;
        overflow:visible!important;
        background-color:transparent!important;
        background-image:url("/radar-final-palette.svg")!important;
        background-repeat:no-repeat!important;
        background-position:center!important;
        background-size:100% 100%!important;
        box-shadow:0 0 44px -12px color-mix(in oklab,var(--color-primary) 95%,transparent)!important;
        animation:sz-icon-breathe 2.8s ease-in-out infinite!important;
        transform-origin:50% 50%!important;
        will-change:transform,filter;
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

      .loading-state-title{
        margin:0 0 8px!important;
        line-height:1.35!important;
        font-weight:700!important;
        letter-spacing:.01em!important;
      }

      .loading-state-subtitle{
        margin:0 0 20px!important;
        line-height:1.5!important;
      }

      .loading-state-progress{margin:0 auto 18px!important}
      .loading-state-steps{margin:0 auto!important}

      .loading-state-enter .loading-progress{
        width:min(100%,340px);
        height:2px;
        margin:0 auto 18px;
        overflow:hidden;
        border-radius:99px;
        background:color-mix(in oklab,var(--color-primary) 9%,transparent);
      }

      .loading-state-enter .loading-progress::after{
        content:"";
        display:block;
        width:30%;
        height:100%;
        border-radius:inherit;
        background:linear-gradient(90deg,transparent,var(--color-primary),var(--color-cyan),transparent);
        animation:loading-progress 1.2s ease-in-out infinite;
      }

      @keyframes sz-icon-breathe{
        0%,100%{transform:scale(1);filter:drop-shadow(0 0 4px color-mix(in oklab,var(--color-primary) 35%,transparent));}
        50%{transform:scale(1.025);filter:drop-shadow(0 0 12px color-mix(in oklab,var(--color-primary) 70%,transparent));}
      }

      @keyframes sz-target-aura{
        0%,100%{opacity:.08;transform:translate(-50%,-50%) scale(.86)}
        50%{opacity:.30;transform:translate(-50%,-50%) scale(1.06)}
      }

      @keyframes loading-progress{
        0%{transform:translateX(-140%);opacity:0}
        15%{opacity:1}
        85%{opacity:1}
        100%{transform:translateX(460%);opacity:0}
      }

      @media(max-width:640px){
        .loading-state-enter{
          min-height:250px!important;
          margin:8px 0!important;
          padding:28px 16px 24px!important;
        }
        .loading-state-enter::before{width:215px;height:215px}
        .loading-state-enter::after{width:168px;height:168px}
        .loading-state-spinner{
          width:132px!important;
          height:132px!important;
          min-width:132px!important;
          min-height:132px!important;
          margin-bottom:18px!important;
        }
      }

      @media(prefers-reduced-motion:reduce){
        .loading-state-enter::before,
        .loading-state-enter::after,
        .loading-state-spinner{
          animation:none!important;
        }
        .loading-state-spinner{
          opacity:1!important;
          transform:none!important;
          filter:none!important;
        }
      }
    `;

    document.head.appendChild(style);

    return () => document.getElementById(LOADING_STYLE_ID)?.remove();
  }, []);

  return null;
}
