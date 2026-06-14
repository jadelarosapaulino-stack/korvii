FROM node:24.15.0-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate
COPY package.json pnpm-workspace.yaml ./
COPY apps/frontend/package.json apps/frontend/package.json
RUN pnpm install --filter @ruta-segura/frontend... --frozen-lockfile=false --config.dangerously-allow-all-builds=true
COPY . .
ARG API_URL=https://korvii-api-prod.up.railway.app/api
ARG REALTIME_URL=https://korvii-realtime-prod.up.railway.app
RUN API_URL="$API_URL" REALTIME_URL="$REALTIME_URL" node -e "const fs=require('fs'); const p='apps/frontend/src/environments/environment.prod.ts'; let s=fs.readFileSync(p,'utf8'); s=s.replace(/apiUrl: '[^']*'/, \"apiUrl: '\" + process.env.API_URL + \"'\").replace(/realtimeUrl: '[^']*'/, \"realtimeUrl: '\" + process.env.REALTIME_URL + \"'\"); fs.writeFileSync(p,s);"
RUN pnpm --filter @ruta-segura/frontend build --configuration production

FROM nginx:1.27-alpine AS runner
ENV API_UPSTREAM=https://korvii-api-prod.up.railway.app
ENV REALTIME_UPSTREAM=https://korvii-realtime-prod.up.railway.app
COPY --from=build /app/apps/frontend/dist/ruta-segura-frontend/browser /usr/share/nginx/html
COPY apps/frontend/nginx.conf.template /etc/nginx/templates/default.conf.template
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
