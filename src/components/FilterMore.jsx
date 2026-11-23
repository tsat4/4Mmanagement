import { useLayoutEffect, useRef, useState } from 'react';
import useIsMobile from '../utils/useIsMobile';
import { tr } from '../utils/i18n';
import { activeLabels } from './MobileFilterFold';

/* ══ 🧰 FilterMore — "ตัวกรองเพิ่มเติม" ของจอคอม (2026-11-18 · audit กฎ Choice overload: /mtn-repair มี 25 control บนแถบกรอง) ═══
   หลัก (NN/g progressive disclosure): แถบกรองโชว์เฉพาะตัวที่ใช้ทุกวัน · ตัวที่นานๆ ใช้ (ไลน์ · กะ · ประเภท · รอขั้น · งาน PR …)
   อยู่หลังปุ่มเดียว "▸ ตัวกรองเพิ่มเติม" — กดแล้วกางออก **ในแถวเดียวกัน** (display:contents) ไม่ใช่ dropdown ลอย

   กติกาความซื่อสัตย์ (กฎ "กรองแถวออกแล้วต้องเขียนบนจอ"):
   · ตัวกรองที่พับอยู่แต่ **ตั้งค่าไว้** ⇒ ปุ่มต้องบอกจำนวน (`· 2`) และชื่อค่าที่ตั้ง (title) — คนต้องรู้ว่ารายการหายเพราะอะไร
   · เปิดหน้ามาโดยมีตัวกรองที่พับตั้งค่าอยู่แล้ว (ลิงก์/กระดิ่ง) ⇒ ผู้เรียกส่ง `defaultOpen` ให้กางไว้เลย
   · `attention` = ข้อความเตือนของตัวกรองที่พับ (เช่น "งาน PR รอ 3 ใบ") ⇒ ปุ่มเป็นสีเหลือง — สัญญาณที่เคยอยู่บนช่องต้องไม่หายไปกับการพับ
   · ซ่อนด้วย display:none **ไม่ unmount** ⇒ ค่าที่เลือก/สถานะภายในคงอยู่
   · 📱 มือถือ = ส่งลูกผ่านตรงๆ (MobileFilterFold พับทั้งแถบอยู่แล้ว — ไม่ซ้อนพับ 2 ชั้น · จอมือถือไม่เปลี่ยน)

   ใช้: (ใน children ของ <TimeRangeBar>/<FilterBar> วางหลังตัวกรองหลัก ก่อน <SearchInput>)
     <FilterMore id="mo-more" defaultOpen={!!(fLine || fPr)} attention={prWaiting ? `งาน PR รอ ${prWaiting} ใบ` : null}>
       <LineSelect …/> <Segmented …/> <select …/>
     </FilterMore>
   ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
export default function FilterMore({ children, label = 'ตัวกรองเพิ่มเติม', defaultOpen = false, attention = null, id }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(!!defaultOpen);
  const bodyRef = useRef(null);
  const [active, setActive] = useState([]);
  // อ่านค่าที่ตั้งไว้จาก DOM ทุก render (ตัวกรองเป็น controlled ⇒ แม่ re-render ทุกครั้งที่ค่าเปลี่ยน) · set เฉพาะเมื่อเปลี่ยนจริง
  useLayoutEffect(() => {
    const a = activeLabels(bodyRef.current);
    setActive(prev => (prev.length === a.length && prev.every((x, i) => x === a[i]) ? prev : a));
  });
  if (isMobile) return <>{children}</>;
  const n = active.length;
  const warn = !!attention && !n;
  return (
    <>
      <button type="button" className="pg-btn sm" aria-expanded={open} aria-controls={id} data-filter-more-btn="1"
        onClick={() => setOpen(o => !o)}
        title={n ? `${tr('ตั้งไว้')}: ${active.join(' · ')}` : (attention || tr('เปิดตัวกรองที่นานๆ ใช้'))}
        style={{ height: 'var(--ctl-h)', ...(warn ? { borderColor: 'var(--amber)', color: 'var(--amber)', fontWeight: 700 } : null) }}>
        {open ? '▾' : '▸'} {tr(label)}{n ? ` · ${n}` : ''}{warn ? ' ⚠' : ''}
      </button>
      <div id={id} ref={bodyRef} data-filter-more="1" style={{ display: open ? 'contents' : 'none' }}>{children}</div>
    </>
  );
}
