/* ══ 🎨 cssColor — แปลงสีที่เป็น token (`var(--green)`) ให้เป็น hex สำหรับโค้ดที่ต้อง "คำนวณสี" เอง (2026-11-18) ═══
   ที่มา: ผัง 3D (`MapPillars3D`) คำนวณเฉดผนังกล่องด้วย `shade(hex)` ที่ parse ได้แต่ `#rrggbb` — แต่ทะเบียนสีสถานะ
   (`CAT` ใน FactoryMap) เป็น `var(--green)` ฯลฯ ⇒ parseInt ได้ NaN ⇒ **ทุกกล่องที่ไม่ใช่ idle วาดเป็นสีดำ** (user ทัก 18/11)
   — มีแต่ idle ที่เป็น hex ตรงๆ เลยรอด · ป้ายข้างบนใช้ CSS var ตรงๆ จึงถูกสี ทำให้ดูเหมือน "กล่องดำแต่ป้ายถูก"

   กติกา:
   · อ่านค่า token จาก `:root` ตอนเรียก (ธีมมืด/สว่างได้ค่าตามธีมปัจจุบัน) · อ่านไม่ได้/ไม่ใช่ hex = คืน fallback (เทา) **ไม่ใช่ดำ**
   · รับ `#rgb` `#rrggbb` `rgb(r,g,b)` `var(--x)` `var(--x, #fallback)` · อย่างอื่น = fallback
   · pure: `readVar` ฉีดเข้ามาได้ (เทส) — ค่า default อ่าน getComputedStyle(document.documentElement)
   ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */

export const FALLBACK_HEX = '#6b7280';

const hex2 = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');

const defaultReadVar = (name) => (typeof document !== 'undefined' && typeof getComputedStyle === 'function'
  ? getComputedStyle(document.documentElement).getPropertyValue(name)
  : '');

/** คืน `#rrggbb` เสมอ (ตัวพิมพ์เล็ก) · แปลงไม่ได้ = FALLBACK_HEX */
export function cssColorToHex(value, readVar = defaultReadVar, depth = 0) {
  const v = String(value ?? '').trim();
  if (!v || depth > 3) return FALLBACK_HEX;
  let m = v.match(/^#([0-9a-f]{3})$/i);
  if (m) return '#' + m[1].split('').map(c => c + c).join('').toLowerCase();
  m = v.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i);
  if (m) return '#' + m[1].toLowerCase();
  m = v.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (m) return '#' + hex2(+m[1]) + hex2(+m[2]) + hex2(+m[3]);
  m = v.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)$/i);
  if (m) {
    const got = String(readVar(m[1]) ?? '').trim();
    if (got) return cssColorToHex(got, readVar, depth + 1);
    return m[2] ? cssColorToHex(m[2], readVar, depth + 1) : FALLBACK_HEX;
  }
  return FALLBACK_HEX;
}
