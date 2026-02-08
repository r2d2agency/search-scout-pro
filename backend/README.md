# Lead Extractor API - Backend

API Node.js/Express para o sistema Lead Extractor com autenticação JWT e PostgreSQL.

## 🚀 Deploy no Easypanel

### 1. Criar Serviço no Easypanel

1. Acesse seu Easypanel
2. Crie um novo projeto ou use um existente
3. Adicione um serviço **App** (Node.js)
4. Configure o source como **Git** ou faça upload do código

### 2. Configurar PostgreSQL

1. No mesmo projeto, adicione um serviço **PostgreSQL**
2. Anote as credenciais geradas
3. Execute o schema SQL:
   ```bash
   psql -U user -d leads_db -f database/schema.sql
   ```

### 3. Variáveis de Ambiente

Configure no Easypanel:

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `DATABASE_URL` | URL de conexão PostgreSQL | `postgresql://user:pass@postgres:5432/leads_db` |
| `JWT_SECRET` | Chave secreta para tokens JWT | `sua-chave-secreta-muito-segura` |
| `FRONTEND_URL` | URL do frontend (CORS) | `https://app.seudominio.com` |
| `PORT` | Porta da API | `3000` |
| `NODE_ENV` | Ambiente | `production` |

### 4. Configurar Domínio

1. Configure um domínio/subdomínio para a API (ex: `api.seudominio.com`)
2. Ative HTTPS no Easypanel

## 📡 Endpoints da API

### Autenticação
- `POST /api/auth/register` - Criar conta
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Usuário atual

### Usuários (Admin)
- `GET /api/users` - Listar usuários
- `PUT /api/users/:id` - Atualizar usuário
- `DELETE /api/users/:id` - Remover usuário
- `GET /api/users/:id/usage` - Uso do usuário

### Planos
- `GET /api/plans` - Listar planos
- `POST /api/plans` - Criar plano (Admin)
- `PUT /api/plans/:id` - Atualizar plano (Admin)
- `DELETE /api/plans/:id` - Remover plano (Admin)

### Leads
- `GET /api/leads` - Listar leads do usuário
- `POST /api/leads` - Salvar lead
- `POST /api/leads/bulk` - Salvar múltiplos leads
- `DELETE /api/leads/:id` - Remover lead
- `POST /api/leads/check-limit` - Verificar limite

### Configurações (Admin)
- `GET /api/settings` - Obter configurações
- `PUT /api/settings` - Salvar configurações
- `GET /api/settings/brand` - Obter marca
- `PUT /api/settings/brand` - Salvar marca

### Health Check
- `GET /api/health` - Status da API

## 🔒 Segurança

- Senhas criptografadas com bcrypt
- Tokens JWT com expiração de 7 dias
- Rate limiting (100 req/15min por IP)
- Helmet para headers de segurança
- CORS configurável

## 💻 Desenvolvimento Local

```bash
cd backend
npm install
cp .env.example .env
# Configure as variáveis no .env
npm run dev
```
