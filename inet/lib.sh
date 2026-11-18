#!/usr/bin/env bash
# ══ ของกลางของสคริปต์ย้ายขึ้น INET — ด่านกันพลาดแตะของเดิม (18/11/2026) ══
# 📄 docs/modules/inet-migration.md §2
#
# 🔴 กติกา: ฐานเดิม (Supabase Main/DR) = "อ่านอย่างเดียว" เสมอ
#    · ทุกคำสั่งที่ต่อฐานต้นทางผ่าน src_psql / src_pg_dump เท่านั้น (บังคับ read-only ระดับ session)
#    · ทุกคำสั่งที่ "เขียน" ผ่าน tgt_* เท่านั้น และปลายทางต้องผ่าน guard_target
set -euo pipefail

# project id ของระบบเดิม — ปลายทางที่มีคำพวกนี้ = ห้ามเขียนเด็ดขาด
LEGACY_MARKERS=(ewhdfqwfwofivojtsizn eyhclzkifitbhbljgoav supabase.co supabase.com)

die() { echo "❌ $*" >&2; exit 1; }
log() { echo "▶ $*" >&2; }

# ปลายทางห้ามเป็นของเดิม (เช็คทั้ง URL)
guard_target() {
  local url="$1" m
  [ -n "$url" ] || die "ไม่ได้ตั้งปลายทาง"
  for m in "${LEGACY_MARKERS[@]}"; do
    case "$url" in *"$m"*) die "ปลายทางดูเหมือนฐานเดิม ($m) — หยุด ไม่เขียนอะไรทั้งสิ้น";; esac
  done
}

# ต้นทาง: บังคับ read-only ทุก transaction ของ session (เขียนพลาด = Postgres ปฏิเสธเอง)
SRC_PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=0'
src_psql()    { PGOPTIONS="$SRC_PGOPTIONS" psql -X -v ON_ERROR_STOP=1 "$@"; }
src_pg_dump() { PGOPTIONS="$SRC_PGOPTIONS" pg_dump "$@"; }

# ปลายทาง: เขียนได้ แต่ต้องผ่าน guard ก่อนทุกครั้ง
tgt_psql() { guard_target "$1"; local u="$1"; shift; psql -X -v ON_ERROR_STOP=1 "$u" "$@"; }

need() { command -v "$1" >/dev/null || die "ไม่มีคำสั่ง $1"; }
need_pg17() {
  need psql; need pg_dump; need pg_restore
  local v; v=$(pg_dump --version | grep -oE '[0-9]+' | head -1)
  [ "$v" -ge 17 ] || die "ต้องใช้ pg_dump 17 ขึ้นไป (ฐานเดิมเป็น 17.6) — เจอ $v"
}

# นับว่าบรรทัดที่ตรง pattern มีกี่บรรทัด (ใช้ assert หลังแก้ข้อความ)
count_lines() { grep -cE "$1" "$2" || true; }
assert_eq() { [ "$1" = "$2" ] || die "$3 (คาด $2 ได้ $1)"; }
