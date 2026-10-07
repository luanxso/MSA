/* Uma fonte comum para planta e supervisório. Simulação não grava no Firebase.
   Adaptadores de API/IoT entram por useAdapter(), sem depender da interface. */
window.MSA = window.MSA || {};
(() => {
  'use strict';
  const states = Object.freeze({ operando:'Operando', parada:'Parada', manutencao:'Manutenção', setup:'Setup', desconhecido:'Sem dados' });
  const defaults = {
    injecao: { cycle:26, ideal:24, total:520, rejected:9, state:'operando', parameters:{ temperatura:{nome:'Temperatura do cilindro',unidade:'°C',min:230,max:260}, pressao:{nome:'Pressão de injeção',unidade:'bar',min:80,max:120} } },
    selagem: { cycle:18.7, ideal:18, total:620, rejected:21, state:'parada', parameters:{ temperatura:{nome:'Temperatura',unidade:'°C',min:250,max:260}, pressao:{nome:'Pressão',unidade:'bar',min:6.5,max:7}, vacuo:{nome:'Vácuo',unidade:'mmHg',min:-600,max:-300} } },
    montagem: { cycle:12, ideal:11, total:1032, rejected:12, state:'operando', parameters:{ forca:{nome:'Força de prensagem',unidade:'N',min:350,max:450} } }
  };
  const clone = value => JSON.parse(JSON.stringify(value));
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  function phase(machine) {
    if (machine.state!=='operando') return states[machine.state];
    const names = machine.setorId==='injecao' ? ['Fechamento','Injeção','Resfriamento','Extração'] : machine.setorId==='selagem' ? ['Alimentação','Prensagem','Selagem','Liberação'] : ['Alimentação','Montagem','Prensagem','Inspeção'];
    return names[Math.min(3,Math.floor(machine.cycleProgress*4))];
  }
  function efficiency(sample) {
    const run = sample.operatingSeconds, planned=sample.plannedSeconds, total=sample.totalCount;
    if (![run,planned,total,sample.idealCycleSeconds,sample.goodCount,sample.partsPerCycle].every(finite) || run<=0 || planned<=0 || total<=0 || sample.idealCycleSeconds<=0 || sample.partsPerCycle<=0 || sample.goodCount<0 || sample.goodCount>total) return null;
    const availability=run/planned, performance=(sample.idealCycleSeconds/sample.partsPerCycle)*total/run, quality=sample.goodCount/total;
    if (availability>1.001 || performance>1.001 || quality>1 || quality<0) return null;
    return { availability:availability*100, performance:performance*100, quality:quality*100, oee:availability*performance*quality*100 };
  }
  function createSimulator(catalog, now=Date.now()) {
    const machines=new Map();
    catalog.forEach((definition,index) => {
      const d=defaults[definition.setorId]||defaults.montagem;
      const second=/-02$/.test(definition.id);
      const cycle=d.cycle+(second?1:0), total=second?Math.round(d.total*.84):d.total;
      const operatingSeconds=total*cycle;
      const plannedSeconds=Math.max(14400,operatingSeconds+600);
      const stopSeconds=plannedSeconds-operatingSeconds;
      const state=definition.simulationState||(second ? (definition.setorId==='injecao'?'setup':'manutencao') : d.state);
      const periods=state==='operando' ? [
        ['operando',operatingSeconds*.45,'Produção iniciada'],['parada',stopSeconds*.6,'Abastecimento de material'],
        ['operando',operatingSeconds*.3,'Produção retomada'],['setup',stopSeconds*.4,'Ajuste de processo'],['operando',operatingSeconds*.25,'Produção retomada']
      ] : [['operando',operatingSeconds*.5,'Produção iniciada'],['setup',stopSeconds*.25,'Preparação do equipamento'],['operando',operatingSeconds*.5,'Produção retomada'],[state,stopSeconds*.75,state==='parada'?'Falha de avanço':state==='setup'?'Troca de ferramenta':'Intervenção programada']];
      let cursor=now-plannedSeconds*1000;
      const timeline=periods.map(([status,seconds,reason],i)=>{
        const item={state:status,start:cursor,end:i===periods.length-1?null:cursor+seconds*1000,reason};
        cursor+=seconds*1000;return item;
      });
      const parameters={...d.parameters,...definition.parametros};
      delete parameters.ciclo;
      const item={
        ...clone(definition),index,state,stateSince:timeline.at(-1).start,warning:definition.id==='INJ-01',warningSince:now-180000,
        plannedSeconds,operatingSeconds,setupSeconds:stopSeconds*(state==='setup'?1:state==='operando'?.4:.25),
        maintenanceSeconds:state==='manutencao'?stopSeconds*.75:0,stopSeconds:state==='parada'?stopSeconds*.75:state==='operando'?stopSeconds*.6:0,
        totalCount:total,rejectedCount:second?Math.round(d.rejected*1.4):d.rejected,cycleSeconds:cycle,idealCycleSeconds:d.ideal,partsPerCycle:1,
        cycleElapsed:state==='operando'?cycle*.36:0,cycleProgress:state==='operando'?.36:0,parameters,timeline,events:timeline.map(t=>({id:definition.id+'-'+t.start,time:t.start,type:'estado',description:t.reason,state:t.state})),
        samples:[],periodStart:now-plannedSeconds*1000,updatedAt:now,lastAt:now
      };
      const lastRun=[...timeline].reverse().find(t=>t.state==='operando'),lastCycleAt=lastRun.end||now;
      for(let n=0;n<24;n++)item.samples.push({time:lastCycleAt-(23-n)*30000,cycleSeconds:cycle+Math.sin(n)*.4,temperature:null});
      machines.set(definition.id,item);
    });
    function snapshot(item,stamp=item.updatedAt) {
      const values=Object.fromEntries(Object.entries(item.parameters).map(([key,p],i)=>{
        const middle=(p.min+p.max)/2, spread=(p.max-p.min)*.08;
        const value=item.warning&&i===0 ? p.max+Math.max(1,(p.max-p.min)*.08) : middle+Math.sin((stamp-item.periodStart)/9000+i+item.index)*spread;
        return [key,{...p,value,updatedAt:item.updatedAt,quality:'good',alarm:value<p.min||value>p.max}];
      }));
      const alarms=[];
      if(item.warning)alarms.push({code:'PAR-001',description:'Parâmetro acima do limite',severity:'aviso',since:item.warningSince,parameterId:Object.keys(values)[0],active:true});
      if(item.state==='parada')alarms.push({code:'CIC-013',description:item.timeline.at(-1).reason,severity:'critico',since:item.stateSince,active:true});
      const s={id:item.id,state:item.state,stateSince:item.stateSince,totalCount:item.totalCount,rejectedCount:item.rejectedCount,goodCount:item.totalCount-item.rejectedCount,
        goal:item.metaDiaria||0,cycleSeconds:item.cycleSeconds,idealCycleSeconds:item.idealCycleSeconds,cycleProgress:item.cycleProgress,partsPerCycle:item.partsPerCycle,
        speed:item.state==='operando'?60/item.cycleSeconds*item.partsPerCycle:0,plannedSeconds:item.plannedSeconds,operatingSeconds:item.operatingSeconds,
        stopSeconds:item.stopSeconds,setupSeconds:item.setupSeconds,maintenanceSeconds:item.maintenanceSeconds,phase:phase(item),parameters:values,alarms,
        timeline:clone(item.timeline),events:clone(item.events),samples:clone(item.samples),periodStart:item.periodStart,periodLabel:'Turno demonstrativo',
        updatedAt:item.updatedAt,source:'simulated',sourceLabel:'Simulação',connected:true,stale:false};
      return {...s,efficiency:efficiency(s)};
    }
    return {
      advance(stamp) {
        machines.forEach(item=>{
          const seconds=Math.max(0,(stamp-item.lastAt)/1000);
          if(!seconds)return;
          item.plannedSeconds+=seconds;
          if(item.state==='operando') {
            item.operatingSeconds+=seconds;item.cycleElapsed+=seconds;
            const cycles=Math.floor(item.cycleElapsed/item.cycleSeconds);
            item.cycleElapsed%=item.cycleSeconds;
            const before=item.totalCount;item.totalCount+=cycles*item.partsPerCycle;
            item.rejectedCount+=Math.floor(item.totalCount/65)-Math.floor(before/65);
            item.cycleProgress=item.cycleElapsed/item.cycleSeconds;
          } else {
            item[{setup:'setupSeconds',manutencao:'maintenanceSeconds',parada:'stopSeconds'}[item.state]||'stopSeconds']+=seconds;
            item.cycleProgress=0;
          }
          item.lastAt=stamp;item.updatedAt=stamp;
          if(!item.samples.length||stamp-item.samples.at(-1).time>=30000) {
            const first=Object.values(snapshot(item,stamp).parameters)[0];
            item.samples.push({time:stamp,cycleSeconds:item.state==='operando'?item.cycleSeconds:null,temperature:first?.value??null});item.samples=item.samples.slice(-60);
          }
        });
      },
      scenario(id,scenario,stamp=Date.now()) {
        if(!['operando','parada','setup','manutencao','alerta'].includes(scenario))throw new Error('Cenário inválido.');
        this.advance(stamp);
        const item=machines.get(id);if(!item)throw new Error('Máquina não encontrada.');
        const next=scenario==='alerta'?'operando':scenario;
        const reason={operando:'Produção retomada',parada:'Falha de avanço',setup:'Troca de ferramenta',manutencao:'Intervenção programada'}[next];
        const warning=scenario==='alerta';
        if(item.state!==next) {
          item.timeline.at(-1).end=stamp;item.timeline.push({state:next,start:stamp,end:null,reason});item.timeline=item.timeline.slice(-64);
          item.state=next;item.stateSince=stamp;item.cycleElapsed=0;item.cycleProgress=0;
          item.events.push({id:id+'-'+stamp+'-'+next,time:stamp,type:'estado',description:reason,state:next});
        }
        if(item.warning!==warning) {
          item.events.push({id:id+'-'+stamp+'-alarme',time:stamp,type:'alarme',description:warning?'Parâmetro acima do limite':'Parâmetro normalizado',state:next});
          item.warningSince=stamp;
        }
        item.warning=warning;item.events=item.events.slice(-100);
      },
      get(id,stamp) { const item=machines.get(id);return item?snapshot(item,stamp):null; },
      all(stamp) { return [...machines.values()].map(item=>snapshot(item,stamp)); },
      rebase(stamp) { machines.forEach(item=>{item.lastAt=stamp;}); }
    };
  }
  function normalizeSample(value,stamp=Date.now()) {
    if(!value||typeof value.id!=='string'||!value.id.trim()||!finite(value.updatedAt))throw new Error('A leitura precisa de id e updatedAt válidos.');
    const numeric=['totalCount','goodCount','rejectedCount','goal','cycleSeconds','idealCycleSeconds','cycleProgress','partsPerCycle','speed','plannedSeconds','operatingSeconds','stopSeconds','setupSeconds','maintenanceSeconds','periodStart'];
    const out={...clone(value),id:value.id.trim(),state:Object.hasOwn(states,value.state)?value.state:'desconhecido',source:'api',sourceLabel:'API / IoT'};
    numeric.forEach(key=>{out[key]=finite(value[key])?value[key]:null;});
    out.parameters={};
    Object.entries(value.parameters||{}).forEach(([key,p])=>{if(p&&finite(p.value))out.parameters[key]={...clone(p),updatedAt:finite(p.updatedAt)?p.updatedAt:value.updatedAt,alarm:typeof p.alarm==='boolean'?p.alarm:finite(p.min)&&finite(p.max)&&(p.value<p.min||p.value>p.max)};});
    out.alarms=Array.isArray(value.alarms)?clone(value.alarms).filter(a=>a&&a.active!==false):[];
    out.events=Array.isArray(value.events)?clone(value.events).filter(e=>e&&finite(e.time)).map(e=>({...e,state:Object.hasOwn(states,e.state)?e.state:'desconhecido'})).slice(-100):[];
    out.timeline=Array.isArray(value.timeline)?clone(value.timeline).filter(t=>t&&finite(t.start)&&(t.end==null||finite(t.end))).map(t=>({...t,state:Object.hasOwn(states,t.state)?t.state:'desconhecido'})).slice(-64):[];
    out.samples=Array.isArray(value.samples)?clone(value.samples).slice(-60):[];
    out.stale=stamp-value.updatedAt>15000;out.connected=value.connected!==false&&!out.stale;
    out.efficiency=efficiency(out);return out;
  }
  let catalog=clone(MSA.plantLayout?.machines||MSA.config.machines),simulator=createSimulator(catalog),timer=null,paused=false,mode='simulation',adapter=null,stopAdapter=null,error='';
  let simulationTime=Date.now(),lastTickAt=simulationTime;
  const live=new Map(),observers=new Set();
  const emit=()=>observers.forEach(callback=>callback({mode,paused,error}));
  function advanceClock() {
    const now=Date.now();
    if(mode==='simulation'&&!paused){simulationTime+=Math.max(0,now-lastTickAt);simulator.advance(simulationTime);}
    lastTickAt=now;
  }
  const tick=()=>{advanceClock();emit();};
  MSA.telemetry={
    states,efficiency,createSimulator,normalizeSample,
    get mode(){return mode;},get paused(){return paused;},get catalog(){return clone(catalog);},get adapterName(){return adapter?.name||'';},get error(){return error;},
    subscribe(callback){observers.add(callback);return()=>observers.delete(callback);},
    start(){if(!timer){lastTickAt=Date.now();timer=setInterval(tick,1000);}},
    stop(){clearInterval(timer);timer=null;lastTickAt=Date.now();},
    setMode(next){if(!['simulation','records','api'].includes(next)||(next==='api'&&!adapter))throw new Error('Fonte indisponível.');advanceClock();mode=next;error='';emit();},
    pause(){advanceClock();paused=!paused;emit();},
    scenario(id,value){advanceClock();simulator.scenario(id,value,simulationTime);emit();},
    get(id){return mode==='simulation'?simulator.get(id):live.has(id)?normalizeSample(live.get(id),Date.now()):null;},
    useAdapter(next) {
      if(!next||typeof next.subscribe!=='function')throw new Error('O adaptador precisa implementar subscribe().');
      advanceClock();if(stopAdapter)stopAdapter();live.clear();adapter=next;error='';
      stopAdapter=next.subscribe(sample=>{
        if(adapter!==next)return;
        try {
          const normalized=normalizeSample(sample);
          const previous=live.get(normalized.id);
          if(previous&&previous.updatedAt>normalized.updatedAt)return;
          error='';live.set(normalized.id,normalized);emit();
        }catch(e){error=e.message;emit();}
      },()=>{if(adapter!==next)return;error='A fonte de dados está sem comunicação.';live.clear();emit();});
      if(typeof stopAdapter!=='function')stopAdapter=null;
      mode='api';emit();
    },
    disconnectAdapter(){if(stopAdapter)stopAdapter();stopAdapter=null;adapter=null;live.clear();mode='simulation';lastTickAt=Date.now();error='';emit();}
  };
})();
