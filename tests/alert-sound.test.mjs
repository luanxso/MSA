import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../dist/assets/alert-sound.js', import.meta.url), 'utf8');
function fixture({ saved = null, unsupported = false, failResume = false } = {}) {
  let tones = 0, serialized = saved, user = { id: 'chief', cargo: 'chefe' };
  class Audio {
    state = 'suspended'; currentTime = 0; destination = {};
    async resume() { if (failResume) throw Error('blocked'); this.state = 'running'; }
    addEventListener() {}
    createOscillator() { return { frequency: {}, connect() {}, start() { tones++; }, stop() {}, disconnect() {} }; }
    createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
  }
  const context = { MSA: { auth: { session: () => user }, rbac: { inScope: (u, r) => u.cargo === 'chefe' || r.setorId === u.setorId } },
    document: { querySelector: () => null },
    localStorage: { getItem: () => serialized, setItem: (_, value) => { serialized = value; } },
    AudioContext: unsupported ? undefined : Audio };
  context.window = context;
  vm.runInNewContext(source, context);
  return { context, sound: context.MSA.alertSound, tones: () => tones, stored: () => serialized,
    changeUser: value => { user = value; } };
}
const alert = (id, tipo = 'Parada', setorId = 'montagem', patch = {}) => ({ id, tipo, setorId, active: true, status: 'novo', ...patch });

test('carregar os fluxos preserva o controle de som do header e não reintroduz o aviso nas páginas', async () => {
  const f = fixture(); f.context.MSA.workflows = {};
  vm.runInNewContext(readFileSync(new URL('../dist/js/workflows-ui.js', import.meta.url), 'utf8'), f.context);
  assert.equal(f.context.MSA.alertSound, f.sound);
  let banners = 0; f.context.MSA.operations = { notify() { banners++; } };
  await f.sound.toggle(); await f.sound.toggle(); assert.equal(banners, 0);
  const html = f.context.MSA.workflowUI.render('alerts', {
    state: { atendimentosAlertas: [] }, machines: () => [],
    panel: (_, body) => body, table: () => '', badge: () => '', machineLink: () => ''
  });
  assert(!html.includes('wf-sound')); assert(!html.includes('Ativar som'));
});

test('carga inicial e alertas existentes não tocam; alertas novos tocam uma única vez', async () => {
  const f = fixture(); await f.sound.setEnabled(true);
  const old = alert('old'); f.sound.update([old]); assert.equal(f.tones(), 0);
  f.sound.update([old, alert('new')]); assert.equal(f.tones(), 1);
  f.sound.update([old, alert('new')]); assert.equal(f.tones(), 1);
  f.sound.update([]); f.sound.update([old, alert('new')]); assert.equal(f.tones(), 1);
});
test('ativar o som não reproduz o histórico recebido enquanto estava desligado', async () => {
  const f = fixture(); f.sound.update([]); f.sound.update([alert('silent')]);
  await f.sound.setEnabled(true); f.sound.update([alert('silent')]); assert.equal(f.tones(), 0);
  f.sound.update([alert('silent'), alert('new')]); assert.equal(f.tones(), 1);
  await f.sound.setEnabled(false); f.sound.update([alert('later')]); assert.equal(f.tones(), 1);
});
test('filtros por tipo e setor impedem sons e mudanças de filtros não reproduzem pendências', async () => {
  const f = fixture(); await f.sound.setEnabled(true); f.sound.update([]);
  f.sound.configure({ types: ['Parâmetro'], sector: 'injecao' });
  const excluded = [alert('stop', 'Parada', 'injecao'), alert('wrong-sector', 'Parâmetro')];
  f.sound.update(excluded); assert.equal(f.tones(), 0);
  f.sound.update([...excluded, alert('right', 'Parâmetro', 'injecao')]); assert.equal(f.tones(), 1);
  f.sound.configure({ types: ['Parada', 'Parâmetro'], sector: 'todos' });
  f.sound.update(excluded); assert.equal(f.tones(), 1);
});
test('cada uma das cinco categorias pode emitir som; categorias desconhecidas não emitem', async () => {
  for (const tipo of ['Parada', 'Parâmetro', 'Produtividade', 'Lote suspeito', 'Ocorrência']) {
    const f = fixture(); await f.sound.setEnabled(true); f.sound.configure({ types: [tipo] }); f.sound.update([]);
    f.sound.update([alert('match', tipo)]); assert.equal(f.tones(), 1, tipo);
  }
  const f = fixture(); await f.sound.setEnabled(true); f.sound.update([]); f.sound.update([alert('unknown', 'Outro')]); assert.equal(f.tones(), 0);
});
test('alertas normalizados, reconhecidos e resolvidos não emitem som', async () => {
  const f = fixture(); await f.sound.setEnabled(true); f.sound.update([]);
  f.sound.update([alert('inactive', 'Parada', 'montagem', { active: false }),
    alert('ack', 'Parada', 'montagem', { status: 'reconhecido' }), alert('done', 'Parada', 'montagem', { status: 'resolvido' })]);
  assert.equal(f.tones(), 0);
});
test('os filtros respeitam o acesso e a troca de usuário não anuncia o histórico', async () => {
  const f = fixture(); f.changeUser({ id: 'sup', cargo: 'supervisor', setorId: 'montagem' });
  await f.sound.setEnabled(true); f.sound.update([]);
  f.sound.update([alert('outside', 'Parada', 'injecao')]); assert.equal(f.tones(), 0);
  f.sound.update([alert('inside')]); assert.equal(f.tones(), 1);
  f.changeUser({ id: 'other', cargo: 'chefe' }); f.sound.update([alert('outside', 'Parada', 'injecao')]); assert.equal(f.tones(), 1);
});
test('preferências persistem; recarregar exige gesto do usuário para retomar áudio', async () => {
  const f = fixture(); f.sound.configure({ types: ['Lote suspeito'], sector: 'montagem' }); await f.sound.setEnabled(true);
  const restored = fixture({ saved: f.stored() });
  assert.equal(restored.sound.status.label, 'Som pausado'); assert.equal(restored.sound.enabled, false);
  assert.equal(restored.sound.settings.types.join(), 'Lote suspeito'); assert.equal(restored.sound.settings.sector, 'montagem');
  await restored.sound.setEnabled(true); assert.equal(restored.sound.status.label, 'Som ativo');
});
test('sem categorias selecionadas não toca, mesmo com o áudio liberado', async () => {
  const f = fixture(); await f.sound.setEnabled(true); f.sound.configure({ types: [] }); f.sound.update([]);
  f.sound.update([alert('new')]); assert.equal(f.tones(), 0); assert.equal(f.sound.status.label, 'Sem alertas sonoros');
});
test('indisponibilidade de áudio e dados locais inválidos não causam erro no sistema', async () => {
  for (const options of [{ unsupported: true }, { failResume: true }]) {
    const f = fixture(options); assert.equal(await f.sound.setEnabled(true), false);
    assert.equal(f.sound.status.label, 'Som desligado'); assert.equal(f.sound.beep(), false);
  }
  const f = fixture({ saved: '{invalid json' }); assert.equal(f.sound.settings.types.length, 5);
  f.sound.configure({ types: ['unknown', 'Parada'] }); assert.equal(f.sound.settings.types.join(), 'Parada');
});

const telemetrySample=(alarms=[],extra={})=>({id:'NHPL',maquinaId:'NHPL',setorId:'montagem',source:'simulated',connected:true,stale:false,alarms,...extra});
test('NHPL e telemetria obedecem som global, tipo e setor, sem contexto de áudio independente',async()=>{
 const f=fixture(),s=f.sound;s.updateTelemetry([telemetrySample()]);
 s.updateTelemetry([telemetrySample([{code:'PARADA'}])]);assert.equal(f.tones(),0);
 await s.setEnabled(true);s.updateTelemetry([telemetrySample([{code:'PARADA'}])]);assert.equal(f.tones(),0);
 s.configure({types:['Parâmetro'],sector:'injecao'});s.updateTelemetry([telemetrySample([{code:'PRESSAO',parameterId:'pressao'}])]);assert.equal(f.tones(),0);
 s.configure({sector:'montagem'});s.updateTelemetry([telemetrySample()]);
 s.updateTelemetry([telemetrySample([{code:'PRESSAO',parameterId:'pressao'}])]);assert.equal(f.tones(),1);
 await s.setEnabled(false);s.updateTelemetry([telemetrySample([{code:'TEMP',parameterId:'temperatura'}])]);assert.equal(f.tones(),1);
 const modal=readFileSync(new URL('../dist/assets/nhpl-modal.js',import.meta.url),'utf8');
 assert(!modal.includes('AudioContext'));assert(!modal.includes('data-sound'));
});
test('troca de alarme com a mesma quantidade toca uma vez; atualização do mesmo código não repete',async()=>{
 const f=fixture(),s=f.sound;await s.setEnabled(true);s.updateTelemetry([telemetrySample([{code:'PRESSAO',parameterId:'pressao',since:1}])]);
 s.updateTelemetry([telemetrySample([{code:'PRESSAO',parameterId:'pressao',since:2}])]);assert.equal(f.tones(),0);
 s.updateTelemetry([telemetrySample([{code:'TEMP',parameterId:'temperatura'}])]);assert.equal(f.tones(),1);
 s.updateTelemetry([telemetrySample([{code:'TEMP',parameterId:'temperatura'}])]);assert.equal(f.tones(),1);
 s.updateTelemetry([telemetrySample()]);s.updateTelemetry([telemetrySample([{code:'TEMP',parameterId:'temperatura'}])]);assert.equal(f.tones(),2);
});
test('telemetria respeita acesso, troca de usuário e ausência de comunicação; registros não tocam em dobro',async()=>{
 const f=fixture(),s=f.sound;f.changeUser({id:'sup',cargo:'supervisor',setorId:'injecao'});await s.setEnabled(true);
 s.updateTelemetry([telemetrySample()]);s.updateTelemetry([telemetrySample([{code:'PARADA'}])]);assert.equal(f.tones(),0);
 f.changeUser({id:'other',cargo:'chefe'});s.updateTelemetry([telemetrySample([{code:'PARADA'}])]);assert.equal(f.tones(),0);
 s.updateTelemetry([telemetrySample()]);s.updateTelemetry([telemetrySample([{code:'PARADA'}],{stale:true,connected:false})]);assert.equal(f.tones(),0);
 s.updateTelemetry([telemetrySample()]);s.updateTelemetry([telemetrySample([{code:'PARADA'}],{source:'demo-records'})]);assert.equal(f.tones(),0);
 s.updateTelemetry([telemetrySample([{code:'PARADA'}],{source:'manual'})]);assert.equal(f.tones(),0);
});
test('a coleta de telemetria alimenta o serviço global e mantém filtros de som',async()=>{
 const f=fixture();let tick;
 f.context.setInterval=callback=>{tick=callback;return 1;};f.context.clearInterval=()=>{};
 for(const n of ['config','plant-layout','telemetry-service'])vm.runInNewContext(readFileSync(new URL('../dist/assets/'+n+'.js',import.meta.url),'utf8'),f.context);
 const t=f.context.MSA.telemetry;await f.sound.setEnabled(true);f.sound.configure({types:['Parâmetro'],sector:'montagem'});
 t.start();tick();t.scenario('NHPL','alerta');assert.equal(f.tones(),1);
 tick();assert.equal(f.tones(),1);await f.sound.setEnabled(false);t.scenario('NHPL','operando');t.scenario('NHPL','alerta');assert.equal(f.tones(),1);t.stop();
});
