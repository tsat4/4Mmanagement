# ══ Edge functions ของ ESM บน INET — build จาก "รากรีโป" (ต้อง copy supabase/functions) ══
#   docker build -f inet/stack/functions/Dockerfile -t esm-functions .
# 🔴 ฟังก์ชันดึง library จาก esm.sh / jsr / npm ตอนรันครั้งแรก ⇒ container ต้องออกอินเทอร์เน็ตได้
#    (ถาม INET ข้อ 6) · Telegram / Web Push ก็ต้องออกเน็ตเช่นกัน
FROM supabase/edge-runtime:v1.77.9
# OpenShift = UID สุ่ม เขียน /root ไม่ได้ ⇒ cache ของ deno ย้ายไป /tmp
ENV DENO_DIR=/tmp/deno-cache
COPY supabase/functions /home/deno/functions
COPY inet/stack/functions/main /home/deno/functions/main
CMD ["start", "--main-service", "/home/deno/functions/main", "--user-worker-request-idle-timeout", "150000"]
