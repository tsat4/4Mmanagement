import { useLayoutEffect, useState } from 'react';

/* ══ ↔️ useScrollEdges — "แถวนี้เลื่อนต่อได้อีกไหม" ของกล่องที่เลื่อนแนวนอน (2026-11-18 · audit กฎ Closure บนมือถือ) ═══
   คืน { left, right } = ยังมีของซ่อนอยู่ทางซ้าย/ขวา (เลื่อนไปสุดแล้ว = false) · วัดจาก scrollLeft/scrollWidth จริง
   ใช้วาด "ขอบจาง" (`.hs-fade-l/.hs-fade-r` ใน index.css) ให้ตาเห็นว่าแถวยังไม่จบ — กฎ Closure: ของที่ถูกตัดครึ่งบอกว่า "ปัดต่อได้"
   แต่แถวที่ชิ้นสุดท้ายพอดีขอบ (แท็บ/ชิป/ช่องวัน 40px) ไม่มีอะไรโผล่ให้เห็น ⇒ ขอบจางทำหน้าที่แทน
   · ติดตาม scroll + resize + ลูกเปลี่ยนขนาด (ResizeObserver) · ไม่มี element/ไม่ล้น = false ทั้งคู่ (ไม่วาดอะไร = จอเดิมเป๊ะ)
   ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
export default function useScrollEdges(ref, deps = []) {
  const [edges, setEdges] = useState({ left: false, right: false });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => {
      const over = el.scrollWidth - el.clientWidth;
      const next = { left: over > 2 && el.scrollLeft > 2, right: over > 2 && el.scrollLeft < over - 2 };
      setEdges(prev => (prev.left === next.left && prev.right === next.right ? prev : next));
    };
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    let ro;
    if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(measure); ro.observe(el); for (const c of el.children) ro.observe(c); }
    return () => { el.removeEventListener('scroll', measure); window.removeEventListener('resize', measure); if (ro) ro.disconnect(); };
  }, deps);   // eslint-disable-line react-hooks/exhaustive-deps
  return edges;
}
