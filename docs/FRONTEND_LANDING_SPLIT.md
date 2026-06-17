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

## Servicio Railway: Frontend

Usar:

```text
apps/frontend/Dockerfile
```

El frontend ya no sirve el landing en `/`; su raiz redirige a `/login`.
