/* ══ 🚩 "จุดนี้เคย NG ครั้งก่อนไหม + ใบซ่อมถึงไหนแล้ว" ═══════════════════  2026-11-19
   ตัวป้อนข้อมูลให้กฎใน `src/utils/ngReason.js` (กฎอยู่ที่นั่น ไฟล์นี้แค่ไปเอาข้อมูลมา)

   🔴 **ยกเฉพาะจุดตรวจเดิม** — คืนเป็น map รายจุด ไม่ใช่ค่าเดียวของทั้งเครื่อง
      (เครื่องหนึ่งมีหลายจุด · MO ที่เปิดเรื่องจุด A ห้ามไปอธิบาย NG ของจุด B)
   🔴 **อ่านไม่ได้ = ไม่ยก** (fail-closed) — คืน `error` ให้จอเขียนบอก **ห้ามกลืนเป็น "ไม่เคย NG"**
      กลืน = คนต้องพิมพ์เองทั้งที่ควรยกได้ (รำคาญแต่ไม่อันตราย) · แต่จอต้องรู้ว่าเกิดอะไรขึ้น        */
import { supabaseDR } from '../supabaseClient';
import { machineKey } from '../utils/machineNo';

/** คอลัมน์ขั้นต่ำที่กฎ `carryNgReason()` ต้องใช้ — จอที่โหลดเองต้อง select ชุดนี้ */
export const NG_MO_COLS = 'id, mo_no, status, repair_done_at, source_inspection_id';

/**
 * @param {object} jig เครื่อง/จิ๊กที่กำลังตรวจ (`id` · `machine_no`)
 * @returns {Promise<{ byCp: Object, machine: object|null, error: string }>}
 *   `byCp[checkpoint_id] = { prev:{action_text, inspected_at}, mo }`
 */
export async function loadNgHistory(jig) {
  const out = { byCp: {}, machine: null, error: '' };
  if (!jig?.id) return out;
  /* ① ผลตรวจ NG ของเครื่องนี้ เรียงใหม่→เก่า (เพดานพอสำหรับ "ครั้งล่าสุดต่อจุด") */
  const { data: rows, error } = await supabaseDR
    .from('inspection_results')
    .select('checkpoint_id, action_text, status, value_attribute, inspections!inner(id, jig_id, created_at)')
    .eq('inspections.jig_id', jig.id)
    .or('status.eq.fail,value_attribute.eq.ng')
    .order('created_at', { foreignTable: 'inspections', ascending: false })
    .limit(300);
  if (error) { out.error = error.message; return out; }

  const insIds = new Set();
  for (const r of rows || []) {
    const cp = r.checkpoint_id;
    if (!cp || out.byCp[cp]) continue;                 // เก็บเฉพาะครั้งล่าสุดของแต่ละจุด
    out.byCp[cp] = { prev: { action_text: r.action_text || '', inspected_at: r.inspections?.created_at || null }, mo: null };
    if (r.inspections?.id) insIds.add(r.inspections.id);
  }
  if (!insIds.size) return out;

  /* ② ใบซ่อมที่เปิดจากใบตรวจเหล่านั้น + ③ ทะเบียนเครื่อง (สถานะที่ช่างประกาศ)
     🔴 เครื่องดึง**แถวเดียว** ด้วย `jigs.machine_id` — ห้ามโหลดทะเบียนทั้งก้อนมากรองในหน้า
        (วัด 19/11: jigs module=mtn 348 แถว มี machine_id ครบ 348 ⇒ ทางสำรองด้วยเลขเครื่องแทบไม่ถูกใช้
         แต่คงไว้แบบ eq ตรงๆ · ไม่มี machine_id + สะกดต่าง = `machine` เป็น null = ไม่ยกของเก่า fail-closed) */
  const MC_COLS = 'id, machine_no, usability, usability_note';
  const mcQ = jig.machine_id
    ? supabaseDR.from('machines').select(MC_COLS).eq('id', jig.machine_id).maybeSingle()
    : jig.machine_no
      ? supabaseDR.from('machines').select(MC_COLS).eq('machine_no', jig.machine_no).limit(5)
      : Promise.resolve({ data: null, error: null });
  const [moRes, mcRes] = await Promise.all([
    supabaseDR.from('mtn_orders').select(NG_MO_COLS).in('source_inspection_id', [...insIds]),
    mcQ,
  ]);
  if (moRes.error) { out.error = moRes.error.message; return out; }
  const moByIns = {};
  (moRes.data || []).forEach(m => { if (!moByIns[m.source_inspection_id]) moByIns[m.source_inspection_id] = m; });
  for (const r of rows || []) {
    const cp = r.checkpoint_id; const e = out.byCp[cp];
    if (e && !e.mo && r.inspections?.id) e.mo = moByIns[r.inspections.id] || null;
  }
  if (!mcRes.error && mcRes.data) {
    const rowsMc = Array.isArray(mcRes.data) ? mcRes.data : [mcRes.data];
    const k = jig.machine_no ? machineKey(jig.machine_no) : '';
    out.machine = jig.machine_id
      ? (rowsMc[0] || null)                                    // ชี้ด้วย id = ตรงตัว ไม่ต้องเทียบเลข
      : (rowsMc.find(m => machineKey(m.machine_no) === k) || null);
  }
  return out;
}

export default { loadNgHistory, NG_MO_COLS };
