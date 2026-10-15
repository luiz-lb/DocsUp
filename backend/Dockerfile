# Backend DocsUp (Node + Express). Só dependências de produção; roda como usuário não-root.
# Debian (glibc) porque o bcrypt usa binário nativo pré-compilado para linux-x64.
FROM node:24-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

# Pasta de uploads (montada como volume): precisa pertencer ao usuário que roda o Node
RUN mkdir -p /app/uploads && chown node:node /app/uploads

USER node
EXPOSE 3000
CMD ["node", "server.js"]
