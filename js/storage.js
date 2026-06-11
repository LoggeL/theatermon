/* ================================================================
   storage — Abstraktion über localStorage

   Einzige Stelle im Spiel, die Persistenz anfasst. Die API ist
   bewusst schmal gehalten; Konsument ist ausschließlich state.js.
================================================================ */

const SAVE_KEY = 'theatermon-ramsen';

/**
 * Liest den gespeicherten Spielstand.
 * @returns {object|null} Das geparste Save-Objekt oder null,
 *          wenn kein (lesbarer) Spielstand existiert.
 */
export function readSave(){
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY));
  } catch(e){ return null; }
}

/**
 * Schreibt den Spielstand.
 * @param {object} obj Serialisierbares Save-Objekt (siehe save() in state.js).
 */
export function writeSave(obj){
  localStorage.setItem(SAVE_KEY, JSON.stringify(obj));
}

/** Löscht den Spielstand (Reset-Knopf im Ensemble-Menü). */
export function clearSave(){
  localStorage.removeItem(SAVE_KEY);
}

/**
 * Liest ein einfaches Flag (z.B. 'theatermon-tut' = Tutorial gesehen).
 * @param {string} key
 * @returns {string|null}
 */
export function readFlag(key){
  return localStorage.getItem(key);
}

/**
 * Setzt ein einfaches Flag.
 * @param {string} key
 * @param {string} [value='1']
 */
export function writeFlag(key, value = '1'){
  localStorage.setItem(key, value);
}
