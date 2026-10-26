/* Ground defense options share the public move-request path with CPU and player.
 * Motion is action-step owned; no hitbox edits, teleport or render-side state. */
'use strict';
(() => {
 const settings={enabled:true},clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const options={YIELD:{cost:.5,duration:10,travel:42,label:'守势退让'},ESCAPE:{cost:1.5,duration:20,travel:76,label:'脱压步'}};
 const active=()=>settings.enabled&&INK.Kinetic?.settings.enabled&&INK.CombatFlow.settings.rules==='flow';
 function decision(f,id,G){
  const option=options[id];if(!option)return null;
  const code=!active()?'disabled':f.state!=='block'||f.y!==0||f.captured?'guard':f._inkDefense||f._inkPressure?.spent?'used':G.hitstop>0?'hitstop':'ready';
  return {ok:code==='ready',code,wait:code==='hitstop',cost:option.cost,kind:'guard-choice',reason:({disabled:'攻防分支已关闭',guard:'需要地面防御硬直',used:'本轮防守已使用退让',hitstop:'解冻后执行防守选择',ready:option.label})[code]};
 }
 function start(f,id,G,api){
  if(!decision(f,id,G)?.ok)return false;const o=options[id];if(!api.pay(f,o.cost))return false;
  const oldT=f.stateT;if(id==='ESCAPE')api.state(f,'recovery',o.duration);else f.stateT=Math.max(oldT+4,o.duration);
  f._inkPressure={...(f._inkPressure||{}),spent:true,choices:(f._inkPressure?.choices||0)+1,last:id};
  f._inkDefense={id,age:0,duration:o.duration,travel:o.travel,dir:-f.dir,startX:f.x,origin:G.actionTick};
  f.push=0;f.input.queue=[];f.invuln=0;f.throwInvuln=0;
  api.notify(f,o.label+' −'+o.cost+' 斗气');return true;
 }
 function contact(f,G,type){if(type!=='block')return;const q=f._inkPressure||{};f._inkPressure={...q,blocks:(q.blocks||0)+1,lastBlock:G.actionTick};}
 function cancel(f,state){if(['hit','tumble','captured','throwing','down','ko','stun'].includes(state))f._inkDefense=null;}
 function step(f){
  const q=f._inkDefense?{...f._inkDefense}:null;
  if(q){if(!active()||!['block','recovery'].includes(f.state)||f.y!==0||f.captured){f._inkDefense=null;return;}
   q.age++;f._inkDefense=q;const frames=q.id==='YIELD'?10:12;
   if(q.age<=frames){const t=q.age/frames,prev=(q.age-1)/frames,ease=x=>1-(1-x)**2;f.x=clamp(f.x+q.dir*q.travel*(ease(t)-ease(prev)),105,1335);}
   if(q.age>=q.duration)f._inkDefense=null;
  }
  if(!f._inkDefense&&f.state==='idle'&&!f.attack&&f._inkPressure?.spent)f._inkPressure={...f._inkPressure,spent:false};
 }
 // A brief strike-only shield starts after the original guarded contact.
 // Throws, later attacks and the long vulnerable recovery can catch this exit.
 function beginContacts(f,G){const q=f._inkDefense;if(q?.id==='ESCAPE'&&q.firstContactFrame==null)f._inkDefense={...q,firstContactFrame:G.actionTick};}
 const shields=(f,m,G=globalThis.SVG_FIGHTER?.state)=>active()&&f._inkDefense?.id==='ESCAPE'&&!m.throw&&(f._inkDefense.firstContactFrame==null||G.actionTick-f._inkDefense.firstContactFrame<4);
 function inspect(f){return {enabled:active(),defense:f._inkDefense?{...f._inkDefense}:null,pressure:f._inkPressure?{...f._inkPressure}:null};}
 INK.PressureFlow={settings,options,active,decision,start,contact,cancel,step,beginContacts,shields,inspect};
})();
