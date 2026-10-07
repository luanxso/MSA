# MSA — Sistema integrado de gestão da produção

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
