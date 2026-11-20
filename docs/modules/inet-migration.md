# 🏢 ย้ายทั้งระบบขึ้น INET — ระบบชุดที่ 2 (one stop service) · เริ่ม 18/11/2026

> โหลด**เฉพาะเมื่อแตะงานย้ายขึ้น INET** · ของเดิม (Render + Supabase 2 project) **ยังเป็นระบบจริง** จนกว่า user สั่งสลับ

## 1. โจทย์ + สิ่งที่ user ตัดสินแล้ว (18/11)

| คำถาม | คำตอบ user |
|---|---|
| ย้ายอะไร | **ทั้งระบบ** — หน้าเว็บ + ฐานข้อมูล + login + ไฟล์ + realtime + edge function ไปอยู่ INET ที่เดียว ("one stop service") |
| วิธี | **ยกชุดเดิมไปรันบน INET** (โปรแกรม open source ชุดเดียวกับ Supabase) — **ไม่เขียนหลังบ้านใหม่** |
| ฐานข้อมูล | **รวม Main + DR เป็นฐานเดียว** |
| ของเดิม | **ห้ามแตะ** — รันต่อเหมือนเดิม · ชุด INET มีไว้ลองใช้ + ให้ผู้บริหารเห็นก่อนขออนุมัติย้าย |
| ข้อมูล | ยกของเก่าไป**ครบ ไม่ตกหล่น** |

🔴 **กฎ "ห้ามยุบ 2 project เป็น 1" ใน CLAUDE.md ยังใช้กับระบบเดิม** — การรวมเกิดเฉพาะ**ฐานใหม่บน INET**
เมื่อ user สั่งสลับจริงค่อยแก้กฎใน CLAUDE.md ในคอมมิทเดียวกับการสลับ

## 2. 🔴 กติกาความปลอดภัยของงานนี้ (ห้ามละเมิด)

1. **ต่อฐานเดิมได้แค่ "อ่าน"** — สคริปต์ทุกตัวที่แตะฐานเดิมตั้ง `default_transaction_read_only=on` ·
   ห้าม `apply_migration`/`execute_sql` ที่เขียนกับ project `ewhdfqwfwofivojtsizn` / `eyhclzkifitbhbljgoav`
2. **สคริปต์ที่เขียนต้องปฏิเสธเป้าหมายที่เป็นของเดิม** — ปลายทางมี `supabase.co` หรือ project id เดิม = หยุดทันที
3. **ดึงข้อมูลจากฐานเดิมนอกเวลากะ** (หลัง 17:30 / วันหยุด) — Micro instance โหลดหนักแล้วหน้างานช้า
4. งานอยู่ branch แยก · **ไม่ merge เข้า `main`** จนกว่า user สั่ง (เว็บ Render deploy จาก `main` เท่านั้น)
5. ห้ามย้าย Node-RED / เมล demand / Telegram webhook / GitHub Action มาชี้ INET จนกว่าวันสลับ

## 3. ของที่ต้องยก (วัดจากฐานจริง 18/11)

| | Main (`ewhdfqwfwofivojtsizn`) | DR (`eyhclzkifitbhbljgoav`) |
|---|---|---|
| PostgreSQL | 17.6 | 17.6 |
| ขนาดฐาน | 296 MB | 353 MB |
| ตาราง public | 157 | 197 |
| ผู้ใช้ login (`auth.users`) | **132** | 3 (ของเก่าไม่ใช้ — ไม่ยก) |
| bucket ไฟล์ | 13 | 6 (ชื่อไม่ชนกัน) |
| cron | 10 งาน | 10 งาน |
| publication realtime | `supabase_realtime` 19 ตาราง | `supabase_realtime` 21 ตาราง |
| extension เพิ่ม | — | `pg_trgm` · `pgstattuple` |
| vault secrets | 0 | 0 |

ร่วมกัน: `plpgsql` `pg_stat_statements` `uuid-ossp` `pgcrypto` `supabase_vault` `pg_cron` `pg_net` · edge function 25 ตัวใน `supabase/functions/`

## 4. ของที่ชื่อชนกัน — ตรวจครบทุกชนิดแล้ว (18/11 · อ่านอย่างเดียว)

ตรวจ: ตาราง · view · sequence · index · type · ฟังก์ชัน (ชื่อ+อาร์กิวเมนต์) · policy ของ storage · schema `archive`
**ชนจริงแค่ข้างล่างนี้ — นอกนั้นไม่มีชื่อซ้ำ**

| ของที่ชน | Main | DR | วิธีจัดการ |
|---|---|---|---|
| ตาราง `audit_log` (+ seq/pkey/2 index) | 108,452 แถว · id สูงสุด 109,327 · identity | 97,691 แถว · id สูงสุด 154,731 · identity | **รวมเป็นตารางเดียว** — เลื่อน id ฝั่ง DR (+ค่าชดเชย) + เพิ่มคอลัมน์ `src` (`main`/`dr`) ดู §5 |
| ตาราง `notifications` | 19,906 แถว | **0 แถว** | ทิ้งของ DR |
| ตาราง `profiles` | 132 แถว (ตัวจริง) | 3 แถว คนละโครง | ทิ้งของ DR + ฟังก์ชัน `current_user_is_admin`/`current_user_has_department` (ใช้แค่ใน policy ของ `profiles` DR เอง) + trigger `on_auth_user_created`→`handle_new_user` บน `auth.users` ของ DR |
| `fn_audit()` | อ่านชื่อคนจาก `auth.uid()`→`profiles` · trigger 96 ตัว | อ่านชื่อจากคอลัมน์แถว (`updated_by_name`…) + สวิตช์ `app.audit='off'` · trigger 137 ตัว | **เนื้อต่างกัน — เก็บทั้งคู่** เปลี่ยนชื่อของ DR เป็น `fn_audit_dr` (trigger ตามไปเองเพราะผูกด้วย oid) |
| `esm_schema_overview` `esm_schema_table` `fn_set_updated_at` `norm_person_name` | ✅ | ✅ | **md5 เนื้อตรงกันเป๊ะ** → ใช้ตัวเดียว (ข้ามตอน restore ฝั่ง DR) |
| cron `purge-audit-log` | มี | มี | เนื้อเหมือนกัน → เหลือตัวเดียว |
| schema `archive` | 49 ชิ้น | 160 ชิ้น | ชื่อไม่ชนกัน (ตรวจแล้ว) → ยกทั้งคู่ |

## 5. 🔴 กับดักที่เจอระหว่างวิเคราะห์ — ต้องจัดการ ไม่งั้นจอพัง/ข้อมูลรั่ว

### 5.1 สิทธิ์อ่าน `audit_log` ไม่เท่ากัน
- Main: policy `audit_log_read` = **`authenticated` เท่านั้น**
- DR: policy `audit_log_read` = **`anon,authenticated`** — `src/pages/OrderTrace.jsx` + `ProductHistory.jsx`
  อ่านผ่าน `supabaseDR` (= anon เสมอ)
- รวมตรงๆ แล้วใช้ policy ของ Main ⇒ **2 จอนั้นว่างเปล่า** · ใช้ของ DR ⇒ **anon อ่าน audit ของ Main ได้ (พนักงาน/สิทธิ์/4M) = รั่ว**
- ✅ ทางที่เลือก (ทดสอบผ่าน 18/11): **ตัดสินด้วยชื่อตาราง ไม่เพิ่มคอลัมน์ ไม่แก้เนื้อฟังก์ชัน DR**
  · ตาราง `public.audit_anon_tables` = รายชื่อตาราง DR ตอนรวม (ตัด `profiles`/`notifications`/`audit_log` ออก — ชื่อชน Main)
  · policy: `authenticated` อ่านทุกแถว · **`anon` อ่านเฉพาะ `table_name in audit_anon_tables`** = สิทธิ์เท่าเดิมทุกประการ
  · ไม่ใช้คอลัมน์ `src` เพราะ DR มีอีก 2 ฟังก์ชันเขียน audit เอง (`fn_monitoring_orders_replace` ·
    `fn_prod_order_cross_close_audit`) — ต้องไล่แก้เนื้อ = เสี่ยงกว่า
  · 🔴 ตาราง DR ใหม่หลังรวม ที่จออ่าน audit ผ่าน `supabaseDR` → ต้องเติมชื่อใน `audit_anon_tables`

### 5.1b FK ไป `auth.users` ของ DR
`user_signatures.user_id` · `production_shots.created_by` ชี้ `auth.users` — ฐานรวมใช้ผู้ใช้ของ Main
· วัด 18/11 ทั้งคู่ **0 แถว** ⇒ ไม่มีปัญหา · ถ้ามีแถวชี้ผู้ใช้ DR 3 คนเดิม → restore ล้มดังๆ (ไม่หายเงียบ)

### 5.2 งานล้าง audit ฝั่ง DR
`fn_audit_log_sweep()` (cron `audit-log-sweep`) ย้ายแถวเก่าของตารางใน `audit_log_retention` ไป `archive.audit_log_aged`
— ตารางในทะเบียนเป็นของ DR ล้วน (customer_shipping_orders · monitor_cells · stock_receipts · jig_checkpoints)
⇒ ทำงานบนตารางรวมได้เหมือนเดิม · `archive.audit_log_aged` ของ DR ต้องเลื่อน id ด้วยค่าชดเชยเดียวกัน

### 5.3 ที่อยู่เดิมเขียนตายตัว
- cron Main 4 งาน + DR 6 งาน เรียก `net.http_post('https://<ref>.supabase.co/functions/v1/…')` — DR มี header `Authorization` แนบ JWT เดิมด้วย
- `supabase/migrations/` มี URL ตายตัว 28 จุด (18 Main · 10 DR) — ไม่ต้องแก้ไฟล์เก่า แต่ cron ในฐานใหม่ต้องสร้างใหม่ด้วยที่อยู่ INET

### 5.4 หน้าเว็บ — ไม่ต้องแก้โค้ด
`src/supabaseClient.js` อ่าน `VITE_SUPABASE_DR_URL`/`VITE_SUPABASE_DR_KEY` อยู่แล้ว ⇒ build ชุด INET ตั้งให้ชี้ที่อยู่เดียวกับ Main
· client DR ยังเป็น anon เหมือนเดิม (กฎเหล็ก supabaseDR ยังจริง) · ตาราง DR ยังเปิด anon เหมือนเดิม — ไม่แย่ลง ไม่ดีขึ้น

## 6. ขั้นตอน (ข้ามขั้นไม่ได้)

| # | งาน | สถานะ |
|---|---|---|
| 1 | หน้าเว็บ ESM บน INET (ต่อ Supabase เดิม) | ✅ 18/11 |
| 2 | วิเคราะห์ของชน + ออกแบบการรวม (ไฟล์นี้) | ✅ 18/11 |
| 3 | สคริปต์ dump (อ่านอย่างเดียว) · รวม · นับเทียบ — `inet/` | ✅ 18/11 ซ้อมผ่านบนฐานจำลอง (`inet/test/run-local-test.sh`) |
| 4 | ซ้อมรวมด้วย**ข้อมูลจริง** (รันบน INET เป็น Job · รหัสฐานเดิมเก็บใน Secret ห้ามแปะแชท) | ⬜ |
| 5 | ตั้ง Supabase stack บน INET (ในรั้ว vFW · §6.1) | 🟡 ชุดติดตั้งพร้อม + ซ้อมในเครื่องผ่าน (20/11 · §9) — รอ INET ส่ง VM + โซน container |
| 6 | ยกข้อมูลรอบซ้อม + นับเทียบ 100% + ไฟล์ทุก bucket | ⬜ |
| 7 | build หน้าเว็บชุด INET ชี้ฐาน INET · ลองใช้ · ให้ผู้บริหารดู | ⬜ |
| 8 | วันสลับ (ถ้าอนุมัติ): หยุดบันทึก → ยกรอบสุดท้าย → นับเทียบ → ย้ายตัวส่งข้อมูลภายนอก | ⬜ |

## 6.1 ✅ โครงเครือข่ายบน INET — ตกลงทาง 2 (20/11 · user + INET เห็นตรงกัน)

INET เสนอ 2 ทาง (19/11) เพราะลูกค้าต้องการให้ **ฐานข้อมูลอยู่ VM แยกจากเว็บ**:
1. ~~VM ฐานข้อมูลในรั้วส่วนตัว (vFW Dedicate) + ต่อสายข้ามมาโซน container รวม (D2D)~~
2. ✅ **ย้าย container ของเราเข้า vFW Dedicate เดียวกับ VM ฐานข้อมูล** — ทุกอย่างอยู่ในรั้วส่วนตัวเดียว

```
             อินเทอร์เน็ต (มือถือ/คอมหน้างาน)
                        │  HTTPS เท่านั้น
               ┌────────▼──────── vFW Dedicate (รั้วส่วนตัว) ────────────┐
               │  container: หน้าเว็บ ESM · API · Login · ไฟล์ · Realtime  │
               │           │ เครือข่ายภายในรั้ว                         │
               │  VM: PostgreSQL 17 (ฐานรวม Main + DR) — ไม่เปิดออกนอกรั้ว │
               └──────────────────────────────────────────────────────────┘
```
🔴 **ฐานข้อมูลห้ามเปิดพอร์ตออกอินเทอร์เน็ต** — เบราว์เซอร์คุยกับ API เท่านั้น API คุยกับฐานข้างในรั้ว
· หน้าเว็บที่ตั้งไว้ 18/11 (โซน container รวม) ต้องตั้งใหม่ในรั้ว — ใช้ `deploy/inet-esm.yaml` เดิม
· VM = ติดตั้ง PostgreSQL + extension เองได้ (ยืนยันกับ INET อีกครั้ง — §7 ข้อ 1)

## 7. คำถามที่ต้องให้ INET ตอบ (ก่อนขั้น 5)

1. **PostgreSQL** — ใช้บริการของ INET หรือรันเป็น container เอง · เวอร์ชัน (ต้อง **17** ตรงกับของเดิม) ·
   ติดตั้ง extension ได้ไหม: `pg_cron` `pg_net` `pg_trgm` `pgstattuple` `pgcrypto` `uuid-ossp` `supabase_vault` ·
   ได้สิทธิ์สร้าง role/schema เองไหม (ต้องสร้าง `anon` `authenticated` `service_role` + schema `auth` `storage`)
2. **รัน container ที่ต้องการ root ได้ไหม** (image Postgres ของ Supabase บางตัวต้องใช้ — ถ้า INET ให้ Postgres มาเองไม่ต้อง)
3. **ดิสก์ถาวร (Persistent Volume)** ได้กี่ GB · ข้อมูลวันนี้ ~650 MB + ไฟล์ ~400 MB · โตเดือนละ ~300 MB (ขอ ≥100 GB)
4. **ที่เก็บไฟล์แบบ S3** มีไหม (รูป/ไฟล์แนบ 19 bucket)
5. **backup อัตโนมัติ + ซ้อมกู้คืน** ใครทำ ทำบ่อยแค่ไหน
6. CPU/RAM ของ project · **ระบบล่มนอกเวลาทำการ ใครดูแล**
7. ออกอินเทอร์เน็ตได้ไหม (edge function ต้องเรียก Telegram API · Web Push)

## 8. สคริปต์ (`inet/`)

| ไฟล์ | ทำอะไร | แตะฐานเดิม? |
|---|---|---|
| `lib.sh` | ด่านกลาง: ปลายทางห้ามเป็นของเดิม · session ต้นทางบังคับ read-only | — |
| `10_dump_source.sh` | pg_dump 2 ฐาน + นับแถว/checksum **ใน snapshot เดียวกัน** + เก็บ publication/bucket/policy/cron/fn_audit | **อ่านอย่างเดียว** |
| `20_build_target.sh` | สร้างฐานรวมจากไฟล์ (ไม่ต่อฐานเดิม) — ตัดของชน · `fn_audit_dr` · รวม audit · publication · storage policy | ไม่แตะ |
| `sql/merge_audit.sql` | รวม `audit_log` (+1e9) · `archive.audit_log_aged` · policy anon | ไม่แตะ |
| `30_verify.sh` | เทียบจำนวนแถว + checksum ทุกตาราง · audit แยกส่วน Main/DR · auth.users | ไม่แตะ |
| `test/run-local-test.sh` | ซ้อมทั้งท่อบนฐานจำลอง + พิสูจน์ตัวตรวจจับของหายได้ + ด่านปฏิเสธฐานเดิม | ไม่แตะ |

**ผลซ้อม 18/11 (ฐานจำลอง ไม่ใช่ข้อมูลจริง):** ตรวจ 13 ตาราง ผ่านหมด · trigger DR→`fn_audit_dr` · id audit ไม่ชน ·
anon เห็น audit DR แต่ไม่เห็นของ Main · แอบลบ 1 แถวแล้วตัวตรวจจับได้ · ปลายทาง `….supabase.co` ถูกปฏิเสธ
· แก้ 3 จุดที่ซ้อมเจอ: `\copy` ใช้ตัวแปรไม่ได้ · boolean ของ bucket ออกเป็น `t` · ตัวตรวจนับ archive ซ้ำ

**ยังไม่ทำ:** ย้ายตัวไฟล์ storage (ต้องใช้ service key ของเดิม — ใส่เป็น Secret บน INET) ·
cron 20 งานใหม่ด้วยที่อยู่ INET · deploy edge function 25 ตัว · ตั้ง Supabase stack บน INET (รอ §7)

## 9. ชุดติดตั้งระบบบน INET (`inet/stack/` · 20/11/2026)

คู่มือติดตั้ง → `inet/stack/README.md` · เวอร์ชันโปรแกรมตามชุดทางการของ Supabase self-host ณ 20/11
(Postgres **17.6.1.136** = รุ่นเดียวกับของเดิม · GoTrue v2.197.0 · PostgREST v14.18 · Realtime v2.148.3 ·
Storage v1.89.12 · Edge runtime v1.77.9) · ประตูใช้ nginx แทน Envoy (ไม่ใช้ root บน OpenShift)

**ผลซ้อมในเครื่อง 20/11** (ทุก container ของแอปรันด้วย UID สุ่มเหมือน OpenShift):
- smoke test **15/15**: login · REST + RLS · ภาษาไทย · realtime · storage · functions (JWT รายฟังก์ชัน) · หน้าเว็บ + F5
- ยกข้อมูล (ฐานจำลอง) ลง Supabase Postgres จริง → `30_verify.sh` ผ่าน → **ผู้ใช้เดิม login ด้วยรหัสเดิมได้** ·
  สิทธิ์ authenticated/anon เหมือนเดิม · trigger audit ฝั่ง DR ทำงาน → smoke ซ้ำหลังย้ายผ่านหมด

**ข้อมูลจริงที่วัดเพื่อยืนยันว่าการย้าย login ใช้ได้ (อ่านอย่างเดียว 20/11):** `auth.users` 133 คน
ทุกคน `instance_id=0000…` · ยืนยันอีเมลแล้ว · รหัส bcrypt · คอลัมน์ token/เวลา **NULL = 0** · `auth.identities` 133 แถวครบ

**edge functions — `verify_jwt` บน cloud (ใช้เป็นต้นฉบับของ `FUNCTIONS_VERIFY_JWT`):**
ตรวจ JWT = `create-user` `delete-user` `reset-user-password` `integration-admin` `demand-mail-file` · ที่เหลือไม่ตรวจ
· `telegram-webhook` มีในรีโปแต่**ไม่เคย deploy** · `send-notification-router-probe` อยู่บน cloud แต่**ไม่มีในรีโป** (ตัวทดสอบ — ไม่ยก)
· ⚠️ ยังไม่ได้เทียบว่าโค้ดในรีโป = ตัวที่ deploy อยู่บน cloud ทุกตัว (ทำก่อนวันสลับ)
· ฟังก์ชันโหลด library จาก esm.sh/jsr/npm ตอนรัน ⇒ **container ต้องออกอินเทอร์เน็ตได้** (ถาม INET)

**ยังไม่ได้ทำ:** รันบน OpenShift จริง (`openshift/esm-stack.yaml` ตรวจแค่รูปแบบ) · ย้ายตัวไฟล์ storage ·
cron 20 งานด้วยที่อยู่ใหม่ · ความลับของ functions (Telegram ฯลฯ) · Studio/SQL Editor สำหรับแอดมิน
