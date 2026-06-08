# Prompt para continuar el MVP con stack actualizado

Actúa como arquitecto full-stack senior. Este monorepo usa Angular 21.2.12, NestJS 11.1.19, TypeORM 0.3.29, PostgreSQL/PostGIS 18-3.6, Node.js 24.15.0 LTS y pnpm 11.0.9.

Objetivo: continuar el MVP de Ruta Segura RD sin degradar versiones, manteniendo compatibilidad con TypeScript 5.9.3 porque Angular 21 requiere TypeScript >=5.9 <6.

Reglas:
- No instalar Angular 22 next.
- No usar TypeScript 6 hasta que Angular lo soporte oficialmente.
- Mantener standalone components en Angular.
- Mantener NestJS modular, DTOs con class-validator, guards RBAC y Swagger.
- Reemplazar synchronize por migraciones TypeORM antes de producción.
