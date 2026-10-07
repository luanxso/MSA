/* Demonstração isolada: somente catálogo e leituras em memória; sem Firebase. */
addEventListener('DOMContentLoaded',()=>{
  const root=document.querySelector('#page-content'),shell=document.querySelector('.app-shell');
  const context={demo:true,user:{id:'demo',cargo:'chefe'},sector:'todos',state:{ready:true,connected:false,maquinas:[],registrosProducao:[],leituras:[],paradas:[],perdas:[],ocorrencias:[]}};
  function render(){MSA.plant.open(root,context);document.querySelectorAll('.nav-item').forEach(a=>a.classList.toggle('is-active',a.getAttribute('href')===location.hash));shell.classList.remove('is-drawer-open');}
  document.querySelector('.sidebar-toggle').addEventListener('click',event=>{if(innerWidth<768)shell.classList.toggle('is-drawer-open');else shell.classList.toggle('is-collapsed');event.currentTarget.setAttribute('aria-expanded',innerWidth<768?shell.classList.contains('is-drawer-open'):!shell.classList.contains('is-collapsed'));});
  document.querySelector('.drawer-close').addEventListener('click',()=>shell.classList.remove('is-drawer-open'));
  addEventListener('hashchange',render);if(!location.hash)location.hash='mapa-planta';render();
});
