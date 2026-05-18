# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Visão Geral

KairosCRM é uma plataforma SaaS de gerenciamento de mensagens e automação com IA para WhatsApp (Evolution API) e Instagram (Meta Cloud API). O prompt completo de arquitetura está em `PROMPT/PROMPT.MD`.

## Stack Obrigatória

| Camada | Tecnologia |
|--------|-----------|
| Backend | Flask (Python) + Flask-SocketIO |
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| Banco de dados | PostgreSQL + SQLAlchemy ORM + Alembic migrations |
| Cache e filas | Redis + Celery (ou RQ) |
| Editor de fluxo | React Flow |
| Autenticação | JWT com refresh token |
| IA | Claude API — modelo `claude-sonnet-4-20250514` |
| Criptografia | Fernet (`cryptography` lib) para credentials de integrações |

## Comandos de Desenvolvimento

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Servidor de desenvolvimento
python run.py

# Migrations
alembic upgrade head
alembic revision --autogenerate -m "descrição"

# Worker Celery
celery -A app.extensions.celery worker --loglevel=info
```

### Frontend
```bash
cd frontend
npm install
npm run dev        # porta 3000
npm run build
npm run lint
npm run type-check
```

### Docker (ambiente local)
```bash
docker compose up -d     # sobe PostgreSQL + Redis
docker compose logs -f
```

## Estrutura do Projeto

```
kairos-crm/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── config.py
│   │   ├── extensions.py         # db, redis, socketio, celery
│   │   ├── models/
│   │   │   ├── user.py
│   │   │   ├── workspace.py
│   │   │   ├── contact.py
│   │   │   ├── conversation.py
│   │   │   ├── message.py
│   │   │   ├── agent.py
│   │   │   └── flow.py
│   │   ├── routes/
│   │   │   ├── auth.py
│   │   │   ├── conversations.py
│   │   │   ├── messages.py
│   │   │   ├── agents.py
│   │   │   ├── flows.py
│   │   │   ├── webhooks/
│   │   │   │   ├── instagram.py
│   │   │   │   └── whatsapp.py
│   │   │   └── settings.py
│   │   ├── services/
│   │   │   ├── instagram_service.py
│   │   │   ├── whatsapp_service.py
│   │   │   ├── ai_agent_service.py
│   │   │   ├── flow_engine.py
│   │   │   └── queue_service.py
│   │   └── tasks/
│   │       ├── process_message.py
│   │       └── ai_response.py
│   ├── migrations/
│   ├── requirements.txt
│   └── run.py
└── frontend/
    ├── app/
    │   ├── (auth)/
    │   │   ├── login/page.tsx
    │   │   └── register/page.tsx
    │   └── (dashboard)/
    │       ├── layout.tsx
    │       ├── conversations/
    │       │   ├── page.tsx              # lista unificada
    │       │   └── [id]/page.tsx         # chat individual
    │       ├── agents/
    │       │   ├── page.tsx              # lista de agentes
    │       │   └── [id]/editor/page.tsx  # editor drag and drop
    │       └── settings/page.tsx
    ├── components/
    │   ├── chat/
    │   │   ├── ConversationList.tsx
    │   │   ├── ChatWindow.tsx
    │   │   ├── MessageBubble.tsx
    │   │   └── MessageInput.tsx
    │   └── flow/
    │       ├── FlowEditor.tsx            # React Flow wrapper
    │       ├── FlowSidebar.tsx
    │       └── nodes/
    │           ├── TriggerNode.tsx
    │           ├── MessageNode.tsx
    │           ├── ConditionNode.tsx
    │           ├── AINode.tsx
    │           └── WebhookNode.tsx
    ├── hooks/
    │   ├── useSocket.ts
    │   ├── useConversations.ts
    │   └── useAgent.ts
    └── lib/
        ├── api.ts
        └── socket.ts
```

## Banco de Dados — Modelos

| Tabela | Campos principais |
|--------|-------------------|
| `users` | id, email, password_hash, name, created_at |
| `workspaces` | id, name, owner_id (FK users), plan, created_at |
| `workspace_members` | workspace_id, user_id, role |
| `integrations` | id, workspace_id, channel (`instagram\|whatsapp`), status (`active\|inactive`), credentials (JSON criptografado), meta (JSON) |
| `contacts` | id, workspace_id, channel, external_id (IGSID ou número WhatsApp), name, avatar_url, metadata (JSON), created_at |
| `conversations` | id, workspace_id, contact_id, channel, status (`open\|closed\|bot`), last_message_at, assigned_to (FK users), ai_enabled (bool), created_at |
| `messages` | id, conversation_id, direction (`inbound\|outbound`), content, content_type (`text\|image\|audio\|video\|template`), status (`sent\|delivered\|read\|failed`), external_id, created_at |
| `agents` | id, workspace_id, name, system_prompt, model, temperature, enabled (bool), channels (JSON array), created_at |
| `flows` | id, agent_id, name, trigger_type, trigger_config (JSON), nodes (JSON), edges (JSON), active (bool), created_at |

## Fluxo de Processamento de Mensagens

1. Webhook recebe mensagem → salva no banco → retorna 200 imediatamente
2. Enfileira task `process_message(message_id)` no Redis
3. Task verifica se `ai_enabled = true` e agente ativo para o canal
4. **Se sim:** monta histórico das últimas 20 mensagens → chama Claude API → salva resposta → envia via canal → salva mensagem outbound
5. **Se não:** emite evento via SocketIO para o frontend atualizar sem refetch

## Real-time (eventos SocketIO)

| Evento | Payload |
|--------|---------|
| `new_message` | `{ conversation_id, message }` |
| `conversation_updated` | `{ conversation_id, fields }` |
| `agent_response_sent` | `{ conversation_id, message }` |

O frontend escuta esses eventos e atualiza o estado local sem precisar fazer refetch.

## Integrações

### WhatsApp — Evolution API
- Base URL configurável por workspace (salva em `integrations.credentials`)
- Enviar texto: `POST /message/sendText/{instance}`
- Enviar mídia: `POST /message/sendMedia/{instance}`
- Webhook entrada em `POST /webhooks/whatsapp` — extrair número removendo `@s.whatsapp.net`

### Instagram — Meta Cloud API
- Base: `https://graph.facebook.com/v19.0/`
- Envio: `POST /{ig-user-id}/messages` com `Authorization: Bearer {page_access_token}`
- Verificação do webhook (`GET /webhooks/instagram`): validar `hub.verify_token` contra o token salvo no workspace e retornar `hub.challenge`
- Webhook entrada em `POST /webhooks/instagram`

## Editor de Fluxo (React Flow)

Nodes disponíveis no MVP:

| Node | Função |
|------|--------|
| `TriggerNode` | Gatilho: primeira mensagem, palavra-chave, horário |
| `MessageNode` | Enviar texto fixo |
| `ConditionNode` | if/else por conteúdo da mensagem ou tag do contato |
| `AINode` | Acionar agente com prompt customizado para o passo |
| `WebhookNode` | Chamar URL externa via POST com payload configurável |

O JSON de nodes e edges é salvo diretamente em `flows.nodes` e `flows.edges`. O `flow_engine.py` interpreta esse JSON em runtime quando o trigger é ativado. O editor tem: sidebar de nodes, panel de configuração ao clicar, auto-save com debounce de 2s, botão ativar/desativar.

## Telas do Frontend

- **`/conversations`** — Layout três colunas: filtros/canais | lista de conversas (ícone do canal, nome, última mensagem, timestamp, badge IA) | chat (scroll infinito, Enter para enviar, toggle de IA por conversa)
- **`/agents`** — Lista com toggle global, chips de canal (WhatsApp, Instagram), botão para abrir o editor
- **`/agents/[id]/editor`** — Tela cheia React Flow: sidebar esquerda (nodes), canvas central, panel direita (config do node), header com status e botão salvar

## Regras de Implementação

1. **Auth:** Toda rota (exceto `/webhooks/*` e `/auth/*`) exige `Authorization: Bearer {token}`.
2. **Multi-tenant:** Toda query filtra por `workspace_id`. Nunca retornar dados de outro workspace.
3. **Webhooks:** Responder 200 imediatamente; processar de forma assíncrona via fila.
4. **Credentials:** Armazenar criptografadas com Fernet no banco.
5. **Migrations:** Usar Alembic exclusivamente — nunca `ALTER TABLE` direto.
6. **Frontend:** Usar SWR para fetching com revalidação automática.
7. **Erros da API:** Sempre retornar `{ error: string, code: string }` com HTTP status adequado.
8. **Logs:** JSON estruturado no backend; nível configurável via `LOG_LEVEL` no `.env`.

## Variáveis de Ambiente

### Backend (`.env`)
```
DATABASE_URL=postgresql://user:pass@localhost/kairos_crm
REDIS_URL=redis://localhost:6379/0
ANTHROPIC_API_KEY=
SECRET_KEY=
EVOLUTION_API_URL=
EVOLUTION_API_KEY=
META_VERIFY_TOKEN=
LOG_LEVEL=INFO
```

### Frontend (`.env.local`)
```
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

## Ordem de Implementação (MVP)

1. Setup do projeto (estrutura de pastas, dependências, config)
2. Models e migrations do banco de dados
3. Autenticação JWT (register, login, refresh)
4. Webhook WhatsApp (receber, parsear, salvar)
5. Webhook Instagram (verificação + receber, parsear, salvar)
6. Serviço de envio WhatsApp via Evolution API
7. Serviço de envio Instagram via Graph API
8. Fila Redis + task de processamento de mensagem
9. Integração com Claude API no agente
10. Rotas REST de conversations e messages
11. Rotas REST de agents e flows
12. SocketIO real-time
13. Frontend: autenticação
14. Frontend: tela de conversations com chat
15. Frontend: tela de agents com toggles
16. Frontend: editor de fluxo com React Flow
17. Docker Compose para desenvolvimento local

> Comece pelo passo 1. Pergunte antes de implementar se tiver dúvida sobre alguma decisão de arquitetura — não assuma.

## Fluxo Git Obrigatório

Após cada push para um branch de feature/fix, **sempre** abra um Pull Request para `main` automaticamente usando as ferramentas GitHub MCP (`mcp__github__create_pull_request`). Faça isso sem precisar ser solicitado.
