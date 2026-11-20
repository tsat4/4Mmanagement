# ประตูทางเข้า (nginx ไม่ใช้ root — OpenShift) · ชื่อบริการปลายทางตั้งผ่าน env ตอนเริ่ม
FROM nginxinc/nginx-unprivileged:1.27-alpine
ENV AUTH_HOST=auth REST_HOST=rest REALTIME_HOST=realtime STORAGE_HOST=storage FUNCTIONS_HOST=functions WEB_HOST=web
# image nginx แทนค่า ${VAR} ใน /etc/nginx/templates/*.template → conf.d ตอนเริ่ม
# NGINX_ENVSUBST_FILTER = แทนเฉพาะตัวแปรของเรา (ไม่งั้น $host/$http_upgrade ของ nginx โดนแทนเป็นค่าว่าง)
ENV NGINX_ENVSUBST_FILTER="^(AUTH|REST|REALTIME|STORAGE|FUNCTIONS|WEB)_HOST$"
COPY nginx.conf /etc/nginx/templates/default.conf.template
EXPOSE 8080
