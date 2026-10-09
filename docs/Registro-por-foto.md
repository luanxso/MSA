# Registro por foto — v17

A tela continua secundária: entre como Operador e abra **Registro por foto** no menu ou em **Apontamentos**. Usa a autenticação e a base de leituras existentes; gráficos e animações Motion da v7 permanecem disponíveis.

## Como usar sem digitar a leitura

1. Selecione setor, máquina e lote / ordem. Esses dados identificam o destino da foto; não são adivinhados pelo leitor.
2. Escolha **Ponteiro analógico** ou **Visor com números (OCR)** no cartão do parâmetro. Temperatura começa em OCR; pressão e vácuo começam em ponteiro. É possível usar OCR em um transmissor digital de pressão ou vácuo.
3. Em instrumentos analógicos, configure e confirme a escala impressa em **Escala e enquadramento**, uma vez por máquina e parâmetro neste navegador. Os padrões são exemplos: pressão 0–14 kgf/cm², vácuo 0 a −760 mmHg. Confirme início, fim, unidade e ângulos no instrumento real. Os limites de processo não são a escala do mostrador. Alterar a escala exige nova confirmação.
4. Em visores, confirme a unidade se ela diferir da unidade cadastrada. Fotografe **um único número** da zona correspondente. Uma foto completa de várias zonas da IHM não identifica qual delas corresponde ao parâmetro.
5. Clique em **Tirar foto**, permita a câmera, enquadre o instrumento na prévia ao vivo e toque em **Capturar foto**. **Trocar câmera** alterna a preferência entre frontal e traseira, conforme a disponibilidade do dispositivo. **Escolher arquivo** acessa uma imagem já capturada. A leitura começa automaticamente e preenche o campo, sem digitação. Com **Enviar automaticamente** marcado, o resultado é salvo diretamente no sistema.
6. Se a imagem ficar pendente, use posição e zoom em **Escala e enquadramento** e clique em **Analisar enquadramento**, ou tire uma foto melhor. O sistema não substitui uma leitura desconhecida por um valor fictício. A correção manual continua disponível como alternativa.

O OCR roda no navegador com Tesseract.js 6.0.1, core 6.0.0 e modelo inglês compacto empacotados no projeto. Não exige chave, cobrança por consulta ou chamada a uma API de IA. O modelo contém os caracteres necessários para ler números e unidades; a interface continua em português. O carregamento inicial é mais demorado. Sirva a pasta `dist` por HTTP com **INICIAR-DEMO.cmd** ou `npm run demo`; abrir o HTML diretamente por `file://` não permite o worker de OCR.

O OCR normaliza imagens com fundo claro/escuro e compara duas interpretações (tons de cinza e contraste). Ambas precisam reconhecer o mesmo número e ter confiança ≥75. Texto com vários números, unidade incompatível, texto inválido ou discordância fica pendente. Esse índice é do reconhecedor; não certifica a precisão do instrumento. Ponto e vírgula decimais são aceitos, sem inferir separadores invisíveis. Escalas analógicas usam análise geométrica do ponteiro e conversão de unidade, porque OCR dos números da escala não determina a posição do ponteiro.

A configuração do tipo, unidade e escala fica guardada localmente por máquina/parâmetro. Confira novamente ao trocar o instrumento físico. O enquadramento é ajustado para cada foto. Uma leitura em andamento é descartada se mudar a máquina, o enquadramento ou a leitura manual; não é enviada ao novo contexto.

## Acesso à câmera

A captura usa `getUserMedia`, com vídeo sem áudio, dentro de uma janela do sistema. O vídeo é encerrado ao capturar, fechar, trocar de câmera, mudar de página ou ocultar a aba. Se a permissão chegar depois de fechar a janela, o stream também é encerrado. A imagem capturada segue o mesmo enquadramento, leitor local e envio automático das fotos escolhidas por arquivo.

A câmera exige permissão do usuário e contexto seguro: **HTTPS** ou **localhost no próprio dispositivo**. Um endereço HTTP com IP de outro computador não equivale a localhost. Visualizadores de HTML em editores e páginas incorporadas podem bloquear a câmera; nesse caso, abra o sistema no navegador Chrome/Safari com uma origem segura, ou use a opção de foto já capturada. O sistema informa o bloqueio e permite tentar novamente, sem abrir a galeria no lugar da câmera.

## OCR no servidor local

`localhost` é compatível com a leitura local quando o aplicativo disponibiliza os arquivos e workers. Alguns editores acrescentam usuário e senha à URL da página. O OCR remove essas credenciais dos caminhos enviados ao worker, mantendo host, porta e pasta. O build gera `eng-model.js` a partir dos mesmos bytes de `eng.traineddata.gz`. A página carrega esse script local e passa os bytes ao worker, sem baixar o `.gz` por `fetch`. O carregamento do script usa a sessão HTTP do navegador. O worker não baixa o modelo. Um adaptador local normaliza os códigos de idioma na inicialização do Tesseract v6, mantendo os arquivos do fornecedor intactos. Isso corrige o erro “Request cannot be constructed from a URL that includes credentials”. O aplicativo ainda precisa permitir workers e servir os arquivos do modelo/core incluídos no ZIP.

## Apresentação

**Testar com imagem de exemplo** aparece somente no cenário de demonstração. A cada clique, alterna entre **cinco imagens geradas** por parâmetro e tipo de instrumento, com contador de 1 a 5; após a quinta, volta à primeira. Visores variam valores, fundo claro/escuro e formato decimal. Quando há faixa de processo cadastrada, os exemplos incluem valores dentro e fora dela, na unidade configurada. Ponteiros variam posição dentro da escala confirmada, ou usam uma escala própria de demonstração quando a escala real ainda não foi confirmada. O contador informa a escala usada pelo exemplo; a opção “Conferi a escala” permanece desmarcada. Essa dispensa só se aplica a imagens geradas no cenário: fotos escolhidas/capturadas continuam exigindo confirmação. Os exemplos centralizam o enquadramento para a imagem gerada. Cada imagem passa pelo mesmo OCR ou leitor de ponteiro real. Não retorna um número aleatório fingindo ter interpretado uma foto. Se o lote estiver vazio, usa `LT-DEMONSTRACAO`. As imagens e registros ficam marcados como **EXEMPLO / DEMONSTRAÇÃO**, inclusive na origem dos parâmetros e nos gráficos. Essa opção não está disponível na fonte real, e as regras Firebase recusam a marca de exemplo.

## Integração e evidência

As leituras alimentam **Produção → Parâmetros**, **Apontamentos**, os detalhes da máquina, o mapa/supervisório e a análise gráfica. Cada parâmetro conserva sua própria última leitura e horário. Guarda JPEG do enquadramento, horário real da captura, máquina, setor, lote, operador/RE, valor extraído, valor registrado, método (`ocr-local`, `ponteiro-local`, `manual` ou adaptador) e confiança do OCR quando disponível. A conferência do supervisor permanece independente.

**Confirmar e enviar** registra uma leitura conferida pelo operador. **Corrigir e reenviar** atualiza o mesmo registro, sem duplicar a foto. O histórico permite ver a evidência e corrigir depois de recarregar. Valores corrigidos conservam o valor inicialmente extraído quando o enquadramento não muda.

O envio não requer baixar ou importar CSV. Os exports existentes incluem as leituras; campos não fotografados permanecem vazios. Uma pressão não preenche temperaturas do estudo de capacidade. Depois de receber foto, o parâmetro deixa de ser sobrescrito pela simulação.

No cenário, os registros ficam na sessão deste navegador. Não há sincronização entre dispositivos. A data do registro acompanha o relógio do cenário; o horário da captura é o horário real. Em `?dados=reais`, o registro é enviado ao Firebase e compartilhado conforme as permissões. Publique **database.rules.json** atualizado para aceitar `ocr-local` e `confianca`. O ZIP não publica regras nem altera dados reais.

A evidência é JPEG 320 × 320, com até aproximadamente 160 KB. A análise digital usa o enquadramento da imagem original em 640 × 640, enquanto a evidência armazenada é compactada. Ampliar não recupera detalhes ausentes da captura. O sistema registra instantes fotografados, não monitora continuamente. Reflexos, inclinação, ponto decimal apagado, displays de sete segmentos e imagens com vários valores podem falhar ou exigir reenquadramento. O leitor é um protótipo: ainda precisa de validação com fotos dos equipamentos reais, especialmente visores de sete segmentos, antes de uso operacional.

## Leitor externo opcional

`MSA.gaugeReader.setAdapter({ async read({image, parameter, machineId}) { /* retornar {value}, na unidade parameter.unidade */ } })` continua disponível. Um adaptador real tem prioridade sobre os leitores locais; deve rejeitar fotos sem leitura e retornar apenas um valor finito na unidade de destino. Chaves externas pertencem ao servidor, não ao navegador.

## Verificação

- `npm test`: parsing, unidades, preservação, correção, exportação e acesso.
- `npm run test:ocr`: **motor OCR verdadeiro**, sem mock de leitura, com recursos locais e a política CSP de produção. Cobre vírgula/ponto decimal, fundo escuro, envio automático, vários números, imagem vazia, correção, identificação dos exemplos, descarte de resultado antigo, persistência e viewport móvel. Somente a entrega de um resultado é atrasada deliberadamente no teste de troca de máquina.
- `npm run test:ocr-local-auth`: servidor local com autenticação HTTP e caminho de pastas aninhado; bloqueia deliberadamente o download `.gz` por fetch na página e no worker; carrega o script do modelo no servidor autenticado, usa core/leitor reais e verifica o envio.
- `npm run test:examples`: cinco imagens/valores digitais interpretados pelo OCR real, cinco posições de ponteiro, ciclo independente por parâmetro/tipo, retorno ao primeiro exemplo, vácuo negativo, identificação e envio em viewport móvel.
- `npm run test:camera`: captura de vídeo com câmera virtual do Chromium, OCR real e envio automático sob CSP de produção; troca de câmera, liberação ao fechar, permissão tardia/negada e galeria separada em viewport móvel.
- `npm run test:photo`: ponteiro, conversão, envio, correção, persistência e temas.
- `npm run test:analysis` e `npm run test:motion`: preservação dos gráficos e animações.
- `npm run build`: inclui worker, core e modelo de OCR na distribuição, sem dependências de CDN para a leitura.

Testes Firebase com emulador exigem `MSA_DATABASE_EMULATOR_JAR`; sem ele são sinalizados como ignorados. Os testes de interface não representam uma validação da câmera física de um celular nem da precisão metrológica.
