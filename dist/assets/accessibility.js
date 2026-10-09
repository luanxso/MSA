/* Preferências locais de apresentação, compartilhadas entre as páginas. */
(() => {
  'use strict';
  const MSA = window.MSA = window.MSA || {};
  const key = 'msa-accessibility-v1', root = document.documentElement;
  const defaults = {palette:'default', text:'100', contrast:false, spacing:false, motion:false};
  function sanitize(value) {
    value = value && typeof value === 'object' ? value : {};
    return {palette:['default','redgreen','blueyellow','mono'].includes(value.palette)?value.palette:'default', text:['100','112','125'].includes(value.text)?value.text:'100', contrast:value.contrast===true, spacing:value.spacing===true, motion:value.motion===true};
  }
  let prefs;
  try { prefs = sanitize(JSON.parse(localStorage.getItem(key))); } catch { prefs = {...defaults}; }
  function apply() {
    root.dataset.a11yPalette=prefs.palette;
    root.dataset.a11yText=prefs.text;
    for (const option of ['contrast','spacing','motion']) root.dataset['a11y'+option[0].toUpperCase()+option.slice(1)]=String(prefs[option]);
    sync();
    document.dispatchEvent(new CustomEvent('msa:accessibility-change'));
  }
  function sync() {
    document.querySelectorAll('[data-a11y-option]').forEach(input=>{
      const value=prefs[input.dataset.a11yOption];
      if(input.type==='checkbox')input.checked=value; else input.value=value;
    });
  }
  function save() {
    let saved=true;
    try {localStorage.setItem(key,JSON.stringify(prefs));} catch {saved=false;}
    apply();
    const message=document.getElementById('a11y-feedback');
    if(message)message.textContent=saved?'Preferências aplicadas e salvas neste navegador.':'Preferências aplicadas. Este navegador não permitiu salvá-las.';
  }
  const select=(name,label,description,options)=>`<div class="a11y-setting"><div><label for="a11y-${name}">${label}</label><p id="a11y-${name}-help">${description}</p></div><select id="a11y-${name}" data-a11y-option="${name}" aria-describedby="a11y-${name}-help">${options.map(([v,t])=>`<option value="${v}" ${prefs[name]===v?'selected':''}>${t}</option>`).join('')}</select></div>`;
  const toggle=(name,label,description)=>`<div class="a11y-setting"><div><label for="a11y-${name}">${label}</label><p id="a11y-${name}-help">${description}</p></div><input id="a11y-${name}" type="checkbox" data-a11y-option="${name}" aria-describedby="a11y-${name}-help" ${prefs[name]?'checked':''}></div>`;
  function render() {
    return `<section class="ops-panel a11y-panel" aria-labelledby="a11y-title"><div class="ops-panel-heading"><h2 id="a11y-title">Acessibilidade</h2></div><p class="ops-note">Personalize a leitura do sistema. As alterações são imediatas e ficam salvas neste navegador.</p>${select('palette','Cores e daltonismo','Escolha a combinação mais fácil de distinguir. As paletas alteram indicadores, gráficos e estados das máquinas.',[['default','Padrão MSA'],['redgreen','Vermelho / verde · protanopia e deuteranopia'],['blueyellow','Azul / amarelo · tritanopia'],['mono','Tons de cinza']])}<div class="a11y-preview" aria-label="Exemplo de estados"><span class="a11y-good">✓ Operando</span><span class="a11y-warning">△ Atenção / setup</span><span class="a11y-danger">■ Parada / desvio</span></div>${select('text','Tamanho do texto','Aumente textos e controles. O zoom do navegador continua disponível.',[['100','Padrão · 100%'],['112','Maior · 112%'],['125','Grande · 125%']])}${toggle('contrast','Alto contraste','Reforce textos, bordas e a separação entre controles, nos temas claro e escuro.')}${toggle('spacing','Mais espaço para leitura','Aumente a distância entre letras e linhas em textos, campos e tabelas.')}${toggle('motion','Reduzir animações','Desative transições e movimentos do supervisório. Os dados continuam atualizando; a preferência do dispositivo também é respeitada.')}<div class="a11y-footer"><button type="button" class="secondary-button" data-a11y-reset>Restaurar acessibilidade</button><span id="a11y-feedback" role="status" aria-live="polite"></span></div><p class="ops-note">Use Tab para navegar, Enter para acionar botões e Esc para fechar janelas. Nos gráficos de análise, linhas contínuas e tracejadas ajudam a distinguir as séries.</p></section>`;
  }
  document.addEventListener('change',event=>{
    const input=event.target.closest('[data-a11y-option]');if(!input)return;
    prefs=sanitize({...prefs,[input.dataset.a11yOption]:input.type==='checkbox'?input.checked:input.value});save();
  });
  document.addEventListener('click',event=>{if(event.target.closest('[data-a11y-reset]')){prefs={...defaults};save();}});
  window.addEventListener('storage',event=>{if(event.key!==key)return;try{prefs=sanitize(JSON.parse(event.newValue));}catch{prefs={...defaults};}apply();});
  MSA.accessibility={render,get preferences(){return {...prefs};}};
  apply();
})();
