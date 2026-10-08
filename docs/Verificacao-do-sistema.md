# Verificação do sistema — 08/10/2026

Revisão dos painéis, formulários, filtros, permissões, armazenamento local, mapa da planta e simulação. As correções estão incluídas nesta versão do projeto.

## Erros encontrados e corrigidos

| Problema | Correção |
|---|---|
| As alterações desapareciam após recarregar. A base fictícia completa tinha cerca de 5,4 milhões de caracteres e ultrapassava a cota do navegador. | O salvamento guarda somente as alterações sobre a base inicial. Cadastros, ciclos, refugos e leituras foram verificados após recarga. |
| Cadastrar uma máquina mudava o tamanho do catálogo e invalidava a restauração do cenário. | A restauração aceita novos equipamentos e valida a estrutura dos dados. |
| Formulários do cenário aceitavam código repetido, limites invertidos, peças fracionadas, leitura vazia e períodos inválidos. | Validação antes da alteração dos dados; códigos normalizados; peças exigem inteiros e material em kg aceita decimais. |
| Editar a meta no cadastro não atualizava a meta por hora usada pelos indicadores. | A meta por hora é atualizada junto com a meta diária. |
| Uma edição podia conservar a identificação de uma conferência anterior. | A edição remove a conferência anterior e pede nova verificação. A máquina de origem é preservada. |
| Trocar o setor após abrir um link de máquina podia deixar um filtro incompatível e uma página vazia. | O filtro da rota só é aplicado quando a máquina pertence ao contexto selecionado. |
| Alertas descritos como atuais dependiam do período histórico consultado em outro painel. | As pendências atuais usam o dia do cenário, independentemente do filtro histórico. |
| A simulação selecionava o último registro de produção sem distinguir sua origem. | Os ciclos automáticos atualizam apenas registros da simulação e preservam os apontamentos manuais. |
| Parâmetros removidos do cadastro permaneciam nas leituras ativas da simulação. | As leituras ativas seguem os parâmetros cadastrados; o histórico anterior é preservado. |
| O botão de preparar exemplos no modo Firebase enviava campos exclusivos da planta e uma NHPL sem meta, causando recusa do banco. | O envio usa somente os campos aceitos pelo cadastro e meta inicial zero quando não configurada. |
| Um link direto ou uma recarga podia abrir a NHPL antes de seu módulo 3D estar disponível. | A abertura aguardará o carregamento do módulo e ocorrerá automaticamente. |
| A versão isolada da planta não carregava a dependência dos avisos, interrompendo atualizações. | A dependência e seu estilo foram incluídos em `planta-demo.html`. |

## Validação realizada

- **73 testes automatizados aprovados**, sem falhas ou testes ignorados nesta execução. Incluem as regras do Realtime Database em emulador local.
- **9 roteiros de navegador aprovados**: auditoria de formulários, painéis do cenário, catálogo de máquinas, ciclos, refugos, parâmetros, planta, NHPL e operações com Firebase em emulador.
- Chefe, Supervisor e Operador; produção por turno; conferência e correção de registros; paradas e encerramento; ocorrências e resolução; consolidação; CSV; chat e troca de posto/setor.
- Temas claro e escuro; celular, tablet e desktop; contraste no catálogo; navegação por teclado, foco dos diálogos e ausência de extravasamento horizontal nas telas verificadas.
- Esteira, incremento de produção, pausa/retomada, refugos, temperatura, pressão, alertas e normalização compartilhados entre mapa e painéis.
- Recarga de máquinas cadastradas e de contadores/leituras da simulação; referências locais dos arquivos HTML verificadas.
- Build do projeto e integridade do ZIP verificados.

Os testes do banco utilizaram o emulador local. Esta revisão não publicou alterações nem gravou dados no Firebase da empresa. A aprovação dos testes cobre os fluxos descritos; não representa uma garantia de ausência de qualquer erro em situações não exercitadas.

## Roteiros incluídos

Os testes de regressão dos cadastros e do armazenamento estão em `tests/scenario-service.test.mjs`. A preservação de apontamentos manuais está em `tests/scenario-live.test.mjs`.

O roteiro `scripts/test-audit-browser.mjs` salva e recarrega máquinas, testa erros e correções dos formulários, exporta CSV por setor, registra peças e kg separadamente e verifica nova conferência após uma edição. Os demais roteiros estão na mesma pasta.

`npm test` executa os testes locais. O teste de regras do banco depende de `MSA_DATABASE_EMULATOR_JAR`; os roteiros de navegador dependem de Playwright e Chrome. Esses recursos foram disponibilizados no ambiente usado nesta revisão.


## Atualização dos cinco fluxos

A versão com microparadas, passagem de turno, lotes, atendimentos de alertas e alocação passou em 80 testes automatizados, sem falhas ou testes ignorados. Inclui as regras do Realtime Database em emulador, a quarta função Qualidade, o descarte sem duplicar refugos e a restauração dos fluxos.

Dez verificações no Chrome aprovadas: painéis/cenário, máquinas/temas, ciclos, qualidade, parâmetros, auditoria de formulários, planta, NHPL, Firebase compartilhado e os cinco fluxos. O teste com SDK Firebase real percorreu também classificação, passagem/recebimento/pendência, atendimento/normalização/conclusão, presença/alocação e decisão de lote com descarte adicional. A simulação de produção foi verificada fora da página do mapa. Os fluxos foram inspecionados em claro/escuro, celular, tablet e desktop.

Nenhum teste utilizou máquinas físicas ou escreveu no banco da empresa. Consulte Fluxos-da-operacao.md para a demonstração e os limites da integração.
