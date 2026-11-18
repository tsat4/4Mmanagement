import { useRef } from 'react';
import useScrollEdges from '../utils/useScrollEdges';

/* ══ ↔️ ScrollRow — แถวเลื่อนแนวนอนที่ "บอกว่ายังมีต่อ" (2026-11-18 · audit กฎ Closure: ProductionPlan แถบวันตัดพอดีขอบ) ═══
   <ScrollRow bg="var(--card)" style={{ gap: 3 }}>…ลูกที่ flexShrink:0…</ScrollRow>
   · กล่องเลื่อนเอง (overflowX:auto · display:flex) + ขอบจางซ้าย/ขวาเฉพาะด้านที่ยังมีของซ่อน (useScrollEdges)
   · `bg` = สีพื้นที่แถวนี้วางอยู่ (ขอบจางต้องกลืนกับพื้นหลังจริง: ในการ์ด = var(--card) · บนหน้า = var(--bg))
   · ไม่ล้น = ไม่มีขอบจาง = หน้าตาเดิมเป๊ะ (จอคอม/มือถือใช้ตัวเดียวกัน)
   ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
export default function ScrollRow({ children, bg = 'var(--card)', style, className, innerStyle, ...rest }) {
  const ref = useRef(null);
  const edges = useScrollEdges(ref);
  return (
    <div className={className} style={{ position: 'relative', minWidth: 0, '--hs-bg': bg, ...style }} {...rest}>
      <div ref={ref} style={{ display: 'flex', overflowX: 'auto', WebkitOverflowScrolling: 'touch', ...innerStyle }}>{children}</div>
      {edges.left && <span aria-hidden="true" className="hs-fade-l" />}
      {edges.right && <span aria-hidden="true" className="hs-fade-r" />}
    </div>
  );
}
