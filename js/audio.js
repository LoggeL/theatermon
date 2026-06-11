/* ================================================================
   audio (tiny synth)
================================================================ */
import { $ } from './util.js';

let AC = null, muted = false;
export function audioInit(){ if(!AC) AC = new (window.AudioContext||window.webkitAudioContext)(); }
export function beep(freq, dur=0.09, type='square', vol=0.05, when=0){
  if (muted || !AC) return;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, AC.currentTime + when);
  g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + when + dur);
  o.connect(g); g.connect(AC.destination);
  o.start(AC.currentTime + when); o.stop(AC.currentTime + when + dur + 0.02);
}
export const sfx = {
  click(){ beep(620, .06, 'square', .04); },
  hit(){ beep(160, .12, 'sawtooth', .07); beep(110, .14, 'sawtooth', .05, .04); },
  heal(){ [440,550,660].forEach((f,i)=>beep(f,.09,'triangle',.05,i*.08)); },
  faint(){ [300,240,180,120].forEach((f,i)=>beep(f,.1,'square',.05,i*.07)); },
  catchOk(){ [523,659,784,1046].forEach((f,i)=>beep(f,.12,'triangle',.06,i*.09)); },
  catchNo(){ beep(220,.18,'sawtooth',.05); },
  lvl(){ [523,659,784,880,1046].forEach((f,i)=>beep(f,.1,'square',.045,i*.07)); },
  encounter(){ [392,392,330,392].forEach((f,i)=>beep(f,.09,'square',.05,i*.1)); },
  fanfare(){ [523,523,523,659,784,1046].forEach((f,i)=>beep(f,.14,'triangle',.07,i*.13)); },
};
$('mute').addEventListener('click', () => { muted = !muted; $('mute').innerHTML = muted ? '&#x1F507;' : '&#x1F50A;'; });
