# Roteiro para apresentar o fluxo MSA na sexta-feira

## Preparação

- Publique as regras e confira Authentication/domínio conforme `Firebase.md`.
- Abra três navegadores ou perfis separados: Operador, Supervisor e Chefe. Duas abas no mesmo perfil compartilham a sessão do Firebase Auth; use sessões independentes para os três cargos.
- Crie cadastros com REs distintos e senha de pelo menos seis caracteres. Exemplo: Operador RE 101, Supervisor RE 201, Chefe RE 301. Use senhas próprias, sem deixar credenciais no código.
- O cadastro não pede setor ou máquina. Pelo Chefe, abra Configurações e prepare o catálogo dos três setores, sem adicionar produção fictícia.
- Dentro do sistema, o Supervisor seleciona Montagem de abafadores no cabeçalho; o Operador escolhe `ABF-01` em **Máquina em uso**.
- Em Máquinas, o Supervisor pode ajustar os parâmetros/limites do exemplo. Os valores não representam receita validada da MSA.

## Demonstração de aproximadamente cinco minutos

1. **Operador — Apontamentos.** Mostre que ele vê sua máquina, não Indicadores ou Funcionários. Registre 240 peças aprovadas, turno, início/fim de um período encerrado, produto e lote/ordem.
2. **Supervisor — Produção.** Mostre o registro aparecendo em outra sessão, com máquina, RE, lote e quantidade. Explique que isso substitui a espera por foto/transcrição da planilha.
3. **Chefe — Indicadores.** Mostre o mesmo total refletido no setor e na máquina, sem recadastrar o dado. Troque o filtro para todos os setores.
4. **Operador — Paradas / Qualidade.** Registre uma parada com motivo e, separadamente, quatro peças refugadas ou 0,3 kg de material perdido. Mostre unidades distintas no painel.
5. **Supervisor — Conferência.** Confira o registro e adicione um resumo do setor com período e pendências. Encerre a parada com causa/ação. A conferência marca o registro, sem impedir sua visualização anterior.
6. **Chefe — Indicadores / Relatórios.** Mostre o resumo do Supervisor e os indicadores atualizados. Exporte o CSV como substituto da planilha consolidada manualmente.
7. **Operador — Correção.** Altere 240 para 250 no mesmo apontamento. Mostre que o total vira 250, não 490, e a indicação de conferência reinicia.
8. **Troca de setor com o mesmo RE.** Pelo Operador, escolha `SEL-01` em **Máquina em uso** e faça um novo apontamento. Pelo Supervisor, selecione Selagem no cabeçalho. Pelo Chefe, mostre o registro novo em Selagem e o anterior em Montagem; ambos mantêm o mesmo RE e máquinas de origem diferentes.
9. **Opcional — parâmetros/chat.** Registre leitura fora do limite e mostre Notificações; envie mensagem entre sessões.

## Frases para explicar o projeto

- “O Operador gera o dado na máquina; o Supervisor acompanha o setor; o Chefe compara a produção consolidada.”
- “É um sistema com três cargos. A mesma página muda os dados e as ações conforme o acesso.”
- “A conferência não atrasa a informação. Os indicadores usam os registros compartilhados no Firebase.”
- “O protótipo começa com entrada manual digital. A leitura de IHM/IoT pode ser integrada depois, mantendo a mesma estrutura de dados.”

Para a apresentação, mostre os dados que vocês registrarem durante a demonstração. Se não houver produção ou meta cadastrada, o sistema mostra ausência/zero de registros; não fabrica números.
