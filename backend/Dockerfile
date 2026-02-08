# Dockerfile para Backend Node.js - Easypanel
FROM node:20-alpine

WORKDIR /app

# Copiar package.json e instalar dependências
COPY package.json ./
RUN npm install --omit=dev

# Copiar código fonte
COPY src ./src

# Expor porta
EXPOSE 3000

# Variáveis de ambiente padrão
ENV NODE_ENV=production
ENV PORT=3000

# Comando para iniciar
CMD ["node", "src/index.js"]
