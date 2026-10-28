/* Import a traced, bone-bound vector skin. Raw image/video processing happens
 * in the optional local capture tool; the playable HTML contains SVG only. */
'use strict';
(()=>{
 const $=id=>document.getElementById(id),F=()=>globalThis.INKForge,A=()=>globalThis.SVG_FIGHTER;
 const labels={head:'头',neck:'颈',rearShoulder:'后肩',rearElbow:'后肘',rearHand:'后腕',frontShoulder:'前肩',frontElbow:'前肘',frontHand:'前腕',rearHip:'后髋',rearKnee:'后膝',rearFoot:'后踝',frontHip:'前髋',frontKnee:'前膝',frontFoot:'前踝'};
 const lines=[['head','neck'],['rearShoulder','frontShoulder'],['neck','rearHip'],['neck','frontHip'],['rearHip','frontHip'],['rearShoulder','rearElbow'],['rearElbow','rearHand'],['frontShoulder','frontElbow'],['frontElbow','frontHand'],['rearHip','rearKnee'],['rearKnee','rearFoot'],['frontHip','frontKnee'],['frontKnee','frontFoot']];
 let dialog,draft=null,draftMotion=null,preview=null,clip=null,drag=null,saved=null,last=0,frame=0,pending=0,sequenceUrl=null,exampleCache=null;
 const svg=()=> $('image-model-source');
 const profile=()=>draft?({...F().store.profile(draft.character),imageSkin:draft}):F().store.profile($('image-model-character').value);
 function status(text,error=false){$('image-model-status').textContent=text;$('image-model-status').dataset.error=error?'true':'false';}
 function saving(delta){pending+=delta;$('image-model-close').disabled=pending>0;}
 function source(){
  const root=svg();root.replaceChildren();root.setAttribute('viewBox',`0 0 ${draft.width} ${draft.height}`);
  for(const p of draft.paths)INK.SVG.node('path',{d:p.d,fill:p.fill,'fill-rule':'evenodd'},root);
  const overlay=INK.SVG.node('g',{'data-bone-overlay':'true'},root);
  for(const [a,b]of lines){const x=draft.joints[a],y=draft.joints[b];INK.SVG.node('line',{x1:x[0],y1:x[1],x2:y[0],y2:y[1],stroke:'#62e4cb','stroke-width':Math.max(.8,draft.height*.003),opacity:.8},overlay);}
  const radius=Math.max(2.5,draft.height*.009);
  for(const [name,q]of Object.entries(draft.joints)){
   const g=INK.SVG.node('g',{'data-joint':name,style:'cursor:grab;touch-action:none'},overlay);
   INK.SVG.node('circle',{cx:q[0],cy:q[1],r:radius,fill:'#fff5da',stroke:'#176655','stroke-width':Math.max(.7,radius*.2)},g);
   const t=INK.SVG.node('text',{x:q[0]+radius+1,y:q[1]-radius,fill:'#fff8e6',stroke:'#1c3633','stroke-width':Math.max(.8,radius*.3),'paint-order':'stroke',style:`font:${Math.max(7,draft.height*.024)}px sans-serif;pointer-events:none`},g);t.textContent=labels[name]||name;
  }
 }
 function mount(){
  if(!draft&&!draftMotion)return;preview?.destroy();$('image-model-live').replaceChildren();
  try{
   if(draft)draft=INK.ImageSkin.validate(draft);preview=new INK.Renderer($('image-model-live'),profile());
   const id=$('image-model-motion').value,character=$('image-model-character').value,record=draftMotion?.character===character&&draftMotion.gameId===id?draftMotion:F().store.byGame(character,id)||F().store.getMove(character,'idle');
   clip=new (INK.CompiledClip||INK.Clip)(record.clip);frame=0;last=0;
   $('image-model-apply').disabled=!draft;$('image-model-svg').disabled=!draft;$('image-model-json').disabled=!draft;
   if(draft)status(`已载入 ${draft.paths.length} 个 SVG 路径；可拖动骨点，预览复用所选角色的动作。`);
  }catch(e){preview=null;clip=null;$('image-model-apply').disabled=true;status(e.message,true);}
 }
 function drawFrame(now){
  requestAnimationFrame(drawFrame);if(!dialog?.open||!preview||!clip)return;
  if(last)frame=(frame+Math.min(.05,(now-last)/1000)*60)%Math.max(1,clip.duration);last=now;
  try{const p=clip.sample(frame);preview.render(p,{frame,rig:INK.Rig.solveAnimation(profile(),p),secondary:false});}catch(e){status('预览失败：'+e.message,true);preview=null;}
 }
 function exportSvg(){
  const root=document.createElementNS(INK.SVG.NS,'svg');root.setAttribute('xmlns',INK.SVG.NS);root.setAttribute('viewBox',`0 0 ${draft.width} ${draft.height}`);
  const meta=INK.SVG.node('metadata',{},root);meta.textContent=JSON.stringify({kind:'ink-vector-skin-bind',version:1,character:draft.character,joints:draft.joints});
  for(const part of INK.ImageSkin.parts){const g=INK.SVG.node('g',{'data-ink-part':part},root);for(const p of draft.paths.filter(q=>q.part===part))INK.SVG.node('path',{d:p.d,fill:p.fill,'fill-rule':'evenodd'},g);}
  INK.Portable.download(draft.character+'-vector-skin.svg',new XMLSerializer().serializeToString(root),'image/svg+xml');
 }
 function validateSequence(text){
  if(/<!DOCTYPE|<!ENTITY/i.test(text))throw Error('逐帧 SVG 包含不支持的文档声明');
  const doc=new DOMParser().parseFromString(text,'image/svg+xml'),root=doc.documentElement;
  if(root.localName!=='svg'||doc.querySelector('parsererror'))throw Error('逐帧 SVG 无效');
  const allowed={svg:['xmlns','viewBox','width','height'],g:['id','visibility'],path:['d','fill','fill-rule'],animate:['attributeName','calcMode','values','keyTimes','dur','repeatCount'],title:[],desc:[]};
  const nodes=[root,...root.querySelectorAll('*')];if(nodes.length>2500)throw Error('逐帧 SVG 过大');let paths=0,frames=0;
  for(const n of nodes){
   if(!allowed[n.localName])throw Error('逐帧 SVG 含不支持的元素：'+n.localName);
   for(const a of n.attributes)if(!allowed[n.localName].includes(a.name))throw Error('逐帧 SVG 含不支持的属性');
   if(n.localName==='path'){
    const d=n.getAttribute('d')||'',fill=n.getAttribute('fill')||'';if(d.length>30000||!/^[MLZ0-9.,\s+-]+$/.test(d)||!/^#[0-9a-f]{6}$/i.test(fill))throw Error('逐帧 SVG 路径无效');
    INK.compilePath(d);paths++;
   }
   if(n.localName==='g'){const id=n.getAttribute('id')||'',visibility=n.getAttribute('visibility');if(!/^frame-\d{3}$/.test(id)||visibility!==(id==='frame-000'?'visible':'hidden'))throw Error('逐帧 SVG 帧标记无效');frames++;}
   if(n.localName==='animate'&&!(n.getAttribute('attributeName')==='visibility'&&n.getAttribute('calcMode')==='discrete'&&/^(visible|hidden)(;(visible|hidden))*$/.test(n.getAttribute('values')||'')&&/^[0-9.;]+$/.test(n.getAttribute('keyTimes')||'')&&/^\d+(\.\d+)?s$/.test(n.getAttribute('dur')||'')&&n.getAttribute('repeatCount')==='indefinite'))throw Error('逐帧 SVG 动画无效');
  }
  if(!paths||frames<2||frames>90)throw Error('逐帧 SVG 不包含有效动作帧');
  return {svg:new XMLSerializer().serializeToString(root),frames,paths};
 }
 function examples(){return exampleCache||(exampleCache=JSON.parse($('ink-image-examples').textContent));}
 function showSequence(text){
  const result=validateSequence(text);if(sequenceUrl)URL.revokeObjectURL(sequenceUrl);
  sequenceUrl=URL.createObjectURL(new Blob([result.svg],{type:'image/svg+xml'}));
  $('image-sequence-image').src=sequenceUrl;$('image-sequence-preview').hidden=false;return result;
 }
 function loadMaiExample(){
  draft=INK.ImageSkin.validate(examples().maiSkin);$('image-model-character').value='mai';source();mount();
  $('image-motion-apply').disabled=!draftMotion||draftMotion.character!=='mai';
  if(preview)status('已载入舞的模型样例，仅供预览；点击“保存并应用模型”才会更改游戏角色。');
 }
 function init(){
  if(!F()?.ready){if(!F()?.error)requestAnimationFrame(init);return;}
  const button=document.createElement('button');button.id='image-model-open';button.textContent='图片建模';document.querySelector('#forge-app .f-top nav').append(button);
  dialog=document.createElement('dialog');dialog.id='image-model-dialog';dialog.innerHTML=`
   <header><div><span>IMAGE / VIDEO → SVG</span><h2>图片人物建模</h2><p>内置舞的视频招式和模型样例；也可以导入模型，校正骨点。</p></div><button id="image-model-close" aria-label="关闭">×</button></header>
   <section class="image-model-controls"><label>绑定角色<select id="image-model-character"></select></label><button id="image-model-example" type="button">载入舞模型样例</button><label class="image-model-upload">导入矢量模型 JSON<input id="image-model-file" type="file" accept=".json,application/json"></label><label>动作预览<select id="image-model-motion"><option value="sMP">站立中拳</option><option value="sHP">站立重拳</option><option value="sHK">站立重脚</option><option value="@idle">待机</option></select></label><label class="image-model-upload">导入动作 JSON<input id="image-motion-file" type="file" accept=".json,application/json"></label><label class="image-model-upload">预览逐帧 SVG<input id="image-sequence-file" type="file" accept=".svg,image/svg+xml"></label></section>
   <div class="image-model-grid"><section id="image-sequence-preview" hidden><h3>视频招式 / 逐帧 SVG 参考</h3><img id="image-sequence-image" alt="逐帧矢量动作预览"><p>独立播放的视觉参考，不会自动绑定到实战招式或判定。</p></section><section><h3>原始分件 / 拖动关键点校正</h3><svg id="image-model-source" role="img" aria-label="矢量分件与可拖动骨点"></svg></section><section><h3>基础骨架预览（实战仍受游戏约束）</h3><svg viewBox="-220 -440 440 470" role="img" aria-label="使用现有骨骼的动画预览"><path d="M-220 0H220" stroke="#71837b"/><g id="image-model-live"></g></svg></section></div>
   <p id="image-model-status" role="status">先选择本地生成的 INK 矢量模型 JSON。</p><p class="image-model-note">只使用 SVG 路径，不内嵌视频或图片。单视角看不到的背面、遮挡部分不会自动生成；识别与矢量化结果需要校正。导入动作会替换对应招式的曲线，可能影响实战判定。</p>
   <footer><button id="image-model-restore">恢复该角色原建模</button><button id="image-model-svg" disabled>导出分件 SVG</button><button id="image-model-json" disabled>导出模型 JSON</button><button id="image-motion-apply" disabled>保存动作</button><button id="image-model-apply" class="f-primary" disabled>保存并应用模型</button></footer>`;
  document.body.append(dialog);
  $('image-model-character').innerHTML=INK.Schema.CHARACTERS.map(id=>`<option value="${id}">${F().store.getModel(id).cn} / ${id.toUpperCase()}</option>`).join('');$('image-model-character').value='mai';
  button.onclick=()=>{const id=F().state.route==='battle'?A().fighters[0]?.ch.id:F().state.character;if(INK.Schema.CHARACTERS.includes(id))$('image-model-character').value=id;const selected=$('image-model-character').value,existing=F().store.getSkin(selected);try{let usingExample=false;if(!sequenceUrl)showSequence(examples().maiSequence);if(existing)draft=INK.ImageSkin.validate(existing);else if(draft)draft.character=selected;else if(selected==='mai'){draft=INK.ImageSkin.validate(examples().maiSkin);usingExample=true;}if(draft){source();mount();if(usingExample&&preview)status('已载入舞的模型样例，仅供预览；点击“保存并应用模型”才会更改游戏角色。');}else status('已显示舞的招式样例；可点击“载入舞模型样例”查看人物。');}catch(e){status('样例载入失败：'+e.message,true);}$('image-motion-apply').disabled=!draftMotion||draftMotion.character!==selected;saved={state:A().state,screen:A().state.screen,paused:A().state.paused};A().state.paused=true;dialog.showModal();};
  $('image-model-example').onclick=()=>{try{loadMaiExample();}catch(e){status('样例载入失败：'+e.message,true);}};
  $('image-model-close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{if(saved&&saved.state===A().state&&saved.screen===A().state.screen)A().state.paused=saved.paused;saved=null;last=0;INK.EngineClock.reset();});
  $('image-sequence-image').onerror=()=>status('逐帧 SVG 预览加载失败，请重试导入。',true);
  dialog.addEventListener('cancel',e=>{if(pending)e.preventDefault();});
  $('image-model-character').onchange=()=>{if(draft){draft.character=$('image-model-character').value;mount();}$('image-motion-apply').disabled=!draftMotion||draftMotion.character!==$('image-model-character').value;};
  $('image-model-motion').onchange=mount;
  $('image-model-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>2000000)throw Error('模型文件不能超过 2 MB');draft=INK.ImageSkin.validate(JSON.parse(await file.text()));$('image-model-character').value=draft.character;source();mount();}catch(error){status(error.message,true);}e.target.value='';};
  $('image-sequence-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>5000000)throw Error('逐帧 SVG 不能超过 5 MB');const result=showSequence(await file.text());status(`已载入 ${result.frames} 帧、${result.paths} 条路径的逐帧 SVG；仅作视觉参考。`);}catch(error){status(error.message,true);}e.target.value='';};
  $('image-motion-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>2000000)throw Error('动作文件不能超过 2 MB');draftMotion=INK.Schema.move(JSON.parse(await file.text()));$('image-model-character').value=draftMotion.character;const select=$('image-model-motion');if(![...select.options].some(o=>o.value===draftMotion.gameId)){const o=document.createElement('option');o.value=draftMotion.gameId;o.textContent=draftMotion.name;select.append(o);}select.value=draftMotion.gameId;if(draft)draft.character=draftMotion.character;mount();$('image-motion-apply').disabled=false;const capture=draftMotion.clip.meta?.capture,range=capture?`（视频 ${capture.start}–${capture.end} 秒，${capture.detected}/${capture.frames} 帧已识别）`:'';status(`已载入 ${draftMotion.name}${range}，尚未保存。请检查是否包含完整起手、命中与收势。`);}catch(error){draftMotion=null;$('image-motion-apply').disabled=true;status(error.message,true);}e.target.value='';};
  $('image-motion-apply').onclick=async()=>{if(!draftMotion)return;const button=$('image-motion-apply');button.disabled=true;saving(1);status('正在保存动作…');try{await F().store.save({motion:draftMotion});status(`已替换 ${draftMotion.name} 的动作曲线；请在实战中复核动作与判定。`);}catch(error){status(error.message,true);}finally{saving(-1);button.disabled=false;}};
  $('image-model-apply').onclick=async()=>{const button=$('image-model-apply');button.disabled=true;saving(1);status('正在保存矢量人物…');try{const result=await F().store.saveSkin(draft.character,draft);F().buildHero();status(result.durable?'矢量人物已保存并应用到该角色。':'矢量人物已应用，但浏览器无法持久保存，请导出 JSON。');}catch(e){status(e.message,true);}finally{saving(-1);button.disabled=!draft;}};
  $('image-model-restore').onclick=async()=>{const button=$('image-model-restore');button.disabled=true;saving(1);status('正在恢复原始建模…');try{await F().store.saveSkin($('image-model-character').value,null);F().buildHero();status('已恢复该角色的原始建模。');}catch(e){status(e.message,true);}finally{saving(-1);button.disabled=false;}};
  $('image-model-svg').onclick=exportSvg;$('image-model-json').onclick=()=>INK.Portable.download(draft.character+'-vector-skin.json',JSON.stringify(draft),'application/json');
  svg().addEventListener('pointerdown',e=>{const joint=e.target.closest('[data-joint]');if(!joint||!draft)return;drag=joint.dataset.joint;svg().setPointerCapture(e.pointerId);e.preventDefault();});
  svg().addEventListener('pointermove',e=>{if(!drag)return;const point=new DOMPoint(e.clientX,e.clientY).matrixTransform(svg().getScreenCTM().inverse());draft.joints[drag]=[Math.max(0,Math.min(draft.width,point.x)),Math.max(0,Math.min(draft.height,point.y))];source();});
  const end=()=>{if(drag){drag=null;mount();}};svg().addEventListener('pointerup',end);svg().addEventListener('pointercancel',end);
  requestAnimationFrame(drawFrame);
 }
 init();
})();
