# ระบบ ESM ทั้งชุดบน INET — คู่มือติดตั้ง (ทาง 2: ทุกอย่างในรั้ว vFW Dedicate)

📄 เหตุผล/การตัดสินใจ/ผลซ้อม → `docs/modules/inet-migration.md` · สคริปต์ยกข้อมูล → `inet/README.md`
🔴 **ของเดิม (Render + Supabase cloud) ไม่ถูกแตะ** — ระบบนี้เป็นชุดที่ 2 ไว้ลองใช้/ขออนุมัติ

```
มือถือ/คอม ──HTTPS──▶ Route ─▶ esm-gateway (nginx) ─┬─ /            ─▶ esm-web       (หน้าเว็บ)
                                                     ├─ /auth/v1     ─▶ esm-auth      (login · GoTrue)
                                                     ├─ /rest/v1     ─▶ esm-rest      (API ตาราง · PostgREST)
                                                     ├─ /realtime/v1 ─▶ esm-realtime  (จอสด · websocket)
                                                     ├─ /storage/v1  ─▶ esm-storage   (รูป/ไฟล์ · ดิสก์ PVC)
                                                     └─ /functions/v1─▶ esm-functions (edge functions 24 ตัว)
                                     ทุกตัวต่อ ─▶ VM: PostgreSQL 17.6 (ฐานรวม Main+DR · ไม่เปิดออกนอกรั้ว)
```

## ขั้นตอน (ลำดับนี้เท่านั้น)

1. **สร้างกุญแจชุดใหม่** (เครื่องที่ไว้ใจได้ · ครั้งเดียว): `node inet/stack/gen-keys.mjs > .env`
   — ห้ามแปะแชท ห้าม commit · ใช้ไฟล์เดียวกันทั้ง VM และ OpenShift
2. **VM ฐานข้อมูล**: ลง Docker · copy โฟลเดอร์ `inet/stack/vm/` + `.env` · เติม `DB_BIND_IP=<IP ภายใน VM>`
   ใน `.env` · `docker compose up -d` · ตั้ง firewall ให้พอร์ต 5432 รับเฉพาะช่วง IP ของ container ในรั้ว
3. **OpenShift**: กรอก `openshift/esm-secret.template.yaml` จาก `.env` → ⊕ Import YAML ·
   แก้ 3 จุด "แก้ตรงนี้" ใน `openshift/esm-stack.yaml` → ⊕ Import YAML
4. **ยกข้อมูล** (หลัง 17:30): `inet/10_dump_source.sh` → `inet/20_build_target.sh` → `inet/30_verify.sh` ต้อง ✅
   — `TGT_URL=postgresql://postgres:<POSTGRES_PASSWORD>@<IP VM>:5432/postgres` · รันจากเครื่องในรั้ว
5. **ทดสอบ**: `BASE=<ลิงก์> ANON_KEY=… SERVICE_ROLE_KEY=… DB_URL=… node inet/stack/local/smoke-test.mjs` ต้อง 🎉
   แล้วให้ผู้ใช้จริง login ด้วยบัญชีเดิม

## ซ้อมในเครื่อง (ไม่ต่อของจริง)
```
cd inet/stack/local && node ../gen-keys.mjs > .env && docker compose up -d --build
BASE=http://localhost:8000 DB_URL=postgresql://postgres:<รหัส>@127.0.0.1:54322/postgres node smoke-test.mjs
```
เครือข่ายที่ออกเน็ตผ่าน proxy: เพิ่ม `-f docker-compose.proxy.yml` (ดูหัวไฟล์)

## กับดักที่เจอตอนซ้อม (แก้แล้วทั้งหมด)
| อาการ | สาเหตุ | แก้ที่ |
|---|---|---|
| realtime ล้มวน `channel name cannot exceed 63 bytes` | `RELEASE_COOKIE` ยาวเกิน | gen-keys สร้างแยก 56 ตัว |
| storage ล้มวน `EACCES mkdir` | ดิสก์ไม่ให้ UID สุ่มเขียน | OpenShift ใส่ fsGroup ให้เอง · ในเครื่องมี `storage-perms` |
| ฟังก์ชันที่ cron/Telegram เรียกโดน 401 | router ทางการตรวจ JWT เหมาทั้งหมด | `FUNCTIONS_VERIFY_JWT` รายชื่อตรงกับ cloud |
| ผู้ใช้เดิม login ไม่ได้ `Database error querying schema` | GoTrue อ่าน NULL ใน `auth.*` ไม่ได้ | ของจริงไม่มี NULL (วัดแล้ว) + ตาข่ายใน `20_build_target.sh` |
| ประตูตอบ 502 หลังรีสตาร์ทบริการ | nginx จำ IP เก่า | เฉพาะ docker ในเครื่อง — OpenShift ใช้ IP ของ Service คงที่ |
