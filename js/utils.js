import { mountStatKeys } from './config.js';

// 通过元素 id 获取页面节点的简写工具。
export const $ = id => document.getElementById(id);

/** 将数值格式化为带正负号的文本。 */
export function fmtSigned(value) {
  // number 将无效或空值统一视为 0。
  const number = Number(value) || 0;
  return `${number > 0 ? '+' : ''}${number}`;
}

/** 转义 HTML 特殊字符，避免资料文本被当作标签解析。 */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
}

/** 将坐骑加成描述解析为属性键值对象。 */
export function parseMountModifiers(text) {
  // result 汇总同一属性在描述中出现的所有数值。
  const result = {};
  // pattern 同时匹配“5HP”和“HP5”两种资料书写顺序。
  const pattern = /(\d+)\s*(HP|魔防|魔|力|技|速|防|幸|魅)\s*%?|(HP|魔防|魔|力|技|速|防|幸|魅)\s*(\d+)\s*%?/g;
  for (const match of String(text || '').matchAll(pattern)) {
    // code 是属性简称，amount 是描述中对应的数值。
    const code = match[2] || match[3];
    const amount = Number(match[1] || match[4]);
    // key 是计算逻辑内部使用的属性键。
    const key = mountStatKeys[code];
    if (key) result[key] = (result[key] || 0) + amount;
  }
  return result;
}
