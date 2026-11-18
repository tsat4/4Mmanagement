#!/usr/bin/env bash
# ══ ขั้น 1: ดึงสำเนาจากฐานเดิม (อ่านอย่างเดียว) ══
# ใช้:  SRC_MAIN_URL=postgresql://… SRC_DR_URL=postgresql://… OUT=./work ./10_dump_source.sh
#
# 🔴 อ่านอย่างเดียว — ทุก session ตั้ง default_transaction_read_only=on (lib.sh)
# 🔴 รันนอกเวลากะเท่านั้น (หลัง 17:30) — ฐานเดิมเป็น Micro
# 🔴 ต้องใช้ connection แบบ direct หรือ session pooler (พอร์ต 5432) — transaction pooler (6543)
#    ทำ snapshot ไม่ได้
#
# ทำไมต้อง snapshot: ระบบเดิมยังมีคนบันทึกอยู่ตลอด ⇒ dump + นับแถว + checksum ต้องเห็นข้อมูล
# "ชุดเดียวกัน ณ วินาทีเดียวกัน" ไม่งั้นนับเทียบแล้วไม่ตรงทั้งที่ไม่มีอะไรหาย
set -euo pipefail
cd "$(dirname "$0")"; . ./lib.sh
need_pg17
: "${SRC_MAIN_URL:?ตั้ง SRC_MAIN_URL}" "${SRC_DR_URL:?ตั้ง SRC_DR_URL}"
OUT="${OUT:-./work}"; mkdir -p "$OUT"
# ค่าที่ทำให้ข้อความของแถวออกมาเหมือนกันทุกเครื่อง (checksum ต้องเทียบข้ามเครื่องได้)
export PGTZ=UTC PGDATESTYLE='ISO, MDY'
SRC_PGOPTIONS="$SRC_PGOPTIONS -c extra_float_digits=1 -c IntervalStyle=postgres -c bytea_output=hex"

# ── checksum ต่อตาราง: เรียง md5 ของแต่ละแถวก่อนรวม ⇒ ไม่ขึ้นกับลำดับแถว ──
TABLE_CHECKS_SQL=$(cat <<'SQL'
select format(
  'select %L, count(*), md5(coalesce(string_agg(h, %L order by h), %L)) from (select md5(x::text) h from %I.%I x) s;',
  n.nspname||'.'||c.relname, '', '', n.nspname, c.relname)
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r','p') and n.nspname in ('public','archive')
order by 1
SQL
)
# audit_log: ลำดับคอลัมน์ Main/DR ไม่เท่ากัน ⇒ ใช้รายชื่อคอลัมน์ตายตัว (ฝั่งปลายทางใช้ชุดเดียวกัน)
AUDIT_COLS="id,table_name,row_pk,action,actor,actor_uid,changed_fields,old_data,new_data,changed_at"

dump_one() { # $1=main|dr  $2=url
  local tag="$1" url="$2" snap
  log "[$tag] เปิด snapshot (read only)"
  coproc HOLD { PGOPTIONS="$SRC_PGOPTIONS" psql -X -q -At "$url"; }
  echo "begin isolation level repeatable read read only; select pg_export_snapshot();" >&"${HOLD[1]}"
  read -r snap <&"${HOLD[0]}" || die "[$tag] เปิด snapshot ไม่ได้ (ใช้ pooler แบบ transaction อยู่หรือเปล่า?)"
  log "[$tag] snapshot = $snap"

  log "[$tag] pg_dump public + archive"
  src_pg_dump "$url" --snapshot="$snap" -Fc --no-owner -n public -n archive -f "$OUT/$tag.dump"

  if [ "$tag" = main ]; then
    log "[main] pg_dump ข้อมูล login (auth.users + auth.identities)"
    src_pg_dump "$url" --snapshot="$snap" -Fc --data-only -t auth.users -t auth.identities -f "$OUT/main_auth.dump"
  fi

  log "[$tag] นับแถว + checksum ทุกตาราง (ภายใน snapshot เดียวกัน)"
  {
    echo "begin isolation level repeatable read read only; set transaction snapshot '$snap';"
    src_psql "$url" -At -c "$TABLE_CHECKS_SQL"
    echo "select 'audit_log#cols', count(*), md5(coalesce(string_agg(h,'' order by h),'')) from (select md5(row($AUDIT_COLS)::text) h from public.audit_log) s;"
    if [ "$tag" = main ]; then
      echo "select 'auth.users#cols', count(*), md5(coalesce(string_agg(h,'' order by h),'')) from (select md5(row(id,email,encrypted_password,created_at)::text) h from auth.users) s;"
      echo "select 'auth.identities', count(*), '' from auth.identities;"
    fi
    echo "commit;"
  } > "$OUT/${tag}_checks.sql"
  src_psql "$url" -At -F $'\t' -f "$OUT/${tag}_checks.sql" | grep -v -E '^(BEGIN|SET|COMMIT)$' > "$OUT/${tag}_counts.tsv"

  log "[$tag] เก็บของที่ pg_dump แบบ -n ไม่พามา (publication · storage · cron · fn_audit · trigger)"
  {
    echo "begin isolation level repeatable read read only; set transaction snapshot '$snap';"
    cat <<'SQL'
\o OUTDIR/TAG_publication.txt
select tablename from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' order by 1;
\o OUTDIR/TAG_buckets.sql
select format('insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values (%L,%L,%s,%s,%L) on conflict (id) do nothing;',
  id,name,public,coalesce(file_size_limit::text,'null'),allowed_mime_types) from storage.buckets order by id;
\o OUTDIR/TAG_storage_policies.sql
select format('create policy %I on storage.objects as %s for %s to %s%s%s;', policyname, permissive, cmd,
  array_to_string(roles, ','), coalesce(' using ('||qual||')',''), coalesce(' with check ('||with_check||')',''))
  from pg_policies where schemaname='storage' and tablename='objects' order by policyname;
\o OUTDIR/TAG_storage_objects.tsv
select bucket_id, name, coalesce((metadata->>'size')::bigint,0), coalesce(metadata->>'mimetype','') from storage.objects order by 1,2;
\o OUTDIR/TAG_cron.tsv
select jobname, schedule, replace(replace(command, E'\n', ' '), E'\t', ' ') from cron.job order by jobname;
\o OUTDIR/TAG_fn_audit.sql
select pg_get_functiondef('public.fn_audit()'::regprocedure) || ';';
\o OUTDIR/TAG_fn_audit_triggers.txt
select count(*) from pg_trigger where tgfoid = 'public.fn_audit()'::regprocedure;
\o
commit;
SQL
  } | sed -e "s#OUTDIR#$OUT#g" -e "s#TAG#$tag#g" > "$OUT/${tag}_extras.sql"
  src_psql "$url" -At -f "$OUT/${tag}_extras.sql" >/dev/null

  echo "commit;" >&"${HOLD[1]}"; exec {HOLD[1]}>&-; wait "$HOLD_PID" 2>/dev/null || true
  log "[$tag] เสร็จ — $(wc -l < "$OUT/${tag}_counts.tsv") ตาราง"
}

dump_one main "$SRC_MAIN_URL"
dump_one dr   "$SRC_DR_URL"
date -u +%FT%TZ > "$OUT/DUMPED_AT"
log "✅ ดึงครบ — ไฟล์อยู่ที่ $OUT (ฐานเดิมไม่ถูกเขียนแม้แต่แถวเดียว)"
