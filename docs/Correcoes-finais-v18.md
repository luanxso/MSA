# Correções finais — versão 18

Atualização do projeto da versão 17, em 09/10/2026. As dez falhas confirmadas na análise final foram corrigidas no código e incluídas na validação de regressão.

| Caso | Comportamento corrigido |
| --- | --- |
| Foto parcial após restauração | Fotos não recebem material, espessura ou os 41 campos simulados do estudo do Selo. Campos fictícios legados em fotos de demonstração são removidos ao restaurar. Leituras manuais do estudo mantêm os campos informados. |
| Reinspeção e refugo adicional | Refugo adicional reclassifica peças anteriormente aprovadas. Um lote com 90 aprovadas e 10 refugadas, com descarte total de 20, passa a 80 aprovadas e 20 refugadas, mantendo 100 peças. O apontamento original continua disponível para auditoria. |
| Correção de foto antiga | Data da leitura, turno, captura e autoria originais são preservados. A correção atualiza o valor e a data de atualização do registro. |
| Períodos sobrepostos | Tempo planejado e meta usam a união de intervalos por máquina. Dois lotes simultâneos não duplicam o tempo. Reenvio do mesmo lote/produto/período é recusado mesmo com quantidade diferente; editar o registro continua permitido. |
| Turno do apontamento | O formulário infere o turno pelo início e o atualiza quando o horário muda. Os serviços de demonstração e Firebase recusam turno incompatível e períodos que atravessam uma troca de turno. O terceiro turno pode atravessar a meia-noite. |
| Alteração de meta | Mudanças passam a registrar vigência em `historicoMetas`. Turnos encerrados usam a meta anterior; mudanças durante o período são integradas proporcionalmente ao tempo. Meta zero é respeitada. |
| Paradas entre turnos | Cada cálculo considera apenas a interseção da parada com o turno e dia produtivo selecionados. Uma parada das 14h50 às 15h10 contribui dez minutos para cada turno. As listas mantêm os registros originais para edição e encerramento. |
| Passagem de turno | O resumo encerra no menor valor entre fim do turno e horário atual. A passagem do primeiro turno às 16h não inclui paradas iniciadas depois das 15h. |
| Taxas da simulação | Os seletores mostram a porcentagem vigente, inclusive 0,8%, 2% e valores personalizados. O valor exibido corresponde ao usado pela simulação. |
| Contraste dos botões | O fundo sob o ponteiro usa o tema vigente. Texto e fundo mudam juntos na troca de tema, eliminando a queda momentânea de contraste. |

Os mesmos valores líquidos de produção abastecem indicadores, análise da produção, comparação de turnos, passagem e exportação do estudo de capacidade. Os painéis mostram a quantidade original e a quantidade reclassificada quando aplicável. O supervisório NHPL também resolve a vigência da meta pelo instante exato e mostra a meta de cada janela histórica.

Na apresentação hora a hora, apontamentos que abrangem mais de uma hora têm suas quantidades distribuídas pela duração. Isso é identificado na interface como quantidade proporcional. A soma conserva o volume apontado; metas por hora eliminam sobreposições por máquina.

## Instalação e compatibilidade

Extraia o pacote e use os comandos habituais do projeto. A versão mantém o OCR e o modelo local empacotado da v17.

Para a fonte Firebase real, publique o `database.rules.json` desta versão ao atualizar a aplicação. As regras incluem o histórico de metas e o vínculo `producaoId` das novas reclassificações de refugo. Cadastros anteriores sem esses campos continuam compatíveis.

O histórico de metas começa a ser registrado nesta versão. Alterações antigas sem registro de vigência não podem ser reconstruídas automaticamente. Novas decisões de refugo são vinculadas aos apontamentos de origem e ao período produtivo correspondente; a data de criação conserva o momento da decisão.

## Validação executada

- `npm test`: 179 casos, **176 aprovados**, **zero falhas**, três testes de integração Firebase ignorados por ausência do emulador.
- `npm run build`: concluído, 105 recursos estáticos, Worker do chat e migrações D1 empacotados.
- 20 suítes de navegador aprovadas: auditoria, OCR, fotos, câmera, exemplos de foto, análise, navegação, catálogo/temas, turnos, fluxos, planta, Motion, OCR com autenticação local, cenário, chat de demonstração, ciclos, parâmetros, qualidade, NHPL e regressões finais.
- Contraste mínimo de 4,5:1 verificado no catálogo em temas claro e escuro e larguras de 390, 768 e 1536 pixels; o botão sob o ponteiro também foi verificado.
- NHPL validada com WebGL por renderização de software no ambiente de testes, além de foco, controles, perda de comunicação e permissões.
- Serviços Firebase exercitados com adaptadores em memória; expressões das novas regras verificadas em casos permitidos e recusados. **Não houve validação contra Firebase em produção nem contra o emulador real.**

O roteiro de navegador foi ajustado para aguardar o fechamento dos diálogos antes de preencher buscas ou verificar a devolução do foco. As verificações originais foram mantidas.

## Repetir os testes

```sh
npm test
npm run build
npm run test:regressoes
```

O teste de navegador precisa de Playwright e Chromium. Para usar instalações externas, configure `MSA_PLAYWRIGHT_MODULE` e `MSA_CHROME_BINARY`, conforme os demais testes do projeto. Os novos casos locais estão em `tests/final-regressions.test.mjs`; as verificações de interface estão em `scripts/test-final-regressions-browser.mjs`.
