/* Close-range decisions and throw evidence. Combat remains the authority for
 * throw eligibility, capture, protection, timing, damage and physical roots. */
'use strict';
(()=>{
 const settings={enabled:true},active=()=>settings.enabled&&INK.Kinetic?.settings.enabled;
 let serial=0,events=[];
 function noteIntent(f,m,G){if(!m?.throw||m.commandThrow||f.state==='captured')return false;f._inkThrowIntent={at:G.actionTick,move:m.id};return true;}
 function canPreTech(f,G){const q=f._inkThrowIntent,age=G.actionTick-(q?.at??-Infinity);return !!(q&&age>=0&&age<=8);}
 function consumeIntent(f){f._inkThrowIntent=null;}
 function outcome(f,result,G,{target=null,move=null,point=null,dir=f.dir}={}){
  if(!active()||!['whiff','grab','tech','impact'].includes(result))return null;
  const e=Object.freeze({id:++serial,at:G.actionTick,result,actor:f.index,target:target?.index??null,move:move?.id||move||null,dir:dir===-1?-1:1,point:Object.freeze(point?point.slice(0,2):[f.x,665+(f.y||0)-230])});
  f._inkClinchOutcome=e;events.push(e);if(events.length>64)events.shift();return e;
 }
 function tech(a,d,G,context={}){const e=outcome(a,'tech',G,{...context,target:d});if(e){d._inkClinchOutcome=e;for(const [body,dir] of [[a,-e.dir],[d,e.dir]]){body._inkThrowTech=Object.freeze({actorBirth:body._inkVisualClock||0,duration:8,dir});if(body._inkClinchAI){body._inkClinchAI.inside=false;body._inkClinchAI.used=false;body._inkClinchAI.nextChoice=G.actionTick+24;}}}consumeIntent(a);consumeIntent(d);return e;}
 function update(f,b,obs,G,api){
  if(!active()||!obs)return false;
  const q=f._inkClinchAI||(f._inkClinchAI={episode:0,inside:false,choice:null,used:false,nextChoice:0,lastTech:null}),dist=Math.abs(obs.x-f.x),hard=G.difficulty==='hard';
  // CPU shares actual legal throw intent with players. Observed capture alone
  // is too late at normal observation delays; no private free-tech plan.
  if(f.state==='captured'){
   const action=f.throwAction;
   if(f.captureKind==='throw'&&action&&!action.m.commandThrow&&action.t<=8&&canPreTech(f,G)&&q.lastTech!==action){q.lastTech=action;if(api.tech?.(f)){b.goal='投输入预判拆投';return true;}}
   return false;
  }
  if(dist>190||['down','rise','ko','throwing'].includes(f.state)){q.inside=false;q.choice=null;q.used=false;return false;}
  if(f.y!==0||obs.y!==0||f.airLock||f.attack||f.state!=='idle'||f.landT>0||f.jumpPre>0||f._inkPursuit)return false;
  // Only uncommitted neutral movement may yield to a close-range episode.
  if(G.actionTick<q.nextChoice)return false;
  if(b.plan&&G.actionTick<b.plan.until&&!['approach','retreat','guard','wait'].includes(b.plan.kind))return false;
  const recent=f._inkClinchOutcome,afterTech=recent?.result==='tech'&&G.actionTick-recent.at<90;
  if(!q.inside){
   q.inside=true;q.episode++;q.used=false;q.nextChoice=G.actionTick+24;
   const roll=INK.Random.combat.next(),throwChance=afterTech?.10:(obs.state==='idle'&&b.guards>8?.38:.25);
   q.choice=roll<throwChance?'throw':roll<(hard?.68:.80)?'strike':'retreat';
  }
  if(q.used)return false;q.used=true;q.inside=false;
  // An attempt finishes this episode, including a rejected request. The
  // cooldown survives leaving range; no retry probe on the same frame.
  const choice=q.choice;q.choice=null;
  if(choice==='throw'&&dist<=145&&!['hit','block','down','rise','tumble','captured'].includes(obs.state)){
   if(api.request(f,f.x<190||f.x>1250?'backthrow':'throw')){b.lastThrow=G.actionTick;b.goal='贴身破防 · 投';return true;}return false;
  }
  if(choice==='retreat'){
   api.plan(f,'retreat',hard?7:10,{goal:'后撤诱投 · 留出确反距离'});api.run(f,b);return true;
  }
  if(api.request(f,dist<150?'sLP':'sMP')){b.goal='贴身短打 · 试探防守';return true;}return false;
 }
 function reset(f){f._inkThrowIntent=null;f._inkThrowTech=null;f._inkClinchOutcome=null;f._inkClinchAI=null;}
 INK.Clinch={settings,active,noteIntent,canPreTech,consumeIntent,outcome,tech,update,reset,clear(){events=[];},inspect:()=>events.map(e=>({...e,point:[...e.point]}))};
})();
