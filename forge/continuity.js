/* FLOW 06: inspection of the actual production renderer. No pre-rendered video.
 * Deliberately starts with FX off, so joints and seams cannot hide in particles.
 */
'use strict';
(()=>{
 const $=id=>document.getElementById(id),F=()=>INKForge;
 const choices=[['turn','360° 连续转身'],['sHK','重脚 · 收招修复'],['sMK','中脚 · 收招修复'],['ryuuenbu-heavy','龙炎舞 · 全身转轴'],['kachousen-heavy','花蝶扇 · 肘部连续性'],['hishou-ryuuenjin-heavy','飞翔龙炎阵 · 空中姿态']];
 let dialog,renderer,fx,record,clip,frame=0,limit=180,mode='turn',playing=false,speed=.35,stamp=0,direction=1,focus,saved,current;
 function select(key){if(!choices.some(v=>v[0]===key))throw Error('Unknown continuity study');mode=key;record=F().store.getMove('mai',key==='turn'?'idle':key);clip=F().store.clip(record);limit=key==='turn'?180:record.clip.duration;frame=key==='sHK'?22:key==='sMK'?16:0;$('continuity6-move').value=key;$('continuity6-seek').max=limit;paint();}
 function paint(){
  if(!renderer)return;const profile=F().store.profile('mai'),t=mode==='turn'?0:frame;
  let pose=INK.MotionGraph.compose(record,t,clip.sample(t),profile);
  if(mode==='turn'){pose.yaw=frame*2;pose.turn=0;pose.headYaw=pose.chestYaw=pose.pelvisYaw=0;}
  const rig=INK.Rig.solveAnimation(profile,pose),s=INK.Rig.sockets(pose,rig);
  $('continuity6-root').setAttribute('transform',`translate(305 500) scale(${direction*1.04*(pose.depth||1)} 1.04) translate(${pose.rootShift||0} ${pose.floor||0}) rotate(${pose.spin||0} 0 -180)`);
  renderer.setMode($('continuity6-rig').checked?'overlay':'skin');
  renderer.render(pose,{rig,frame:t,secondary:mode!=='turn',motion:INK.SecondaryDynamics.sample(record.clip,t),expression:t>=record.binding.startup&&t<record.binding.startup+record.binding.active?'power':'rest'});
  fx.visible=$('continuity6-fx').checked&&mode!=='turn';fx.render(record,t,pose,rig);
  let boneError=0;const lengths=INK.Anatomy.lengths(profile);
  for(const name of ['rearArm','frontArm','rearLeg','frontLeg']){const q=rig.anatomy.source[name],i=name.includes('Leg')?2:0,projection=pose[name+'Projection']??1;for(let j=0;j<2;j++)boneError=Math.max(boneError,Math.abs(INK.vec.length(INK.vec.sub(q[j+1],q[j]))-lengths[i+j]*projection));}
  const wrist=INK.mat.point(INK.Anatomy.handMatrix(pose,rig,profile),[0,0]);
  const wristError=Math.hypot(wrist[0]-s.frontArm[2][0],wrist[1]-s.frontArm[2][1]);
  current={mode,frame,yaw:INK.Turn.angle(pose),pose,sourceBones:rig.anatomy.source,sockets:s,boneError,wristError,direction};
  $('continuity6-frame').textContent=mode==='turn'?`${(frame*2).toFixed(1)}°`:`${frame.toFixed(2)} / ${limit} F`;$('continuity6-seek').value=frame;
  $('continuity6-bones').textContent=boneError.toFixed(5)+' px';$('continuity6-wrist').textContent=wristError.toFixed(5)+' px';$('continuity6-yaw').textContent=INK.Turn.angle(pose).toFixed(1)+'°';
  $('continuity6-caption').textContent=mode==='turn'?'同一待机姿态，只改变躯干转角。观察脚底高度、手腕与折扇接合。':'真实动作资产 → 角度连续求值 → 同轴投影 → 连续曲面。';
 }
 function open(key='turn'){focus=document.activeElement;const A=SVG_FIGHTER;saved={screen:A.state.screen,paused:A.state.paused,fighter:A.fighters[0]};if(A.state.screen==='battle')A.state.paused=true;playing=false;dialog.showModal();select(key);$('continuity6-play').textContent='播放';$('continuity6-play').focus();}
 function close(){if(dialog.open)dialog.close();}
 function seek(value){if(!Number.isFinite(value))throw TypeError('Finite frame required');playing=false;frame=INK.clamp(value,0,limit);$('continuity6-play').textContent='播放';paint();}
 function init(){
  if(!globalThis.INKForge?.ready||!globalThis.INKEngineLab){requestAnimationFrame(init);return;}
  const launch=document.createElement('section');launch.className='continuity6-launch';launch.innerHTML='<div><span class="continuity6-eyebrow">FLOW 06 / CONTINUOUS ARTICULATION</span><h3>先看清动作，再打开火焰。</h3><p>共享关节 · 连续肢体曲面 · 同轴转身。无特效逐帧检查，不用光效遮住接缝。</p></div><button id="continuity6-open">打开骨架与转身检视 ↗</button>';
  document.querySelector('.mai-feature').before(launch);const nav=document.createElement('button');nav.id='continuity6-nav';nav.textContent='骨架检视';document.querySelector('.f-top nav').appendChild(nav);
  dialog=document.createElement('dialog');dialog.id='continuity6-dialog';dialog.className='continuity6-dialog';dialog.setAttribute('aria-labelledby','continuity6-title');
  dialog.innerHTML=`<header><div><span class="continuity6-eyebrow">FLOW 06 / ANATOMY LAB</span><h2 id="continuity6-title">让关节接上，让转身连贯。</h2><p>这里使用与实战相同的骨架和 SVG 渲染器。默认关闭特效。</p></div><button id="continuity6-close" aria-label="关闭骨架检视">×</button></header><div class="continuity6-grid"><section class="continuity6-stage"><div class="continuity6-stage-label"><span>MAI SHIRANUI</span><span>LIVE SVG / NOT A VIDEO</span></div><svg id="continuity6-svg" viewBox="0 0 610 550" role="img" aria-label="不知火舞连续骨架回放"><defs><pattern id="continuity6-grid" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M25 0H0V25" fill="none" stroke="#526753" opacity=".11" stroke-width=".6"/></pattern></defs><path d="M0 0H610V550H0Z" fill="url(#continuity6-grid)"/><circle cx="305" cy="277" r="195" fill="none" stroke="#526753" opacity=".12"/><path d="M35 500H575M305 45V515" fill="none" stroke="#526753" opacity=".3"/><ellipse cx="305" cy="504" rx="103" ry="7" fill="#546750" opacity=".12"/><g id="continuity6-root"/></svg><p id="continuity6-caption"></p></section><aside><label for="continuity6-move">动作检查</label><select id="continuity6-move">${choices.map(([k,n])=>`<option value="${k}">${n}</option>`).join('')}</select><div class="continuity6-notes"><h3>重点观察</h3><p>转身时肩、肘、手腕采用同一个投影，手与扇不再各转各的。脚掌的零度保持平放。</p><p>重脚和中脚收招恢复正确手腕轨道。肘膝由连续角度重建，不再突然跳到另一侧。</p><p>上臂与前臂、大腿与小腿共用一条外轮廓，光影带也连续经过关节。</p></div><label class="continuity6-switch">骨架叠加<input type="checkbox" id="continuity6-rig"></label><label class="continuity6-switch">显示特效<input type="checkbox" id="continuity6-fx"></label><button id="continuity6-mirror">左右镜像</button><dl><div><dt>源骨长度误差</dt><dd id="continuity6-bones">—</dd></div><div><dt>腕部挂点误差</dt><dd id="continuity6-wrist">—</dd></div><div><dt>躯干转角</dt><dd id="continuity6-yaw">—</dd></div></dl><small>误差是当前帧的几何检查，不代表所有动作的艺术质量。当前仍为 2.5D SVG，不是完整 3D 人体。</small></aside></div><footer><div class="continuity6-transport"><button id="continuity6-play">播放</button><button id="continuity6-prev" aria-label="前一帧">−1F</button><button id="continuity6-next" aria-label="后一帧">+1F</button><select id="continuity6-speed" aria-label="播放速度"><option value=".15">0.15×</option><option value=".35" selected>0.35×</option><option value=".5">0.5×</option><option value="1">1×</option></select><input id="continuity6-seek" type="range" min="0" max="180" step=".05" value="0" aria-label="动作时间轴"><output id="continuity6-frame"></output></div><div class="continuity6-pipeline">AUTHOR TARGETS → UNWRAPPED JOINTS → FK → COHERENT TURN → SHARED SURFACE & SOCKETS</div></footer>`;
  document.body.appendChild(dialog);renderer=new INK.Renderer($('continuity6-root'),F().store.profile('mai'));fx=new INK.Effects($('continuity6-root'));$('continuity6-root').insertBefore(fx.backRoot,renderer.group);
  renderer.setStyle(F().store.profile('mai').previewStyle||{});
  F().store.on(()=>{const was=frame,key=mode;renderer.destroy();fx.destroy();const profile=F().store.profile('mai');renderer=new INK.Renderer($('continuity6-root'),profile);renderer.setStyle(profile.previewStyle||{});fx=new INK.Effects($('continuity6-root'));$('continuity6-root').insertBefore(fx.backRoot,renderer.group);if(dialog.open){select(key);seek(Math.min(was,limit));}});
  $('continuity6-open').onclick=()=>open();nav.onclick=()=>open();$('continuity6-close').onclick=close;
  dialog.addEventListener('close',()=>{playing=false;const A=SVG_FIGHTER;if(saved&&saved.screen===A.state.screen&&saved.fighter===A.fighters[0])A.state.paused=saved.paused;saved=null;INK.EngineClock.reset();focus?.focus({preventScroll:true});});
  $('continuity6-move').onchange=e=>select(e.target.value);$('continuity6-seek').oninput=e=>seek(Number(e.target.value));$('continuity6-rig').onchange=paint;$('continuity6-fx').onchange=paint;
  $('continuity6-prev').onclick=()=>seek(frame-1);$('continuity6-next').onclick=()=>seek(frame+1);$('continuity6-mirror').onclick=()=>{direction*=-1;paint();};
  $('continuity6-speed').onchange=e=>{speed=Number(e.target.value);};$('continuity6-play').onclick=()=>{playing=!playing;stamp=performance.now();$('continuity6-play').textContent=playing?'暂停':'播放';};
  function tick(now){requestAnimationFrame(tick);if(!dialog.open||!playing||document.hidden){stamp=now;return;}const dt=Math.min(.05,(now-stamp)/1000);stamp=now;frame=(frame+dt*60*speed)%limit;paint();}requestAnimationFrame(tick);
  window.INKContinuityLab={open,close,seek,select,paint,get state(){return current;},get renderer(){return renderer;},get limit(){return limit;},get playing(){return playing;}};
 }
 init();
})();
