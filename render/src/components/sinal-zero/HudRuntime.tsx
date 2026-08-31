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
        min-height:250px!important;
        width:100%!important;
        margin:12px 0!important;
        padding:32px 20px 28px!important;
        box-sizing:border-box!important;
        overflow:hidden!important;
        text-align:center!important;
      }

      .loading-state-enter::before,
      .loading-state-enter::after{
        content:"";
        position:absolute;
        left:50%;
        top:50%;
        border-radius:50%;
        transform:translate(-50%,-50%);
        pointer-events:none;
      }

      .loading-state-enter::before{
        width:190px;
        height:190px;
        border:1px solid color-mix(in oklab,var(--color-primary) 9%,transparent);
        animation:sz-target-aura 2.8s ease-in-out infinite;
      }

      .loading-state-enter::after{
        width:142px;
        height:142px;
        border:1px solid color-mix(in oklab,var(--color-cyan) 7%,transparent);
        animation:sz-target-aura 2.8s .8s ease-in-out infinite;
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

      /* Ícone baseado diretamente na segunda referência enviada:
         alvo circular + anéis segmentados + ponteiro diagonal.
         O SVG é transparente; somente o desenho laranja é renderizado. */
      .loading-state-spinner{
        position:relative!important;
        z-index:3!important;
        display:block!important;
        width:108px!important;
        height:108px!important;
        min-width:108px!important;
        min-height:108px!important;
        aspect-ratio:1/1!important;
        margin:0 auto 20px!important;
        padding:0!important;
        box-sizing:border-box!important;
        border:0!important;
        border-radius:50%!important;
        overflow:visible!important;
        background-color:transparent!important;
        background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200' fill='none'%3E%3Cg stroke='%23ffab00' stroke-width='12' stroke-linecap='round'%3E%3Cpath d='M100 18a82 82 0 0 1 58 24'/%3E%3Cpath d='M170 57a82 82 0 0 1 12 48'/%3E%3Cpath d='M174 126a82 82 0 0 1-33 43'/%3E%3Cpath d='M117 181a82 82 0 0 1-51-10'/%3E%3Cpath d='M47 151a82 82 0 0 1-27-45'/%3E%3Cpath d='M20 82a82 82 0 0 1 25-49'/%3E%3Cpath d='M59 24a82 82 0 0 1 34-7'/%3E%3C/g%3E%3Cg stroke='%23ffab00' stroke-width='12' stroke-linecap='round'%3E%3Cpath d='M100 50a50 50 0 0 1 36 15'/%3E%3Cpath d='M151 82a50 50 0 0 1-2 35'/%3E%3Cpath d='M132 137a50 50 0 0 1-35 13'/%3E%3Cpath d='M67 137a50 50 0 0 1-17-27'/%3E%3Cpath d='M50 88a50 50 0 0 1 16-27'/%3E%3Cpath d='M82 51a50 50 0 0 1 18-1'/%3E%3C/g%3E%3Ccircle cx='100' cy='100' r='25' fill='%23ffab00'/%3E%3Ccircle cx='100' cy='100' r='7' fill='%2307111f' stroke='none'/%3E%3Cpath d='M100 100L151 54' stroke='%23ffab00' stroke-width='11' stroke-linecap='round'/%3E%3Ccircle cx='154' cy='51' r='12' fill='%23ffab00' stroke='none'/%3E%3C/svg%3E")!important;
        background-repeat:no-repeat!important;
        background-position:center!important;
        background-size:contain!important;
        box-shadow:0 0 34px -12px color-mix(in oklab,var(--color-primary) 90%,transparent)!important;
        animation:sz-target-spin 3.2s linear infinite!important;
        transform-origin:50% 50%!important;
        will-change:transform;
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
        background-size:contain!important;
        opacity:0!important;
      }

      .loading-state-spinner::before{
        animation:sz-target-fragment-a 3.2s linear infinite!important;
      }

      .loading-state-spinner::after{
        animation:sz-target-fragment-b 3.2s linear infinite!important;
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
        34%{transform:rotate(122deg) scale(1);opacity:1;filter:none}
        47%{transform:rotate(169deg) scale(.985);opacity:.62;filter:blur(.6px)}
        55%{transform:rotate(198deg) scale(1);opacity:.94;filter:blur(.2px)}
        100%{transform:rotate(360deg) scale(1);opacity:1;filter:none}
      }

      @keyframes sz-target-fragment-a{
        0%,42%,100%{opacity:0;transform:rotate(0deg) translate(0,0)}
        47%{opacity:.72;transform:rotate(17deg) translate(3px,-2px)}
        54%{opacity:.45;transform:rotate(31deg) translate(-3px,2px)}
        62%{opacity:0;transform:rotate(44deg) translate(0,0)}
      }

      @keyframes sz-target-fragment-b{
        0%,44%,100%{opacity:0;transform:rotate(0deg) translate(0,0)}
        49%{opacity:.66;transform:rotate(-14deg) translate(-3px,2px)}
        56%{opacity:.42;transform:rotate(-27deg) translate(3px,-2px)}
        64%{opacity:0;transform:rotate(-40deg) translate(0,0)}
      }

      @keyframes sz-target-aura{
        0%,100%{opacity:.12;transform:translate(-50%,-50%) scale(.82)}
        50%{opacity:.38;transform:translate(-50%,-50%) scale(1.08)}
      }

      @keyframes loading-progress{
        0%{transform:translateX(-140%);opacity:0}
        15%{opacity:1}
        85%{opacity:1}
        100%{transform:translateX(460%);opacity:0}
      }

      @media(max-width:640px){
        .loading-state-enter{
          min-height:225px!important;
          margin:8px 0!important;
          padding:26px 16px 22px!important;
        }
        .loading-state-spinner{
          width:88px!important;
          height:88px!important;
          min-width:88px!important;
          min-height:88px!important;
          margin-bottom:17px!important;
        }
        .loading-state-enter::before{width:160px;height:160px}
        .loading-state-enter::after{width:124px;height:124px}
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
