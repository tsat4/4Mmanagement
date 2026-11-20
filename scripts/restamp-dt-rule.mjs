#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════════════════
   🧾 ไล่คำนวณ %A/OEE ของกะที่ปิดแล้วใหม่ ตามนิยาม downtime ที่แก้เมื่อ 2026-11-16
   (คำสั่ง user: "กะที่ปิดไปแล้วน่าจะได้ไล่ย้อนแก้")

   🔴 ใช้ **สูตรจริง** `computeSessionOee` จาก src/utils/oee.js เท่านั้น — ห้ามเขียนสูตรซ้ำที่นี่
      (เคยลองสร้างโมเดลใน SQL แล้ว ตรงกับของจริงแค่ 97/307 กะ ⇒ ทิ้ง)

   🔴 ด่านกันเขียนผิด (โหมดปกติ) — **คำนวณกะเดิมให้ได้ค่าเดิมก่อน ถึงจะมีสิทธิ์เขียนทับ**
      คิด A ด้วย "หมวดเดิม" แล้วเทียบกับ `oee_a` ที่ stamp ไว้ ต่างเกิน TOL = **ข้ามกะนั้น**
      (กะเก่าที่ทะเบียน CT/พักเปลี่ยนไปแล้ว จะคำนวณย้อนไม่ตรง — ต้องข้าม ไม่ใช่เดา)

   ⚠️ `--force` = **ปิดด่านนั้น แล้วคิด %A ใหม่ด้วยกฎ/ทะเบียน "วันนี้" ทุกกะ**
      (คำสั่ง user 18/11: *"แก้ได้ทั้งหมดนะ เพราะปีนี้ทุกหน่วยงานยังใช้ OEE กรอกมือเป็น KPI หลัก"*
       ⇒ เลขที่ stamp ไว้ยังไม่ใช่ KPI ทางการของปีนี้ ⇒ ยอมรีเซ็ตให้ทุกกะอยู่บนนิยามเดียวกัน)
      🔴 ใช้เมื่อ **user สั่งเท่านั้น** — ปกติห้าม blanket-recompute กะเก่า (กฎเดิมใน docs/modules/oee.md)
      🔴 ยัง log ค่าเดิมทุกแถวลง `oee_restamp_log` (reason ต่างกัน) ⇒ ย้อนกลับได้ 100%

   🔴 แตะเฉพาะ `oee_a` + `oee` — **%P/%Q ไม่เปลี่ยน** (ย้ายหมวดไม่ได้ทำให้เครื่องเดินมากขึ้น/น้อยลง
      เวลาเดินเครื่องเท่าเดิม) · ยอดผลิต/ของเสียไม่แตะ
   🔴 ไลน์เครื่องขนานข้ามทั้งหมด (ต้องใช้ทะเบียนไลน์ฝั่ง Main ซึ่งสคริปต์นี้ไม่ได้ต่อ)
   🔴 ก่อนเขียนทุกแถว log ค่าเดิมลง `oee_restamp_log` (ย้อนกลับได้ 100%)

   วิธีรัน (ต้องอยู่ใน session/เครื่องที่ต่อ Supabase DR ได้):
     node scripts/restamp-dt-rule.mjs                 # dry-run (ไม่เขียนอะไร)
     node scripts/restamp-dt-rule.mjs --from 2026-11-01 --to 2026-11-17
     node scripts/restamp-dt-rule.mjs --apply         # เขียนจริง
     node scripts/restamp-dt-rule.mjs --force         # ⚠️ ทุกกะ (ไม่มีด่านคิดย้อน) — user สั่งเท่านั้น

   🔌 โหมดออฟไลน์ (คอนเทนเนอร์ของ Claude ต่อ Supabase ไม่ได้ — network policy · 18/11):
     node scripts/restamp-dt-rule.mjs --dump <dump.json> [--sql out.sql]
     dump = { sessions, breaks, prods, kstds, orders, dts } หน้าตาเหมือนที่โหลดจาก DB เป๊ะ
     (คิวรีที่ผลิต dump อยู่ใน docs/modules/oee.md §ไล่คำนวณ %A ย้อนหลัง)
   ══════════════════════════════════════════════════════════════════════════════════════ */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { computeSessionOee } from '../src/utils/oee.js';

const URL = process.env.VITE_SUPABASE_DR_URL || 'https://eyhclzkifitbhbljgoav.supabase.co';
const KEY = process.env.VITE_SUPABASE_DR_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5aGNsemtpZml0YmhibGpnb2F2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4ODExMDQsImV4cCI6MjA5MjQ1NzEwNH0.fHTA70fQ8yAvQuwAeM9HQ_UQjMdR3FUkxu_klvXs-h4';
const db = createClient(URL, KEY);

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const APPLY = process.argv.includes('--apply');
const FORCE = process.argv.includes('--force');   // ⚠️ ปิดด่าน "คิดย้อนต้องตรง" — ดูหัวไฟล์
const REASON = FORCE ? 'dt-rule-20261116-all' : 'dt-rule-20261116';
const NOTE = FORCE ? 'คิด %A ใหม่ด้วยกฎ/ทะเบียนวันนี้ทุกกะ (คำสั่ง user 18/11) — %P/%Q ไม่แตะ'
                   : 'นิยาม downtime ใหม่ 16/11 — %P/%Q ไม่แตะ';
const DUMP  = arg('--dump');    // โหมดออฟไลน์: อ่าน input จากไฟล์แทน DB
const SQL   = arg('--sql');     // โหมดออฟไลน์: เขียน SQL ออกไฟล์แทนการยิง DB
const STAMPS = arg('--stamps'); // โหมดออฟไลน์: CSV id,oee_a,oee_p,oee_q,oee = ค่าที่ stamp "สดวันนี้"
                                //   (dump ถูกดึงก่อนรอบ restamp ก่อนหน้า ⇒ ต้องทับให้ตรงฐานจริง
                                //    ไม่งั้น oee_*_before ที่ log ผิด และ oee = A×P×Q ใช้ P/Q เก่า)
const FROM  = arg('--from', '2026-11-01');
const TO    = arg('--to', new Date().toISOString().slice(0, 10));
const TOL   = Number(arg('--tol', '0.05'));   // %A ที่ยอมให้ต่างจากที่ stamp ไว้ (จุดทศนิยม)

/* สิ่งที่เปลี่ยนไปเมื่อ 16/11 — ใช้ "ย้อนสภาพเดิม" ของแต่ละใบ (ดู migration 20261116_dt_types_recategorize) */
const MOVED_TO_UNPLANNED = new Set([
  '8a4c8748-c2f1-4f1c-ab07-0ae628c04c06',   // รอ QA ตรวจสอบงาน
  '49421914-9ec5-4fde-876f-9c896cfdb91b',   // หยุดไลน์คัดแยกชิ้นงาน
  '036ce39a-0eb5-4107-a315-5b481bbec668',   // เคาะเศษ / ทำความสะอาดสต๊อปเปอร์
]);
/* 🔴 ไลน์เครื่องขนาน — ข้าม (สคริปต์นี้ไม่ได้ต่อ Main จึงส่ง lineFlow/machineCount ว่าง
   ⇒ `laneWeightFn()` ไม่ทำงาน ⇒ DT รายเครื่องถูกหักเต็มจำนวน %A ต่ำผิด)
   ⚠️ ลิสต์นี้ต้องตรงกับ `production_lines.parallel_stations > 1` ฝั่ง Main (20/11: 9 ไลน์)
      คิวรีรีเฟรช: select name from production_lines where parallel_stations > 1;
   🕳️ เคสจริง 20/11: ลิสต์ตกหล่น LASER-345 / LASER-789 (parallel_stations = 3)
      ⇒ 12 กะถูกเขียน %A ต่ำผิดเฉลี่ย -33 จุด ต้องย้อนคืนทีหลัง (reason `revert-parallel-20261120`)
      ⇒ จึงเพิ่มด่านอัตโนมัติข้างล่าง (`DT รวม > เวลากะ`) ไว้จับไลน์ที่ตกหล่นในอนาคตด้วย */
const PARALLEL_LINES = new Set(['Assembly Line D - GWM&RA', 'Line D1 - GWM', 'Line D3 - STAMPED',
  'Line D4 - BRK FRT BMPR', 'Line D5 - BRK RR BMPR', 'Line D6 - Sub Assembly', 'SUB APRON',
  'LASER-345', 'LASER-789']);

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
  console.log(`\n🧾 ไล่คำนวณ %A/OEE ใหม่ · ${FROM} → ${TO} · ${APPLY ? '⚠️  เขียนจริง' : 'dry-run (ไม่เขียน)'}` +
    `${FORCE ? ' · ⚠️  --force (ไม่มีด่านคิดย้อน)' : ''}\n`);

  const chunk = (a, n) => a.reduce((o, v, i) => ((o[Math.floor(i / n)] ||= []).push(v), o), []);
  let sessions, breaks, prods, kstds, orders = [], dts = [];

  if (DUMP) {
    /* 🔌 ออฟไลน์: input ชุดเดียวกับที่โหลดจาก DB — ตรรกะข้างล่างใช้ร่วมกัน ห้ามแยกเป็นสูตรที่ 2 */
    ({ sessions, breaks, prods, kstds, orders, dts } = JSON.parse(readFileSync(DUMP, 'utf8')));
    sessions = (sessions || []).sort((a, b) => String(a.work_date).localeCompare(String(b.work_date)));
    if (STAMPS) {
      const num = (v) => (v === '' || v == null ? null : Number(v));
      const cur = new Map(readFileSync(STAMPS, 'utf8').split('\n').filter(Boolean)
        .map(l => l.split(',')).map(([id, a, pp, qq, o]) => [id.trim(), { oee_a: num(a), oee_p: num(pp), oee_q: num(qq), oee: num(o) }]));
      let n = 0;
      for (const s of sessions) { const c = cur.get(s.id); if (c) { Object.assign(s, c); n++; } }
      console.log(`ทับค่า stamp ให้ตรงฐานจริง ${n}/${cur.size} กะ`);
    }
    console.log(`อ่าน dump: กะ ${sessions.length} · นโยบายพัก ${breaks.length} · สินค้า ${prods.length}`);
  } else {
    [sessions, breaks, prods, kstds] = await Promise.all([
      all('production_sessions', 'id, line_name, shift, work_date, start_time, end_time, shift_min, oee_a, oee_p, oee_q, oee, ct_snapshot, break_snapshot',
        q => q.eq('status', 'closed').gte('work_date', FROM).lte('work_date', TO).order('work_date')),
      all('break_policies', '*', q => q.eq('is_active', true)),
      all('dr_products', 'mat_no, cycle_time_sec, pair_mat_no, process_type, name, p_no'),
      all('kanban_standards', 'mat_no, dr_products(cycle_time_sec)', q => q.eq('is_active', true)),
    ]);
    console.log(`โหลดกะที่ปิดแล้ว ${sessions.length} กะ · นโยบายพัก ${breaks.length} · สินค้า ${prods.length}`);
    for (const c of chunk(sessions.map(s => s.id), 100)) {
      const [o, d] = await Promise.all([
        all('prod_orders', 'id, session_id, status, qty, qty_ok, qty_actual, mat_no, opened_at, confirmed_at', q => q.in('session_id', c)),
        all('downtime_logs', 'id, session_id, started_at, ended_at, duration_min, downtime_type_id, dr_downtime_types(category, planned_cap_min, name_th)', q => q.in('session_id', c)),
      ]);
      orders.push(...o); dts.push(...d);
    }
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

  const stat = { skipLine: 0, skipNoA: 0, skipMismatch: 0, skipZero: 0, skipDtOverShift: 0, same: 0, changed: 0 };
  const rows = [], worst = [], zeroed = [], overShift = [];

  for (const s of sessions) {
    if (PARALLEL_LINES.has(s.line_name)) { stat.skipLine++; continue; }
    if (s.shift_min == null || (s.oee_a == null && !FORCE)) { stat.skipNoA++; continue; }
    const dl = dtBy[s.id] || [];

    /* 🔴 ด่านจับ "ไลน์เครื่องขนานที่หลุดลิสต์" โดยไม่ต้องต่อทะเบียน Main:
       DT รวมเกินความยาวกะ = เป็นไปไม่ได้บนไลน์เครื่องเดียว ⇒ ลงรายเครื่องแน่ๆ
       สคริปต์นี้หารเลนไม่ได้ ⇒ **ข้าม ห้ามเดา** (เคส LASER-789 12/10: DT 829 น. บนกะ 570 น.) */
    const dtSum = dl.reduce((a, x) => a + (Number(x.duration_min) || 0), 0);
    if (dtSum > Number(s.shift_min)) {
      stat.skipDtOverShift++;
      if (overShift.length < 20) overShift.push(`${s.work_date} ${String(s.line_name).padEnd(24)} ${s.shift.padEnd(5)} DT ${dtSum} น. > เวลากะ ${s.shift_min} น. (${dl.length} ใบ)`);
      continue;
    }
    const base = { session: s, orders: ordBy[s.id] || [], defects: [], ngQty: 0,
      products: prods, kanbanStds: kstds, breakPolicies: breaks,
      processType: s.break_snapshot?.process_type ?? null,
      lineFlow: {}, machineCount: 0, endTime: s.end_time || null };

    const oldR = computeSessionOee({ ...base, downtimes: dl.map(asOld) });
    const aOldCalc = oldR.A == null ? null : oldR.A * 100;
    const reproduced = s.oee_a != null && aOldCalc != null && Math.abs(aOldCalc - Number(s.oee_a)) <= TOL;
    if (!reproduced) {
      stat.skipMismatch++;
      if (worst.length < 5) worst.push(`${s.work_date} ${s.line_name} ${s.shift}: stamp ${s.oee_a} vs คิดย้อนได้ ${aOldCalc == null ? '—' : round2(aOldCalc)}`);
      if (!FORCE) continue;        // โหมดปกติ: คิดย้อนไม่ตรง = ห้ามแตะ
    }
    const newR = computeSessionOee({ ...base, downtimes: dl });
    const aNew = newR.A == null ? null : round2(newR.A * 100);
    if (aNew == null || (s.oee_a != null && Math.abs(aNew - Number(s.oee_a)) < 0.005)) { stat.same++; continue; }

    /* 🔴 คิดใหม่ได้ %A = 0 ทั้งที่กะนั้นมียอดผลิต = "คิดไม่ได้" ไม่ใช่ "เครื่องไม่เคยเดิน"
       (ใบ downtime ตกนอกช่วงพาร์ททุกใบ ⇒ ทางคิดราย MAT กินเวลาเดินหมด)
       ⇒ fail-closed: ปล่อยค่าเดิมไว้ แล้วรายงานให้คนไปดู ห้ามเขียนเลขที่รู้ว่าโกหก */
    if (aNew === 0 && (newR.totalProduced || 0) > 0) {
      stat.skipZero++;
      if (zeroed.length < 20) zeroed.push(`${s.work_date} ${String(s.line_name).padEnd(24)} ${s.shift.padEnd(5)} stamp ${s.oee_a} · ผลิต ${newR.totalProduced} · DT ${dl.length} ใบ`);
      continue;
    }

    const p = s.oee_p == null ? null : Number(s.oee_p), q = s.oee_q == null ? null : Number(s.oee_q);
    const oeeNew = (p == null || q == null) ? null : round2(aNew * p * q / 10000);
    rows.push({ s, aOld: s.oee_a == null ? null : Number(s.oee_a), aNew, reproduced,
      oeeOld: s.oee == null ? null : Number(s.oee), oeeNew,
      movedMin: Math.round((newR.loggedUnplannedDT || 0) - (oldR.loggedUnplannedDT || 0)) });
    stat.changed++;
  }

  const d0 = (r) => (r.aOld == null ? 0 : r.aNew - r.aOld);
  rows.sort((a, b) => d0(a) - d0(b));
  console.log('── กะที่ตัวเลขเปลี่ยน (เรียงจากตกมากสุด) ──');
  rows.slice(0, 20).forEach(r => console.log(
    `  ${r.s.work_date} ${String(r.s.line_name).padEnd(24)} ${r.s.shift.padEnd(5)} ` +
    `A ${String(r.aOld ?? '—').padStart(6)} → ${String(r.aNew).padStart(6)} · OEE ${r.oeeOld} → ${r.oeeNew}` +
    `${r.reproduced ? '' : ' · ⚠️คิดย้อนไม่ตรง'}`));
  if (rows.length > 20) console.log(`  … อีก ${rows.length - 20} กะ`);

  const withOld = rows.filter(r => r.aOld != null);
  const avg = (f) => withOld.length ? round2(withOld.reduce((a, r) => a + f(r), 0) / withOld.length) : 0;
  console.log(`\n── สรุป ──
  กะที่ตรวจ                 ${sessions.length}
  ข้าม: ไลน์เครื่องขนาน      ${stat.skipLine}
  ข้าม: ไม่มี %A / shift_min ${stat.skipNoA}
  คำนวณย้อนไม่ตรง stamp    ${stat.skipMismatch}   ← ${FORCE ? '⚠️  --force: คิดใหม่ให้ด้วย' : 'ข้าม (ทะเบียนเปลี่ยนไปแล้ว)'}
  ข้าม: DT รวม > เวลากะ        ${stat.skipDtOverShift}   ← ไลน์เครื่องขนาน (หารเลนไม่ได้)
  ข้าม: คิดใหม่ได้ 0 ทั้งที่ผลิต ${stat.skipZero}   ← fail-closed (ดูลิสต์ล่าง)
  ตัวเลขเท่าเดิม             ${stat.same}
  ✍️  ต้องแก้                 ${stat.changed}
  %A เฉลี่ย ${avg(r => r.aOld)} → ${avg(r => r.aNew)}  (${avg(r => r.aNew - r.aOld)})`);
  if (worst.length) console.log('\n  ตัวอย่างกะที่คำนวณย้อนไม่ตรง:\n   ' + worst.join('\n   '));
  if (overShift.length) console.log('\n  ⚠️  กะที่ DT รวมเกินเวลากะ (ไม่แตะ — น่าจะเป็นไลน์เครื่องขนานที่หลุดลิสต์):\n   ' + overShift.join('\n   '));
  if (zeroed.length) console.log('\n  ⚠️  กะที่คิดใหม่ได้ %A = 0 ทั้งที่มียอดผลิต (ไม่แตะ — ต้องให้คนไล่ดูใบ DT):\n   ' + zeroed.join('\n   '));

  /* 🔌 ออฟไลน์: ออกเป็น SQL (log ค่าเดิมก่อน แล้วค่อยเขียนทับ — ลำดับเดียวกับทาง DB เป๊ะ) */
  if (SQL) {
    const q = (v) => (v == null ? 'null' : String(v));
    const L = ['begin;', `insert into public.oee_restamp_log
  (session_id, reason, oee_a_before, oee_a_after, oee_before, oee_after, moved_min, note) values`];
    L.push(rows.map(r => `  ('${r.s.id}', '${REASON}', ${q(r.aOld)}, ${q(r.aNew)}, ` +
      `${q(r.oeeOld)}, ${q(r.oeeNew)}, ${q(r.movedMin)}, '${NOTE}${r.reproduced ? '' : ' · คิดย้อนไม่ตรง'}')`).join(',\n') + ';');
    for (const r of rows) {
      L.push(`update public.production_sessions set oee_a = ${q(r.aNew)}` +
        `${r.oeeNew == null ? '' : `, oee = ${q(r.oeeNew)}`} where id = '${r.s.id}';`);
    }
    L.push('commit;');
    writeFileSync(SQL, L.join('\n') + '\n');
    console.log(`\n📝 SQL → ${SQL} (${rows.length} กะ)\n`);
    return;
  }

  if (!APPLY) { console.log('\n(dry-run — ยังไม่เขียนอะไรลงฐาน · ใส่ --apply เพื่อเขียนจริง)\n'); return; }

  console.log(`\n✍️  เขียน ${rows.length} กะ …`);
  for (const c of chunk(rows, 50)) {
    const log = c.map(r => ({ session_id: r.s.id, reason: REASON, note: NOTE + (r.reproduced ? '' : ' · คิดย้อนไม่ตรง'),
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
