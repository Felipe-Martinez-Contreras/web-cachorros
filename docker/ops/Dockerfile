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
# Sin gosu: ops corre directo como usuario sin privilegios y nunca usa el entrypoint de postgres. gosu (de la
# imagen base) arrastraba una vulnerabilidad CRITICAL de la biblioteca estándar de Go (Trivy).
RUN apk add --no-cache rclone age curl tzdata supercronic  && rm -f /usr/local/bin/gosu /usr/local/bin/docker-entrypoint.sh /usr/local/bin/docker-ensure-initdb.sh /usr/local/bin/docker-enforce-initdb.sh

# rclone sin archivo de configuración ni llaves: usa la cuenta de servicio de la VM (servidor de metadatos).
# El CI reemplaza el remoto por una carpeta local con RCLONE_CONFIG_GCS_TYPE=local.
ENV RCLONE_CONFIG_GCS_TYPE="google cloud storage" \
    RCLONE_CONFIG_GCS_ENV_AUTH=true \
    RCLONE_CONFIG_GCS_BUCKET_POLICY_ONLY=true \
    APP_URL=http://app:3000 \
    OPS_DIR=/srv/ops \
    UPLOADS_SOURCE=/srv/app-data/uploads \
    TZ=America/Santiago

# El mismo uid que la app (1001): puede leer las subidas y, en una restauración, reescribirlas. /srv/app-data
# también es suyo: si ops monta el volumen app_data antes que la app, Docker copia este dueño al volumen
# (trampa 13) y la app debe poder escribir en él.
RUN addgroup -S -g 1001 ops && adduser -S -u 1001 -G ops ops \
 && mkdir -p /srv/ops /srv/app-data && chown ops:ops /srv/ops /srv/app-data

COPY bin/ /usr/local/bin/
COPY lib/ /usr/local/lib/ops/
COPY crontab /etc/ops/crontab
# Permisos explícitos: `COPY --chmod=0644` también se aplica a las carpetas que crea, y sin el bit de paso el
# usuario ops no podía leer el crontab ni cargar common.sh.
RUN chmod 0755 /usr/local/bin/*.sh /usr/local/lib/ops /etc/ops \
 && chmod 0644 /usr/local/lib/ops/* /etc/ops/crontab

USER ops
WORKDIR /srv/ops
# Programación en hora de Santiago (TZ); los registros van a stdout (docker logs).
ENTRYPOINT []
CMD ["supercronic", "-passthrough-logs", "/etc/ops/crontab"]
