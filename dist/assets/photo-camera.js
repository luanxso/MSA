/* Câmera por vídeo: o botão de captura não abre o seletor de arquivos. */
window.MSA=window.MSA||{};
(() => {
 'use strict';
 let dialog=null,stream=null,session=null,revision=0,facing='environment';
 const node=id=>dialog.querySelector('#'+id);
 function release(){revision++;if(stream){stream.getTracks().forEach(track=>track.stop());stream=null;}if(dialog){node('photo-camera-video').srcObject=null;node('photo-camera-shoot').disabled=true;}}
 async function close(){release();session=null;if(!dialog?.open)return;if(MSA.motion)await MSA.motion.closeDialog(dialog);else dialog.close();}
 function status(text){node('photo-camera-status').textContent=text;}
 function failure(error){
  const name=error?.name;
  if(name==='NotAllowedError'||name==='SecurityError')return 'A câmera não foi autorizada. Permita o acesso nas configurações do navegador. Se estiver no visualizador de um editor, abra o sistema no Chrome ou Safari.';
  if(name==='NotFoundError')return 'Nenhuma câmera disponível neste dispositivo. Você pode escolher uma foto já capturada.';
  if(name==='NotReadableError'||name==='AbortError')return 'A câmera está ocupada ou não pôde ser iniciada. Feche outros aplicativos que usam a câmera e tente novamente.';
  return error?.message||'Não foi possível abrir a câmera. Tente no navegador do dispositivo.';
 }
 function init(){
  if(dialog)return;
  dialog=document.createElement('dialog');dialog.id='photo-camera-dialog';dialog.className='photo-camera-dialog';dialog.setAttribute('aria-labelledby','photo-camera-title');dialog.setAttribute('aria-describedby','photo-camera-status');
  dialog.innerHTML='<header><h2 id="photo-camera-title">Tirar foto</h2><button type="button" class="icon-button" id="photo-camera-close" aria-label="Fechar câmera">×</button></header><p id="photo-camera-status" role="status" aria-live="polite"></p><video id="photo-camera-video" autoplay muted playsinline aria-label="Imagem ao vivo da câmera"></video><p class="photo-camera-hint">Centralize um único instrumento. No visor digital, enquadre apenas o número da zona escolhida.</p><div class="photo-camera-actions"><button type="button" class="secondary-button" id="photo-camera-switch">Trocar câmera</button><button type="button" class="primary-button" id="photo-camera-shoot" disabled>Capturar foto</button><button type="button" class="secondary-button" id="photo-camera-retry" hidden>Tentar novamente</button></div><label class="text-button photo-camera-file">Escolher foto já capturada<input id="photo-camera-file" type="file" accept="image/*"></label>';
  document.body.append(dialog);
  node('photo-camera-close').addEventListener('click',()=>void close());
  dialog.addEventListener('cancel',event=>{event.preventDefault();void close();});
  dialog.addEventListener('close',()=>{release();session=null;});
  node('photo-camera-switch').addEventListener('click',()=>{facing=facing==='environment'?'user':'environment';void start();});
  node('photo-camera-retry').addEventListener('click',()=>void start());
  node('photo-camera-shoot').addEventListener('click',()=>void shoot());
  node('photo-camera-file').addEventListener('change',event=>{const file=event.target.files[0],current=session;event.target.value='';if(!file||!current)return;void close().then(()=>current.onCapture(file)).catch(error=>current.onError?.(error));});
  addEventListener('hashchange',()=>void close());addEventListener('pagehide',()=>void close());
  document.addEventListener('visibilitychange',()=>{if(document.hidden)void close();});
 }
 async function start(){
  release();const rev=revision,current=session,video=node('photo-camera-video');
  node('photo-camera-retry').hidden=true;node('photo-camera-switch').disabled=true;video.hidden=true;
  status('Aguardando permissão para abrir a câmera…');
  try{
   if(!window.isSecureContext)throw new Error('A câmera precisa de uma página segura. Abra o sistema por HTTPS no navegador, ou por localhost no próprio dispositivo. O visualizador de arquivos pode bloquear esse acesso.');
   if(!navigator.mediaDevices?.getUserMedia)throw new Error('Este visualizador não disponibiliza a câmera. Abra o sistema no Chrome ou Safari e permita o acesso, ou escolha uma foto já capturada.');
   const next=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:facing},width:{ideal:1280},height:{ideal:720}}});
   if(rev!==revision||session!==current||!dialog.open){next.getTracks().forEach(track=>track.stop());return;}
   stream=next;video.srcObject=next;video.hidden=false;await video.play();
   if(rev!==revision||session!==current||!dialog.open)return;
   status('Câmera pronta. Enquadre o instrumento e toque em Capturar foto.');
   node('photo-camera-shoot').disabled=false;node('photo-camera-switch').disabled=false;
   next.getVideoTracks().forEach(track=>track.addEventListener('ended',()=>{if(stream===next){release();status('A câmera foi desconectada. Tente novamente.');node('photo-camera-retry').hidden=false;}}));
  }catch(error){if(rev!==revision||session!==current||!dialog.open)return;release();status(failure(error));node('photo-camera-retry').hidden=false;}
 }
 async function shoot(){
  const current=session,rev=revision,video=node('photo-camera-video');if(!current||!stream)return;
  if(!video.videoWidth||!video.videoHeight){status('A imagem da câmera ainda não está pronta. Aguarde um instante.');return;}
  node('photo-camera-shoot').disabled=true;
  try{
   const canvas=document.createElement('canvas'),scale=Math.min(1,1600/Math.max(video.videoWidth,video.videoHeight));canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.92));if(!blob)throw new Error('Não foi possível capturar a imagem. Tente novamente.');
   if(rev!==revision||session!==current||!dialog.open)return;
   const file=new File([blob],'captura-camera.jpg',{type:'image/jpeg'});await close();await current.onCapture(file);
  }catch(error){if(session===current){status(failure(error));node('photo-camera-shoot').disabled=!stream;}else current.onError?.(error);}
 }
 MSA.photoCamera={open(options){init();release();session=options;facing='environment';node('photo-camera-title').textContent='Tirar foto · '+options.title;if(MSA.motion)MSA.motion.openDialog(dialog);else dialog.showModal();void start();},close};
})();
