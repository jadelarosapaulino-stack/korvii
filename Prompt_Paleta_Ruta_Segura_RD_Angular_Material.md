# Prompt descargable: Paleta Ruta Segura RD con Angular Material

Este archivo contiene un prompt listo para usar en Codex, Cursor, ChatGPT u otra IA de desarrollo. Está enfocado en implementar la paleta visual de **Ruta Segura RD** usando **Angular Material** como sistema principal de componentes.

## Prompt

```txt
Actúa como arquitecto frontend Angular, diseñador UI/UX senior y especialista en Angular Material.

Necesito implementar la identidad visual de “Ruta Segura RD”, una aplicación de seguridad vial para República Dominicana enfocada en reportes ciudadanos, mapas de riesgo, educación vial, panel institucional, aseguradoras y gobierno.

IMPORTANTE:
- El proyecto usará Angular con Angular Material como sistema principal de componentes visuales.
- Usa SCSS, tokens globales, variables CSS y la API de theming compatible con la versión instalada de @angular/material.
- Si la versión instalada soporta Material 3, prioriza Material 3. Si no, usa el sistema de theming compatible sin romper el build.
- Mantén un diseño moderno, claro, institucional, accesible y apto para dashboards operativos.

OBJETIVO:
Crear la base visual del proyecto con Angular Material, incluyendo tema global, tokens, estilos de componentes, estados de riesgo, estados de reportes y ejemplos aplicados a pantallas reales del MVP.

PALETA BASE:
- primary: #0F3D5E
- primary-dark: #082A42
- secondary: #00A6A6
- success: #22C55E
- warning: #F59E0B
- danger: #DC2626
- background: #F4F7FA
- surface: #FFFFFF
- text-primary: #102A43
- text-muted: #64748B
- border: #D8E2EA

DONDE SE USARÁ ANGULAR MATERIAL:
1. Layout principal:
   - mat-sidenav-container
   - mat-sidenav
   - mat-toolbar
   - mat-nav-list
   - mat-icon
   - mat-menu

2. Autenticación:
   - mat-card para login y registro
   - mat-form-field
   - mat-input
   - mat-button
   - mat-progress-spinner para carga

3. Dashboard institucional para aseguradoras y gobierno:
   - mat-card para KPIs
   - mat-table para reportes y métricas
   - mat-paginator
   - mat-sort
   - mat-tabs para secciones
   - mat-chip para estados
   - mat-icon para indicadores visuales

4. Reportes ciudadanos:
   - mat-card para resumen del reporte
   - mat-form-field para descripción, provincia, municipio y categoría
   - mat-select para tipo de incidente
   - mat-chip o mat-badge para estado y riesgo
   - mat-dialog para confirmar envío o revisión
   - mat-snack-bar para mensajes de éxito o error

5. Mapa de riesgo:
   - Contenedor personalizado para mapa
   - mat-card para filtros
   - mat-button-toggle-group para filtros rápidos
   - mat-chip-listbox para categorías
   - mat-tooltip para ayudas visuales

6. Educación vial:
   - mat-card para lecciones
   - mat-progress-bar para avance
   - mat-radio-group para quizzes
   - mat-stepper si aplica para módulos guiados
   - mat-expansion-panel para contenido educativo

7. Administración:
   - mat-table para gestión de reportes
   - mat-dialog para validar, rechazar o marcar como resuelto
   - mat-menu para acciones por fila
   - mat-slide-toggle para activar o desactivar configuraciones
   - mat-datepicker si se filtra por fechas

8. Analítica para aseguradora y gobierno:
   - mat-card para métricas de siniestralidad, zonas críticas y comportamiento
   - mat-table para ranking de zonas de riesgo
   - mat-tabs para separar vistas: Ciudadanía, Gobierno, Aseguradora
   - mat-chip para clasificación de riesgo
   - gráficos externos si son necesarios, integrados dentro de mat-card

ESTADOS VISUALES DE REPORTE:
- Pendiente: warning / #F59E0B
- Validado: secondary / #00A6A6
- En revisión: primary / #0F3D5E
- En intervención: primary-dark / #082A42
- Resuelto: success / #22C55E
- Rechazado: text-muted / #64748B

ESTADOS DE RIESGO:
- Riesgo bajo: success / #22C55E
- Riesgo medio: warning / #F59E0B
- Riesgo alto: danger / #DC2626
- Riesgo crítico: primary-dark con borde danger o fondo danger suave

REGLAS DE DISEÑO:
- Usa primary para identidad, navegación y jerarquía institucional.
- Usa secondary para acciones principales y elementos tecnológicos.
- Usa success solo para estados positivos o resueltos.
- Usa warning para alertas preventivas y pendientes.
- Usa danger con moderación, solo para riesgo alto, crítico, error o accidente.
- Usa background como fondo general.
- Usa surface para tarjetas, formularios, modales y contenedores.
- Usa border para separadores suaves.
- Mantén contraste accesible en botones, chips, tablas y formularios.
- Evita grandes bloques en rojo o amarillo.
- En dashboards, prioriza lectura rápida, jerarquía visual y agrupación clara.

ARCHIVOS QUE DEBES CREAR O ACTUALIZAR:
- src/styles.scss
- src/theme/_tokens.scss
- src/theme/_material-theme.scss
- src/theme/_material-overrides.scss
- src/app/shared/ui/status-chip/status-chip.component.ts
- src/app/shared/ui/risk-chip/risk-chip.component.ts
- src/app/shared/ui/kpi-card/kpi-card.component.ts
- src/app/shared/utils/report-status-style.ts
- src/app/shared/utils/risk-level-style.ts

REQUERIMIENTOS TÉCNICOS:
1. Configura Angular Material en el proyecto.
2. Crea variables CSS globales en :root.
3. Crea un tema Material con los colores institucionales.
4. Aplica estilos globales al body, links, headings y superficies.
5. Personaliza botones Material:
   - mat-raised-button primary
   - mat-stroked-button
   - mat-icon-button
6. Personaliza mat-card para que use bordes suaves, sombra ligera y radio moderno.
7. Personaliza mat-table para dashboard administrativo.
8. Personaliza mat-chip para estados y niveles de riesgo.
9. Personaliza mat-sidenav y mat-toolbar para navegación institucional.
10. Crea componentes reutilizables para badge de estado, badge de riesgo y KPI card.

EJEMPLOS DE COMPONENTES QUE DEBES ENTREGAR:
- Botón principal “Crear reporte”
- Card de reporte ciudadano
- Badge de estado “Pendiente”
- Badge de riesgo “Riesgo alto”
- KPI card “Reportes críticos”
- Sidebar institucional
- Header principal
- Tabla administrativa de reportes
- Filtros de mapa usando Angular Material

CRITERIOS DE ACEPTACIÓN:
- El proyecto compila sin errores.
- Angular Material está correctamente instalado y configurado.
- Los colores no están hardcodeados dentro de cada componente; deben venir de tokens o clases reutilizables.
- Los componentes visuales son coherentes en app ciudadana, dashboard de aseguradora y dashboard de gobierno.
- Los estados de riesgo y reportes son consistentes en toda la aplicación.
- El diseño se ve moderno, limpio, institucional y usable.
- El código SCSS está organizado y no duplica estilos innecesarios.
- Las tablas, cards y formularios se ven bien en desktop y responsive.

ENTREGA ESPERADA:
Devuélveme:
1. Archivos SCSS completos.
2. Configuración de Angular Material.
3. Componentes reutilizables.
4. Ejemplos de uso en HTML/TS.
5. Explicación breve de cómo aplicar la paleta en nuevas pantallas.

```
