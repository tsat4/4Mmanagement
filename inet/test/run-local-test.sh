#!/usr/bin/env bash
# ══ ซ้อมทั้งท่อในเครื่อง: ต้นทางจำลอง 2 ฐาน → dump → สร้างฐานรวม → ตรวจ ══
# ไม่ต่อฐานจริงเลย · ต้องมี docker · ใช้: ./inet/test/run-local-test.sh
# ผ่าน = (1) ฐานรวมนับเทียบผ่าน (2) แอบลบ 1 แถวแล้วตัวตรวจต้องจับได้ (3) ด่านปฏิเสธปลายทางที่เป็นของเดิม
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
IMG="${PG_IMAGE:-public.ecr.aws/docker/library/postgres:17}"
NAME=inet-merge-test
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=test -v "$HERE:/inet:ro" "$IMG" >/dev/null
for i in $(seq 1 30); do docker exec "$NAME" pg_isready -U postgres -q && break; sleep 1; done
x() { docker exec -i "$NAME" bash -c "$1"; }
U=postgresql://postgres:test@localhost:5432

for db in src_main src_dr tgt; do
  x "psql -qX -U postgres -c 'create database $db' && psql -qX -v ON_ERROR_STOP=1 -U postgres -d $db -f /inet/test/00_supabase_stub.sql"
done
x "psql -qX -v ON_ERROR_STOP=1 -U postgres -d src_main -f /inet/test/01_src_main.sql"
x "psql -qX -v ON_ERROR_STOP=1 -U postgres -d src_dr   -f /inet/test/02_src_dr.sql"

echo "════ 1) dump (อ่านอย่างเดียว) ════"
x "cp -r /inet /work-inet && cd /work-inet && SRC_MAIN_URL=$U/src_main SRC_DR_URL=$U/src_dr OUT=/tmp/w ./10_dump_source.sh"
echo "   ต้นทางไม่ถูกเขียน: ลองเขียนผ่าน session แบบเดียวกับสคริปต์ต้องถูกปฏิเสธ"
if x "PGOPTIONS='-c default_transaction_read_only=on' psql -qX -v ON_ERROR_STOP=1 $U/src_main -c 'create table public.zz(i int)'" 2>/dev/null; then
  echo "❌ session ต้นทางเขียนได้!"; exit 1; fi
echo "   ✅ ถูกปฏิเสธ"

echo "════ 2) สร้างฐานรวม ════"
x "cd /work-inet && TGT_URL=$U/tgt OUT=/tmp/w ./20_build_target.sh"

echo "════ 3) ตรวจนับ ════"
x "cd /work-inet && TGT_URL=$U/tgt OUT=/tmp/w ./30_verify.sh"

echo "════ 4) พฤติกรรมหลังรวม ════"
x "psql -qX -v ON_ERROR_STOP=1 $U/tgt" <<'SQL'
-- trigger ของ DR ต้องเรียก fn_audit_dr · ของ Main เรียก fn_audit
do $$ declare a int; b int; begin
  select count(*) into a from pg_trigger where tgfoid='public.fn_audit_dr()'::regprocedure;
  select count(*) into b from pg_trigger where tgfoid='public.fn_audit()'::regprocedure;
  if a <> 2 or b <> 1 then raise exception 'trigger audit ผิด: dr=% main=%', a, b; end if;
end $$;
-- แก้แถว DR ใหม่ → audit ใหม่ต้องได้ id ต่อท้ายทุกค่า (ไม่ชน)
update public.machines set machine_no = machine_no where id = 1;
update public.machines set updated_by_name = 'ทดสอบหลังรวม' where id = 2;
do $$ begin
  if (select actor from public.audit_log order by id desc limit 1) <> 'ทดสอบหลังรวม' then raise exception 'fn_audit_dr ไม่ทำงาน'; end if;
  if (select count(*) from public.audit_log) <> (select count(distinct id) from public.audit_log) then raise exception 'id ซ้ำ'; end if;
end $$;
-- สิทธิ์: anon เห็น audit ของตาราง DR เท่านั้น · ไม่เห็นของ Main
set role anon;
do $$ begin
  if (select count(*) from public.audit_log where table_name='machines') = 0 then raise exception 'anon มองไม่เห็น audit ของ DR (จอ OrderTrace จะว่าง)'; end if;
  if (select count(*) from public.audit_log where table_name in ('employees','profiles')) <> 0 then raise exception 'anon เห็น audit ของ Main = รั่ว'; end if;
end $$;
reset role;
do $$ begin
  if exists (select 1 from pg_proc where proname in ('current_user_is_admin','handle_new_user')) then raise exception 'ฟังก์ชันของ profiles DR หลุดมา'; end if;
  if (select count(*) from public.profiles) <> 132 then raise exception 'profiles ไม่ใช่ของ Main'; end if;
  if not exists (select 1 from pg_publication_tables where tablename='machines') then raise exception 'publication หาย'; end if;
  if (select count(*) from storage.buckets) <> 3 then raise exception 'bucket ไม่ครบ'; end if;
end $$;
select 'ok';
SQL
echo "   ✅ trigger · id ไม่ชน · สิทธิ์ anon · publication · bucket"

echo "════ 5) ตัวตรวจต้องจับของหายได้ (แอบลบ 1 แถว) ════"
x "psql -qX $U/tgt -c 'delete from public.machines where id = 500'"
if x "cd /work-inet && TGT_URL=$U/tgt OUT=/tmp/w ./30_verify.sh" >/dev/null 2>&1; then echo "❌ ตัวตรวจไม่จับ!"; exit 1; fi
echo "   ✅ จับได้"
x "psql -qX $U/tgt -c \"update public.dr_products set mat_no='MAT1x' where id=1\"" >/dev/null
echo "════ 6) ด่านปลายทาง: ห้ามเขียนฐานเดิม ════"
if x "cd /work-inet && TGT_URL='postgresql://u:p@db.ewhdfqwfwofivojtsizn.supabase.co:5432/postgres' OUT=/tmp/w ./20_build_target.sh" 2>&1 | grep -q 'ปลายทางดูเหมือนฐานเดิม'; then
  echo "   ✅ ปฏิเสธ"; else echo "❌ ด่านไม่ทำงาน"; exit 1; fi
docker rm -f "$NAME" >/dev/null
echo "🎉 ซ้อมผ่านทุกข้อ"
