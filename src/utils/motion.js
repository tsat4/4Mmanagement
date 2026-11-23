/* ══ 🎞 motion — ของกลางเรื่อง "ขยับ" ชุดเดียวทั้งระบบ (2026-11-18 · user: "UX/UI เค้าสวยจัง … ก๊อปลุยเลย") ═══
   · `stagger(i)` = การ์ดโผล่แบบ fade-up ทีละชิ้น (เดิมอยู่ใน Dashboard.jsx ที่เดียว → ย้ายมาเป็นของกลาง
     ให้ DeptHub/หน้า dashboard อื่นใช้สูตรเดียวกัน ห้ามก๊อปซ้ำในหน้า)
   · `motionOff()` = ต้องนิ่ง: ผู้ใช้ตั้ง prefers-reduced-motion **หรือ** จอ TV/บอร์ด (`<html data-perf="lite">`
     — App.jsx ตั้งให้ role display) ⇒ ทุกตัวช่วยคืน "ไม่มี animation" เอง จอ TV ไม่ต้องรู้เรื่องนี้ (UI §2 "นิ่ง")
   · `railPill` = spring ของ pill เมนูที่ "ไหล" ไปตำแหน่งใหม่ (framer `layoutId`)
   ⚠️ ใช้กับของที่โผล่ครั้งเดียวตอนเข้าหน้า (≤ 6 ชิ้นแถวแรก) ไม่ใช่ของที่ re-render ทุกวินาที (Andon/นาฬิกา)
   ═══════════════════════════════════════════════════════════════════════════════════════════════════ */

export const prefersReduced = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const perfLite = () => typeof document !== 'undefined'
  && document.documentElement.getAttribute('data-perf') === 'lite';

export const motionOff = () => prefersReduced() || perfLite();

export const FADE_UP = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } };

/** props สำหรับ `<motion.div {...stagger(i)}>` — i = ลำดับชิ้น (0,1,2…) · นิ่งเมื่อ motionOff() */
export const stagger = (i) => (motionOff()
  ? { initial: false }
  : { ...FADE_UP, transition: { delay: i * 0.06, duration: 0.35 } });

/** transition ของ pill ที่ไหลตามเมนูที่เลือก (layoutId) — นิ่งเมื่อ motionOff() */
export const railPill = () => (motionOff()
  ? { duration: 0 }
  : { type: 'spring', stiffness: 520, damping: 42, mass: 0.8 });

/* ══ 📈 อนิเมชันกราฟ — มาตรฐานเดียวทั้งระบบ (2026-11-20 · user: "อนิเมชั่นกราฟสวยๆ … ต้องมีมาตรฐานและใช้เหมือนกันทั้งหมด") ══
   ที่มา: จอ Node-RED OEE — แท่งยืดขึ้น/เส้นวิ่ง/วงหมุนตอนเปิดหน้า
   🔴 กฎ: กราฟ Recharts ทุก series ใส่ `{...chartAnim()}` — **ห้ามเขียน `isAnimationActive` เองในหน้า** (ด่าน `chart-anim-shared`)
   · เล่น "ครั้งเดียว" ตอนเข้าหน้า หรือเปลี่ยนสิ่งที่ดู (URL เปลี่ยน: กะ/วัน/เครื่อง/แท็บ) — App.jsx เรียก `markView()` ให้
   · รีเฟรชข้อมูลทุกนาที (URL ไม่เปลี่ยน) = **ไม่เล่นซ้ำ** (เดิม Recharts ค่าเริ่มต้นเล่นทุกครั้งที่ข้อมูลเปลี่ยน = จอกระตุกทุกรอบ)
   · หน้าต่าง CHART_ANIM_WINDOW_MS เผื่อข้อมูลมาช้าหลังเปิดหน้า (กราฟที่ mount ในหน้าต่างนี้ยังได้เล่น)
   · นิ่งเสมอเมื่อ `motionOff()` (จอ TV role display / prefers-reduced-motion) — ตาม UI §2 "จอ TV นิ่ง"
   ═══════════════════════════════════════════════════════════════════════════════════════════════════ */
export const CHART_ANIM_MS = 800;
export const CHART_ANIM_WINDOW_MS = 4000;
let viewStartedAt = -Infinity;

/** เรียกเมื่อ "สิ่งที่ดู" เปลี่ยน (App.jsx ผูกกับ pathname+search) — เปิดหน้าต่างให้กราฟเล่นอนิเมชัน */
export function markView(now = Date.now()) { viewStartedAt = now; }

/** props ของ series Recharts (`<Bar {...chartAnim()} />`) — เล่นเฉพาะในหน้าต่างหลังเปลี่ยนสิ่งที่ดู · นิ่งเมื่อ motionOff() */
export function chartAnim(now = Date.now()) {
  if (motionOff() || now - viewStartedAt > CHART_ANIM_WINDOW_MS) return { isAnimationActive: false };
  return { isAnimationActive: true, animationDuration: CHART_ANIM_MS, animationEasing: 'ease-out', animationBegin: 0 };
}

/** คลาส CSS ของแถบที่วาดเอง (div) ให้เล่นเหมือนกราฟ — 'sweep' = แถบเวลาวิ่งจากซ้าย · 'grow' = แท่งนอนยืดจากซ้าย
 *  กติกาเดียวกับ chartAnim() (เล่นครั้งเดียวต่อสิ่งที่ดู · นิ่งบนจอ TV/reduced-motion) · CSS อยู่ index.css `.anim-*` */
export function animClass(kind, now = Date.now()) {
  return chartAnim(now).isAnimationActive ? `anim-${kind}` : '';
}
