/* Deliberate heavy-normal timing. State advances only on actionable simulation steps. */
'use strict';
(() => {
 const settings={enabled:true},rules=Object.freeze({hold:12,remaining:3,cost:.5,recovery:12});
 const active=()=>settings.enabled;
 function press(f,button,G){
  if(!['LP','MP','HP','LK','MK','HK'].includes(button))return null;
  const input=f._inkTempoInput||(f._inkTempoInput={serial:0,buttons:{}});
  const token=Object.freeze({button,serial:++input.serial,at:G.actionTick});input.buttons[button]=token;return token;
 }
 function started(f,G,context={}){
  const a=f.attack,m=a?.m,o=context.origin,input=f._inkTempoInput;
  f._inkTempo=null;
  if(!active()||!a||!context.neutral||!o||input?.buttons[o.button]!==o||!f.input?.held.has(o.button)||o.button!==m.button||!['sHP','sHK'].includes(m.id)||m.category!=='normal'||m.startup<6||m.air||f.y!==0||f.captured||f.airLock||a.rush||a.flowChain||context.chain)return false;
  a.tempo={phase:'armed',age:0,originButton:o.button,pressSerial:o.serial,pendingRelease:false,lastStep:null};return true;
 }
 function released(f,button){
  const input=f._inkTempoInput,token=input?.buttons[button];if(input)delete input.buttons[button];
  const q=f.attack?.tempo;if(q&&q.originButton===button&&(!token||token.serial===q.pressSerial))q.pendingRelease=true;
 }
 function clear(f,{cancel=false}={}){
  if(f._inkTempoInput)f._inkTempoInput.buttons={};
  if(cancel){if(f.attack)delete f.attack.tempo;f._inkTempo=null;}
  else if(f.attack?.tempo)f.attack.tempo.pendingRelease=true;
 }
 function step(f,G,context={}){
  const a=f.attack,q=a?.tempo;if(!q)return false;
  if(G.hitstop>0||G.paused&&!context.actionable)return q.phase==='holding';
  if(q.lastStep===G.actionTick)return q.swallowed===true;
  q.lastStep=G.actionTick;q.swallowed=false;
  if(f.state!=='attack'||f.captured||f.y!==0||f.airLock){delete a.tempo;return false;}
  if(q.phase==='released')return false;
  if(!active()||q.pendingRelease||!f.input?.held.has(q.originButton)){q.phase='released';return false;}
  if(a.t<a.m.startup-rules.remaining)return false;
  if(q.age>=rules.hold){q.phase='released';return false;}
  q.phase='holding';q.age++;q.swallowed=true;return true;
 }
 function decision(f,id,G){
  if(id!=='FEINT')return null;
  const q=f.attack?.tempo;
  const code=!active()?'disabled':G.phase!=='fight'||f.hp<=0?'phase':f.state!=='attack'||f.y!==0||f.captured||f.airLock?'ground':q?.phase!=='holding'||q.pendingRelease||f.attack.contactCount>0||f.attack.hitConfirmed?'window':G.hitstop>0?'hitstop':f.drive<rules.cost?'resource':'ready';
  return {ok:code==='ready',wait:code==='hitstop',code,kind:'strike-feint',cost:rules.cost,reason:code==='ready'?'主动收招':code==='resource'?'斗气不足':'仅重攻击蓄势中可收招'};
 }
 function startFeint(f,G,api){
  if(!decision(f,'FEINT',G).ok||!api.pay(f,rules.cost))return false;
  const q=f.attack.tempo,snapshot={phase:'feint',age:0,duration:rules.recovery,started:G.actionTick,originButton:q.originButton,pressSerial:q.pressSerial,dir:f.dir,move:f.attack.m.id};
  api.state(f,'recovery',rules.recovery);f._inkTempo=snapshot;
  f.invuln=0;f.throwInvuln=0;f.vx=0;f.input.queue=[];api.notify?.(f,'假动作 · −0.5 斗气');return true;
 }
 INK.StrikeTempo={settings,rules,active,press,started,released,clear,step,decision,startFeint};
})();
