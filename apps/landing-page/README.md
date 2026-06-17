# Korvi Landing Page

Aplicacion Angular publica para el landing de Korvi. Debe desplegarse en un servicio/contenedor separado del frontend operativo.

## Railway

Crear un servicio separado para el landing usando:

```text
Dockerfile: apps/landing-page/Dockerfile
Railway config: apps/landing-page/railway.json
```

Variable runtime recomendada:

```env
LANDING_SYSTEM_URL=https://<dominio-del-frontend-operativo>
```

Esa variable debe ser el dominio base del frontend operativo, sin `/krv`. Se escribe en `landing-config.js` cuando inicia el contenedor, por lo que puedes cambiarla en Railway y reiniciar sin recompilar. Hace que los botones de acceso del landing apunten al frontend real bajo `/krv`, por ejemplo:

```text
https://korvii-app.up.railway.app/krv/login
```

## Local

```bash
pnpm --filter @ruta-segura/landing-page start
```

El landing local corre en `http://localhost:4300` y apunta al frontend local en `http://localhost:4200/krv/login`.
