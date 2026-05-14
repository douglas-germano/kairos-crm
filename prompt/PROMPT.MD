# KairosCRM — Prompt de arquitetura para o Claude Code — MVP v1.0

Você é um engenheiro sênior full-stack. Sua tarefa é construir o MVP do KairosCRM, uma plataforma SaaS de gerenciamento de mensagens e automação com IA para WhatsApp e Instagram.

---

## STACK OBRIGATÓRIA

- **Backend:** Flask (Python) com Flask-SocketIO para real-time
- **Frontend:** Next.js 14 (App Router) com TypeScript e Tailwind CSS
- **Banco de dados:** PostgreSQL com SQLAlchemy ORM e Alembic para migrations
- **Cache e filas:** Redis (cache de sessões, fila de mensagens com RQ ou Celery)
- **Editor de fluxo:** React Flow (drag and drop do agente autônomo)
- **Autenticação:** JWT com refresh token

---

## ARQUITETURA DO PROJETO

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
    │       ├── nodes/
    │       │   ├── TriggerNode.tsx
    │       │   ├── MessageNode.tsx
    │       │   ├── ConditionNode.tsx
    │       │   ├── AINode.tsx
    │       │   └── WebhookNode.tsx
    │       └── FlowSidebar.tsx
    ├── hooks/
    │   ├── useSocket.ts
    │   ├── useConversations.ts
    │   └── useAgent.ts
    └── lib/
        ├── api.ts
        └── socket.ts
```

---

## BANCO DE DADOS — MODELOS PRINCIPAIS

Crie as seguintes tabelas com SQLAlchemy:

**users:** id, email, password_hash, name, created_at

**workspaces:** id, name, owner_id (FK users), plan, created_at

**workspace_members:** workspace_id, user_id, role

**integrations:** id, workspace_id, channel (instagram|whatsapp), status (active|inactive), credentials (JSON criptografado), meta (JSON)

**contacts:** id, workspace_id, channel, external_id (Instagram user ID ou número WhatsApp), name, avatar_url, metadata (JSON), created_at

**conversations:** id, workspace_id, contact_id, channel, status (open|closed|bot), last_message_at, assigned_to (FK users), ai_enabled (bool), created_at

**messages:** id, conversation_id, direction (inbound|outbound), content, content_type (text|image|audio|video|template), status (sent|delivered|read|failed), external_id, created_at

**agents:** id, workspace_id, name, system_prompt, model (claude-sonnet-4-20250514), temperature, enabled (bool), channels (JSON array), created_at

**flows:** id, agent_id, name, trigger_type, trigger_config (JSON), nodes (JSON — React Flow nodes), edges (JSON — React Flow edges), active (bool), created_at

---

## INTEGRAÇÕES

### WhatsApp — Evolution API

Base URL configurável por workspace via variável de ambiente ou settings.
Endpoints que o backend precisa consumir:
- `POST /message/sendText/{instance}` — enviar mensagem de texto
- `POST /message/sendMedia/{instance}` — enviar mídia

Webhook recebido pelo backend em `POST /webhooks/whatsapp`:

```json
{
  "event": "messages.upsert",
  "instance": "nome-instancia",
  "data": {
    "key": { "remoteJid": "5565999999999@s.whatsapp.net", "fromMe": false, "id": "MSG_ID" },
    "message": { "conversation": "texto da mensagem" },
    "messageTimestamp": 1234567890,
    "pushName": "Nome do contato"
  }
}
```

Extraia o número do remoteJid removendo `@s.whatsapp.net`. Crie ou localize o contato pelo número. Crie ou localize a conversa. Salve a mensagem. Enfileire no Redis para processamento de IA se `ai_enabled = true` na conversa.

### Instagram — Meta Cloud API

Graph API base: `https://graph.facebook.com/v19.0/`
Endpoint de envio: `POST /{ig-user-id}/messages`
Headers: `Authorization: Bearer {page_access_token}`

Verificação do webhook (`GET /webhooks/instagram`):
- Validar `hub.verify_token` contra o token salvo no workspace
- Retornar `hub.challenge` se válido

Webhook recebido (`POST /webhooks/instagram`):

```json
{
  "object": "instagram",
  "entry": [{
    "id": "IG_USER_ID",
    "messaging": [{
      "sender": { "id": "SENDER_IGSID" },
      "recipient": { "id": "RECIPIENT_IGSID" },
      "timestamp": 1234567890,
      "message": { "mid": "MSG_ID", "text": "texto" }
    }]
  }]
}
```

---

## FILA DE PROCESSAMENTO (Redis + Celery ou RQ)

Fluxo de uma mensagem inbound:

1. Webhook recebe mensagem → salva no banco → retorna 200 imediatamente
2. Enfileira task `process_message(message_id)`
3. Task verifica se conversa tem `ai_enabled = true` e agente ativo para o canal
4. Se sim: monta histórico das últimas 20 mensagens → chama Claude API → salva resposta → envia via canal correspondente → salva mensagem outbound
5. Se não: apenas emite evento via SocketIO para o frontend atualizar

---

## AGENTE DE IA

- Modelo: `claude-sonnet-4-20250514`
- System prompt configurável por agente
- Contexto: histórico das últimas 20 mensagens da conversa
- Cada agente tem uma lista de canais ativos (`["whatsapp", "instagram"]` ou subset)
- O agente só responde se o canal da conversa estiver na lista e `ai_enabled = true`

Endpoints de controle:
- `PATCH /api/agents/{id}` — campos: `enabled`, `channels`
- `PATCH /api/conversations/{id}/ai` — campo: `ai_enabled`

---

## EDITOR DE FLUXO (React Flow)

O editor define automações visuais do agente. Nodes disponíveis no MVP:

- **TriggerNode:** gatilho (primeira mensagem, palavra-chave, horário)
- **MessageNode:** enviar mensagem de texto fixo
- **ConditionNode:** if/else baseado em conteúdo da mensagem ou tag do contato
- **AINode:** acionar resposta do agente com prompt customizado para esse passo
- **WebhookNode:** chamar URL externa via POST com payload configurável

O JSON de nodes e edges do React Flow é salvo diretamente nas colunas `flows.nodes` e `flows.edges`. O `flow_engine.py` interpreta esse JSON em runtime para processar a automação quando o trigger é ativado.

O editor deve ter:
- Sidebar com os tipos de node disponíveis (arrastar para o canvas)
- Panel de configuração ao clicar em um node
- Botão salvar (`PATCH /api/flows/{id}`)
- Botão ativar/desativar o fluxo
- Auto-save com debounce de 2 segundos

---

## FRONTEND — TELAS PRINCIPAIS

### /conversations
Layout de três colunas: lista de canais/filtros | lista de conversas | janela de chat. A lista mostra ícone do canal (Instagram ou WhatsApp), nome do contato, última mensagem, timestamp e badge de IA ativa. Chat com scroll infinito para cima, input com envio por Enter, toggle para ativar/desativar IA por conversa.

### /agents
Lista de agentes com nome, modelo, canais ativos e status. Toggle global de ativar/desativar. Chips por canal (WhatsApp, Instagram). Botão para abrir o editor de fluxo.

### /agents/[id]/editor
Tela cheia com React Flow. Sidebar esquerda com nodes, canvas central, panel direita com configuração do node selecionado. Header com nome do agente, status do fluxo e botão salvar.

---

## REAL-TIME (SocketIO)

Eventos emitidos pelo backend:

- `new_message`: `{ conversation_id, message }` — nova mensagem recebida
- `conversation_updated`: `{ conversation_id, fields }` — status, ai_enabled etc.
- `agent_response_sent`: `{ conversation_id, message }` — resposta da IA enviada

O frontend escuta esses eventos e atualiza o estado local sem precisar refetch.

---

## VARIÁVEIS DE AMBIENTE

**Backend (.env):**
```
DATABASE_URL=postgresql://user:pass@localhost/kairos_crm
REDIS_URL=redis://localhost:6379/0
ANTHROPIC_API_KEY=
SECRET_KEY=
EVOLUTION_API_URL=
EVOLUTION_API_KEY=
META_VERIFY_TOKEN=
```

**Frontend (.env.local):**
```
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

---

## REGRAS DE IMPLEMENTAÇÃO

1. Toda rota de API (exceto `/webhooks` e `/auth`) requer JWT válido no header `Authorization: Bearer {token}`
2. Multi-tenant: toda query filtra por `workspace_id`. Nunca retornar dados de outro workspace.
3. Webhooks respondem 200 imediatamente e processam de forma assíncrona via fila.
4. Credentials das integrações ficam no banco criptografadas com Fernet (`cryptography` lib).
5. Migrations com Alembic — nunca alterar tabela diretamente.
6. Frontend usa SWR para fetching de dados com revalidação automática.
7. Erros da API retornam sempre `{ error: string, code: string }` com HTTP status adequado.
8. Logs estruturados (JSON) no backend com nível de log configurável via ENV.

---

## ORDEM DE IMPLEMENTAÇÃO

Implemente nessa ordem exata:

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

---

Comece pelo passo 1. Pergunte se tiver dúvida sobre alguma decisão de arquitetura antes de implementar, não assuma.