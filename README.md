# MSA — Sistema integrado de gestão da produção

Versão 0.4.3. O projeto existente foi adaptado para **Operador, Supervisor e Chefe**, preservando a identidade MSA, login por RE, menu responsivo e interface do chat. Os módulos operacionais usam o **Firebase Authentication e o Realtime Database já configurados no projeto**.

O Login foi atualizado com formulário centralizado, fotografia MSA no fundo do viewport, overlay escuro e card branco a 97%. O Cadastro conserva a composição original. O visual do Login usa `dist/assets/login-layout.css`, separado do CSS compartilhado para preservar as outras páginas. A análise das telas anteriores, as decisões visuais, os arquivos alterados e as capturas estão em [docs/Design-acesso.md](docs/Design-acesso.md). O cadastro mantém os campos e o acesso imediato; não há nova etapa de aprovação.

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

Nomes, metas e limites do catálogo inicial são **exemplos**, não parâmetros aprovados da MSA. O Supervisor pode cadastrar os parâmetros reais em Máquinas. O seletor da operação usa o catálogo compartilhado no Firebase, incluindo máquinas adicionadas posteriormente.

O painel usa navegação estrutural em carvão, setor no header e leitura da operação por equipamentos. **Visão geral** é a entrada para os três cargos. A análise visual e as decisões estão em [docs/Design-painel.md](docs/Design-painel.md).

## Telas e fluxo

A matriz completa de objetivos, dados, ações e acessos está em [docs/Arquitetura.md](docs/Arquitetura.md).

| Cargo | Página inicial | Acesso exclusivo | Escopo |
| --- | --- | --- | --- |
| Operador | Visão geral | Apontamentos | Máquina em uso; cria e corrige registros próprios |
| Supervisor | Visão geral | Conferência | Máquinas, operadores e registros do setor em acompanhamento |
| Chefe | Visão geral | Indicadores | Visão de todos os setores; ajuste de metas |

**Funcionários e Relatórios** são compartilhados por Supervisor e Chefe. **Visão geral, Produção, Máquinas, Paradas, Qualidade, Ocorrências, Chat, Notificações e Configurações** são acessíveis aos três cargos, com dados e ações limitados ao contexto de cada um.

A conferência marca os registros e identifica o Supervisor. Não impede que os dados apareçam imediatamente nos indicadores. Uma correção do Operador mantém o mesmo registro, a origem e a data de criação, e o deixa novamente a conferir.

O Supervisor adiciona o resumo do setor e o período em Conferência. Relatórios e Indicadores calculam os totais a partir dos registros atuais; a consolidação não duplica a produção nem congela totais desatualizados.

## Persistência

Dados operacionais, perfis e chat utilizam o Firebase. A única preferência explícita em `localStorage` é o RE lembrado no login. Sessões são gerenciadas pelo Firebase Auth. Rascunhos de formulários/chat e estado do menu ficam na memória da página.

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

`npm test` inclui testes de autenticação, RBAC, métricas, sessão e compatibilidade do Worker. Para testar as regras no emulador real, informe o caminho do JAR oficial do Realtime Database:

```sh
MSA_DATABASE_EMULATOR_JAR=/caminho/firebase-database-emulator.jar npm test
```

Teste opcional de navegador com Playwright e o mesmo emulador:

```sh
MSA_DATABASE_EMULATOR_JAR=/caminho/firebase-database-emulator.jar npm run test:browser
```

Esse teste precisa de Playwright e seu Chromium instalados no ambiente de desenvolvimento. `MSA_PLAYWRIGHT_MODULE` e `MSA_CHROME_BINARY` permitem indicar instalações existentes. `MSA_FIREBASE_SDK_DIR` permite reutilizar cópias locais dos módulos públicos do SDK; sem essa opção o teste baixa os dois módulos oficiais. Os testes usam dados e identidades de teste, sem escrever no projeto Firebase real.

O roteiro para sexta-feira está em [docs/Roteiro-demonstracao.md](docs/Roteiro-demonstracao.md). O inventário de persistência, limitações e arquivos alterados está em [docs/Alteracoes.md](docs/Alteracoes.md). Fontes dos ativos originais em [ASSETS.md](ASSETS.md).
