# Public Launch Checklist

## Hosting

Recommended baseline:

- Angular frontend: static site or web container.
- NestJS backend: web service with `pnpm --filter @ruta-segura/backend start:prod`.
- NestJS realtime: web service with `pnpm --filter @ruta-segura/realtime start`.
- PostgreSQL: managed database with automated backups.
- Redis: managed Redis or Redis-compatible service for realtime events.
- Uploads: S3-compatible object storage.

Dockerfiles are available at:

- `apps/frontend/Dockerfile`
- `apps/backend/Dockerfile`
- `apps/realtime/Dockerfile`

Suggested domains:

- `https://app.example.com`
- `https://api.example.com`
- `https://realtime.example.com`
- `https://assets.example.com`

## Backend Production Env

Set these at minimum:

```env
NODE_ENV=production
PORT=3000
API_PREFIX=api
FRONTEND_URL=https://app.example.com
CORS_ORIGINS=https://app.example.com
SWAGGER_ENABLED=false

DB_HOST=
DB_PORT=5432
DB_USER=
DB_PASSWORD=
DB_NAME=
DB_SYNC=false
DB_MIGRATIONS_RUN=true
DB_LOGGING=false

JWT_SECRET=
JWT_EXPIRES_IN=1d

REDIS_URL=
REALTIME_EVENTS_ENABLED=true

STORAGE_DRIVER=s3
STORAGE_PUBLIC_BASE_URL=https://assets.example.com
STORAGE_S3_ENDPOINT=https://nyc3.digitaloceanspaces.com
STORAGE_S3_REGION=nyc3
STORAGE_S3_BUCKET=
STORAGE_S3_ACCESS_KEY_ID=
STORAGE_S3_SECRET_ACCESS_KEY=
STORAGE_S3_FORCE_PATH_STYLE=false
STORAGE_S3_ACL=public-read
```

Run before deploy:

```bash
pnpm --filter @ruta-segura/backend check:prod-env
pnpm --filter @ruta-segura/backend build
```

## Realtime Production Env

```env
NODE_ENV=production
REALTIME_PORT=3001
REALTIME_SOCKET_PATH=/socket.io
CORS_ORIGINS=https://app.example.com
JWT_SECRET=
REDIS_URL=
```

Health endpoint:

```text
GET /health
```

## Frontend Production Config

Update `apps/frontend/src/environments/environment.prod.ts`:

```ts
export const environment = {
  apiUrl: 'https://api.example.com/api',
  realtimeUrl: 'https://realtime.example.com',
  maptilerKey: '...',
};
```

Build:

```bash
pnpm --filter @ruta-segura/frontend build
```

Docker build with public URLs:

```bash
docker build -f apps/frontend/Dockerfile \
  --build-arg API_URL=https://api.example.com/api \
  --build-arg REALTIME_URL=https://realtime.example.com \
  -t ruta-segura-frontend .
```

## Mobile Production Build

Pass the public API URL at build time:

```bash
flutter build appbundle --dart-define=API_BASE_URL=https://api.example.com/api
```

For iOS, use the same `--dart-define` in the release build/archive command.

## AI Image Moderation

Uploaded report photos, avatars and education images are checked before storage when image moderation is enabled.

```env
OPENAI_API_KEY=
IMAGE_MODERATION_ENABLED=true
IMAGE_MODERATION_REQUIRED=true
IMAGE_MODERATION_MODEL=omni-moderation-latest
IMAGE_MODERATION_SCORE_THRESHOLD=0.85
```

Default policy:

- Avatars and education images block sexual content, self-harm, violence and graphic violence.
- Report photos block sexual content, self-harm and graphic violence.
- Report photos do not block all non-graphic violence because traffic reports may legitimately include accident context.
- Keep a human review path for disputes and edge cases.

## Store And Legal Requirements

Before public release:

- Privacy policy URL available publicly and linked inside the app/store listing.
- Terms of use URL.
- Contact/support email.
- Data safety answers for Google Play.
- App privacy answers for App Store Connect.
- Location, camera/photos, notifications and social login disclosures.
- Demo account or demo mode for app review if private data is needed.

## Operational Readiness

- Assign moderators for reports and uploaded photos.
- Define duplicate/fake-report handling.
- Monitor AI image moderation rejections and recalibrate thresholds if needed.
- Verify emergency-mode copy does not imply that the app replaces official 911 dispatch.
- Enable managed DB backups.
- Configure uptime checks for backend `/api/health` and realtime `/health`.
- Configure log retention and alerting for 5xx errors.
- Seed only production-safe demo/default content.
