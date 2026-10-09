# Animações do MSA

Motion JavaScript 12.23.24, incluído localmente em `dist/assets/vendor`, com licença MIT. Não requer conexão ou instalação para abrir a demonstração.

- Transições de páginas e abas sem repetir efeitos a cada atualização dos dados.
- Abertura e fechamento dos diálogos (incluindo Escape), preservando foco e validações.
- Menu lateral e notificações; as mensagens continuam fechando após 10 segundos ou pelo X.
- Movimento interpolado das peças e mecanismos do supervisório, derivado dos mesmos ciclos. Nenhum contador ou leitura é alterado pela animação.
- Interrupção quando pausado, parado, sem leitura atual, com a aba do navegador oculta ou com preferência de movimento reduzido.

A camada comum fica em `motion-ui.js` e `motion-ui.css`. Os desenhos e a disposição das máquinas foram preservados.

## Validação

- Testes automatizados: 140 aprovados; 2 testes de integração com Firebase/emulador não executados.
- Navegação: 13 abas, paginação, filtros, teclado, três larguras e dois temas.
- Planta: seis tamanhos de tela, janelas nativas, foco, câmera, filtros, pausa e fontes de dados.
- Motion: transições, atualização ao vivo sem repetir efeitos, notificações consecutivas, Escape, menu móvel, suavização do processo e movimento reduzido.

Use `npm run test:motion` para repetir a verificação específica em um ambiente com Playwright e Chromium instalados.
