# MSA do Brasil — Login e Cadastro com Firebase

**Para a apresentação, estas etapas não são necessárias.** O modo apresentação está
ativado em `dist/assets/config.js`: cadastre nome, RE, cargo e uma senha simples.
O cadastro é liberado imediatamente, sem aprovação no Firebase. O login continua
usando o RE e a senha cadastrados. O chat utiliza perfis e mensagens de demonstração
armazenados no navegador.

As instruções abaixo se aplicam somente quando `presentation.enabled` for alterado
para `false`, retomando o acesso Firebase e o chat compartilhado.

Login e Cadastro por RE conectados ao projeto `msa-safety-9f978`.
A identidade MSA e a responsividade foram preservadas. O login e o cadastro foram
simplificados, com a foto do letreiro sem textos sobrepostos, menos repetições e
sem divisórias decorativas.
HTML, CSS e JavaScript, com Firebase Web SDK modular 12.19.0 via CDN oficial.

## Ativar no Firebase Console

A configuração Web enviada está em `dist/assets/firebase-config.js`. Ela inicializa o
aplicativo, Firebase Authentication, Realtime Database e Analytics. A configuração Web
não concede acesso administrativo para habilitar provedores ou publicar regras.

1. No projeto `msa-safety-9f978`, abra **Authentication → Sign-in method** e habilite
   **E-mail/senha**. A aplicação continua solicitando somente **RE e senha**.
2. Em **Authentication → Settings → Password policy**, configure a política como
   obrigatória: mínimo de 8 caracteres, maiúscula, minúscula e número. A interface limita
   a senha a 64 caracteres. A validação do navegador não substitui a política do servidor.
3. Em **Realtime Database → Rules**, publique `database.rules.json`. Se já houver regras
   de outros módulos, integre o bloco `perfis` às regras existentes, preservando as
   autorizações desses módulos. O arquivo fornecido nega os demais caminhos por padrão.
4. Crie um cadastro pelo sistema. Em **Realtime Database → Data**, localize
   `perfis/<uid>`. Confira o RE contra a base de funcionários e aprove o cargo:
   adicione `cargo` com um dos IDs abaixo e altere `status` para `ativo`.
   Um acesso em análise permanece com `status: "pendente"`; use `bloqueado` para retirar
   as permissões. Também é possível desabilitar a conta em Authentication.

| Cargo | ID para o campo cargo |
| --- | --- |
| Operador | operador |
| Líder | lider |
| Supervisor | supervisor |
| Manutenção | manutencao |
| Qualidade | qualidade |
| Gestor | gestor |

Para aplicar as regras usando um Firebase CLI já autenticado com autorização administrativa:

```sh
firebase deploy --only database --project msa-safety-9f978
```

O site continua hospedado em Sites. `firebase.json` configura somente o banco, sem alterar
hospedagem. A conexão com o projeto real depende da ativação do provedor e das regras;
não foram criadas contas de teste no projeto remoto nem modificadas suas regras pelo assistente.

## RE e autenticação

O RE é preservado como string, incluindo zeros à esquerda. A regra provisória continua
sendo de 4 a 10 dígitos. O adaptador converte internamente o RE em
`re-<RE>@msa-safety-9f978.invalid`, pois o provedor de senha do Firebase utiliza e-mail.
Esse endereço técnico não é um e-mail corporativo nem um canal de comunicação.
A unicidade desse alias no Authentication impede dois cadastros para o mesmo RE.

A senha é transmitida somente ao Firebase Authentication por HTTPS. Não é salva no
Realtime Database, nos perfis nem pelo código da aplicação em localStorage. O Firebase
SDK gerencia os tokens da sessão. **Lembrar de mim** seleciona persistência local do SDK;
sem marcar, a sessão fica restrita à aba. O usuário pode encerrá-la pelo botão Sair.
O RE lembrado e o RE recém-cadastrado são apenas preferências locais, sem autoridade sobre
identidade ou permissões. O RE não é incluído nos novos links de navegação.

Os perfis de apresentação não são contas Firebase e não são migrados automaticamente.
Ao desativar o modo apresentação, cadastre as contas necessárias no Firebase. Não há
troca automática para a apresentação em caso de falha no acesso real.

Se o Authentication criar a conta, mas a gravação do perfil falhar, corrija a conexão ou
as regras e repita o cadastro com o mesmo RE e senha. O adaptador autentica a conta
existente e conclui somente um perfil ainda inexistente, sem sobrescrever um perfil aprovado.

## Perfis e níveis de acesso

O cadastro salva `nome`, `re`, `cargoSolicitado`, `status: "pendente"` e `createdAt`
com timestamp do servidor em `perfis/<uid>`. Somente o próprio usuário pode ler seu
perfil pelas regras fornecidas. O cliente pode criar apenas seu perfil pendente e não
pode alterar cargo aprovado, status ou outros perfis. A aprovação é feita pelo administrador
no Firebase Console ou futuramente em um backend com Admin SDK.

`cargoSolicitado` registra a seleção do funcionário. `cargo` contém o cargo aprovado.
Escolher Gestor no formulário não concede permissões. Perfis pendentes ou bloqueados
podem consultar seu estado de acesso, mas não recebem áreas operacionais.
A página inicial acompanha alterações do próprio perfil e encerramento de sessão.

`config.js` organiza os seis cargos, suas áreas e permissões de interface. A matriz
continua sendo uma proposta do projeto, sem representar uma política oficial da MSA.
Ao adicionar cargos, atualize também as validações de cargo em `database.rules.json`.
Ao criar módulos de produção, máquinas ou relatórios, implemente suas regras de dados
no Firebase verificando UID, status ativo e cargo aprovado. `MSA.auth.can()` organiza
somente a interface; não protege dados por si só. Os módulos futuros estão negados nas
regras atuais e não foram implementados como um dashboard.

## Recuperação e Analytics

Como o login utiliza um alias de RE sem caixa postal, a recuperação por link de e-mail
não foi habilitada. A tela encaminha ao suporte para confirmação de identidade.
A redefinição poderá ser feita por um serviço administrativo com Admin SDK ou por um
futuro canal corporativo verificado; não há redefinição de senha com a chave Web pública.

Analytics é inicializado somente em ambientes compatíveis. Bloqueadores, restrições do
navegador ou falhas de Analytics não impedem autenticação. A integração não envia nome,
RE, senha ou UID como eventos personalizados/propriedades de usuário, e remove query
strings e fragmentos dos parâmetros de URL configurados no Analytics.

## Executar e verificar

Abra o site HTTPS publicado ou sirva o diretório `dist`:

```sh
python3 -m http.server 8000 --directory dist
node --test tests/auth-service.test.cjs
```

Os testes usam um cliente Firebase simulado, sem criar usuários no projeto real. Verificam
cadastro pendente, login por RE, zeros à esquerda, persistência, erros, recuperação de
cadastro incompleto, logout e os seis cargos após aprovação. Não substituem um teste de
ponta a ponta com o projeto configurado. As regras precisam ser publicadas pelo responsável
com acesso administrativo antes de validar a integração real.

## Organização

| Arquivo | Responsabilidade |
| --- | --- |
| dist/assets/styles.css | Visual original, tokens MSA e responsividade |
| dist/assets/config.js | Catálogo de cargos, áreas e regra de RE |
| dist/assets/validation.js | Validações dos campos |
| dist/assets/firebase-config.js | Configuração pública do projeto Firebase |
| dist/assets/firebase-client.js | SDK, inicialização e Analytics opcional |
| dist/assets/auth-service.js | Authentication, persistência e perfis |
| dist/assets/auth-ui.js | Eventos, loading, mensagens e acessibilidade |
| database.rules.json | Controle de acesso e validação dos perfis |
| firebase.json | Configuração de publicação das regras |
| tests/auth-service.test.cjs | Verificação local do contrato de autenticação |

Interfaces: `dist/index.html` e `dist/login.html` (Login), `dist/cadastro.html` (Cadastro),
`dist/acesso.html` (resumo do perfil e estado de liberação).

## Identidade e ativos

Base visual: https://us.msasafety.com/vbl/design . Arial; verde #009534 como destaque,
neutros e logo original com assinatura. Gotham não foi incluída sem licença disponível.
Créditos e fontes dos ativos em `ASSETS.md`. Ativos MSA pertencem aos respectivos titulares;
o protótipo não representa endosso oficial.

A interface mantém labels, autocomplete, validação por campo, foco no primeiro erro,
aria-describedby, aria-invalid, feedback anunciado, exibição de senha, Caps Lock e loading.
WebMCP opcional expõe somente navegação e requisitos públicos, sem acessar credenciais.

Referências técnicas: https://firebase.google.com/docs/web/alt-setup ,
https://firebase.google.com/docs/auth/web/password-auth ,
https://firebase.google.com/docs/auth/web/auth-state-persistence ,
https://firebase.google.com/docs/database/security .
