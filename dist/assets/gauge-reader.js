/* Estimativa geométrica local: foto frontal, mostrador centralizado, escala confirmada. */
window.MSA=window.MSA||{};
(() => {
 'use strict';
 const rad=d=>d*Math.PI/180;
 const mod=x=>(x%360+360)%360;
 function convert(value,from,to){
  if(from===to)return value;
  const bar={bar:1,'kgf/cm²':.980665,psi:.0689475729,kPa:.01,MPa:10,mmHg:.00133322387415,inHg:.0338638866667};
  if(!bar[from]||!bar[to])throw new Error('Unidades incompatíveis. Configure a unidade do instrumento.');
  return value*bar[from]/bar[to];
 }
 function readPixels({data,width,height},profile){
  const {start,end,startAngle,sweep,unit,targetUnit}=profile;
  if(![start,end,startAngle,sweep].every(Number.isFinite)||start===end||Math.abs(sweep)<30||Math.abs(sweep)>350)throw new Error('Configure a escala e o arco do instrumento.');
  const gray=(x,y)=>{x=Math.round(x);y=Math.round(y);if(x<0||y<0||x>=width||y>=height)return 255;const n=(y*width+x)*4;return .299*data[n]+.587*data[n+1]+.114*data[n+2];};
  // Procura o cubo escuro perto do centro, sem usar os números da escala como leitura.
  const radius=Math.min(width,height)*.37;let bestHub=-Infinity,cx=width/2,cy=height/2;
  for(let y=height*.41;y<=height*.59;y+=2)for(let x=width*.41;x<=width*.59;x+=2){
   let score=0;for(let dy=-5;dy<=5;dy+=2)for(let dx=-5;dx<=5;dx+=2)score+=255-gray(x+dx,y+dy);
   if(score>bestHub){bestHub=score;cx=x;cy=y;}
  }
  const scores=[];
  for(let angle=0;angle<360;angle+=.5){
   let covered=0,total=0,dark=0;
   for(let r=radius*.23;r<radius*.87;r+=2){
    const a=rad(angle),x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;
    const g=Math.min(gray(x,y),gray(x+Math.sin(a)*1.2,y-Math.cos(a)*1.2),gray(x-Math.sin(a)*1.2,y+Math.cos(a)*1.2));
    const side=(gray(x+Math.sin(a)*6,y-Math.cos(a)*6)+gray(x-Math.sin(a)*6,y+Math.cos(a)*6))/2;
    const contrast=Math.max(0,side-g);dark+=contrast;covered+=g<115&&contrast>28?1:0;total++;
   }
   scores.push({angle,coverage:covered/total,score:dark/total});
  }
  scores.sort((a,b)=>b.score-a.score);
  const best=scores[0],alternative=scores.find(s=>Math.min(mod(s.angle-best.angle),mod(best.angle-s.angle))>12);
  const travel=sweep>0?mod(best.angle-startAngle):mod(startAngle-best.angle),fraction=travel/Math.abs(sweep);
  if(best.score<35||best.coverage<.60||alternative&&alternative.score>best.score*.84||fraction>1.015)throw new Error('Ponteiro ambíguo. Reenquadre a foto ou informe a leitura.');
  const instrumentValue=start+(end-start)*Math.min(1,fraction);
  return {value:Number(convert(instrumentValue,unit,targetUnit).toFixed(2)),angle:best.angle,cx,cy,radius,instrumentValue,method:'ponteiro-local'};
 }
 let adapter=null;
 MSA.gaugeReader={readPixels,convert,setAdapter(next){if(next!==null&&typeof next?.read!=='function')throw new Error('O leitor precisa implementar read().');adapter=next;},get adapter(){return adapter;}};
})();
