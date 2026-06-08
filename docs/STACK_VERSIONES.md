# Stack y versiones actualizadas

Este MVP fue actualizado para usar las versiones estables más recientes del stack principal, manteniendo compatibilidad real entre Angular, NestJS, TypeScript y Node.js.

## Decisiones de versión

| Tecnología | Versión | Motivo |
|---|---:|---|
| Angular | 21.2.12 | Última versión estable del framework Angular al momento de actualizar el MVP. |
| Angular CLI | 21.2.10 | CLI estable alineada con Angular 21. |
| NestJS | 11.1.19 | Última versión estable de los paquetes core de NestJS. |
| @nestjs/typeorm | 11.0.1 | Adaptador actual para NestJS 11 + TypeORM. |
| TypeORM | 0.3.29 | Última versión estable disponible de TypeORM. |
| PostgreSQL/PostGIS | postgis/postgis:18-3.6 | Imagen actual para PostgreSQL 18 con PostGIS 3.6. |
| Node.js | 24.15.0 LTS | Última línea LTS recomendada para desarrollo estable. |
| pnpm | 11.0.9 | Última versión estable del package manager. |
| TypeScript | 5.9.3 | Última versión compatible con Angular 21. |

## Por qué no TypeScript 6

Aunque TypeScript 6 está publicado, Angular 21 declara compatibilidad con TypeScript `>=5.9.0 <6.0.0`. Por eso el proyecto fija `typescript@5.9.3` para evitar errores de compilación en Angular.

## Por qué no Angular 22 next

Angular 22 existe como versión `next`/pre-release. Para un MVP demostrable y empresarial se usa Angular 21 estable, no una versión candidata.

## Comandos recomendados

```bash
nvm install 24.15.0
nvm use 24.15.0
corepack enable
corepack prepare pnpm@11.0.9 --activate
pnpm install
pnpm build
```

## Validación esperada

- `pnpm --filter @ruta-segura/backend build` debe compilar la API.
- `pnpm --filter @ruta-segura/frontend build` debe compilar la app Angular.
- `docker compose up -d postgres` debe levantar PostgreSQL/PostGIS.
