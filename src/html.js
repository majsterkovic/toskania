/**
 * Escapowanie treści wstawianej do HTML przez template literals.
 * Jedno miejsce dla całego projektu — wcześniej istniały trzy warianty
 * (render.js, maps.js, short.js), z czego dwa nie escapowały apostrofu.
 */
const ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function esc(str) {
  if (str == null) return '';
  return String(str).replace(/[&<>"']/g, (c) => ENTITIES[c]);
}
