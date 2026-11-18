# ย้ายทั้งระบบขึ้น INET — สคริปต์ยกข้อมูล (Main + DR → ฐานเดียว)

📄 ทุกเหตุผล/การตัดสินใจ/ผลวิเคราะห์ → `docs/modules/inet-migration.md`

🔴 **ของเดิมห้ามแตะ** — `10_dump_source.sh` อ่านอย่างเดียว (session read-only) · สคริปต์ที่เขียนปฏิเสธปลายทางที่เป็นของเดิม

```
SRC_MAIN_URL=… SRC_DR_URL=… OUT=./work ./10_dump_source.sh   # นอกเวลากะ · direct/session pooler (5432)
TGT_URL=…      OUT=./work ./20_build_target.sh                  # ฐานใหม่บน INET (public ว่าง)
TGT_URL=…      OUT=./work ./30_verify.sh                        # ต้องขึ้น "✅ ผ่าน" ก่อนใช้งาน
```

ซ้อมในเครื่อง (ไม่ต่อฐานจริง): `PG_IMAGE=postgres:17 ./inet/test/run-local-test.sh`
