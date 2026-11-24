# -*- coding: utf-8 -*-
"""ชุดเตรียมความพร้อม PMO สาย SPG — TSOS (ธีม TSG R01 · ไทย · 2026-11-24)
Run:  python3 build_spg_pmo.py  →  ../TSAT_SPG_PMO_Prep_2026-11-24.pptx
เนื้อหาเดียวกับ ../SPG-PMO_Prep-Pack_2026-11-24.md (แก้ที่ md แล้วตามมาแก้ที่นี่)
ผังอ้างอิง: Holding Biz Plan 2027 (Draft1, 19/11/26) หน้า 70 · [รอระบุ] = ยังไม่มีข้อมูล ห้ามเดา
"""
import os
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
import tsg_theme as T
from tsg_theme import GREEN, GREEN_D, GREEN_TINT, BORDER, ORANGE, GREY, WHITE

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "TSAT_SPG_PMO_Prep_2026-11-24.pptx")
p = T.new_pres()
page = [0]
C, MID = PP_ALIGN.CENTER, MSO_ANCHOR.MIDDLE
TBD = "[รอระบุ]"


def notes(s, th):
    s.notes_slide.notes_text_frame.text = th


def content(title, sub=None):
    s = T.blank(p); page[0] += 1
    T.head(s, title, sub)
    T.footer(s, page[0])
    return s


def table(s, x, y, cols, rows, rh=0.42, sz=12, hsz=13, colors=None, bold=None):
    tw = sum(w for _, w in cols)
    T.rect(s, x, y, tw, rh, fill=GREEN_D)
    xx = x
    for h, w in cols:
        T.text(s, xx + 0.08, y, w - 0.16, rh, [[(h, {"sz": hsz, "b": True, "c": WHITE})]], anchor=MID)
        xx += w
    for i, row in enumerate(rows):
        yy = y + rh * (i + 1)
        if i % 2:
            T.rect(s, x, yy, tw, rh, fill=GREEN_TINT)
        xx = x
        for j, (v, (_, w)) in enumerate(zip(row, cols)):
            c = (colors or {}).get((i, j), GREEN_D if j == 0 else GREY)
            b = (bold or {}).get((i, j), j == 0)
            T.text(s, xx + 0.08, yy, w - 0.16, rh, [[(v, {"sz": sz, "b": b, "c": c})]], anchor=MID)
            xx += w
    T.rect(s, x, y + rh * (len(rows) + 1), tw, 0.02, fill=GREEN)


def card(s, x, y, w, h, head, lines, hc=GREEN_D, bar=GREEN, sz=12):
    T.rect(s, x, y, w, h, fill=WHITE, line=BORDER, shape=MSO_SHAPE.ROUNDED_RECTANGLE, shadow=True)
    T.rect(s, x, y, 0.1, h, fill=bar)
    T.text(s, x + 0.25, y + 0.1, w - 0.4, h - 0.2,
           [[(head, {"sz": 15, "b": True, "c": hc})]] + [[("•  " + l, {"sz": sz, "c": GREY})] for l in lines], sa=4)


def banner(s, t, c=ORANGE, y=6.3):
    T.text(s, 0.5, y, 12.3, 0.5, [[(t, {"sz": 14, "b": True, "c": c})]], anchor=MID)


def box(s, x, y, w, h, head, sub, c, fill=WHITE, hc=None):
    T.rect(s, x, y, w, h, fill=fill, line=c, lw=1.5, shape=MSO_SHAPE.ROUNDED_RECTANGLE)
    T.text(s, x, y, w, h, [[(head, {"sz": 14, "b": True, "c": hc or c})], [(sub, {"sz": 11, "c": GREY if fill == WHITE else WHITE})]],
           align=C, anchor=MID, sa=0)


# ── 1 ปก ──
s = T.title_slide(p, "เตรียมความพร้อม PMO สาย SPG",
                  "TSOS — Thai Summit Operating System",
                  "PMO สาย SPG · 24 พฤศจิกายน 2569",
                  "TSAT · Thai Summit Group",
                  decl_label="คำประกาศคุณภาพของฉัน")
page[0] += 1
notes(s, "ชุดเตรียมความพร้อมของ PMO สาย SPG ตามผัง TSOS ใน Holding Biz Plan 2027 ฉบับร่าง เริ่มจากเรื่องที่ที่ประชุมยังเถียงกัน คืองานที่ทับซ้อนระหว่าง Holding กับ SPG")

# ── 2 ผัง ──
s = content("สาย SPG อยู่ตรงไหนใน TSOS", "ถอดจากผัง TSOS Organization Chart · Holding Biz Plan 2027 (Draft1) หน้า 70")
box(s, 4.65, 1.55, 4.0, 0.7, "Steering Committee", "EVP · SVP", GREEN_D)
box(s, 4.65, 2.45, 4.0, 0.7, "TSOS Project Manager", "คุณ Saranya", GREEN_D)
T.rect(s, 6.64, 2.25, 0.03, 0.2, fill=GREEN); T.rect(s, 6.64, 3.15, 0.03, 0.25, fill=GREEN)
T.rect(s, 2.5, 3.4, 8.4, 0.03, fill=GREEN)
cols3 = [(0.5, "HOLDING", "PMO: คุณ Saranya", GREEN_D,
          ["E-Workflow (Back Office)", "New model", "HCM / HR system", "OEE", "TPM"],
          "Key User: HRM · ACC · IT · SCM · AOBM · IA · MTK (Pilot)"),
         (4.65, "SHARED SUPPORT", "IT", GREY,
          ["Infrastructure: Server · Network · Client Device", "Security: Compliance · IAM · Monitoring & Risk"], ""),
         (8.8, "SPG", "PMO: คุณ Dulyatrust", ORANGE,
          ["Enterprise shopfloor management", "Maintenance", "Machine learning + Interlock"],
          "Key User: AMF · Int & Ext · Mocy · DMF · TSHG · CAC · Dev 6 คน")]
for x, h, sub, c, scope, ku in cols3:
    T.rect(s, x + 2.0, 3.4, 0.03, 0.2, fill=GREEN)
    T.rect(s, x, 3.6, 4.05, 0.62, fill=c, shape=MSO_SHAPE.ROUNDED_RECTANGLE)
    T.text(s, x, 3.6, 4.05, 0.62, [[(h, {"sz": 15, "b": True, "c": WHITE})], [(sub, {"sz": 11, "c": WHITE})]], align=C, anchor=MID, sa=0)
    T.rect(s, x, 4.32, 4.05, 1.85, fill=WHITE, line=c if c == ORANGE else BORDER, lw=1.5 if c == ORANGE else 0.75, shape=MSO_SHAPE.ROUNDED_RECTANGLE)
    T.text(s, x + 0.2, 4.4, 3.7, 1.75, [[("•  " + t, {"sz": 12, "c": GREEN_D})] for t in scope] +
           ([[(ku, {"sz": 11, "c": GREY})]] if ku else []), sa=3)
banner(s, "Scope ของ SPG ข้อแรก = ESM ที่ใช้งานจริงที่ TSAT4 อยู่แล้ว · แต่ Scope ของ Holding (OEE · TPM · HR · New model) ทับกับสิ่งที่ ESM มี", ORANGE, 6.35)
notes(s, "ถอดผังตามภาพ กล่องส้มคือสายที่เรารับผิดชอบ Scope แรกคือ Enterprise shopfloor management ซึ่งก็คือ ESM ที่ใช้อยู่ที่ TSAT4 ปัญหาคือ Scope ฝั่ง Holding มี OEE TPM HR และ New model ซึ่ง ESM ทำอยู่แล้ว นี่คือที่มาของการเถียงกันในที่ประชุม")

# ── 3 ทำไมเถียงกัน ──
s = content("ทำไมเถียงกันเรื่องงานทับซ้อน", "ผังแบ่งงานตาม \"หัวข้อ\" แต่หัวข้อเดียวกันมีหลายชั้น")
layers = [("ชั้นผู้บริหาร / กลุ่ม", "รวม · เทียบ · ตั้งเป้า ระดับกลุ่ม", GREEN_D, "Holding"),
          ("ชั้นคำนวณ", "สูตร KPI (OEE · MTBF · %Q)", GREEN, "?"),
          ("ชั้นบันทึกหน้างาน", "ยอดผลิต · เวลาหยุด · ของเสีย · ใบซ่อม", GREEN, "SPG (ESM)"),
          ("ชั้นเครื่องจักร (OT)", "stroke · สถานะ · สัญญาณ PLC/SCADA", GREY, "SPG (OT)")]
for i, (h, d, c, own) in enumerate(layers):
    y = 1.65 + i * 1.0
    T.rect(s, 0.5, y, 5.6, 0.85, fill=c, shape=MSO_SHAPE.ROUNDED_RECTANGLE)
    T.text(s, 0.7, y, 5.2, 0.85, [[(h, {"sz": 15, "b": True, "c": WHITE})], [(d, {"sz": 11, "c": WHITE})]], anchor=MID, sa=0)
    T.text(s, 6.2, y, 1.6, 0.85, [[(own, {"sz": 14, "b": True, "c": ORANGE if own == "?" else GREEN_D})]], anchor=MID)
T.text(s, 0.5, 5.75, 7.3, 0.5, [[("ตัวอย่าง OEE: เกิดที่หน้างาน แต่ผู้บริหารดูที่ Holding — ทั้งสองฝั่งพูดถูกในชั้นของตัวเอง", {"sz": 12, "c": GREY})]])
T.rect(s, 8.1, 1.65, 4.75, 4.55, fill=GREEN_TINT, shape=MSO_SHAPE.ROUNDED_RECTANGLE)
T.text(s, 8.35, 1.75, 4.3, 4.4, [[("หลักที่เสนอให้ที่ประชุมรับ", {"sz": 16, "b": True, "c": ORANGE})]] + [
    [(f"{i + 1}.  {t}", {"sz": 13, "b": True, "c": GREEN_D})] for i, t in enumerate([
        "ข้อมูลแต่ละเรื่องมีระบบเจ้าของเพียงระบบเดียว ระบบอื่นอ่านต่อผ่าน API",
        "คำนวณ KPI ที่ต้นทางจาก raw data — ห้ามคำนวณตัวเดียวกัน 2 ที่",
        "Master data (คน · ผังองค์กร · cost center) อยู่ระบบเดียว"])], sa=12)
banner(s, "แบ่งงานตาม \"ชั้นของข้อมูล\" แทน \"หัวข้อ\" — แล้วจุดชนส่วนใหญ่จะหายไปเอง", GREEN_D, 6.35)
notes(s, "เหตุที่เถียงกัน: ผังแบ่ง scope เป็นหัวข้อ เช่น OEE แต่ OEE มีหลายชั้น ข้อมูลเกิดที่เครื่องจักรและหน้างาน ถูกคำนวณเป็นตัวเลข แล้วผู้บริหารดูระดับกลุ่ม ถ้าแบ่งตามชั้นจะเห็นว่าแต่ละฝั่งรับคนละชั้น ชั้นที่ยังเป็นคำถามคือชั้นคำนวณ ขอให้ที่ประชุมรับ 3 หลักทางขวาก่อน แล้วค่อยไล่ทีละหัวข้อในสไลด์ถัดไป")

# ── 4 ตารางจุดชน ──
s = content("จุดชน Holding ↔ SPG และข้อเสนอแบ่งงาน", "ข้อเสนอให้ที่ประชุมตัดสิน · ESM = สิ่งที่มีในระบบจริงวันนี้ (ตรวจจากโค้ด 24/11)")
rows = [["OEE", "ESM คำนวณจากบันทึกรายกะ · OBEYA", "OEE 2 ชุด", "SPG คำนวณจาก raw data · Holding รวมระดับกลุ่มโดยอ่านจาก SPG"],
        ["TPM ↔ Maintenance", "ใบซ่อม MO · PM/AM · ทะเบียนเครื่อง", "งานซ่อม 2 ที่", "A: Holding = โปรแกรม TPM · SPG = ระบบปฏิบัติงาน  /  B: ย้าย TPM ไป SPG"],
        ["HCM/HR ↔ คนหน้างาน", "เช็คชื่อ · กะ/OT · Skills · Manpower", "ทะเบียนคน 2 ชุด", "HCM = เจ้าของทะเบียนพนักงาน · SPG อ่านไปใช้ เก็บแค่ข้อมูลหน้างาน"],
        ["New model", "เว็บ New Model (IEC) แยกแล้ว", "อาจทำซ้ำ", TBD + " นิยาม New model ของ Holding ก่อน"],
        ["E-Workflow", "workflow ใบงานหน้างาน · /doc-forms", "เครื่องมือ 2 ตัว", "Holding = back office · SPG = ใบงานหน้างาน · ทะเบียนเลขฟอร์มที่เดียว"],
        ["ML + Interlock", "ยังไม่มี · ESM ไม่สั่งงานเครื่อง", "พึ่ง OT", TBD + " นิยาม Interlock + ผู้รับผิดชอบ safety"]]
colors = {(i, 2): ORANGE for i in range(len(rows))}
colors.update({(3, 3): ORANGE, (5, 3): ORANGE})
table(s, 0.5, 1.6, [("เรื่อง", 2.2), ("ESM มีอยู่แล้ว", 3.2), ("จุดชน", 1.6), ("ข้อเสนอแบ่ง", 5.35)], rows, rh=0.62, sz=11, colors=colors)
notes(s, "ไล่ทีละแถว คอลัมน์ที่สองคือสิ่งที่มีในระบบจริงวันนี้ ไม่ใช่แผน คอลัมน์สุดท้ายเป็นข้อเสนอเท่านั้น ที่ประชุมตัดสิน แถว TPM มีสองทางเลือก แถว New model กับ Interlock ยังตัดสินไม่ได้ เพราะยังไม่มีใครนิยามว่าหมายถึงอะไร")

# ── 5 คำถามตัดสิน ──
s = content("ขอคำตัดสินจากที่ประชุม", "5 ข้อนี้ต้องได้คำตอบก่อนเริ่มงาน ไม่งั้นทั้ง 2 สายจะพัฒนาซ้ำกัน")
qs = [("รับหลัก 3 ข้อหรือไม่", "เจ้าของข้อมูลเดียว · คำนวณที่ต้นทาง · master data ที่เดียว"),
      ("OEE: ใครคำนวณ ใครแสดง", "เสนอ: SPG คำนวณ · Holding แสดงระดับกลุ่ม"),
      ("TPM: ทางเลือก A หรือ B", "A แยกโปรแกรม/ระบบปฏิบัติงาน · B ย้ายไป SPG"),
      ("ข้อมูลพนักงานไหลทางไหน", "เสนอ: HCM → SPG · และชั่วโมง OT จากหน้างาน → payroll ?"),
      ("\"New model\" และ \"Interlock\" คืออะไร", "ใครนิยาม · ใครรับผิดชอบ safety ของ Interlock")]
for i, (h, d) in enumerate(qs):
    y = 1.6 + i * 0.92
    T.rect(s, 0.8, y + 0.05, 0.65, 0.65, fill=ORANGE, shape=MSO_SHAPE.OVAL)
    T.text(s, 0.8, y + 0.05, 0.65, 0.65, [[(str(i + 1), {"sz": 20, "b": True, "c": WHITE})]], align=C, anchor=MID)
    T.text(s, 1.7, y, 11.0, 0.8, [[(h, {"sz": 17, "b": True, "c": GREEN_D})], [(d, {"sz": 12, "c": GREY})]], anchor=MID, sa=1)
notes(s, "ปิดเรื่องทับซ้อนด้วยคำถาม 5 ข้อ ถ้าที่ประชุมตอบได้วันนี้ แต่ละสายเริ่มงานได้โดยไม่ซ้ำกัน ถ้ายังตอบไม่ได้ ขอให้กำหนดคนตัดสินและวันที่")

# ── 6 baseline + เงื่อนไข ──
s = content("สาย SPG ไม่ได้เริ่มจากศูนย์ — แต่มีเงื่อนไขก่อนขยาย", "ESM ใช้งานจริงที่ TSAT4 · ตัวเลขจากเอกสาร ECM-PMO_SFM-Facts")
for i, (big, lab) in enumerate([("87", "หน้าจอ"), ("121", "บัญชีผู้ใช้"), ("~790 MB", "ข้อมูล · โต ~300 MB/เดือน"), ("1 คน + AI", "ทีมพัฒนาวันนี้")]):
    x = 0.5 + i * 3.1
    T.rect(s, x, 1.6, 2.95, 1.15, fill=WHITE, line=BORDER, shape=MSO_SHAPE.ROUNDED_RECTANGLE, shadow=True)
    T.rect(s, x, 1.6, 0.1, 1.15, fill=ORANGE if i == 3 else GREEN)
    T.text(s, x + 0.25, 1.62, 2.6, 0.65, [[(big, {"sz": 24, "b": True, "c": ORANGE if i == 3 else GREEN})]], anchor=MID)
    T.text(s, x + 0.25, 2.25, 2.6, 0.45, [[(lab, {"sz": 12, "c": GREY})]])
table(s, 0.5, 3.0, [("เงื่อนไขก่อนรับบริษัทที่ 2", 4.2), ("สถานะวันนี้", 4.0), ("ถ้าไม่ทำ", 4.15)], [
    ["แยกข้อมูลต่อบริษัท (company_id)", "ยังไม่มีเลย (ตรวจ migration 24/11)", "บริษัทหนึ่งเห็นข้อมูลอีกบริษัท"],
    ["ฐาน DR ผูกการ login", "known gap — เข้าด้วย anon key", "ข้อมูลผลิตเปิดต่อใครก็ได้ที่มี key"],
    ["SSO / บัญชีชุดเดียว", "ยังไม่มี", "ถอนสิทธิ์คนลาออกไม่ทัน"],
    ["ย้ายขึ้น server บริษัท (INET)", "แผน 2 ขั้น · ยังไม่มีใบเสนอราคา", "ยังผูกคลาวด์ต่างประเทศ"],
    ["backup + ซ้อมกู้คืน", "ยังไม่ครบเงื่อนไข self-host", "ล่มแล้วกู้ไม่ได้ทุกบริษัท"],
], rh=0.5, sz=12, colors={(0, 1): ORANGE, (1, 1): ORANGE})
notes(s, "สี่ตัวเลขบนคือฐานที่มีอยู่ ตารางล่างคือสิ่งที่ต้องทำก่อนให้บริษัทที่สองขึ้นระบบ สองแถวสีส้มสำคัญที่สุด ถ้าเอาหลายบริษัทมาอยู่ฐานเดียวโดยไม่แยกข้อมูลและไม่ปิดช่อง anon key บริษัทหนึ่งจะเห็นข้อมูลอีกบริษัท")

# ── 7 ทีม ──
s = content("ทีมสาย SPG", "Key User 6 หน่วยตามผัง · Developer 6 คน (การแบ่งบทบาทเป็นข้อเสนอ)")
T.text(s, 0.5, 1.55, 5.6, 0.4, [[("Key User", {"sz": 16, "b": True, "c": GREEN_D})]])
for k, d in enumerate(["AMF", "Int & Ext", "Mocy", "DMF", "TSHG", "CAC"]):
    cx = 0.5 + (k % 2) * 2.85; cy = 2.0 + (k // 2) * 0.82
    T.rect(s, cx, cy, 2.7, 0.7, fill=GREEN_TINT, shape=MSO_SHAPE.ROUNDED_RECTANGLE)
    T.text(s, cx, cy, 2.7, 0.7, [[(d, {"sz": 14, "b": True, "c": GREEN_D})], [("Key User: " + TBD, {"sz": 11, "c": ORANGE})]], align=C, anchor=MID, sa=0)
T.text(s, 0.5, 4.55, 5.6, 1.6, [[("หน้าที่: แทนความต้องการของหน่วย · ยืนยัน requirement · ผลักดันการใช้งาน", {"sz": 12, "c": GREY})],
                                 [("ต้องถาม: ชื่อย่อแต่ละตัว = บริษัท/โรงงานไหน · TSAT4 อยู่ใต้หน่วยไหน · หน่วยไหนนำร่องก่อน", {"sz": 12, "b": True, "c": ORANGE})]], sa=6)
table(s, 6.4, 1.6, [("บทบาท Developer (เสนอ)", 2.9), ("งานหลัก", 3.55)], [
    ["Tech Lead / Code owner", "review · สถาปัตยกรรม · ด่าน build"],
    ["Platform & Security", "company_id · ปิด gap DR · SSO · INET"],
    ["Shopfloor", "Daily Report · OEE · 4M · ใบปัญหา"],
    ["Maintenance", "MO · PM/AM · อะไหล่ · แม่พิมพ์"],
    ["OT / Integration", "raw data เครื่องจักร · Interlock"],
    ["Data / ML", "ชั้นข้อมูลวิเคราะห์ · ML"],
], rh=0.55, sz=12)
T.text(s, 6.4, 5.5, 6.45, 0.4, [[("ชื่อ · ทักษะ · เต็มเวลาหรือไม่ · วันเริ่ม = " + TBD, {"sz": 12, "b": True, "c": ORANGE})]])
notes(s, "ซ้ายคือ Key User 6 หน่วยตามผัง ทุกช่องยังรอชื่อ และยังไม่รู้ว่า TSAT4 ที่ใช้ระบบอยู่จริงอยู่ใต้หน่วยไหน ขวาคือข้อเสนอแบ่งบทบาท developer 6 คน แบ่งตามโมดูลของระบบและงานฐานรากที่ต้องทำ ปรับได้ตามทักษะของคนที่ได้มาจริง")

# ── 8 onboarding + วิธีทำงาน ──
s = content("Developer: onboarding และวิธีทำงานที่ต้องเปลี่ยน", "จาก 1 คน + AI เป็นทีม 6 คน")
steps = [("1", "เตรียมเครื่องมือ", "GitHub · Supabase (อ่านก่อน)"),
         ("2", "อ่านกฎระบบ", "CLAUDE.md · ENGINEERING-PRINCIPLES · โมดูลตัวเอง"),
         ("3", "รัน build เต็ม", "lint → เทส 2 รอบ → build ผ่าน"),
         ("4", "งานแรก", "บั๊กเล็ก 1 ชิ้น ผ่าน PR + review"),
         ("5", "รับโมดูล", "เป็นเจ้าของ + อัปเดตเอกสารโมดูล")]
for i, (n, h, d) in enumerate(steps):
    x = 0.5 + i * 2.5
    T.rect(s, x, 1.6, 2.35, 0.6, fill=GREEN, shape=MSO_SHAPE.CHEVRON if i else MSO_SHAPE.PENTAGON)
    T.text(s, x + 0.15, 1.6, 2.05, 0.6, [[(f"{n} · {h}", {"sz": 13, "b": True, "c": WHITE})]], align=C, anchor=MID)
    T.text(s, x + 0.1, 2.3, 2.2, 0.8, [[(d, {"sz": 11, "c": GREY})]])
table(s, 0.5, 3.25, [("วันนี้ (1 คน + AI)", 6.1), ("เมื่อมี 6 คน (เสนอ)", 6.25)], [
    ["AI merge เข้า main ได้เองเมื่อ build ผ่าน", "ทุกงานผ่าน PR + review อย่างน้อย 1 คน"],
    ["ไม่มี staging — main = ทดสอบ", "มี staging แยก · ทดสอบก่อนขึ้นจริง"],
    ["ห้าม deploy 08:00–17:30", "คงกฎ · เพิ่มคนอนุมัติ release"],
    ["ความรู้อยู่ที่เอกสาร + คนเดียว", "เจ้าของรายโมดูล + คนสำรอง 1 คน/โมดูล"],
], rh=0.48, sz=12, bold={(i, 0): False for i in range(4)})
banner(s, "เอกสารในรีโปเขียนให้ AI อ่านเป็นหลัก — ต้องทำฉบับสรุปสำหรับคนเพิ่ม", ORANGE, 5.75)
notes(s, "บนคือ 5 ขั้น onboarding ล่างคือวิธีทำงานที่ต้องเปลี่ยน ตอนนี้ AI รวมงานเข้าระบบจริงได้เองเมื่อผ่านด่านทดสอบ ถ้ามีหกคนต้องมีคนรีวิวและมี staging ข้อสังเกตสำคัญ เอกสารในระบบเขียนให้ AI อ่าน ต้องทำฉบับสำหรับคนเพิ่ม")

# ── 9 Shared Support ──
s = content("สิ่งที่ขอจาก Shared Support (IT)", "จับคู่กับกล่องในผัง TSOS")
table(s, 0.5, 1.6, [("กล่องในผัง", 3.0), ("ขอ", 6.6), ("ใช้กับ", 2.75)], [
    ["Server", "server INET + เครื่องรับ backup แยก · สเปค 8 cores · 32 GB · 500 GB NVMe · ใบเสนอราคา", "ย้ายขึ้นบริษัท"],
    ["Network", "VPN ระหว่างไซต์ · ทางเข้ามือถือนอกโรงงานที่ปลอดภัย", "หลายบริษัท · มือถือ"],
    ["Client Device", "PC · จอ TV (Chromium ≥ 94) · handheld/สแกนเนอร์ ต่อไซต์", "หน้างาน"],
    ["Security & Compliance", "นโยบายข้อมูล · ต้องอยู่ในประเทศหรือไม่", "ทุกบริษัท"],
    ["Access Control & IAM", "SSO (M365?) · ขั้นตอนเปิด/ปิดบัญชีพนักงาน", "หลายบริษัท"],
    ["Security Monitoring & Risk", "log · แจ้งเตือนเหตุผิดปกติ · pen test", "หลังขึ้นระบบ"],
], rh=0.6, sz=12)
notes(s, "แต่ละแถวตรงกับกล่องในผัง Shared Support สเปค server มาจากการคำนวณขนาดข้อมูลจริงเมื่อ 28 ต.ค. จอ TV หน้างานต้องรองรับ Chromium 94 ขึ้นไป เพราะระบบทดสอบกับรุ่นนี้")

# ── 10 Roadmap ──
s = content("Roadmap สาย SPG", "ขั้นตอนและด่านผ่าน · วันที่รอยืนยันหลังได้ทีมและงบ")
phases = [("0", "ตั้งทีม", ["ตัดสินจุดชน", "ชื่อ Key User + Dev", "Charter สาย SPG"]),
          ("1", "ฐานราก", ["onboarding dev", "company_id · ปิด gap DR", "SSO · INET · backup"]),
          ("2", "นำร่องบริษัทที่ 2", ["1 หน่วย (" + TBD + ")", "ใช้งานจริงครบกะ", "UAT ผ่าน"]),
          ("3", "ขยายผล", ["ทีละหน่วยที่เหลือ", "วัดผลก่อน-หลัง"]),
          ("4", "OT · ML", ["Interlock + ML", "หลังนิยามชัด", "มีข้อมูลเครื่องจักรพอ"])]
for i, (n, h, ls) in enumerate(phases):
    x = 0.5 + i * 2.5
    T.rect(s, x, 1.7, 2.35, 0.75, fill=ORANGE if i == 0 else GREEN, shape=MSO_SHAPE.CHEVRON if i else MSO_SHAPE.PENTAGON)
    T.text(s, x + 0.15, 1.7, 2.05, 0.75, [[(f"{n} · {h}", {"sz": 13, "b": True, "c": WHITE})]], align=C, anchor=MID)
    T.text(s, x + 0.1, 2.6, 2.25, 1.5, [[("•  " + l, {"sz": 12, "c": GREY})] for l in ls], sa=5)
T.rect(s, 0.5, 4.3, 12.35, 1.65, fill=GREEN_TINT, shape=MSO_SHAPE.ROUNDED_RECTANGLE)
T.text(s, 0.75, 4.38, 11.9, 1.5, [[("ด่านผ่าน", {"sz": 15, "b": True, "c": GREEN_D})],
                                  [("•  ขั้น 0 → 1: ที่ประชุมรับรองการแบ่งงาน Holding ↔ SPG", {"sz": 13, "c": GREY})],
                                  [("•  ขั้น 1 → 2: ซ้อมกู้คืนสำเร็จ + ทดสอบแยกข้อมูลบริษัทผ่าน", {"sz": 13, "c": GREY})],
                                  [("•  ระหว่างนี้ TSAT4 ใช้ ESM ต่อตามปกติ", {"sz": 13, "c": GREY})]], sa=4)
notes(s, "ห้าขั้น ยังไม่ใส่วันที่เพราะยังไม่มีทีมและงบ ด่านที่สำคัญคือจากขั้นหนึ่งไปสอง ต้องซ้อมกู้คืนได้จริงและทดสอบแล้วว่าบริษัทหนึ่งไม่เห็นข้อมูลอีกบริษัท ML กับ Interlock อยู่ท้ายสุด เพราะต้องมีนิยามและข้อมูลเครื่องจักรก่อน")

# ── 11 RACI ──
s = content("RACI ระหว่างสาย", "R ลงมือ · A รับผิดชอบสุดท้าย · C ให้ความเห็น · I รับทราบ")
cols = [("กิจกรรม", 3.75), ("Steering", 1.15), ("TSOS PM", 1.2), ("PMO Hold.", 1.25), ("PMO SPG", 1.2), ("Shared", 1.15), ("KU SPG", 1.15), ("Dev SPG", 1.5)]
rows = [["ตัดสินแบ่งงาน Holding ↔ SPG", "A", "R", "C", "C", "C", "I", "I"],
        ["งบประมาณสาย SPG", "A", "R", "I", "R", "C", "I", "I"],
        ["แผนงาน + ติดตามสาย SPG", "I", "A", "I", "R", "C", "C", "C"],
        ["Requirement หน้างาน", "I", "I", "I", "A", "I", "R", "C"],
        ["พัฒนา / แก้ระบบ ESM", "I", "I", "I", "A", "C", "C", "R"],
        ["Integration กับ Holding", "I", "A", "R", "R", "C", "I", "R"],
        ["Infra · Security · IAM", "I", "A", "I", "C", "R", "I", "C"],
        ["UAT + go-live ต่อหน่วย", "I", "I", "I", "A", "C", "R", "R"],
        ["รายงานสถานะสาย SPG", "I", "I", "I", "R/A", "I", "I", "C"]]
colors = {(i, j): (ORANGE if v in ("A", "R/A") else GREY) for i, r in enumerate(rows) for j, v in enumerate(r) if j}
table(s, 0.5, 1.6, cols, rows, rh=0.46, sz=12, colors=colors)
notes(s, "แต่ละแถวมีผู้รับผิดชอบสุดท้ายคนเดียว สีส้ม แถวแรกสำคัญที่สุด การแบ่งงานระหว่างสองสายต้องให้ Steering ตัดสิน ไม่ใช่ PMO สองสายตกลงกันเอง")

p.save(OUT)
print("saved", OUT, len(p.slides), "slides")
