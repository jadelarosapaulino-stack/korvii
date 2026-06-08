# Arquitectura Realtime Escalable

Ruta Segura queda separada en dos procesos backend:

- `apps/backend`: API REST, autenticacion, dominio, base de datos y publicacion de eventos.
- `apps/realtime`: gateway WebSocket, autenticacion de sockets, salas y fan-out de eventos.

## Flujo

```text
Frontend / Mobile
  | REST
  v
apps/backend
  | PostgreSQL
  | Redis Pub/Sub: reports.events
  v
apps/realtime
  | Socket.IO rooms
  v
Frontend / Mobile
```

## Infraestructura local

```bash
docker compose up -d postgres redis
pnpm start:backend
pnpm start:realtime
pnpm start:frontend
```

## Variables

Backend:

```env
REALTIME_EVENTS_ENABLED=true
REDIS_URL=redis://localhost:6379
```

Realtime:

```env
REALTIME_PORT=3001
REALTIME_SOCKET_PATH=/socket.io
CORS_ORIGINS=http://localhost:4200,http://127.0.0.1:4200
JWT_SECRET=change_me_for_production
REDIS_URL=redis://localhost:6379
```

`JWT_SECRET` debe ser el mismo del backend.

## Eventos

Canal Redis:

```text
reports.events
```

Eventos emitidos a Socket.IO:

```text
report.created
report.updated
report.status_changed
report.assigned
report.metrics_changed
weather.flood_zone_created
```

Salas principales:

```text
reports:map
reports:admin
reports:institution:{institutionId}
reports:user:{userId}
weather:alerts
```

## Escalado

La API REST y realtime pueden escalarse de forma independiente. Para multiples instancias realtime, Redis Pub/Sub entrega el mismo evento a cada instancia y cada una hace fan-out a sus sockets conectados.

Para una fase de mayor criticidad, el canal `reports.events` puede migrarse de Redis Pub/Sub a Redis Streams o a un broker como NATS/RabbitMQ sin cambiar el contrato del evento hacia clientes.
