# Cadastro por RE e contexto de trabalho — versão 0.4.2

O funcionário pode trabalhar em setores diferentes. Sua identidade deve permanecer estável; máquina e setor identificam a operação daquele momento.

| Momento | Campos ou ações |
| --- | --- |
| Cadastro | Nome, RE, Cargo e Senha; acesso imediato, sem setor ou máquina |
| Login | RE e Senha; preserva zeros iniciais do RE |
| Operador | Escolhe **Máquina em uso** entre os equipamentos cadastrados; o setor vem da máquina |
| Supervisor | Escolhe o **setor em acompanhamento** no cabeçalho e pode trocar durante o uso |
| Chefe | Mantém filtros de setor/máquina e a visão consolidada |

## Dados e permissões

`perfis/{uid}` mantém nome, RE e cargo. `setorId` e `maquinaId` começam vazios e guardam somente o contexto atual. O mesmo UID e RE continuam válidos quando esses campos mudam. Perfis existentes conservam o contexto; perfis antigos sem contexto não recebem uma lotação automática.

O seletor usa o catálogo compartilhado `maquinas` do Firebase, incluindo equipamentos criados depois do cadastro. O perfil ativo pode consultar esse catálogo. Para atualizar seu contexto, o Operador precisa escolher uma máquina existente cujo setor corresponda ao informado. O Supervisor escolhe um dos setores configurados. Alterar contexto não permite alterar cargo, RE ou a origem de um registro.

As consultas operacionais continuam filtradas pela máquina em uso ou setor em acompanhamento. Quando o contexto muda, as assinaturas anteriores são interrompidas e a sessão carrega o novo escopo. Sem contexto, a interface orienta a escolha antes de registrar dados; não consulta apontamentos sem filtro.

Cada produção, parada, perda, ocorrência ou leitura guarda `usuarioId`, `usuarioRe`, `maquinaId`, `setorId` e horários próprios. Trocar de posto não reclassifica dados antigos. O Chefe continua vendo ambos os setores; os supervisores acompanham os registros do setor selecionado, mesmo que seu autor já esteja trabalhando em outro.

## Ativação

A publicação no Sites disponibiliza o código da interface. Para usar o fluxo no Firebase real, publique as regras atualizadas de `database.rules.json` em **Realtime Database → Rules → Publish**, conforme [Firebase.md](Firebase.md). A chave pública do aplicativo não concede acesso administrativo para fazer essa publicação. Não há migração que apague apontamentos ou recadastre funcionários.

## Arquivos desta mudança

- Cadastro/validação: `dist/cadastro.html`, `dist/assets/auth-ui.js`, `dist/assets/validation.js`, `dist/assets/auth-service.js`.
- Contexto e páginas: `dist/assets/operations-service.js`, `dist/js/operations-ui.js`, `dist/js/script.js`, `dist/sistema.html`, `dist/assets/operations.css`.
- Regras: `database.rules.json`.
- Verificação: `tests/auth-service.test.cjs`, `tests/database-rules.test.mjs`, `scripts/test-browser.mjs`. O teste antigo `tests/presentation.test.mjs` foi removido porque dependia do modo local já substituído pelo Firebase.
- Documentação: `README.md`, `docs/Firebase.md`, `docs/Arquitetura.md`, `docs/Roteiro-demonstracao.md`, `docs/Design-acesso.md`, `docs/Alteracoes.md` e este arquivo.
- Versão: `package.json` e `package-lock.json`.

A identidade visual, fotografia real, componentes e autenticação Firebase foram preservados. Não foi criada outra coleção nem armazenamento operacional em `localStorage`.

## Verificação

35 testes passaram, incluindo as regras no emulador oficial do Realtime Database. O teste de navegador confirmou o início sem contexto, escolha de máquina, troca entre Montagem e Selagem mantendo o mesmo RE, atualização do Supervisor e Chefe, preservação dos registros antigos e ausência de overflow em desktop e celular. Authentication usa identidades de teste nesse ambiente; os testes não escrevem nem publicam regras no Firebase remoto.
