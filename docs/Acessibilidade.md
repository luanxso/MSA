# Acessibilidade

Abra **Configurações → Acessibilidade**, disponível para todos os cargos.

- **Cores e daltonismo:** padrão MSA, alternativa para dificuldade de distinguir vermelho/verde (azul, ocre e roxo), alternativa para azul/amarelo (verde azulado, marrom e rosa) e tons de cinza. Teste a opção que oferecer melhor leitura para você. As alternativas adaptam cores sem simular nem corrigir a visão do usuário.
- **Tamanho do texto:** 100%, 112% ou 125%. O zoom do navegador continua disponível.
- **Alto contraste:** reforça textos e bordas no tema claro e escuro.
- **Mais espaço para leitura:** aumenta espaçamento entre letras, palavras e linhas.
- **Reduzir animações:** desativa transições e movimento ilustrativo do supervisório sem pausar os dados. A redução de movimento do sistema operacional também continua sendo respeitada.
- **Restaurar acessibilidade:** retorna essas opções ao padrão; preserva tema, sessão e dados do sistema.

A preferência é local ao navegador, aplicada também nas páginas de acesso e sincronizada entre abas da mesma origem. Não exige Firebase nem API. Se o navegador bloquear o armazenamento, a alteração funciona na página atual e uma mensagem informa que não foi salva.

O mapa mantém símbolos de estado e os painéis mantêm nomes textuais. Os gráficos de análise diferenciam linhas por traços contínuos e tracejados. As opções de acessibilidade não são uma certificação de conformidade WCAG.

## Verificação

`node --test tests/accessibility.test.mjs` verifica aplicação imediata, persistência, restauração, sincronização entre abas, armazenamento bloqueado, valores inválidos e integração com a camada Motion. A versão integrada também passou por verificação no navegador: acesso pelos quatro cargos, preferências imediatas, persistência ao recarregar, sincronização entre abas, texto em 125%, tema escuro com alto contraste e viewport móvel. Reduzir animações mantém a atualização dos dados; restaurar acessibilidade conserva tema, cargo e registros.

Referências: https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html e https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions
