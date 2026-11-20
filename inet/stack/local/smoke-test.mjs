#!/usr/bin/env node
// ══ ทดสอบระบบ INET ที่ตั้งขึ้น ด้วย supabase-js ตัวเดียวกับที่หน้าเว็บ ESM ใช้ ══
// ใช้:  BASE=http://localhost:8000 ANON_KEY=… SERVICE_ROLE_KEY=… DB_URL=postgres://… node smoke-test.mjs
// ทดสอบ: ประตู · login · REST + RLS · realtime · storage · edge functions (JWT รายฟังก์ชัน) · หน้าเว็บ
// 🔴 ใช้กับระบบใหม่เท่านั้น — สร้างตาราง/ผู้ใช้/bucket ชื่อ smoke_* แล้วลบทิ้งตอนจบ
import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';

const { BASE, ANON_KEY, SERVICE_ROLE_KEY, DB_URL } = process.env;
if (!BASE || !ANON_KEY || !SERVICE_ROLE_KEY || !DB_URL) { console.error('ต้องตั้ง BASE ANON_KEY SERVICE_ROLE_KEY DB_URL'); process.exit(2); }
for (const m of ['supabase.co', 'ewhdfqwfwofivojtsizn', 'eyhclzkifitbhbljgoav']) {
  if ((BASE + DB_URL).includes(m)) { console.error('❌ ปลายทางเป็นระบบเดิม — หยุด'); process.exit(2); }
}
const sql = (q) => execFileSync('psql', ['-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', DB_URL, '-c', q], { encoding: 'utf8' }).trim();

let fail = 0;
const ok = (name, cond, extra = '') => { console.log(`${cond ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`); if (!cond) fail++; };
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(BASE, SERVICE_ROLE_KEY, opts);
const anon = createClient(BASE, ANON_KEY, opts);
const email = `smoke_${Date.now()}@esm.test`, password = 'Smoke-' + Math.random().toString(36).slice(2) + '9!';

try {
  ok('ประตูทางเข้า', (await fetch(`${BASE}/gw-health`)).ok);

  // ── ตารางทดสอบ: RLS แบบเดียวกับตาราง Main (authenticated เห็นของตัวเอง · anon ไม่เห็น) ──
  sql(`drop table if exists public.smoke_rows;
    create table public.smoke_rows (id bigint generated always as identity primary key, note text,
      user_id uuid default auth.uid());
    alter table public.smoke_rows enable row level security;
    create policy smoke_own on public.smoke_rows for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
    grant select, insert on public.smoke_rows to authenticated;
    alter publication supabase_realtime add table public.smoke_rows;
    notify pgrst, 'reload schema';`);
  await new Promise((r) => setTimeout(r, 1500));

  // ── login ──
  const { error: cuErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  ok('สร้างผู้ใช้ (admin API · แบบที่ edge function create-user ทำ)', !cuErr, cuErr?.message);
  const user = createClient(BASE, ANON_KEY, opts);
  const { data: si, error: siErr } = await user.auth.signInWithPassword({ email, password });
  ok('login ด้วยอีเมล/รหัสผ่าน', !!si?.session, siErr?.message);

  // ── realtime: ฟังก่อน แล้วค่อยเขียน ──
  let subscribed;
  const ready = new Promise((r) => { subscribed = r; });
  const got = new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), 20000);
    user.channel('smoke').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'smoke_rows' },
      (p) => { clearTimeout(t); resolve(p); }).subscribe((st) => { if (st === 'SUBSCRIBED') subscribed(st); });
  });
  const st = await Promise.race([ready, new Promise((r) => setTimeout(() => r('TIMEOUT'), 15000))]);
  ok('realtime เชื่อมต่อ (websocket ผ่านประตู)', st === 'SUBSCRIBED', st);
  await new Promise((r) => setTimeout(r, 1500));   // ให้ realtime ตั้ง replication ของตารางใหม่เสร็จ

  // ── REST + RLS ──
  const ins = await user.from('smoke_rows').insert({ note: 'ทดสอบภาษาไทย' }).select('id, note');
  ok('REST เขียน (ผู้ใช้ login)', !ins.error && ins.data?.length === 1, ins.error?.message);
  const mine = await user.from('smoke_rows').select('note');
  ok('REST อ่าน + ภาษาไทยไม่เพี้ยน', mine.data?.[0]?.note === 'ทดสอบภาษาไทย', JSON.stringify(mine.error || mine.data));
  const asAnon = await anon.from('smoke_rows').select('id');
  ok('RLS: anon มองไม่เห็นแถวของผู้ใช้', (asAnon.data?.length ?? 0) === 0, asAnon.error?.message ?? `${asAnon.data?.length} แถว`);

  const ev = await got;
  ok('realtime ส่งการเปลี่ยนแปลงถึงจอ', ev?.new?.note === 'ทดสอบภาษาไทย', ev ? '' : 'ไม่ได้รับภายใน 15 วิ');

  // ── storage ──
  const bucket = 'smoke-bucket';
  await admin.storage.deleteBucket(bucket).catch(() => {});
  const cb = await admin.storage.createBucket(bucket, { public: true });
  ok('storage สร้าง bucket', !cb.error, cb.error?.message);
  const up = await admin.storage.from(bucket).upload('a/test.txt', new Blob(['สวัสดี INET']), { contentType: 'text/plain' });
  ok('storage อัปโหลดไฟล์', !up.error, up.error?.message);
  const pub = admin.storage.from(bucket).getPublicUrl('a/test.txt').data.publicUrl;
  const dl = await fetch(pub);
  ok('storage ดาวน์โหลดผ่านลิงก์สาธารณะ', dl.ok && (await dl.text()) === 'สวัสดี INET', `${dl.status} ${pub}`);
  await admin.storage.from(bucket).remove(['a/test.txt']); await admin.storage.deleteBucket(bucket);

  // ── edge functions: JWT รายฟังก์ชัน ตรงกับ cloud ──
  const cu = await fetch(`${BASE}/functions/v1/create-user`, { method: 'POST', body: '{}' });
  ok('functions: create-user ไม่มี JWT → 401 (ต้องตรวจ)', cu.status === 401, `ได้ ${cu.status}`);
  // ingest-energy (verify_jwt=false บน cloud) — GET ต้องได้ 405 "POST only" จากโค้ดของฟังก์ชันเอง = ผ่านประตูเข้าไปถึงตัวฟังก์ชัน
  const ie = await fetch(`${BASE}/functions/v1/ingest-energy`);
  ok('functions: ingest-energy ไม่มี JWT → ถึงตัวฟังก์ชัน (405 ของมันเอง)', ie.status === 405, `ได้ ${ie.status} ${(await ie.text()).slice(0, 80)}`);

  // ── หน้าเว็บ ──
  const home = await fetch(`${BASE}/`); const html = await home.text();
  ok('หน้าเว็บ ESM ขึ้น', home.ok && html.includes('Enterprise Shopfloor Management'));
  const deep = await fetch(`${BASE}/daily-report`);
  ok('หน้าย่อย (F5) ไม่ 404', deep.ok);
} catch (e) {
  ok('ไม่มี exception', false, e.message);
} finally {
  try {
    const { data } = await admin.auth.admin.listUsers();
    for (const u of data?.users ?? []) if (u.email?.startsWith('smoke_')) await admin.auth.admin.deleteUser(u.id);
    sql('drop table if exists public.smoke_rows;');
  } catch { /* ทำความสะอาดไม่สำเร็จไม่ใช่ผลทดสอบ */ }
}
console.log(fail ? `\n❌ ไม่ผ่าน ${fail} ข้อ` : '\n🎉 ผ่านทุกข้อ');
process.exit(fail ? 1 : 0);
