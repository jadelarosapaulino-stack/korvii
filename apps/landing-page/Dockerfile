FROM node:24.15.0-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate
COPY package.json pnpm-workspace.yaml ./
COPY apps/landing-page/package.json apps/landing-page/package.json
RUN pnpm install --filter @ruta-segura/landing-page... --frozen-lockfile=false --config.dangerously-allow-all-builds=true
COPY . .
ARG LANDING_SYSTEM_URL=
RUN printf "export const LANDING_SYSTEM_URL = '%s';\n" "$LANDING_SYSTEM_URL" > apps/landing-page/src/app/landing-env.ts
RUN pnpm --filter @ruta-segura/landing-page build --configuration production

FROM nginx:1.27-alpine AS runner
ENV PORT=80
COPY --from=build /app/apps/landing-page/dist/ruta-segura-landing-page/browser /usr/share/nginx/html
COPY apps/landing-page/nginx.conf.template /etc/nginx/templates/default.conf.template
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
