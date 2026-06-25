# Plano de implementação

Mudança grande em 5 frentes. Vou implementar em uma sequência segura (banco primeiro, depois código).

## 1. Multi-workspace (mudança estrutural mais profunda)

Hoje todo dado é escopado por `owner_id = auth.uid()`. Vou migrar para `workspace_id` + tabela de membros, mantendo compatibilidade.

**Novas tabelas**
- `workspaces` — id, name, slug, created_by, created_at
- `workspace_members` — workspace_id, user_id, role (`owner` | `admin` | `member`), created_at
- `workspace_invites` — workspace_id, email, role, token, expires_at, accepted_at

**Mudanças nas tabelas existentes**
- Adicionar `workspace_id uuid` em `agents`, `agent_documents`, `document_chunks`, `conversations`, `messages`, `executions`.
- Backfill: criar 1 workspace "Pessoal" por usuário existente, popular `workspace_id` em todos os registros.
- Substituir políticas RLS de `owner_id = auth.uid()` por `is_workspace_member(workspace_id, auth.uid())` (função SECURITY DEFINER, evita recursão).
- Manter coluna `owner_id` (quem criou) para auditoria, mas não usar mais para autorização.

**UI**
- Workspace switcher no topo do app-shell (dropdown com workspaces + "criar novo" + "convites pendentes").
- Página `/app/team` — lista de membros, convidar por e-mail, mudar papel, remover.
- Página `/app/invite/$token` — aceitar convite (público, valida token).
- Contexto React `WorkspaceProvider` que mantém `currentWorkspaceId` em localStorage e injeta em todas as queries.

## 2. Cloudflare Turnstile no login e forgot-password

- Pedir ao usuário as duas keys (`TURNSTILE_SITE_KEY` publishable em `.env`, `TURNSTILE_SECRET_KEY` via `add_secret`).
- Componente `<TurnstileWidget />` (carrega script oficial, retorna token).
- Server fn `verifyTurnstile({ token })` que chama `https://challenges.cloudflare.com/turnstile/v0/siteverify` antes de qualquer `signInWithPassword` ou `resetPasswordForEmail`.
- Fail-closed: se a verificação falhar, bloqueia a ação.

## 3. Trilha de auditoria

**Tabela** `audit_logs` — id, workspace_id (nullable p/ eventos de auth), actor_user_id, action (enum text), resource_type, resource_id, metadata jsonb, ip, user_agent, created_at.

**Eventos registrados**
- Auth: `auth.login.success`, `auth.login.failed`, `auth.logout`, `auth.password_reset_requested`, `auth.password_updated`, `auth.captcha_failed`.
- Agentes/docs: `agent.created/updated/deleted`, `document.uploaded/deleted`.
- Equipe: `workspace.created`, `member.invited/joined/removed`, `role.changed`.
- Execuções: `agent.executed` com tokens e horas economizadas.

Registro via server fn `logAuditEvent` chamada nos pontos sensíveis. RLS: só membros do workspace leem; insert via SECURITY DEFINER.

**UI** `/app/audit` — tabela paginada, filtros por ação e ator.

## 4. Tom dos agentes mais direto

Reescrever o system prompt em `ai.functions.ts` para forçar respostas curtas, objetivas e acionáveis:

> "Responda de forma direta e concreta. Máximo 4 frases ou 6 bullets. Sem rodeios, sem repetir a pergunta, sem encerramentos genéricos. Se faltar contexto, peça exatamente o que precisa em 1 linha. Cite a fonte (documento) quando usar conhecimento da base."

Reduzir `max_tokens` para 600 (hoje ilimitado). Mesma diretriz incorporada aos 8 templates.

## 5. Dashboard com mais métricas + gráficos

Substituir os cards atuais por:
- 4 KPIs no topo: agentes ativos, execuções (30d), horas economizadas (30d), membros do workspace.
- Gráfico de área "Execuções por dia" (últimos 30 dias) — recharts.
- Gráfico de barras "Top 5 agentes por uso".
- Lista "Atividade recente da equipe" (puxa de `audit_logs` filtrado).
- Card "Horas economizadas acumuladas" com sparkline.

Dados via uma única server fn `getDashboardMetrics()` que agrega tudo em paralelo no banco.

## Ordem de execução

1. Migração SQL única: workspaces + members + invites + audit_logs + colunas workspace_id + backfill + novas RLS + função `is_workspace_member`.
2. Pedir secret `TURNSTILE_SECRET_KEY` (e site key como variável publishable).
3. `WorkspaceProvider` + switcher + páginas team/invite.
4. Turnstile no auth + forgot-password.
5. Helper de auditoria + integração nos pontos chave + página `/app/audit`.
6. Reescrita do system prompt + ajuste dos templates.
7. Novo dashboard com recharts.
8. Verificação: typecheck + smoke test via Playwright dos fluxos auth/criar workspace/convidar/chat.

## Detalhes técnicos relevantes

- `is_workspace_member(_ws uuid, _uid uuid)` em `SECURITY DEFINER` para evitar recursão em RLS de `workspace_members`.
- Convites: token aleatório de 32 bytes, expira em 7 dias, aceitação cria `workspace_members` via server fn autenticada que valida e-mail correspondente.
- Auditoria de auth roda em server fn (não no client) para capturar IP/UA reais via `getRequest()`.
- Turnstile site key vai em `VITE_TURNSTILE_SITE_KEY` no `.env` (publishable é seguro no client).
- Recharts já é compatível; instalar se ausente.
- Backfill é idempotente (usa `ON CONFLICT DO NOTHING`).

## O que NÃO entra nesta entrega

- Billing por workspace (mantém grátis).
- Permissões granulares por agente (só por workspace).
- Transferência de agentes entre workspaces.
- 2FA (Turnstile já cobre o pedido de anti-bot).

Confirma para eu começar pela migração?
