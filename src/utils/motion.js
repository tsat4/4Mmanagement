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
