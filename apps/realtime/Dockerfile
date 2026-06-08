FROM node:24.15.0-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate
COPY package.json pnpm-workspace.yaml ./
COPY apps/realtime/package.json apps/realtime/package.json
RUN pnpm install --filter @ruta-segura/realtime... --frozen-lockfile=false

FROM deps AS build
COPY . .
RUN pnpm --filter @ruta-segura/realtime build

FROM node:24.15.0-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate
COPY --from=build /app/apps/realtime/dist ./dist
COPY --from=build /app/apps/realtime/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
EXPOSE 3001
CMD ["node", "dist/main.js"]
