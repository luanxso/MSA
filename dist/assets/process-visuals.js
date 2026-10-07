/* MSA process illustration. Original vector artwork; speculative demonstration. */
(function () {
  'use strict';
  const MSA = window.MSA = window.MSA || {};
  const instances = new WeakMap();
  let serial = 0;
  const stationX = [175, 437, 700, 963, 1225];
  const START = 67, END = 1333, COUNT = 12, PITCH = (END - START) / COUNT;
  const stateNames = {operando:'Operando', parada:'Parada', setup:'Setup', manutencao:'Manutenção', desconhecido:'Sem leitura'};
  const stateColors = {operando:'#009534', parada:'#cb4444', setup:'#d3a326', manutencao:'#ac7b45', desconhecido:'#7b8087'};
  const sectorNames = {injecao:'Injeção', acabamento:'Acabamento', selagem:'Acabamento', montagem:'Montagem', montagem_capacetes:'Montagem de capacetes', montagem_fones:'Montagem de fones', qualidade:'Qualidade', testes:'Qualidade e testes', embalagem:'Embalagem', expedicao:'Expedição'};
  const escape = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const mod = (value, modulus) => ((value % modulus) + modulus) % modulus;

  function kindOf(machine) {
    const value = String(machine && machine.productKind || '').toLowerCase();
    return /fone|ear|audit|abaf|muff/.test(value) || /ABF|FON/i.test(machine && machine.id || '') ? 'fones' : 'capacetes';
  }

  function stationOf(machine) {
    if (machine && Number.isFinite(machine.stationIndex)) return clamp(Math.floor(machine.stationIndex), 0, 4);
    const value = String(machine && machine.setorId || '').toLowerCase();
    if (/inj|mold|resina/.test(value)) return 0;
    if (/acab|rebar|selag/.test(value)) return 1;
    if (/qual|test|insp/.test(value)) return 3;
    if (/emb|exp|palet/.test(value)) return 4;
    return 2;
  }

  function sectorOf(machine) {
    const id = machine && machine.setorId || '';
    const sector = MSA.plantLayout?.areas.find(item=>item.id===id)||(MSA.config && Array.isArray(MSA.config.sectors) ? MSA.config.sectors.find(item => item.id === id) : null);
    return sector && (sector.nome || sector.name) || sectorNames[id] || machine && machine.setorNome || id || 'Linha de produção';
  }

  function stateOf(sample) {
    return sample && sample.stale ? 'desconhecido' : sample && sample.state || 'desconhecido';
  }

  function progressOf(sample) {
    return sample && sample.cycleProgress != null && Number.isFinite(Number(sample.cycleProgress)) ? clamp(Number(sample.cycleProgress), 0, 1) : null;
  }

  function isRunning(sample, paused) {
    return !paused && stateOf(sample) === 'operando' && progressOf(sample) !== null;
  }

  function stageAt(x) {
    return x < 305 ? 0 : x < 568 ? 1 : x < 831 ? 2 : x < 1094 ? 3 : 4;
  }

  /** Product artwork is positioned by its bottom center. Stages range from 0 to 4. */
  function product(kind, stage, x, y, scale) {
    const type = /fone|ear|audit|abaf|muff/i.test(String(kind)) ? 'fones' : 'capacetes';
    const step = clamp(Math.floor(finite(stage, 0)), 0, 4);
    const tx = finite(x, 0), ty = finite(y, 0), size = clamp(finite(scale, 1), .01, 100);
    const carton = step === 4 ? '<path d="M-39-3L-34-14H34L39-3V10H-39Z" fill="#b4824c" stroke="#d5ac78" stroke-width="1.4"/><path d="M-39-3H39M0-3V10M-31 2H-9M9 2H30" fill="none" stroke="#745430" stroke-width="1.3"/><path d="M-34-14L-43-21L-38-5M34-14L43-21L38-5" fill="#d0a36c" stroke="#d5ac78"/>' : '';
    let shape;
    if (type === 'capacetes') {
      shape = `${step >= 2 ? '<path d="M-23-14C-22 4 20 4 23-14M-21-7L-11-17M21-7L11-17" fill="#273b48" stroke="#aec7cf" stroke-width="2.3"/><path d="M-16-2C-11 7 11 7 16-2" fill="none" stroke="#172b34" stroke-width="4"/><path d="M-7-12L-8 0M7-12L8 0" stroke="#7e9ba5" stroke-width="2"/>' : ''}
        <path d="M-32-15C-33-39-21-54 0-56C21-54 33-39 32-15Z" fill="#eebf36" stroke="#f9d97a" stroke-width="1.5"/>
        <path d="M3-55C17-51 25-38 26-18L32-15C34-39 21-54 3-55Z" fill="#c7901d"/>
        <path d="M-23-21C-24-36-17-44-10-47" fill="none" stroke="#fff0b0" stroke-width="4" stroke-linecap="round" opacity=".75"/>
        <path d="M-5-53L-6-18H5L4-53" fill="#fbd565" stroke="#ddb02e" stroke-width="1"/>
        <path d="M-34-19C-10-23 14-23 34-19L40-12C17-8-16-8-40-12Z" fill="#f6cb4c" stroke="#ffe492" stroke-width="1.3"/>
        <path d="M-39-12C-13-6 14-6 39-12L33-7C11-3-13-3-33-7Z" fill="#a77116"/>
        ${step >= 3 ? '<path d="M12-30H23V-22H12Z" fill="#174b3a"/><path d="M14-26L17-23L21-28" fill="none" stroke="#a7f0bc" stroke-width="1.6" stroke-linecap="round"/>' : ''}`;
    } else {
      const arch = step >= 2 ? '<path d="M-24-18V-41C-24-67 24-67 24-41V-18" fill="none" stroke="#687f8c" stroke-width="14" stroke-linecap="round"/><path d="M-24-18V-41C-24-67 24-67 24-41V-18" fill="none" stroke="#111e28" stroke-width="11" stroke-linecap="round"/><path d="M-24-40C-24-62 24-62 24-40" fill="none" stroke="#81909b" stroke-width="2"/><path d="M-25-32L-27-11M25-32L27-11" stroke="#a9bdc7" stroke-width="4" stroke-linecap="round"/><path d="M-18-51Q0-62 18-51" fill="none" stroke="#233542" stroke-width="8" stroke-linecap="round"/>' : '';
      const left = step >= 2 ? -27 : -23, right = step >= 2 ? 27 : 23;
      shape = `${arch}
        ${step >= 1 ? `<ellipse cx="${left + 6}" cy="-19" rx="12" ry="20" fill="#0e2028" stroke="#6b7e84" stroke-width="1.6"/><ellipse cx="${right - 6}" cy="-19" rx="12" ry="20" fill="#0e2028" stroke="#6b7e84" stroke-width="1.6"/>` : ''}
        <g transform="translate(${left} -20)"><path d="M-12-16Q-17 0-11 17Q0 22 9 15L11-12Q5-21-6-20Z" fill="#55bd79" stroke="#9ce0a7" stroke-width="1.5"/><path d="M-8-15Q-11-5-10 8" fill="none" stroke="#b3ecc0" stroke-width="3" stroke-linecap="round"/><path d="M6-16L4 14Q-3 20-8 17Q4 23 10 15L12-10Z" fill="#26915a"/><circle cx="3" cy="-10" r="2.4" fill="#203942"/></g>
        <g transform="translate(${right} -20)"><path d="M12-16Q17 0 11 17Q0 22-9 15L-11-12Q-5-21 6-20Z" fill="#55bd79" stroke="#9ce0a7" stroke-width="1.5"/><path d="M4-15Q9-12 10-4" fill="none" stroke="#b3ecc0" stroke-width="3" stroke-linecap="round"/><path d="M9 12Q3 19-8 15L-10 8L-9 16Q1 23 11 16Z" fill="#26915a"/><circle cx="-3" cy="-10" r="2.4" fill="#203942"/></g>
        ${step >= 3 ? '<path d="M19-22L23-18L30-27" fill="none" stroke="#e2ffe9" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>' : ''}`;
    }
    return `<g class="process-product product-${type}" data-product-stage="${step}" transform="translate(${tx} ${ty}) scale(${size})"><ellipse cx="0" cy="7" rx="41" ry="5.5" fill="#000" opacity=".24"/>${carton}${shape}</g>`;
  }

  function beacon(index, x, y) {
    return `<g class="line-beacon" transform="translate(${x} ${y})"><path d="M0 0V45" stroke="#80929a" stroke-width="4"/><rect x="-7" y="-29" width="14" height="29" rx="3" fill="#172a34" stroke="#8b9ca2"/><path d="M-6-19H6M-6-9H6" stroke="#3c5360"/><rect data-line-beacon="${index}" x="-5" y="-8" width="10" height="7" rx="1" fill="#647d87"/><rect x="-5" y="-27" width="10" height="7" rx="1" fill="#633b45"/><rect x="-5" y="-17" width="10" height="6" rx="1" fill="#675b3b"/></g>`;
  }

  function bolts(x, y, width, height) {
    return [[x + 7,y + 7],[x + width - 7,y + 7],[x + 7,y + height - 7],[x + width - 7,y + height - 7]].map(([cx,cy]) => `<circle cx="${cx}" cy="${cy}" r="2" fill="#97adb9"/><path d="M${cx - 1} ${cy}h2" stroke="#253d4b" stroke-width="1"/>`).join('');
  }

  function panel(x, y, uid, index) {
    return `<g class="line-control-panel"><path d="M${x + 18} ${y + 48}v34" stroke="#7f95a1" stroke-width="5"/><rect x="${x}" y="${y}" width="38" height="49" rx="4" fill="url(#${uid}-metal)" stroke="#a4b7c0"/><rect x="${x + 5}" y="${y + 6}" width="28" height="26" rx="2" fill="#0a2027" stroke="#456574"/><path d="M${x + 9} ${y + 24}l5-7 5 3 5-7 5 5" fill="none" stroke="#53bdc4" stroke-width="1.7"/><circle data-line-sensor="${index}" cx="${x + 10}" cy="${y + 40}" r="3" fill="#607b85"/><circle cx="${x + 20}" cy="${y + 40}" r="3" fill="#d19e58"/><circle cx="${x + 30}" cy="${y + 40}" r="3" fill="#8e4753"/></g>`;
  }

  function stationArtwork(index, uid) {
    const x = stationX[index];
    if (index === 0) return `<g class="line-machine machine-injection">
      <path d="M${x - 112} 218H${x + 107}V310H${x - 112}Z" fill="url(#${uid}-metal)" stroke="#7c98a8" stroke-width="1.5"/>
      <path d="M${x - 112} 218l14-12H${x + 117}l-10 12" fill="#627e8d" stroke="#89a1ac"/>
      <path d="M${x + 107} 219l11-12v94l-11 10Z" fill="#213b48" stroke="#668290"/>
      <rect x="${x - 70}" y="229" width="139" height="64" rx="3" fill="url(#${uid}-window)" stroke="#7793a2"/>
      <path d="M${x - 59} 238H${x + 57}M${x - 59} 278H${x + 57}" stroke="#b0c5ce" stroke-width="4"/>
      <rect x="${x - 62}" y="243" width="27" height="30" fill="#697d89" stroke="#a2b7c2"/>
      <g data-line-actuator="0"><rect x="${x - 9}" y="238" width="20" height="39" fill="#99acb7" stroke="#d0dce2"/><path d="M${x + 11} 257H${x + 49}" stroke="#567181" stroke-width="13"/><path d="M${x + 11} 252H${x + 49}" stroke="#90aab7" stroke-width="3"/></g>
      <path d="M${x - 85} 181v29M${x - 97} 153H${x - 57}l-9 25H${x - 88}Z" fill="#8fa4af" stroke="#c4d3da" stroke-width="1.5"/>
      <ellipse cx="${x - 77}" cy="153" rx="20" ry="5" fill="#bfd0d9" stroke="#8ca5b2"/>
      <path d="M${x - 86} 179l4 20H${x - 55}" fill="none" stroke="#7f9ba8" stroke-width="8"/>
      <rect x="${x - 106}" y="231" width="23" height="59" rx="2" fill="#234655"/>
      <path d="M${x - 102} 239h15m-15 8h15m-15 8h15m-15 8h15m-15 8h15" stroke="#91aeb7" stroke-width="1.4"/>
      <path d="M${x - 104} 309v14M${x + 99} 309v14" stroke="#758e9b" stroke-width="8"/>
      ${bolts(x - 112,218,219,92)}${beacon(index,x + 91,167)}${panel(x + 76,246,uid,index)}
    </g>`;
    if (index === 1) return `<g class="line-machine machine-finishing">
      <path d="M${x - 106} 307V166H${x + 101}V307" fill="none" stroke="#8ca3af" stroke-width="9"/>
      <path d="M${x - 107} 162h208l11-12H${x - 95}Z" fill="#618798" stroke="#9dbdca"/>
      <rect x="${x - 100}" y="170" width="194" height="139" fill="url(#${uid}-window)" stroke="#708e9d" opacity=".74"/>
      <path d="M${x - 36} 182V305M${x + 31} 182V305" stroke="#86a9b9" stroke-width="4"/>
      <rect x="${x - 44}" y="185" width="84" height="40" rx="3" fill="url(#${uid}-metal)" stroke="#bfd0d8"/>
      <g data-line-actuator="1"><path d="M${x - 5} 221v47" stroke="#aec5cf" stroke-width="10"/><rect x="${x - 14}" y="251" width="18" height="23" rx="2" fill="#49788e" stroke="#82b2c8"/><path d="M${x - 9} 274l-2 11M${x - 2} 274l3 11" stroke="#adc6d1" stroke-width="2.5"/></g>
      <path d="M${x - 89} 296H${x + 83}v14H${x - 89}Z" fill="#4c6574" stroke="#8199a4"/>
      <path d="M${x - 41} 194Q${x - 66} 211 ${x - 66} 250" fill="none" stroke="#38b5c2" stroke-width="3"/>
      <path d="M${x + 82} 167v134" stroke="#7198aa" stroke-width="2"/><path d="M${x + 70} 167v134" stroke="#476e82" stroke-width="1"/>
      ${beacon(index,x + 86,129)}${panel(x + 73,219,uid,index)}
    </g>`;
    if (index === 2) return `<g class="line-machine machine-assembly">
      <path d="M${x - 113} 291H${x + 106}v18H${x - 113}Z" fill="url(#${uid}-metal)" stroke="#90a8b5"/>
      <path d="M${x - 99} 310v18M${x + 91} 310v18" stroke="#607f90" stroke-width="7"/>
      <rect x="${x - 106}" y="214" width="43" height="77" rx="4" fill="#385967" stroke="#87a2af"/>
      <path d="M${x - 95} 221h20m-20 9h20m-20 9h20m-20 9h20m-20 9h20m-20 9h20" stroke="#203f4e" stroke-width="3"/>
      <path d="M${x + 53} 287v-76h38v76" fill="#41677a" stroke="#90b5c7" stroke-width="2"/>
      <path d="M${x + 73} 220L${x + 14} 182L${x - 28} 228" fill="none" stroke="#3fa6ba" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M${x + 72} 215L${x + 15} 179L${x - 26} 224" fill="none" stroke="#9ac8d6" stroke-width="5" stroke-linecap="round"/>
      <circle cx="${x + 73}" cy="215" r="14" fill="#234656" stroke="#a3cedd" stroke-width="3"/><circle cx="${x + 14}" cy="183" r="13" fill="#234656" stroke="#a3cedd" stroke-width="3"/>
      <g data-line-actuator="2"><circle cx="${x - 27}" cy="228" r="10" fill="#335c6d" stroke="#9ec7d7" stroke-width="2"/><path d="M${x - 28} 233v30" stroke="#b2c9d4" stroke-width="8"/><path d="M${x - 42} 263h28M${x - 42} 263v17M${x - 14} 263v17" fill="none" stroke="#a8bdc8" stroke-width="4"/></g>
      <path d="M${x - 40} 283h31l-2 10H${x - 38}Z" fill="#203b48" stroke="#708f9f"/>
      <path d="M${x - 99} 194h40v-15h35" fill="none" stroke="#788b97" stroke-width="3" stroke-dasharray="4 3"/>
      ${beacon(index,x + 90,177)}${panel(x - 110,236,uid,index)}
    </g>`;
    if (index === 3) return `<g class="line-machine machine-inspection">
      <path d="M${x - 95} 313V171H${x + 87}V313" fill="none" stroke="#7d96a6" stroke-width="11"/>
      <path d="M${x - 94} 164H${x + 92}l10-11H${x - 83}Z" fill="#657f93" stroke="#a0b6c9"/>
      <rect x="${x - 84}" y="179" width="159" height="132" fill="url(#${uid}-window)" opacity=".38" stroke="#8fa0ba"/>
      <path d="M${x - 24} 171v36" stroke="#afc3cf" stroke-width="5"/>
      <rect x="${x - 39}" y="203" width="31" height="25" rx="4" fill="#49738b" stroke="#a4c5d6"/>
      <circle cx="${x - 23}" cy="229" r="6" fill="#071821" stroke="#a1bfd3" stroke-width="2"/>
      <path class="line-scan-fan" d="M${x - 23} 235L${x - 59} 309H${x + 15}Z" fill="#3cceac" opacity=".08"/>
      <path data-line-scan d="M${x - 53} 303H${x + 9}" fill="none" stroke="#6fe6ca" stroke-width="2" opacity=".8"/>
      <rect x="${x + 35}" y="232" width="15" height="22" rx="2" fill="#baa25f" stroke="#e0c879"/>
      <path d="M${x + 42} 255v46" stroke="#849dac" stroke-width="3"/><circle cx="${x + 42}" cy="244" r="4" fill="#102c32"/>
      <path d="M${x + 60} 324l27 59" fill="none" stroke="#8d5b63" stroke-width="7"/><path d="M${x + 52} 324l27 59" stroke="#d48b95" stroke-width="1.5"/>
      <path d="M${x + 70} 380h45l-8 32H${x + 78}Z" fill="#442c38" stroke="#b0707e" stroke-width="1.5"/><path d="M${x + 77} 384h30M${x + 82} 390h20" stroke="#8c5666" stroke-width="1.5"/>
      <text x="${x + 94}" y="428" text-anchor="middle" class="line-small-label" fill="#cd9aa4">Refugos: <tspan data-line-rejected>0</tspan></text>
      ${beacon(index,x + 69,130)}${panel(x - 88,223,uid,index)}
    </g>`;
    return `<g class="line-machine machine-packaging">
      <path d="M${x - 97} 314V175H${x + 104}V314" fill="none" stroke="#839ca9" stroke-width="9"/>
      <path d="M${x - 98} 170H${x + 109}l8-13H${x - 90}Z" fill="#697f90" stroke="#abc0cd"/>
      <rect x="${x - 88}" y="184" width="183" height="128" fill="url(#${uid}-window)" opacity=".45" stroke="#738d9b"/>
      <path d="M${x - 57} 184v76M${x + 58} 184v76" stroke="#9fb7c4" stroke-width="3"/>
      <rect x="${x - 68}" y="186" width="137" height="23" rx="2" fill="#365e73" stroke="#a1bdcc"/>
      <g data-line-actuator="4"><path d="M${x - 7} 207v49" stroke="#b8cbd5" stroke-width="9"/><rect x="${x - 28}" y="254" width="49" height="15" rx="2" fill="#587f95" stroke="#aec5d3"/><path d="M${x - 22} 269v14M${x + 15} 269v14" stroke="#b9cbd5" stroke-width="3"/><path d="M${x - 25} 283h7M${x + 12} 283h7" stroke="#2b4654" stroke-width="5"/></g>
      <path d="M${x + 71} 198v88" stroke="#d7b978" stroke-width="3" stroke-dasharray="7 4"/>
      <rect x="${x - 91}" y="288" width="56" height="26" fill="#466476" stroke="#8fa8b4"/>
      <path d="M${x - 86} 294h44m-44 7h44m-44 7h44" stroke="#294452" stroke-width="2"/>
      <rect x="${x + 86}" y="241" width="19" height="51" rx="2" fill="#486073" stroke="#a2b5c2"/>
      ${beacon(index,x + 94,131)}${panel(x + 74,222,uid,index)}
    </g>`;
  }

  function stationMarkup(index, uid, selected, machine, sample, kind) {
    const labels = ['INJEÇÃO', 'ACABAMENTO', 'MONTAGEM', 'INSPEÇÃO', 'EMBALAGEM'];
    const descriptions = kind === 'fones' ? ['Formação das conchas', 'Espuma e almofadas', 'União ao arco', 'Verificação do conjunto', 'Proteção e identificação'] : ['Formação do casco', 'Rebarbação e acabamento', 'Suspensão e jugular', 'Verificação do conjunto', 'Proteção e identificação'];
    const colors = ['#68a8ee','#62c5d2','#f3cc62','#ce9fc9','#e2a168'];
    const cx = stationX[index], state = stateOf(sample), isSelected = index === selected;
    const color = stateColors[state] || stateColors.desconhecido;
    return `<g class="line-station" data-line-station="${index}">
      <rect x="${cx - 123}" y="72" width="246" height="365" rx="7" fill="${colors[index]}" fill-opacity=".025" stroke="${colors[index]}" stroke-opacity=".17"/>
      <rect data-line-station-frame="${index}" x="${cx - 124}" y="71" width="248" height="367" rx="7" fill="none" stroke="${isSelected ? color : colors[index]}" stroke-width="1.6" stroke-opacity="${isSelected ? '.75' : '0'}"/>
      <text x="${cx - 102}" y="96" class="line-step" fill="${colors[index]}">${String(index + 1).padStart(2, '0')}</text><text x="${cx - 72}" y="96" class="line-station-label">${labels[index]}</text>
      <text x="${cx}" y="460" text-anchor="middle" class="line-station-description">${descriptions[index]}</text>
      ${stationArtwork(index,uid)}
      <g data-line-selection-tag="${index}" style="display:${isSelected ? 'inline' : 'none'}"><rect x="${cx - 110}" y="111" width="220" height="36" rx="5" fill="#102931" stroke="${color}" stroke-opacity=".6"/><circle data-line-selection-dot cx="${cx - 98}" cy="128" r="3.5" fill="${color}"/><text x="${cx - 87}" y="125" data-line-current-sector class="line-selection-sector">${escape(sectorOf(machine))}</text><text x="${cx - 87}" y="139" data-line-current-state class="line-selection-state" fill="${color}">${escape(machine && machine.id || '')} · ${escape(stateNames[state] || state)}</text></g>
    </g>`;
  }

  function pieceMarkup(kind, index, offset) {
    const x = START + mod(index * PITCH + offset * PITCH, END - START), step = stageAt(x);
    return `<g data-line-piece data-index="${index}" data-stage="${step}" transform="translate(${x.toFixed(2)} 314)">${product(kind,step,0,0,.68)}</g>`;
  }

  /** Return an entire process scene. All SVG IDs are unique per rendered scene. */
  function line(machine, sample) {
    machine = machine || {}; sample = sample || {};
    const uid = 'msa-process-' + (++serial), kind = kindOf(machine), selected = stationOf(machine), initial = progressOf(sample) || 0;
    const svgLabel = 'Representação ilustrativa da produção de ' + (kind === 'fones' ? 'protetores auditivos' : 'capacetes') + ', da injeção à embalagem. ' + (machine.nome || machine.id || 'Linha de produção');
    const rollers = Array.from({length:33},(_,i) => `<g data-line-roller transform="translate(${51 + i * 41} 351)"><circle r="9" fill="#293f4d" stroke="#7a96a5" stroke-width="1.3"/><path d="M-5 0H5M0-5V5" stroke="#506c7b" stroke-width="1.3"/><circle r="2.5" fill="#8299a5"/></g>`).join('');
    const supports = [114,360,606,852,1098,1299].map(x => `<path d="M${x - 17} 361l-7 44M${x + 17} 361l7 44M${x - 24} 405h48" fill="none" stroke="#496574" stroke-width="6"/><path d="M${x - 16} 369l31 26" stroke="#698594" stroke-width="2"/>`).join('');
    return `<svg class="hmi-diagram process-line${isRunning(sample,false) ? ' is-running' : ' is-paused'}" data-line-svg data-line-kind="${kind}" data-line-initial-progress="${initial}" data-line-offset="${initial}" data-line-running="${isRunning(sample,false)}" viewBox="0 0 1400 500" role="img" fill="#adc4ce" aria-label="${escape(svgLabel)}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="${uid}-background" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0f222d"/><stop offset="1" stop-color="#081820"/></linearGradient>
        <linearGradient id="${uid}-metal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#647f90"/><stop offset=".46" stop-color="#3e5d70"/><stop offset="1" stop-color="#294654"/></linearGradient>
        <linearGradient id="${uid}-window" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#173b48" stop-opacity=".9"/><stop offset=".5" stop-color="#0e2530" stop-opacity=".7"/><stop offset="1" stop-color="#3b6573" stop-opacity=".75"/></linearGradient>
        <linearGradient id="${uid}-belt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#537786"/><stop offset=".3" stop-color="#1a3a49"/><stop offset="1" stop-color="#102a38"/></linearGradient>
        <pattern id="${uid}-grid" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M28 0H0V28" fill="none" stroke="#355763" stroke-opacity=".13" stroke-width="1"/></pattern>
        <filter id="${uid}-shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="6" stdDeviation="5" flood-color="#000" flood-opacity=".35"/></filter>
      </defs>
      <style>
        .process-line text{font-family:Inter,Segoe UI,Arial,sans-serif;font-size:12px}
        .process-line .line-step{font-size:12px;font-weight:700;letter-spacing:1px}
        .process-line .line-station-label{font-size:12px;font-weight:700;letter-spacing:1.3px;fill:#d2e0e6}
        .process-line .line-selection-sector{font-size:9.5px;letter-spacing:.35px;fill:#abc4cd}
        .process-line .line-selection-state{font-size:11px;font-weight:600}
        .process-line .line-station-description{font-size:11px;fill:#839eac}
        .process-line .line-small-label{font-size:9.5px}
        .process-line .line-flow{stroke-dasharray:8 13}
      </style>
      <rect width="1400" height="500" rx="10" fill="url(#${uid}-background)"/><rect width="1400" height="500" rx="10" fill="url(#${uid}-grid)"/>
      <text x="34" y="36" font-size="11" letter-spacing="1.8">FLUXO DE PRODUÇÃO</text><text x="1365" y="36" text-anchor="end" fill="#7c98a4" font-size="11">${kind === 'fones' ? 'PROTETORES AUDITIVOS' : 'CAPACETES'} · ILUSTRATIVO</text>
      <path d="M34 50H1366" stroke="#355260" stroke-opacity=".6"/>
      <g filter="url(#${uid}-shadow)">${stationX.map((_,index) => stationMarkup(index,uid,selected,machine,sample,kind)).join('')}</g>
      <g class="line-conveyor"><ellipse cx="699" cy="407" rx="643" ry="12" fill="#000" opacity=".18"/>${supports}<path d="M43 317H1354l13 10H54Z" fill="#6c8b99" stroke="#abc1ca" stroke-width="1"/><rect x="46" y="327" width="1319" height="38" rx="18" fill="url(#${uid}-belt)" stroke="#728f9e" stroke-width="1.5"/><path d="M63 335H1347" fill="none" class="line-flow" data-line-belt stroke="#608e9a" stroke-width="2.4"/>${rollers}<path d="M58 364H1352" stroke="#8da7b2" stroke-width="2"/><path d="M45 326H1354" stroke="#2f515f" stroke-width="2"/></g>
      <g class="line-sensors">${[295,558,820,1085].map((x,index) => `<path d="M${x} 307v-47" stroke="#8ba3ae" stroke-width="3"/><rect x="${x - 6}" y="251" width="12" height="14" rx="2" fill="#446473" stroke="#a3bdc9"/><circle data-line-sensor="${index}" cx="${x}" cy="256" r="2.8" fill="#66868f"/><path d="M${x + 3} 258l20 20" stroke="#73c8c4" stroke-width="1" stroke-dasharray="2 3" opacity=".4"/>`).join('')}</g>
      <g class="line-products">${Array.from({length:COUNT},(_,index) => pieceMarkup(kind,index,initial)).join('')}</g>
      <path d="M42 477H1358" stroke="#2a4857"/><path d="M42 486h24m-6-4 6 4-6 4" fill="none" stroke="#6c9dac" stroke-width="1.5"/><text x="79" y="490" class="line-small-label">Entrada de componentes</text><text x="1360" y="490" text-anchor="end" class="line-small-label">Saída de produtos acabados</text>
    </svg>`;
  }

  /** Update a mounted SVG without rebuilding it; a paused or stopped scene keeps its position. */
  function update(container, machine, sample, paused) {
    if (!container || typeof container.querySelector !== 'function') return;
    const svg = container.matches && container.matches('svg[data-line-svg]') ? container : container.querySelector('svg[data-line-svg]');
    if (!svg) return;
    machine = machine || {}; sample = sample || {};
    const progress = progressOf(sample), running = isRunning(sample,paused), kind = kindOf(machine), selected = stationOf(machine), state = stateOf(sample), color = stateColors[state] || stateColors.desconhecido;
    let instance = instances.get(svg);
    if (!instance) {
      instance = {offset:finite(svg.dataset.lineOffset,0), lastProgress:finite(svg.dataset.lineInitialProgress,0), running:svg.dataset.lineRunning === 'true', kind:svg.dataset.lineKind};
      instances.set(svg,instance);
    }
    if (running) {
      if (instance.running && progress !== null) {
        let delta = progress - instance.lastProgress;
        // A wrap advances the pipeline one piece pitch. Small backwards changes are a rebase.
        if (delta < -.5) delta += 1;
        if (delta > 0 && delta <= 1) instance.offset = mod(instance.offset + delta,COUNT);
      }
      instance.lastProgress = progress;
    }
    // Anchor the new cycle on resume rather than applying its reset to the visible conveyor.
    instance.running = running;
    svg.dataset.lineRunning = String(running);
    svg.dataset.lineOffset = String(instance.offset);
    svg.dataset.lineKind = kind;
    svg.classList.toggle('is-running',running);
    svg.classList.toggle('is-paused',!running);
    svg.classList.toggle('has-unknown-state',state === 'desconhecido');
    svg.querySelectorAll('[data-line-piece]').forEach((node,index) => {
      const pieceIndex = finite(node.dataset.index,index), x = START + mod(pieceIndex * PITCH + instance.offset * PITCH,END - START), stage = stageAt(x);
      if (node.dataset.stage !== String(stage) || instance.kind !== kind) {
        node.innerHTML = product(kind,stage,0,0,.68);
        node.dataset.stage = String(stage);
      }
      node.setAttribute('transform',`translate(${x.toFixed(2)} 314)`);
    });
    instance.kind = kind;
    svg.querySelectorAll('[data-line-selection-tag]').forEach(node => {
      const active = finite(node.dataset.lineSelectionTag,-1) === selected;
      node.style.display = active ? 'inline' : 'none';
      const sector = node.querySelector('[data-line-current-sector]'), label = node.querySelector('[data-line-current-state]');
      if (sector) sector.textContent = sectorOf(machine);
      if (label) { label.textContent = (machine.id || '') + ' · ' + (paused ? 'Pausado' : stateNames[state] || state); label.setAttribute('fill',color); }
      const rect = node.querySelector('rect'), dot = node.querySelector('[data-line-selection-dot]');
      if (rect) rect.setAttribute('stroke',color);
      if (dot) dot.setAttribute('fill',color);
    });
    svg.querySelectorAll('[data-line-station-frame]').forEach(node => {
      const active = finite(node.dataset.lineStationFrame,-1) === selected;
      node.setAttribute('stroke-opacity',active ? '.75' : '0');
      node.setAttribute('stroke',color);
    });
    svg.querySelectorAll('[data-line-beacon]').forEach(node => node.setAttribute('fill',finite(node.dataset.lineBeacon,-1) === selected ? color : '#647d87'));
    svg.querySelectorAll('[data-line-sensor]').forEach(node => node.setAttribute('fill',running ? '#65c8b4' : '#607b85'));
    const rejected = svg.querySelector('[data-line-rejected]');
    if (rejected) rejected.textContent = Number.isFinite(sample.rejectedCount) ? String(Math.max(0,Math.round(sample.rejectedCount))) : '—';
    const belt = svg.querySelector('[data-line-belt]');
    if (belt) belt.setAttribute('stroke-dashoffset',String(-instance.offset * PITCH));
    // Mechanical motion follows the same frozen position as the pieces.
    const phase = Math.sin(mod(instance.offset,1) * Math.PI * 2);
    svg.querySelectorAll('[data-line-actuator]').forEach(node => {
      const index = finite(node.dataset.lineActuator,0);
      node.setAttribute('transform',index === 0 ? `translate(${(phase * 9).toFixed(2)} 0)` : `translate(0 ${(phase * (index === 2 ? 7 : 10)).toFixed(2)})`);
    });
    const scan = svg.querySelector('[data-line-scan]');
    if (scan) { scan.setAttribute('transform',`translate(0 ${(-13 + phase * 10).toFixed(2)})`); scan.setAttribute('opacity',state === 'desconhecido' ? '.18' : '.75'); }
  }

  MSA.processVisuals = {product, line, update};
}());
