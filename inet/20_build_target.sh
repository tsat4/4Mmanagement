#!/usr/bin/env bash
# ══ ขั้น 2: สร้างฐานรวม (Main + DR) บนฐานใหม่ จากไฟล์ที่ 10_dump_source.sh ดึงมา ══
# ใช้:  TGT_URL=postgresql://…(ฐานใหม่บน INET) OUT=./work ./20_build_target.sh
#
# 🔴 สคริปต์นี้ "ไม่ต่อฐานเดิมเลย" — อ่านจากไฟล์ใน $OUT อย่างเดียว · ปลายทางผ่าน guard_target
# 🔴 ปลายทางต้องเป็น Supabase stack ที่ตั้งเสร็จแล้ว (มี role anon/authenticated/service_role,
#    schema auth/storage/extensions, pg_cron, pg_net) แต่ public ยังว่าง
# ล้มกลางทาง = หยุดทันที (ON_ERROR_STOP + set -e) · ลบฐานใหม่แล้วรันใหม่ได้เสมอ ของเดิมไม่เกี่ยว
set -euo pipefail
cd "$(dirname "$0")"; . ./lib.sh
need_pg17
: "${TGT_URL:?ตั้ง TGT_URL}"; guard_target "$TGT_URL"
OUT="${OUT:-./work}"
for f in main.dump dr.dump main_auth.dump dr_fn_audit.sql dr_fn_audit_triggers.txt; do
  [ -s "$OUT/$f" ] || die "ไม่มี $OUT/$f — รัน 10_dump_source.sh ก่อน"
done

# ── 0. ปลายทางต้องว่าง (กันรันทับฐานที่มีข้อมูลแล้ว) ──
n=$(tgt_psql "$TGT_URL" -At -c "select count(*) from pg_tables where schemaname='public'")
[ "$n" = 0 ] || die "public ของปลายทางมี $n ตารางแล้ว — ต้องเริ่มจากฐานว่าง"

log "0. extension ที่ DR ใช้ (ติดตั้งใน public เหมือนของเดิม) + schema archive"
tgt_psql "$TGT_URL" -q -c "create extension if not exists pg_trgm with schema public;
  create extension if not exists pgstattuple with schema public;
  create schema if not exists archive;"

# ── 1. ข้อมูล login ก่อน (profiles ฯลฯ มี FK ไป auth.users) ──
log "1. auth.users + auth.identities ของ Main (รหัสผ่านเดิมใช้ต่อได้ — เก็บแบบเข้ารหัส)"
pg_restore --data-only --no-owner -d "$TGT_URL" --exit-on-error "$OUT/main_auth.dump"
# GoTrue อ่านคอลัมน์ token เป็น string — NULL = login ไม่ได้ ("Database error querying schema") (เจอตอนซ้อม 20/11)
# ของจริงบน cloud เป็น '' ทั้งหมดอยู่แล้ว (วัด 20/11: 133 คน NULL = 0) ⇒ ตัวนี้เป็นตาข่าย ไม่เปลี่ยนค่าที่มี
tgt_psql "$TGT_URL" -q -c "update auth.users set
  confirmation_token = coalesce(confirmation_token,''), recovery_token = coalesce(recovery_token,''),
  email_change = coalesce(email_change,''), email_change_token_new = coalesce(email_change_token_new,''),
  email_change_token_current = coalesce(email_change_token_current,''), phone_change = coalesce(phone_change,''),
  phone_change_token = coalesce(phone_change_token,''), reauthentication_token = coalesce(reauthentication_token,''),
  updated_at = coalesce(updated_at, created_at, now())
  where updated_at is null or confirmation_token is null or recovery_token is null or email_change is null or email_change_token_new is null
     or email_change_token_current is null or phone_change is null or phone_change_token is null or reauthentication_token is null;
  update auth.identities set created_at = coalesce(created_at, now()), updated_at = coalesce(updated_at, created_at, now())
  where created_at is null or updated_at is null;"

# ── 2. Main ทั้งก้อน (ข้ามแค่คำสั่งสร้าง schema ที่มีอยู่แล้ว) ──
log "2. restore Main"
pg_restore -l "$OUT/main.dump" | grep -vE '; [0-9]+ [0-9]+ SCHEMA - (public|archive) ' > "$OUT/main.list"
pg_restore -L "$OUT/main.list" --no-owner -d "$TGT_URL" --exit-on-error "$OUT/main.dump"

# ── 3. DR: ตัดของที่ชนออกจากสารบัญ ──
log "3. คัดสารบัญ DR (ตัดของชน — รายการตาม docs/modules/inet-migration.md §4)"
pg_restore -l "$OUT/dr.dump" > "$OUT/dr.full.list"
# ตาราง DR ที่ไม่ยก (Main มีตัวจริงแล้ว) — ตัดทุกชิ้นที่ผูกกับตารางเหล่านี้
SKIP_TABLES='(profiles|notifications|audit_log)'
# ฟังก์ชันที่ไม่ยก: 4 ตัวเนื้อตรง Main เป๊ะ (md5) · fn_audit (สร้างใหม่เป็น fn_audit_dr) · 3 ตัวที่ใช้แค่กับ profiles ของ DR
SKIP_FUNCS='(esm_schema_overview|esm_schema_table|fn_set_updated_at|norm_person_name|fn_audit|current_user_is_admin|current_user_has_department|handle_new_user)\('
awk -v T="$SKIP_TABLES" -v F="$SKIP_FUNCS" '
  /^;/ { print; next }
  $0 ~ "SCHEMA - (public|archive) "                                  { next }
  # ทุกชิ้นของตารางที่ตัด: TABLE/DATA/CONSTRAINT/FK/POLICY/TRIGGER/DEFAULT/ROW SECURITY/ACL/COMMENT (+COLUMN)
  $0 ~ " public (TABLE |COLUMN )?" T "[ .]"                           { next }
  $0 ~ " (FUNCTION|ACL|COMMENT) public (FUNCTION )?" F                { next }
  { print }' "$OUT/dr.full.list" > "$OUT/dr.list"
# index/sequence ชื่อของตารางที่ตัด (ไม่มีชื่อตารางในบรรทัด)
grep -vE ' (INDEX|SEQUENCE|SEQUENCE SET) public (audit_log_id_seq|idx_audit_log_[a-z_]+|notifications_user_id_idx) ' "$OUT/dr.list" > "$OUT/dr.list.tmp" && mv "$OUT/dr.list.tmp" "$OUT/dr.list"
# ตรวจ: ต้องไม่เหลืออะไรที่อ้างชื่อพวกนี้ในฐานะ "ตัววัตถุ"
left=$(grep -cE " public ($SKIP_TABLES) |FUNCTION $SKIP_FUNCS" "$OUT/dr.list" || true)
assert_eq "$left" 0 "สารบัญ DR ยังมีของชนหลงเหลือ — ดู $OUT/dr.list"
log "   ตัดไป $(( $(grep -vc '^;' "$OUT/dr.full.list") - $(grep -vc '^;' "$OUT/dr.list") )) รายการ"

# ── 4. fn_audit ของ DR → fn_audit_dr (สร้างก่อน trigger) ──
log "4. สร้าง fn_audit_dr (เนื้อเดิมของ DR ทุกตัวอักษร เปลี่ยนแค่ชื่อ)"
sed 's/FUNCTION public\.fn_audit()/FUNCTION public.fn_audit_dr()/' "$OUT/dr_fn_audit.sql" > "$OUT/fn_audit_dr.sql"
assert_eq "$(count_lines 'FUNCTION public\.fn_audit_dr\(\)' "$OUT/fn_audit_dr.sql")" 1 "เปลี่ยนชื่อ fn_audit ไม่สำเร็จ"
tgt_psql "$TGT_URL" -q -f "$OUT/fn_audit_dr.sql"

# ── 5. แปลง DR เป็น SQL แล้วชี้ trigger audit ไป fn_audit_dr ──
log "5. restore DR (trigger audit → fn_audit_dr)"
pg_restore -L "$OUT/dr.list" --no-owner -f "$OUT/dr.sql" "$OUT/dr.dump"
expect=$(tr -d '[:space:]' < "$OUT/dr_fn_audit_triggers.txt")
got=$(count_lines '^CREATE TRIGGER .* EXECUTE FUNCTION public\.fn_audit\(\);$' "$OUT/dr.sql")
assert_eq "$got" "$expect" "จำนวน trigger audit ของ DR ไม่ตรงกับฐานเดิม"
sed -i -E 's/^(CREATE TRIGGER .* EXECUTE FUNCTION public\.)fn_audit\(\);$/\1fn_audit_dr();/' "$OUT/dr.sql"
assert_eq "$(count_lines 'public\.fn_audit\(\)' "$OUT/dr.sql")" 0 "ยังมีที่อ้าง fn_audit() ของเดิมหลงเหลือ"
tgt_psql "$TGT_URL" -q -f "$OUT/dr.sql" >/dev/null

# ── 6. audit_log ของ DR → ตารางพัก แล้วรวม ──
log "6. รวม audit_log (DR id +1,000,000,000)"
tgt_psql "$TGT_URL" -q -c "create table public.audit_log_dr_import (like public.audit_log);"
pg_restore --data-only -n public -t audit_log -f - "$OUT/dr.dump" \
  | sed -E '0,/^COPY public\.audit_log \(/s//COPY public.audit_log_dr_import (/' \
  | tgt_psql "$TGT_URL" -q
# ตารางของ DR ที่ anon อ่าน audit ได้ — 🔴 ตัด 3 ชื่อที่ชนออก (ชื่อเดียวกับของ Main = audit ของ Main)
pg_restore -l "$OUT/dr.dump" | awk '$4=="TABLE" && $5=="public" {print $6}' | grep -vxE "$SKIP_TABLES" | sort -u > "$OUT/dr_tables.txt"
sed "s/.*/insert into public.audit_anon_tables values ('&');/" "$OUT/dr_tables.txt" > "$OUT/dr_tables.sql"
tgt_psql "$TGT_URL" -q -v dr_tables_sql="$OUT/dr_tables.sql" -f sql/merge_audit.sql >/dev/null

# ── 7. realtime · storage · cron ──
log "7. realtime publication (รวม 2 ฝั่ง)"
sort -u "$OUT/main_publication.txt" "$OUT/dr_publication.txt" | grep -v '^$' \
  | sed 's/.*/alter publication supabase_realtime add table public."&";/' > "$OUT/publication.sql"
tgt_psql "$TGT_URL" -q -f "$OUT/publication.sql"

log "   storage: bucket + policy (ตัวไฟล์ย้ายด้วย 40_copy_storage — ยังไม่ทำในสคริปต์นี้)"
cat "$OUT/main_buckets.sql" "$OUT/dr_buckets.sql" | tgt_psql "$TGT_URL" -q
cat "$OUT/main_storage_policies.sql" "$OUT/dr_storage_policies.sql" | tgt_psql "$TGT_URL" -q

log "   cron: ไม่สร้างอัตโนมัติ — ที่อยู่ edge function ต้องเปลี่ยนเป็นของ INET ก่อน (ดู $OUT/*_cron.tsv)"
log "✅ สร้างฐานรวมเสร็จ — ต่อด้วย ./30_verify.sh"
