# Resumo da atualização — versão 0.4.0

**Atualização do painel 0.4.3:** Visão geral passa a ser a entrada para todos os cargos. A estrutura visual, a leitura das máquinas e as decisões estão em [Design-painel.md](Design-painel.md). As exclusividades por cargo permanecem.

**Atualização 0.4.2:** o cadastro passou a identificar o funcionário por RE, sem setor ou máquina. O contexto de trabalho pode mudar durante o uso; registros históricos conservam sua origem. Veja o fluxo e os arquivos específicos em [Cadastro-por-RE.md](Cadastro-por-RE.md).

**Atualização visual 0.4.1:** Login e Cadastro foram analisados e adaptados para
a composição industrial descrita em [Design-acesso.md](Design-acesso.md).
Essa atualização preserva a integração, os cargos e as funcionalidades
operacionais descritas abaixo. A lista de arquivos e a validação específica
das telas de acesso estão no documento de design.

## 1. Operador

Página inicial: **Visão geral**. Tela exclusiva: **Apontamentos**. Também acessa Visão geral, Produção, Máquinas, Paradas, Qualidade, Ocorrências, Chat, Notificações e Configurações. Acompanha a máquina vinculada; cadastra/corrige produção, parâmetros, paradas, refugos, perdas e ocorrências de sua autoria. Não confere registros nem acessa gestão da equipe ou indicadores da fábrica.

## 2. Supervisor

Página inicial: **Visão geral**. Tela exclusiva: **Conferência**. Também acessa Funcionários e Relatórios, além das nove telas comuns. Acompanha seu setor, confere registros, encerra paradas, resolve ocorrências, escreve consolidações, cadastra/edita máquinas e parâmetros e altera a máquina atual dos operadores do setor.

## 3. Chefe

Página inicial: **Visão geral**. Tela exclusiva: **Indicadores**. Também acessa Funcionários e Relatórios e as nove telas comuns. Consulta dados de diferentes setores, comparação de metas/produção, perdas, paradas e resumos dos supervisores; pode ajustar metas em Máquinas. Não cadastra produção em nome do Operador.

## 4. Telas compartilhadas

- Supervisor/Chefe: **Funcionários e Relatórios**.
- Todos os cargos autenticados: **Visão geral, Produção, Máquinas, Paradas, Qualidade, Ocorrências, Chat, Notificações e Configurações**.
- Entrada comum: Login, Cadastro e Situação do acesso.

A matriz detalhada de objetivo, informações e ações está em `Arquitetura.md`. A interface usa os mesmos componentes, adaptando escopo e ações. Não foram criados três projetos ou três sistemas.

## 5. Fluxo

Operador → registro no Firebase → Supervisor acompanha/confere o setor → Supervisor adiciona resumo → Chefe visualiza os registros e a consolidação nos indicadores.

Os dados aparecem sem esperar aprovação. Corrigir um apontamento muda o mesmo registro e os totais; não duplica a quantidade. O setor/máquina, o autor e a criação permanecem identificados. Uma nova correção deixa o apontamento a conferir novamente.

Menus, rotas e comandos verificam RBAC. As regras do banco também verificam cargo, escopo e campos de escrita, incluindo acessos feitos fora da interface. Uma alteração de máquina atualiza a sessão do Operador aberta, mantendo a origem dos apontamentos anteriores.

## 6. Estrutura Firebase implementada

`perfis`, `setores`, `maquinas`, `registrosProducao`, `leituras`, `paradas`, `perdas`, `ocorrencias`, `consolidacoes`, `diretorio`, `conversas` e `mensagens`. As coleções são criadas conforme o cadastro/uso; não foram criadas remotamente durante este trabalho. Firebase Auth guarda as credenciais.

Cargo é um campo do perfil, com três políticas em código. Indicadores e notificações são calculados, sem duplicar totais em outra coleção. Consolidação guarda a análise do Supervisor com período, não cópias dos apontamentos.

Os registros possuem IDs de usuário/máquina/setor, RE de origem, data de criação e atualização e responsável pela edição; conferências identificam o Supervisor e o horário. Leituras podem incluir temperatura, vácuo, pressão, tempos e múltiplas zonas conforme configuração da máquina.

## 7. Armazenamento local removido

| Uso anterior | Chave / arquivo | Substituição |
| --- | --- | --- |
| Contas/senhas com hash locais | `msa.presentation.accounts.v2` em `demo-service.js` | Firebase Authentication + `perfis/{uid}` |
| Sessão demonstrativa local | `msa.presentation.session.v2` em `sessionStorage` | Sessão gerenciada pelo Firebase Auth |
| Histórico e contatos do chat local | `msa.presentation.chat.v1` em `demo-service.js` | `mensagens`, `conversas` e `diretorio` no Realtime Database |
| RE lembrado do modo demonstrativo | `msa.presentation.remembered-re` | Preferência do adaptador Firebase, sem autoridade de acesso |
| RE transitório do cadastro demonstrativo | `msa.presentation.registration-re` | Removido; cadastro entra imediatamente |
| RE transitório do adaptador Firebase | `msa.auth.registration-re` | Removido pelo mesmo motivo |
| Substituição do acesso real por apresentação local | `demo-service.js`, `demo-ui.js` | Scripts removidos; Firebase é a única origem compartilhada |

Todos os pontos ativos de `localStorage`/`sessionStorage` foram inventariados antes da mudança. No ZIP recebido **não havia persistência de produção, paradas ou perdas local**: esses módulos estavam vazios. Foram implementados já no Firebase. Não afirmamos ter importado registros históricos inexistentes no ZIP.

Dados dos navegadores dos usuários não estão no arquivo enviado; seus antigos cadastros/chat não foram importados nem apagados. As contas demonstrativas locais devem ser recriadas uma vez no Firebase. Perfis Firebase antigos compatíveis têm migração no login.

## 8. Armazenamento local mantido

A única chave explícita de `localStorage` mantida no código ativo é **`msa.auth.remembered-re`**: preenche o campo RE quando “Lembrar de mim” está selecionado. Não armazena senha, cargo, máquina, produção ou autorização. A persistência da sessão real é controlada pelo SDK do Firebase Auth.

Menu, filtros, formulários e rascunhos do chat permanecem na memória da página. Nenhuma preferência visual compartilhada foi inventada ou migrada desnecessariamente.

## Validação e ativação

Executados: 34 testes automatizados passando, incluindo publicação/avaliação das regras no **emulador oficial**. Também foi executado o teste de navegador com Chrome e SDK de Database real no emulador, em sessões independentes dos três cargos. Cobriu produção, correção sem duplicação, conferência, paradas, refugos, ocorrências, resolução, consolidação, chat público/privado, parâmetros incluindo vácuo negativo, múltiplas zonas, desvios, recusa de envio desconectado e mudança de máquina.

Verificadas telas em desktop e celular, drawer e ausência de overflow da página. Testes de credenciais utilizam Authentication simulado; no teste de navegador a identidade também é uma fixture local. O Firebase remoto não foi alterado. `npm run build` concluiu com os arquivos de publicação existentes.

Antes de usar no projeto real, habilite E-mail/senha, confira o domínio e publique `database.rules.json`, conforme `Firebase.md`. Não existe etapa extra de aprovação no protótipo. Metas e parâmetros iniciais são exemplos que precisam ser ajustados à operação da MSA. Indicadores representam os registros informados, sem leitura automática de máquina, OEE ou Cp/Cpk certificado.

## 9. Arquivos do projeto alterados

O inventário abaixo compara os bytes do ZIP original com o pacote entregue, incluindo arquivos criados/removidos e saída do build.

| Situação | Arquivo |
| --- | --- |
| Alterado | `README.md` |
| Alterado | `database.rules.json` |
| Alterado | `dist/acesso.html` |
| Alterado | `dist/assets/auth-service.js` |
| Alterado | `dist/assets/auth-ui.js` |
| Alterado | `dist/assets/config.js` |
| Alterado | `dist/assets/validation.js` |
| Alterado | `dist/cadastro.html` |
| Alterado | `dist/index.html` |
| Alterado | `dist/js/chat.js` |
| Alterado | `dist/js/script.js` |
| Alterado | `dist/js/system-guard.js` |
| Alterado | `dist/login.html` |
| Alterado | `dist/sistema.html` |
| Alterado | `docs/Firebase.md` |
| Alterado | `package-lock.json` |
| Alterado | `package.json` |
| Alterado | `tests/auth-service.test.cjs` |
| Alterado | `tests/chat.test.mjs` |
| Alterado | `tests/system-guard.test.mjs` |
| Alterado | `worker/auth.js` |
| Criado | `dist/.openai/hosting.json` |
| Criado | `dist/assets/firebase-chat.js` |
| Criado | `dist/assets/metrics.js` |
| Criado | `dist/assets/operations-service.js` |
| Criado | `dist/assets/operations.css` |
| Criado | `dist/assets/rbac.js` |
| Criado | `dist/drizzle/0000_neat_clea.sql` |
| Criado | `dist/drizzle/0001_firebase_identity.sql` |
| Criado | `dist/drizzle/meta/0000_snapshot.json` |
| Criado | `dist/drizzle/meta/0001_snapshot.json` |
| Criado | `dist/drizzle/meta/_journal.json` |
| Criado | `dist/js/operations-ui.js` |
| Criado | `dist/server/index.js` |
| Criado | `docs/Alteracoes.md` |
| Criado | `docs/Arquitetura.md` |
| Criado | `docs/Roteiro-demonstracao.md` |
| Criado | `scripts/test-browser.mjs` |
| Criado | `tests/database-rules.test.mjs` |
| Criado | `tests/emulator-fixture.mjs` |
| Criado | `tests/rbac.test.mjs` |
| Removido | `dist/assets/demo-service.js` |
| Removido | `dist/assets/demo-ui.js` |
| Removido | `tests/presentation.test.mjs` |
