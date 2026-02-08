# Dockerfile para Backend Node.js - Easypanel
FROM node:20-alpine

WORKDIR /app

# Copiar package.json e instalar dependências
COPY package.json ./
RUN npm install --omit=dev

# Copiar schema SQL e código fonte
COPY schema.sql ./
COPY src ./src

# Expor porta
EXPOSE 3000

# Variáveis de ambiente padrão
ENV NODE_ENV=production
ENV PORT=3000

# Script de inicialização: init DB + start server
CMD ["sh", "-c", "node src/init-db.js && node src/index.js"]
