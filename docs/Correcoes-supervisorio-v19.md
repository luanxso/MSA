# Correção do movimento do supervisório — v19

O movimento da esteira dependia da biblioteca Motion. Quando esse arquivo não
carregava, o mapa e as peças ficavam imóveis mesmo com o ciclo atualizando.
A falha foi reproduzida bloqueando esse arquivo em uma página com caminho
`/MSA/`, como em uma publicação do GitHub Pages. Isso confirma esse caso de
falha; a publicação externa do usuário não foi inspecionada nesta revisão.

## Alteração

- As peças e mecanismos do supervisório usam quadros nativos do navegador,
  interpolando o avanço real recebido da mesma fonte de dados.
- O mapa continua se movimentando mesmo sem o arquivo opcional do Motion.
- Motion continua responsável pelas transições de menus, páginas e janelas.
- Pausas, paradas de máquina e acessibilidade continuam interrompendo o movimento.
- Os dados e contadores continuam seguindo a fonte original.
- O build atualiza as referências dos scripts para evitar cache da versão anterior.

## Publicação

Substitua os arquivos da publicação pelos arquivos atualizados de `dist`,
conservando a estrutura de pastas. Não basta enviar somente o ZIP ao repositório.
Se a publicação usa GitHub Actions, mantenha o build apontado para essa pasta.
Após publicar, recarregue a página com Ctrl+F5.

O movimento reduzido do dispositivo e a opção “Reduzir animações” de
Configurações continuam sendo respeitados. Na fonte “Registros do sistema”,
sem telemetria automática, o movimento exige dados de ciclo; o cenário fictício
continua usando os próprios ciclos da apresentação.

## Verificação

`npm run test:conveyor` verifica caminho em subpasta, ausência do Motion,
mapa, pop-up, supervisório completo, pausa/retomada, movimento reduzido,
aba oculta/visível e parada/retomada da máquina.
