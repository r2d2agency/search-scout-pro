# Lead Extractor - SERP + Evolution API

Sistema de extração de leads via SERP API com verificação de WhatsApp via Evolution API.

## 🚀 Deploy na Easypanel

### Pré-requisitos
- Docker instalado
- Easypanel configurado
- PostgreSQL no Easypanel

### Variáveis de Ambiente

Configure no Easypanel:

```env
# Banco de dados PostgreSQL
DATABASE_URL=postgresql://user:password@postgres:5432/leads_db

# URL do Frontend (opcional para CORS)
FRONTEND_URL=https://seu-dominio.com

# SERP API
SERP_API_KEY=sua_chave_serp

# Evolution API
EVOLUTION_API_URL=https://sua-evolution.com
EVOLUTION_API_KEY=sua_chave_evolution
EVOLUTION_INSTANCE=nome_instancia
```

### Dockerfile

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### nginx.conf

```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 📊 Estrutura do Banco

```sql
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company VARCHAR(255) NOT NULL,
    website VARCHAR(500),
    phone VARCHAR(50),
    whatsapp VARCHAR(50),
    email VARCHAR(255),
    whatsapp_valid BOOLEAN,
    source VARCHAR(100) DEFAULT 'Google',
    search_term VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_leads_search_term ON leads(search_term);
CREATE INDEX idx_leads_created_at ON leads(created_at);
```

## 🔧 Funcionalidades

- ✅ Pesquisa via SERP API
- ✅ Extração automática de dados (empresa, site, telefone, email)
- ✅ Verificação de WhatsApp via Evolution API
- ✅ Paginação infinita (30 resultados por página)
- ✅ Exportação para CSV
- ✅ Painel admin para configuração de chaves
- ✅ Tema escuro

## 📝 Próximos Passos

1. Criar backend Node.js/Express para API
2. Implementar conexão com PostgreSQL
3. Integrar SERP API real
4. Integrar Evolution API real
5. Deploy no Easypanel
