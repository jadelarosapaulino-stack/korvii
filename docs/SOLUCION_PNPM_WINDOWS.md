# Solución para instalación con pnpm 11 en Windows

## Error observado

Durante `pnpm i` puede aparecer:

```bash
WARN Unsupported engine: wanted {"node": ">=24.15.0 <27"} current {"node":"v24.12.0"}
ERR_PNPM_IGNORED_BUILDS Ignored build scripts...
```

## Corrección aplicada en esta versión

1. Se relajó el rango de Node a `>=24.0.0 <27`, compatible con Angular 21 según la matriz oficial de Angular.
2. Se agregó `allowBuilds` en `pnpm-workspace.yaml` para aprobar explícitamente los paquetes técnicos que necesitan scripts de instalación.
3. Se mantiene `strictDepBuilds: true` para no desactivar seguridad globalmente.

## Comandos recomendados

Desde la raíz del proyecto:

```powershell
node -v
pnpm -v
pnpm store prune
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force apps/backend/node_modules -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force apps/frontend/node_modules -ErrorAction SilentlyContinue
pnpm install
```

Luego levanta la base de datos y los servicios:

```powershell
docker compose up -d postgres
pnpm --filter @ruta-segura/backend start:dev
pnpm --filter @ruta-segura/frontend start
```

## Alternativa si quieres la última versión LTS exacta de Node

Instala Node `24.15.0 LTS` o superior dentro de la rama 24.x. El proyecto también funciona con Node 24.12.0, pero para alinearte con el último LTS puedes actualizar Node.
