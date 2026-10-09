import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync('dist/assets/accessibility.js','utf8');
const motionSource=readFileSync('dist/assets/motion-ui.js','utf8');
function fixture(saved=null,blocked=false){
 const storage=new Map(saved?[['msa-accessibility-v1',saved]]:[]),listeners={},windowListeners={},controls=[],dataset={},feedback={textContent:''};
 const document={documentElement:{dataset},hidden:false,querySelectorAll:()=>controls,getElementById:()=>feedback,addEventListener:(type,fn)=>(listeners[type]??=[]).push(fn),dispatchEvent:event=>(listeners[event.type]||[]).forEach(fn=>fn(event))};
 const context={document,localStorage:{getItem:k=>{if(blocked)throw Error('blocked');return storage.get(k)||null;},setItem:(k,v)=>{if(blocked)throw Error('blocked');storage.set(k,v);}},CustomEvent:class{constructor(type){this.type=type;}},addEventListener:(type,fn)=>windowListeners[type]=fn,matchMedia:()=>({matches:false,addEventListener(){}}),MutationObserver:class{observe(){}}};
 context.window=context;vm.createContext(context);vm.runInContext(source,context);
 return {context,dataset,feedback,storage,controls,change:(option,value)=>{const input={dataset:{a11yOption:option},type:typeof value==='boolean'?'checkbox':'select-one',value,checked:value,closest:()=>input};controls.push(input);document.dispatchEvent({type:'change',target:input});return input;},reset:()=>document.dispatchEvent({type:'click',target:{closest:()=>true}}),storageEvent:windowListeners.storage};
}
test('choices apply immediately, persist across pages, and reset without removing other preferences',()=>{
 const f=fixture();f.storage.set('msa-theme','dark');f.change('palette','redgreen');f.change('text','125');f.change('spacing',true);f.change('contrast',true);
 assert.equal(f.dataset.a11yPalette,'redgreen');assert.equal(f.dataset.a11yText,'125');assert.equal(f.dataset.a11ySpacing,'true');assert.equal(f.dataset.a11yContrast,'true');
 const next=fixture(f.storage.get('msa-accessibility-v1'));assert.equal(next.dataset.a11yText,'125');assert.match(next.context.MSA.accessibility.render(),/value="redgreen" selected/);
 f.reset();assert.equal(f.dataset.a11yText,'100');assert.equal(f.dataset.a11yPalette,'default');assert.equal(f.storage.get('msa-theme'),'dark');assert.match(f.feedback.textContent,/salvas/);
});
test('invalid saved values and blocked storage leave the settings usable',()=>{
 for(const raw of ['{broken','null','42','{"palette":"<script>","text":"900","motion":"false"}'])assert.equal(fixture(raw).dataset.a11yPalette,'default');
 const f=fixture(null,true);f.change('contrast',true);assert.equal(f.dataset.a11yContrast,'true');assert.match(f.feedback.textContent,/não permitiu/);
});
test('other tabs synchronize preferences and visible controls',()=>{
 const f=fixture(),input=f.change('text','112');f.storageEvent({key:'msa-accessibility-v1',newValue:'{"text":"125","motion":true}'});assert.equal(input.value,'125');assert.equal(f.dataset.a11yMotion,'true');
 f.storageEvent({key:'msa-accessibility-v1',newValue:null});assert.equal(input.value,'100');
});
test('motion choice disables the shared animation layer while data events remain independent',()=>{
 const f=fixture();f.context.Motion={animate(){}};vm.runInContext(motionSource,f.context);assert.equal(f.context.MSA.motion.enabled(),true);
 f.change('motion',true);assert.equal(f.context.MSA.motion.enabled(),false);assert.equal(f.context.MSA.motion.reduced,true);
 f.reset();assert.equal(f.context.MSA.motion.enabled(),true);
});
