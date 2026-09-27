# Meddocs — Resumo do caso

Criar um resumo clínico rastreável, gerado por IA a partir dos documentos e das informações fornecidas pelo paciente ou família, voltado a médicos que ainda não conhecem o caso.

## Experiência do paciente

- Adicionar no topo do Início um bloco “Resumo do caso” com diagnóstico/situação atual, tratamento atual e data da geração.
- Sem resumo, mostrar “Gerar resumo do caso”. Com documentos novos ou alterados, mostrar “Há documentos novos” e “Atualizar resumo”.
- Trocar “Condições ativas” pelos diagnósticos do resumo, incluindo o selo “CID sugerido” quando o diagnóstico existir no texto, mas não houver CID informado.
- Criar a página autenticada `/resumo`, com aviso fixo de geração automática, todas as seções clínicas, data de geração e referências clicáveis para os documentos originais.
- Incluir “Editar informações da família” nessa página, com protocolo, ciclo atual, alergias, próximo procedimento, contato da equipe e outras observações.
- Diferenciar visualmente toda informação familiar com “Informado pelo paciente/família”.

## Compartilhamento

- Adicionar ao fluxo de criação de qualquer link a escolha explícita “Incluir resumo do caso: sim/não”.
- Persistir essa decisão no próprio link, para que ela não mude depois de criado.
- Quando marcada, a página pública mostra o resumo antes dos documentos, com aviso, data de geração e referências para os documentos disponíveis naquele link.
- Quando desmarcada, o link mantém a visualização atual, sem revelar o resumo.
- Referências que não façam parte de um compartilhamento de documento único serão identificadas, mas não abrirão conteúdo não compartilhado.

## Dados e segurança

- Criar `case_summaries` com conteúdo estruturado, documentos-fonte, modelo utilizado e data de geração.
- Criar `case_notes` com uma linha por paciente para as informações da família.
- Adicionar `include_case_summary` aos links de compartilhamento, com padrão `false`.
- Conceder acesso explícito às tabelas e ativar proteção por dono: somente o paciente autenticado lê ou altera seus resumos e notas.
- A página pública continuará resolvendo o token no servidor e devolverá o resumo apenas quando o link estiver ativo e autorizado a incluí-lo.
- Guardar novas gerações como histórico; a interface usa sempre a mais recente.

## Geração por IA

- Criar uma função autenticada que reúne todos os documentos do dono, seus itens e as notas da família em ordem cronológica.
- Usar o modelo solicitado `google/gemini-2.5-pro`, cuja disponibilidade foi confirmada no catálogo do projeto, e salvar o identificador usado em cada geração.
- Usar saída JSON validada com: manchete, diagnósticos, estadiamento, linha do tempo, tratamento atual, medicamentos, exames recentes, equipe e informações ausentes.
- Aplicar as regras clínicas fornecidas: não deduzir diagnóstico, estadiamento, prognóstico, protocolo ou conduta; toda afirmação deve citar documentos ou `family`.
- Validar no servidor todas as referências retornadas: aceitar apenas IDs pertencentes ao paciente e usar `family` somente para campos das notas.
- Tratar erros do serviço de IA conforme o status: mensagens seguras, sem repetição automática de bloqueios, créditos ou recusas; tentativas limitadas apenas para falhas temporárias.
- Detectar desatualização comparando a data do último resumo com documentos criados ou editados depois dele e com a última edição das notas familiares.

## Componentes e páginas

- Criar tipos e componentes compartilhados para renderizar o resumo na área autenticada e no link público, evitando diferenças de conteúdo entre as duas versões.
- Cada citação autenticada abre `/documents/$id`; no link público, a citação leva ao documento correspondente dentro da própria página quando ele estiver incluído.
- Preservar `?categoria=` ao entrar em documentos pelo resumo e ao voltar para a lista.
- Atualizar o diálogo de compartilhamento, a lista de links ativos e a página pública para indicar se o resumo está incluído.
- Manter o visual atual do Meddocs, com seções clínicas legíveis, alertas discretos e boa leitura no celular.

## Validação

- Aplicar e conferir a migração, incluindo permissões e proteção por usuário.
- Verificar geração real com a IA, persistência do JSON e referências aos documentos.
- Testar estados sem resumo, resumo atual, resumo desatualizado, notas familiares e erro da IA.
- Testar links de tudo e de documento único, ambos com e sem resumo, além de links expirados/revogados.
- Conferir navegação, acessibilidade e layout em desktop e celular, sem regressão nos filtros da timeline.
