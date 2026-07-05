# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Visão Geral

KairosCRM é uma plataforma SaaS de gerenciamento de mensagens e automação com IA para WhatsApp (Evolution API) e Instagram (Meta Cloud API). O prompt original de arquitetura (plano do MVP) está em `prompt/PROMPT.MD`; `prompt/design-system.md` documenta o design system do frontend. Este documento descreve o estado real do código, que já diverge em alguns pontos do plano original (ver "Divergências do plano original" abaixo).

## Stack Real

| Camada | Tecnologia |
|--------|-----------|
| Backend | Flask (Python) + Flask-SocketIO (`async_mode="gevent"`) |
| Fila de tasks | Redis + **RQ** (não Celery — ver divergências) |
| Frontend | Next.js 15 (App Router) + TypeScript + Tailwind, exportado estático e publicado no Cloudflare Pages via `@cloudflare/next-on-pages` |
| Banco de dados | PostgreSQL + SQLAlchemy ORM + Alembic migrations |
| Editor de fluxo | React Flow (`@xyflow/react`) |
| Autenticação | JWT (`flask-jwt-extended`) com access + refresh token |
| IA | Claude API (`anthropic` SDK) — modelo default `claude-sonnet-4-20250514` (`app/models/agent.py: CLAUDE_MODEL`), configurável por agente |
| Criptografia | Fernet, chave derivada de `SECRET_KEY` via SHA-256 (`Integration._fernet`) |
| Deploy backend | Railway (Docker + Gunicorn + worker gevent-websocket) |
| Deploy frontend | Cloudflare Pages (Wrangler) |

## Comandos de Desenvolvimento

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Servidor de desenvolvimento (porta 8080 por padrão; PORT sobrescreve)
python run.py

# Migrations
alembic upgrade head
alembic revision --autogenerate -m "descrição"

# Worker RQ — necessário para IA, flows e broadcasts funcionarem; sem ele
# webhooks só salvam a mensagem e nada mais acontece
rq worker default --url redis://localhost:6379/0
```
Não há suíte de testes automatizada no repositório no momento.

### Frontend
```bash
cd frontend
npm install
npm run dev          # porta 3000, aponta para NEXT_PUBLIC_API_URL (padrão :5001 em dev — ver frontend/lib/api.ts)
npm run build
npm run lint
npm run type-check    # tsc --noEmit
npm run build:cf      # build para Cloudflare Pages
npm run deploy        # build:cf + wrangler pages deploy
```

### Docker (ambiente local completo)
```bash
docker compose up -d     # PostgreSQL + Redis + backend (python run.py) + worker (rq worker)
docker compose logs -f
```

## Arquitetura

### App factory e extensões
`create_app()` (`backend/app/__init__.py`) monta config, CORS, logging JSON estruturado, inicializa `db`/`migrate`/`jwt`/`socketio`/`limiter`/Redis e registra todos os blueprints (`auth`, `conversations`, `messages`, `agents`, `flows`, `settings`, `integrations`, `contacts`, `broadcasts`, webhooks). SocketIO é inicializado com `message_queue=REDIS_URL` para poder emitir eventos a partir do worker RQ, que roda em processo separado do servidor web (`extensions.py`).

Em produção, `wsgi.py` faz `gevent.monkey.patch_all()` antes de qualquer outro import — obrigatório para o worker `GeventWebSocketWorker` do Gunicorn funcionar. `start.sh` roda `alembic upgrade head`, sobe um `rq worker` em background e então o Gunicorn, tudo no mesmo container Railway (não há worker Railway separado — só o Docker Compose local tem um serviço `worker` dedicado).

### Pipeline de mensagens (atravessa vários arquivos)
1. Webhook (`routes/webhooks/whatsapp.py` ou `instagram.py`) recebe o payload, normaliza contato/conversa/mensagem, salva no banco e responde 200 imediatamente.
2. Emite `new_message` via SocketIO na room `workspace_{workspace_id}`.
3. Enfileira `app.tasks.process_message.run(message_id)` no RQ — só para mensagens inbound reais; ecos `fromMe=True` do WhatsApp são salvas mas não reenfileiradas.
4. `tasks/process_message.py` roda no worker: recria o app Flask (`create_app()` + `app_context()`, pois o worker é um processo à parte sem contexto de request) e primeiro checa se algum `Flow` ativo do agente do canal dispara para essa mensagem (`FlowEngine.should_trigger`). Se sim, roda o flow inteiro (`FlowEngine.run`) e **não** chama a IA direta. Só se nenhum flow disparar e `conversation.ai_enabled = True` é que chama `ai_agent_service.generate_reply` diretamente.
5. Tanto o flow (`AINode`/`MessageNode`) quanto a IA direta enviam a resposta pelo canal certo (`whatsapp_service`/`instagram_service`), salvam a mensagem outbound e emitem `agent_response_sent`.

Flow ativo e IA direta são **mutuamente exclusivos** por mensagem — um flow disparado "engole" a resposta automática do agente.

### Flow Engine (`services/flow_engine.py`)
Interpreta o JSON de `flows.nodes`/`flows.edges` produzido pelo editor React Flow: acha o `TriggerNode` e percorre as arestas. Suporta `MessageNode`, `ConditionNode` (contains/equals/starts_with sobre a última mensagem), `AINode` (pode sobrescrever temporariamente o `system_prompt` do agente só para aquele passo) e `WebhookNode`. Tem detecção de ciclo (`_visited`) para não recursar infinitamente em grafos malformados, e bloqueio de SSRF (`_is_safe_url`) que resolve o hostname e rejeita ranges privados/loopback/link-local antes de deixar o `WebhookNode` chamar uma URL — é a única barreira contra o usuário configurar um webhook apontando para a rede interna, não remover ao mexer nesse código.

### Multi-tenant e autorização
Toda tabela relevante tem `workspace_id`; toda query de rota deve filtrar por ele — nunca confiar em IDs vindos do payload sem checar o workspace do usuário autenticado. O mesmo vale para SocketIO: `sockets.py` decodifica o JWT manualmente (`decode_token`) no evento `join_workspace` e confirma que existe um `WorkspaceMember` para aquele `user_id`/`workspace_id` antes de dar `join_room` — sem essa checagem, qualquer cliente poderia entrar na room de outro workspace e receber mensagens de terceiros.

### Credenciais de integração
`Integration._credentials` guarda um blob criptografado com Fernet; a chave é derivada de `SECRET_KEY` (SHA-256 → base64), não é uma chave Fernet separada — trocar `SECRET_KEY` em produção invalida todas as credenciais salvas. Sempre usar `set_credentials`/`get_credentials`, nunca ler `_credentials` diretamente.

### Identidade de contato no WhatsApp (`services/whatsapp_identity.py`)
A Evolution API pode reportar o mesmo contato com JIDs diferentes (`remoteJid` vs `senderPn`, com/sem `@s.whatsapp.net`, LID vs número de telefone). `canonical_external_id`/`lookup_external_ids`/`remember_contact_identity` existem para não duplicar `Contact`s quando isso acontece — ao mexer no parsing do webhook do WhatsApp, usar sempre essas funções em vez de comparar `remoteJid` cru.

### Autenticação no frontend (`frontend/lib/api.ts`, `lib/auth.ts`)
`apiFetch` injeta o access token em todo request e, num 401, chama `/auth/refresh` uma única vez (`_refreshPromise` deduplica chamadas concorrentes) antes de tentar de novo com `retry=false` — não adicionar retries extras aqui. Tokens vão para `localStorage` ou `sessionStorage` dependendo da opção "lembrar-me" (`setTokens(..., remember)`).

### Real-time no frontend (`hooks/useSocket.ts`, `lib/socket.ts`)
O cliente chama `join_workspace` passando o JWT (não cookie de sessão) para o backend validar; eventos ouvidos são `new_message`, `conversation_updated`, `agent_response_sent` — mesmos nomes emitidos pelo backend.

## Modelos principais (`backend/app/models/`)
`users`, `workspaces`/`workspace_members`, `integrations` (channel `instagram|whatsapp`, credentials Fernet, `meta` JSON com `health` de webhook), `contacts`, `conversations` (`ai_enabled`, `assigned_to`, `synced_at`), `messages` (`direction`, `content_type` incluindo `sticker`/`caption`, `status`), `agents` (`channels` JSON, `model`, `temperature`), `flows` (`nodes`/`edges` JSON, pertence a um `agent`), `broadcasts`/`broadcast_recipients`. Migrations vivem em `backend/migrations/versions` — sempre gerar via `alembic revision --autogenerate`, nunca editar schema manualmente.

## Divergências do plano original (`prompt/PROMPT.MD`)
- Fila de tasks é **RQ**, não Celery (`extensions.rq_queue`, `services/queue_service.py`, `tasks/*.run`).
- Módulos extras não previstos no plano original: `contacts`, `integrations`, `broadcasts` (envio em massa) e `whatsapp_identity`.
- Frontend não roda como servidor Node: é exportado estático e publicado no Cloudflare Pages (`wrangler.toml`, `npm run deploy`); o backend roda no Railway (URL hardcoded como fallback de produção em `frontend/lib/api.ts`).
- Autenticação usa `flask-jwt-extended` puro.

## Regras de Implementação
1. **Auth:** toda rota (exceto `/webhooks/*` e `/auth/*`) exige `Authorization: Bearer {token}`.
2. **Multi-tenant:** toda query filtra por `workspace_id`. Nunca retornar dados de outro workspace.
3. **Webhooks:** responder 200 imediatamente; processamento pesado sempre via RQ.
4. **Credentials:** sempre criptografadas com Fernet (`Integration.set_credentials`/`get_credentials`), nunca em texto plano no banco ou em logs.
5. **Migrations:** usar Alembic exclusivamente — nunca `ALTER TABLE` direto.
6. **Frontend:** usar SWR para fetching com revalidação automática (`swrFetcher` em `lib/api.ts`).
7. **Erros da API:** sempre retornar `{ error: string, code: string }` com HTTP status adequado.
8. **Logs:** JSON estruturado no backend (`python-json-logger`); nível configurável via `LOG_LEVEL`.
9. **WebhookNode do flow engine:** nunca remover a checagem de SSRF (`_is_safe_url`) em `flow_engine.py`.

## Variáveis de Ambiente

### Backend (`backend/.env`, ver `backend/.env.example`)
```
DATABASE_URL=
REDIS_URL=
SECRET_KEY=          # também deriva a chave Fernet — não trocar em produção sem migrar credenciais
JWT_SECRET_KEY=
ANTHROPIC_API_KEY=
EVOLUTION_API_URL=
EVOLUTION_API_KEY=
META_APP_ID=
META_APP_SECRET=
META_VERIFY_TOKEN=
APP_BASE_URL=
WEBHOOK_SECRET=      # valida ?token= no webhook do WhatsApp
LOG_LEVEL=INFO
FLASK_ENV=development
ALLOWED_ORIGINS=*    # CSV em produção
```

### Frontend (`frontend/.env.local`, ver `frontend/.env.local.example`)
```
NEXT_PUBLIC_API_URL=http://localhost:5001
NEXT_PUBLIC_SOCKET_URL=http://localhost:5001
```

## Fluxo Git Obrigatório

Após cada push para um branch de feature/fix, **sempre** abra um Pull Request para `main` automaticamente usando as ferramentas GitHub MCP (`mcp__github__create_pull_request`). Faça isso sem precisar ser solicitado.
