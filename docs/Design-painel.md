# Painel industrial MSA — versão 0.4.3

## Análise antes da edição

Foram analisados `sistema.html`, os estilos da estrutura e operação, a navegação, os componentes compartilhados, a configuração dos cargos e os fluxos existentes. As telas anteriores foram capturadas em desktop e celular com dados de teste isolados no emulador oficial do Realtime Database.

| Área | Fragilidade observada | Parte preservada |
| --- | --- | --- |
| Sidebar | Marca com 128 px de altura; setor estreito e truncado; grupos em caixa alta; pouca diferenciação entre navegação e conteúdo | Hierarquia por grupos, ícones funcionais, links e acesso por cargo |
| Header | Contexto repetido; usuário e estado de conexão pouco organizados; setor escondido na sidebar recolhida | Identificação, RE, cargo, notificações, conexão, saída e botão de menu |
| Visão geral | Quatro cards com o mesmo peso; máquinas e pendências recebiam a mesma moldura; alertas ficavam abaixo de uma longa sequência no celular | Valores calculados, metas, período, filtros, identificação das máquinas e pendências reais |
| Funcionários | Nome, RE e contexto com pouca diferenciação; um Operador sem setor aparecia como “Todos” | Tabela da equipe e atribuição de máquina pelo Supervisor |
| Máquinas | Cards repetidos; pouca distinção entre equipamento, processo, parâmetros e estado | Cadastro/edição, produto, meta, limites e ações por cargo |

## Skills aplicadas

A Frontend Design anexada orientou a direção específica para a operação MSA e a revisão contra padrões genéricos. A [Better Web UI](https://github.com/aladicf/better-web-ui) foi identificada como biblioteca de skills, não um único arquivo. Foram lidas e aplicadas suas orientações `frontend-design`, `setup`, `hierarchy` e `arrange`, com referências de hierarquia, legibilidade, separação de superfícies, composição e consistência.

O contexto do projeto foi registrado em `.better-web-ui.md` a partir das instruções fornecidas pelo usuário. A paleta MSA e a tipografia existente prevalecem sobre recomendações genéricas de trocar fontes ou evitar branco/preto puros. Não foi instalada uma biblioteca de componentes, fonte ou framework adicional.

## Direção visual e decisões

Um painel de trabalho com navegação estrutural em carvão e superfície principal branca. Sua personalidade vem da identificação dos equipamentos e da composição dos dados, sem decoração industrial fictícia.

| Elemento | Decisão e função |
| --- | --- |
| Sidebar | Carvão `#333333`, textos claros e item ativo com faixa MSA Green `#009534`. Não transformar cada link em botão separado. |
| Marca | Logo original em área branca mais compacta; legenda em caixa normal. A marca no header é usada no celular, quando a sidebar está fechada. |
| Header | Setor fora da sidebar, com espaço próprio; controles do usuário em um grupo à direita. No celular, o setor passa a uma segunda linha. |
| Entrada | Visão geral para os três cargos, conforme solicitado. Apontamentos, Conferência e Indicadores continuam exclusivos. Links profundos autorizados continuam abrindo suas páginas. |
| Ação principal | Operador registra produção; Supervisor abre conferência; Chefe abre indicadores. Reutiliza ações e páginas existentes. |
| Pendências | Faixa de contexto antes dos totais e lista lateral com tipo, máquina, motivo, horário e acesso à ação. Sem pendências, mostrar um estado honesto de ausência. |
| Indicadores | Faixa contínua com produção em maior destaque e perdas/qualidade em segundo plano. Peças e kg mantêm seus cálculos e unidades separados. |
| Equipamentos | Registro por código, nome, processo, condição registrada, produção aprovada e atendimento da meta. Barras representam valores calculados, sem novo indicador fictício. |
| Parâmetros | Limites e última leitura com unidade e horário em detalhes expansíveis na página Máquinas. Valores fora do limite identificados por texto, além da cor. |
| Funcionários | Nome e RE legíveis; código/nome da máquina atual; contexto vazio explicitado como “Ainda não escolhido”. Não indicar presença, ausência ou disponibilidade sem dados. |
| Tabelas | Cabeçalhos, alinhamento numérico e linhas de separação; tabelas largas têm rolagem interna com foco de teclado. |
| Seletor de máquina | Opções agrupadas por setor, mostrando código e nome. O setor da máquina escolhida continua sendo identificado automaticamente. |

Tokens: branco `#FFFFFF`, preto `#000000`, carvão `#333333`, cinza de leitura `#575B58`, divisões `#D8DCDA` e MSA Green `#009534`. Cores de alerta existentes permanecem funcionais. Espaçamento usa base de 4 px com passos de 8, 12, 16, 24 e 32 px. Controles principais têm altura mínima de 44 px.

Arial/Helvetica foi mantida pela continuidade com Login/Cadastro e pela leitura de formulários corporativos. Títulos usam 24–26 px, corpo 16 px, controles/tabelas 14 px e metadados 13 px. Botões verdes principais usam 19 px em negrito: a combinação branco/verde MSA tem contraste de 3,93:1, adequado a texto grande, evitando reduzir a legibilidade para preservar a marca.

Foram retiradas as molduras repetidas dos indicadores e painéis, as labels em caixa alta e a descrição igual em todas as páginas. Não foram acrescentados gradientes, sombras decorativas, fotos repetidas, ilustrações de máquinas, animações de entrada ou números artificiais. Não houve exclusão de funcionalidades.

## Limites e preservação dos dados

“Sem parada aberta” não significa equipamento funcionando: informa apenas a ausência de parada registrada. Leituras são apontamentos manuais, não sensores conectados. Nenhuma telemetria, presença de funcionários, OEE ou integração com CLP foi simulada.

Authentication, RBAC, regras e dados Firebase, autoria, histórico, troca de setor, formulários, consolidações, CSV e chat foram preservados. O redesenho não requer novas regras do banco. A ativação das regras fornecidas anteriormente continua documentada em `Firebase.md`.

## Verificação

- 35 testes automatizados passaram, incluindo regras no emulador oficial.
- O teste de navegador verificou as três sessões, entrada em Visão geral, parâmetros, produção, correção, conferência, paradas, qualidade, ocorrências, consolidação, chat e troca entre setores com preservação do RE/histórico.
- Capturas e dimensões verificadas em 1440, 1024, 768, 390 e 320 px, com ausência de overflow da página e da área principal. Tabelas mantêm sua própria rolagem.
- Dados das capturas pertencem somente à fixture de teste; não são dados reais da MSA e não foram enviados ao Firebase remoto.

## Arquivos alterados

`dist/sistema.html`, `dist/css/panel-layout.css`, `dist/js/script.js`, `dist/js/operations-ui.js`, `dist/assets/config.js`, `tests/auth-service.test.cjs`, `scripts/test-browser.mjs`, `README.md`, `docs/Arquitetura.md`, `docs/Alteracoes.md`, `package.json`, `package-lock.json`, `.better-web-ui.md` e este documento. Os estilos de Login/Cadastro permanecem inalterados.
