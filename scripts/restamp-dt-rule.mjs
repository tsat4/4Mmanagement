#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════════════════
   🧾 ไล่คำนวณ %A/OEE ของกะที่ปิดแล้วใหม่ ตามนิยาม downtime ที่แก้เมื่อ 2026-11-16
   (คำสั่ง user: "กะที่ปิดไปแล้วน่าจะได้ไล่ย้อนแก้")

   🔴 ใช้ **สูตรจริง** `computeSessionOee` จาก src/utils/oee.js เท่านั้น — ห้ามเขียนสูตรซ้ำที่นี่
      (เคยลองสร้างโมเดลใน SQL แล้ว ตรงกับของจริงแค่ 97/307 กะ ⇒ ทิ้ง)

   🔴 ด่านกันเขียนผิด — **คำนวณกะเดิมให้ได้ค่าเดิมก่อน ถึงจะมีสิทธิ์เขียนทับ**
      คิด A ด้วย "หมวดเดิม" แล้วเทียบกับ `oee_a` ที่ stamp ไว้ ต่างเกิน TOL = **ข้ามกะนั้น**
      (กะเก่าที่ทะเบียน CT/พักเปลี่ยนไปแล้ว จะคำนวณย้อนไม่ตรง — ต้องข้าม ไม่ใช่เดา)

   🔴 แตะเฉพาะ `oee_a` + `oee` — **%P/%Q ไม่เปลี่ยน** (ย้ายหมวดไม่ได้ทำให้เครื่องเดินมากขึ้น/น้อยลง
      เวลาเดินเครื่องเท่าเดิม) · ยอดผลิต/ของเสียไม่แตะ
   🔴 ไลน์เครื่องขนานข้ามทั้งหมด (ต้องใช้ทะเบียนไลน์ฝั่ง Main ซึ่งสคริปต์นี้ไม่ได้ต่อ)
   🔴 ก่อนเขียนทุกแถว log ค่าเดิมลง `oee_restamp_log` (ย้อนกลับได้ 100%)

   วิธีรัน (ต้องอยู่ใน session/เครื่องที่ต่อ Supabase DR ได้):
     node scripts/restamp-dt-rule.mjs                 # dry-run (ไม่เขียนอะไร)
     node scripts/restamp-dt-rule.mjs --from 2026-11-01 --to 2026-11-17
     node scripts/restamp-dt-rule.mjs --apply         # เขียนจริง
   ══════════════════════════════════════════════════════════════════════════════════════ */
import { createClient } from '@supabase/supabase-js';
import { computeSessionOee } from '../src/utils/oee.js';

const URL = process.env.VITE_SUPABASE_DR_URL || 'https://eyhclzkifitbhbljgoav.supabase.co';
const KEY = process.env.VITE_SUPABASE_DR_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5aGNsemtpZml0YmhibGpnb2F2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4ODExMDQsImV4cCI6MjA5MjQ1NzEwNH0.fHTA70fQ8yAvQuwAeM9HQ_UQjMdR3FUkxu_klvXs-h4';
const db = createClient(URL, KEY);

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const APPLY = process.argv.includes('--apply');
const FROM  = arg('--from', '2026-11-01');
const TO    = arg('--to', new Date().toISOString().slice(0, 10));
const TOL   = Number(arg('--tol', '0.05'));   // %A ที่ยอมให้ต่างจากที่ stamp ไว้ (จุดทศนิยม)

/* สิ่งที่เปลี่ยนไปเมื่อ 16/11 — ใช้ "ย้อนสภาพเดิม" ของแต่ละใบ (ดู migration 20261116_dt_types_recategorize) */
const MOVED_TO_UNPLANNED = new Set([
  '8a4c8748-c2f1-4f1c-ab07-0ae628c04c06',   // รอ QA ตรวจสอบงาน
  '49421914-9ec5-4fde-876f-9c896cfdb91b',   // หยุดไลน์คัดแยกชิ้นงาน
  '036ce39a-0eb5-4107-a315-5b481bbec668',   // เคาะเศษ / ทำความสะอาดสต๊อปเปอร์
]);
/* ไลน์เครื่องขนาน — ข้าม (ต้องใช้ flow_mode/parallel_stations ฝั่ง Main) */
const PARALLEL_LINES = new Set(['Assembly Line D - GWM&RA', 'Line D1 - GWM', 'Line D3 - STAMPED',
  'Line D4 - BRK FRT BMPR', 'Line D5 - BRK RR BMPR', 'Line D6 - Sub Assembly', 'SUB APRON']);

const round2 = (v) => Math.round(v * 100) / 100;
const die = (label, error) => { if (error) { console.error(`❌ ${label}:`, error.message); process.exit(1); } };

async function all(table, select, build = (q) => q) {
  const out = []; const PAGE = 1000;
  for (let i = 0; ; i++) {
    const { data, error } = await build(db.from(table).select(select)).range(i * PAGE, i * PAGE + PAGE - 1);
    die(`โหลด ${table}`, error);
    out.push(...(data || []));
    if (!data || data.length < PAGE) return out;
  }
}

const main = async () => {
  console.log(`\n🧾 ไล่คำนวณ %A/OEE ใหม่ · ${FROM} → ${TO} · ${APPLY ? '⚠️  เขียนจริง' : 'dry-run (ไม่เขียน)'}\n`);

  const [sessions, breaks, prods, kstds] = await Promise.all([
    all('production_sessions', 'id, line_name, shift, work_date, start_time, end_time, shift_min, oee_a, oee_p, oee_q, oee, ct_snapshot, break_snapshot',
      q => q.eq('status', 'closed').gte('work_date', FROM).lte('work_date', TO).order('work_date')),
    all('break_policies', '*', q => q.eq('is_active', true)),
    all('dr_products', 'mat_no, cycle_time_sec, pair_mat_no, process_type, name, p_no'),
    all('kanban_standards', 'mat_no, dr_products(cycle_time_sec)', q => q.eq('is_active', true)),
  ]);
  console.log(`โหลดกะที่ปิดแล้ว ${sessions.length} กะ · นโยบายพัก ${breaks.length} · สินค้า ${prods.length}`);

  const ids = sessions.map(s => s.id);
  const chunk = (a, n) => a.reduce((o, v, i) => ((o[Math.floor(i / n)] ||= []).push(v), o), []);
  const orders = [], dts = [];
  for (const c of chunk(ids, 100)) {
    const [o, d] = await Promise.all([
      all('prod_orders', 'id, session_id, status, qty, qty_ok, qty_actual, mat_no, opened_at, confirmed_at', q => q.in('session_id', c)),
      all('downtime_logs', 'id, session_id, started_at, ended_at, duration_min, downtime_type_id, dr_downtime_types(category, planned_cap_min, name_th)', q => q.in('session_id', c)),
    ]);
    orders.push(...o); dts.push(...d);
  }
  const by = (rows) => rows.reduce((m, r) => ((m[r.session_id] ||= []).push(r), m), {});
  const ordBy = by(orders), dtBy = by(dts);
  console.log(`ใบผลิต ${orders.length} · ใบ downtime ${dts.length}\n`);

  /* ย้อนสภาพ "ก่อนแก้นิยาม" ของแต่ละใบ: หมวดเดิม + ไม่มีเพดาน */
  const asOld = (d) => ({ ...d, dr_downtime_types: {
    ...d.dr_downtime_types,
    category: MOVED_TO_UNPLANNED.has(d.downtime_type_id) ? 'planned' : d.dr_downtime_types?.category,
    planned_cap_min: null,
  } });

  const stat = { skipLine: 0, skipNoA: 0, skipMismatch: 0, same: 0, changed: 0 };
  const rows = [], worst = [];

  for (const s of sessions) {
    if (PARALLEL_LINES.has(s.line_name)) { stat.skipLine++; continue; }
    if (s.oee_a == null || s.shift_min == null) { stat.skipNoA++; continue; }
    const dl = dtBy[s.id] || [];
    const base = { session: s, orders: ordBy[s.id] || [], defects: [], ngQty: 0,
      products: prods, kanbanStds: kstds, breakPolicies: breaks,
      processType: s.break_snapshot?.process_type ?? null,
      lineFlow: {}, machineCount: 0, endTime: s.end_time || null };

    const oldR = computeSessionOee({ ...base, downtimes: dl.map(asOld) });
    const aOldCalc = oldR.A == null ? null : oldR.A * 100;
    if (aOldCalc == null || Math.abs(aOldCalc - Number(s.oee_a)) > TOL) {
      stat.skipMismatch++;
      if (worst.length < 5) worst.push(`${s.work_date} ${s.line_name} ${s.shift}: stamp ${s.oee_a} vs คิดย้อนได้ ${aOldCalc == null ? '—' : round2(aOldCalc)}`);
      continue;
    }
    const newR = computeSessionOee({ ...base, downtimes: dl });
    const aNew = newR.A == null ? null : round2(newR.A * 100);
    if (aNew == null || Math.abs(aNew - Number(s.oee_a)) < 0.005) { stat.same++; continue; }

    const p = s.oee_p == null ? null : Number(s.oee_p), q = s.oee_q == null ? null : Number(s.oee_q);
    const oeeNew = (p == null || q == null) ? null : round2(aNew * p * q / 10000);
    rows.push({ s, aOld: Number(s.oee_a), aNew, oeeOld: s.oee == null ? null : Number(s.oee), oeeNew,
      movedMin: Math.round((newR.loggedUnplannedDT || 0) - (oldR.loggedUnplannedDT || 0)) });
    stat.changed++;
  }

  rows.sort((a, b) => (a.aNew - a.aOld) - (b.aNew - b.aOld));
  console.log('── กะที่ตัวเลขเปลี่ยน (เรียงจากตกมากสุด) ──');
  rows.slice(0, 20).forEach(r => console.log(
    `  ${r.s.work_date} ${String(r.s.line_name).padEnd(24)} ${r.s.shift.padEnd(5)} ` +
    `A ${String(r.aOld).padStart(6)} → ${String(r.aNew).padStart(6)} · OEE ${r.oeeOld} → ${r.oeeNew} · ย้าย ${r.movedMin} น.`));
  if (rows.length > 20) console.log(`  … อีก ${rows.length - 20} กะ`);

  const avg = (f) => rows.length ? round2(rows.reduce((a, r) => a + f(r), 0) / rows.length) : 0;
  console.log(`\n── สรุป ──
  กะที่ตรวจ                 ${sessions.length}
  ข้าม: ไลน์เครื่องขนาน      ${stat.skipLine}
  ข้าม: ไม่มี %A / shift_min ${stat.skipNoA}
  ข้าม: คำนวณย้อนไม่ตรงstamp ${stat.skipMismatch}   ← กะพวกนี้ห้ามแตะ (ทะเบียนเปลี่ยนไปแล้ว)
  ตัวเลขเท่าเดิม             ${stat.same}
  ✍️  ต้องแก้                 ${stat.changed}
  %A เฉลี่ย ${avg(r => r.aOld)} → ${avg(r => r.aNew)}  (${avg(r => r.aNew - r.aOld)})`);
  if (worst.length) console.log('\n  ตัวอย่างกะที่คำนวณย้อนไม่ตรง (ข้าม):\n   ' + worst.join('\n   '));

  if (!APPLY) { console.log('\n(dry-run — ยังไม่เขียนอะไรลงฐาน · ใส่ --apply เพื่อเขียนจริง)\n'); return; }

  console.log(`\n✍️  เขียน ${rows.length} กะ …`);
  for (const c of chunk(rows, 50)) {
    const log = c.map(r => ({ session_id: r.s.id, reason: 'dt-rule-20261116',
      oee_a_before: r.aOld, oee_before: r.oeeOld, oee_a_after: r.aNew, oee_after: r.oeeNew, moved_min: r.movedMin }));
    const { error: le } = await db.from('oee_restamp_log').insert(log);
    die('บันทึกค่าเดิมลง oee_restamp_log', le);      // 🔴 log ไม่ติด = ห้ามเขียนทับ (ย้อนไม่ได้)
    for (const r of c) {
      const { error } = await db.from('production_sessions')
        .update({ oee_a: r.aNew, oee: r.oeeNew }).eq('id', r.s.id).select('id');
      die(`เขียนกะ ${r.s.work_date} ${r.s.line_name}`, error);
    }
  }
  console.log('✓ เสร็จ — ย้อนกลับได้จากตาราง oee_restamp_log\n');
};
main().catch(e => { console.error(e); process.exit(1); });
