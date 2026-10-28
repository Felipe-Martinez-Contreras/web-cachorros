# Despliegue en Google Cloud y Cloudflare

Guía paso a paso para dejar el sitio en una VM de Google Cloud detrás de Cloudflare (especificación 12). Está
escrita para seguirla de principio a fin desde un PC con Windows y PowerShell, y luego dentro de la VM. Tiempo
estimado: unos 60 minutos la primera vez.

> **Capturas pendientes.** Donde dice `[CAPTURA: …]`, toma la captura de la consola mientras haces el paso y
> guárdala en `docs/capturas/despliegue/` con ese nombre.

**Qué se arma:**

| Pieza | Dónde | Detalle |
|---|---|---|
| VM e2-micro (free tier) | Google Cloud, `us-east1` | Debian, disco `pd-standard` de 30 GB, swap de 2 GB |
| Respaldos | Bucket de Cloud Storage en `us-east1` | Cifrados con `age`; la VM solo puede usar este bucket |
| DNS, SSL, caché y WAF | Cloudflare | Full (strict) con Origin CA y Authenticated Origin Pulls |
| Correo | Brevo (SMTP, puerto 587) | Avisos de formularios y recuperación de contraseña |
| Monitoreo | UptimeRobot y healthchecks.io | Disponibilidad cada 5 min y «respaldo de hoy llegó» |

**Regla de seguridad (mínimo privilegio):** la cuenta de servicio de la VM solo accede al bucket de
respaldos. Nada que corra en la VM cambia la infraestructura de Google Cloud: el firewall se actualiza desde tu
PC o con el workflow mensual de GitHub (paso 8).

## 0. Antes de empezar

- Cuenta de Google Cloud con una **cuenta de facturación** (el free tier la exige aunque cueste US$ 0).
- `gcloud` instalado en el PC (`gcloud version`) y con sesión: `gcloud auth login`.
- El dominio `fmartinez.xyz` en tu cuenta de Cloudflare.
- La última versión publicada: en GitHub → Actions → «Publicar imágenes», el resumen dice
  `./deploy/deploy.sh sha-xxxxxxx`. Anota esa versión.

En PowerShell, define estas variables (se usan en todos los comandos de esta guía):

```powershell
$PROJECT = 'cachorros-web'           # si el nombre está tomado, agrega un sufijo: cachorros-web-2026
$REGION = 'us-east1'
$ZONE = 'us-east1-b'
$BUCKET = "$PROJECT-respaldos"
$VM_SA = "cachorros-vm@$PROJECT.iam.gserviceaccount.com"
```

## 1. Google Cloud

### 1.1 Proyecto, facturación y alerta de presupuesto

```powershell
gcloud projects create $PROJECT --name="Cachorros web"
gcloud config set project $PROJECT
gcloud billing accounts list
$BILLING = 'XXXXXX-XXXXXX-XXXXXX'    # el ID de la lista anterior
gcloud billing projects link $PROJECT --billing-account=$BILLING
gcloud services enable compute.googleapis.com iap.googleapis.com storage.googleapis.com iamcredentials.googleapis.com billingbudgets.googleapis.com
gcloud billing budgets create --billing-account=$BILLING --display-name="Cachorros: tope US$ 5" --budget-amount=5USD --threshold-rule=percent=0.5 --threshold-rule=percent=0.9 --threshold-rule=percent=1.0
```

La alerta de presupuesto llega al correo de la cuenta de facturación al 50, 90 y 100 % de US$ 5. `[CAPTURA:
presupuesto.png]`

### 1.2 Bucket de respaldos

```powershell
gcloud storage buckets create "gs://$BUCKET" --location=$REGION --default-storage-class=STANDARD --uniform-bucket-level-access --public-access-prevention
gcloud storage buckets update "gs://$BUCKET" --lifecycle-file=deploy/gcs-lifecycle.json
```

El ciclo de vida (`deploy/gcs-lifecycle.json`) borra solo los respaldos diarios a los 14 días, los mensuales a
los 365 y el historial de imágenes a los 30. El free tier incluye 5 GB en regiones de EE. UU.

### 1.3 Cuenta de servicio de la VM (solo el bucket)

```powershell
gcloud iam service-accounts create cachorros-vm --display-name="VM Cachorros (solo respaldos)"
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" --member="serviceAccount:$VM_SA" --role=roles/storage.objectAdmin
```

No le des ningún otro rol: ni en el proyecto ni en Compute Engine.

### 1.4 IP estática y VM

```powershell
gcloud compute addresses create cachorros-ip --region=$REGION
gcloud compute addresses describe cachorros-ip --region=$REGION --format="value(address)"
gcloud compute instances create cachorros-vm --zone=$ZONE --machine-type=e2-micro --image-family=debian-13 --image-project=debian-cloud --boot-disk-size=30GB --boot-disk-type=pd-standard --tags=cachorros-web --service-account=$VM_SA --scopes=cloud-platform --address=cachorros-ip --shielded-secure-boot --metadata=enable-oslogin=TRUE
```

- **`pd-standard`**, no *balanced*: el disco *balanced* que propone la consola no entra en el free tier.
- **Sin** «Permitir tráfico HTTP/HTTPS»: el 443 lo abre solo la regla del paso 1.5.
- `[VERIFICAR]` en la facturación del primer mes: la IP externa estática puede tener un costo (≈ US$ 3).

### 1.5 Firewall

```powershell
$CF = ((Invoke-RestMethod https://www.cloudflare.com/ips-v4).Trim() -split "`n" | Where-Object { $_ }) -join ','
gcloud compute firewall-rules create cachorros-https-cloudflare --network=default --direction=INGRESS --action=ALLOW --rules=tcp:443 --source-ranges=$CF --target-tags=cachorros-web
gcloud compute firewall-rules create cachorros-ssh-iap --network=default --direction=INGRESS --action=ALLOW --rules=tcp:22 --source-ranges=35.235.240.0/20 --target-tags=cachorros-web
gcloud compute firewall-rules delete default-allow-ssh default-allow-rdp --quiet
```

**Si Cloudflare cambia sus rangos** (el workflow mensual del paso 8 lo hace solo; esto es a mano, desde tu PC):

```powershell
$CF = ((Invoke-RestMethod https://www.cloudflare.com/ips-v4).Trim() -split "`n" | Where-Object { $_ }) -join ','
gcloud compute firewall-rules update cachorros-https-cloudflare --source-ranges=$CF
```

## 2. Cloudflare (`fmartinez.xyz`)

1. **DNS** → *Add record*: tipo `A`, nombre `cachorros`, la IP del paso 1.4, **Proxied** (nube naranja).
2. **SSL/TLS → Overview:** modo **Full (strict)**. **Edge Certificates:** Always Use HTTPS ON, Automatic HTTPS
   Rewrites ON, Minimum TLS 1.2, TLS 1.3 ON. **HSTS: todavía no** (se activa en el dominio definitivo).
3. **SSL/TLS → Origin Server → Create Certificate:** hostnames `*.fmartinez.xyz` y `fmartinez.xyz`, validez
   15 años, formato PEM. Guarda el certificado como `origin.pem` y la clave como `origin.key` en tu PC, fuera
   del repositorio. La clave no se puede volver a descargar. `[CAPTURA: origin-ca.png]`
4. **SSL/TLS → Origin Server → Authenticated Origin Pulls:** ON (a nivel de zona). Descarga el certificado de
   la CA de Cloudflare para AOP desde la documentación de Cloudflare («Zone-level authenticated origin pulls»)
   y guárdalo como `cloudflare-aop-ca.pem`.
5. **Speed → Optimization:** **Rocket Loader OFF**. **Scrape Shield:** **Email Address Obfuscation OFF**. Los
   dos reescriben el HTML y rompen el sitio (trampa 3). **Network:** HTTP/3 ON.
6. **Security:** WAF administrado ON. **Bot Fight Mode OFF** (bloquea las vistas previas de WhatsApp y
   Facebook). Si el plan lo permite, una regla de *rate limiting* para `POST` en `/api/forms/*`.
7. **Caching → Cache Rules** (en este orden):

   | Regla | Cuándo | Acción |
   |---|---|---|
   | Panel y API sin caché | URI path empieza con `/admin`, **o** empieza con `/api/` y no empieza con `/api/live/` ni `/api/share/` | Bypass cache |
   | Medios | URI path empieza con `/media/` | Eligible for cache · Edge TTL: respetar el origen |
   | Estáticos y tarjetas | URI path empieza con `/_next/static/` o `/api/share/` | Eligible for cache · respetar el origen |
   | En vivo | URI path empieza con `/api/live/` | Eligible for cache · respetar el origen (`s-maxage=10`) |

   El HTML no se cachea en el borde (trampa 4): no hace falta regla, es el comportamiento por defecto.
8. **Turnstile:** *Add widget*, modo **Managed**, hostnames `cachorros.fmartinez.xyz` y
   `cachorros-prueba.fmartinez.xyz` (este último es para la prueba de cambio de dominio). Anota la clave del
   sitio y la secreta.
9. **Analytics & Logs → Web Analytics:** agrega el sitio y copia el *token* (el valor de `"token"` del
   fragmento que muestra). Elige la instalación manual, **no** la automática: la automática reescribe el HTML.

## 3. Correo con Brevo

1. Crea la cuenta y, en **Senders, Domains & Dedicated IPs → Domains**, agrega el dominio del remitente (por
   ejemplo `cachorros.fmartinez.xyz`).
2. Brevo muestra los registros DNS (código de verificación, DKIM, DMARC y SPF): agrégalos en el DNS de
   Cloudflare **sin proxy** (nube gris) y verifica el dominio en Brevo. `[CAPTURA: brevo-dominio.png]`
3. **SMTP & API → SMTP:** crea una clave SMTP. El servidor es `smtp-relay.brevo.com`, puerto **587** (Google
   Cloud bloquea el 25); el usuario es el que muestra Brevo.

## 4. Clave de los respaldos (en tu PC)

```powershell
winget install FiloSottile.age
age-keygen -o cachorros-respaldos.key
```

- La línea `# public key: age1…` es la **clave pública**: va al servidor (paso 5.4).
- El archivo completo es la **clave privada**: guárdalo en tu gestor de contraseñas y bórralo del disco. Sin
  ella no se puede restaurar desde Cloud Storage. **Nunca** va al servidor ni al repositorio. En el traspaso se
  entrega a dos integrantes de la directiva.

## 5. La VM

### 5.1 Entrar (siempre por IAP)

```powershell
gcloud compute ssh cachorros-vm --zone=$ZONE --tunnel-through-iap
```

### 5.2 Preparar el sistema (dentro de la VM)

```bash
sudo apt-get update && sudo apt-get install -y git
sudo git clone --depth 1 https://github.com/Felipe-Martinez-Contreras/web-cachorros.git /opt/cachorros
sudo chown -R "$USER":"$USER" /opt/cachorros
cd /opt/cachorros
sudo ./deploy/bootstrap-vm.sh
exit
```

`bootstrap-vm.sh` instala Docker y Compose desde el repositorio oficial, deja la rotación de logs, crea 2 GB de
swap, activa las actualizaciones automáticas de seguridad y te agrega al grupo `docker`. Sal y vuelve a entrar
(paso 5.1) para que el grupo tome efecto.

### 5.3 Certificados (desde tu PC)

```powershell
gcloud compute scp origin.pem origin.key cloudflare-aop-ca.pem cachorros-vm:/opt/cachorros/deploy/certs/ --zone=$ZONE --tunnel-through-iap
```

Luego, dentro de la VM:

```bash
chmod 600 /opt/cachorros/deploy/certs/*
```

Borra `origin.key` de tu PC o guárdala en tu gestor de contraseñas.

### 5.4 Variables (`.env`)

```bash
cd /opt/cachorros
./deploy/generar-env.sh
```

Genera los secretos al azar y pregunta: entorno (`staging`), dominio, claves de Turnstile, SMTP de Brevo,
remitente, bucket (`cachorros-web-respaldos`), clave pública de `age`, token de Web Analytics y la URL de
healthchecks.io (si todavía no la tienes, déjala vacía: se agrega en el paso 7). Con `production`, deja
`AUTH_REQUIRE_2FA=true`.

También pregunta el id y el token de la página de Facebook (opcionales: déjalos vacíos y cárgalos después con
[la guía de Facebook](integraciones/facebook.md)). En staging no se publica en Facebook salvo con
`FACEBOOK_ALLOW_NON_PRODUCTION=true`.

### 5.5 Primer despliegue

```bash
cd /opt/cachorros
./deploy/deploy.sh sha-xxxxxxx          # la versión del paso 0
docker compose run --rm app node scripts/create-admin.mjs
docker compose run --rm app node scripts/seed.mjs --en-vivo   # solo en staging: datos de demostración
crontab -e
```

En `crontab -e`, agrega esta línea (rangos de Cloudflare para Caddy, el día 3 de cada mes):

```text
0 6 3 * * cd /opt/cachorros && ./deploy/cloudflare-ips.sh >> /opt/cachorros/cloudflare-ips.log 2>&1
```

Si `docker compose pull` responde «unauthorized», las imágenes de GHCR quedaron privadas: crea en GitHub un
*token* (classic) solo con `read:packages` y entra con `docker login ghcr.io -u <tu usuario>` (pega el token
como contraseña).

### 5.6 Actualizar

```bash
cd /opt/cachorros
git pull                              # scripts, compose.yaml y Caddyfile
./deploy/deploy.sh sha-yyyyyyy        # imágenes nuevas (respaldo previo y vuelta atrás automática)
./deploy/deploy.sh rollback           # volver a la versión anterior
```

#### Reprocesar los escudos ya subidos

Desde la versión que recorta el margen vacío de los escudos y logos (y mide lo visible para que todos se vean
del mismo tamaño), los que se subieron antes se vuelven a procesar una vez, después de desplegarla:

```bash
cd /opt/cachorros
docker compose run --rm app node scripts/reprocess-logos.mjs   # solo los que quedaron con el proceso anterior
docker compose restart app                                     # el sitio deja de usar en caché los archivos viejos
```

Se puede repetir sin riesgo: lo que ya está al día no se toca. No se pierde nada: cada logo queda en una
carpeta nueva (`<clave>-l1`, así su URL cambia y Cloudflare no sirve la versión vieja) con el archivo original
sin recortar en `original.png`, y la carpeta anterior se conserva. También sube la versión de las tarjetas de
los partidos de esos equipos, que se vuelven a dibujar. Al día siguiente (cuando ya ninguna página en caché
apunta a los archivos viejos), borra las carpetas anteriores:

```bash
docker compose run --rm app node scripts/reprocess-logos.mjs --limpiar
```

#### Memoria del contenedor `ops` (respaldos)

El límite de `ops` (`OPS_MEMORY_LIMIT`) es **192m** desde octubre de 2026; antes era 96m. Con más fotos en
`uploads`, la copia de las imágenes del respaldo (`rclone sync`) pasó de 96 MB y el kernel la cortó: el
respaldo falló en el paso «copia de las imágenes» con «Killed». Hay dos cambios:

- **rclone en modo de bajo consumo** (variables `RCLONE_*` del Dockerfile de `ops`, valen para el respaldo y la
  restauración): una transferencia y dos chequeos a la vez, sin búfer de lectura adelantada
  (`--buffer-size 0`), una cola corta de archivos pendientes y el recolector de Go más frecuente (`GOGC=50`), con un tope blando de 120 MiB
  (`GOMEMLIMIT`) para que libere memoria antes de llegar al límite del contenedor.
  En Cloud Storage lista carpeta por carpeta (sin `--fast-list`) y no revisa el bucket. Así la memoria no
  crece con la cantidad de fotos; el respaldo tarda un poco más, de noche y sin apuro.
- **192m por defecto** en `compose.yaml`, `.env.example` y `generar-env.sh`. Cabe en el presupuesto de la
  e2-micro: los límites son topes, no reservas, y `ops` casi no usa memoria salvo durante el respaldo
  nocturno, cuando el sitio tiene poco tráfico. Si los cuatro topes (64 + 512 + 256 + 192 MB) coincidieran,
  el swap de 2 GB los absorbe.

En una VM con un `.env` anterior, no hace falta tocar nada si ya tiene `OPS_MEMORY_LIMIT=192m`. Si no la
tiene, toma el nuevo default de `compose.yaml` al actualizar. Para revisarlo y aplicarlo:

```bash
cd /opt/cachorros
grep OPS_MEMORY_LIMIT .env                                       # vacío o 192m
docker compose up -d ops                                         # aplica el límite nuevo
docker compose exec ops backup.sh                                # respaldo de prueba
docker stats --no-stream "$(docker compose ps -q ops)"           # memoria en uso
```

El CI lo comprueba en cada cambio (`probar-ops.sh`): un respaldo con 4.030 imágenes y el límite de
`compose.yaml` aplicado sin swap. Si rclone no cupiera, la prueba falla igual que en la VM.

## 6. Verificar

Desde tu PC:

```powershell
curl.exe -sS https://cachorros.fmartinez.xyz/api/health                       # {"status":"ok","db":"ok",…}
curl.exe -sS -o NUL -w "%{http_code}`n" https://cachorros.fmartinez.xyz/api/cron/tick   # 404
$IP = gcloud compute addresses describe cachorros-ip --region=$REGION --format="value(address)"
curl.exe -k --max-time 10 "https://$IP/"                                      # debe fallar: el firewall no deja entrar
gcloud compute ssh cachorros-vm --zone=$ZONE                                    # sin IAP: debe fallar
```

Dentro de la VM, el origen tampoco acepta conexiones sin el certificado de cliente de Cloudflare (AOP):

```bash
curl -k --resolve cachorros.fmartinez.xyz:443:127.0.0.1 https://cachorros.fmartinez.xyz/   # debe fallar (AOP)
docker compose exec ops backup.sh && docker compose exec ops restore-test.sh                # primer respaldo y su prueba
```

En el panel → Inicio → **Estado del sistema** deben aparecer el respaldo y la prueba de restauración.

## 7. Monitoreo

1. **UptimeRobot:** monitor *HTTP(s) – Keyword* a `https://cachorros.fmartinez.xyz/api/health`, cada 5
   minutos, palabra clave `"db":"ok"`, con alertas a tu correo.
2. **healthchecks.io:** un *check* con periodo de 1 día y gracia de 2 horas. Copia la URL de *ping* y, en la VM:

```bash
cd /opt/cachorros
nano .env                  # BACKUP_HEALTHCHECK_URL=https://hc-ping.com/…
docker compose up -d ops
```

Prueba la alerta: `docker compose stop app`, espera el aviso de UptimeRobot y vuelve con
`docker compose up -d`.

### 7.1 Si la app queda «unhealthy»

Docker marca la app `unhealthy` cuando `/api/health` falla, pero **no la reinicia** (eso solo lo hace Swarm, y
un contenedor que la reinicie necesitaría el socket de Docker en la VM). Por eso la app se cuida sola: si
`/api/health` no llega a la base durante 3 minutos seguidos, termina con código 1 y `restart: unless-stopped`
la vuelve a levantar. Queda en el log como `health: la base de datos no responde hace demasiado`. El plazo se
cambia con `HEALTH_RESTART_AFTER_S` en `.env` (`0` lo desactiva).

Para revisar qué pasa antes de reiniciar a mano:

```bash
cd /opt/cachorros
docker compose ps                                   # estado (healthy / unhealthy) de cada servicio
docker stats --no-stream                            # CPU y memoria: ¿la app está al tope de CPU?
docker compose logs --since 10m app | grep -E 'CONNECT_TIMEOUT|health'
# Conexiones de la app en la base: deberían ser ≤ DB_POOL_MAX y ninguna «idle in transaction».
docker compose exec db psql -U "$(grep ^POSTGRES_USER= .env | cut -d= -f2)" -d "$(grep ^POSTGRES_DB= .env | cut -d= -f2)"   -c "select state, wait_event, now() - state_change as hace from pg_stat_activity where application_name = 'cachorros-web'"
docker compose restart app                          # si hace falta, a mano
```

Un `CONNECT_TIMEOUT` con la base sana suele ser **falta de CPU en la app** (la e2-micro tiene ~0,25 vCPU
sostenidos): con el proceso ocupado, la conexión no alcanza a completar su saludo en 15 s. El incidente de
sha-8191eed fue eso: las vistas previas de «Escudos en las tarjetas» se dibujaban de nuevo en cada visita, ~45
a la vez y aunque el navegador ya se hubiera ido. Desde fix-conexiones-bd se dibujan una sola vez (caché en
`SHARE_CACHE_DIR/escudos/`), se piden de a dos y no se procesa lo abandonado.

## 8. Opcional: desplegar y actualizar el firewall desde GitHub (Workload Identity Federation)

Sin llaves JSON: GitHub obtiene credenciales de corta duración solo para este repositorio. Son dos cuentas de
servicio nuevas, ninguna es la de la VM.

```powershell
$REPO = 'Felipe-Martinez-Contreras/web-cachorros'
$NUMBER = gcloud projects describe $PROJECT --format="value(projectNumber)"
gcloud iam workload-identity-pools create github --location=global --display-name="GitHub"
gcloud iam workload-identity-pools providers create-oidc github --location=global --workload-identity-pool=github --issuer-uri="https://token.actions.githubusercontent.com" --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" --attribute-condition="assertion.repository == '$REPO'"
$PRINCIPAL = "principalSet://iam.googleapis.com/projects/$NUMBER/locations/global/workloadIdentityPools/github/attribute.repository/$REPO"

# Despliegue: SSH por IAP con OS Login (y sudo para correr deploy.sh como el dueño de /opt/cachorros).
gcloud iam service-accounts create cachorros-deploy --display-name="Despliegue desde GitHub"
$DEPLOY_SA = "cachorros-deploy@$PROJECT.iam.gserviceaccount.com"
gcloud iam service-accounts add-iam-policy-binding $DEPLOY_SA --role=roles/iam.workloadIdentityUser --member=$PRINCIPAL
gcloud projects add-iam-policy-binding $PROJECT --member="serviceAccount:$DEPLOY_SA" --role=roles/iap.tunnelResourceAccessor
gcloud projects add-iam-policy-binding $PROJECT --member="serviceAccount:$DEPLOY_SA" --role=roles/compute.osAdminLogin
gcloud projects add-iam-policy-binding $PROJECT --member="serviceAccount:$DEPLOY_SA" --role=roles/compute.viewer
gcloud iam service-accounts add-iam-policy-binding $VM_SA --role=roles/iam.serviceAccountUser --member="serviceAccount:$DEPLOY_SA"

# Firewall: un rol propio que solo lee y actualiza reglas de firewall.
gcloud iam roles create cachorrosFirewall --project=$PROJECT --title="Actualizar firewall de Cachorros" --permissions=compute.firewalls.get,compute.firewalls.update,compute.networks.updatePolicy
gcloud iam service-accounts create cachorros-firewall --display-name="Firewall desde GitHub"
$FIREWALL_SA = "cachorros-firewall@$PROJECT.iam.gserviceaccount.com"
gcloud iam service-accounts add-iam-policy-binding $FIREWALL_SA --role=roles/iam.workloadIdentityUser --member=$PRINCIPAL
gcloud projects add-iam-policy-binding $PROJECT --member="serviceAccount:$FIREWALL_SA" --role="projects/$PROJECT/roles/cachorrosFirewall"
```

En GitHub → Settings → Secrets and variables → Actions → **Variables**:

| Variable | Valor |
|---|---|
| `GCP_PROJECT` | el proyecto |
| `GCP_ZONE` | `us-east1-b` |
| `GCP_VM` | `cachorros-vm` |
| `GCP_WIF_PROVIDER` | `projects/<número>/locations/global/workloadIdentityPools/github/providers/github` |
| `GCP_DEPLOY_SA` | `cachorros-deploy@<proyecto>.iam.gserviceaccount.com` |
| `GCP_FIREWALL_SA` | `cachorros-firewall@<proyecto>.iam.gserviceaccount.com` |

Y en **Environments**, crea `staging` y `produccion` (en `produccion`, con tu aprobación como requisito).
Desde ahí: Actions → «Desplegar» → versión y entorno. El workflow «Firewall con los rangos de Cloudflare»
corre solo el día 3 de cada mes.
