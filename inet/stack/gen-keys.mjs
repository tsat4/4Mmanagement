#!/usr/bin/env node
// ══ สร้างกุญแจ/รหัสผ่านชุดใหม่ของระบบบน INET (ไม่เกี่ยวกับกุญแจของ Supabase เดิมเลย) ══
// ใช้:  node inet/stack/gen-keys.mjs > inet/stack/.env      (ไฟล์ .env ห้าม commit — อยู่ใน .gitignore)
//
// 🔴 ทุกค่าที่ออกมาเป็นความลับ ยกเว้น ANON_KEY (หน้าเว็บส่งถึงทุกเบราว์เซอร์อยู่แล้ว)
//    ⇒ ใส่ใน OpenShift Secret / ไฟล์ .env บน VM เท่านั้น · ห้ามแปะแชท ห้ามใส่ใน git
// 🔴 สร้างครั้งเดียวต่อระบบ — สร้างใหม่ = ทุกคนหลุด login + ต้อง build หน้าเว็บใหม่ (ANON_KEY ฝังใน JS)
import { createHmac, randomBytes } from 'node:crypto';

const b64u = (b) => Buffer.from(b).toString('base64url');
const rand = (n) => randomBytes(n).toString('base64url').slice(0, n);
function jwt(payload, secret) {
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64u(JSON.stringify(payload));
  const s = createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${s}`;
}

const JWT_SECRET = rand(48);                      // ≥ 32 ตัวอักษร (GoTrue/PostgREST)
const iat = Math.floor(Date.now() / 1000);
const exp = iat + 10 * 365 * 24 * 3600;           // กุญแจ anon/service อายุ 10 ปี (แบบเดียวกับ Supabase)

const env = {
  POSTGRES_PASSWORD: rand(32),
  JWT_SECRET,
  ANON_KEY: jwt({ role: 'anon', iss: 'supabase', iat, exp }, JWT_SECRET),
  SERVICE_ROLE_KEY: jwt({ role: 'service_role', iss: 'supabase', iat, exp }, JWT_SECRET),
  SECRET_KEY_BASE: rand(64),                      // realtime
  REALTIME_DB_ENC_KEY: rand(16),                  // realtime — ต้องยาว 16 ตัวพอดี
  PG_META_CRYPTO_KEY: rand(32),
  DASHBOARD_PASSWORD: rand(24),                   // หน้าแอดมิน Studio (ถ้าเปิดใช้)
};
console.log('# สร้างโดย inet/stack/gen-keys.mjs เมื่อ ' + new Date().toISOString());
for (const [k, v] of Object.entries(env)) console.log(`${k}=${v}`);
