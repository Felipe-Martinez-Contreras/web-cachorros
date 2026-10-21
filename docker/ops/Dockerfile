# syntax=docker/dockerfile:1.28
# Imagen ops (especificación 12.2 y 12.8): tareas programadas, respaldos y restauración. Parte de
# postgres:18-alpine para que pg_dump y pg_restore sean de la misma versión mayor que el servidor (trampa 12).
# Se construye con este directorio como contexto: `docker build docker/ops`.
FROM postgres:18-alpine

ARG REVISION=desconocida
LABEL org.opencontainers.image.title="cachorros-ops" \
      org.opencontainers.image.description="Respaldos, restauración y tareas programadas del sitio de Los Cachorros" \
      org.opencontainers.image.source="https://github.com/Felipe-Martinez-Contreras/web-cachorros" \
      org.opencontainers.image.revision="${REVISION}"

# rclone (Cloud Storage), age (cifrado), curl (tareas y monitor), tzdata y supercronic (cron sin root).
RUN apk add --no-cache rclone age curl tzdata supercronic

# rclone sin archivo de configuración ni llaves: usa la cuenta de servicio de la VM (servidor de metadatos).
# El CI reemplaza el remoto por una carpeta local con RCLONE_CONFIG_GCS_TYPE=local.
ENV RCLONE_CONFIG_GCS_TYPE="google cloud storage" \
    RCLONE_CONFIG_GCS_ENV_AUTH=true \
    RCLONE_CONFIG_GCS_BUCKET_POLICY_ONLY=true \
    APP_URL=http://app:3000 \
    OPS_DIR=/srv/ops \
    UPLOADS_SOURCE=/srv/app-data/uploads \
    TZ=America/Santiago

# El mismo uid que la app (1001): puede leer las subidas y, en una restauración, reescribirlas.
RUN addgroup -S -g 1001 ops && adduser -S -u 1001 -G ops ops \
 && mkdir -p /srv/ops /srv/app-data && chown ops:ops /srv/ops

COPY --chmod=0755 bin/ /usr/local/bin/
COPY --chmod=0644 lib/ /usr/local/lib/ops/
COPY --chmod=0644 crontab /etc/ops/crontab

USER ops
WORKDIR /srv/ops
# Programación en hora de Santiago (TZ); los registros van a stdout (docker logs).
ENTRYPOINT []
CMD ["supercronic", "-passthrough-logs", "/etc/ops/crontab"]
