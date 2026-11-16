/* 🟡 ป้ายเตือนฝั่งผลิต "รุ่นนี้ QA ยังไม่ตรวจ First" (2026-11-16 · คำสั่ง user 13/11 "First ยังไม่ผ่าน = เตือนเฉยๆ ไม่ล็อก")
   อ่านงานตรวจของกะนี้จาก `qa_fme_obligations` (edge `qa-fme-scan` สร้าง) แล้วตัดสินว่าจะเตือนอะไร
   🔴 **เตือนอย่างเดียว ห้ามล็อกการผลิต/การสแกน** — ไม่มีฟังก์ชันไหนในไฟล์นี้คืนค่า "บล็อก"
   🔴 อ่านไม่ได้ ≠ ไม่มีงานค้าง — จอต้องบอกว่า "อ่านสถานะ QA ไม่ได้" (ห้ามซ่อนป้ายเงียบ)

   ระดับ: `ng` = QA ตรวจ First แล้วไม่ผ่าน (แดงนิ่ง) · `late` = เลยกำหนดยังไม่ตรวจ · `wait` = รอ QA มาตรวจ
   กระพริบสงวนให้เครื่องหยุดค้าง (UI §2) ⇒ ป้ายนี้ไม่กระพริบทุกระดับ */

const RANK = { ng: 0, late: 1, wait: 2 };

/** obligation 1 แถว → ระดับเตือน หรือ null (ไม่ต้องเตือน) */
export function firstWarnLevel(ob, now = Date.now()) {
  if (!ob || ob.stage !== 'first') return null;
  if (ob.status === 'done_ng') return 'ng';
  if (ob.status !== 'pending' && ob.status !== 'acked') return null;   // done_ok / cancelled
  const due = ob.due_at ? new Date(ob.due_at).getTime() : NaN;
  return Number.isFinite(due) && now > due ? 'late' : 'wait';
}

/** งานตรวจของกะนี้ → รายการที่ต้องเตือน เรียงหนักก่อน (ng → late → wait) แล้วตามเวลาเรียก
 *  คืน [{ id, level, product, mat, status, triggeredAt, dueAt, lateMin }] */
export function firstWarnings(obligations, now = Date.now()) {
  const out = [];
  for (const ob of obligations || []) {
    const level = firstWarnLevel(ob, now);
    if (!level) continue;
    const due = ob.due_at ? new Date(ob.due_at).getTime() : NaN;
    out.push({
      id: ob.id, level, product: ob.product_name || ob.mat_no || '—', mat: ob.mat_no || null,
      status: ob.status, triggeredAt: ob.triggered_at || null, dueAt: ob.due_at || null,
      lateMin: level === 'late' ? Math.round((now - due) / 60000) : null,
    });
  }
  return out.sort((a, b) => RANK[a.level] - RANK[b.level]
    || String(a.triggeredAt || '').localeCompare(String(b.triggeredAt || '')));
}
