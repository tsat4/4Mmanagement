/* ══ 📸 uishot — ถ่ายรูปหน้าจอ "ของจริงจากโค้ด" ไว้ประกอบคำถาม/รีวิว (2026-11-18 · คำสั่ง user) ══════
   user 18/11: *"ขอเป็นรูปตัวอย่าง เวลาถามได้มั้ย"* — เลิกอธิบาย UI ด้วยตัวหนังสือ/ภาพวาดมือ
   เปิดหน้าจริงใน harness (`audit/index.html`) แล้วถ่ายมาเลย ⇒ สิ่งที่ user เห็น = สิ่งที่โค้ดทำจริง

   ใช้:
     PAGES='ProductionPlan&tab=lots&view=week' node audit/uishot.mjs
     PAGES='Obeya&tab=kpi,DailyReport' W=1500 node audit/uishot.mjs
     PAGES='ProductionPlan' W=390 H=1500 FULL=1 TAG=before node audit/uishot.mjs
     PAGES='ProductionPlan' CLIP='^ไทม์ไลน์ — 1 คอลัมน์' UP=2 node audit/uishot.mjs

   env:
     PAGES  (บังคับ) รายชื่อหน้า คั่นด้วย `,` — ใส่ query ต่อท้ายได้ (`Name&tab=x&view=y`)
            เพราะ `?p=` ตัดที่ `&` ให้เองตอนหา component ส่วนที่เหลือไหลเข้า MemoryRouter
     W/H    ขนาดจอ (ดีฟอลต์ 1500×1000 · มือถือใช้ 390)
     ROLE / SECTIONS   มุมมองสิทธิ์ (ดีฟอลต์ admin · ว่าง = ไม่จำกัดส่วนงาน)
     FULL=1 ถ่ายทั้งหน้า (ยาวมาก — ใช้ตอนอยากเห็น "กำแพงข้อความ" ทั้งก้อน)
     CLIP   regex ของข้อความในหัวข้อ → ถ่ายเฉพาะกล่องนั้น (เล็งการ์ดเดียว)
     UP     กี่ชั้นที่ต้องไต่ขึ้นจาก div ที่ match เพื่อให้ได้ "การ์ด" (ดีฟอลต์ 2)
     TAG    คำต่อท้ายชื่อไฟล์ (เช่น before/after)
     SCALE  deviceScaleFactor (ดีฟอลต์ 2 = คมพอให้คนอ่านตัวหนังสือบนมือถือ)
     OUT    โฟลเดอร์ปลายทาง (ดีฟอลต์ = scratchpad ของ session)

   🔴 ต้องเปิด harness ค้างไว้ก่อน: `npx vite --config audit/vite.audit.mjs` (พอร์ต 5199)
   🔴 ใช้ `executablePath: '/opt/pw-browsers/chromium'` เหมือนสวีปตัวอื่น — ไม่ใส่ = playwright
      ไปหา headless-shell ที่ไม่มีในเครื่องนี้ แล้วบอกให้รัน `npx playwright install` (อย่ารัน)
   🔴 รูปที่ได้ = **ข้อมูลจำลองใน `audit/mockSupabase.js`** ไม่ใช่ของหน้างาน — เวลาส่งให้ user
      ต้องบอกเสมอ ไม่งั้นเขาอ่านตัวเลขในรูปเป็นของจริง
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const PAGES = (process.env.PAGES || '').split(',').map(s => s.trim()).filter(Boolean)
if (!PAGES.length) { console.error('ต้องระบุ PAGES — เช่น PAGES=\'ProductionPlan&tab=lots\' node audit/uishot.mjs'); process.exit(2) }

const W = Number(process.env.W || 1500)
const H = Number(process.env.H || 1000)
const ROLE = process.env.ROLE || 'admin'
const SECTIONS = process.env.SECTIONS || ''
const FULL = process.env.FULL === '1'
const CLIP = process.env.CLIP || ''
const UP = Number(process.env.UP || 2)
const TAG = process.env.TAG ? `-${process.env.TAG}` : ''
const SCALE = Number(process.env.SCALE || 2)
const OUT = process.env.OUT || '/tmp/claude-0/-home-user-4Mmanagement/dbf310c4-2f4d-5d4d-a662-65304b27106b/scratchpad/shots'
mkdirSync(OUT, { recursive: true })

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
for (const p of PAGES) {
  /* ชื่อไฟล์: เอาอักขระที่ใช้ในชื่อไฟล์ไม่ได้ออก (`&`/`=` ของ query) */
  const name = p.replace(/[^A-Za-z0-9ก-๙_-]+/g, '_').replace(/^_|_$/g, '')
  const page = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE })
  const errs = []
  page.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 120)))
  const url = `http://localhost:5199/audit/index.html?p=${p}&role=${ROLE}${SECTIONS ? `&sections=${SECTIONS}` : ''}`
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 })
    await page.waitForTimeout(2500)
    const crash = await page.evaluate(() => window.__crash)
    const file = `${OUT}/${name}${TAG}.png`
    if (CLIP) {
      /* 🔴 `.last()` = div ชั้นในสุดที่ match — `.first()` จะได้ ancestor ก้อนใหญ่ (ทั้งหน้า)
         เพราะ hasText ไล่ขึ้นไปทุกชั้นที่ "มีข้อความนี้อยู่ข้างใน" */
      const hit = page.locator('div').filter({ hasText: new RegExp(CLIP) }).last()
      if (!(await hit.count())) { console.log(`${name}: ⚠ หา CLIP ไม่เจอ — ถ่ายทั้งจอแทน`); await page.screenshot({ path: file, fullPage: FULL }) }
      else {
        const card = UP > 0 ? hit.locator(`xpath=${'../'.repeat(UP).replace(/\/$/, '')}`) : hit
        await card.scrollIntoViewIfNeeded(); await page.waitForTimeout(400)
        await card.screenshot({ path: file })
      }
    } else {
      await page.screenshot({ path: file, fullPage: FULL })
    }
    console.log(`${name}${TAG}: ${file}${crash ? ' · 🔴 หน้าพัง' : ''}${errs.length ? ` · error: ${errs[0]}` : ''}`)
  } catch (e) {
    console.log(`${name}: ❌ ${String(e).slice(0, 140)}`)
  }
  await page.close()
}
await b.close()
