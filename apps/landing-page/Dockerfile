FROM node:24.15.0-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate
COPY package.json ./
RUN pnpm install --frozen-lockfile=false --config.dangerously-allow-all-builds=true
COPY . .
RUN pnpm build --configuration production

FROM nginx:1.27-alpine AS runner
ENV PORT=80
COPY --from=build /app/dist/ruta-segura-landing-page/browser /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
