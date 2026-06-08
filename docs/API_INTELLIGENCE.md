# Korvi Intelligence API

Documentacion tecnica del endpoint premium de inteligencia operativa usado por el panel **Korvi Intelligence**.

## Base URL

En desarrollo local:

```http
http://localhost:3000/api
```

El prefijo puede cambiar con `API_PREFIX` en `apps/backend/.env`.

## Autenticacion

Todos los endpoints de Analytics requieren JWT Bearer.

```http
Authorization: Bearer <access_token>
```

Roles permitidos:

- `MODERATOR`
- `INSTITUTION_ADMIN`
- `INSURANCE_ADMIN`
- `SUPER_ADMIN`

Usuarios ciudadanos no tienen acceso a esta API.

## Endpoint Principal

### GET `/analytics/intelligence`

Entrega scoring territorial, KPIs ejecutivos, rankings de riesgo y senales preventivas calculadas a partir de la tabla `reports`.

```http
GET /api/analytics/intelligence
Authorization: Bearer <access_token>
Accept: application/json
```

No recibe parametros actualmente.

## Respuesta

### 200 OK

```json
{
  "product": "Korvi Intelligence",
  "generatedAt": "2026-05-21T01:20:00.000Z",
  "kpis": {
    "totalReports": 120,
    "highRiskReports": 34,
    "floodZones": 8,
    "openReports": 51,
    "resolvedReports": 42,
    "exposureScore": 87,
    "preventionIndex": 33
  },
  "trends": {
    "byProvince": [
      {
        "label": "Santo Domingo",
        "count": 25,
        "averageRisk": 4.2,
        "highRiskCount": 18,
        "score": 100
      }
    ],
    "byMunicipality": [
      {
        "label": "Santo Domingo Este",
        "count": 14,
        "averageRisk": 4.5,
        "highRiskCount": 12,
        "score": 100
      }
    ],
    "byCategory": [
      {
        "label": "FLOOD_ZONE",
        "count": 8,
        "averageRisk": 5,
        "highRiskCount": 8,
        "score": 100
      }
    ],
    "byRoadType": [
      {
        "label": "Autopista",
        "count": 5,
        "averageRisk": 4.6,
        "highRiskCount": 4,
        "score": 100
      }
    ],
    "byHour": [
      {
        "hour": 14,
        "count": 9,
        "averageRisk": 3.78
      }
    ]
  },
  "preventionSignals": [
    "34 reportes de alto riesgo requieren priorizacion.",
    "8 zonas de posible inundacion deben evitarse en rutas sugeridas.",
    "Santo Domingo Este lidera el scoring territorial."
  ]
}
```

## Campos

### Raiz

| Campo | Tipo | Descripcion |
| --- | --- | --- |
| `product` | string | Nombre comercial del producto de inteligencia. |
| `generatedAt` | ISO date string | Fecha/hora en que se genero la respuesta. |
| `kpis` | object | Indicadores ejecutivos agregados. |
| `trends` | object | Rankings y tendencias por dimension. |
| `preventionSignals` | string[] | Mensajes ejecutivos listos para mostrar en UI o reportes. |

### `kpis`

| Campo | Tipo | Descripcion |
| --- | --- | --- |
| `totalReports` | number | Total de reportes registrados. |
| `highRiskReports` | number | Reportes con `riskLevel >= 4`. |
| `floodZones` | number | Reportes de categoria `FLOOD_ZONE`. |
| `openReports` | number | Reportes con estado `PENDING`, `VALIDATED` o `IN_PROGRESS`. |
| `resolvedReports` | number | Reportes con estado `RESOLVED`. |
| `exposureScore` | number | Score 0-100 de exposicion territorial. Mayor valor implica mayor riesgo operativo. |
| `preventionIndex` | number | Score 0-100 de mitigacion/preventividad. Mayor valor implica mejor capacidad de respuesta. |

### `trends`

Cada ranking usa el mismo formato `IntelligenceRow`.

```ts
interface IntelligenceRow {
  label: string;
  count: number;
  averageRisk: number;
  highRiskCount: number;
  score: number;
}
```

| Campo | Descripcion |
| --- | --- |
| `byProvince` | Top 8 provincias ordenadas por riesgo promedio y volumen. |
| `byMunicipality` | Top 10 municipios ordenados por riesgo promedio y volumen. |
| `byCategory` | Top 10 categorias con mayor riesgo. |
| `byRoadType` | Clasificacion heuristica por tipo de via inferida desde `title` y `description`. |
| `byHour` | Distribucion de reportes por hora del dia de `createdAt`. |

### `byHour`

```ts
interface IntelligenceHourRow {
  hour: number;        // 0-23
  count: number;
  averageRisk: number;
}
```

## Logica De Calculo

### Estados abiertos

`openReports` cuenta reportes en:

- `PENDING`
- `VALIDATED`
- `IN_PROGRESS`

### Alto riesgo

Un reporte es de alto riesgo cuando:

```ts
riskLevel >= 4
```

### `exposureScore`

Formula actual:

```ts
Math.min(
  100,
  Math.round(
    ((highRisk * 9 + floodZones * 14 + openReports * 3 + total) / Math.max(total, 1)) * 8
  )
)
```

Factores que suben la exposicion:

- Mas reportes de alto riesgo.
- Mas zonas de posible inundacion.
- Mas reportes abiertos.
- Mayor volumen total de reportes.

### `preventionIndex`

Formula actual:

```ts
Math.max(
  0,
  Math.min(100, 100 - exposureScore + Math.min(20, resolved * 2))
)
```

Interpretacion:

- Baja cuando sube la exposicion.
- Sube cuando hay reportes resueltos.
- El aporte por reportes resueltos esta limitado a 20 puntos.

### `score` De Rankings

Cada fila territorial/categoria/tipo de via calcula:

```ts
Math.min(
  100,
  Math.round(averageRisk * 16 + highRiskCount * 6 + count * 2)
)
```

El score combina:

- Riesgo promedio.
- Cantidad de reportes de alto riesgo.
- Volumen de reportes.

## Clasificacion `byRoadType`

El backend infiere el tipo de via con reglas simples sobre `description` y `title`.

| Resultado | Condicion |
| --- | --- |
| `Autopista` | `description` contiene `autopista`. |
| `Puente` | `description` contiene `puente`. |
| `Tunel` | `description` contiene `tunel`. |
| `Avenida` | `description` o `title` contiene `avenida`. |
| `Calle` | `description` o `title` contiene `calle`. |
| `No clasificada` | No coincide con las reglas anteriores. |

## Errores

### 401 Unauthorized

Token ausente, expirado o invalido.

```json
{
  "message": "Unauthorized",
  "statusCode": 401
}
```

### 403 Forbidden

El usuario autenticado no tiene uno de los roles permitidos.

```json
{
  "message": "Forbidden resource",
  "error": "Forbidden",
  "statusCode": 403
}
```

## Ejemplos

### cURL

```bash
curl -X GET "http://localhost:3000/api/analytics/intelligence" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/json"
```

### TypeScript Frontend

```ts
this.http.get<IntelligenceSummary>(`${API_URL}/analytics/intelligence`);
```

Tipos usados por el frontend:

```ts
export interface IntelligenceSummary {
  product: string;
  generatedAt: string;
  kpis: {
    totalReports: number;
    highRiskReports: number;
    floodZones: number;
    openReports: number;
    resolvedReports: number;
    exposureScore: number;
    preventionIndex: number;
  };
  trends: {
    byProvince: IntelligenceRow[];
    byMunicipality: IntelligenceRow[];
    byCategory: IntelligenceRow[];
    byRoadType: IntelligenceRow[];
    byHour: Array<{ hour: number; count: number; averageRisk: number }>;
  };
  preventionSignals: string[];
}
```

## Endpoint Relacionado

### GET `/analytics/summary`

Endpoint resumido usado por dashboard operativo.

```http
GET /api/analytics/summary
Authorization: Bearer <access_token>
```

Respuesta:

```json
{
  "total": 120,
  "pending": 30,
  "validated": 10,
  "inProgress": 11,
  "resolved": 42,
  "averageRisk": 3.25,
  "byCategory": [
    { "category": "FLOOD_ZONE", "count": "8" }
  ],
  "byProvince": [
    { "province": "Santo Domingo", "count": "25" }
  ]
}
```

## Fuente De Datos

La API lee datos de:

- Entidad: `Report`
- Tabla: `reports`
- Campos principales: `category`, `province`, `municipality`, `title`, `description`, `riskLevel`, `status`, `createdAt`.

## Limitaciones Actuales

- No hay parametros de rango de fecha en `/analytics/intelligence`.
- `byRoadType` usa heuristicas de texto, no un campo estructurado.
- Los scores son formulas operativas internas, no modelos ML entrenados.
- Las zonas de inundacion automaticas dependen del monitoreo meteorologico configurado.

## Ubicacion Del Codigo

- Controller: `apps/backend/src/modules/analytics/analytics.controller.ts`
- Service: `apps/backend/src/modules/analytics/analytics.service.ts`
- Frontend service: `apps/frontend/src/app/core/analytics.service.ts`
- Pantalla: `apps/frontend/src/app/features/intelligence/intelligence.component.ts`
