#!/usr/bin/env node
// ══ หลังยกข้อมูลเข้าระบบใหม่: ผู้ใช้เดิม login ด้วยรหัสเดิมได้ + สิทธิ์ (RLS) ทำงานเหมือนเดิม ══
// ใช้กับฐานจำลองของ inet/test (ผู้ใช้ u1@x.test) — ระบบจริงให้ผู้ใช้ทดลองเองด้วยบัญชีตัวเอง
import { createClient } from '@supabase/supabase-js';
const { BASE, ANON_KEY } = process.env;
let fail = 0; const ok = (n, c, x = '') => { console.log(`${c ? '✅' : '❌'} ${n}${x ? ' — ' + x : ''}`); if (!c) fail++; };
const o = { auth: { persistSession: false, autoRefreshToken: false } };
const anon = createClient(BASE, ANON_KEY, o), u = createClient(BASE, ANON_KEY, o);
const { data, error } = await u.auth.signInWithPassword({ email: 'u1@x.test', password: 'Esm-Old-Pass-1' });
ok('ผู้ใช้เดิม login ด้วยรหัสผ่านเดิม (ยก auth.users มาจากฐานเดิม)', !!data?.session, error?.message);
const bad = await createClient(BASE, ANON_KEY, o).auth.signInWithPassword({ email: 'u1@x.test', password: 'wrong' });
ok('รหัสผิด = เข้าไม่ได้', !bad.data?.session);
const emp = await u.from('employees').select('id', { count: 'exact', head: true });
ok('ผู้ใช้ login อ่านตาราง Main ได้ (RLS authenticated)', emp.count === 500, `${emp.count ?? emp.error?.message}`);
const empAnon = await anon.from('employees').select('id');
ok('anon อ่านตาราง Main ไม่ได้', (empAnon.data?.length ?? 0) === 0);
const mc = await anon.from('machines').select('id', { count: 'exact', head: true });
ok('anon อ่านตาราง DR ได้เหมือนเดิม (supabaseDR)', mc.count === 800, `${mc.count ?? mc.error?.message}`);
const au = await anon.from('audit_log').select('table_name').in('table_name', ['machines', 'employees', 'profiles']);
const names = new Set((au.data ?? []).map((r) => r.table_name));
ok('anon เห็น audit ของ DR (จอ OrderTrace)', names.has('machines'), [...names].join(','));
ok('anon ไม่เห็น audit ของ Main', !names.has('employees') && !names.has('profiles'));
const upd = await anon.from('machines').update({ updated_by_name: 'ทดสอบหลังย้าย' }).eq('id', 3).select('id');
ok('anon เขียนตาราง DR ได้ + trigger audit ทำงาน', upd.data?.length === 1, upd.error?.message);
console.log(fail ? `\n❌ ไม่ผ่าน ${fail} ข้อ` : '\n🎉 ผ่านทุกข้อ'); process.exit(fail ? 1 : 0);
