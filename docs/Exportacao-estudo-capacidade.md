# Exportação do estudo de capacidade MSA

Em **Relatórios**, selecione período, setor e máquina e clique em **Exportar planilha Excel**. O sistema baixa um `.xlsx` preenchido usando o modelo original da MSA fornecido pela equipe. As abas **Selo** e **Normality test**, título, cabeçalhos, cores, bordas, larguras, espaços entre parâmetros, desenhos e configurações de impressão são preservados. O processamento acontece no navegador, sem enviar as medições a outro serviço.

**CSV da coleta para BI** mantém a tabela simples dos 41 parâmetros. **CSV geral do sistema** mantém a exportação anterior de produção, paradas, perdas e ocorrências.

| Informação | Posição no modelo Excel |
| --- | --- |
| Data e horário | A, a partir da linha 17; exibe a data e conserva o horário no valor |
| Material | B |
| Espessura, em mm | C |
| % Scrap | D, percentual numérico |
| Lote | E, texto para preservar códigos |
| Temperatura ambiente | F |
| Aquecimento Z1 a Z21 | H, J, L… AX |
| Medida e velocidade do passo | AZ e BB |
| Tempos e retardos | BD até CD, nas colunas alternadas do modelo |
| Pressão do ar e vácuo | CF e CH |

Cada linha representa uma leitura. Todas as leituras filtradas são exportadas em ordem cronológica, com um estudo por máquina. Acima das 51 linhas reservadas, a coleta é ampliada e os resultados, histogramas e referências são deslocados. O teste de normalidade também é ampliado quando passa de 1.000 leituras. As antigas medições da planilha fornecida são removidas do modelo reutilizável.

Os quatro pares de células unidos verticalmente em % Scrap foram separados para permitir uma porcentagem própria em cada linha. As cores e bordas são conservadas. Data, espessura, percentual e lote receberam os formatos adequados: o original usava formato de data também nos campos vazios de espessura e refugo.

## Cálculos

Mínimo, máximo, média e desvio padrão consideram as medições numéricas existentes, mesmo se a primeira leitura estiver vazia. O desvio padrão populacional do estudo de capacidade foi mantido (`STDEVP`). Cp e Cpk ficam em **n.a.** quando há menos de duas medições, desvio zero, limites ausentes ou máximo menor ou igual ao mínimo. A validação usa o objetivo de Cpk em U6.

Os limites originais não foram substituídos por valores presumidos: zonas com mínimo e máximo zero, o par invertido do tempo da prensa de corte e limites incompletos de pressão/vácuo precisam de revisão técnica antes de calcular a capacidade desses parâmetros.

Os histogramas mantêm os intervalos do modelo quando os limites são válidos. Para parâmetros sem um par válido, usam o mínimo e máximo observado; amostras constantes usam uma faixa de ±0,5 em torno do valor para exibir a frequência. Essas faixas são apenas de apresentação e não passam a ser tolerâncias de processo.

Na aba **Normality test**, use a lista em **B3** para escolher a característica. A exportação começa pelo primeiro parâmetro com pelo menos duas medições; se não houver, pelo primeiro com algum dado. As medições são ordenadas automaticamente, a probabilidade inversa é vinculada à amostra e A² deixa de ser um número antigo fixo. O resultado na aba Selo identifica a característica selecionada. Nenhuma conclusão é apresentada para menos de duas medições ou desvio zero. Com poucas medições, o teste deve ser tratado como exploratório.

Foi mantido o critério do modelo: Anderson–Darling com ajuste `A² × (1 + 0,75/n + 2,25/n²)` e comparação com 0,752, ao risco de 5%. Referência: [NIST — Anderson–Darling test](https://www.itl.nist.gov/div898/handbook/eda/section3/eda35e.htm). As fórmulas permanecem editáveis e o Excel recalcula ao abrir. Resultados atuais também são gravados para permitir a visualização inicial sem valores antigos.

## Origem dos dados

O modelo recebe máquinas de Selagem com produto Selo/V-Gard. A temperatura genérica de selagem não é tratada como uma das 21 zonas. Parâmetros sem leitura ficam vazios, sem substituir medições por limites, zero ou médias.

O % Scrap usa peças refugadas / (aprovadas + refugadas), por máquina, lote, dia produtivo e turno, no período filtrado. Perdas em kg e peças suspeitas não entram. Sem produção registrada, a porcentagem fica vazia. A taxa se repete nas leituras do mesmo grupo e não deve ser somada no BI. As amostras novas acompanham o lote, turno e dia produtivo do apontamento de produção atual; o terceiro turno mantém o dia de início mesmo após meia-noite.

Na apresentação, **SEL-01** trabalha com **Selo V-Gard HP** e recebe medições **fictícias** dos 41 parâmetros. O Excel identifica a simulação no cabeçalho. A exportação lê os registros guardados no cenário; ela não sorteia ou recalcula novas medições ao baixar. Pressão e vácuo seguem as leituras dos demais painéis. As zonas de aquecimento e outros parâmetros do estudo têm suas próprias simulações, gravadas com cada leitura; a temperatura genérica de selagem é uma variável diferente. Os dados históricos do modelo não são usados como medições atuais. Amostras conservam o valor e horário de coleta; o mostrador ativo não duplica o histórico.

Em **Apontamentos → Registrar parâmetros**, uma máquina compatível mostra **Coleta do Selo V-Gard · estudo de capacidade MSA**. Material, espessura e medições adicionais são opcionais e ficam armazenados com a leitura em `estudoSelo`. Uma integração pode fornecer `estudoSelo: { material, espessura, valores: { aquecimento_z1, ..., pressao_ar, vacuo } }` junto da leitura. As chaves e unidades estão em `MSA.capability.fields`.

Para dados reais (`?dados=reais`), somente registros existentes são exportados. A coleta automática de todos os sinais da IHM/CLP ainda depende da integração com os equipamentos. As regras locais `database.rules.json` incluem os campos adicionais; publique essa versão no Firebase para armazená-los. As permissões por cargo e os filtros existentes são aplicados à exportação.

## Validação e manutenção

O modelo nativo fica em `dist/templates/MSA-Estudo-Capacidade-Selo-VGard.xlsx`, servido como binário pelo servidor local e pelo Worker gerado no build. O exportador conserva as partes do pacote XLSX e atualiza os dados, resultados e referências necessários. Não depende de CDN ou biblioteca carregada pela internet. Mudanças no modelo exigem conferir seu mapeamento e atualizar sua versão no exportador.

O modelo e o exportador removem dos comentários os metadados auxiliares antigos do Google Sheets. A versão anterior deixava uma referência a um arquivo auxiliar ausente em `xl/comments1.xml`, o que fazia o Excel pedir reparação. Os textos dos comentários nativos são preservados. Os testes verificam os destinos das relações internas do XLSX, além da integridade do ZIP e da sintaxe XML, incluindo a exportação a partir de um modelo antigo em cache.

Execute `node --test tests/capability-*.test.mjs` e `npm run build`. Os testes verificam ZIP e XML com leitores independentes, formatos e tipos, campos ausentes, seleção de máquinas, dados ordenados, fórmulas, resultados que mudam com a amostra e ampliação com 60 e 1.002 leituras.

A revisão visual e a conferência dos cálculos foram feitas com artifact-tool. `INDIRECT` e `SMALL` têm limitações nesse motor; as referências dinâmicas foram verificadas estruturalmente, com resultados gravados e comparação independente do cálculo estatístico. Não houve execução no aplicativo desktop do Excel nesta revisão.

## Exemplo entregue

O exemplo avulso desta versão é uma exportação do cenário inicial do programa, para os sete dias da base demonstrativa. Foi gerado pelo mesmo `MSA.createScenario` e pelo mesmo exportador de Relatórios, sem inventar uma segunda tabela de medições. Ele é uma fotografia: a sessão aberta no navegador pode ter avançado ou recebido edições. Para obter exatamente a sua sessão e os filtros escolhidos, exporte dentro do sistema.

Para gerar novamente um exemplo da base inicial, execute `node scripts/export-study-example.mjs`. A data, máquina e período são informados no resumo gerado junto do Excel.
