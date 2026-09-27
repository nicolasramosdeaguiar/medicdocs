# Health Hub Central

Quero criar um aplicativo web chamado "MeuHistórico" (pode sugerir outro nome). É um app onde o paciente centraliza todos os seus documentos de saúde (exames, receitas, laudos, encaminhamentos) em um único lugar, com ajuda de IA para organizar tudo automaticamente, e pode compartilhar isso com qualquer médico através de um link.

## Usuários

Por enquanto, só um tipo de usuário: o Paciente. Ele se cadastra com email/senha, faz login, e gerencia seus próprios documentos.

## Telas e fluxos

### 1. Cadastro / Login

Tela simples de criar conta (nome, email, senha) e login. Depois do login, vai direto para a tela principal (Timeline).

### 2. Timeline (tela principal)

Lista de todos os documentos do paciente, ordenados do mais recente para o mais antigo. Cada item da lista mostra:

- Ícone/cor por tipo de documento (exame laboratorial, receita, laudo, encaminhamento, outro)

- Data do documento

- Um resumo curto gerado pela IA (ex: "Hemograma completo — 12/06/2026" ou "Receita: Dipirona 500mg")

- Nome do médico, se disponível

Tem um botão flutuante grande "+ Adicionar documento" sempre visível.

Tem um campo de busca no topo (buscar por tipo de exame, nome de remédio, nome de médico, data).

### 3. Upload de documento

Ao clicar em "+ Adicionar documento":

- Opção 1: Tirar foto (abre a câmera do dispositivo)

- Opção 2: Selecionar arquivo (PDF ou imagem já salvo)

Depois do upload, mostra uma tela de "Processando..." com uma animação simples, enquanto a IA extrai os dados (isso pode demorar alguns segundos).

### 4. Confirmação de dados extraídos

Depois de processado, mostra uma tela com os dados que a IA extraiu, em campos editáveis, para o paciente conferir e corrigir se precisar:

- Tipo de documento (dropdown: Exame laboratorial / Receita / Laudo / Encaminhamento / Autorização / Outro)

- Data do documento

- Nome do médico e CRM (se identificado)

- Se for exame: lista de itens com nome do exame, valor, unidade, valor de referência

- Se for receita: lista de medicamentos com nome, dosagem, via de administração

- Se for laudo/diagnóstico: campo de texto com o resumo e o CID se identificado

- Campo "Nível de confiança da extração" (Alta / Revisar) — se vier "Revisar", destacar em amarelo os campos que a IA teve dúvida, pedindo que o paciente confirme antes de salvar

Botão "Salvar" no final, que grava o documento na Timeline. A imagem/PDF original fica sempre acessível também (não só os dados extraídos).

### 5. Detalhe do documento

Ao clicar em um item da Timeline, abre a visualização completa: imagem/PDF original de um lado, dados extraídos organizados do outro. Permite editar os dados a qualquer momento.

### 6. Compartilhar

Botão "Compartilhar com médico" na Timeline (compartilha tudo) ou dentro de um documento específico (compartilha só aquele). Ao clicar:

- Gera um link único e temporário (validade configurável: 1 hora, 24 horas, ou até o paciente revogar manualmente)

- Mostra o link e um QR code para o paciente mostrar na consulta

- Quem abre o link vê uma versão só leitura, organizada tipo a Timeline, sem precisar criar conta ou instalar nada

- O paciente pode revogar o acesso a qualquer momento numa lista de "Links ativos"

## Como a extração de dados deve funcionar (IA)

Depois do upload, o sistema deve:

1. Se for imagem, extrair o texto (OCR)

2. Passar o texto extraído para uma IA (LLM) com uma instrução clara para devolver os dados em formato estruturado (JSON), com os campos descritos na tela de confirmação (item 4 acima)

3. Se a IA não tiver certeza de algum campo (letra ilegível, documento cortado), marcar esse campo com confiança baixa em vez de adivinhar

## O que fica de fora deste MVP (não implementar agora)

- Login/acesso para médicos ou clínicas

- Integração direta com laboratórios (Fleury, DASA, etc.)

- Qualquer coisa de seguradora, convênio ou farmacêutica

- App nativo de celular (este MVP é web, responsivo para funcionar bem no celular pelo navegador)

## Estilo visual

Visual limpo, acolhedor e calmo — pensando em alguém que está passando por um tratamento de saúde (evitar cores muito clínicas/frias ou muito "corporativas"). Tons suaves, tipografia legível, boa acessibilidade (contraste, textos grandes).

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://medicdocs.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ad926d42-835d-417b-9614-06c7cf74c3cb).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
