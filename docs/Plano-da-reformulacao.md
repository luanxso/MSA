# Plano de reformulação — 7 de outubro de 2026

Plano definido antes da implementação, a partir das três imagens e da inspeção de seis quadros do vídeo de 128,57 segundos. O ZIP indicado em Downloads não está mais nesse caminho; a base disponível é `MSA-Sistema-Integrado`, extraída e consolidada no workspace, versão 0.5.0.

## Objetivo e direção visual

O Mapa da Planta será a superfície principal: ocupa a altura e a largura disponíveis após o cabeçalho e o menu, sem título ou blocos externos empurrando a planta para baixo. Fundo carvão/verde muito escuro, grade discreta, cores translúcidas por setor, textos claros, equipamentos desenhados e rótulos compactos. A marca MSA permanece. O mapa pode ser expandido para toda a janela.

O supervisório representa o processo em uma linha industrial ilustrada. Capacetes e protetores auditivos do tipo concha (fones/abafadores) aparecem como peças identificáveis e mudam de aparência ao atravessar as etapas. Não é uma reprodução de máquinas ou processos aprovados da MSA.

## Planta fictícia

Desenho sem escala, com mais de vinte equipamentos ilustrativos e oito setores: recebimento/estoque em cinza, injeção em azul, acabamento em ciano, montagem de capacetes em amarelo, montagem de fones em verde, qualidade/testes em rosa, embalagem em laranja e expedição em violeta. Corredores e abastecimento separam as áreas. Máquinas têm código, estado por texto/cor, produto e avanço do ciclo.

Rotas de capacetes: matéria-prima → injeção do casco → acabamento → montagem da suspensão → inspeção → embalagem → expedição.

Rotas de fones: componentes → injeção das conchas → acabamento → colocação de espuma/almofadas → união ao arco → inspeção → embalagem → expedição.

## Navegação e interações

1. Abrir Mapa da Planta mostra a fábrica completa, setores, rotas de produção e contagens simuladas.
2. Filtrar setor, estado e produto destaca a operação e sua rota; selecionar um setor ajusta a câmera.
3. Zoom, arrastar, ajuste e tela cheia permitem explorar. A legenda de setor não se confunde com a legenda de estado.
4. Clicar/usar teclado em uma máquina abre seu supervisório na mesma área. Voltar conserva a câmera.
5. O supervisório apresenta identificação, estado, produto, ordem fictícia e indicadores compactos; o desenho domina a área.
6. Peças se deslocam em uma esteira passando por cinco estações. O casco recebe suspensão e inspeção; as conchas recebem espuma, almofadas e arco. O produto final segue para embalagem.
7. Etapa atual, progresso, contagem, refugos e parâmetros usam a fonte comum já existente. Pausa e cenário interrompem movimento e produção da máquina selecionada. Abas existentes de paradas, qualidade e histórico continuam disponíveis.

## Dados e limites

Geometria, equipamentos adicionais, ordens, peças e ritmos são fictícios e ficam na simulação em memória. A simulação não grava no Firebase. Login, cadastro e módulos operacionais existentes são preservados. Registros manuais continuam respeitando o contexto/permissões; sem telemetria não se inventa ciclo ou OEE. O catálogo operacional real não recebe as máquinas especulativas da demonstração.

## Implementação e validação

Arquivos previstos: `dist/assets/plant-layout.js`, `dist/assets/plant.css`, `dist/js/plant-ui.js`, novo módulo de desenhos do processo e ajuste pontual do catálogo simulado em `telemetry-service.js`. Documentação e testes existentes serão ajustados à planta ampliada.

Verificar: tela de computador/tablet/celular; mapa preenchendo a área; contraste e rótulos; filtros e câmera; rotas; capacetes/fones reconhecíveis; pausa/parada/setup/manutenção; contagens congeladas; navegação de retorno; fontes manuais/API; ausência de gravação da simulação. Executar testes pertinentes e build, inspecionar capturas e entregar ZIP atualizado. Publicar no Site existente se o acesso disponível permitir, preservando o público atual.
