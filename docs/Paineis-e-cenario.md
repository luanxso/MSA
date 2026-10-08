# Painéis e cenário de apresentação

## Base usada

As respostas em TIME Vermelho orientam a organização: visualização por máquina; produtividade/OEE/MTBF/MTTR na entrada; hora a hora; paradas e motivos; parâmetros; scraps; lote; data, período, turno e ordem; priorização da NHPL na montagem de abafadores VGARD HP e MARK V. O supervisor informou computadores e celulares corporativos para a liderança; a presença apresentada é uma conferência ilustrativa da liderança, não um registro automático do operador.

O catálogo corresponde aos 32 postos da planta conceitual e aos oito setores. Existem 4.864 registros horários (32 máquinas × 8 horas × 19 turnos: três turnos nos seis dias anteriores e primeiro turno de hoje), leituras de parâmetros, refugos, material perdido, peças segregadas, falhas encerradas, cinco intervenções abertas, ocorrências, equipe e resumos. Toda quantidade é fictícia. Valores de parâmetros, limites, ciclos ideais, metas e tempos não vieram do CLP ou do supervisor. A planta e as estações da NHPL continuam conceituais.

## Abrir

- Windows: executar INICIAR-DEMO.cmd e abrir http://127.0.0.1:4173/demonstracao.html.
- Com Node: npm run demo.
- Com Python: python -m http.server 8000 --directory dist; abrir http://localhost:8000/demonstracao.html.
- O login normal continua disponível em index.html. A consulta real é sistema.html?dados=reais, com autenticação existente.
- Configurações permite restaurar os dados e, na apresentação independente, escolher Chefe, Supervisor, Operador ou Qualidade.

Os exemplos usam a data local do navegador e representam uma fotografia às 15h. Mudanças são locais à sessão. O modo de apresentação não envia dados ao Firebase, conversas a terceiros ou e-mails. O modo real preserva o serviço original de autenticação, registros e chat.

## Organização dos módulos

| Módulo | Conteúdo |
| --- | --- |
| Visão geral | Produtividade, OEE, MTBF, MTTR, NHPL, resumo de ontem e pendências |
| Produção | Filtro por turno, comparação dos três turnos, hora a hora, planejado/realizado, produto, lote e ordem |
| Máquinas | Filtros por setor/situação, busca, indicadores, produção/meta/OEE, paginação e detalhes com parâmetros e links para painéis/mapa |
| Paradas | Tempo, falhas, MTBF/MTTR, motivos, duração e intervenções abertas |
| Qualidade | Refugos, taxa, peças segregadas, perdas em kg e motivos |
| Ocorrências | Abertas, prioridade, resolvidas, máquina e ação |
| Funcionários | Presença, ausência, escala e posto ilustrativos |
| Indicadores | Disponibilidade, desempenho, qualidade, OEE e confiabilidade por máquina |
| Relatórios | Resumo de ontem, consolidações, resultados por máquina e CSV |
| Conferência | Registros pendentes e resumo do setor, para Supervisor |
| Apontamentos | Máquina atual, produção e parâmetros, para Operador |
| Notificações | Paradas, desvios, ocorrências e faixa de produtividade |
| Chat | Exemplos de alinhamentos e passagem de turno, envio apenas local no cenário |

## Integração com a planta

Links `#mapa-planta/@NHPL` ou `#mapa-planta/@INJ-01` abrem o mapa e o pop-up. O resumo convencional e o pop-up 3D da NHPL oferecem links de volta aos painéis, como `#producao/NHPL`. Filtros por setor, máquina e data alteram as tabelas e indicadores. Paradas encerradas no cenário também alteram o estado no mapa. Na fonte fictícia, não há outro simulador incrementando as contagens: painéis e mapa mostram a mesma fotografia.

## Cálculos

- Produtividade: aprovadas / meta acumulada das janelas apontadas × 100. Alertas usam a última janela completa de uma hora por máquina.
- Disponibilidade: tempo em operação / tempo planejado × 100. O tempo de operação desconta paradas sem sobreposição.
- Desempenho: ciclo ideal × total de peças / tempo em operação × 100.
- Qualidade: aprovadas / (aprovadas + refugos) × 100.
- OEE: disponibilidade × desempenho × qualidade, em frações.
- MTBF: tempo em operação / número de falhas encerradas do período.
- MTTR: tempo de reparo das falhas encerradas / número de reparos concluídos.
- Setup não conta como falha. Falhas abertas ficam fora do cálculo de MTTR; sem reparos concluídos, MTBF/MTTR mostram indisponível.
- Peças segregadas não são refugos até decisão. Perda de material em kg nunca é somada às peças.
- Totais agregados de apontamentos podem contar a passagem de uma peça por várias etapas. Eles não equivalem ao volume único expedido.

Faixas exclusivas de alerta: produtividade <60% para Gerência; de 60% a <80% para Supervisão; de 80% a <95% para Liderança; ≥95% sem alerta de produtividade. O destinatário é uma indicação de escalonamento; não há serviço de envio de e-mail. O som da NHPL é opcional e habilitado pelo usuário.

## Arquivos principais

assets/scenario-data.js gera os exemplos; assets/scenario-service.js mantém estado e ações locais; assets/performance.js concentra os cálculos; js/operations-ui.js organiza os painéis; js/plant-ui.js e assets/nhpl-data.js consomem a mesma base. A geometria existente e o serviço Firebase original foram conservados.

## Validação

56 testes automatizados aprovados; um teste dependente de emulador ignorado. Teste no Chrome: 32 equipamentos, 7 dias, consistência entre registros e pop-ups, hora a hora, OEE, MTBF/MTTR, limites dos alertas, navegação bidirecional, NHPL, chat local, conferência, encerramento de parada, troca de posto e telas de 390, 768 e 1536 pixels. Não houve conexão a equipamentos nem importação remota.

## Consulta da produção por turno

Na página Produção, selecione Todos os turnos, 1º, 2º ou 3º. O filtro trabalha em conjunto com setor, máquina e datas e permanece ao sair e voltar para Produção. Os indicadores, tabela hora a hora, resultados por equipamento, apontamentos e leituras são recalculados para o turno escolhido. A comparação mantém os três turnos para facilitar a decisão, indicando qual está selecionado.

A primeira abertura de Produção no cenário local seleciona os últimos sete dias. Os três turnos históricos têm volumes diferentes para demonstrar a comparação. O primeiro turno de hoje está concluído às 15h; o segundo e o terceiro de hoje não são preenchidos com produção futura. Se consultar somente hoje, eles aparecem sem produção registrada.

Horários fictícios: 1º 07h–15h; 2º 15h–23h; 3º 23h–07h do dia seguinte. A data de fabricação do terceiro turno é a data em que ele começa, inclusive para registros posteriores à meia-noite. O filtro também reconhece o campo turno já existente nos registros do Firebase. As leituras sem turno explícito usam o horário local para classificação ilustrativa.

Validação adicional: soma dos três turnos igual ao total; totais, metas, refugos e hora a hora coerentes após filtragem; turno noturno completo sem divisão entre duas datas; registro real noturno sem campo de data operacional; seleção no Chrome, histórico filtrado e ausência de overflow em celular.

## Correção de Máquinas no modo escuro

A lista de máquinas mantinha um fundo branco herdado do antigo formato de cards enquanto os textos adotavam a paleta escura. Na correção anterior, a lista recebeu separadores: a regra em css/panel-layout.css passa a usar fundo transparente e acompanha a superfície do painel em ambos os temas.

Verificação no Chrome: modos claro e escuro em 390, 768 e 1536 pixels; contraste de pelo menos 4,5:1 para nomes, códigos, campos, links e status; parâmetros expansíveis, filtro por máquina e abertura do pop-up da NHPL funcionando. Build atualizado. Capturas em docs/preview-paineis.


## Catálogo de Máquinas com filtros e visual dos painéis

Máquinas utiliza a mesma composição de Produção e Qualidade: título e descrição, filtros, faixa de indicadores, tabela com separadores e ações em verde. A tabela reúne código, nome, produto, setor/processo, situação, alertas, aprovadas hoje, meta diária e OEE. No celular, as linhas se adaptam em blocos legíveis com rótulos para cada valor; a aparência acompanha os temas claro e escuro.

- **Setor:** escolha Expedição para exibir apenas EXP-01, EXP-02 e EXP-03 no cenário. A seleção sincroniza o cabeçalho. Supervisores podem trocar o setor em acompanhamento; operadores permanecem no setor e equipamento autorizados.
- **Busca:** código, nome, produto ou nome do setor, sem distinção de acentos ou maiúsculas.
- **Situação:** operação/sem parada, parada, setup, manutenção ou equipamentos com alertas.
- **Ordenação:** prioridade operacional (intervenções e alertas primeiro), código ou produção do dia.
- **Paginação:** oito equipamentos por página. Busca e filtros retornam à primeira página.
- **Limpar filtros:** limpa busca, situação, ordenação e máquina vinculada, preservando o setor em acompanhamento.
- **Detalhes:** apresenta parâmetros e últimas leituras, contagens, meta, OEE e tempo de parada, além de edição autorizada e atalhos para o mapa e os painéis daquele equipamento.

Os indicadores refletem todos os resultados filtrados, incluindo as demais páginas. Produção e OEE usam o dia atual; no cenário compartilham a fonte do mapa. Na fonte real, ausência de parada aberta aparece como “Sem parada aberta”, sem presumir telemetria de operação.

Validação: filtros de Expedição, busca com e sem acentos, resultado vazio, limpeza, situação, ordenação, paginação, detalhes, abertura do formulário de meta e mapa no Chrome; troca de setor do Supervisor e escopo do Operador; temas claro/escuro em 390, 768 e 1536 pixels com contraste mínimo 4,5:1 e sem rolagem horizontal da página. Regressão do cenário e testes automatizados aprovados.


## Correção do movimento e da contagem por ciclo

A integração com os registros fictícios havia trocado a simulação contínua por uma fotografia às 15h. A amostra retornava ciclo em 0%, e o fluxo geral e a NHPL animavam apenas a fonte antiga de simulação.

O cenário agora continua a partir dessa fotografia enquanto o Mapa da Planta está aberto. O relógio compartilhado avança o ciclo com o tempo de ciclo cadastrado na leitura fictícia (25 s para ABF-01), usando o ciclo ideal quando não há leitura de ciclo. Cada ciclo completo acrescenta exatamente uma peça aprovada à última janela do equipamento; a janela fica parcial e acompanha o tempo da apresentação. Não são criados registros históricos duplicados. As contagens, tempos e indicadores permanecem comuns ao mapa, pop-ups, hora a hora e filtros por turno.

Pausar congela o relógio, a esteira e a contagem; Retomar continua do ciclo parcial. Sair do mapa suspende a simulação e preserva os resultados para consulta nos painéis. Máquinas em parada, setup e manutenção não produzem. O fluxo da planta e a cena 3D da NHPL aceitam o cenário compartilhado; somente o controle de pausa fica disponível nesse cenário. A fonte real e os apontamentos manuais reais continuam sem incremento automático.

Validação: ciclo parcial, +1 aos 25 segundos, vários ciclos, somas dos contadores, hora a hora, turno, OEE, parada/setup/manutenção, pausa e reabertura; Chrome no celular com deslocamento dos produtos, progresso visível, contador e sincronização com Produção, fluxo geral e NHPL. Total: 59 testes aprovados e um teste de emulador ignorado.


## Refugos gerados por ciclo e feedback visual

O cenário compartilhado agora sorteia aprovação ou refugo a cada ciclo completo. A chance padrão é **2%**, exclusivamente fictícia e sem relação com uma taxa observada na MSA. Em Configurações, a chance pode ser alterada para 0%, 2%, 5%, 10%, 25% ou 100%. Não é uma garantia de quantidade: a chance é aplicada individualmente a cada ciclo.

Um ciclo rejeitado acrescenta **uma peça de refugo e nenhuma aprovada**. O registro entra em Qualidade com código da máquina, setor, lote, ordem, turno, produto, motivo, horário e unidade em peças. A soma de aprovadas e rejeitadas aumenta em uma peça; contagens, taxa de refugo, qualidade e OEE usam a mesma base. A nova rejeição também aparece no histórico do supervisório e da NHPL.

No supervisório e nos resumos, uma peça da estação em acompanhamento fica vermelha com um símbolo e a palavra “Refugo”. A NHPL destaca um exemplar perto da verificação. Um aviso discreto mostra “Refugo identificado”, máquina, motivo e um link para Qualidade. O aviso e o destaque duram dez segundos do relógio da demonstração; pausar congela esse relógio. O mapa geral mostra o aviso para uma máquina dentro dos filtros e do acesso do usuário e destaca seu contorno. A produção continua após a rejeição, sem criar uma parada automática.

Para uma apresentação previsível, o botão **Simular refugo no próximo ciclo** agenda uma única rejeição no equipamento escolhido. Não adiciona refugo imediatamente nem interrompe o ciclo. O pedido permanece pendente enquanto a máquina está parada ou a demonstração está pausada e é consumido apenas quando houver ciclo completo. Esse botão aparece no supervisório completo, no resumo da máquina e nos controles da NHPL. Todas essas ações pertencem ao cenário fictício.

Validação: sorteio determinístico nos limites de 2%, separação de aprovadas/refugos, consistência de totais/turno/hora a hora/OEE, motivo e lote, agenda de um único ciclo, parada e retomada; Chrome com aviso, peça vermelha, Qualidade, configuração da taxa, expiração, mapa geral, resumo e NHPL. Temas claro/escuro em celular e desktop com contraste mínimo 4,5:1 para o aviso. Total atual: 61 testes aprovados e um teste de emulador ignorado.


## Leituras dinâmicas de temperatura e pressão

A fonte compartilhada usava leituras históricas fixas, motivo pelo qual temperatura e pressão repetiam o valor e horário das 14h48. Agora os mesmos registros que abastecem os painéis recebem leituras simuladas enquanto a planta está aberta. O horário e os valores de temperatura, pressão, força e vácuo são atualizados; a leitura de ciclo permanece estável durante a operação para manter a contagem por ciclo consistente.

As seis injetoras têm temperatura do cilindro, pressão de injeção e tempo de ciclo. Os quatro equipamentos de selagem têm temperatura, pressão, vácuo e ciclo. A NHPL tem pressão pneumática e força de prensagem; a montagem mantém parâmetros mecânicos. Esses valores e limites são exemplos industriais, sem definição de receita ou validação da MSA. A atualização dos dados já salvos acrescenta parâmetros ausentes, preservando limites existentes, registros de produção e modificações identificadas como personalizadas.

O sorteio de desvio tem chance fictícia padrão de **5% por máquina operando a cada 30 segundos de simulação**. Um parâmetro de temperatura ou pressão é escolhido, ultrapassa o máximo e permanece fora da faixa por dez segundos. O parâmetro fica destacado, o alarme informa valor e limites, e um aviso discreto aparece junto ao processo. Ao retornar à faixa, o alarme deixa de estar ativo e aparece uma indicação de normalização. O histórico conserva o início e o fim do desvio. O horário de início do alarme permanece estável enquanto ele está ativo.

**Simular desvio de parâmetro** permite acionar esse exemplo imediatamente para apresentação: escolhe temperatura quando disponível ou pressão nas máquinas sem temperatura. O botão existe no supervisório completo, resumo e NHPL. Configurações oferece chance de 0%, 5%, 10%, 25% ou 100%. A chance é independente da simulação de refugo; um desvio não rejeita peça nem para a máquina automaticamente.

Leituras, parâmetros nas máquinas, histórico em Produção, alarmes no mapa e Notificações usam a mesma base. Uma amostra é guardada a cada 30 segundos, com histórico limitado para a sessão; a leitura corrente se atualiza a cada tick. Pausar ou sair da planta suspende a atualização automática, preservando a última leitura. A fonte real não recebe valores simulados.

Validação: dez equipamentos com temperatura; temperatura/pressão variam dentro das faixas, ciclo permanece estável, migração preserva limites, sorteio por intervalo, desvio/normalização com eventos, notificações compartilham leitura, modo real não é alterado; Chrome com pausa, alertas, histórico em Produção, NHPL e configuração de chance, em celular e desktop claro/escuro. Total atual: 65 testes aprovados e um teste de emulador ignorado.

## Atualização dos fluxos da liderança

A descrição operacional atualizada está em [Fluxos-da-operacao.md](Fluxos-da-operacao.md). Inclui microparadas em segundos, passagem estruturada, lotes com decisão exclusiva da Qualidade, alertas com atendimento e presença/alocação por turno. A simulação agora continua entre páginas.
