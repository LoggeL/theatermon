/* ================================================================
   helpers — reine Helfer ohne Spiel-/DOM-Zustand
================================================================ */
export const $ = id => document.getElementById(id);
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export function tween(ms, fn){
  return new Promise(res => {
    const t0 = performance.now();
    (function step(t){
      const k = Math.min(1, (t - t0) / ms);
      fn(k);
      if (k < 1) requestAnimationFrame(step); else res();
    })(t0);
  });
}
export function hashStr(s){ let h = 1779033703; for (let i=0;i<s.length;i++){ h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h<<13)|(h>>>19);} return h>>>0; }
export function mulberry(seed){ return function(){ seed|=0; seed = seed+0x6D2B79F5|0; let t = Math.imul(seed^(seed>>>15),1|seed); t = t+Math.imul(t^(t>>>7),61|t)^t; return ((t^(t>>>14))>>>0)/4294967296; }; }
export const pick = (rng, arr) => arr[Math.floor(rng()*arr.length)];
