/* ══ 🗂️ ข้อย่อยชั้นที่ 3 ของแผงเมนู — รายการที่ "หน้า" รู้ตอนรัน (2026-11-24 · คำสั่ง user: S401/S403… เป็นหัวข้อย่อยใต้ Stock) ══
   ชั้นที่ 2 (แท็บ) เป็นทะเบียนตายตัว `navSubTabs.js` · ชั้นที่ 3 มาจากข้อมูลจริงของหน้า (เช่นพื้นที่ SAP ที่มีของในขอบเขตที่เห็น)
   ⇒ หน้าที่เปิดอยู่ประกาศผ่าน `useNavSubItems()` · แผงเมนูอ่านด้วย `useNavSubItemsStore()` · หน้าปิด = ล้างเอง
   · ไม่ได้เปิดหน้านั้น = ไม่มีชั้นที่ 3 (ไม่เดารายการ) · item = { key, label } · กด = ตั้ง `?<query>=<key>` ที่หน้านั้น */
import { useEffect, useSyncExternalStore } from 'react';

let state = {};                 // `${path}|${tab}` → { query, items }
const subs = new Set();
const emit = () => subs.forEach(fn => fn());

export function setNavSubItems(path, tab, query, items) {
  const k = `${path}|${tab}`;
  if (!items) { if (!(k in state)) return; const { [k]: _drop, ...rest } = state; state = rest; emit(); return; }
  state = { ...state, [k]: { query, items } };
  emit();
}

export function useNavSubItemsStore() {
  return useSyncExternalStore(fn => { subs.add(fn); return () => subs.delete(fn); }, () => state, () => state);
}

/* `items` ต้องเป็นค่าที่ useMemo แล้ว · ส่ง null = ไม่มีชั้นที่ 3 ตอนนี้ */
export function useNavSubItems(path, tab, query, items) {
  const sig = items ? items.map(i => `${i.key}\u0001${i.label}`).join('\u0002') : null;
  useEffect(() => {
    setNavSubItems(path, tab, query, items);
    return () => setNavSubItems(path, tab, query, null);
  }, [path, tab, query, sig]);   // eslint-disable-line react-hooks/exhaustive-deps
}
