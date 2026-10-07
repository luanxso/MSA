# Mapa e supervisório visual — versão 0.7.1

Planta conceitual baseada nas referências fornecidas e revisada segundo os oito pontos da direção neutra. Os planos anteriores à implementação estão em `Plano-da-reformulacao.md` e `Plano-da-revisao-neutra.md`.

## Abrir

No sistema, use **Mapa da Planta**. Para apresentar sem cadastro e apenas com dados fictícios, abra **planta-demo.html**, inclusive por duplo clique na cópia local. A demonstração não carrega o Firebase nem consulta perfis. O sistema integrado com login deve ser servido em HTTP/HTTPS.

## Planta

São **32 equipamentos fictícios em oito setores**: estoque/recebimento, injeção, acabamento, montagem de capacetes, montagem de fones, qualidade/testes, embalagem e expedição. A base é branca/cinza no tema claro e carvão/cinza no escuro. O botão no header alterna os temas. O verde MSA `#009534` destaca estados, seleção e ações pontuais.

Setores têm fundos de cores suaves e bordas discretas, com nomes técnicos pequenos. Equipamentos têm footprint, código e um indicador circular no canto superior direito: verde operando, vermelho parado, amarelo setup e cinza manutenção ou ausência de dados. O indicador mantém 17 px de diâmetro na tela, em qualquer zoom. Símbolos distinguem os estados; parada e alerta também destacam a borda. Informações adicionais ficam no popup. A linha compacta de indicadores acompanha o único header principal; o canvas ocupa o restante da área de trabalho.

Filtros de setor, estado, problemas e produto destacam os equipamentos. **Filtros** no header reúne a fonte de dados e o filtro de problemas. Zoom, arrastar, ajuste, teclado e tela cheia permitem explorar. Em telas pequenas a visão geral usa abreviações; o filtro de setor amplia a área escolhida.

Duas linhas finas indicam transferências pelos corredores, sem atravessar equipamentos. No estado padrão ficam quase invisíveis. Seleção de produto, setor ou equipamento destaca o fluxo correspondente. O movimento existe somente na simulação: não há rastreamento físico conectado.

O total de aprovadas soma os postos em destaque, podendo incluir etapas diferentes. Não equivale ao total único de produtos acabados.

## Consulta rápida e supervisório

Clique ou pressione Enter/Espaço em um equipamento para abrir o **resumo sobre o mapa**. O dialog contém código, nome, setor, status, produção aprovada, meta, tempo de operação, última parada, refugos, alertas e uma prévia ilustrada do processo. Leituras ausentes continuam indisponíveis. A mesma assinatura de telemetria atualiza mapa, resumo e prévia.

Fechar por botão, Escape ou clique fora preserva exatamente a câmera e devolve o foco ao equipamento. O botão **Abrir supervisório completo** é a ação que navega do resumo para a consulta detalhada. Voltar também preserva a câmera.

A linha mostra cinco etapas e doze peças sobre uma esteira. Capacetes recebem suspensão, inspeção e embalagem; fones recebem almofadas/arco e seguem para testes e embalagem. O posto consultado fica destacado. Pausa, parada, setup e manutenção congelam deslocamento e contagem. As abas de paradas/eficiência, qualidade e histórico, os parâmetros e os cenários da simulação permanecem disponíveis.

## Dados e validação

O catálogo demonstrativo em `dist/assets/plant-layout.js` é separado do cadastro operacional e do Firebase. Registros e API respeitam o escopo do cargo; não inventam ciclos ou OEE ausentes. A simulação permanece em memória e reinicia ao recarregar.

Testes de navegador verificam temas, popup nativo, atualização do resumo e da prévia, câmera/hash/foco, filtros, pausa, paradas, capacetes/fones, registros/API, permissões e telas de 1920, 1440, 1024, 768, 390 e 320 pixels. Os testes de telemetria verificam conservação de peças/tempos, ciclos, OEE e comunicação. A validação local usa dados de teste em memória, sem acessar o Firebase. O teste real de regras Firebase exige o JAR oficial do emulador e é ignorado quando ele não está disponível.

## Ajustar à fábrica real

Layout, equipamentos, processos, tempos, ordens, operadores e rotas são especulativos. Substituir quando a MSA fornecer dados reais. A geometria está em `plant-layout.js`; a arte vetorial em `process-visuals.js`; a interface em `plant-ui.js` e `plant.css`. Nenhuma dimensão representa metros.

