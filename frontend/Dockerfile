# Frontend DocsUp: build de produção do Vite servido por nginx (fallback de SPA para o React Router).
# As variáveis VITE_* são embutidas no bundle durante o build: mudou a URL do backend, refaça o build.

FROM node:24-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_URL_BACKEND
RUN test -n "$VITE_URL_BACKEND" || (echo "Build arg VITE_URL_BACKEND é obrigatório." >&2 && exit 1)
ENV VITE_URL_BACKEND=$VITE_URL_BACKEND
RUN npm run build

FROM nginx:1.30-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
