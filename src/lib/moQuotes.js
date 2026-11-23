/* ══ 🧾 ลบไฟล์ใบเสนอราคาเมื่อใบ MO ปิดสมบูรณ์ ═══════════════════════  2026-11-18
   คำสั่ง user: *"ปิดใบแบบสมบูรณ์ละลบใบเสนอราคาทิ้งได้เลย"*
   (ผมเสนอให้เก็บ 90 วันเผื่อบัญชี — user ยืนยันลบทันที ⇒ ชดเชยด้วยการคงประวัติไว้)

   🔴 **ลำดับตายตัว: อัปเดตแถวให้สำเร็จก่อน แล้วค่อยลบไฟล์** (กฎเขียน DB ข้อ 2)
      ลบไฟล์ก่อน = ไฟล์หายถาวรแต่แถวยังชี้ URL เดิม ⇒ จอขึ้นรูปเสีย กู้ไม่ได้ ไม่มี error ฟ้อง
   🔴 **ล้มเหลวห้ามทำให้ "การปิดใบ" เป็นโมฆะ** — ใบปิดไปแล้วจริง · คืน `{ok:false}` ให้ผู้เรียก
      เขียน toast เตือน แล้วรอบหน้าที่มีคนเปิดใบนั้นก็กวาดต่อได้เอง (ตัวนี้เรียกซ้ำได้ ไม่มีผลข้างเคียง)
   🔴 **ไม่รู้ = ไม่ลบ** (`quotesToPurge` ตัดสินให้แล้ว) — อ่านแถวไม่ครบ ห้ามเดาว่าไม่มีไฟล์            */
import { supabaseDR } from '../supabaseClient';
import { checkWriteRows } from '../utils/dbWrite';
import { quotesToPurge } from '../utils/prQuote';
import { mtnPath, MTN_BUCKET } from '../utils/mtnImage';

/** คอลัมน์ขั้นต่ำที่ตัวกวาดต้องอ่าน — จอที่เรียกต้อง select ชุดนี้ (ไม่ครบ = fail-closed ไม่ลบ) */
export const QUOTE_PURGE_COLS = 'id, order_id, quote_img, quote_file_name, quote_deleted_at';

/**
 * กวาดไฟล์ใบเสนอราคาของใบที่ปิดสมบูรณ์แล้ว
 * @param {object} order ใบ MO (ต้องมี `id` · `status`)
 * @returns {Promise<{ ok:boolean, purged:number, reason:string }>}
 */
export async function purgeMoQuotes(order) {
  if (!order?.id) return { ok: false, purged: 0, reason: 'ไม่รู้ว่าใบไหน' };
  const { data, error } = await supabaseDR.from('mtn_purchase_requests')
    .select(QUOTE_PURGE_COLS).eq('order_id', order.id);
  if (error) return { ok: false, purged: 0, reason: `อ่านใบขอซื้อไม่สำเร็จ: ${error.message}` };

  const plan = quotesToPurge(order, data || []);
  if (!plan.ok) return { ok: false, purged: 0, reason: plan.reason };
  if (!plan.rows.length) return { ok: true, purged: 0, reason: plan.reason };

  const nowIso = new Date().toISOString();
  const ids = plan.rows.map(r => r.id);
  /* ① เคลียร์ URL + ประทับเวลาลบ — นับแถวจริง (RLS ปฏิเสธ = 0 แถว ไม่มี error) */
  const ok = checkWriteRows(await supabaseDR.from('mtn_purchase_requests')
    .update({ quote_img: null, quote_deleted_at: nowIso, updated_at: nowIso })
    .in('id', ids).not('quote_img', 'is', null).select('id'),
  'ลบไฟล์ใบเสนอราคาหลังปิดใบ', { zeroMsg: 'ไม่มีแถวให้ลบ (อาจมีคนกวาดไปแล้ว)' });
  if (!ok) return { ok: false, purged: 0, reason: 'อัปเดตแถวไม่สำเร็จ — ไม่ลบไฟล์' };

  /* ② ลบไฟล์จริง — ทำหลังแถวสำเร็จเท่านั้น · ล้มที่นี่ = ไฟล์กำพร้า (ไม่ร้ายแรง) แต่ต้องบอก */
  const paths = plan.rows.map(r => mtnPath(r.quote_img)).filter(Boolean);
  if (paths.length) {
    const { error: eDel } = await supabaseDR.storage.from(MTN_BUCKET).remove(paths);
    if (eDel) return { ok: false, purged: plan.rows.length, reason: `ล้างไฟล์ไม่สำเร็จ: ${eDel.message}` };
  }
  return { ok: true, purged: plan.rows.length, reason: `ลบไฟล์ใบเสนอราคา ${plan.rows.length} ไฟล์` };
}

export default { purgeMoQuotes, QUOTE_PURGE_COLS };
