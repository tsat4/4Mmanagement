/* ══ 💳 "ใบ MO นี้ลง I/O ไหน" — ตอบที่เดียว ══════════════════════════  2026-11-18
   หน้างานแจ้ง (PDF 18/11 ข้อ 4): *"MO ที่ส่งมาจาก Downtime จะไม่มี I/O ขึ้น
   ทั้งที่มีการผูกในระบบแล้ว"* (ใบจริง O-MTN.2026/11-42 · เครื่อง RB-123)

   ── ที่มา (วัดจริง 18/11 · ฐาน DR) ────────────────────────────────────────────
   `mtn_orders.io_no` ถูกเติม**ทางเดียว**: ตอนเลือกเครื่องในฟอร์มแจ้งซ่อม ระบบก๊อป
   `machines.io_no` ลงช่องให้ (MtnRepair.jsx · "เติมเฉพาะตอนช่องยังว่าง")
   ⇒ ใบที่ระบบเปิดเองตอนกดเรียกช่าง (trigger `trg_dt_call_mtn_opens_mo`) **ไม่เคยผ่านฟอร์ม**
     = ไม่มี I/O สักใบ (1,175 ใบใน 90 วัน · ไม่มี I/O ทั้ง 1,175)
   และฝั่งใบที่เปิดจากฟอร์มเองก็ว่าง 951 จาก 974 (คนพิมพ์ชื่อเครื่องเอง/เครื่องยังไม่มีเลขตอนนั้น)
   สรุป 90 วัน: ใบที่มี I/O จริง **27 ใบ** · ใบที่ทะเบียนเครื่องตอบให้ได้ทันที **1,242 ใบ**

   ── 🔴 กฎของไฟล์นี้ ───────────────────────────────────────────────────────────
   1. **ค่าที่กรอกในใบชนะเสมอ** — คนตั้งใจพิมพ์เลขอื่น (ลงหน่วยอื่น/งานพิเศษ) ห้ามทับ
   2. **ทะเบียนเครื่องเป็น "ตัวเติม" ไม่ใช่การเดา** — I/O เป็นสมบัติของเครื่อง ไม่ใช่ของใบ
      ⇒ ตอบจากทะเบียนได้เมื่อ `machine_key()` ชี้ไปที่ **เลขเดียวชัดเจน**
      🔴 ทะเบียนเขียนเลขเครื่องซ้ำแล้ว I/O ไม่ตรงกัน = **ไม่ตอบ** (ให้คนลบตัวซ้ำก่อน · กฎ machineNo.js)
   3. **ยังไม่ได้โหลดทะเบียน ≠ เครื่องนี้ไม่มี I/O** — ส่ง `machines` เป็น null/undefined
      ต้องได้ `unknown: true` เพื่อให้จอ/ไฟล์เขียนกำกับ **ห้ามปล่อยว่างเหมือนไม่มีเลข**
   4. **ห้าม backfill เขียนกลับฐาน** — ทะเบียนแก้เมื่อไหร่ใบเก่าต้องตามไปด้วย
      (เขียนลงใบ = แช่ค่าเก่าไว้ แล้วใบกับทะเบียนเถียงกันเงียบๆ)                        */
import { machineKey } from './machineNo.js';

const txt = (v) => String(v ?? '').trim();

/**
 * สร้างดัชนี "เลขเครื่อง → I/O" จากทะเบียน (เรียกครั้งเดียวต่อชุด ไม่ใช่ต่อแถว)
 * 🔴 คีย์ที่ทะเบียนเขียนไว้หลายแถวและ I/O ไม่ตรงกัน = ใส่ `null` (ชี้ไม่ได้ชัด ห้ามเดา)
 */
export function buildIoIndex(machines) {
  if (!Array.isArray(machines)) return null;        // ยังไม่โหลด = ไม่รู้ (กฎข้อ 3)
  const idx = new Map();
  for (const m of machines) {
    const k = machineKey(m?.machine_no);
    const io = txt(m?.io_no);
    if (!k || !io) continue;
    if (idx.has(k) && idx.get(k) !== io) idx.set(k, null);   // ชนกัน = ตอบไม่ได้
    else if (!idx.has(k)) idx.set(k, io);
  }
  return idx;
}

/**
 * I/O ของใบนี้
 * @param {object} order แถวใบ MO (ต้องมี `io_no` · `machine_no`)
 * @param {Map|Array|null} machinesOrIdx ทะเบียนเครื่อง หรือดัชนีจาก `buildIoIndex()`
 * @returns {{ value: string|null, source: 'order'|'machine'|null, unknown: boolean }}
 *   `unknown: true` = ยังไม่รู้ (ไม่ได้โหลดทะเบียน / ไม่ได้ select `io_no` ของใบ) ⇒ จอต้องเขียนกำกับ
 */
export function ioNoOf(order, machinesOrIdx = null) {
  const own = txt(order?.io_no);
  if (own) return { value: own, source: 'order', unknown: false };
  /* 🔴 ไม่ได้ select `io_no` ของใบมา ≠ "ใบนี้ไม่มีเลข" — ตอบไม่รู้ (กฎเขียน DB ข้อ 12) */
  const ownKnown = !!order && 'io_no' in order;
  const idx = machinesOrIdx instanceof Map ? machinesOrIdx : buildIoIndex(machinesOrIdx);
  if (!idx) return { value: null, source: null, unknown: true };
  const k = machineKey(order?.machine_no);
  const hit = k ? idx.get(k) : undefined;
  if (hit) return { value: hit, source: 'machine', unknown: false };
  /* ทะเบียนตอบแล้วว่าไม่มี — แต่ถ้าใบเองยังไม่รู้ ก็ยังตอบ "ไม่รู้" ไม่ใช่ "ไม่มี" */
  return { value: null, source: null, unknown: !ownKnown };
}

export default { buildIoIndex, ioNoOf };
