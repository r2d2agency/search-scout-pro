# Lead Extractor - SERP + Evolution API

Sistema de extração de leads via SERP API com verificação de WhatsApp via Evolution API.
**Sistema Multi-usuário com Planos de Assinatura.**

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

# JWT Secret para autenticação
JWT_SECRET=sua_chave_secreta_jwt
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

Execute o arquivo `database/schema.sql` para criar todas as tabelas:

```bash
psql -U user -d leads_db -f database/schema.sql
```

### Tabelas Principais:
- **users**: Usuários do sistema com roles (admin/user)
- **plans**: Planos de assinatura com limites
- **user_usage**: Controle de uso mensal por usuário
- **leads**: Leads extraídos
- **settings**: Configurações do sistema
- **sessions**: Sessões de autenticação

## 🔧 Funcionalidades

### Sistema Base
- ✅ Pesquisa via SERP API
- ✅ Extração automática de dados (empresa, site, telefone, email)
- ✅ Verificação de WhatsApp via Evolution API
- ✅ Paginação infinita (30 resultados por página)
- ✅ Exportação para CSV
- ✅ Tema escuro

### Multi-usuário
- ✅ Autenticação (login/registro)
- ✅ Roles de usuário (admin/user)
- ✅ CRUD de planos de assinatura
- ✅ Gerenciamento de usuários (admin)
- ✅ Controle de limites por plano
- ✅ Rastreamento de uso mensal

### Planos Padrão
| Plano | Pesquisas | Leads | WhatsApp | Preço |
|-------|-----------|-------|----------|-------|
| Gratuito | 10/mês | 50/mês | 20/mês | R$ 0 |
| Profissional | 100/mês | 500/mês | 300/mês | R$ 97 |
| Empresarial | 1000/mês | 5000/mês | 3000/mês | R$ 297 |

## 📝 Próximos Passos

1. ✅ Sistema multi-usuário com planos
2. Criar backend Node.js/Express para API
3. Implementar conexão com PostgreSQL
4. Integrar SERP API real
5. Integrar Evolution API real
6. Integrar sistema de pagamentos (Stripe/PagSeguro)
7. Deploy no Easypanel
