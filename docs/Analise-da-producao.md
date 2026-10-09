# Análise da produção — gráficos

Esta página é dedicada a gráficos. A versão 9 removeu os cartões de totais, as abas de listas e as tabelas da tela principal. Os gráficos aparecem imediatamente abaixo dos filtros.

## Filtrar e isolar

O setor é escolhido no cabeçalho. Máquina, período, turno e lote continuam disponíveis na página e afetam todos os gráficos. Supervisor consulta seu setor; Chefe e Qualidade consultam os setores permitidos. O Operador mantém o fluxo de apontamentos e fotos.

A comparação muda conforme o recorte:

| Seleção | Gráfico de comparação |
| --- | --- |
| Todos os setores e máquinas | Produção aprovada e refugos por setor |
| Um setor, com várias máquinas | Produção aprovada e refugos por máquina |
| Uma máquina | Produção aprovada e refugos por turno |

Clique numa barra para aplicar seu filtro. Grupos sem registros são indicados sem inventar produção. Comparações com mais de oito grupos têm paginação dentro do gráfico.

## Gráficos

1. **Evolução da produção:** peças aprovadas por hora em um dia produtivo, ou por dia em períodos maiores.
2. **Evolução da taxa de refugo:** refugos divididos por aprovadas mais refugos, em escala percentual separada. Períodos sem peças registradas não recebem taxa zero artificial.
3. **Comparação de produção:** setores, máquinas ou turnos, com barras para aprovadas e refugos.
4. **Motivos de parada:** os seis de maior duração, em minutos.
5. **Parâmetros:** aparece quando uma máquina isolada tem leituras no recorte. Selecione pressão, vácuo, temperatura ou outro parâmetro disponível. A faixa configurada fica marcada e os desvios aparecem em vermelho.

Não há um painel vazio de parâmetros na visão geral. Leituras parciais por foto não recebem valores inventados para parâmetros ausentes.

## Interagir

Passe sobre os pontos ou barras para consultar valores. No celular, toque no ponto. Pelo teclado, Tab chega ao gráfico e as setas percorrem seus pontos; Home/End vão aos extremos. Enter em uma barra aplica o filtro. Cada gráfico tem botão para ampliar; a janela ampliada também atualiza com os registros recebidos.

Clique ou pressione Enter em um ponto vermelho de parâmetro para investigar. A janela mostra registros da mesma máquina até 30 minutos antes/depois da leitura, respeitando os filtros. Produção e perdas precisam ter o mesmo lote quando a leitura informa lote. Paradas e ocorrências sem lote aparecem como contexto da máquina. Os intervalos de produção que atravessam a janela são apresentados completos.

Proximidade temporal não comprova causalidade. Os limites são faixas de processo cadastradas, sem cálculo de limites estatísticos de CEP.

## Como os registros viram gráficos

- O dia produtivo vai das 07h às 07h seguintes. A madrugada do terceiro turno pertence ao dia em que o turno começou, como nos painéis existentes.
- Produção é agrupada pelo fim do apontamento e refugos pelo horário do registro. Não há estimativa da distribuição de peças dentro de um intervalo.
- Lacunas indicam ausência de registros. Horas/dias em andamento são marcados como parciais; compare períodos equivalentes para avaliar uma queda.
- O gráfico de um turno isolado mostra suas horas. No dia atual, as horas futuras ficam fora do eixo.
- Paradas são recortadas no período e na hora atual. Sobreposições da mesma máquina não duplicam o total. Categorias diferentes podem se sobrepor, então as barras por motivo não substituem o tempo consolidado.
- O filtro de lote exige correspondência exata e exclui registros sem lote.
- Somar máquinas de diferentes etapas pode contar uma peça mais de uma vez.
- Parâmetros mostram até 200 leituras recentes, posicionadas pelo horário real. Fotos são leituras pontuais, com interpretação local experimental para pressão/vácuo e preenchimento manual da temperatura.
- As consultas aceitam até 366 dias. Os filtros permanecem acessíveis quando o período ultrapassa o limite, para permitir corrigi-lo.

## Integração

Os gráficos derivam da base comum dos painéis; não criam séries aleatórias próprias. O cenário de apresentação continua fictício/local. No modo real, as atualizações vêm do serviço Firebase existente. Não foi acrescentada conexão a sensores ou serviço de IA.

Registro por foto, exportação de Excel/CSV e animações Motion da v7 foram preservados. A entrada da página e as janelas usam Motion; atualizações de dados não repetem a animação de navegação. A preferência de movimento reduzido é respeitada.

## Executar e validar

Execute `npm run demo` e abra `http://127.0.0.1:4173/demonstracao.html`. No perfil de Chefe, entre em Análise da produção. Os demais perfis da apresentação podem ser escolhidos em Configurações.

`npm test` verifica cálculos, filtros, escopos, terceiro turno, limites e sobreposição de paradas. `npm run test:analysis` verifica gráficos, isolamento por setor/máquina/turno, valores da base, interação, ampliação, atualização, investigação, celular e temas. `npm run test:motion`, `npm run test:photo` e `node scripts/test-scenario-browser.mjs` verificam os fluxos preservados. `npm run build` gera assets e Worker.

Validação desta entrega: 153 testes aprovados, sem falhas; três testes de regras com emulador Firebase não executados neste ambiente. Os fluxos de navegador e o build foram verificados. Não houve publicação ou teste com equipamentos físicos.
