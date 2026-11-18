#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════════════════
   🔁 ไล่คำนวณ actual_qty / %P / %Q ของกะที่ถูกย้ายใบผลิตเข้า-ออก         (2026-11-18)
   คู่กับ migration `20261118_fix_orders_wrong_shift_dr.sql` (ย้ายใบที่ลงกะเก่าที่ลืมปิด)

   🔴 ใช้ **สูตรจริง** `computeSessionOee` (src/utils/oee.js) เท่านั้น — ห้ามเขียนสูตรซ้ำที่นี่
   🔴 **ด่านก่อนเขียน: ต้อง "คิดสภาพก่อนย้าย" แล้วได้ค่าที่ stamp ไว้ก่อน**
      · ยอดผลิตก่อนย้าย = `actual_qty` ที่ stamp ไว้  และ  %P/%Q ก่อนย้าย = ที่ stamp ไว้ (±TOL)
      · ผ่าน ⇒ เขียน `after` เป็นค่าสัมบูรณ์ · ไม่ผ่าน ⇒ **ไม่แตะ %P/%Q ของกะนั้น**
      เหตุ: กะที่ถูกยิงใบเพิ่ม *หลังปิดกะไปแล้ว* ค่า stamp ไม่เคยมีใบพวกนั้นอยู่
            ⇒ ใบที่ย้ายออกไม่เคยมีผลกับ %P/%Q ของกะนั้น (เคสจริง LINE A 10/11 กะเช้า ปิด 19:50
              แล้วถูกยิงอีก 4 ใบตอน 20:04–20:10) · และทะเบียน CT/เวลาพักก็ดริฟท์ไปแล้วหลายกะ
   🔴 %A ไม่แตะ — ย้ายใบไม่ได้เปลี่ยนเวลาเดินเครื่อง/เวลาหยุด
   🔴 ก่อนเขียนทุกแถวต้อง log ค่าเดิมลง `oee_restamp_log` (ย้อนกลับได้ 100%)

   โหมดออฟไลน์ (คอนเทนเนอร์ของ Claude ต่อ Supabase ไม่ได้ — network policy):
     node scripts/restamp-moved-orders.mjs --dump <dump.json> [--sql out.sql] [--tol 0.5]
   โครง dump: { sidx, sessions[{ix,…}], breaks, products, kstds, ord[[ix,status,qty,qty_ok,
     qty_actual,mat_no,opened_at,confirmed_at,oldIx]], ph[[…]], dt[[ix,start,end,dur,cat,cap]],
     def[[ix,qty_ng,qty_suspect]] }  — คิวรีที่ผลิต dump อยู่ท้ายไฟล์ migration
   ══════════════════════════════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync } from 'node:fs';
import { computeSessionOee } from '../src/utils/oee.js';

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const DUMP = arg('--dump');
const SQL  = arg('--sql');
const TOL  = Number(arg('--tol', '0.5'));
if (!DUMP) { console.error('ต้องระบุ --dump <dump.json>'); process.exit(1); }

const D = JSON.parse(readFileSync(DUMP, 'utf8'));
const r2 = (v) => Math.round(v * 100) / 100;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const q = (v) => (v == null ? 'null' : String(v));
const ORD = (a) => ({ status: a[1], qty: a[2], qty_ok: a[3], qty_actual: a[4], mat_no: a[5],
                      opened_at: a[6], confirmed_at: a[7] });

const ordAfter = {}, ordBefore = {}, dtBy = {}, defBy = {};
for (const a of D.ord || []) {
  (ordAfter[a[0]] ||= []).push(ORD(a));
  (ordBefore[a[8] == null ? a[0] : a[8]] ||= []).push(ORD(a));   // ก่อนย้าย = อยู่กะเดิม
}
for (const a of D.ph || []) (ordBefore[a[0]] ||= []).push(ORD(a)); // ใบ placeholder ที่ถูกลบ กลับมาในชุด "ก่อน"
for (const a of D.dt || []) (dtBy[a[0]] ||= []).push({ started_at: a[1], ended_at: a[2],
  duration_min: a[3], dr_downtime_types: { category: a[4], planned_cap_min: a[5] } });
for (const a of D.def || []) (defBy[a[0]] ||= []).push({ qty_ng: a[1], qty_suspect: a[2] });

const rows = [], notes = [];
for (const s of D.sessions) {
  const ix = s.ix;
  const base = {
    session: s, downtimes: dtBy[ix] || [], defects: defBy[ix] || [],
    products: D.products || [], kanbanStds: D.kstds || [], breakPolicies: D.breaks || [],
    processType: s.break_snapshot?.process_type ?? null,
    lineFlow: {}, machineCount: 0, endTime: s.end_time || null,
  };
  const before = computeSessionOee({ ...base, orders: ordBefore[ix] || [] });
  const after  = computeSessionOee({ ...base, orders: ordAfter[ix]  || [] });

  const qtyOld = Number(s.actual_qty ?? 0), qtyNew = after.totalProduced;
  const pStamp = s.oee_p == null ? null : Number(s.oee_p);
  const qStamp = s.oee_q == null ? null : Number(s.oee_q);
  const aStamp = s.oee_a == null ? null : Number(s.oee_a);

  const qtyRepro = before.totalProduced === qtyOld;
  const pRepro = pStamp != null && before.P != null && Math.abs(before.P * 100 - pStamp) <= TOL;
  const qRepro = qStamp != null && before.Q != null && Math.abs(before.Q * 100 - qStamp) <= TOL;
  const tag = `${s.work_date} ${s.line_name} ${s.shift}`;

  let pNew = null, qNew = null;
  if (qtyRepro && pRepro && after.P != null) pNew = r2(clamp(after.P * 100, 0, 100));
  if (qtyRepro && qRepro && after.Q != null) qNew = r2(clamp(after.Q * 100, 0, 100));
  if (!qtyRepro) notes.push(`${tag}: ยอดก่อนย้ายคิดได้ ${before.totalProduced} แต่ stamp ${qtyOld} — ใบถูกยิงหลังปิดกะ ⇒ ไม่แตะ %P/%Q`);
  else if (pStamp != null && !pRepro) notes.push(`${tag}: %P ก่อนย้ายคิดได้ ${before.P == null ? '—' : r2(before.P * 100)} แต่ stamp ${pStamp} ⇒ ไม่แตะ %P`);
  else if (qStamp != null && !qRepro) notes.push(`${tag}: %Q ก่อนย้ายคิดได้ ${before.Q == null ? '—' : r2(before.Q * 100)} แต่ stamp ${qStamp} ⇒ ไม่แตะ %Q`);

  const pUse = pNew ?? pStamp, qUse = qNew ?? qStamp;
  const oeeNew = (aStamp != null && pUse != null && qUse != null) ? r2(aStamp * pUse * qUse / 10000) : null;
  const oeeOld = s.oee == null ? null : Number(s.oee);
  if (qtyNew === qtyOld && pNew == null && qNew == null) continue;

  rows.push({ s, tag, qtyOld, qtyNew, pStamp, pNew, qStamp, qNew, aStamp, oeeOld, oeeNew });
}

rows.sort((a, b) => (a.qtyNew - a.qtyOld) - (b.qtyNew - b.qtyOld));
console.log('\n🔁 กะที่ต้องไล่คำนวณใหม่ (เรียงจากยอดลดมากสุด)\n');
console.log('  วันที่      ไลน์                      กะ      ยอดผลิต                   %P              OEE');
for (const r of rows) {
  const d = r.qtyNew - r.qtyOld;
  console.log(`  ${r.s.work_date} ${String(r.s.line_name).padEnd(25)} ${String(r.s.shift).padEnd(5)} ` +
    `${String(r.qtyOld).padStart(6)} → ${String(r.qtyNew).padStart(6)} (${d > 0 ? '+' : ''}${d})`.padEnd(26) +
    `${String(r.pStamp ?? '—').padStart(6)} → ${String(r.pNew ?? '(คงเดิม)').padStart(8)}  ` +
    `${String(r.oeeOld ?? '—').padStart(6)} → ${String(r.oeeNew ?? '—').padStart(6)}`);
}
const out = rows.filter(r => r.qtyNew < r.qtyOld).reduce((a, r) => a + (r.qtyOld - r.qtyNew), 0);
const inn = rows.filter(r => r.qtyNew > r.qtyOld).reduce((a, r) => a + (r.qtyNew - r.qtyOld), 0);
console.log(`\n  ต้องเขียน ${rows.length} กะ · ยอดออก ${out.toLocaleString()} ชิ้น · ยอดเข้า ${inn.toLocaleString()} ชิ้น` +
  `\n  (ไม่เท่ากันได้ — กะที่ถูกยิงใบหลังปิดกะ ค่า stamp เดิมไม่เคยมียอดพวกนั้นอยู่แล้ว)`);
if (notes.length) console.log('\n  ⚠️ กะที่คิดย้อนไม่ตรง stamp (ปล่อย %P/%Q เดิมไว้):\n   ' + notes.join('\n   '));

if (SQL) {
  const L = ['begin;', `insert into public.oee_restamp_log
  (session_id, reason, oee_a_before, oee_a_after, oee_p_before, oee_p_after,
   oee_q_before, oee_q_after, oee_before, oee_after, qty_before, qty_after, note) values`];
  L.push(rows.map(r => `  ('${r.s.id}', 'wrong-shift-move-20261118', ${q(r.aStamp)}, ${q(r.aStamp)}, ` +
    `${q(r.pStamp)}, ${q(r.pNew ?? r.pStamp)}, ${q(r.qStamp)}, ${q(r.qNew ?? r.qStamp)}, ` +
    `${q(r.oeeOld)}, ${q(r.oeeNew)}, ${q(r.qtyOld)}, ${q(r.qtyNew)}, ` +
    `'ย้ายใบที่ลงกะเก่าที่ลืมปิด')`).join(',\n') + ';');
  for (const r of rows) {
    const sets = [`actual_qty = ${q(r.qtyNew)}`];
    if (r.pNew != null) sets.push(`oee_p = ${q(r.pNew)}`);
    if (r.qNew != null) sets.push(`oee_q = ${q(r.qNew)}`);
    if (r.oeeNew != null) sets.push(`oee = ${q(r.oeeNew)}`);
    L.push(`update public.production_sessions set ${sets.join(', ')} where id = '${r.s.id}';`);
  }
  L.push('commit;');
  writeFileSync(SQL, L.join('\n') + '\n');
  console.log(`\n📝 SQL → ${SQL} (${rows.length} กะ)`);
}
