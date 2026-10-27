/* Paid launch pursuit. All displacement belongs to actionable simulation ticks. */
'use strict';
(() => {
 const settings={enabled:true},rules=Object.freeze({window:8,cost:1.5,distance:260,juggle:2,windup:4,vy:-9.2,speed:4.8,travel:48,landing:12});
 const active=()=>settings.enabled&&INK.CombatFlow?.settings.rules==='flow';
 function recordLaunch(a,d,sourceAttack,G){
  if(!active()||a.y!==0||a.attack!==sourceAttack||sourceAttack?.m.id!=='cHP'||!sourceAttack.hitConfirmed||d.y>=0||d.state!=='tumble'||d.hp<=0)return false;
  a._inkLaunch={source:sourceAttack,target:d,at:G.actionTick,used:false};return true;
 }
 function decision(f,id,G){if(id!=='AIR_CHASE')return null;const q=f._inkLaunch,d=q?.target;
  const code=!active()?'disabled':G.phase!=='fight'||f.hp<=0?'phase':f.captured||f.y!==0?'ground':f._inkPursuit||q?.used?'used':!q||q.source!==f.attack||!q.source.hitConfirmed?'confirm':G.actionTick-q.at>8?'window':!d||d.hp<=0||d.y>=0||d.state!=='tumble'||d.captured?'target':d.juggle>2?'juggle':Math.abs(d.x-f.x)>260||(d.x-f.x)*f.dir<=0?'distance':G.hitstop>0?'hitstop':'ready';
  return {ok:code==='ready',code,wait:code==='hitstop',kind:'air-pursuit',cost:1.5,reason:code==='ready'?'付费追空':({disabled:'追空已关闭',phase:'当前不能追空',ground:'需要地面挑空确认',used:'本次追空已使用',confirm:'需要当前蹲重拳真实挑空',window:'追空窗口已结束',target:'目标已脱离挑空',juggle:'已达追空浮空限制',distance:'追空距离不足',hitstop:'等待解冻'})[code]};
 }
 function start(f,G,api){if(!decision(f,'AIR_CHASE',G).ok||!api.pay(f,1.5))return false;
  f._inkLaunch={...f._inkLaunch,used:true};
  // State change comes first: cancel() must not see the newly-created pursuit.
  api.state(f,'recovery',rules.windup+1);f._inkFlight=null;f.jumpPre=0;f._inkMotor=null;f.vx=0;f.push=0;f.invuln=0;f.throwInvuln=0;
  f._inkPursuit={phase:'windup',age:0,dir:f.dir,spent:true,started:G.actionTick,lastStep:G.actionTick,travel:0,attackUsed:false,owed:true};
  f.input.queue=[];api.notify?.(f,'追空 · −1.5 斗气');return true;
 }
 function allowMove(f,m,G){const q=f._inkPursuit;if(!q||['landing','interrupted'].includes(q.phase))return null;
  const ready=active()&&q.phase==='flight'&&q.age>=2&&!q.attackUsed&&!f.attack&&f.y<-8&&m.category==='normal'&&m.air&&!f.captured;
  const code=ready?(G.hitstop?'hitstop':'ready'):q.phase==='flight'&&q.age<2?'early':'pursuit';
  return {ok:code==='ready',code,wait:code==='hitstop'||code==='early',kind:'pursuit-air',cost:0,reason:code==='ready'?'一次空中追击':'追空只允许一次空中普通技'};
 }
 function prepare(f,m,d){if(d.kind!=='pursuit-air')return m;return {...m,damage:Math.round(m.damage*.8),hits:1,cancel:false,launch:0,pursuitAir:true};}
 function commit(f,d){if(d.kind==='pursuit-air'&&f._inkPursuit)f._inkPursuit={...f._inkPursuit,attackUsed:true};}
 function cancel(f,next){const q=f._inkPursuit;if(!q)return;
  if(['down','ko','captured','throwing'].includes(next)){f._inkPursuit=null;f.vx=0;return;}
  if(['hit','tumble','stun'].includes(next)){f._inkPursuit={...q,phase:'interrupted',age:0,owed:true};f.vx=0;}
 }
 function step(f,G,api){const old=f._inkPursuit;if(!old||G.hitstop>0||old.lastStep===G.actionTick)return;
  let q={...old,lastStep:G.actionTick,age:old.age+1};f._inkPursuit=q;
  if(!active()&&['windup','flight'].includes(q.phase)){q.phase='interrupted';f.vx=0;return;}
  if(q.phase==='landing'){if(f.state==='idle'&&!f.attack)f._inkPursuit=null;return;}
  if(q.phase==='interrupted'){if(f.y===0&&!f.captured&&!['hit','tumble','down','rise','ko','stun','throwing'].includes(f.state))land(f,G,api);return;}
  if(q.phase==='windup'){
   if(q.age<rules.windup){f.stateT=Math.max(f.stateT,rules.windup-q.age+1);return;}
   q={...q,phase:'flight',age:0};f._inkPursuit=q;api.state(f,'idle');const airSource=INK.AirBody?.capture(f);f.y=-1;f.vy=rules.vy;f.vx=0;f.airLock=false;f.crouch=false;f.jumpPre=0;INK.AirBody?.begin(f,airSource);api.dust?.(f.x);return;
  }
  if(q.phase==='flight'){
   f.vx=0;const amount=Math.min(rules.speed,rules.travel-q.travel);if(amount>0){f.x=Math.max(105,Math.min(1335,f.x+q.dir*amount));q.travel+=amount;}
  }
 }
 function land(f,G,api){const q=f._inkPursuit;if(!q?.owed||f.hp<=0)return false;
  // Knockdown/capture clears the pursuit through cancel; do not add wake-up debt.
  if(f.captured||['down','rise','hit','tumble','ko','stun','throwing'].includes(f.state))return false;
  f._inkPursuit={...q,phase:'landing',age:0,owed:false,lastStep:G.actionTick};f.vx=0;f.landT=f.landMax=Math.max(f.landT||0,12);api.state(f,'recovery',Math.max(f.stateT||0,12));return true;
 }
 const allowsContact=(f,d,m)=>!m.pursuitAir||d.juggle<3;
 function inspect(f,G){const q=f._inkLaunch;return {enabled:!!active(),rules,pursuit:f._inkPursuit?{...f._inkPursuit}:null,launch:q?{at:q.at,used:q.used,target:q.target?.index,source:q.source?.m.id}:null,gate:decision(f,'AIR_CHASE',G)};}
 INK.AirPursuit={settings,rules,active,recordLaunch,decision,start,allowMove,prepare,commit,step,land,cancel,allowsContact,inspect};
})();
