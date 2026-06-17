# Separacion de Landing y Frontend

El repositorio tiene dos aplicaciones web separadas:

- `apps/landing-page`: sitio publico comercial.
- `apps/frontend`: aplicacion operativa autenticada.

## Servicio Railway: Landing

Usar:

```text
apps/landing-page/Dockerfile
```

Configurar:

```env
LANDING_SYSTEM_URL=https://<dominio-del-frontend-operativo>
```

`LANDING_SYSTEM_URL` es runtime y debe ser el dominio base del frontend operativo, sin `/krv`. El contenedor genera `/landing-config.js` al iniciar y el landing lo usa para enviar al usuario a `/krv/login` del frontend operativo.

## Servicio Railway: Frontend

Usar:

```text
apps/frontend/Dockerfile
```

El frontend ya no sirve el landing en `/`; se publica bajo `/krv` y su raiz redirige a `/krv/login`.
