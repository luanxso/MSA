/* Planta e catálogo exclusivamente fictícios. Não altera máquinas do Firebase. */
window.MSA = window.MSA || {};
(() => {
  const areas = [
    {id:'recebimento',name:'Recebimento / estoque',short:'Estoque',x:40,y:64,width:220,height:816,kind:'storage',color:'#94a3b8',prefix:'EST',count:3,type:'storage'},
    {id:'injecao',name:'Injeção',x:292,y:64,width:540,height:354,kind:'production',color:'#459bff',prefix:'INJ',count:6,type:'injection'},
    {id:'acabamento',name:'Acabamento',x:864,y:64,width:360,height:354,kind:'production',color:'#22d3ee',prefix:'ACB',count:4,type:'sealing'},
    {id:'qualidade',name:'Qualidade / testes',short:'Qualidade',x:1256,y:64,width:300,height:354,kind:'quality',color:'#ec71b6',prefix:'QAL',count:4,type:'quality'},
    {id:'capacetes',name:'Montagem de capacetes',short:'Capacetes',x:292,y:510,width:460,height:370,kind:'production',color:'#f8ca52',prefix:'CAP',count:4,type:'assembly'},
    {id:'montagem',name:'Montagem de fones',short:'Fones',x:784,y:510,width:440,height:370,kind:'production',color:'#33d6a3',prefix:'ABF',count:4,type:'assembly'},
    {id:'embalagem',name:'Embalagem',x:1256,y:510,width:300,height:370,kind:'packing',color:'#fb923c',prefix:'EMB',count:4,type:'packing'},
    {id:'expedicao',name:'Expedição',x:1588,y:64,width:292,height:816,kind:'shipping',color:'#ac8cff',prefix:'EXP',count:3,type:'shipping'}
  ];
  const machines=[],placements={};
  areas.forEach(a => {
    for(let i=0;i<a.count;i++) {
      const id=a.id==='montagem'&&i===2?'NHPL':a.id==='acabamento'&&i===0?'SEL-01':a.prefix+'-'+String(i+1).padStart(2,'0');
      const columns=a.id==='recebimento'||a.id==='expedicao'?1:a.id==='injecao'?3:2;
      const rows=Math.ceil(a.count/columns),cell=a.width/columns;
      const x=a.x+cell*(i%columns+.5),y=a.y+116+Math.floor(i/columns)*(a.height-210)/Math.max(1,rows-1);
      const productKind=a.id==='montagem'||(a.id!=='capacetes'&&i%2===1)?'fones':'capacetes';
      const old=MSA.config.machines.find(m=>m.id===id);
      const names={storage:'Abastecimento',injection:'Injetora',sealing:'Acabamento',quality:'Bancada de testes',assembly:'Célula de montagem',packing:'Embaladora',shipping:'Doca de saída'};
      const simulationState=['SEL-01','INJ-05','ABF-04'].includes(id)?'parada':['INJ-02','CAP-02','EMB-04'].includes(id)?'setup':['ABF-02','ACB-04'].includes(id)?'manutencao':'operando';
      machines.push({...old,id,nome:(old?.nome||names[a.type]+' '+String(i+1).padStart(2,'0')),setorId:a.id,processo:a.name,produto:productKind==='fones'?'Protetor auditivo tipo concha':'Capacete de segurança',productKind,simulationState,order:'OP-'+(4100+machines.length),operator:['Ana Souza','Carlos Lima','Marina Alves','João Silva'][i%4],metaDiaria:old?.metaDiaria||1200+i*120,parametros:old?.parametros||{}});
      placements[id]={x,y,width:120,height:64,type:a.type,rotation:0};
    }
  });
  MSA.plantLayout=Object.freeze({id:'msa-planta-conceitual',version:3,width:1920,height:960,building:{x:20,y:36,width:1880,height:876},areas,machines,placements,
    corridors:[{x:276,y:438,width:1296,height:52,label:'CORREDOR CENTRAL · ABASTECIMENTO E TRANSFERÊNCIA'}],
    routes:[
      {id:'capacetes',name:'Capacetes',color:'#71767d',path:'M260 455 H848 V432 H1238 V455 H1580'},
      {id:'fones',name:'Fones',color:'#71767d',path:'M260 476 H768 V496 H1238 V476 H1580'}
    ]
  });
})();
