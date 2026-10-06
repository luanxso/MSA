# MSA — Sistema integrado de gestão da produção

Login, cadastro, menu responsivo por setor e chat em um único projeto HTML, CSS e JavaScript. **O modo apresentação vem ativado:** mantém RE e senha, com cadastro liberado imediatamente e sem aprovação no Firebase. Os demais módulos de produção continuam reservados para desenvolvimento.

## Apresentar o sistema

1. Abra `dist/index.html` ou o site publicado e selecione **Criar cadastro**.
2. Preencha nome, RE, cargo e senha. O nome pode ser simples, o RE aceita de 1 a 10 números e a senha não exige maiúsculas, números ou símbolos. Não há confirmação de senha ou aprovação manual.
3. **Cadastrar e entrar** libera o perfil e abre o menu imediatamente. Depois de sair, use o mesmo **RE e senha** para entrar. O cargo já vem do cadastro, sem seleção adicional no login.
4. Abra **Chat** para mostrar canais por setor, passagem de turno e conversas individuais entre perfis de demonstração. As conversas começam vazias; você pode digitar e enviar mensagens.
5. Para demonstrar dois participantes, crie dois cadastros com REs diferentes no mesmo navegador. Envie uma mensagem, saia e entre com o RE e senha do outro cadastro. As mensagens locais permanecem disponíveis.

O acesso e o chat de apresentação funcionam sem chamadas ao Firebase ou à API do chat. Os cadastros e mensagens são demonstrativos e ficam apenas no navegador utilizado; não são compartilhados entre computadores. A senha é verificada localmente e seu texto não é armazenado; o cadastro guarda um hash com salt. Use o site HTTPS publicado ou um servidor em `localhost` e mantenha o armazenamento do navegador disponível para conservar os cadastros entre páginas.

Abrir `dist/sistema.html` sem uma sessão retorna ao login por RE e senha. A tela identifica o **Modo apresentação**. **Lembrar de mim** preenche o RE no próximo acesso.

Para voltar ao acesso Firebase, altere `presentation.enabled` de `true` para `false` em `dist/assets/config.js` e publique novamente. O fluxo descrito abaixo passa a valer. Na apresentação, não é necessário executar as etapas de ativação do Firebase.

## Fluxo de acesso Firebase (modo apresentação desativado)

1. `dist/index.html` e `dist/login.html` abrem o login por RE e senha.
2. **Criar cadastro** abre `dist/cadastro.html`. O cadastro grava um perfil pendente no Firebase e oferece o retorno ao login.
3. Uma conta aprovada abre `dist/sistema.html` na área inicial do cargo. O header mostra o nome, RE e cargo da mesma conta.
4. Contas pendentes ou bloqueadas seguem para `dist/acesso.html`. A aprovação do perfil é acompanhada automaticamente e abre o menu quando o acesso é liberado.
5. **Sair** encerra a sessão Firebase, limpa os dados temporários do chat e volta ao login. Abrir `sistema.html` diretamente também exige uma sessão aprovada.

A configuração pública do projeto `msa-safety-9f978` está em `dist/assets/firebase-config.js`. O provedor E-mail/senha e as regras do Realtime Database precisam estar configurados pelo responsável. As instruções de ativação e aprovação estão em [docs/Firebase.md](docs/Firebase.md). A integração não criou contas no Firebase nem alterou suas regras remotamente.

No modo Firebase, o RE é preservado como texto, inclusive os zeros iniciais. **Lembrar de mim** controla a persistência do Firebase; os perfis demonstrativos locais não liberam o acesso real. O menu permanece oculto enquanto o acesso é verificado, com opção de tentar novamente se a conexão falhar.

## Menu responsivo

Sidebar recolhível no desktop e tablet; drawer no celular, com fechamento por Escape e controle de foco. O seletor usa **Setor**, com Produção, Injeção, Montagem, Costura, Manutenção e Qualidade. Este catálogo inicial pode ser ajustado à estrutura oficial da fábrica.

Logotipo original da MSA, Arial e paleta MSA, com verde como destaque. Login e cadastro usam a foto do letreiro sem textos sobrepostos, identificação do sistema abaixo da logo e formulários sem divisórias decorativas. O menu e o chat mantêm seus estilos separados. Não foram acrescentados indicadores fictícios nem telas de produção preenchidas.

As áreas iniciais e permissões propostas por cargo estão em `dist/assets/config.js`. Os módulos de produção ainda estão vazios; futuras APIs devem verificar o cargo aprovado no servidor, além de organizar a interface.

## Chat integrado com Firebase (modo apresentação desativado)

Canais por setor, passagem de turno e conversas individuais. As mensagens são persistidas no D1 da hospedagem e atualizadas a cada 5 segundos enquanto a página está visível. Rascunhos ficam na memória da página; recarregar ou sair descarta textos não enviados.

O chat usa o token da mesma sessão Firebase do login. O servidor consulta o Firebase Authentication e o perfil aprovado no Realtime Database antes de atender a cada solicitação. Nome e RE vêm desse cadastro; **Meu perfil** apenas exibe a identificação. Campos de autor enviados pelo navegador não substituem a identidade verificada. Mensagens conservam o nome e RE do momento do envio.

Conversas individuais são acessíveis somente pelos dois participantes. Uma chave por envio evita mensagens duplicadas após falha de rede. Erros de envio mantêm o texto digitado. No celular, a lista de conversas e a conversa selecionada ocupam telas separadas.

Para aparecer em **Pessoas**, outro funcionário precisa ter acesso ao site, uma conta aprovada e abrir o chat. Não há importação de contatos ou mensagens do Teams. Os canais são compartilhados entre contas aprovadas; selecionar um setor muda o contexto de navegação, não limita o acesso aos canais.

O público atual do site foi preservado. A liberação de uma conta no Firebase não adiciona acesso à hospedagem. Registros anteriores do D1 foram mantidos; identidades antigas da hospedagem não são vinculadas automaticamente às novas contas Firebase. O histórico dos canais permanece na mesma base.

## Organização

| Arquivo | Função |
| --- | --- |
| `dist/index.html`, `dist/login.html` | Login |
| `dist/cadastro.html` | Cadastro |
| `dist/acesso.html` | Estado de liberação da conta |
| `dist/sistema.html` | Menu responsivo e chat |
| `dist/assets/` | Logo, fotografia, estilos e adaptadores de acesso |
| `dist/assets/demo-service.js`, `dist/assets/demo-ui.js` | Entrada, cadastro e chat locais da apresentação |
| `dist/css/style.css` | Estilos do menu e chat |
| `dist/js/system-guard.js` | Verificação de sessão, identidade e saída |
| `dist/js/script.js` | Navegação e responsividade |
| `dist/js/chat.js` | Conversas e envio de mensagens |
| `worker/auth.js` | Validação da conta Firebase no servidor |
| `worker/chat.js` | API e persistência do chat |
| `worker/index.js` | Rotas e recursos estáticos |
| `db/schema.ts`, `drizzle/` | Esquema e migrações D1 |
| `database.rules.json`, `firebase.json` | Regras e configuração do Firebase |
| `scripts/build.mjs` | Build do Worker e arquivos de publicação |
| `tests/` | Testes locais com Firebase simulado e SQLite |

## Executar e publicar

Requer Node.js 24 ou superior para os testes com SQLite.

```sh
npm ci
npm test
npm run build
```

Para visualizar as telas e testar o acesso em um servidor local:

```sh
python3 -m http.server 8000 --directory dist
```

O servidor estático local permite demonstrar a entrada, o cadastro, o menu e o chat com o modo apresentação ativado. A comunicação real entre computadores requer o Worker com D1 e o modo Firebase configurado. Para compartilhar os perfis e mensagens demonstrativos entre telas locais, prefira servir todas as páginas pelo mesmo endereço HTTP.

O build produz `dist/server/index.js`, um Worker ESM com recursos incorporados, manifesto e migrações. Sua configuração Firebase é obtida do mesmo arquivo usado pelo navegador. A publicação aplica as migrações D1. Gere uma nova migração com `npm run db:generate` somente após alterar `db/schema.ts`; não modifique migrações já aplicadas.

Os testes verificam cadastro imediatamente ativo, login por RE e senha simples, credenciais incorretas, os seis cargos, sessão, saída e chat local da apresentação. Também preservam a verificação do acesso Firebase, aprovação, bloqueio, identidade do chat real, conversas individuais, repetição de envio e paginação. Usam respostas Firebase simuladas, sem contas ou senhas reais.

Rotas do chat, todas com `Authorization: Bearer <token Firebase>`:

- `GET /api/chat/bootstrap`: identidade, canais e diretório de pessoas.
- `POST /api/chat/threads`: abre ou recupera uma conversa individual.
- `GET /api/chat/messages?conversation=…`: histórico; aceita `before` ou `after`.
- `POST /api/chat/messages`: envia uma mensagem.

Referências técnicas: [Firebase Auth REST](https://firebase.google.com/docs/reference/rest/auth) e [autenticação do Realtime Database REST](https://firebase.google.com/docs/database/rest/auth). Fontes dos ativos em [ASSETS.md](ASSETS.md).
