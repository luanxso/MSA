# MSA — Sistema integrado de gestão da produção

Login e cadastro por RE, menu responsivo por setor e chat entre funcionários em um único projeto HTML, CSS e JavaScript. A identidade visual e os arquivos de autenticação enviados foram preservados. Os demais módulos de produção continuam reservados para desenvolvimento.

## Fluxo de acesso

1. `dist/index.html` e `dist/login.html` abrem o login por RE e senha.
2. **Criar cadastro** abre `dist/cadastro.html`. O cadastro grava um perfil pendente no Firebase e oferece o retorno ao login.
3. Uma conta aprovada abre `dist/sistema.html` na área inicial do cargo. O header mostra o nome, RE e cargo da mesma conta.
4. Contas pendentes ou bloqueadas seguem para `dist/acesso.html`. A aprovação do perfil é acompanhada automaticamente e abre o menu quando o acesso é liberado.
5. **Sair** encerra a sessão Firebase, limpa os dados temporários do chat e volta ao login. Abrir `sistema.html` diretamente também exige uma sessão aprovada.

A configuração pública do projeto `msa-safety-9f978` está em `dist/assets/firebase-config.js`. O provedor E-mail/senha e as regras do Realtime Database precisam estar configurados pelo responsável. As instruções de ativação e aprovação estão em [docs/Firebase.md](docs/Firebase.md). A integração não criou contas no Firebase nem alterou suas regras remotamente.

O RE é preservado como texto, inclusive os zeros iniciais. **Lembrar de mim** controla a persistência do Firebase; nenhuma sessão simulada em armazenamento local libera o sistema. O menu permanece oculto enquanto o acesso é verificado, com opção de tentar novamente se a conexão falhar.

## Menu responsivo

Sidebar recolhível no desktop e tablet; drawer no celular, com fechamento por Escape e controle de foco. O seletor usa **Setor**, com Produção, Injeção, Montagem, Costura, Manutenção e Qualidade. Este catálogo inicial pode ser ajustado à estrutura oficial da fábrica.

Logotipo original da MSA, Arial e paleta MSA, com verde como destaque. Login e cadastro usam a foto do letreiro sem textos sobrepostos, identificação do sistema abaixo da logo e formulários sem divisórias decorativas. O menu e o chat mantêm seus estilos separados. Não foram acrescentados indicadores fictícios nem telas de produção preenchidas.

As áreas iniciais e permissões propostas por cargo estão em `dist/assets/config.js`. Os módulos de produção ainda estão vazios; futuras APIs devem verificar o cargo aprovado no servidor, além de organizar a interface.

## Chat integrado

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
| `dist/assets/` | Logo, fotografia, estilos e autenticação Firebase |
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

O servidor estático local não oferece a API do chat; a comunicação entre computadores requer o Worker com D1. O projeto Firebase deve estar configurado para validar o login real. Abrir os HTML diretamente como arquivos não substitui a execução por HTTP/HTTPS.

O build produz `dist/server/index.js`, um Worker ESM com recursos incorporados, manifesto e migrações. Sua configuração Firebase é obtida do mesmo arquivo usado pelo navegador. A publicação aplica as migrações D1. Gere uma nova migração com `npm run db:generate` somente após alterar `db/schema.ts`; não modifique migrações já aplicadas.

Os testes verificam cadastro, login, sessão, os seis cargos, aprovação, bloqueio, saída, identidade do chat, autorização de conversas individuais, repetição de envio e paginação. Usam respostas Firebase simuladas, sem contas ou senhas reais, e não substituem a validação com uma conta aprovada no projeto remoto.

Rotas do chat, todas com `Authorization: Bearer <token Firebase>`:

- `GET /api/chat/bootstrap`: identidade, canais e diretório de pessoas.
- `POST /api/chat/threads`: abre ou recupera uma conversa individual.
- `GET /api/chat/messages?conversation=…`: histórico; aceita `before` ou `after`.
- `POST /api/chat/messages`: envia uma mensagem.

Referências técnicas: [Firebase Auth REST](https://firebase.google.com/docs/reference/rest/auth) e [autenticação do Realtime Database REST](https://firebase.google.com/docs/database/rest/auth). Fontes dos ativos em [ASSETS.md](ASSETS.md).
