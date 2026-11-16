/* ══════════════════════════════════════════════════════════════════════════════
   🧩 "ของเสียแถวนี้เสียที่ชิ้นไหน" — พาร์ทลูก (child part) ของ `defect_logs`  (2026-11-16)

   ที่มา (user 2026-11-16): *"จาก daily report การลงของเสีย ต้องเลือก child part ได้
   บางทีไม่เสียทั้ง FG"* — ของจริงบางครั้งเสียแค่ชิ้นส่วนลูก 1 ตัว ไม่ใช่ทั้งชุด
   ⇒ `defect_logs.child_mat_no` / `child_part_name` / `child_qty_per_fg`
     (migration `20261116_defect_child_part_dr.sql` · nullable ทั้งชุด)

   ── 🔴🔴 กฎเหล็กของไฟล์นี้ — **พาร์ทลูกไม่ใช่ตัวแปรของ %Q/%P** ───────────────────────
   เลือกพาร์ทลูกแล้ว **ตัวเลขของกะไม่ขยับแม้แต่ตัวเดียว**:
     · `qty_ng`/`qty_suspect`/`qty_repair` ยังหมายถึง "จำนวนชิ้นที่คนนับได้" เหมือนเดิมเป๊ะ
     · %Q ยังหัก **1 ชิ้นต่อ 1 ชิ้น** ที่ MAT แม่ (`defectQty`/`sumDefectQty` ใน `oee.js`
       อ่านแค่ 3 คอลัมน์ qty + ทะเบียนถัง — ไม่เคยเห็นช่อง child เลย)
     · ตัวเศษ %P ยังผูกกับ MAT แม่ผ่าน `prod_orders.mat_no` (`ngByMatFrom`) เพราะ **CT ที่รู้
       คือ CT ของงานที่เครื่องกำลังเดิน** ไม่ใช่ CT ของชิ้นส่วนลูก (ลูกมักไม่มี CT ที่ไลน์นี้)
     · ตัวหารของ %Q (Total Count = ดี + เสีย + ทดลอง + สงสัย) **ไม่เปลี่ยน**
   🔴 `child_qty_per_fg` = สแนปช็อตอัตรา BOM ไว้ "ดูย้อนหลัง" เท่านั้น
      **ห้ามเอาไปคูณ/หารในสูตรใดๆ** — คำถาม *"ลูกเสีย N ชิ้น = FG เสียกี่ชิ้น"* และ
      *"ลูกเสียแล้ว FG ที่ประกอบเสร็จยังดีอยู่ไหม (เปลี่ยนชิ้นแล้วส่งได้)"* ยังไม่มีคำตอบจาก user
      ⇒ เดาแล้ว OEE เพี้ยนทั้งโรงงานย้อนหลัง (มีด่าน `defect-child-qty-not-in-oee`)

   pure ทั้งไฟล์ (ไม่แตะ supabase/react) · เทส `__tests__/defectChildPart.test.mjs`
   ══════════════════════════════════════════════════════════════════════════════ */

const str = (v) => String(v ?? '').trim();

/**
 * ของเสียแถวนี้ "เป็นของชิ้นไหน" — จุดเดียวที่ตอบคำถามนี้ (พาเรโต/ใบรายงาน/ป้ายบนจอ)
 * @param {object} d แถว `defect_logs` (embed `prod_orders(mat_no, part_name)` ถ้ามี)
 * @returns {{ mat: string|null, name: string|null, fgMat: string|null, isChild: boolean }}
 *   `mat`   = ชิ้นที่เสียจริง (ลูกถ้าเลือกไว้ · ไม่งั้น MAT แม่) — ใช้เป็นคีย์จัดกลุ่มพาเรโต
 *   `fgMat` = MAT แม่เสมอ (ยังต้องรู้ เพราะ %Q/%P ผูกกับตัวนี้)
 *   ⚠️ `mat` เป็น `null` ได้ (ของเสียที่ไม่ผูกใบผลิต) — จอต้องเขียนว่าชี้เป้าไม่ได้ ห้ามเดา
 */
export function defectPartOf(d) {
  const fgMat = str(d?.prod_orders?.mat_no) || null;
  const child = str(d?.child_mat_no);
  if (child) {
    return { mat: child, name: str(d?.child_part_name) || null, fgMat, isChild: true };
  }
  return { mat: fgMat, name: str(d?.prod_orders?.part_name) || null, fgMat, isChild: false };
}

/** แถวนี้ระบุพาร์ทลูกไว้ไหม */
export const hasChildPart = (d) => !!str(d?.child_mat_no);

/**
 * payload 3 ช่องสำหรับเขียนลง `defect_logs` — **จุดเดียวที่ประกอบค่าชุดนี้**
 * (เขียนเองในหน้า = ลืมช่องใดช่องหนึ่งแล้วใบเก่าอ่านชื่อพาร์ทไม่ออก)
 * @param {object|null} pick แถวที่เลือกจากลิสต์ BOM (`bomChildCandidates().rows`) · null = ไม่เลือกลูก
 *                            รับค่า `{ mat_no }` ลอยๆ ได้ (ค่าเดิมในใบที่ BOM โหลดไม่ขึ้น)
 * @returns {{child_mat_no:string|null, child_part_name:string|null, child_qty_per_fg:number|null}}
 */
export function childPartPatch(pick) {
  const mat = str(pick?.mat_no);
  if (!mat) return { child_mat_no: null, child_part_name: null, child_qty_per_fg: null };
  /* 🔴 อัตราต่อ 1 FG บันทึกเฉพาะตอน "เชื่อได้" — บรรทัดที่ถูกใส่ซ้ำทั้งชั้น 1 และชั้นลึก (`flatDupe`)
     ยอดกางออกมาเป็น 2 เท่าของจริง (ดู `bomTree.js` §explodeBom) ⇒ เก็บ `null` ดีกว่าเก็บเลขผิด */
  const per = Number(pick?.qtyPerRoot);
  const ok = Number.isFinite(per) && per > 0 && !pick?.flatDupe;
  return {
    child_mat_no: mat,
    child_part_name: str(pick?.part_name) || null,
    child_qty_per_fg: ok ? per : null,
  };
}

/** ป้ายสั้นสำหรับชิป/ข้อความแจ้งเตือน — `'↳ 20066660 · SPACER'` · '' เมื่อไม่ได้เลือกลูก */
export function childPartText(d) {
  const p = defectPartOf(d);
  if (!p.isChild) return '';
  return `↳ ${[p.mat, p.name].filter(Boolean).join(' · ')}`;
}

/** ข้อความกำกับใต้ช่องเลือก — **ห้ามแต่งเองในหน้า** (ทุกจอต้องพูดเหมือนกัน · กฎความซื่อสัตย์ของจอ) */
export const CHILD_PART_Q_NOTE =
  'ของเสียจำนวนนี้ยังถูกนับเข้า %Q / %P ของ MAT แม่ตามเดิม (1 ชิ้น = 1 ชิ้น · ระบบไม่แปลงด้วยอัตรา BOM) '
  + '— เลือกพาร์ทลูกเพื่อให้พาเรโต/ใบรายงานของเสียชี้ชิ้นที่เสียจริง';
