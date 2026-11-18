#!/usr/bin/env bash
# ══ ขั้น 3: พิสูจน์ "ไม่ตกหล่น" — นับแถว + checksum ทุกตาราง ฐานใหม่เทียบกับสำเนาที่ดึงมา ══
# ใช้:  TGT_URL=postgresql://…(ฐานใหม่) OUT=./work ./30_verify.sh
#
# เกณฑ์ผ่าน = ทุกตารางของ Main และ DR มีจำนวนแถว "และ" checksum ตรงเป๊ะ
#   · ตารางทั่วไป: md5 ของทุกแถว (เรียงแล้วรวม) ต้องเท่ากัน — ข้อมูลเพี้ยนแม้ 1 ตัวอักษรก็จับได้
#   · audit_log: Main = แถว id < 1e9 · DR = แถว id ≥ 1e9 (ลบค่าชดเชยกลับก่อนคิด)
#   · profiles / notifications / audit_log ของ DR ไม่ยก (ตั้งใจ — docs §4) ⇒ ไม่นับ
# อ่านอย่างเดียวกับปลายทาง · ไม่ต่อฐานเดิมเลย (ใช้ตัวเลขที่ 10_dump_source.sh เก็บไว้ใน snapshot)
set -euo pipefail
cd "$(dirname "$0")"; . ./lib.sh
: "${TGT_URL:?ตั้ง TGT_URL}"; guard_target "$TGT_URL"
OUT="${OUT:-./work}"
export PGTZ=UTC PGDATESTYLE='ISO, MDY'
TGT_OPTS='-c default_transaction_read_only=on -c extra_float_digits=1 -c IntervalStyle=postgres -c bytea_output=hex'
AUDIT_COLS="table_name,row_pk,action,actor,actor_uid,changed_fields,old_data,new_data,changed_at"
OFF=1000000000

log "นับ + checksum ฝั่งฐานใหม่"
PGOPTIONS="$TGT_OPTS" psql -X -v ON_ERROR_STOP=1 "$TGT_URL" -At -F $'\t' > "$OUT/target_counts.tsv" <<SQL
select format(
  'select %L, count(*), md5(coalesce(string_agg(h, %L order by h), %L)) from (select md5(x::text) h from %I.%I x) s;',
  n.nspname||'.'||c.relname, '', '', n.nspname, c.relname)
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r','p') and n.nspname in ('public','archive')
order by 1 \gexec
select 'audit_log#main', count(*), md5(coalesce(string_agg(h,'' order by h),'')) from (select md5(row(id,$AUDIT_COLS)::text) h from public.audit_log where id < $OFF) s;
select 'audit_log#dr', count(*), md5(coalesce(string_agg(h,'' order by h),'')) from (select md5(row(id-$OFF,$AUDIT_COLS)::text) h from public.audit_log where id >= $OFF) s;
-- คืน id เดิมแล้วคิดด้วยลำดับคอลัมน์ของตารางเอง (เหมือนต้นทางคิด x::text)
select 'archive.audit_log_aged#dr', count(*), md5(coalesce(string_agg(h,'' order by h),'')) from (select md5(jsonb_populate_record(x, jsonb_build_object('id', x.id-$OFF))::text) h from archive.audit_log_aged x) s;
select 'auth.users#cols', count(*), md5(coalesce(string_agg(h,'' order by h),'')) from (select md5(row(id,email,encrypted_password,created_at)::text) h from auth.users) s;
select 'auth.identities', count(*), '' from auth.identities;
SQL

# ฝั่งต้นทาง: audit_log#cols ของแต่ละฝั่งคิดด้วย (id,…) — แปลงชื่อให้ตรงกับฝั่งปลายทาง
# archive.audit_log_aged ฝั่ง DR: ต้นทางคิดด้วย x::text (ลำดับคอลัมน์ของตารางเอง) ⇒ ฝั่งปลายทางคิดด้วยลำดับเดียวกัน
awk -F'\t' -v OFS='\t' '
  FNR==1 { side = (FILENAME ~ /main_counts/) ? "main" : "dr" }
  $1=="audit_log#cols"            { $1="audit_log#" side; print side, $0; next }
  $1=="public.audit_log"          { next }                      # ใช้ #cols แทน
  side=="dr" && $1 ~ /^public\.(profiles|notifications)$/ { next }  # ตั้งใจไม่ยก
  side=="dr" && $1=="archive.audit_log_aged" { $1="archive.audit_log_aged#dr"; print side, $0; next }
  { print side, $0 }' "$OUT/main_counts.tsv" "$OUT/dr_counts.tsv" > "$OUT/expected.tsv"

# เทียบ: ทุกบรรทัดที่คาดต้องมีในฐานใหม่ จำนวน+checksum ตรง
awk -F'\t' '
  NR==FNR { got[$1]=$2"\t"$3; next }
  { key=$2; want=$3"\t"$4; n++
    if (!(key in got))      { printf "❌ ไม่มีในฐานใหม่   %-45s (ต้นทาง %s แถว · %s)\n", key, $3, $1; bad++; next }
    split(got[key], g, "\t")
    if (g[1] != $3)         { printf "❌ จำนวนไม่ตรง     %-45s ต้นทาง %s · ใหม่ %s\n", key, $3, g[1]; bad++; next }
    if ($4 != "" && g[2] != $4) { printf "❌ ข้อมูลไม่ตรง    %-45s (%s แถวเท่ากันแต่ checksum ต่าง)\n", key, $3; bad++; next }
    rows += $3; seen[key]=1 }
  END {
    printf "\nตรวจ %d ตาราง · %d แถว · ไม่ผ่าน %d\n", n, rows, bad+0
    exit (bad > 0) }' "$OUT/target_counts.tsv" "$OUT/expected.tsv" | tee "$OUT/verify_report.txt"
rc=${PIPESTATUS[0]}

# audit_log รวม = Main + DR (ตารางเดียวต้องเท่าผลรวม)
tot=$(awk -F'\t' '$1=="public.audit_log"{print $2}' "$OUT/target_counts.tsv")
sum=$(awk -F'\t' '$1 ~ /^audit_log#(main|dr)$/ {s+=$2} END{print s+0}' "$OUT/target_counts.tsv")
assert_eq "$tot" "$sum" "audit_log ทั้งตาราง ≠ ส่วน Main + ส่วน DR"

# ตารางที่มีในฐานใหม่แต่ไม่มีในต้นทาง (ควรมีแค่ที่สคริปต์สร้างเอง)
extra=$(awk -F'\t' 'NR==FNR{e[$2]=1;next} $1 ~ /^(public|archive)\./ && !($1 in e) && $1!="public.audit_log" {print $1}' \
  "$OUT/expected.tsv" "$OUT/target_counts.tsv" | grep -vxE 'public\.audit_anon_tables' || true)
[ -z "$extra" ] || { echo "⚠️  ตารางเกินที่ไม่รู้ที่มา:"; echo "$extra"; rc=1; }

[ "$rc" = 0 ] && log "✅ ผ่าน — ข้อมูลครบทุกแถว ทุกตาราง" || die "ไม่ผ่าน — ดู $OUT/verify_report.txt"
