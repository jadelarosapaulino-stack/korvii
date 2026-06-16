FROM node:24.15.0-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate
COPY package.json pnpm-workspace.yaml ./
COPY apps/backend/package.json apps/backend/package.json
RUN pnpm install --filter @ruta-segura/backend... --frozen-lockfile=false

FROM deps AS build
COPY . .
RUN pnpm --filter @ruta-segura/backend build

FROM node:24.15.0-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate
COPY --from=build /app/apps/backend/dist ./dist
COPY --from=build /app/apps/backend/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/uploads ./uploads
COPY --from=build /app/apps/backend/uploads ./uploads
COPY --from=build /app/apps/backend/scripts ./scripts
RUN node scripts/check-uploads.js
EXPOSE 3000
CMD ["node", "dist/main.js"]
