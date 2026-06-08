# Alcance MVP — Korvi

## 1. Propósito

Crear una plataforma mínima funcional para demostrar cómo la tecnología puede transformar reportes ciudadanos en prevención vial y analítica para instituciones públicas y aseguradoras.

## 2. Módulos MVP

### Autenticación y roles
- Registro ciudadano.
- Login con JWT.
- Roles: ciudadano, moderador, administrador institucional, administrador aseguradora y superadmin.

### Reportes ciudadanos
- Crear reporte vial.
- Categorías: accidente, semáforo dañado, vía en mal estado, falta de iluminación, falta de señalización, conducción imprudente, cruce peligroso, otro.
- Guardar ubicación GPS.
- Adjuntar URL de foto o evidencia.
- Seguimiento de estado.

### Mapa/listado de riesgo
- Ver reportes georreferenciados.
- Filtrar por categoría, estado, provincia, municipio y nivel de riesgo.
- Consultar detalle del reporte.

### Gestión institucional
- Validar reporte.
- Rechazar reporte.
- Marcar duplicado.
- Pasar a intervención.
- Resolver reporte.
- Registrar historial/auditoría.

### Educación vial
- Lecciones breves.
- Quizzes.
- Progreso del usuario.

### Analítica
- KPIs por estado.
- KPIs por categoría.
- Promedio de riesgo.
- Reportes recientes.
- Top zonas/provincias.

## 3. Fuera del alcance de la versión base

- App móvil nativa.
- Integración oficial con 911, INTRANT o DIGESETT.
- Machine Learning de predicción.
- Validación automática por visión computarizada.
- Pagos, pólizas reales o datos personales sensibles de asegurados.

## 4. Criterios de aceptación del MVP

- Un ciudadano puede crear un reporte desde el frontend.
- El backend persiste el reporte.
- El administrador puede ver y cambiar estado.
- El dashboard muestra KPIs actualizados.
- El usuario puede consultar contenido de educación vial.
- La API tiene documentación Swagger.


## Actualización de stack

Esta base fue actualizada para Angular 21.2.12, NestJS 11.1.19, TypeORM 0.3.29, PostgreSQL/PostGIS 18-3.6, Node.js 24.15.0 LTS y pnpm 11.0.9.
