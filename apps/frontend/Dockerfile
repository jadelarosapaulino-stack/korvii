FROM node:24.15.0-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate
COPY package.json pnpm-workspace.yaml ./
COPY apps/frontend/package.json apps/frontend/package.json
RUN pnpm install --filter @ruta-segura/frontend... --frozen-lockfile=false --config.dangerously-allow-all-builds=true
COPY . .
ARG NG_APP_API_URL
ARG NG_APP_REALTIME_URL
ARG NG_APP_MAPTILER_KEY=
RUN pnpm --filter @ruta-segura/frontend build --configuration production

FROM nginx:1.27-alpine AS runner
ENV PORT=80
ENV API_UPSTREAM=http://@ruta-segura/backend.railway.internal:3000
ENV REALTIME_UPSTREAM=http://@ruta-segura/realtime.railway.internal:3001
COPY --from=build /app/apps/frontend/dist/ruta-segura-frontend/browser /usr/share/nginx/html
COPY apps/frontend/nginx.conf.template /etc/nginx/templates/default.conf.template
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
