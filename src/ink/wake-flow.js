/* Wake choices are simulation permissions; rendering only samples their pose. */
'use strict';
(() => {
 const settings={enabled:true};
 const rules=Object.freeze({delay:18,strikeCost:1.5,window:4,startup:8,active:3,recovery:26,damage:600,travel:18});
 const active=()=>settings.enabled&&INK.CombatFlow?.settings.rules==='flow';
 function state(f,next,G){
  if(next==='down'&&f.state!=='down')f._inkWake={cycle:(f._inkWake?.cycle||0)+1,entered:G.actionTick,delayed:false,struck:false,paid:0};
 }
 function decision(f,id,G){
  if(!['WAKE_DELAY','WAKE_STRIKE'].includes(id))return null;
  const strike=id==='WAKE_STRIKE',q=f._inkWake;
  let code=!active()?'disabled':G.phase!=='fight'||f.hp<=0?'phase':f.captured||f.y!==0?'ground':
   strike?(f.state!=='rise'?'rise':q?.struck?'used':f.stateT>rules.window?'early':f.stateT<=0?'window':'ready'):
   f.state!=='down'?'down':q?.delayed||f._inkRecovery?'used':f.stateT<=2?'window':'ready';
  if(code==='ready'&&G.hitstop>0)code='hitstop';
  return {ok:code==='ready',code,wait:code==='early'||code==='hitstop',kind:strike?'wake-strike':'wake-delay',cost:strike?rules.strikeCost:0,
   reason:({ready:strike?'起身迎击':'延迟起身',disabled:'起身选择已关闭',phase:'当前不能行动',ground:'需要地面起身',rise:'需要起身末段',down:'需要倒地状态',used:'本次倒地已选择',early:'等待起身最后四帧',window:'起身选择窗口已结束',hitstop:'等待命中定格结束'})[code]};
 }
 // Delay has no payment. Strike payment and attack construction stay atomic in requestMove.
 function start(f,id,G){const d=decision(f,id,G);if(!d?.ok||d.kind!=='wake-delay')return false;
  f._inkWake={...(f._inkWake||{cycle:1,entered:G.actionTick,struck:false,paid:0}),delayed:true,delayedAt:G.actionTick};f.stateT+=rules.delay;return true;}
 function prepare(f,m,d){if(d.kind!=='wake-strike')return m;
  return {...m,category:'system',kind:'punch',pose:'punch',startup:8,active:3,recovery:26,total:37,damage:600,hits:1,height:'mid',level:2,stun:22,blockstun:10,knock:16,travel:18/8,cancel:false,invuln:0,armor:1,throw:false,knockdown:true,launch:0,air:false,wakeStrike:true};}
 function commit(f,d,G){if(d.kind!=='wake-strike')return;
  f._inkWake={...(f._inkWake||{cycle:1,entered:G.actionTick,delayed:false}),struck:true,started:G.actionTick,paid:(f._inkWake?.paid||0)+rules.strikeCost};
  f.invuln=0;f.throwInvuln=0;f._inkRecovery=null;f.push=0;f.vx=0;
 }
 function step(f,G){if(!G.hitstop&&f.attack?.m.wakeStrike&&f.attack.t>=6)f.attack.armor=0;const q=f._inkWake;if(!q||q.lastStep===G.actionTick||G.hitstop>0)return;
  f._inkWake={...q,lastStep:G.actionTick,phase:f.state==='down'?'down':f.state==='rise'?'rise':f.attack?.m.wakeStrike?'strike':'resolved'};
 }
 function pose(f,source){if(!active()||!f._inkWake?.delayed||f.state!=='down')return source;
  const p=INK.copy(source);p.chest=(p.chest||0)-2;p.head=(p.head||0)+2;return INK.Articulation.inherit(source,p);}
 function inspect(f,G){return {enabled:!!active(),rules,wake:f._inkWake?{...f._inkWake}:null,delay:decision(f,'WAKE_DELAY',G),strike:decision(f,'WAKE_STRIKE',G)};}
 INK.WakeFlow={settings,rules,active,decision,start,prepare,commit,state,step,pose,inspect};
})();
