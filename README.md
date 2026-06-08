# Korvi - MVP Base Real

Base inicial del MVP para **Korvi**, **Smart Mobility Platform** para República Dominicana con enfoque ciudadano, asegurador e institucional.

## Stack actualizado

| Capa | Tecnología | Versión usada | Criterio |
|---|---:|---:|---|
| Frontend | Angular | 21.2.12 | Última versión estable del framework Angular incluida en el proyecto |
| Frontend CLI | Angular CLI | 21.2.10 | Última CLI estable compatible con Angular 21 |
| Backend | NestJS | 11.1.19 | Última versión estable de `@nestjs/core`, `@nestjs/common` y `@nestjs/platform-express` |
| ORM | TypeORM | 0.3.29 | Última rama estable 0.3.x usada con `@nestjs/typeorm` 11 |
| Base de datos | PostgreSQL + PostGIS | `postgis/postgis:18-3.6` | Imagen PostGIS para PostgreSQL 18 + PostGIS 3.6 |
| Runtime | Node.js | 24.15.0 LTS | Compatible con Angular 21 y recomendado para desarrollo estable |
| Package manager | pnpm | 11.0.9 | Última versión estable usada por el monorepo |
| TypeScript | TypeScript | 5.9.3 | Última versión compatible con Angular 21; Angular 21 requiere `>=5.9 <6.0` |

> Nota técnica: TypeScript 6 existe, pero **no se fijó** porque Angular 21 declara compatibilidad con TypeScript `>=5.9.0 <6.0.0`. Para evitar conflictos de build, el MVP usa TypeScript 5.9.3.

## Identidad de marca

- Guia de marca: `docs/KORVI_IDENTIDAD_DE_MARCA.md`
- Prompt reutilizable: `prompts/03-korvi-identidad-marca.md`

## Estructura

```text
ruta_segura_mvp_base_latest/
├── apps/
│   ├── backend/       # NestJS 11 API REST
│   └── frontend/      # Angular 21 standalone app
├── docs/
│   ├── API.http
│   ├── MVP_ALCANCE.md
│   └── STACK_VERSIONES.md
├── infra/postgres/
│   └── init.sql
├── docker-compose.yml
├── package.json
└── pnpm-workspace.yaml
```

## Requisitos

```bash
node -v     # recomendado: v24.15.0
pnpm -v     # recomendado: 11.0.9
docker -v
```

Con `nvm`:

```bash
nvm install 24.15.0
nvm use 24.15.0
corepack enable
corepack prepare pnpm@11.0.9 --activate
```

## Instalación

```bash
pnpm install
```

## Levantar base de datos

```bash
docker compose up -d postgres
```

## Configurar backend

```bash
cd apps/backend
cp .env.example .env
pnpm migration:run
pnpm seed
pnpm start:dev
```

API:

```text
http://localhost:3000/api
http://localhost:3000/docs
```

## Migraciones de base de datos

El backend ya no debe depender de `DB_SYNC=true` para ambientes productivos. Usa:

```bash
pnpm db:migrate        # aplica migraciones pendientes
pnpm db:migrate:show   # muestra estado
pnpm db:migrate:revert # revierte la ultima migracion
```

Para desarrollo local puedes mantener `DB_SYNC=true` temporalmente, pero staging/produccion deben usar `DB_SYNC=false` y migraciones.

## Levantar frontend

```bash
cd apps/frontend
pnpm start
```

Frontend:

```text
http://localhost:4200
```

## Levantar app movil

Instala Flutter y genera los proyectos nativos dentro del scaffold incluido:

```bash
cd apps/mobile
flutter create .
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000/api
```

Usa `10.0.2.2` para emulador Android. En un dispositivo fisico usa la IP local del equipo donde corre el backend.

## Credenciales demo

El seed crea usuarios demo para probar los flujos ciudadanos e institucionales. Revisa `apps/backend/src/database/seed.ts`.

## Funcionalidades incluidas

- Login y registro con JWT.
- Roles base: ciudadano, moderador, admin y super admin.
- Reportes ciudadanos con categoría, descripción, ubicación y evidencia.
- Mapa visual MVP.
- App movil ciudadana con reportes con foto, GPS, mapa, alertas cercanas, educacion vial y modo emergencia.
- Panel administrativo para validar reportes.
- Módulo educativo con lecciones y progreso.
- Analítica institucional básica.

## Siguiente paso recomendado

1. Ejecutar `pnpm install`.
2. Validar build de backend y frontend.
3. Sustituir mapa visual mock por Mapbox, Google Maps u OpenStreetMap.
4. Mantener nuevas migraciones TypeORM para cada cambio de esquema.
5. Implementar refresh tokens y almacenamiento seguro de sesión.


## Nota para Windows + pnpm 11

Si `pnpm install` muestra `ERR_PNPM_IGNORED_BUILDS`, esta versión ya incluye `allowBuilds` en `pnpm-workspace.yaml`. Ejecuta:

```powershell
pnpm store prune
pnpm install
```

Si vienes de una instalación fallida, elimina `node_modules` antes de reinstalar. Ver `docs/SOLUCION_PNPM_WINDOWS.md`.
