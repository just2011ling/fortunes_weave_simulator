import { mountStatKeys } from './config.js';

export const $ = id => document.getElementById(id);

export function fmtSigned(value) {
  const number = Number(value) || 0;
  return `${number > 0 ? '+' : ''}${number}`;
}

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
}

export function parseMountModifiers(text) {
  const result = {};
  const pattern = /(\d+)\s*(HP|魔防|魔|力|技|速|防|幸|魅)\s*%?|(HP|魔防|魔|力|技|速|防|幸|魅)\s*(\d+)\s*%?/g;
  for (const match of String(text || '').matchAll(pattern)) {
    const code = match[2] || match[3];
    const amount = Number(match[1] || match[4]);
    const key = mountStatKeys[code];
    if (key) result[key] = (result[key] || 0) + amount;
  }
  return result;
}
