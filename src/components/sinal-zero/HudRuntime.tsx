import { useEffect } from "react";

const LOADING_STYLE_ID = "sinal-zero-loading-fix";

export function HudRuntime() {
  useEffect(() => {
    if (document.getElementById(LOADING_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = LOADING_STYLE_ID;
    style.textContent = `
      .loading-state-enter{position:relative!important;isolation:isolate!important;display:flex!important;align-items:center!important;justify-content:center!important;min-height:250px!important;width:100%!important;margin:12px 0!important;padding:32px 20px 28px!important;box-sizing:border-box!important;overflow:hidden!important;text-align:center!important}
      .loading-state-enter::before,.loading-state-enter::after{content:"";position:absolute;left:50%;top:50%;width:170px;height:170px;border-radius:50%;transform:translate(-50%,-50%);pointer-events:none}
      .loading-state-enter::before{border:1px solid color-mix(in oklab,var(--color-primary) 10%,transparent);animation:sz-target-aura 2.8s ease-in-out infinite}
      .loading-state-enter::after{width:118px;height:118px;border:1px solid color-mix(in oklab,var(--color-cyan) 8%,transparent);animation:sz-target-aura 2.8s .8s ease-in-out infinite}
      .loading-state-content{position:relative!important;z-index:2!important;width:min(100%,560px)!important;margin:0 auto!important;padding:0!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;text-align:center!important;box-sizing:border-box!important;gap:0!important}
      .loading-state-content>*{flex:0 0 auto!important;margin-left:auto!important;margin-right:auto!important}
      .loading-state-spinner{position:relative!important;z-index:3!important;display:block!important;width:86px!important;height:86px!important;min-width:86px!important;min-height:86px!important;aspect-ratio:1/1!important;margin:0 auto 20px!important;padding:0!important;box-sizing:border-box!important;border:0!important;border-radius:50%!important;overflow:hidden!important;clip-path:circle(50% at 50% 50%)!important;background-color:transparent!important;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200' fill='none'%3E%3Cg stroke='%23ffab00' stroke-width='13' stroke-linecap='round'%3E%3Cpath d='M34 122a68 68 0 0 1 0-44'/%3E%3Cpath d='M46 45a68 68 0 0 1 66-10'/%3E%3Cpath d='M153 48a68 68 0 0 1 15 19'/%3E%3Cpath d='M171 88a68 68 0 0 1-11 60'/%3E%3Cpath d='M145 163a68 68 0 0 1-56 2'/%3E%3Cpath d='M59 145a68 68 0 0 1-16-22'/%3E%3Cpath d='M68 113a45 45 0 0 1-1-27'/%3E%3Cpath d='M76 68a45 45 0 0 1 48-5'/%3E%3Cpath d='M135 73a45 45 0 0 1 8 14'/%3E%3Cpath d='M143 101a45 45 0 0 1-6 34'/%3E%3Cpath d='M119 147a45 45 0 0 1-42-13'/%3E%3C/g%3E%3Cg stroke='%23ffab00' stroke-linecap='round'%3E%3Cpath d='M99 100 145 58' stroke-width='11'/%3E%3Ccircle cx='149' cy='54' r='10' fill='%23ffab00' stroke='none'/%3E%3Ccircle cx='99' cy='100' r='25' fill='%23ffab00' stroke='none'/%3E%3Ccircle cx='99' cy='100' r='7' fill='%2307111f' stroke='none'/%3E%3C/g%3E%3C/svg%3E")!important;background-repeat:no-repeat!important;background-position:center!important;background-size:contain!important;box-shadow:0 0 34px -12px color-mix(in oklab,var(--color-primary) 90%,transparent)!important;animation:sz-target-spin-shatter 3s linear infinite!important;transform-origin:50% 50%!important;will-change:transform,opacity,filter}
      .loading-state-spinner::before,.loading-state-spinner::after{content:""!important;position:absolute!important;inset:0!important;width:100%!important;height:100%!important;border-radius:50%!important;pointer-events:none!important;background:inherit!important;background-repeat:no-repeat!important;background-position:center!important;background-size:contain!important;opacity:0!important;clip-path:circle(50% at 50% 50%)!important}
      .loading-state-spinner::before{animation:sz-target-fragment-a 3s linear infinite!important}
      .loading-state-spinner::after{animation:sz-target-fragment-b 3s linear infinite!important}
      .loading-state-title,.loading-state-subtitle,.loading-state-progress,.loading-state-steps{position:relative!important;z-index:3!important;width:100%!important;max-width:100%!important;box-sizing:border-box!important;text-align:center!important}
      .loading-state-title{margin:0 0 8px!important;line-height:1.35!important;font-weight:700!important;letter-spacing:.01em!important}
      .loading-state-subtitle{margin:0 0 20px!important;line-height:1.5!important}
      .loading-state-progress{margin:0 auto 18px!important}.loading-state-steps{margin:0 auto!important}
      .loading-state-enter .loading-progress{width:min(100%,340px);height:2px;margin:0 auto 18px;overflow:hidden;border-radius:99px;background:color-mix(in oklab,var(--color-primary) 9%,transparent)}
      .loading-state-enter .loading-progress::after{content:"";display:block;width:30%;height:100%;border-radius:inherit;background:linear-gradient(90deg,transparent,var(--color-primary),var(--color-cyan),transparent);animation:loading-progress 1.2s ease-in-out infinite}
      @keyframes sz-target-spin-shatter{0%,100%{transform:rotate(0deg) scale(1);opacity:1;filter:none}15%{transform:rotate(54deg) scale(1);opacity:1;filter:none}38%{transform:rotate(137deg) scale(1);opacity:.92;filter:blur(.4px)}48%{transform:rotate(173deg) scale(1);opacity:.55;filter:blur(1px)}58%{transform:rotate(209deg) scale(1);opacity:.92;filter:blur(.4px)}82%{transform:rotate(295deg) scale(1);opacity:1;filter:none}}
      @keyframes sz-target-fragment-a{0%,42%,100%{opacity:0;transform:rotate(0deg) translate(0,0)}48%{opacity:.75;transform:rotate(18deg) translate(2px,-1px)}54%{opacity:.5;transform:rotate(32deg) translate(-2px,1px)}60%{opacity:0;transform:rotate(45deg) translate(0,0)}}
      @keyframes sz-target-fragment-b{0%,44%,100%{opacity:0;transform:rotate(0deg) translate(0,0)}50%{opacity:.65;transform:rotate(-15deg) translate(-2px,1px)}56%{opacity:.45;transform:rotate(-28deg) translate(2px,-1px)}62%{opacity:0;transform:rotate(-40deg) translate(0,0)}}
      @keyframes sz-target-aura{0%,100%{opacity:.15;transform:translate(-50%,-50%) scale(.82)}50%{opacity:.42;transform:translate(-50%,-50%) scale(1.08)}}
      @keyframes loading-progress{0%{transform:translateX(-140%);opacity:0}15%{opacity:1}85%{opacity:1}100%{transform:translateX(460%);opacity:0}}
      @media(max-width:640px){.loading-state-enter{min-height:225px!important;margin:8px 0!important;padding:26px 16px 22px!important}.loading-state-spinner{width:72px!important;height:72px!important;min-width:72px!important;min-height:72px!important;margin-bottom:17px!important}.loading-state-enter::before{width:145px;height:145px}.loading-state-enter::after{width:100px;height:100px}}
      @media(prefers-reduced-motion:reduce){.loading-state-enter::before,.loading-state-enter::after,.loading-state-spinner,.loading-state-spinner::before,.loading-state-spinner::after{animation:none!important}.loading-state-spinner{opacity:1!important;transform:none!important;filter:none!important}.loading-state-spinner::before,.loading-state-spinner::after{opacity:0!important}}
    `;
    document.head.appendChild(style);
    return () => document.getElementById(LOADING_STYLE_ID)?.remove();
  }, []);
  return null;
}
