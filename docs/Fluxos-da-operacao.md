# Cinco fluxos para a rotina da liderança

Esta versão utiliza o cenário fictício existente e mantém a consulta real com Firebase. Não envia e-mails nem se conecta a CLPs. Os motivos, horários, metas e exemplos precisam ser validados com a MSA antes de uso operacional.

## Apresentar os cinco fluxos

1. Abra `demonstracao.html`. Em **Paradas**, clique em **Demonstrar microparada**, selecione uma máquina que esteja operando e uma duração. O estado da máquina muda no mapa, os ciclos param e a retomada encerra o registro automaticamente. Selecione o motivo depois, sem digitar. Há exemplos históricos de microparadas em todos os setores.
2. Em **Passagem de turno**, registre máquina, dia e turno. O resumo é calculado a partir dos registros: planejado/realizado, lote, ordem, paradas, refugos e problemas. Acrescente ações e pendências. Em **Configurações**, abra a apresentação como Supervisor ou Chefe para confirmar o recebimento por outra identidade. As pendências continuam visíveis entre turnos até serem concluídas. O resumo da entrega não muda com novos ciclos.
3. Em **Qualidade**, um registro de refugo ou de peças suspeitas sinaliza o lote inteiro daquela máquina. Abra o cargo **Qualidade** por Configurações ou pelo cadastro. Use **Avaliar lote** para confirmar segregação na área vermelha, iniciar reinspeção e decidir entre liberar as peças conformes ou destinar o lote inteiro ao descarte. A conclusão exige reinspeção de toda a quantidade conhecida do lote. O descarte inclui as rejeições já identificadas; apenas rejeições adicionais criam novos registros de refugo. Não há retrabalho. As contagens da produção preservam os apontamentos de origem; a disposição final do lote aparece separadamente na Qualidade.
4. Em **Notificações**, reconheça um alerta, inicie atendimento e registre a conclusão. A condição de origem precisa estar normalizada para concluir. A normalização não apaga o atendimento. Cada etapa preserva nome, RE, horário e observação. O destinatário segue as faixas de produtividade existentes; o canal disponível é a tela do sistema. **Ativar som** habilita um aviso curto para novos alertas, sem repetir a carga inicial.
5. Em **Funcionários**, escolha dia e turno, confirme presença e redistribua o posto. Ausentes não ocupam máquina. Postos sem equipe confirmada aparecem acima da tabela. O Supervisor administra seu setor; o Chefe pode redistribuir entre setores. O registro do turno mantém RE, origem e histórico sem alterar os apontamentos antigos nem o login do operador.

## Motivos de parada

A lista inicial reúne travamento de pallet/peça, falha no alimentador, falta de material/componente, sensor sem leitura/desalinhado, ajuste de máquina/processo, troca de molde/ferramenta, troca de produto/setup, manutenção corretiva, manutenção preventiva, pressão/ar comprimido fora do limite, falta de energia, inspeção/bloqueio da Qualidade, posto sem operador e pausa programada. **Outro motivo** abre um campo obrigatório somente quando selecionado. Observações e a ação de encerramento são opcionais no registro de parada.

Essas categorias são um ponto de partida para a apresentação, não um levantamento validado das causas da MSA. A lista central está em `dist/assets/production-workflows.js`, em `reasons`, e atende registro manual e classificação posterior.

## Coleta e persistência

- A simulação continua ao navegar entre painéis, sem exigir o mapa aberto. A pausa interrompe o relógio global. Fechar a página não fabrica produção offline; alterações são preservadas na sessão do navegador, inclusive depois de recarregar ou trocar o cargo de demonstração. Restaurar dados em Configurações reinicia também os cinco fluxos.
- Uma microparada simulada abre um registro com início e termina no instante previsto. Um avanço maior de tempo é dividido na retomada para não recuperar ciclos do período parado. A classificação é independente da duração capturada. As microparadas entram no tempo de parada existente, sem somar um segundo total de downtime.
- O cenário produz ocasionalmente uma microparada de 8 a 27 segundos: uma oportunidade a cada 45 segundos com chance de 30%, em um equipamento que esteja operando. O botão permite mostrar o fluxo sem depender desse sorteio. Essas probabilidades são apenas ilustrativas.
- Para produção real independente de navegador e usuário, a integração futura precisa de um coletor conectado a sinais validados de CLP/IHM. Ele deverá distinguir intervalo normal entre ciclos de interrupção, preservar timestamps, abrir/encerrar registros e evitar duplicidade em reconexões. Nenhum equipamento real foi conectado nesta entrega.
- Em `sistema.html?dados=reais`, classificações e registros dos fluxos usam Firebase: `passagensTurno`, `lotesQualidade`, `atendimentosAlertas` e `alocacoes`. Lotes e alertas ainda sem decisão são derivados dos apontamentos disponíveis; decisões e atendimentos são gravados. Publique a versão atualizada de `database.rules.json` antes de utilizar os novos registros e o cargo Qualidade nesse modo. As regras não foram publicadas no projeto da empresa durante esta alteração.
- Apenas o cargo Qualidade decide lotes. A autenticação e o chat reconhecem esse quarto cargo. O cadastro simplificado existente foi preservado.
- E-mail, escala nominal de chamados e escalonamento por falta de resposta dependem de integração e critérios ainda a confirmar com a empresa. Não há indicação de envio de e-mail concluído na interface.

## Verificação

Os testes incluem duração e retomada de microparadas, limites de acesso, passagem com resumo imutável e pendências compartilhadas, reinspeção integral, descarte sem duplicar refugo, resolução de alerta após normalização, alocação por turno e restauração sem duplicar lotes ou alertas. O teste no navegador percorre os cinco fluxos, temas claro/escuro, telas de 390/768/1536 pixels e produção contínua fora do mapa. Regras Firebase foram verificadas em emulador; nenhuma escrita de teste foi feita no banco da empresa.

## Navegação dos painéis

Produção, Qualidade e Paradas mantêm os filtros e os indicadores no topo e exibem apenas a aba selecionada. As tabelas mostram até 8 registros por página, com Anterior, Próxima e a faixa de registros. Os totais dos indicadores consideram o período completo, independentemente da página da tabela ou da busca textual.

- **Produção:** Resumo, Por turno, Hora a hora, Apontamentos e Parâmetros.
- **Qualidade:** Resumo, Lotes em avaliação, Refugos e perdas e Histórico. Lotes em avaliação reúne pendências atuais, inclusive de dias anteriores; Histórico reúne decisões concluídas no intervalo filtrado. Refugos e perdas contém os apontamentos do período.
- **Paradas:** Resumo, Em andamento, Microparadas e Histórico. As paradas abertas têm uma aba própria; o histórico mostra as encerradas. A classificação das microparadas continua disponível em sua aba.

A busca aceita código ou nome da máquina, lote e motivo nos conteúdos das listas. Datas, turno, máquina, setor e situação reiniciam a paginação quando alterados. Os históricos apresentam primeiro os registros mais recentes. Detalhes abre responsável, conferência e observações; Detalhes e histórico abre a avaliação e as etapas do lote. Registrar uma parada ou uma perda abre a aba correspondente ao novo registro.

No celular, as linhas das tabelas são reorganizadas em blocos com rótulos, sem exigir rolagem horizontal para consultar os campos. As abas também funcionam por teclado: setas esquerda/direita, Home e End. Atualizações automáticas preservam a aba e a página escolhidas.

Validação de navegação: `node scripts/test-page-navigation-browser.mjs` (com Playwright e Chrome disponíveis).

## Chat para apresentação

O cenário fictício tem dez canais: Produção, Passagem de turno e os oito setores. Cada canal possui um histórico próprio, com participantes, assuntos e horários diferentes. Os temas acompanham o setor: estoque e abastecimento, molde e parâmetros, acabamento, inspeção de lotes, montagem de capacetes, NHPL, etiquetas e expedição.

Em Pessoas, cada funcionário tem uma conversa individual com a liderança, usando sua função, setor e equipamento para contextualizar o assunto. Nome, RE, função e posto/setor ajudam a diferenciar funcionários de nomes iguais. A busca aceita esses dados. Os envios ficam somente na conversa escolhida; alternar canais ou sair da aba não mistura as mensagens.

O botão **Simular nova mensagem**, disponível no cenário fictício, acrescenta uma atualização do setor ou do funcionário selecionado. A nova mensagem é marcada como simulada, permitindo demonstrar a chegada de informação sem escrever uma resposta em outra conta. Essa ação não registra produção, não decide lotes e não envia mensagens reais. Recarregar a página restaura os históricos fictícios iniciais.

A fonte real `?dados=reais` continua usando o adaptador Firebase, sem históricos fictícios e sem o botão de simulação. Validação específica: `npm run test:chat-demo`.
