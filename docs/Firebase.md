# Ativar o Firebase deste protótipo

O código utiliza a configuração pública original de `msa-safety-9f978`, presente em `dist/assets/firebase-config.js`. Não foi criada uma segunda base. O SDK modular continua na CDN oficial 12.19.0. Authentication identifica a conta; Realtime Database compartilha os dados operacionais e o chat.

**As regras foram validadas no emulador oficial, mas não foram publicadas no projeto remoto.** A chave pública do aplicativo não permite publicar regras ou configurar provedores. Nenhuma conta ou apontamento foi criado no Firebase remoto durante o desenvolvimento.

## Configuração inicial

1. Abra o projeto `msa-safety-9f978` no Firebase Console.
2. Em **Authentication → Sign-in method**, habilite **E-mail/senha**.
3. Confira a política de senha. O protótipo usa mínimo de **6 caracteres**; se existir política obrigatória mais forte, use uma senha que a satisfaça ou ajuste a política do projeto para a demonstração. A interface aceita até 64 caracteres.
4. Em **Authentication → Settings → Authorized domains**, inclua o domínio onde o protótipo será servido. Se usar servidor local, confira `localhost`.
5. Em **Realtime Database → Rules**, substitua o conteúdo pelo arquivo **`database.rules.json`** da raiz e clique em **Publish**. Use a instância informada em `firebase-config.js`.
6. Sirva `dist` em HTTP/HTTPS. Cadastre os três perfis da demonstração.
7. Pelo Chefe, prepare máquinas em **Configurações**. Pelo Operador, escolha **Máquina em uso** e registre. Pelo Supervisor, selecione o setor no cabeçalho e acompanhe; pelo Chefe, confira os indicadores.

Alternativa para quem já usa o Firebase CLI autenticado:

```sh
firebase deploy --only database --project msa-safety-9f978
```

Essa publicação é apenas das regras do Realtime Database. Não publica o site. Não importe um JSON na raiz para preparar a demonstração: o próprio botão de preparação adiciona apenas os setores/máquinas ausentes.

## Contas e escopo

O login solicita RE e senha. O RE vira um alias interno `re-<RE>@msa-safety-9f978.invalid`; não precisa existir uma caixa postal. Zeros iniciais são preservados. Senhas ficam sob responsabilidade do Firebase Auth, sem campos de senha no banco operacional.

O cadastro do protótipo solicita Nome, RE, Cargo e Senha e já cria um perfil ativo, sem setor ou máquina. `setorId` e `maquinaId` começam vazios. Dentro do sistema, o Operador escolhe uma máquina cadastrada, e seu setor é derivado dela; o Supervisor escolhe o setor em acompanhamento. Esses campos guardam o contexto atual e podem mudar com a mesma conta. Chefe acompanha os três setores. Não existe aprovação de cadastro ou fila de liberação. Um perfil criado não pode promover seu próprio cargo alterando o banco.

Para reutilizar perfis reais antigos compatíveis, o adaptador migra `gestor` para `chefe` e perfis pendentes de cargos compatíveis para ativos. Conserva nome, RE e data de criação. Perfis sem contexto começam vazios; nenhuma máquina ou setor é atribuído automaticamente. Contextos existentes são conservados. Perfis bloqueados continuam sem acesso. Cargos antigos sem correspondência automática (`lider`, `manutencao`, `qualidade`) devem receber um dos três cargos pelo responsável no Console ou ser recriados para a demonstração.

Contas do modo local anterior não são contas Firebase. Recrie-as com RE e senha de pelo menos seis caracteres. Os dados guardados nos navegadores não foram apagados nem importados. Se a conta Auth for criada, mas o perfil falhar por conexão/regras, corrija a causa e repita o cadastro com o mesmo RE e senha. Um perfil existente nunca é sobrescrito pelo cadastro.

## Regras fornecidas

- Leitura e escrita são negadas por padrão.
- Todos os perfis ativos consultam o catálogo de máquinas para escolher seu contexto. Esse acesso não permite registrar dados em qualquer máquina sem escolhê-la como contexto atual.
- Operador pode atualizar a própria máquina/setor, desde que a máquina exista e pertença ao setor informado. Consulta os registros da máquina em uso e aponta/corrige registros de sua autoria. Origem, autor e data de criação não podem mudar.
- Supervisor pode escolher outro setor. Consulta registros/perfis do setor em acompanhamento, confere registros e atualiza os campos de encerramento/resolução; não substitui a quantidade original da produção. Pode cadastrar/editar máquinas e atribuir uma máquina do setor a um Operador atualmente nesse setor.
- Chefe consulta os setores e altera metas das máquinas; não grava apontamentos dos operadores. Pode preparar o catálogo inicial.
- Cadastro cria somente o perfil do UID autenticado, compatível com o alias do RE. A escolha inicial de cargo é deliberadamente simples para a apresentação.
- Nome, quantidade, unidade, períodos, limites e origem são validados também no banco.
- Consultas de O/S devem incluir o filtro exigido pelas regras. Esconder o menu não libera consultas sem esse filtro.
- Conversas privadas exigem participação. O diretório do chat contém apenas identificação mínima.

## Conexão e histórico

Os módulos de operação usam `onValue`: outras sessões recebem mudanças pela conexão Firebase. O indicador no cabeçalho informa a conexão com o Firebase. Se já estiver desconectado, o serviço recusa novos apontamentos; não usa armazenamento local como alternativa. Se a conexão cair durante um envio, pode haver uma operação ainda aguardando confirmação. O erro orienta consultar o histórico antes de reenviar, para evitar duplicação manual.

O chat mantém sua interface original e consulta mensagens a cada 5 segundos enquanto aberto. Rascunhos não enviados ficam em memória. O envio tem chave de idempotência: repetir a mesma mensagem com a mesma chave reaproveita o registro.

Relatórios/indicadores usam os registros atuais. Consolidações armazenam somente setor, responsável, período e resumo. Não há cópia extra dos totais. Corrigir um registro atualiza o relatório sem somar uma segunda produção.

A recuperação por e-mail continua desativada, pois o alias do RE não recebe mensagens. O botão informa o canal de suporte do sistema. Analytics opcional não impede o uso em caso de bloqueio/falha; não foram adicionados eventos contendo nome, RE, senha ou UID.

## Verificação executada

Testes unitários de Authentication usam o adaptador simulado. Testes de regras executam o JAR oficial do Realtime Database Emulator com tokens fictícios, cobrindo consultas e escritas permitidas/negadas. O teste de navegador usa Chrome, o SDK de Database real e o emulador; substitui somente Authentication por identidades de teste no servidor local. Não altera o Firebase remoto e não comprova a configuração do provedor/domínio no seu projeto.

Referências oficiais: [Authentication por senha](https://firebase.google.com/docs/auth/web/password-auth), [leituras e gravações](https://firebase.google.com/docs/database/web/read-and-write), [condições das regras](https://firebase.google.com/docs/database/security/rules-conditions), [API das regras](https://firebase.google.com/docs/reference/security/database) e [Realtime Database Emulator](https://firebase.google.com/docs/emulator-suite/connect_rtdb).
