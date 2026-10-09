# Ativos do sistema

`dist/assets/msa-logo.png`: logotipo original MSA, sem redesenho ou alteração de proporções.

- Fonte e guia: https://us.msasafety.com/vbl/design
- Arquivo: https://assetlibrary.msasafety.com/m/45f4ad01658a2846/original/MSA_The-Safety-Company_Logo_RGB-png.png
- Dimensões: 901 × 430 pixels; PNG transparente.

`dist/assets/msa-campus.png`: imagem do letreiro MSA utilizada na captura de login
enviada pelo usuário. Foi reutilizada a versão editada anteriormente no projeto,
sem uma nova edição da imagem. Na versão 0.4.1 o arquivo permanece no projeto,
mas as telas de Login e Cadastro utilizam a fotografia da instrumentação enviada
pelo grupo. A imagem do letreiro não é apresentada como fotografia da fábrica MSA do Brasil.

- Origem no projeto: imagem fornecida pelo usuário, a partir de
  `a-logo-sign-outside-of-the-headquarters-of-msa-safety-inc-in-cranberry-township-pennsylvania-on-august-9-2019-WB9J8W.jpg`.
- Dimensões da versão utilizada: 1462 × 1080 pixels; PNG.

`dist/assets/msa-instrumentacao.jpg`: fotografia real dos instrumentos de pressão
e vácuo enviada pelo usuário junto ao material da visita. Utilizada uma vez em
cada tela de acesso, com legenda de origem. Os ponteiros pertencem à fotografia;
não representam valores atuais nem conexão automática com a máquina.

- Origem: `01-C-pia-de-WhatsApp-Image-2026-10-05-at-12.24.58.jpeg`.
- Dimensões: 1536 × 864 pixels; JPEG.
- Arquivo copiado integralmente, sem geração, retoque ou alteração de conteúdo.

Os ativos permanecem sujeitos aos direitos e condições de seus titulares. Usados como
referências em protótipo acadêmico solicitado para o projeto MSA; sem afirmação de endosso.

## Motion JavaScript

`dist/assets/vendor/motion-12.23.24.js`: distribuição oficial do Motion 12.23.24, incluída localmente para não depender de CDN ao executar o sistema.

- Origem: https://cdn.jsdelivr.net/npm/motion@12.23.24/dist/motion.js
- Licença MIT: `dist/assets/vendor/MOTION-LICENSE.txt`.
- A interface usa a API Mini para as transições de estilos e a API completa para interpolar as posições ilustrativas do supervisório.
