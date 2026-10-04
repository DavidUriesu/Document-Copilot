FROM node:24-alpine AS build

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@12.4.2 --activate

COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

COPY . .

ARG VITE_API_BASE_URL
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

RUN test -n "$VITE_API_BASE_URL" \
    && test -n "$VITE_SUPABASE_URL" \
    && test -n "$VITE_SUPABASE_ANON_KEY" \
    && pnpm build

FROM nginx:1.29-alpine

ENV PORT=8080 \
    NGINX_ENVSUBST_FILTER=PORT

COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
