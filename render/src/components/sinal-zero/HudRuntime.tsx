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
        min-height:290px!important;
        width:100%!important;
        margin:12px 0!important;
        padding:34px 20px 30px!important;
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
        width:250px;
        height:250px;
        border:1px solid color-mix(in oklab,var(--color-primary) 10%,transparent);
        animation:sz-target-aura 3s ease-in-out infinite;
      }

      .loading-state-enter::after{
        width:188px;
        height:188px;
        border:1px solid color-mix(in oklab,var(--color-cyan) 8%,transparent);
        animation:sz-target-aura 3s .7s ease-in-out infinite;
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
        margin:0 auto 20px!important;
        padding:0!important;
        box-sizing:border-box!important;
        border:0!important;
        border-radius:50%!important;
        overflow:visible!important;
        background-color:transparent!important;
        background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 300' fill='none'%3E%3Cg fill='none' stroke='%23ffab00' stroke-width='25' stroke-linecap='round'%3E%3Cpath d='M87 42A128 128 0 0 1 250 91'/%3E%3Cpath d='M259 121A128 128 0 0 1 234 230'/%3E%3Cpath d='M210 253A128 128 0 0 1 105 264'/%3E%3Cpath d='M78 249A128 128 0 0 1 42 145'/%3E%3Cpath d='M46 112A128 128 0 0 1 65 68'/%3E%3C/g%3E%3Cg fill='none' stroke='%23ffab00' stroke-width='25' stroke-linecap='round'%3E%3Cpath d='M109 91A82 82 0 0 1 198 101'/%3E%3Cpath d='M214 125A82 82 0 0 1 196 197'/%3E%3Cpath d='M172 214A82 82 0 0 1 105 203'/%3E%3Cpath d='M87 183A82 82 0 0 1 88 115'/%3E%3Cpath d='M103 99A82 82 0 0 1 109 91'/%3E%3C/g%3E%3Ccircle cx='150' cy='150' r='37' fill='%23ffab00'/%3E%3Ccircle cx='150' cy='150' r='10' fill='%2307111f'/%3E%3Cpath d='M150 150L222 86' stroke='%23ffab00' stroke-width='22' stroke-linecap='round'/%3E%3Ccircle cx='230' cy='79' r='20' fill='%23ffab00'/%3E%3C/svg%3E")!important;
        background-repeat:no-repeat!important;
        background-position:center!important;
        background-size:100% 100%!important;
        box-shadow:0 0 38px -10px color-mix(in oklab,var(--color-primary) 85%,transparent)!important;
        animation:sz-target-spin 4.6s cubic-bezier(.55,.08,.35,.92) infinite!important;
        transform-origin:50% 50%!important;
        will-change:transform,opacity,filter;
      }

      .loading-state-spinner::before,
      .loading-state-spinner::after{
        content:""!important;
        position:absolute!important;
        inset:0!important;
        width:100%!important;
        height:100%!important;
        border-radius:50%!important;
        pointer-events:none!important;
        background:inherit!important;
        background-repeat:no-repeat!important;
        background-position:center!important;
        background-size:100% 100%!important;
        opacity:0!important;
      }

      .loading-state-spinner::before{
        animation:sz-target-fragment-a 4.6s ease-in-out infinite!important;
      }

      .loading-state-spinner::after{
        animation:sz-target-fragment-b 4.6s ease-in-out infinite!important;
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

      @keyframes sz-target-spin{
        0%{transform:rotate(0deg) scale(1);opacity:1;filter:none}
        28%{transform:rotate(100deg) scale(1.015);opacity:1;filter:none}
        42%{transform:rotate(151deg) scale(.97);opacity:.78;filter:blur(.35px)}
        49%{transform:rotate(177deg) scale(.90);opacity:.48;filter:blur(1.1px)}
        56%{transform:rotate(202deg) scale(.98);opacity:.82;filter:blur(.3px)}
        66%{transform:rotate(238deg) scale(1.015);opacity:1;filter:none}
        100%{transform:rotate(360deg) scale(1);opacity:1;filter:none}
      }

      @keyframes sz-target-fragment-a{
        0%,40%,100%{opacity:0;transform:rotate(0deg) translate(0,0) scale(1)}
        45%{opacity:.48;transform:rotate(9deg) translate(7px,-5px) scale(1.01)}
        51%{opacity:.26;transform:rotate(22deg) translate(-9px,7px) scale(.98)}
        60%{opacity:0;transform:rotate(36deg) translate(0,0) scale(1)}
      }

      @keyframes sz-target-fragment-b{
        0%,43%,100%{opacity:0;transform:rotate(0deg) translate(0,0) scale(1)}
        48%{opacity:.44;transform:rotate(-10deg) translate(-7px,5px) scale(1.01)}
        54%{opacity:.22;transform:rotate(-24deg) translate(9px,-6px) scale(.98)}
        62%{opacity:0;transform:rotate(-38deg) translate(0,0) scale(1)}
      }

      @keyframes sz-target-aura{
        0%,100%{opacity:.10;transform:translate(-50%,-50%) scale(.84)}
        50%{opacity:.34;transform:translate(-50%,-50%) scale(1.08)}
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
          padding:26px 16px 22px!important;
        }
        .loading-state-enter::before{width:210px;height:210px}
        .loading-state-enter::after{width:158px;height:158px}
        .loading-state-spinner{
          width:132px!important;
          height:132px!important;
          min-width:132px!important;
          min-height:132px!important;
          margin-bottom:17px!important;
        }
      }

      @media(prefers-reduced-motion:reduce){
        .loading-state-enter::before,
        .loading-state-enter::after,
        .loading-state-spinner,
        .loading-state-spinner::before,
        .loading-state-spinner::after{
          animation:none!important;
        }
        .loading-state-spinner{
          opacity:1!important;
          transform:none!important;
          filter:none!important;
        }
        .loading-state-spinner::before,
        .loading-state-spinner::after{
          opacity:0!important;
        }
      }
    `;

    document.head.appendChild(style);

    return () => document.getElementById(LOADING_STYLE_ID)?.remove();
  }, []);

  return null;
}
