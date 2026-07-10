
# Meddocs — Plano do MVP

App web responsivo (mobile-first) para o paciente centralizar exames, receitas, laudos e encaminhamentos, com extração automática por IA e compartilhamento via link público.

## Stack
- TanStack Start + React + Tailwind (já configurado)
- Lovable Cloud (Supabase gerenciado) para auth, banco e storage
- Lovable AI Gateway (Gemini multimodal `google/gemini-3-flash-preview`) para OCR + extração estruturada direto de imagem/PDF
- QR code via `qrcode` (npm)

## Telas / Rotas

Públicas:
- `/auth` — cadastro (nome, email, senha) e login em uma única tela com abas
- `/s/$token` — visualização somente leitura de um compartilhamento

Autenticadas (sob `_authenticated`):
- `/` — Timeline com busca no topo, lista ordenada desc, FAB "+ Adicionar documento", botão "Compartilhar tudo"
- `/upload` — escolher câmera (`capture="environment"`) ou arquivo → tela "Processando…" → redireciona para confirmação
- `/documents/$id` — detalhe: original (imagem/PDF) + dados extraídos editáveis; primeira abertura após upload age como tela de confirmação, destacando em amarelo campos de baixa confiança
- `/shares` — links ativos com opção de revogar

## Modelo de dados (Supabase, RLS por `auth.uid()`)

- `profiles(id uuid pk → auth.users, full_name, created_at)` — trigger auto-cria no signup
- `documents(id, user_id, doc_type enum, doc_date date, doctor_name, doctor_crm, summary, cid, raw_text, confidence enum('high','review'), low_confidence_fields text[], file_path, mime_type, created_at)`
  - `doc_type`: `lab_exam | prescription | report | referral | authorization | other`
- `document_items(id, document_id, kind enum('lab','med'), name, value, unit, reference_range, dosage, route, notes, order_index)` — exames e medicamentos em uma tabela discriminada
- `shares(id, user_id, token uuid unique, scope enum('all','document'), document_id nullable, expires_at nullable, revoked_at nullable, created_at)`

Storage bucket privado `medical-docs`, path `user_id/document_id.<ext>`. Downloads via signed URLs (server fn). Para `/s/$token`, o server valida token + expiração/revogação e devolve signed URLs temporárias.

Grants + RLS: donos leem/escrevem só seus registros. `shares` tem policy pública `TO anon` SELECT filtrada por `token` + não revogado + não expirado; leitura de documents/items via server fn público que resolve o token com service role (nunca expor `user_id` além do necessário).

## Server functions & rota pública

- `uploadAndExtract` (protected, POST): recebe arquivo, salva no storage, chama Gemini multimodal com prompt pedindo JSON estruturado (schema por tipo de doc) + campo `low_confidence_fields[]`, cria `documents` + `document_items`, retorna id. Erros do gateway (429/402) tratados com mensagem clara.
- `updateDocument`, `deleteDocument`, `listDocuments(search?)`, `getDocument(id)`, `getSignedUrl(document_id)` — protected
- `createShare({ scope, documentId?, ttl })`, `listShares`, `revokeShare(id)` — protected
- `GET /s/$token` (rota pública TSS em `src/routes/s/$token.tsx`) — server-side resolve o compartilhamento e renderiza SSR

## IA — prompt de extração

Um único prompt server-side envia a imagem/PDF (via `image_url` ou `file` block com MIME real) pedindo:
- `doc_type`, `doc_date`, `doctor_name`, `doctor_crm`, `summary`, `cid`
- Se lab: array de `{ name, value, unit, reference_range }`
- Se receita: array de `{ name, dosage, route }`
- Array `low_confidence_fields` com paths dos campos incertos + `confidence: 'high' | 'review'`

Usar `generateText` com `Output.object` (schema flat, sem `.min/.max`), com try/catch em `NoObjectGeneratedError` e fallback pra parse do `error.text`.

## Busca

`listDocuments(search)` faz `ilike` em `summary`, `doctor_name`, `raw_text` + join com `document_items.name` (medicamento/exame). Sem full-text por ora.

## Visual

- Paleta suave: off-white de fundo, verde-sálvia como primário, terracota suave como acento; sem azul clínico ou roxo genérico
- Tipografia serif humanista para títulos (ex: Fraunces) + sans legível (Inter) para corpo, carregados via `<link>` no `__root.tsx`
- Cards arredondados, espaçamento generoso, ícones distintos por `doc_type`, contraste AA+, alvos de toque ≥44px
- Todas as cores como tokens semânticos em `src/styles.css` (HSL/oklch), nada hardcoded nos componentes
- Metadata SEO por rota + og no `__root`

## Fora do escopo (confirmado)
Login de médicos, integração com laboratórios, convênio/farmácia, app nativo.

## Ordem de implementação
1. Ativar Lovable Cloud + migrations (profiles, documents, document_items, shares, bucket, RLS, grants, trigger de signup)
2. Design tokens + shell autenticado + tela `/auth`
3. Timeline vazia + FAB + busca
4. Upload → server fn de extração com Gemini → detalhe/confirmação com destaque de baixa confiança
5. Editar/salvar documento, deletar, reabrir original
6. Compartilhamento: criar/listar/revogar links + rota pública `/s/$token` + QR code
7. Polimento responsivo mobile, estados de erro (429/402), acessibilidade

Ao terminar, sugiro publicar para você testar upload real no celular.
