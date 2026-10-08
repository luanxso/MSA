# Dados para apresentação — versão atual

Os painéis agora carregam um cenário local preenchido para as 32 máquinas da planta. Nenhuma importação no Firebase é necessária. Abra `demonstracao.html` usando um servidor HTTP ou `npm run demo`. Datas se renovam a cada dia; o dia atual representa uma fotografia às 15h. Nos seis dias anteriores há exemplos completos dos três turnos, acessíveis pelo filtro em Produção. A consulta real continua disponível em `sistema.html?dados=reais`.

Leia [Painéis e cenário](Paineis-e-cenario.md) para os campos, fontes e fórmulas atuais.

## Importador anterior — opcional, não utilizado nesta entrega

O conteúdo abaixo documenta um conjunto antigo de cinco máquinas. Ele é independente do cenário local atual e não é necessário para apresentar os painéis preenchidos.

# Dados para preencher o sistema

O conjunto foi preparado para o cadastro operacional atual: três setores e cinco máquinas, com sete dias de exemplos, incluindo hoje. Contém 70 registros de produção, 14 leituras, 36 paradas (uma aberta), 75 perdas em peças/kg, cinco ocorrências, três consolidações e oito perfis ilustrativos. Não altera a planta ilustrativa de 32 equipamentos.

Os oito perfis têm nomes explícitos de exemplo e REs 990101–990103 e 990201–990205. São referências para as tabelas e a autoria dos exemplos; não são contas de login. Nenhuma senha ou conta Authentication foi criada. Para testar login, use suas contas já cadastradas. O chat continua usando as contas e mensagens existentes; este conjunto não envia mensagens nem cria conversas.

Os exemplos têm identificadores `demo-v1-` e observação de demonstração. As páginas operacionais mostram apenas uma indicação discreta quando esse conjunto está presente. No mapa, a indicação fica na fonte dos dados. O mapa animado continua separado dos apontamentos armazenados.

## Situação da entrega

Arquivos preparados e testados localmente. **A importação remota ainda não foi executada**, pois não havia uma autenticação administrativa disponível no computador. A chave pública de `firebase-config.js` não concede esse acesso. Não foram alteradas regras, permissões, contas ou dados do projeto remoto.

## Atualizar as datas antes de importar

Na pasta do projeto, execute com Node 24 ou superior:

```powershell
node scripts/demo-data.mjs
```

O arquivo `demonstracao/dados.json` contém o conjunto, e `demonstracao/resumo.json` informa as quantidades. Gere novamente no dia da apresentação para que os filtros de hoje encontrem dados.

## Importação que preserva os dados existentes

Um responsável com acesso administrativo ao projeto `msa-safety-9f978` deve fornecer ao processo um token OAuth temporário com acesso ao Realtime Database, pela variável de ambiente `MSA_FIREBASE_ACCESS_TOKEN`. A credencial não deve ser enviada no chat, incluída no ZIP ou no código do site. A [documentação de autenticação do Firebase](https://firebase.google.com/docs/database/rest/auth) explica o acesso OAuth.

```powershell
node scripts/import-demo-data.mjs
node scripts/import-demo-data.mjs --apply
```

A primeira execução só consulta e apresenta a quantidade de itens ausentes. A segunda faz backup das nove coleções em `.firebase-backups` antes da primeira escrita e acrescenta apenas itens ausentes. Uma gravação condicional por ETag impede substituir um item criado entre a leitura e o envio. Máquinas existentes são conservadas; conflitos de setor interrompem a operação antes das escritas. Uma execução interrompida pode ser repetida sem duplicar os mesmos IDs.

Não importe `dados.json` diretamente na raiz pelo Console: isso substituiria a árvore selecionada. Não afrouxe as regras para permitir a importação pelo navegador. Use o importador administrativo para preservar os cadastros.

Referência: [gravações condicionais REST do Firebase](https://firebase.google.com/docs/database/rest/save-data).
