# MSA — Sistema integrado de gestão da produção

## Correções finais — versão 18

Corrige as dez falhas da análise final: fotos parciais/restauradas, reclassificação de refugo, data das correções, períodos sobrepostos, validação de turnos, histórico de metas, divisão de paradas, passagem de turno, taxas exibidas e contraste. Inclui testes de regressão e mantém o apontamento original auditável. Veja [Correções e validação](docs/Correcoes-finais-v18.md).

Para Firebase real, publique o `database.rules.json` desta versão junto com a atualização do sistema.

## Modelo empacotado e exemplo analógico — versão 17

O build empacota os bytes originais do modelo OCR em `eng-model.js`, um script local, evitando o download do `.gz` por `fetch` em visualizadores Android. O reconhecimento continua sendo feito pelo Tesseract local, sem API. Exemplos analógicos agora geram e leem a imagem com uma escala de demonstração quando a escala real ainda não está confirmada; não marcam a escala real como conferida.

## OCR e botão de exemplos — versão 16

O modelo local agora é carregado pela página com a autenticação HTTP da mesma origem, quando presente, e enviado em bytes ao worker. Assim, o modelo não depende do `fetch` do worker em visualizadores que bloqueiam essa operação. O botão de exemplos recebe estilos explícitos para os estados normal, foco, toque e desabilitado, preservando o tema escuro. Testes: `npm run test:ocr-local-auth` e `npm run test:examples`.

## OCR em visualizadores locais — versão 15

Os caminhos de recursos do OCR preservam origem, porta e pasta, mas removem usuário e senha embutidos na URL. Isso evita o erro de `fetch` ao carregar o modelo em visualizadores locais com autenticação HTTP. A sessão HTTP continua sob controle do navegador. Teste: `npm run test:ocr-local-auth`.

## Mais imagens de exemplo — versão 14

O botão de teste alterna entre **cinco imagens por tipo de instrumento e parâmetro**. Visores variam valor, fundo claro/escuro e decimal; ponteiros variam posição dentro da escala confirmada. As imagens geradas são identificadas como demonstração e passam pelos mesmos leitores locais e envio das fotos reais. O contador mostra o exemplo atual. Teste: `npm run test:examples`.

## Captura pela câmera — versão 13

**Tirar foto** abre a câmera com imagem ao vivo, troca de câmera e captura, sem acionar o seletor de arquivos. A foto segue para a leitura local e o envio automático existentes. **Escolher arquivo** permanece separado. O navegador precisa permitir a câmera e servir a página por HTTPS ou localhost; visualizadores de editores podem bloquear o recurso. Veja [Registro por foto](docs/Registro-por-foto.md). Teste: `npm run test:camera`.

## Acessibilidade integrada — versão 12

Em **Configurações → Acessibilidade**, personalize cores para daltonismo, tamanho de texto, contraste, espaçamento e redução de animações. Preferências locais persistem ao navegar e entre abas da mesma origem. A integração preserva a escolha de cargo da v11, OCR local, gráficos e Motion. Veja [Acessibilidade](docs/Acessibilidade.md).

## Escolha de cargo na apresentação — versão 11

Na tela de login, **Visualizar cenário de apresentação** abre a escolha de **Operador, Supervisor, Chefe ou Qualidade**. Ao selecionar o cargo, o cenário abre com o menu e as permissões desse perfil, sem exigir RE ou senha. Fechar a escolha mantém o formulário preenchido.

## Leitura automática por foto — versão 10

O operador fotografa um instrumento e o sistema preenche e envia a leitura, sem digitar o valor, quando há reconhecimento. Visores usam OCR real local, sem API; ponteiros usam análise geométrica com escala confirmada. A apresentação tem imagens de exemplo identificadas. A seleção do posto e do lote continua necessária. Veja [Como usar e limitações](docs/Registro-por-foto.md). Os gráficos da v9 e Motion da v7 estão preservados.

## Análise da produção — gráficos, versão 9

Página dedicada a gráficos em **Gestão → Análise da produção**. O filtro mantém setor, máquina, período, turno e lote. Os gráficos aparecem diretamente abaixo dos filtros, sem cartões de indicadores, abas de listas ou tabelas na tela principal.

- Evolução da produção aprovada por hora/dia.
- Evolução da taxa de refugo em escala percentual própria.
- Comparação por setores na visão geral, por máquinas em um setor e por turnos quando uma máquina é selecionada. Clique nas barras para filtrar.
- Motivos de parada em gráfico de barras.
- Parâmetros com faixa configurada quando há leituras de uma máquina isolada. Clique nos pontos vermelhos para investigar registros próximos.

Passe sobre os pontos, toque ou use o teclado para consultar valores. Cada gráfico tem botão de ampliar; a janela ampliada também recebe atualizações. Os gráficos adaptam os eixos ao celular. Supervisor continua vendo seu setor; Chefe e Qualidade acessam os setores permitidos.

Esta versão preserva o registro por foto e as animações **Motion da v7**. Dados, filtros e cálculos usam a base comum dos painéis. Guia: [Análise da produção](docs/Analise-da-producao.md).

Verificação: `npm test`, `npm run test:analysis`, `npm run test:motion`, `npm run test:photo`, `npm run test:ocr`, `npm run build`.

## Registro por foto — acesso secundário do operador

Em **Registro por foto**, selecione setor, máquina e lote para capturar manômetro, vacuômetro ou IHM. Pressão e vácuo têm leitura geométrica local experimental com escala confirmada e envio automático; visores de temperatura, pressão ou vácuo têm OCR real local, sem API, preenchimento e envio automáticos. A configuração dos instrumentos fica guardada neste navegador. Fotos ambíguas ficam pendentes; o modo de apresentação oferece imagens de exemplo identificadas como demonstração. Os registros alimentam os painéis existentes, preservam foto/RE/horário e deixam de ser sobrescritos pela simulação. Veja [Registro por foto](docs/Registro-por-foto.md), incluindo as regras Firebase atualizadas e as diferenças entre apresentação local e fonte compartilhada.


## Estudo de capacidade MSA — entrega atual

Em **Relatórios → Exportar planilha Excel**, os registros filtrados preenchem o `.xlsx` original do estudo Selo V-Gard da MSA, com as mesmas abas, cores e colunas espaçadas. O arquivo conserva fórmulas editáveis, inclui todas as leituras e amplia o modelo quando necessário. **CSV da coleta para BI** e **CSV geral do sistema** continuam disponíveis. Os campos sem coleta ficam vazios; o cenário identifica os dados fictícios. Veja [Exportação do estudo de capacidade](docs/Exportacao-estudo-capacidade.md) para o mapeamento, cálculos e integração dos sinais reais.

As mensagens de confirmação e erro das operações desaparecem após **10 segundos** ou podem ser fechadas imediatamente pelo **X** à direita. Cada nova mensagem reinicia o prazo de exibição.

## Correções de lógica — 08/10/2026

A meta horária usa a taxa cadastrada ou a meta de oito horas dividida por oito. Produção, refugos, leituras e ocorrências entre 23h e 07h pertencem à mesma data de produção. Lotes concluídos preservam quantidade e decisão; um novo defeito exige nova avaliação. A operação impede produção repetida e duas paradas abertas na mesma máquina. Passagens de turno usam uma chave única por máquina, data e turno e uma transação no Firebase. O áudio da NHPL segue o controle e os filtros do cabeçalho.

Para usar os dados reais, publique novamente o **database.rules.json** desta versão em **Realtime Database → Rules → Publish**, conforme [Firebase](docs/Firebase.md). As regras incluem a reserva de parada por máquina. O cadastro e o acesso imediato por cargo permanecem iguais.

As correções têm testes de cálculos, concorrência, histórico e som. Execute `npm test` e `npm run build`. Os testes contra o emulador exigem `MSA_DATABASE_EMULATOR_JAR`; os roteiros visuais exigem Playwright e Chromium.

## Painéis preenchidos e integrados à planta — entrega atual

**Produção, Qualidade e Paradas** agora usam abas internas e tabelas com **8 registros por página**. A busca localiza máquina, lote e motivo; os filtros e os indicadores ficam no topo. **Detalhes** abre as informações completas sem expandir a lista. No celular, as linhas viram blocos com rótulos. Consulte [Navegação e fluxos da operação](docs/Fluxos-da-operacao.md). Para validar essa navegação, execute `npm run test:navigation` com Playwright/Chromium.

Execute **INICIAR-DEMO.cmd** no Windows ou **npm run demo** e acesse **http://127.0.0.1:4173/demonstracao.html**. Na página de login também existe **Visualizar cenário de apresentação**. A apresentação abre sem cadastro, com perfil fictício de Chefe. Em Configurações é possível visualizar como Supervisor ou Operador e restaurar os exemplos.

A revisão do chat passou por **16 testes de cenário** e verificação no navegador: históricos exclusivos, envio isolado, atualização simulada, três larguras e contraste de pelo menos 4,5:1 nas mensagens nos dois temas. A integração Firebase também foi verificada no emulador, com o botão de simulação oculto na fonte real.

Os módulos usam sete dias de dados fictícios para os mesmos **32 equipamentos e oito setores** da planta. O cenário começa às 15h, com o primeiro turno concluído, e atualiza as datas automaticamente. Os ciclos seguintes geram apontamentos próprios no segundo turno. Nas viradas às 23h e 07h, a coleta passa ao próximo turno sem alterar os registros encerrados; as janelas também são separadas por hora. Painéis, filtros e pop-ups consultam uma única base. No Mapa da Planta, o cenário continua em movimento: o ciclo avança e cada ciclo completo classifica uma peça como aprovada ou refugo nos mesmos registros dos painéis. Use Pausar/Retomar para controlar a apresentação. Clique no nome de uma máquina para abrir seu pop-up no mapa; o pop-up oferece acesso aos painéis de Produção, Paradas e Qualidade com essa máquina selecionada.

A página **Produção** agora oferece **Todos os turnos, 1º, 2º e 3º turno**. O filtro atualiza produção aprovada, meta acumulada, produtividade, hora a hora, resultados por máquina, apontamentos e parâmetros. A aba **Por turno** mantém três cartões lado a lado com aprovadas, meta acumulada proporcional ao tempo transcorrido, cumprimento da meta, OEE, paradas, microparadas e taxa de refugo. **Ver detalhes** abre Máquinas, Hora a hora, Equipe e Paradas e problemas, com paginação de oito registros. **Comparar dia anterior** seleciona um dia concluído. O filtro Turno destaca o cartão escolhido, enquanto os três continuam visíveis; datas, máquina e setor limitam toda a comparação. Volumes absolutos são comparados somente com tempos observados iguais; diferenças de taxas usam pontos percentuais. Verificação desta ampliação: 37 testes de cálculos, cenário, fluxos e proteção; roteiros de navegador de comparação, navegação e Firebase no emulador. Os detalhes foram verificados em 390/768/1536 pixels, nos dois temas. Execute `npm run test:shifts` para repetir a comparação. Para facilitar a apresentação, Produção abre com os últimos sete dias: os turnos 2 e 3 possuem exemplos nos seis dias anteriores, pois o cenário de hoje está às 15h. Horários ilustrativos: 07h–15h, 15h–23h e 23h–07h. O terceiro turno pertence à data em que começa.

A página **Máquinas** segue a hierarquia visual dos demais painéis, com filtros por **setor e situação**, busca por **código, nome ou produto** e ordenação por prioridade, código ou produção. Para consultar a Expedição, escolha **Setor → Expedição** na própria página. Os indicadores acompanham os filtros; a lista mostra produção aprovada, meta, OEE e alertas do dia, com oito equipamentos por página. **Detalhes** reúne parâmetros, ações de cadastro permitidas e atalhos para Produção, Paradas, Qualidade e o mapa. O filtro de setor acompanha o seletor do cabeçalho e preserva as permissões de cada cargo.

A simulação tem **2% de chance de refugo por ciclo**, uma taxa fictícia ajustável em **Configurações → Chance de refugo por ciclo**. O refugo aumenta somente as peças rejeitadas, atualiza Qualidade e fica registrado com máquina, lote, motivo e horário. No mapa e nos pop-ups aparece um aviso discreto por dez segundos e a peça ganha destaque vermelho. Para mostrar isso na apresentação, use **Simular refugo no próximo ciclo** no supervisório completo, no resumo de uma máquina ou nos controles da NHPL; o evento só acontece ao terminar o ciclo.

Temperatura e pressão agora têm **leituras automáticas variáveis** no cenário, com horário atualizado. As seis injetoras e os quatro equipamentos de selagem oferecem temperatura e pressão; NHPL e montagem mostram pressão pneumática e parâmetros de montagem. Valores e limites são fictícios. A cada 30 segundos de simulação há uma chance de 5% por máquina operando de gerar um desvio temporário; o campo sai do limite, aparece um aviso e um alarme, e a leitura se normaliza após dez segundos. Para apresentar sem depender do sorteio, use **Simular desvio de parâmetro** no supervisório ou nos controles da NHPL. A chance pode ser alterada em Configurações. Pausar congela as leituras automáticas junto com a produção.

Cada painel tem conteúdo próprio: Visão geral com produtividade, OEE, MTBF, MTTR e destaque da NHPL; Produção com hora a hora, lote, ordem e turno; Paradas com motivos e confiabilidade; Qualidade com refugos, material e segregados; Equipe com presença ilustrativa; Indicadores com eficiência por máquina; Relatórios com fechamento do dia; Notificações com destinatário previsto. O chat inclui históricos fictícios próprios para os oito setores, Produção, Passagem de turno e cada funcionário. **Simular nova mensagem** demonstra uma atualização chegando à conversa selecionada.

Nesta entrega o cenário fictício é a fonte padrão dos painéis, inclusive após login. Para consultar a fonte real, use **Configurações → Consultar dados do Firebase** ou **sistema.html?dados=reais**. A apresentação não importa dados no banco nem envia mensagens/e-mails. As alterações feitas nos exemplos ficam na sessão do navegador. Contagens de máquinas em diferentes etapas não representam um total de produtos finais únicos.

Respostas do supervisor orientaram os campos, a prioridade da NHPL e as faixas de alertas. Nomes, presença, planta, tempos, metas, parâmetros e limites são exemplos que precisam de validação. Detalhes: [Painéis e cenário](docs/Paineis-e-cenario.md).

Validação da revisão das abas: **80 testes automatizados aprovados**, incluindo as regras no emulador; **nove roteiros de navegador aprovados**, cobrindo as novas abas, paginação, cinco fluxos, quatro cargos, integração com a planta e três larguras nos dois temas; build concluído. A conexão com equipamentos reais não faz parte desta validação.

## Histórico e arquitetura anterior

## Entrega do supervisório 3D NHPL — 07/10/2026

Execute `INICIAR-DEMO.cmd` (Windows) ou `npm run demo` e abra `http://127.0.0.1:4173/planta-demo.html`. Clique em **NHPL** no mapa para abrir a cena 3D em popup. O mesmo popup está integrado ao sistema autenticado, com permissões existentes. A demonstração trabalha em memória.

Inclui câmera, estações, montagem visual, indicadores, histórico, estados demonstrativos, comunicação perdida, foco, modo TV e tela cheia. O layout da NHPL é conceitual e o transporte não foi confirmado pela fábrica. Modelos/variantes, unidade de contagem e sinais reais precisam de validação. Instruções e configuração em [Supervisório NHPL](docs/Supervisorio-NHPL.md).

Validação desta entrega: 52 testes aprovados, 1 teste dependente de emulador Firebase ignorado; build concluído e testes locais no Chrome aprovados. Não houve teste com CLP ou banco de produção.

Versão 0.6.0. O projeto possui **Mapa da Planta com supervisório por equipamento**, além dos módulos de Operador, Supervisor e Chefe. Preserva a identidade MSA, login por RE, menu responsivo e chat. Os módulos de apontamento usam o **Firebase Authentication e o Realtime Database já configurados no projeto**.

A página ocupa toda a área de trabalho com 32 equipamentos fictícios, oito setores por cor e rotas animadas de capacetes e fones. O supervisório representa a transformação das peças sobre uma esteira industrial. Abra `planta-demo.html` para apresentar sem cadastro e sem Firebase. Detalhes em [Mapa visual](docs/Mapa-da-Planta-Visual.md). Inclui zoom, movimentação, filtros, estados e supervisórios específicos de injeção, selagem e montagem. A fonte **Simulação** atualiza a demonstração na memória; **Registros do sistema** consulta os apontamentos reais no escopo do usuário. A estrutura e a futura integração com CLPs/IoT estão em [docs/Mapa-da-Planta.md](docs/Mapa-da-Planta.md).

Login e Cadastro agora têm composição industrial com fotografia real da visita, cabeçalho MSA comum e campos mais legíveis. A análise das telas anteriores, as decisões visuais, os arquivos alterados e as capturas estão em [docs/Design-acesso.md](docs/Design-acesso.md). O cadastro mantém os campos e o acesso imediato; não há nova etapa de aprovação.

O cadastro solicita **Nome, RE, Cargo e Senha**, sem setor ou máquina. O RE identifica a pessoa mesmo quando ela muda de posto. Dentro do sistema, o Operador escolhe a máquina em uso e o setor é derivado desse equipamento; o Supervisor escolhe o setor em acompanhamento no cabeçalho. O Chefe consulta indicadores e consolidações dos setores. As páginas e componentes são compartilhados. Menus, rotas, comandos e regras do banco verificam o cargo e o contexto atual. A mudança está detalhada em [docs/Cadastro-por-RE.md](docs/Cadastro-por-RE.md).

## Começar

1. Configure o Firebase conforme [docs/Firebase.md](docs/Firebase.md): habilite E-mail/senha e publique `database.rules.json`. A configuração pública original foi preservada; ela não concede acesso administrativo para publicar regras.
2. Sirva `dist` em HTTP/HTTPS. Não abra os arquivos por `file://`.

```sh
python3 -m http.server 8000 --directory dist
```

3. Abra `http://localhost:8000`, crie seu cadastro e entre. RE aceita 1 a 10 dígitos, preservando zeros; senha tem mínimo de 6 caracteres e não exige confirmação. O cadastro já entra no sistema, sem aprovação adicional.
4. Para demonstrar os três perfis simultaneamente, use três navegadores ou perfis independentes. Cadastre um Operador, um Supervisor e um Chefe. Nenhum deles precisa informar setor no cadastro.
5. O Chefe pode preparar o catálogo dos três setores em **Configurações → Preparar máquinas de exemplo**. O Supervisor seleciona um setor no cabeçalho e prepara as máquinas desse setor, ou cadastra uma máquina em **Máquinas**. A preparação preserva máquinas existentes e não inventa dados de produção.
6. Pelo Operador, selecione **Máquina em uso**. Registre produção, paradas, qualidade, ocorrências e leituras. O Supervisor seleciona o setor dessa máquina; o Chefe acompanha os totais. As telas atualizam pela mesma base Firebase.
7. Troque a máquina em uso para trabalhar em outro setor com o mesmo RE. Os novos registros usam o novo equipamento; o histórico conserva sua origem.
8. Abra **Mapa da Planta** no menu. A simulação funciona sem preparar o catálogo no Firebase. Clique em uma máquina para acessar seu supervisório; use **Cenário** para demonstrar parada, setup, manutenção ou alerta. Para consultar os apontamentos existentes, altere a fonte para **Registros do sistema**.

Nomes, metas e limites do catálogo inicial são **exemplos**, não parâmetros aprovados da MSA. O Supervisor pode cadastrar os parâmetros reais em Máquinas. O seletor da operação usa o catálogo compartilhado no Firebase, incluindo máquinas adicionadas posteriormente.

O painel usa navegação estrutural em carvão, setor no header e leitura da operação por equipamentos. **Visão geral** é a entrada para os três cargos. A análise visual e as decisões estão em [docs/Design-painel.md](docs/Design-painel.md).

## Telas e fluxo

A matriz completa de objetivos, dados, ações e acessos está em [docs/Arquitetura.md](docs/Arquitetura.md).

| Cargo | Página inicial | Acesso exclusivo | Escopo |
| --- | --- | --- | --- |
| Operador | Visão geral | Apontamentos | Máquina em uso; cria e corrige registros próprios |
| Supervisor | Visão geral | Conferência | Máquinas, operadores e registros do setor em acompanhamento |
| Chefe | Visão geral | Indicadores | Visão de todos os setores; ajuste de metas |

**Funcionários e Relatórios** são compartilhados por Supervisor e Chefe. **Visão geral, Mapa da Planta, Produção, Máquinas, Paradas, Qualidade, Ocorrências, Chat, Notificações e Configurações** são acessíveis aos três cargos, com dados e ações limitados ao contexto de cada um. A planta simulada usa somente dados fictícios; fontes reais respeitam o escopo do cargo.

A conferência marca os registros e identifica o Supervisor. Não impede que os dados apareçam imediatamente nos indicadores. Uma correção do Operador mantém o mesmo registro, a origem e a data de criação, e o deixa novamente a conferir.

O Supervisor adiciona o resumo do setor e o período em Conferência. Relatórios e Indicadores calculam os totais a partir dos registros atuais; a consolidação não duplica a produção nem congela totais desatualizados.

## Persistência

Dados operacionais, perfis e chat utilizam o Firebase. As preferências explícitas em `localStorage` são o RE lembrado no login e o tema claro/escuro. O botão de lua/sol aparece no cabeçalho de todas as páginas; veja `docs/Temas.md`. Sessões são gerenciadas pelo Firebase Auth. Rascunhos de formulários/chat e estado do menu ficam na memória da página.

Os valores, cenários e eventos da simulação da planta também ficam na memória da página e reiniciam ao recarregá-la. Eles não são gravados nas coleções do Firebase.

Contas e conversas antigas do modo local não são importadas automaticamente: não temos os dados dos navegadores dos usuários e os hashes locais de senha não são credenciais Firebase. Recrie os cadastros de demonstração uma vez. As chaves locais antigas não são apagadas nem utilizadas para autorizar o novo sistema. No ZIP original, as páginas operacionais estavam vazias; não havia registros operacionais locais a converter.

O chat conserva canais de produção, passagem de turno, setor e conversas privadas. Agora grava mensagens no Realtime Database. Seu histórico consulta atualizações a cada 5 segundos quando aberto; os módulos operacionais usam assinaturas em tempo real. Somente os participantes acessam conversas privadas. O Worker e as migrações D1 anteriores foram preservados para compatibilidade, mas a interface atual usa o adaptador Firebase.

## Verificar e gerar o pacote de publicação

Node.js 24 ou superior.

```sh
npm ci
npm test
npm run build
```

O build original foi mantido: produz `dist/server/index.js`, manifesto e migrações para publicação no Sites. A aplicação também funciona com servidor estático, pois os novos registros e o chat usam diretamente o Firebase. Publicar o site não publica as regras do Firebase; elas precisam ser atualizadas conforme `docs/Firebase.md`.

`npm test` inclui testes de autenticação, RBAC, métricas, sessão, telemetria da planta e compatibilidade do Worker. Para testar as regras no emulador real, informe o caminho do JAR oficial do Realtime Database:

```sh
MSA_DATABASE_EMULATOR_JAR=/caminho/firebase-database-emulator.jar npm test
```

Teste opcional de navegador com Playwright e o mesmo emulador:

```sh
MSA_DATABASE_EMULATOR_JAR=/caminho/firebase-database-emulator.jar npm run test:browser
```

Esse teste precisa de Playwright e seu Chromium instalados no ambiente de desenvolvimento. `MSA_PLAYWRIGHT_MODULE` e `MSA_CHROME_BINARY` permitem indicar instalações existentes. `MSA_FIREBASE_SDK_DIR` permite reutilizar cópias locais dos módulos públicos do SDK; sem essa opção o teste baixa os dois módulos oficiais. Os testes usam dados e identidades de teste, sem escrever no projeto Firebase real.

Para verificar somente a nova planta e seus supervisórios, execute `npm run test:plant`. Usa Playwright/Chromium, suporta as mesmas variáveis de instalação e substitui as fontes por dados de teste em memória. Não precisa do emulador nem acessa o Firebase. Verifica navegação, filtros, cenários, registros, adaptador, permissões e telas de computador, tablet e celular.

O roteiro para sexta-feira está em [docs/Roteiro-demonstracao.md](docs/Roteiro-demonstracao.md). O inventário de persistência, limitações e arquivos alterados está em [docs/Alteracoes.md](docs/Alteracoes.md). Fontes dos ativos originais em [ASSETS.md](ASSETS.md).

Correção da coleta por turno: sessões antigas que estendiam o primeiro turno são ajustadas automaticamente. As quantidades simuladas extras são transferidas proporcionalmente para as janelas seguintes, preservando o total; refugos usam sua data registrada. Apontamentos manuais são preservados.
