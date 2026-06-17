# Separacion de Landing y Frontend

El repositorio tiene dos aplicaciones web, pero para publicar landing en la raiz y el sistema en `/krv` sobre el mismo dominio se debe usar el contenedor combinado:

- `/`: landing publico comercial.
- `/krv`: aplicacion operativa autenticada.

## Servicio Railway recomendado: Web combinado

Usar:

```text
apps/web/Dockerfile
```

Railway config:

```text
apps/web/railway.json
```

No configures `LANDING_SYSTEM_URL` en este modo. El landing usa el enlace relativo `/krv/login`, evitando URLs con puertos internos como `:8080`.

Variables del frontend operativo:

```env
API_UPSTREAM=https://korvii-api-prod.up.railway.app
REALTIME_UPSTREAM=https://korvii-realtime-prod.up.railway.app
```

## Servicios separados

- `apps/landing-page`: sitio publico comercial.
- `apps/frontend`: aplicacion operativa autenticada.

Usa este modo solo si landing y frontend van en dominios diferentes.

### Servicio Railway: Landing

Usar:

```text
apps/landing-page/Dockerfile
```

Configurar:

```env
LANDING_SYSTEM_URL=https://<dominio-del-frontend-operativo>
```

`LANDING_SYSTEM_URL` es runtime y debe ser el dominio base del frontend operativo, sin `/krv`. El contenedor genera `/landing-config.js` al iniciar y el landing lo usa para enviar al usuario a `/krv/login` del frontend operativo.

### Servicio Railway: Frontend

Usar:

```text
apps/frontend/Dockerfile
```

El frontend ya no sirve el landing en `/`; se publica bajo `/krv` y su raiz redirige a `/krv/login`.
