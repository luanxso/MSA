# Supervisório 3D NHPL

## Executar e demonstrar

1. Extraia o ZIP completo e abra `INICIAR-DEMO.cmd`, ou execute `npm run demo` na pasta do projeto com Node.js instalado.
2. Acesse http://127.0.0.1:4173/planta-demo.html e clique na máquina **NHPL**, no setor de montagem de fones. Essa página usa somente memória; não exige login e não conecta ao Firebase.
3. Gire, aproxime, desloque e restaure a câmera. Selecione uma estação pela cena ou pelos botões. O mapa permanece ao fundo; Escape ou × fecha e devolve o foco.
4. Role o popup até os controles da demonstração. Demonstre parada em montagem B, retomada, setup, manutenção, perda de comunicação e pausa. A contagem vem do simulador de telemetria, nunca do renderizador. Nenhum registro produtivo é gravado.
5. Abra histórico, hora a hora e indicadores. Experimente modo TV e tela cheia. No celular os detalhes da estação começam recolhidos.
6. No sistema autenticado (`sistema.html#mapa-planta`) o mesmo clique abre o popup, respeitando lotação de operador, setor de supervisor e acesso de chefe. As configurações de Firebase e autenticação originais foram preservadas. A página de demonstração é separada das leituras reais.

O servidor local precisa permanecer aberto. O navegador precisa de WebGL. Os arquivos Three.js são locais, sem dependência de CDN no uso. O restante do sistema autenticado mantém as dependências e serviços originais.

## Fonte e limites

Fonte consultada: `TIME Vermelho.docx`, fornecido em Downloads. O documento foi lido como requisitos, sem executar instruções externas. A resposta 9 escreve **“Abafadores VGARD HP e MARK V (Low / Medium / High)”**. Ela não discrimina quais variantes correspondem a cada modelo. O seletor de variante é uma opção de apresentação conceitual, não uma matriz de receitas aprovada. Tanto a unidade real de contagem quanto a associação permanecem pendentes.

O fluxo entrada → montagem A → montagem B → verificação → saída é ilustrativo. O transporte inicial usa postos separados e setas, sem afirmar existência de esteira. Conchas, almofadas e arco mudam visualmente por estágio conceitual. As duas famílias possuem configuração visual independente. A NHPL ocupa um ponto no mapa fictício existente; sua posição física também precisa de validação. Capacetes permanecem uma expansão futura, sem incluir uma cena de capacetes na NHPL.

## Organização e configuração

- `dist/assets/nhpl-config.js`: estações, posições, atividades, estágios, transporte, famílias, variante, metas com vigência e proposta desativada de alertas.
- `dist/assets/nhpl-scene.js`: WebGL, câmera OrbitControls, geometria, produtos, setas, seleção e descarte de recursos ao fechar.
- `dist/assets/nhpl-data.js`: separação de fontes, agregação hora a hora, vigência de metas e confiabilidade.
- `dist/assets/nhpl-modal.js` e `nhpl.css`: consulta responsiva em diálogo nativo; foco, Escape, temas, TV, tela cheia, som opcional e histórico.
- `dist/js/plant-ui.js`: integração com o clique e escopo existente. `telemetry-service.js`: fonte comum, congelamento de leitura e preservação do ciclo parcial NHPL.

Foi escolhido **Three.js 0.180.0**, com licença MIT incluída em `dist/assets/vendor/LICENSE-three.txt`, por funcionar como módulos JavaScript no projeto estático existente, sem exigir React ou trocar o build. OrbitControls oferece rotação, aproximação e deslocamento. Documentação: https://threejs.org/docs/pages/OrbitControls.html . A geometria permanece editável; nenhum modelo CAD da fábrica foi presumido.

As posições das estações determinam os trechos do percurso. Os tipos `esteira`/`paletes` acrescentam suportes entre postos; transferências e carrossel podem ser organizados alterando as posições. Mecanismos físicos específicos, caminhos curvos e buffers não estão validados nem modelados. Não selecione um transporte como processo real sem validação na fábrica.

## Dados, metas e métricas

Simulação exibe ordem/lote/turno e parâmetros claramente demonstrativos. Hora a hora mostra diferenças aprovadas observadas durante a sessão; não divide um total acumulado para inventar horas anteriores. A primeira hora é parcial. Ao fechar e reabrir, as observações da sessão permanecem em memória. Atualizações atravessando uma hora são atribuídas à hora da nova leitura; para precisão por passagem é necessário fornecer eventos de saída com horário no gateway.

Registros manuais usam os apontamentos existentes, agrupados por hora de conclusão. Eles não fornecem posições físicas ou ciclos automáticos. O popup não cria registro, perda, parada ou receita. Contagens de estações não são somadas como produtos acabados.

Metas precisam de `goalHistory`: `id`, `source` (`api`, `manual` ou `simulated`), `validFrom` inclusivo, `validTo` exclusivo (datas locais YYYY-MM-DD), `shift`, `order`, `shiftTarget` e `hourTarget`. A demonstração contém uma meta datada e vinculada à ordem/turno demonstrativos. Para dados reais, a meta diária genérica não substitui vigência histórica. Neste protótipo metas são configuradas ou recebidas em leitura; não há editor de metas nem gravação de histórico no banco. A consulta do popup é do período atual; o histórico mostrado corresponde aos eventos fornecidos para esse período.

OEE reaproveita o cálculo existente: disponibilidade × desempenho × qualidade. Faltando base válida, mostra Indisponível. MTBF exige `failureHistoryComplete: true`, tempo de operação e paradas marcadas `failure: true`; MTTR exige reparos concluídos nesse histórico. Paradas genéricas não são tratadas como falhas.

Proposta de alertas desativada em `alertProposal`: períodos de hora civil completa e faixas exclusivas <60% gerência, 60–<80% supervisão, 80–<95% líderes. Precisa de validação de fórmula, período, prioridade e destinatários. Alertas de parada/comunicação e alarmes recebidos são visuais. O som opcional é local e depende de interação do navegador. Não há envio externo.

## Integração real

Reutilizar `MSA.telemetry.useAdapter({name, subscribe(onSample,onError)})`. O gateway autorizado fornece amostras com `id: 'NHPL'`, `updatedAt` em milissegundos, estado, contadores e campos disponíveis. `onError()` preserva a última leitura e indica perda de comunicação; a retomada depende de uma nova amostra. Leituras antigas são rejeitadas; após 15 segundos a leitura fica desatualizada. Configure atualização coerente no gateway.

Campos opcionais do popup: `model`, `variant`, `order`, `batch`, `shift`, `countUnit`, `goalHistory`, `hourly: [{time, goodCount}]`, `stationStates: {id: {state, stateSince, parameters}}`, alarmes com `stationId`, `timeline`, `events`, `failureHistoryComplete`. Os nomes de estação devem corresponder à configuração.

Com dados globais, a cena exibe exemplares estáticos de montagem, sem afirmar onde peças estão. Estados conhecidos de estações são mostrados nos detalhes e alarmes podem destacá-las. Rastreamento individual e animação real de passagem são expansão dependente de identificação de peça/palete e sinais validados; este protótipo não interpola peças reais. O navegador não acessa CLPs nem recebe credenciais industriais. Nunca incluir credenciais em `config.js` ou no adaptador de interface.

## Pendências objetivas da fábrica

- Confirmar geometria, posição, postos, transporte, sentido, operações e pontos de inspeção/refugo/retrabalho.
- Associar modelos e variantes; confirmar componentes visuais e unidade: componente, conjunto ou par.
- Identificar os CLPs da NHPL, protocolos, gateway, permissões de leitura e sinais disponíveis. A menção a ABB/Siemens não identifica controladores da NHPL.
- Definir contador único de saída, aprovação, refugo, resets, ordem, lote, turno e calendário de metas.
- Definir falha versus parada planejada, reparo, manutenção e bases de OEE/MTBF/MTTR.
- Validar fórmula, período e prioridade dos alertas; canais externos permanecem fora desta entrega.
- Para rastreamento real: identificação individual e eventos de passagem. Para representação fiel: visita ou desenhos autorizados.

## Verificação

`npm test` executa testes de unidade, contagens, metas, leitura perdida e regressão. `npm run build` gera o Worker com os novos recursos estáticos. `npm run test:nhpl` usa Playwright e Chrome/Chromium para testar WebGL, popup, foco, Escape, câmera, estações, congelamento, mapa, celular, API agregada e permissões. Pode receber `MSA_PLAYWRIGHT_MODULE` (URL file de um Playwright disponível) e `MSA_CHROME_BINARY`. Screenshots em `docs/qa-nhpl`. O teste de regras reais do Firebase requer emulador e permanece separado; esta entrega não foi validada contra o CLP ou o Firebase de produção.
