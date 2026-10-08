import * as T from './vendor/three.module.js';
import {OrbitControls} from './vendor/OrbitControls.js';
import {nhplConfig as config} from './nhpl-config.js';
export function createScene(host, onSelect) {
  const scene=new T.Scene();scene.background=new T.Color(0x122431);
  const camera=new T.PerspectiveCamera(36,1,.1,150);
  const renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));host.append(renderer.domElement);
  renderer.domElement.setAttribute('aria-label','Cena 3D conceitual da NHPL. Use os controles de câmera e os botões de estação.');
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=7;controls.maxDistance=48;controls.maxPolarAngle=Math.PI*.49;
  const reset=()=>{camera.position.set(10,11,17).multiplyScalar(Math.max(1,1.7/camera.aspect));controls.target.set(0,1,0);controls.update();};reset();
  scene.add(new T.HemisphereLight(0xe7f8ff,0x4c6872,2.4));const sun=new T.DirectionalLight(0xffffff,3);sun.position.set(5,12,8);scene.add(sun);
  const metal=new T.MeshStandardMaterial({color:0x526976,metalness:.65,roughness:.38});
  function box(w,h,d,x,y,z,material=metal){const m=new T.Mesh(new T.BoxGeometry(w,h,d),material);m.position.set(x,y,z);scene.add(m);return m;}
  box(23,.2,8,0,-.25,0,new T.MeshStandardMaterial({color:0x203944}));
  scene.add(new T.GridHelper(28,28,0x3d6673,0x28434e));
  function label(text,x,y,z){const c=document.createElement('canvas');c.width=640;c.height=100;const ctx=c.getContext('2d');ctx.fillStyle='#122431';ctx.fillRect(0,0,640,100);ctx.fillStyle='#eefaff';ctx.font='bold 34px sans-serif';ctx.textAlign='center';ctx.fillText(text,320,62);const texture=new T.CanvasTexture(c);const sprite=new T.Sprite(new T.SpriteMaterial({map:texture}));sprite.scale.set(3.5,.55,1);sprite.position.set(x,y,z);scene.add(sprite);}
  const stations=config.stations.map((s,i)=>{
    const [x,,z]=s.position;const mat=new T.MeshStandardMaterial({color:0x426b76,metalness:.3,roughness:.45});
    const mesh=box(2.8,.3,2.5,x,1.1,z,mat);mesh.userData.station=s.id;
    [-1,1].forEach(dx=>[-.85,.85].forEach(dz=>box(.14,1.1,.14,x+dx,.55,z+dz)));
    if(i>0&&i<4){box(.18,3,.18,x-1.1,1.5,z-1);box(.18,3,.18,x+1.1,1.5,z-1);box(2.4,.2,.2,x,3,z-1);box(.5,.6,.6,x,2.5,z-1);}
    label(`${i+1} · ${s.name}`,x,3.8,z);return mesh;
  });
  const route=new T.Group();scene.add(route);
  config.stations.slice(0,-1).forEach((s,i)=>{
    const a=new T.Vector3(...s.position),b=new T.Vector3(...config.stations[i+1].position);a.y=b.y=.3;const dir=b.clone().sub(a);const len=dir.length();route.add(new T.ArrowHelper(dir.normalize(),a,len-.6,0x54d8b4,.5,.3));
    if(['esteira','paletes'].includes(config.transport))box(len,.15,1.1,(a.x+b.x)/2,1,(a.z+b.z)/2);
  });
  // Componentes ilustrativos: conchas, almofadas e arco; não descrevem a receita real.
  const products=[];
  for(let i=0;i<5;i++) {
    const group=new T.Group(),cupMat=new T.MeshStandardMaterial({color:config.models['VGARD HP'].color,roughness:.4}),parts=[];
    [-.44,.44].forEach(x=>{
      const cup=new T.Mesh(new T.SphereGeometry(.39,20,14),cupMat);cup.scale.set(.7,1,.8);cup.position.set(x,.45,0);group.add(cup);parts.push({mesh:cup,type:'cupStage'});
      const cushion=new T.Mesh(new T.TorusGeometry(.28,.08,10,24),new T.MeshStandardMaterial({color:0x202328}));cushion.rotation.y=Math.PI/2;cushion.position.set(x*.68,.45,0);group.add(cushion);parts.push({mesh:cushion,type:'cushionStage'});
    });
    const band=new T.Mesh(new T.TorusGeometry(.56,.055,8,30,Math.PI),new T.MeshStandardMaterial({color:0x202328}));band.position.y=.56;group.add(band);parts.push({mesh:band,type:'bandStage'});
    scene.add(group);products.push({group,parts,cupMat});
  }
  let sample=null,selected='montagem-b',model='VGARD HP',stamp=performance.now(),frame=0,rejectId='',rejectIndex=-1;
  const select=id=>{selected=id;onSelect(id);};
  const ray=new T.Raycaster(),point=new T.Vector2();let down=null;
  const pointerDown=e=>{down=[e.clientX,e.clientY];};
  const pointerUp=e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>6)return;const r=renderer.domElement.getBoundingClientRect();point.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(point,camera);const hit=ray.intersectObjects(stations)[0];if(hit)select(hit.object.userData.station);};
  renderer.domElement.addEventListener('pointerdown',pointerDown);renderer.domElement.addEventListener('pointerup',pointerUp);
  const observer=new ResizeObserver(()=>{const r=host.getBoundingClientRect();if(!r.width||!r.height)return;renderer.setSize(r.width,r.height);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();reset();});observer.observe(host);
  function animate(now){
    controls.update();
    stations.forEach((mesh,i)=>{const s=config.stations[i];const alert=sample?.alarms?.some(a=>a.stationId===s.id)||(sample?.source==='simulated'&&sample.state==='parada'&&s.id==='montagem-b');mesh.material.color.setHex(alert?0xd84842:s.id===selected?0xe2b955:0x426b76);mesh.material.emissive.setHex(alert?0x431009:0);});
    const animated=['simulated','demo-records'].includes(sample?.source);
    const moving=animated&&sample.state==='operando'&&sample.connected!==false&&!sample.stale&&!sample.paused;
    const progress=sample?.cycleProgress||0;
    const phase=moving?Math.min(.999,progress+Math.max(0,now-stamp)/1000/(sample.cycleSeconds||12)):progress;
    if(sample?.recentReject&&sample.recentReject.id!==rejectId){
      rejectId=sample.recentReject.id;
      rejectIndex=products.reduce((best,p,i)=>{
        const t=((i/5+((sample.totalCount||0)+phase)/5)%1)*4,distance=Math.abs(t-3.2);
        return distance<best.distance?{index:i,distance}:best;
      },{index:0,distance:Infinity}).index;
    }
    products.forEach((p,i)=>{
      const t=animated?((i/5+((sample.totalCount||0)+phase)/5)%1)*4:i;
      const index=Math.min(3,Math.floor(t)),fraction=t-index;const a=config.stations[index].position,b=config.stations[index+1].position;
      p.group.position.set(a[0]+(b[0]-a[0])*fraction,1.25,a[2]+(b[2]-a[2])*fraction);
      const stage=config.stations[Math.min(4,Math.floor(t))].stage,definition=config.models[model];
      p.parts.forEach(part=>part.mesh.visible=stage>=definition[part.type]);p.cupMat.color.setHex(sample?.recentReject&&i===rejectIndex?0xdb5851:definition.color);p.cupMat.emissive.setHex(sample?.recentReject&&i===rejectIndex?0x4b1110:0);
    });
    renderer.render(scene,camera);frame=requestAnimationFrame(animate);
  }
  frame=requestAnimationFrame(animate);
  return {reset, select(id){selected=id;}, update(s,m){sample=s;model=config.models[m]?m:'VGARD HP';stamp=performance.now();},route(show){route.visible=show;}, camera(action){if(action==='zoom-in')camera.position.sub(controls.target).multiplyScalar(.85).add(controls.target);if(action==='zoom-out')camera.position.sub(controls.target).multiplyScalar(1.15).add(controls.target);if(action==='rotate')camera.position.applyAxisAngle(new T.Vector3(0,1,0),.3);controls.update();},
    dispose(){cancelAnimationFrame(frame);observer.disconnect();controls.dispose();scene.traverse(o=>{o.geometry?.dispose();const materials=Array.isArray(o.material)?o.material:[o.material];materials.forEach(m=>{m?.map?.dispose();m?.dispose();});});renderer.dispose();renderer.domElement.remove();}
  };
}
