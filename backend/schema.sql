-- =====================================================
-- SCHEMA PARA EASYPANEL + PostgreSQL
-- Sistema Multi-usuário com Planos
-- =====================================================

-- Extensão para UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABELA: users (usuários)
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('superadmin', 'admin', 'user')),
    plan_id VARCHAR(50) DEFAULT 'free',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_plan_id ON users(plan_id);
CREATE INDEX IF NOT EXISTS idx_users_created_by ON users(created_by);

-- =====================================================
-- TABELA: plans (planos de assinatura)
-- =====================================================
CREATE TABLE IF NOT EXISTS plans (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    monthly_searches INT DEFAULT 10,
    monthly_leads INT DEFAULT 50,
    whatsapp_verifications INT DEFAULT 20,
    price DECIMAL(10,2) DEFAULT 0,
    features JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Inserir planos padrão (apenas se não existirem)
INSERT INTO plans (id, name, description, monthly_searches, monthly_leads, whatsapp_verifications, price, features) VALUES
('free', 'Gratuito', 'Para começar a explorar', 10, 50, 20, 0, '["10 pesquisas/mês", "50 leads/mês", "20 verificações WhatsApp"]'),
('pro', 'Profissional', 'Para profissionais de vendas', 100, 500, 300, 97, '["100 pesquisas/mês", "500 leads/mês", "300 verificações WhatsApp", "Suporte prioritário"]'),
('enterprise', 'Empresarial', 'Para equipes e empresas', 1000, 5000, 3000, 297, '["1000 pesquisas/mês", "5000 leads/mês", "3000 verificações WhatsApp", "API access", "Suporte 24/7"]')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- TABELA: user_usage (uso mensal por usuário)
-- =====================================================
CREATE TABLE IF NOT EXISTS user_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month VARCHAR(7) NOT NULL, -- Formato: YYYY-MM
    searches_used INT DEFAULT 0,
    leads_extracted INT DEFAULT 0,
    whatsapp_verified INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, month)
);

CREATE INDEX IF NOT EXISTS idx_user_usage_user_month ON user_usage(user_id, month);

-- =====================================================
-- TABELA: leads
-- =====================================================
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    company VARCHAR(255) NOT NULL,
    website VARCHAR(500),
    phone VARCHAR(50),
    whatsapp VARCHAR(50),
    email VARCHAR(255),
    whatsapp_valid BOOLEAN,
    source VARCHAR(100) DEFAULT 'Google',
    search_term VARCHAR(255),
    bio TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_search_term ON leads(search_term);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);

-- =====================================================
-- TABELA: settings (configurações do sistema)
-- =====================================================
CREATE TABLE IF NOT EXISTS settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Inserir configurações padrão
INSERT INTO settings (key, value) VALUES
('evolution_api_url', ''),
('evolution_api_key', ''),
('evolution_instance', ''),
('cnpj_api_token', '')
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- TABELA: serp_api_keys (múltiplas chaves SERP API)
-- =====================================================
CREATE TABLE IF NOT EXISTS serp_api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    api_key VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    usage_count INT DEFAULT 0,
    monthly_limit INT DEFAULT 100,
    last_used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_serp_api_keys_active ON serp_api_keys(is_active);

-- =====================================================
-- TABELA: apify_api_keys (chaves Apify para Instagram)
-- =====================================================
CREATE TABLE IF NOT EXISTS apify_api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    api_key VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    usage_count INT DEFAULT 0,
    monthly_limit INT DEFAULT 100,
    last_used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_apify_api_keys_active ON apify_api_keys(is_active);

-- =====================================================
-- TABELA: firecrawl_api_keys (chaves Firecrawl para Instagram)
-- =====================================================
CREATE TABLE IF NOT EXISTS firecrawl_api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    api_key VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    usage_count INT DEFAULT 0,
    monthly_limit INT DEFAULT 500,
    last_used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_firecrawl_api_keys_active ON firecrawl_api_keys(is_active);

-- =====================================================
-- TABELA: user_api_keys (chaves de API por usuário)
-- =====================================================
CREATE TABLE IF NOT EXISTS user_api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_type VARCHAR(50) NOT NULL, -- 'apify', 'serp', etc.
    api_key VARCHAR(500) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, key_type)
);

CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_type ON user_api_keys(user_id, key_type);

-- =====================================================
-- TABELA: sessions (sessões de autenticação)
-- =====================================================
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

-- =====================================================
-- FUNÇÕES AUXILIARES
-- =====================================================

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at (criar apenas se não existir)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_users_updated_at') THEN
        CREATE TRIGGER update_users_updated_at 
            BEFORE UPDATE ON users 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_usage_updated_at') THEN
        CREATE TRIGGER update_user_usage_updated_at 
            BEFORE UPDATE ON user_usage 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END;
$$;

-- =====================================================
-- FUNÇÃO: Verificar limite de uso
-- =====================================================
CREATE OR REPLACE FUNCTION check_user_limit(
    p_user_id UUID,
    p_type VARCHAR(20), -- 'search', 'leads', 'whatsapp'
    p_count INT DEFAULT 1
) RETURNS BOOLEAN AS $$
DECLARE
    v_plan_id VARCHAR(50);
    v_limit INT;
    v_used INT;
    v_month VARCHAR(7);
BEGIN
    v_month := TO_CHAR(NOW(), 'YYYY-MM');
    
    -- Buscar plano do usuário
    SELECT plan_id INTO v_plan_id FROM users WHERE id = p_user_id;
    
    -- Buscar limite do plano
    IF p_type = 'search' THEN
        SELECT monthly_searches INTO v_limit FROM plans WHERE id = v_plan_id;
        SELECT COALESCE(searches_used, 0) INTO v_used 
        FROM user_usage WHERE user_id = p_user_id AND month = v_month;
    ELSIF p_type = 'leads' THEN
        SELECT monthly_leads INTO v_limit FROM plans WHERE id = v_plan_id;
        SELECT COALESCE(leads_extracted, 0) INTO v_used 
        FROM user_usage WHERE user_id = p_user_id AND month = v_month;
    ELSIF p_type = 'whatsapp' THEN
        SELECT whatsapp_verifications INTO v_limit FROM plans WHERE id = v_plan_id;
        SELECT COALESCE(whatsapp_verified, 0) INTO v_used 
        FROM user_usage WHERE user_id = p_user_id AND month = v_month;
    END IF;
    
    RETURN (v_used + p_count) <= v_limit;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNÇÃO: Incrementar uso
-- =====================================================
CREATE OR REPLACE FUNCTION increment_usage(
    p_user_id UUID,
    p_type VARCHAR(20),
    p_count INT DEFAULT 1
) RETURNS VOID AS $$
DECLARE
    v_month VARCHAR(7);
BEGIN
    v_month := TO_CHAR(NOW(), 'YYYY-MM');
    
    -- Inserir ou atualizar uso
    INSERT INTO user_usage (user_id, month, searches_used, leads_extracted, whatsapp_verified)
    VALUES (p_user_id, v_month, 0, 0, 0)
    ON CONFLICT (user_id, month) DO NOTHING;
    
    IF p_type = 'search' THEN
        UPDATE user_usage 
        SET searches_used = searches_used + p_count 
        WHERE user_id = p_user_id AND month = v_month;
    ELSIF p_type = 'leads' THEN
        UPDATE user_usage 
        SET leads_extracted = leads_extracted + p_count 
        WHERE user_id = p_user_id AND month = v_month;
    ELSIF p_type = 'whatsapp' THEN
        UPDATE user_usage 
        SET whatsapp_verified = whatsapp_verified + p_count 
        WHERE user_id = p_user_id AND month = v_month;
    END IF;
END;
$$ LANGUAGE plpgsql;
