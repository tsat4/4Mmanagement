# ความเข้าใจ 8D จาก deck "How to write an 8D" (v6) เทียบกับระบบ ESM

> แหล่ง: `1_How_to_write_an_8D_v6.pdf` (59 หน้า · ทั้ง deck มีชั้นข้อความ ใช้ `pdftotext` อ่านได้ทุกหน้า และดูภาพหน้า 21/32/36 ประกอบ)
> **deck นี้คือ Ford Global 8D (G8D)** — หัวกระดาษ "SPS and 8ds the right way (jstroud2@ford.com)", "Copyright © 2023 Ford Motor Company" · ใช้ร่วมกับ DMAIC/Six Sigma
> ⇒ ภาษาที่ใช้ (KPOV/KPIV, ERA, ICA, PCA, escape point, read across, 3x5 Why, VQR/PCT, AIMs, CDSID) เป็นของ Ford ถ้าลูกค้าเราคือ Ford หรือ Tier-1 ที่ส่ง Ford ให้ถือ deck นี้เป็น "เกณฑ์ที่เราจะโดนตรวจ"
> ระบบเรา: ตรวจโค้ดที่ commit `39a8dda0` (19/11/2026) · 📌 **เอกสารวิเคราะห์ ยังไม่ได้ลงมือ — ส่วน C/D รอ user ตัดสิน ห้ามหยิบไปทำเอง**

---

## A. เนื้อหา deck ทีละขั้น

### A.0 แนวคิดหลักของทั้ง deck (อ่านก่อน)

| หลัก | เนื้อหา | หน้า |
|---|---|---|
| 8D = **บทสรุป** ไม่ใช่เรื่องเล่า | "The 8D is a summary of the problem-solving process … NOT a long story!" งานวิเคราะห์ทั้งหมดอยู่ใน **back-up slides** (ชุดสไลด์ประกอบ) | 2, 16, 39 |
| คำถาม 4 ข้อที่ผู้บริหารต้องถามผู้แก้ปัญหา | ① ชิ้นงานบอกอะไร (What do the parts say?) ② มี useful contrast อะไร (ของดีกับของเสียต่างกันตรงไหน) ③ **KPOV** คืออะไร ④ ผลิตภัณฑ์/กระบวนการควรทำงานอย่างไร อธิบาย physics ได้ไหม (+ ถ้าแตก/กัดกร่อน ใช้ stress vs strength และ accelerated test หรือยัง) | 3, 55 |
| **"Don't ask for a Fish Bone!"** | ห้ามถามทฤษฎีสาเหตุ/ก้างปลา ก่อนตอบ 4 ข้อข้างบนได้ — deck **ไม่สนับสนุน** brainstorm แบบ Fishbone ในฐานะเครื่องมือหลัก | 3, 55 |
| ห้ามปิดถ้ายังไม่รู้ physics | Q5: "An 8D should not be closed until the physics of the failure mode are understood." | 39, 56 |
| นำเสนอ 8D ที่ยังไม่จบได้ | Q4: ใช้ได้ ถ้ามี **strategy + ตรรกะการแก้ปัญหา + next step** ไม่ใช่ใส่ "TBD" | 38, 43, 56 |
| เขียนให้เข้าใจได้โดยไม่ต้องมีคนนำเสนอ | ใส่ข้อเท็จจริง วันที่ เลขอ้างอิง (AIMs, เลขรถ, supplier) · **ไม่มีความกำกวม ไม่มีความเห็น** · อ้างอิงข้อมูล/รูปไปที่ back-up | 39 |
| 8D ที่เขียนไม่ดีทำให้งานเพิ่ม | ผู้บริหารไม่เข้าใจ → มอบงานเกินจำเป็น ถามมาก ประชุมเพิ่ม ไม่ได้รายงานจบ | 38 |
| A3 | Ford G8D **สร้าง A3 ให้อัตโนมัติจาก 8D** สำหรับรายงานผู้บริหาร (ภาพหน้า 36: Problem Solving Form มี D1 ทีม · D2 problem statement + impact · D4 ตาราง CAUSE 1/2/3 = Specific/Detection/Systemic แต่ละแถวมี Why×5 + Root cause + D3 ICA + D5/D6 PCA พร้อม DRI, Due Date, Verification, Validation, Status · มุมขวาบน ERA + "8D Stage" + Last Revised Date) | 34–36 |

### A.1 ส่วนหัวใบ (Issue header) — หน้า 5, 7
- **Issue**: คำอธิบายระดับสูง ระบุ "ชิ้นงาน (object) + อาการ (defect)"
- **Product/Process information**: ชื่อโปรแกรม (รุ่นรถ) + ชื่อชิ้นงาน
- **Organization information**: เจ้าของปัญหา (หน่วยงาน/โรงงาน)
- **Global 8D#**: เลขที่ใบ

### A.2 D0 — Prepare for the G8D (+ Emergency Response Action) — หน้า 5, 8
- **จุดประสงค์**: ตัดสินว่าจะใช้กระบวนการ 8D ไหม → ใช้เมื่อ "ยังไม่รู้สาเหตุราก + ผู้บริหารสนับสนุน" (ถ้ารู้สาเหตุแล้ว ไม่ต้องใช้ 8D)
- **ต้องกรอก**: ① **Symptom(s)** อาการที่สัมพันธ์กับ issue ② **Emergency Response Action(s) (ERA)** สิ่งที่ทำได้ทันทีระหว่างรอ ICA ③ **Date Implemented**
- ตัวอย่าง (แบบฝึก p48): โรงประกอบ yard hold + ตรวจรถในลาน, supplier hold ของทั้งหมด = ERA

### A.3 D1 — Establish the Team — หน้า 5, 9
- **ต้องกรอก**: ตาราง **Role (Leader/Member) · Name · CDSID (รหัสพนักงาน) · Phone**
- กฎ: ① นอกจาก Leader และ **Champion** ให้มีตัวแทนฝ่ายเทคนิค/กระบวนการ/วิศวกรรม ② **Champion** มีหน้าที่ปลดล็อกอุปสรรคและจัดลำดับงาน ③ **ต้องมี SME ที่เข้าใจ physics** ④ ทีมใหญ่พอให้ได้ข้อมูลครบ แต่เล็กพอให้ทำงานได้
- ตัวอย่าง (p48): Champion / Team leader / Process expert / SME

### A.4 D2 — Describe the Problem (Define/Measure) — หน้า 10, 17–28, 40
- **คำถามแกน**: "What's wrong with what?" ช่องว่างจากข้อกำหนด/ความคาดหวังลูกค้า
- **แยก 2 ช่อง**:
  - **Problem Statement** — สั้น ระบุ object + defect (ให้ผู้บริหารเข้าใจในบรรทัดเดียว)
  - **Problem Description** — ① **Who/What/Where/When/Why/How Big** (5W1H + How big = 5W2H) พร้อมรายละเอียด วันที่ เลขอ้างอิง เลขรถ supplier ② **useful contrasts** (รุ่นรถ, ซ้าย/ขวา, วันผลิต …) ③ **KPOV** ถ้ารู้แล้ว ④ ส่วน analysis = ข้อมูลประกอบ KPOV / การสังเกตกระบวนการ / **error state**
- กรอบ D2 บน template ระบุว่าต้อง: **characterize KPOV (physics sketch) · validate MSA · ยืนยันเสถียรภาพของกระบวนการ**
- **เครื่องมือ (back-up slides)**: Picture of issue (ชิ้นดีกับเสีย) p18 · Claim overview/fall-out/COPQ (QR, warranty R/1000, Paynter chart, I-MR chart) p19 · Process flow p20 · **Drill-down tree** (แยกทีละชั้น gauge/process → stability → component → characteristic → process parameter ขีดทิ้งกิ่งที่พิสูจน์ว่าไม่ใช่ พร้อมคอลัมน์ Clues/Evidence) p21 · Strategy slide p22 · Working backwards y→x p23 · KPOV characterization p25 · **Process stability (control chart: common vs special cause)** p26 · Physics sketch p27
- **Is / Is-Not**: deck พูดถึงในรูป "useful contrasts (Drill down tree/**is-is not**)" (p43) — ไม่ได้มีตาราง Is/Is-Not แยก แต่ "contrast" คือหัวใจของ D2–D4
- **ตัวอย่างไม่ดี (p40)**: "Vehicle found with defective radio at Dearborn Truck plant." → ไม่บอก 5W2H
- **ตัวอย่างดี (p40)**: Statement "Radio button broke off when changing the radio station." · Description ระบุลูกค้า (fleet), เลขรถ, ระยะไมล์, วันผลิต, ชิ้นเสียเพิ่มจาก audit พร้อมวันผลิต, ส่งชิ้นคืน supplier ที่ไหน

### A.5 D3 — Develop Interim Containment Actions (ICA) — หน้า 6, 11, 41–42
- **ต้องกรอก**: Interim Containment Action(s) · **Verification/Validation** · **Date Implemented**
- กฎ: ① เป็น **มาตรการใหม่** ② ระบุ **ทุกระดับ/ทุกจุด** (ลูกค้า, ระหว่างขนส่ง, คลัง, supplier, Tier 1/Tier 2) ③ อธิบาย**วิธี verify** การกักกัน (ง่ายสุด = ยืนยันว่าพนักงานทำตามขั้นตอนได้ ไปจนถึง **Gauge R&R**)
- containment ทำได้ทั้งกับ "สาเหตุที่น่าจะเป็น/สาเหตุจริง" และ "อาการ" · ตรวจย้อนจากลูกค้าปลายทางกลับไปถึงต้นทาง และระบุ **certification mark** ของแต่ละจุด
- **ตัวอย่างไม่ดี (Q7 p41)**: "100% visual inspection at assembly plant." → ไม่บอกตรวจอะไร ไม่ครอบทุกระดับ
- **ตัวอย่างดี (p41)**: แยกบรรทัดต่อระดับ Tier 2 / Tier 1 / Ford Assembly — วิธีตรวจ (บิด 10 N + ตรวจการทำงาน), **เครื่องหมายรับรองคนละสี** (sticker ฟ้า / sticker เขียว / ชอล์กขาว), วันที่เริ่ม
- **Best practices (p42)**:
  - ⏱ **ช่วง launch: ต้องมีของที่ผ่านการรับรอง (certified stock) ภายใน 24 ชม. หรือก่อนวันผลิตถัดไป** ← เป็น **กรอบเวลาเดียวที่ deck ระบุ**
  - แจ้งผู้บริหาร supplier ทันที · ตกลงวิธีคัดแยกร่วมกัน · **หาว่าของสงสัยอยู่ที่ไหนบ้างทั้งซัพพลายเชน**
  - ยืนยันว่าการคัดแยกไม่ทำให้ชิ้นงานเสียหายเพิ่ม · นิยาม defect ให้ชัด (รูป, ตัวอย่างชิ้น, คำอธิบาย) · มี procedure คัดแยก/rework
  - **ติดเครื่องหมายบนชิ้นที่ผ่าน + ป้าย "certified" บนบรรจุภัณฑ์ทุกด้าน** · อบรมคนคัดแยก
  - **validate การคัดแยกด้วยชิ้นดี-เสียแบบก้ำกึ่ง (Gauge R&R)** · วางแผนให้ของ certified ไหลต่อเนื่อง · **เมื่อยืนยัน root cause แล้ว กลับมาทบทวน containment**
- (back-up p58 Escaped Part Analysis) จำนวนที่ผลิตพร้อม defect · จำนวนที่กักได้ในแต่ละจุด · **จำนวนที่หลุดถึงลูกค้า**

### A.6 D4 — Define and Verify Root Cause **and Escape Point** (Analyze) — หน้า 6, 12, 22–24, 30–32, 43
- **ต้องกรอก**: Root Cause(s) & Verification · **Escape Point(s)** · Date · (ใน template มี "Physics-Chemistry Sketch / Process Flow / Results")
- **Root cause อธิบายว่าทำไมถึงเกิด · Escape อธิบายว่าทำไมหลุดไปขั้นถัดไป**
- **ห้าเลือกกลยุทธ์ (Five Strategies)** p12, p22: ① **Working backwards y→x** (เดินย้อนจาก KPOV error state ถึง KPIV ถาม "ที่ไหน" ซ้ำๆ) ② **Transfer function y=f(x)** (DOE/วิเคราะห์) ③ **Contrast & Convergence** (เปรียบเทียบปลายกระจาย, component swap) ④ **Acceleration to degradation/failure** ⑤ **Stress-Strength interference** + เครื่องมือ physics sketch, drill-down tree
- **root cause แบบ specific มี 2 ชนิด (Q2 p12)**: (ก) **Mistake** (หยิบชิ้นผิด, หยิบจับผิด) → อธิบายสาเหตุของความผิดพลาด (ข) **ไม่รู้ y=f(x)** (เช่น ความยาวขาเชื่อม = f(กระแส)) → อธิบาย y/x ที่ไม่รู้ + physics + สมการ
- **Escape**: mistake → ไม่มีวิธีตรวจ/วิธีตรวจล้มเหลวเพราะอะไร · y=f(x) → escape ของ CTS error state, KPOV, KPIV · ปัญหา design → ทำไม CAE/DV/PV ไม่จับ
- **Systemic**: พิมพ์ "Systemic Root Cause:" แล้วอธิบาย (มาตรฐานขาด/ไม่ครบ, business process)
- **3-legged 5 Why (3x5 Why)** p30–32: ขา **Specific** (Issue → Why ×5 → KPOV → KPIV → Solution PCA) · ขา **Detection** (Why ×5 → DETECTION root cause → PCA) · ขา **Systemic** (เริ่มจาก specific/detection root cause → Why → **Systemic RC 1 = มาตรฐานไม่ครบ** → solution อัปเดตมาตรฐาน · **Systemic RC 2 = business process** → solution อัปเดต business process · ทุกข้อต้องมี **timing + responsibility**) · "ไม่จำเป็นต้องมีครบทุกขา แต่ **ขา systemic สำคัญที่สุด**"
- **MSA** (p24): แยกว่า variation มาจาก gauge หรือ process
- **ถ้ายังไม่รู้ root cause (p39, p43)**: **ห้ามคัดลอกคำอธิบายปัญหามาใส่ ห้ามใส่ "TBD"** · ให้เขียน strategy, ชิ้นงานบอกอะไร, contrast อะไร (drill-down/is-is not), CTS error state + KPOV (ต้องเป็น physics หรือ geometry), ใช้ 3x5 Why
- **ตัวอย่างไม่ดี (Q9)**: "Broken radio buttons due to poor quality molding." · **ตัวอย่างดี**: RC = อุณหภูมิ melt 300° ต่ำไป เกิด knit line ทำให้ขาล็อกอ่อน · RC Escape = ไม่มีการตรวจ knit line และไม่มี functional torque test · RC Systemic = ไม่มี launch process ปรับค่าฉีดให้เหมาะ

### A.7 D5 — Define and Verify PCA — หน้า 6, 13, 28, 44
- **ต้องกรอก**: Chosen PCA(s) · **Verification** · Date
- กฎ: **PCA ทุกข้อต้องโยงกับ root cause แต่ละข้อ** (ทั้ง specific และ escape) + หลักฐาน/ทฤษฎีว่าได้ผล · เขียนแบบ **"What was done with what?"** (ระบุค่าพารามิเตอร์)
- **Verification = การทดลองสั้นก่อน implement** เพื่อยืนยันว่า PCA จะแก้ได้
- ตัวอย่างดี: "เปลี่ยนอุณหภูมิแม่พิมพ์จาก 300° เป็น 350° พร้อม control limit และ alarm ใหม่" · Q10: "ทดสอบทำลาย 30 ชิ้นที่ 350° ได้แรงบิดก่อนเสียหายสูงขึ้น" = **verification**
- Back-up "Before and After data" (p28): บอก % ที่ดีขึ้นใน **DPMO** หรือ failure rate

### A.8 D6 — Implement and Validate PCA (Improve) — หน้า 6, 14, 45
- **ต้องกรอก**: Implemented PCA(s) · **Validation** · **Date Implemented**
- **Validation = การศึกษาระยะยาวหลัง implement** ที่ยืนยันว่าแก้ได้จริง (เช่น เก็บ 125 ชิ้นใน 3 สัปดาห์ 25 subgroup แล้ว capability ดีขึ้น · แบบฝึก: Ppk −0.31 → 2.4 หลัง 1 เดือน · containment ยืนยันด้วย 0 defect)
- **Q12 — "Operator training is always a poor corrective action"** สำหรับกระบวนการที่ขึ้นกับคนต้องเป็น **error proofing หรือมาตรการควบคุม**
- Q11: "Modified mold temperature to optimize process" (ไม่ดี) → ต้องระบุค่าเดิมกับค่าใหม่ + control/alarm

### A.9 D7 — Prevent Recurrence (Control/Replicate) — หน้า 6, 15, 29, 32, 46
- **ต้องกรอก**: Prevent Action(s) + Date Implemented · **Recommendation(s)**
- **ต้องตอบครบ 3 ข้อ**:
  1. **ชิ้นนี้จะไม่เกิดซ้ำ**: อัปเดตเอกสารวิศวกรรม — PFMEA (ใส่ root cause ทั้งค่าต่ำไปและสูงไป), setup check sheet + supervisor sign-off, Control Plan (เช่น torque-to-failure ตอน setup และทุกกะ), WI
  2. **Read across**: กระบวนการ/ดีไซน์ที่คล้ายกันแก้ด้วย (เช่น ทำ DOE กับรุ่นอื่น)
  3. **Future launches**: แก้ **มาตรฐาน** (เช่น SDS ใส่ข้อกำหนด torque 20 Nm) + **business process** (ทีม/กระบวนการรีวิว KPIV + DOE ที่ milestone) ← มาจากขา systemic ของ 3x5 Why
- **Q13 ตัวอย่างไม่ผ่าน**: "อัปเดต PFMEA + setup sheet + CP" อย่างเดียว → **ไม่ครอบชิ้นที่คล้ายกันและไม่ครอบ launch ในอนาคต**
- Back-up "Control" (p29): ตาราง PFMEA ก่อน/หลัง (S/O/D/RPN 630 → 7) + action + **ผู้รับผิดชอบ + วันที่**

### A.10 D8 — Recognize Team and Individual Contribution — หน้า 5, 56
- template มีแค่หัวข้อ ("Recognize/Congratulate the team") **deck ไม่ได้ให้รายละเอียดเพิ่ม** (ไม่มีเกณฑ์ปิดเพิ่มที่ D8 นอกจาก "ห้ามปิดถ้ายังไม่รู้ physics")

### A.11 กรอบเวลา
- deck ระบุ**เพียงข้อเดียว**: containment ช่วง launch ต้องมี certified stock **ภายใน 24 ชม. หรือก่อนวันผลิตถัดไป** (p42)
- ช่อง "Date" มีในทุกขั้น D0, D3, D4, D5, D6, D7 (p5–6) ⇒ ลูกค้าคาดหวังว่าแต่ละขั้นมีวันที่ของตัวเอง
- **ไม่มีใน deck** (เป็นธรรมเนียมทั่วไปของลูกค้ายานยนต์ ต้องถามลูกค้า/ดู CSR จริง): containment 24 ชม. · D4 ภายใน ~10 วันทำการ · ปิด 8D ภายใน 30–60 วัน — **ห้ามฝังตัวเลขพวกนี้ในระบบจนกว่าจะได้ CSR**

### A.12 แบบฝึก Torque Converter (หน้า 47–51) — ตัวอย่าง 8D ที่เขียนครบ
| D | เนื้อหาในแบบฝึก |
|---|---|
| D0 ERA | yard hold + yard audit ที่โรงประกอบ · supplier hold ของทั้งหมด |
| D1 | Champion, Leader, Process expert, SME |
| D2 | น้ำมันรั่วที่ seam weld ของ torque converter F150 5R110 หลังขับ ½ ไมล์ · 3 คัน (4x2 สองคัน / 4x4 หนึ่งคัน) · วันผลิต 2/1, 2/1, 2/2 · **contrast**: ชิ้นเสียทั้งหมดมาจาก fixture 2 ชิ้นดีจาก fixture 1 · **KPOV = weld leg length** (เสีย 0.9–1.4 มม. ดี 2.0–2.4 มม.) capability แย่ |
| D3 ICA | supplier: helium leak test 100% (ซื้อเครื่อง + calibrate + **Gauge R&R ผ่าน**) · visual หลังเติมน้ำมัน 100% (อบรมคนตรวจ) · โรงประกอบ: visual หลังขับ test track 100% · validate: 0 defect |
| D4 | RC: fixture 2 ตั้งสูงเกิน ทำให้พลังงานเชื่อมลงไปที่ cover ขาเชื่อมสั้น · พารามิเตอร์เชื่อมไม่เคย optimize · **Escape**: weld leg length ไม่อยู่ใน quality inspection และ fixture height ไม่อยู่ใน process verification · **Systemic**: KPOV อยู่ใน SCCAF แต่ไม่ถูกส่งต่อเข้า PFMEA · ไม่มี business process ให้ทีมข้ามสายงานรีวิว SCCAF/physics/KPIV/DOE · กระบวนการ maintenance ไม่ระบุความสูงฐาน fixture |
| D5 | ปรับ fixture 2 = fixture 1 (verify 5 ชิ้น) · DOE: 300A/20 มม. → **350A/14 มม.** |
| D6 | validate: Ppk −0.31 → 2.40 ใน 1 เดือน (n=125) |
| D7 | PFMEA ใส่ failure mode weld crack + setup sheet (fixture height, 14 มม., 350A) + supervisor sign-off · WI/job setup · fixture height เป็น KPIV ใน **foundation PFMEA** + core PM process · ทีม/กระบวนการใหม่รีวิว SCCAF+KPIV+DOE ที่ PA milestone |

### A.13 ข้อผิดพลาดที่ deck เตือน (รวม)
1. problem statement กำกวม ไม่มี 5W2H (p40)
2. containment ไม่บอกว่าตรวจอะไร ไม่ครอบทุกระดับ ไม่มีเครื่องหมายรับรอง (p41)
3. root cause เป็นคำกว้าง ("poor quality molding") / คัดลอกอาการมาใส่ / "TBD" (p43)
4. ขาด escape และ systemic root cause (p43)
5. PCA ไม่มีค่าพารามิเตอร์ (p45) · **ใช้การอบรมพนักงานเป็น PCA** (p45)
6. สับสน verification (D5 สั้น ก่อนทำ) กับ validation (D6 ยาว หลังทำ) (p44–45, 56)
7. D7 แก้แค่ชิ้นนี้ ไม่ read across และไม่แก้มาตรฐาน/business process (p46)
8. ปิด 8D ทั้งที่ยังไม่เข้าใจ physics (p39)
9. ถามหา Fishbone / ทฤษฎีสาเหตุก่อนดูชิ้นงานและ contrast (p3)
10. การนำเสนอ: แต่ละสไลด์ต้องมีข้อความหลัก ≤7 คำ, ใช้กราฟแทนตาราง, **ใช้ลูกศรชี้ ห้ามวงกลมบนรูป**, ทำ dry run (p53–54)

---

## B. ตารางเทียบ deck กับระบบ ESM

### B.0 สิ่งที่ระบบเรามีอยู่ (สรุป)
| ส่วน | ที่อยู่ |
|---|---|
| ตาราง 8D | `qa_capa` (Main) — `supabase/migrations/20260709_qa_quality_module.sql` L84–106: `capa_no, ncr_id, title, owner_name, due_date, d1_team … d8_closure` (**text อิสระทุกช่อง**), `effectiveness`, `status open/in_progress/verify/closed`, `closed_at` |
| คอลัมน์เพิ่ม | `part_no, line_name, pe_review_status(pending/done/na), pe_review_note` (`20260817_pe_change_requests.sql` L57–62) · `d6_effective_from, eff_window_days, eff_defect_type_id/label, eff_verdict, eff_measured_at, eff_snapshot` (`20260818_capa_effectiveness.sql`) · audit + `created_by_uid` (`20261020_qa_inspection_audit_main.sql`) |
| UI 8D | `src/pages/QualityControl.jsx` L1589–1950 `CAPATab` + `D_FIELDS` (textarea 8 ช่อง) · ขั้นใบ `capaFlow()` ใน `src/utils/qaDocStatus.js` L37 |
| NCR | `qa_ncr` (Main) — source incoming/inprocess/final/customer, severity, `defect_desc`, `qty_found/qty_ng`, `containment` (text), `disposition`, `root_cause`, status — เปิดได้จาก `/qa` แท็บ NCR และจาก `QaCheckSheet.jsx` L617 |
| เคลมลูกค้า | `qa_customer_claims` (`20260817_qa_customer_claims.sql`) — customer, `customer_ref`, part, `lot_ref`, qty_claim/returned, `due_reply_date` (default วันนี้ +3 ใน `QaClaims.jsx` L65), `replied_at`, `cost_impact`, `ncr_id`, `capa_id` · ปิดเคลมไม่ได้ถ้าไม่มี 8D (hard gate) · ตรวจเคลมซ้ำ 2 ระดับ (`findRepeats` ใน `src/utils/peLink.js`) |
| ลูป D7 → PE | `pe_change_requests` (leg = occurrence/detection/systemic, applied ต้องผูก revision) · `src/components/PeChangeRequests.jsx` · `src/utils/peLink.js` · ด่านปิดแบบ soft: ต้องตอบ `pe_review_status` |
| วัดผล D6 | `src/utils/capaEffect.js` + `src/components/CapaEffectiveness.jsx` — ของเสีย/วันผลิตจาก `defect_logs` ก่อนและหลัง `d6_effective_from` · ลด ≥50% = ได้ผล · stamp ตอนปิด |
| แจ้งเตือน | event `qa_capa_opened` (`20260825_notify_targets_and_silent_events.sql` L102) |
| KPI | `/dept-dashboard?dept=qa` — "8D ปิดแล้ว เอกสารตามครบ %" + "8D ที่ของเสียลดจริง %" (`DeptDashboard.jsx` L738+) · `/qa` KPI "CAPA เกินกำหนด" |
| ที่เกี่ยวข้องแต่**ยังไม่ผูกกับ 8D** | ถังเหลือง/แดง `quality_bin_records` (DR) · ใบรายงานปัญหาการผลิต `prod_problem_reports` (DR) · `defect_logs` (DR) · สอบกลับ `/order-trace` + `SymptomSearch.jsx` · 4M `four_m_logs` · `/improvements` (A3 มี 5 Why/ก้างปลาและ Yokoten เป็น text: `src/utils/improvementA3.js` L53, L57) · Qc7 tools `src/utils/qc7.js` |

### B.1 ข้อกำหนดต่อข้อ
| # | ข้อกำหนดของ deck (หน้า) | ระบบเรา | อยู่ที่ไหน | ช่องว่าง |
|---|---|---|---|---|
| H1 | หัวใบ: Issue (object+defect), product/program, part, organization owner (p7) | มีบางส่วน | `qa_capa.title, part_no, line_name, owner_name` | ไม่มี program/รุ่นรถ/ลูกค้า บนตัว 8D (ต้องดูจากเคลม) · ไม่มีหน่วยงานเจ้าของ (CC/org node) |
| H2 | เลข 8D ของลูกค้า (Global 8D#) | มีบางส่วน | `qa_customer_claims.customer_ref` | อยู่ที่เคลม ไม่อยู่บน 8D · 8D ที่ไม่ได้มาจากเคลมไม่มีช่องนี้ |
| D0a | Symptom แยกจาก problem (p8) | ไม่มี | — | ไม่มีช่อง |
| D0b | **ERA + วันที่ทำ** (p8) | ไม่มี | (`qa_ncr.containment` เป็น text รวม) | ไม่มีช่อง ERA และไม่มีวันที่ |
| D0c | ตัดสินว่า "ควรใช้ 8D ไหม" (ยังไม่รู้สาเหตุ) | ไม่มี | — | ไม่มีเกณฑ์เปิด 8D (NCR→8D เปิดด้วยมือ) |
| D1a | ทีมเป็นตาราง Role/Name/ID/Phone (p9) | มีบางส่วน | `d1_team` text | ไม่ structured · ผูกกับ `profiles`/`employees` ไม่ได้ → แจ้งเตือนรายคนไม่ได้ |
| D1b | Champion + Leader + SME (p9) | ไม่มี | `owner_name` เท่านั้น | ไม่มีบทบาท Champion |
| D2a | แยก **Problem Statement** กับ **Description** (p10) | ไม่มี | `d2_problem` ช่องเดียว | — |
| D2b | 5W2H (Who/What/Where/When/Why/How big) (p10, p40) | ไม่มี | text อิสระ | ไม่มีโครงบังคับ · ข้อมูล "ที่ไหน/เมื่อไหร่/มากแค่ไหน" มีอยู่ในระบบแล้ว (`defect_logs`, `prod_orders`, เคลม) แต่ไม่ถูกดึงมาเติม |
| D2c | Useful contrast / **Is-Is Not** / drill-down tree (p21, p43) | ไม่มี | — | ไม่มีเลย |
| D2d | KPOV / CTS error state (p10, p43) | ไม่มี | — | ไม่มีช่อง |
| D2e | รูปชิ้นดีกับเสีย (p18) | ไม่มี | — | `qa_capa` ไม่มีรูปแนบ (มีการแนบรูปที่ถัง/ใบปัญหา แต่ไม่ผูก) |
| D2f | ขนาดปัญหา/COPQ/แนวโน้ม (p19) | มีบางส่วน | `qa_customer_claims.cost_impact, qty_claim` · `defect_logs` | ไม่สรุปบน 8D · ไม่มีกราฟแนวโน้มบน 8D |
| D2g | Process stability/control chart (p26) · MSA (p24) | มีบางส่วน | SPC/Cp/Cpk ใน `/qa` (`qa_characteristics`, `qa_measurements`) · ทะเบียนเครื่องมือวัด `qa_instruments` | ไม่ผูกกับ 8D · **ไม่มีการเก็บผล Gauge R&R** |
| D3a | ICA แยก **ทุกระดับ/จุด** (ลูกค้า, transit, คลัง, ในไลน์, supplier) (p11, p41) | ไม่มี | `d3_containment` text | ไม่มีรายการต่อจุด |
| D3b | **จำนวน** suspect / sorted / NG / หลุด ต่อจุด (p42, p58) | มีบางส่วน | `qa_ncr.qty_found/qty_ng` · `qa_customer_claims.qty_claim/qty_returned` · ถังเหลือง/แดง (DR) | ไม่รวมเป็น "escaped part analysis" บน 8D · ถังเหลือง/แดงไม่ผูก 8D |
| D3c | Verification ของ containment (อบรม/Gauge R&R) + **วันที่** (p11) | ไม่มี | — | — |
| D3d | Certification mark ต่อจุด (p41–42) | ไม่มี | (แท็กถัง FM-QA-006/007 มีที่ `quality_bin_records`) | ไม่มีช่องว่าของที่ผ่าน sort ติดเครื่องหมายอะไร |
| D3e | หาของสงสัยทั้งซัพพลายเชน / ช่วง lot (p42) | มีบางส่วน | `/order-trace`, `SymptomSearch.jsx`, `prod_orders` | ไม่มีปุ่ม "หา lot ที่เข้าข่าย" จาก 8D |
| D3f | ⏱ certified stock ใน 24 ชม. (p42) | มีบางส่วน | `qa_customer_claims.due_reply_date` (+3 วัน) | ไม่มีนาฬิกาแยก containment กับ 8D เต็ม |
| D3g | กลับมาทบทวน containment หลังรู้ root cause (p42) | ไม่มี | — | — |
| D4a | Root cause **3 ระดับ: Specific / Escape(Detection) / Systemic** (p12, p43, p56) | มีบางส่วน | `d4_root_cause` text ช่องเดียว · แนวคิด 3 ขามีใน `pe_change_requests.leg` | บนใบ 8D ไม่มี 3 ช่องแยก |
| D4b | **Escape point** (จุดที่ควรจับได้แต่ไม่จับ) (p6, p12) | ไม่มี | — | ไม่มีช่อง · ระบบรู้ได้ว่าถูกพบที่ไหน (`qa_ncr.source` incoming/inprocess/final/customer) แต่ไม่รู้ว่าควรถูกจับที่ OP ไหน |
| D4c | **3-legged 5 Why** (p30–32) | ไม่มี | — | ไม่มีตาราง Why |
| D4d | Five strategies / physics sketch / y=f(x) (p12, p22, p27) | ไม่มี | — | ไม่มีช่อง strategy · ไม่มีรูป sketch |
| D4e | **Verification ของ root cause** (เปิด/ปิดอาการได้) (p6) | ไม่มี | — | — |
| D4f | ป้ายบนจอ "5-Why / Fishbone" | **ขัดกับ deck** | `QualityControl.jsx` L1601 | deck บอก "Don't ask for a Fish Bone" → ควรเป็น "3x5 Why (Specific/Detection/Systemic)" |
| D4g | ห้าม "TBD" / ห้ามคัดลอกอาการ (p43) | ไม่มี | — | ไม่มีด่านตรวจข้อความ (เช่น d4 = d2 หรือ "TBD") |
| D5a | PCA **โยงกับ root cause ทีละข้อ** (p13, p44, p56) | ไม่มี | `d5_corrective` text | ไม่มีความสัมพันธ์ RC↔PCA |
| D5b | **Verification แยกจาก validation** + วันที่ (p13, p44) | ไม่มี | — | รวมอยู่ใน text |
| D5c | "What was done with what" (ค่าพารามิเตอร์) | ไม่มี | — | ไม่มีโครง (ค่าเดิมกับค่าใหม่) |
| D5d | PCA = การอบรมพนักงาน → ไม่ผ่าน (p45) | ไม่มี | — | ไม่มีคำเตือน |
| D6a | Implemented PCA + **วันที่ทำ** (p14) | มี | `d6_implement` + `d6_effective_from` | วันที่มีแค่ระดับใบ ไม่ใช่ต่อ PCA |
| D6b | **Validation ระยะยาวด้วยข้อมูล** (p14, p28, p45) | **มี (จุดแข็ง)** | `capaEffect.js` ลดลงก่อน/หลัง/วันผลิต + `eff_snapshot` | วัดแค่จำนวนของเสียต่อวัน (ไม่ใช่ Ppk/DPMO) · ไม่มีการเก็บ capability ก่อน/หลังจาก SPC |
| D6c | Containment หยุดเมื่อไหร่ (ยกเลิก ICA หลัง PCA ได้ผล) | ไม่มี | — | — |
| D7a | อัปเดต PFMEA/CP/PFC/WI/setup sheet (p15, p29, p46) | **มี (จุดแข็ง)** | `pe_change_requests` → `pe_doc_revisions` · ด่าน `pe_review_status` | ไม่ครอบ WI / setup check sheet / PM checklist / ใบตรวจ QA (`qa_inspection_items`) / LPA |
| D7b | **Read across** ชิ้น/กระบวนการคล้ายกัน (p15, p32, p46) | มีบางส่วน | `peLink.js` ขา `systemic` เสนอแถว FMEA ของพาร์ทอื่น | **ความหมายไม่ตรง deck**: เรา "systemic = yokoten ข้ามพาร์ท" แต่ deck "systemic = มาตรฐาน/business process" และ "read across" เป็นอีกเรื่อง · ไม่มีรายการ read-across พร้อมผู้รับผิดชอบ/วันที่/สถานะปิด |
| D7c | แก้ **มาตรฐาน + business process** สำหรับ launch ใหม่ (p46) | ไม่มี | `d7_prevent` text | ไม่มีช่อง · ไม่ส่งต่อไป `/npi` (APQP lessons learned) |
| D7d | Action ทุกข้อมี **ผู้รับผิดชอบ + กำหนดเสร็จ + สถานะ** (p29, p32, A3 p36) | ไม่มี | `owner_name/due_date` ระดับใบ | ไม่มีตาราง action รายข้อ (`meeting_action_items` มีแต่ใช้กับประชุม) |
| D7e | Recommendations (p15) | ไม่มี | — | — |
| D8a | Recognize team (p5, p56) | มีบางส่วน | `d8_closure` text | — |
| D8b | **ห้ามปิดถ้ายังไม่เข้าใจ physics** (p39) | มีบางส่วน | ด่านปิด: ต้องมี `effectiveness` + `pe_review_status` | ไม่ตรวจว่า D4 ครบ 3 ขาหรือ root cause ได้รับการ verify |
| G1 | วันที่ต่อขั้น / 8D stage / last revised (p5–6, p36) | มีบางส่วน | `status` 4 ระดับ + `capaFlow()` | ไม่รู้ว่าถึง D ไหน (status ไม่ใช่ D-stage) · ไม่มีวันที่ต่อขั้น · revise ดูได้จาก audit log เท่านั้น |
| G2 | รายงานความคืบหน้าแม้ยังไม่รู้สาเหตุ (p38) | มีบางส่วน | ใบ in_progress | ไม่มีช่อง "strategy / next steps" |
| G3 | **ส่งออกฟอร์ม 8D / A3 ให้ลูกค้า** (p34–36) | ไม่มี | `docs/modules/qa-inspection.md` L352: "CAPA/8D ยังไม่มี export (ตั้งใจ)" | **ส่ง 8D ให้ลูกค้าไม่ได้** — ต้องไปพิมพ์ใน Excel ซ้ำ · ถ้าทำต้อง register `/doc-forms` |
| G4 | Back-up evidence (รูป, กราฟ, ไฟล์) (p16–29) | ไม่มี | — | ไม่มีไฟล์แนบบน 8D |
| G5 | อนุมัติ/เซ็นปิด (ผู้บริหารยอมรับ) | มีบางส่วน | ปุ่ม "ปิด CAPA" ต้องมี `qa:manage` | ไม่มีลายเซ็นยืนยันตาม `signConfirm.js` · ไม่มีขั้น "ลูกค้ายอมรับ 8D" (มีที่เคลม: `replied` → `closed`) |
| L1 | 8D ← defect_logs / ถังเหลือง-แดง / ใบรายงานปัญหาการผลิต | ไม่มี | `defect_logs`, `quality_bin_records`, `prod_problem_reports` (DR) | เปิด 8D จากของเสียซ้ำ/ถังแดงไม่ได้ · ผูกย้อนกลับไม่ได้ (คนละ project: id อ้างข้ามได้เป็น text เท่านั้น) |
| L2 | PCA ที่เป็นการเปลี่ยน Man/Machine/Method/Material → ต้องเปิด 4M | ไม่มี | `four_m_logs` | PCA แก้ค่าเครื่อง/วิธีการ ไม่ต้องผ่าน 4M change ในระบบ |
| L3 | 8D → ใบตรวจ QA / LPA (control จริงหน้างาน) | ไม่มี | `qa_inspection_items`, `/lpa` | ด่าน CP มีแต่ใบตรวจจริงไม่ถูกบังคับ (เขียนเป็นแนวคิดไว้ใน `docs/CLOSED-LOOP-8D-PE.md` §4 ขา ②) |

---

## C. ข้อเสนอ เรียงตามความสำคัญ

> หลักที่ใช้: ①ทำให้ 8D **ผ่านเกณฑ์ลูกค้า Ford-style** ②ดึงข้อมูลที่ระบบมีอยู่แล้วมาเติมให้อัตโนมัติ ไม่ให้คนพิมพ์ซ้ำ ③ไม่ทำลายลูป 8D→PE ที่ใช้ได้แล้ว (ทุกคอลัมน์เพิ่มแบบ nullable/backward-compatible · `d*_` text เดิมเก็บไว้เป็นทางสำรองของใบเก่า) ④ตาม CLAUDE.md: ตารางใหม่ต้องมี RLS+GRANT ครบ, `has_perm('qa:record'|'qa:manage')`, ผูก audit, migration file, ฟอร์ม export register `/doc-forms`

| ลำดับ | ข้อเสนอ | แตะอะไร | ขนาด |
|---|---|---|---|
| **P1** | **D4 แยก 3 ระดับ + Escape point**: เพิ่ม `d4_rc_specific`, `d4_rc_escape`, `d4_escape_point` (OP/สถานีที่ควรจับได้ · ใช้ picker `pe_processes`/ไลน์), `d4_rc_systemic`, `d4_rc_verified` (bool + วิธี verify) · เปลี่ยนป้าย "5-Why / Fishbone" เป็น "3x5 Why" · ใบเก่าที่มีแค่ `d4_root_cause` ยังแสดงได้ · ส่ง 3 ช่องนี้เข้า `PeChangeRequests` ตรงตาม leg (เลิกเดาจากข้อความรวม) | `qa_capa` (Main) + `QualityControl.jsx` CAPATab + `peLink.suggestChanges` | M |
| **P2** | **ตาราง 3x5 Why** `qa_capa_whys` (capa_id, leg specific/detection/systemic, seq 1..5, text, is_root) → แสดงแบบบันได 3 ขาเหมือนหน้า 30–32 · แถวสุดท้ายของแต่ละขา = root cause ของขานั้น (P1 อ่านค่าจากที่นี่) | ตารางใหม่ (Main) + component ใหม่ | M |
| **P3** | **ตาราง action รายข้อ** `qa_capa_actions` (capa_id, kind = ERA/ICA/PCA/prevent/read_across/systemic_std/systemic_bp, `root_leg` ที่แก้, รายละเอียด, ค่าเดิม→ค่าใหม่, owner (person picker), due, implemented_at, **verification** (D5) / **validation** (D6) แยกช่อง + วันที่, status) · เกณฑ์ deck: PCA ต้องผูก RC, ทุกข้อมี owner+due · เตือนเมื่อ PCA เป็น "อบรม/training" อย่างเดียว (p45) | ตารางใหม่ (Main) + CAPATab | L |
| **P4** | **D3 containment รายจุด + จำนวน** — ใน `qa_capa_actions` ชนิด ICA เพิ่ม `location` (ลูกค้า / ระหว่างขนส่ง / FG store / WIP ในไลน์ / supplier), `qty_suspect/qty_sorted/qty_ng`, `cert_mark`, `verified_by` + วันที่ · สรุป "escaped part analysis" (ผลิตกี่ชิ้น กักได้ที่ไหนกี่ชิ้น หลุดกี่ชิ้น p58) · **ดึงตัวเลขจากถังเหลือง/แดง (`quality_bin_records`) และ `defect_logs` ของพาร์ท/ช่วงวัน** เป็นค่าเสนอ (คนยืนยัน) | Main + อ่าน DR | M |
| **P5** | **ส่งออกฟอร์ม 8D (+A3 1 หน้า)** สำหรับส่งลูกค้า — PDF/Excel ตาม layout หน้า 5–6 / A3 หน้า 36 · register เข้า `/doc-forms` (เลขฟอร์ม/Rev/โลโก้จาก `docForms.js`) · แนบ "Last revised" + 8D stage | `src/lib/` ใหม่ + `doc_forms` | M |
| **P6** | **D2 แบบมีโครง**: `d2_statement` (object+defect 1 บรรทัด) + ช่อง 5W2H + **ตาราง Is/Is-Not** (What/Where/When/How big × Is/Is-Not/Contrast) + `kpov` · **ปุ่มเติมอัตโนมัติ**: When/How big/Where จาก `defect_logs` + `prod_orders` (ไลน์ เครื่อง กะ lot วันผลิตแรก-สุดท้าย จำนวน) · ชิ้นที่ผลิตช่วงเดียวกันบนเครื่องอื่นที่ไม่เสีย = contrast | Main (คอลัมน์/jsonb) + อ่าน DR | M |
| **P7** | **D0 + เกณฑ์เปิด 8D**: `d0_symptom`, `d0_era`, `d0_era_at` · ปุ่ม "เปิด 8D" จาก (ก) ถังแดง/ใบรายงานปัญหาการผลิต (ข) ของเสียชนิดเดิมซ้ำ ≥N ครั้งใน X วัน (เสนอ ไม่สร้างเอง ตามกฎ "4M ที่ระบบสร้างเองห้ามเข้าคิวเงียบ") · เก็บ `source_kind/source_ref` (text id ของ DR) | Main + จอ `/daily-report` ถัง + `/qa` | M |
| **P8** | **D1 ทีมแบบตาราง** `qa_capa_team` (profile/employee id, role leader/champion/member/SME) → ใช้แจ้งเตือนรายคน + คิวงานของฉัน (`myQueue.js` ชั้น `mine`) | ตารางใหม่ + CAPATab | S–M |
| **P9** | **D-stage + วันที่ต่อขั้น + นาฬิกาลูกค้า**: คำนวณ "ถึง D ไหน" จากช่องที่กรอกจริง (ฟังก์ชันกลางใน `qaDocStatus.js`) · `d3_done_at`, `d4_done_at`, … · นาฬิกาเคลม 2 ตัว (containment / 8D เต็ม) อ่านค่าจากทะเบียนต่อลูกค้า (**ห้าม hardcode 24 ชม./10 วัน** จนได้ CSR — ดูคำถาม D) | `qa_capa` + `qa_customer_claims` + ทะเบียน CSR ต่อลูกค้า (หรือคอลัมน์ใน `customers` DR) | M |
| **P10** | **D7 แยก 3 ข้อของ deck** + **read across ที่ปิดได้**: (1) ชิ้นนี้ = ลูป PE เดิม + เพิ่มปลายทาง WI / setup sheet / ใบตรวจ QA (`qa_inspection_items`) / PM checklist / LPA (2) read across = เปลี่ยนชื่อขา `systemic` ใน `peLink` ให้ตรง (yokoten/read-across) แล้วทำให้ข้อเสนอแต่ละพาร์ทกลายเป็น action มีเจ้าของ/สถานะ (3) systemic standard/business process = action ชนิดใหม่ + ส่งเข้า lessons learned ของ `/npi` · ด่านปิด: ต้องตอบครบ 3 ข้อ (soft gate แบบเดียวกับ `pe_review_status`) | `peLink.js`, `PeChangeRequests.jsx`, CAPATab, `/npi` | M–L |
| **P11** | **PCA ↔ 4M**: action PCA ที่ติ๊กว่า "เปลี่ยน Man/Machine/Method/Material" → ปุ่มเปิดใบ 4M (prefill) และผูก `four_m_logs.id` กลับมา · ใบ 4M อนุมัติแล้ว = หลักฐาน implement D6 | `four_m_logs` (Main) + CAPATab | S–M |
| **P12** | **Validation แข็งขึ้น**: นอกจากของเสีย/วัน (`capaEffect.js`) ให้แนบ capability ก่อน/หลังจาก SPC (`qa_measurements` → Cpk/Ppk) และ DPMO/PPM ผ่าน `ppmOf()` ใน `oee.js` (ห้ามคูณ 1e6 เอง) · ปุ่ม "ปิด containment" เมื่อ validation ได้ผล | `capaEffect.js`, `CapaEffectiveness.jsx` | M |
| **P13** | **ด่านคุณภาพการเขียน (soft)** ก่อนส่งตรวจ/ปิด: เตือนเมื่อ D4 ว่าง/"TBD"/เหมือน D2 · D3 มีจุดเดียวทั้งที่เคลมมาจากลูกค้า · PCA ไม่มีตัวเลข · ไม่มี escape · ใช้กลไก `signConfirm.js` ตอนปิด (ระบุ "อนุมัติปิด 8D ใบไหน ในนามใคร") | CAPATab + util ใหม่ (pure + เทส) | S |
| **P14** | **รูป/ไฟล์แนบ** (ชิ้นดี/เสีย, physics sketch, กราฟ) ผ่าน `ImageCropModal` + `uploadOpts()` + `<AttachImage>` · ขึ้นทะเบียน `UPLOAD_SITES` | storage + CAPATab | S–M |
| **P15** | Golden thread: ทำ 8D ตัวอย่างครบทุกช่องบนพาร์ทต้นแบบสาย 060/061 (ตามคำสั่งถาวรใน CLAUDE.md ข้อ 5) เพื่อพิสูจน์ลิงก์ เคลม → ถัง → 8D → 4M → PFMEA/CP rev → ใบตรวจ → วัดผล | ข้อมูล | S |

**ลำดับที่แนะนำให้ลงมือ**: P1 + P2 (หัวใจที่ deck ตรวจ: 3 ระดับ root cause + escape) → P3/P4 (action + containment ที่มีจำนวน) → P5 (ส่งลูกค้าได้จริง) → P6/P7 (ดึงข้อมูลอัตโนมัติ = จุดขายของระบบ) → ที่เหลือ

---

## D. คำถามที่ต้องให้ user ตัดสิน

1. **ลูกค้าที่ใช้ 8D นี้คือใคร** (Ford ตรง หรือ Tier-1 ที่ส่ง Ford / ลูกค้าญี่ปุ่นที่ใช้ฟอร์มต่างกัน)? ต้องออกฟอร์มตาม layout ใคร — Ford G8D, ฟอร์มลูกค้ารายอื่น หรือฟอร์มกลางของ TSG? (กระทบ P5)
2. **กรอบเวลาตอบลูกค้า (CSR)**: containment กี่ชั่วโมง, D4 กี่วัน, ปิด 8D กี่วัน — ต่อลูกค้า? ตอนนี้ระบบตั้งตอบเคลม +3 วันตายตัว (`QaClaims.jsx` L65) deck ระบุแค่ "certified stock ภายใน 24 ชม." ช่วง launch
3. **ขา systemic**: ยอมให้เปลี่ยนความหมายใน `pe_change_requests.leg='systemic'` ให้ตรง deck (มาตรฐาน/business process) แล้วแยก "read across/yokoten" เป็นค่าใหม่หรือไม่? (มีข้อมูลเก่าที่ใช้ความหมายเดิม → ต้อง migrate)
4. **8D ภายใน vs 8D ลูกค้า**: ใบที่เปิดจากของเสียในไลน์ (ไม่มีลูกค้าเกี่ยว) ต้องกรอกเต็ม 3x5 Why/Is-Is Not ด้วยไหม หรือให้มีโหมด "8D ย่อ" (เช่น ใช้แค่ specific + PCA)?
5. **ปิดใบได้เมื่อไหร่**: ยกระดับเป็น hard gate ไหมว่า D4 ต้องมี 3 ระดับ + root cause verified (deck: "ห้ามปิดถ้ายังไม่รู้ physics")? ตอนนี้ด่านทุกตัวเป็น soft โดยตั้งใจ (`closed-loop-8d-pfmea.md` กฎข้อ 4)
6. **ใครเซ็นปิด**: QA manager อย่างเดียว หรือต้องมี Champion (ผู้บริหารสายผลิต) + การยอมรับของลูกค้าเป็นขั้นแยก?
7. **เปิด 8D อัตโนมัติจากของเสียซ้ำ**: เกณฑ์ (ชนิดเดิม N ครั้ง/X วัน, ถังแดง ≥ Y ชิ้น, เคลมทุกครั้ง) — ให้ระบบ "เสนอ" หรือ "บังคับ"?
8. **"Operator training ไม่นับเป็น PCA"**: ทำเป็นคำเตือน หรือบล็อกการปิด?
9. ฟอร์ม 8D ที่ส่งออก จะใช้เลขฟอร์มอะไรในทะเบียน `/doc-forms` (เช่น FM-QA-xxx)?
