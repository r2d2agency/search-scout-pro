# Documentação Técnica - Search Scout Pro (InstaLead Scout)

## 1. Visão Geral

O **Search Scout Pro** é uma plataforma completa de geração de leads (Lead Generation) focada na extração e enriquecimento de contatos a partir do Instagram. O sistema é composto por três módulos principais que operam de forma integrada:

1.  **Frontend Web (Dashboard)**: Painel administrativo para gestão de leads, usuários e planos.
2.  **Backend (API)**: Servidor Node.js que centraliza a lógica de negócios, banco de dados e integrações.
3.  **Extensão de Navegador (InstaLead Scout)**: Ferramenta "client-side" que opera diretamente no navegador do usuário para extrair dados do Instagram de forma segura e eficiente.

---

## 2. Módulos do Sistema

### 2.1 Extensão (InstaLead Scout)

A extensão é a ponta de lança da coleta de dados. Ela permite que o usuário navegue pelo Instagram (Busca, Seguidores, Hashtags) e extraia informações de perfis automaticamente.

**Principais Funcionalidades:**
*   **Extração Automática**: Coleta Nome, Bio, Link Externo e Telefones (WhatsApp) diretamente dos perfis.
*   **Barra de Progresso Moderna**: Feedback visual em tempo real sobre o status da extração (ex: "15/50 leads extraídos").
*   **Sistema Anti-Bloqueio**:
    *   *Safety Delay*: Intervalos aleatórios configuráveis entre cada extração para simular comportamento humano.
    *   *Limites de Sessão*: Pausas automáticas após certo número de requisições.
*   **Deduplicação Inteligente**:
    *   *Cache Local*: Impede que o mesmo perfil seja visitado duas vezes na mesma sessão.
    *   *Verificação no Backend*: Antes de salvar, o sistema verifica se aquele contato (telefone ou username) já existe na base do usuário, evitando cobrança de créditos duplicada.
*   **Integração com Planos**: A extensão verifica o plano do usuário antes de iniciar. Usuários do plano "Free" (sem permissão) são bloqueados.

**Arquitetura da Extensão:**
*   `manifest.json`: Configuração da extensão (Manifest V3).
*   `popup.html/js`: Interface do usuário (Configuração de Email, Start/Stop, Progresso).
*   `content.js`: Script injetado na página do Instagram que realiza a leitura do DOM e comunicação com o Backend.

### 2.2 Backend (API)

O cérebro do sistema, construído em **Node.js** com **Express** e banco de dados **PostgreSQL**.

**Funcionalidades Chave:**
*   **Gestão de Leads (`/api/leads`)**: Recebe os dados da extensão, valida duplicidade e salva no banco.
*   **Controle de Acesso (`/api/auth`)**: Sistema de login e registro com JWT.
*   **Limites e Cotas**:
    *   Monitora o uso mensal de cada usuário (pesquisas, leads extraídos).
    *   Bloqueia ações caso o usuário exceda o limite do seu plano (Free, Pro, Enterprise).
*   **Deploy Automatizado**: Script configurado para rodar migrações de banco (`init-db.js`) automaticamente a cada reinicialização (`npm start`).

### 2.3 Frontend Web

Interface desenvolvida em **React (Vite)** com componentes **Shadcn/UI**.

*   **Dashboard**: Visualização gráfica de leads e estatísticas.
*   **Tabela de Leads**: Listagem, filtro e exportação dos contatos extraídos.
*   **Gestão de Assinaturas**: Upgrade de planos e visualização de consumo.

---

## 3. Fluxo de Uso (Workflow)

1.  **Configuração**:
    *   O usuário instala a extensão no Chrome/Opera/Edge.
    *   No Popup da extensão, insere o **Email** da sua conta no sistema Web.
    *   Define os parâmetros de segurança (ex: Delay de 5s).

2.  **Operação**:
    *   O usuário navega até uma página de interesse no Instagram (ex: Lista de seguidores de um concorrente ou pesquisa por "Nutricionista").
    *   Clica em **"Iniciar Extração"**.
    *   A extensão percorre os perfis, extrai os dados e envia para o Backend.

3.  **Processamento**:
    *   O Backend recebe o dado.
    *   Verifica: *O usuário tem saldo? O lead já existe?*
    *   Se aprovado: Salva no PostgreSQL e desconta 1 crédito.
    *   Se duplicado: Ignora e não desconta crédito.

4.  **Resultado**:
    *   O lead aparece instantaneamente no Dashboard Web do usuário.
    *   O usuário pode exportar para CSV ou integrar com CRM.

---

## 4. Tecnologias Utilizadas

*   **Frontend**: React, TypeScript, Tailwind CSS, Shadcn/UI, Vite.
*   **Backend**: Node.js, Express, PostgreSQL (pg), JWT.
*   **Extensão**: JavaScript (ES6+), HTML5, CSS3 (Variables), Chrome Extension API.
*   **Infraestrutura**: Docker (opcional), Suporte a EasyPanel/Heroku.

## 5. Comandos Úteis

*   **Iniciar Backend**: `cd backend && npm start` (Roda migrações + servidor)
*   **Iniciar Frontend**: `npm run dev`
*   **Instalar Dependências**: `npm install` (na raiz e no backend)
