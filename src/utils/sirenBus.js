/* ══ 🚨 sirenBus — "ตอนนี้มีเครื่องหยุดที่ไซเรนกำลังเตือนอยู่กี่เครื่อง" ให้ของลอยอื่นรู้ (2026-11-19) ══
   ที่มา: แชท AskBot บนมือถือเปิดเต็มจอ ⇒ บังแถบเตือนเครื่องหยุดของ `DowntimeSiren`
   (user เคาะแบบ ข: ระหว่างเปิดแชทให้ขึ้นแถบเล็กบนหัวกล่องแชทแทน)
   🔴 ห้ามให้ AskBot ยิงฐานหาเครื่องหยุดเอง — ไซเรนโหลดอยู่แล้ว (เฉพาะหน้าที่ mount ไซเรน)
      ยิงซ้ำทุกหน้า = egress เปล่า ⇒ ไซเรนเป็นคนประกาศ ของอื่นแค่ฟัง
   · ไม่มีไซเรนบนหน้านั้น = 0 = ไม่มีแถบ (ถูกต้อง: หน้านั้นไม่มีแถบเตือนให้บังอยู่แล้ว) */
let count = 0;
const subs = new Set();

export function publishSirenCount(n) {
  const v = Math.max(0, Number(n) || 0);
  if (v === count) return;
  count = v;
  subs.forEach(fn => { try { fn(v); } catch { /* ผู้ฟังพังต้องไม่ลากไซเรนพังตาม */ } });
}

export const sirenCount = () => count;

export function subscribeSiren(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}
