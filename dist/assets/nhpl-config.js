export const nhplConfig = {
  machineId: 'NHPL', title: 'NHPL · Montagem de abafadores',
  disclaimer: 'Layout conceitual — sujeito à validação',
  transport: 'transferencias', // transferencias | paletes | esteira | carrossel; validar antes de alterar
  stations: [
    {id:'entrada',name:'Entrada',position:[-8,0,0],stage:0,activity:'Disponibilização conceitual dos componentes'},
    {id:'montagem-a',name:'Montagem A',position:[-4,0,0],stage:1,activity:'Montagem parcial ilustrativa'},
    {id:'montagem-b',name:'Montagem B',position:[0,0,0],stage:2,activity:'Complementação ilustrativa do conjunto'},
    {id:'verificacao',name:'Verificação',position:[4,0,0],stage:3,activity:'Verificação conceitual — etapa não confirmada'},
    {id:'saida',name:'Saída',position:[8,0,0],stage:3,activity:'Único ponto de contagem de produtos acabados na demonstração'}
  ],
  models: {
    'VGARD HP': {color:0x32a67c, cupStage:0, cushionStage:1, bandStage:2},
    'MARK V': {color:0xe0b73c, cupStage:0, cushionStage:1, bandStage:2}
  },
  variants: ['Low','Medium','High'],
  variantAssociation: 'Associação modelo/variante pendente: entrevista cita VGARD HP e MARK V (Low / Medium / High), sem discriminar a associação.',
  demo: {order:'OP-DEMO-NHPL',batch:'LOTE-DEMO-001',shift:'Turno demonstrativo',unit:'conjunto demonstrativo — unidade real a confirmar'},
  goals: [{id:'demo-v1',source:'simulated',validFrom:'2026-01-01',validTo:'2027-01-01',shift:'Turno demonstrativo',order:'OP-DEMO-NHPL',shiftTarget:1200,hourTarget:150}],
  alertProposal: {enabled:false,formula:'aprovados da hora / meta da hora × 100',period:'hora civil',bands:[{below:60,recipient:'Gerência'},{below:80,recipient:'Supervisão'},{below:95,recipient:'Líderes'}]}
};
