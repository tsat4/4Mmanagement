---
name: ui-shot
description: ถ่ายรูปหน้าจอ "ของจริงจากโค้ด" มาประกอบคำถาม/ข้อเสนอ UI แทนการอธิบายด้วยตัวหนังสือหรือภาพวาดมือ — ใช้ `audit/uishot.mjs` เปิดหน้าใน harness แล้วถ่าย (เทียบ before/after ได้) Trigger เมื่อ: จะถามหรือเสนอเรื่องหน้าตา/layout, user ขอดูตัวอย่าง, user บอกว่า "ขอรูป" / "ยังไม่เห็น" / "text เยอะ" / "หน้าตาเป็นไง", ก่อน merge งาน UI ที่อยากให้ user เคาะ, หรือ user ส่งรูปหน้าจอมาถามว่าพังไหม
---

# 📸 ถามเรื่อง UI ต้องมีรูป — ถ่ายจากโค้ดจริง

> คำสั่งถาวร user (2026-11-18): *"ขอเป็นรูปตัวอย่าง เวลาถามได้มั้ย"*
> ⇒ **ห้ามถามเรื่องหน้าตาด้วยตัวหนังสือล้วน** และ **ห้ามวาดภาพ mockup เอง** — เปิดหน้าจริงแล้วถ่าย
> เหตุผล: mockup ที่วาดเองไม่ผูกกับโค้ด ⇒ user เคาะจากภาพที่ไม่มีอยู่จริง แล้วของที่ได้ไม่ตรง

## ใช้ยังไง

**1. เปิด harness ค้างไว้** (พอร์ต 5199 — เช็คก่อนทุกครั้ง อาจตายไปแล้ว):
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:5199/ \
  || (npx vite --config audit/vite.audit.mjs > /tmp/vite.log 2>&1 &) ; sleep 12
```

**2. ถ่าย** — `audit/uishot.mjs` (env ทั้งหมดอธิบายไว้ในหัวไฟล์):
```bash
# การ์ดเดียว เล็งด้วยข้อความหัวข้อ
PAGES='ProductionPlan&tab=lots&view=week' CLIP='^ไทม์ไลน์ — 1 คอลัมน์' node audit/uishot.mjs

# ทั้งหน้า (ใช้ตอนอยากให้เห็น "กำแพงข้อความ" ทั้งก้อน)
PAGES='ProductionPlan' FULL=1 TAG=before node audit/uishot.mjs

# มือถือ · มุมมองสิทธิ์อื่น
PAGES='Obeya&tab=kpi' W=390 H=1400 FULL=1 ROLE=supervisor SECTIONS=PD1 node audit/uishot.mjs

# จอที่จำมุมมองไว้ใน localStorage (ไม่ใช่ URL) — เช่นบอร์ด Heijunka ใน /management
PAGES='Management' LS='mg_main_view=heijunka' node audit/uishot.mjs
```

**3. ส่งให้ user** ด้วย `SendUserFile` (`display: "render"`) พร้อมคำบรรยาย 1 บรรทัดว่ารูปไหนคืออะไร

## 🔴 กฎ

1. **บอกเสมอว่าเป็นข้อมูลจำลอง** (`audit/mockSupabase.js`) — ไม่งั้น user อ่านตัวเลขในรูปเป็นของหน้างาน
   และถ้า mock ทำให้ภาพต่างจากของจริงมาก (เช่น mock ไม่มี cycle time ⇒ กล่องเป็นลายทแยงหมด)
   **ต้องเขียนกำกับว่าของจริงจะต่างตรงไหน**
2. **เสนอเปลี่ยน UI = ต้องมี before + after** — ทำของจริงก่อนแล้วถ่าย อย่าให้ user จินตนาการเอง
   (`TAG=before` ถ่ายก่อนแก้ → แก้ → `TAG=after`) · อยากได้ทั้ง 2 ขนาดก็ถ่ายทั้งจอคอมและ 390px
3. **หน้าที่โค้ดอยู่หลังแท็บ/ปุ่มในเนื้อหน้า** ต้องใส่ query เอง (`Name&tab=x&view=y`) —
   harness ส่ง query ที่เหลือเข้า MemoryRouter ให้ (`?p=` ตัดที่ `&` ตอนหา component)
   · ถ้าหน้านั้นยังไม่อยู่ใน `window.__PAGES` ของ `audit/main.jsx` = **สวีปก็ไม่เคยแตะเหมือนกัน**
   ⇒ เติมเข้าลิสต์ด้วยในคอมมิทเดียวกัน (ดู `audit/README.md`)
4. **รูปเก็บใน scratchpad เท่านั้น ห้าม commit เข้ารีโป** · สคริปต์ชั่วคราวก็ห้ามทิ้งไว้ใน `audit/`

## 🕳️ กับดักที่เจอมาแล้ว (อย่าเสียเวลาซ้ำ)

| อาการ | เหตุ | แก้ |
|---|---|---|
| `Executable doesn't exist … chrome-headless-shell` แล้วบอกให้รัน `npx playwright install` | playwright ในรีโปหา headless-shell ที่ไม่มีในเครื่องนี้ | ต้องใส่ `executablePath: '/opt/pw-browsers/chromium'` (uishot ใส่ให้แล้ว) · **อย่ารัน `playwright install`** |
| `Cannot find package 'playwright'` | รันสคริปต์ที่อยู่นอกรีโป (scratchpad) | สคริปต์ต้องอยู่ใน `audit/` ถึงจะเห็น `node_modules` |
| ครอปแล้วได้ทั้งหน้า / ได้แค่แถบหัวข้อบางๆ | `locator().filter({hasText}).first()` คืน **ancestor ก้อนใหญ่** เพราะ hasText match ทุกชั้นที่มีข้อความอยู่ข้างใน | ใช้ `.last()` (ชั้นในสุด) แล้วไต่ขึ้นด้วย `UP=` ให้ถึง "การ์ด" |
| รูปว่าง / `vite:000` | harness ตายไปแล้ว (มันตายเงียบระหว่าง session) | เช็ค `curl` ก่อนถ่ายทุกครั้ง แล้วเปิดใหม่ |
| ถ่ายได้แต่มุมมองดีฟอลต์ ทั้งที่หน้ามีหลายมุมมอง | มุมมองเก็บใน `localStorage` ไม่ใช่ URL (เช่น `mg_main_view` ของ `/management`) | ใช้ `LS='key=value'` · คลาสเดียวกับ "สวีปกดไม่ถึง" — ถ้าเป็นของใหม่ ควรย้ายไปผูก URL ไปเลย |
| หน้าโหลดแต่เนื้อหาไม่ขึ้น | หน้ากันไว้ด้วยเงื่อนไข เช่น `rows.length > 0` แล้ว mock ไม่มีข้อมูลพอ | อ่านเงื่อนไขในหน้านั้นก่อน · ถ้าจำเป็นให้เติมแถวใน `audit/mockSupabase.js` (ห้ามถอดแถวพิเศษที่มีอยู่) |

## เกี่ยวข้อง

- `audit/uishot.mjs` — ตัวถ่าย (env อธิบายในหัวไฟล์)
- `audit/README.md` — harness ทั้งชุด · `window.__PAGES` · ข้อจำกัดของ mock
- `audit/crashsweep.mjs` / `mobilesweep.mjs` — ด่านจริง (uishot **ไม่ใช่ด่าน** แค่ตาดู)
- `docs/UI-CONVENTIONS.md` · `docs/UI-STANDARD.md` — เคาะหน้าตาตามนี้ก่อนเสนอ
