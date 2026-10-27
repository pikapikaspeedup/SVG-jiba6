/* FLOW Combo Lab: a controller over the real combat simulation, not a damage
 * sequencer. Only requestMove(…, false) is used. No hp/hitstun/meter changes
 * after initial reset. Post-first-hit guard exposes gaps in authored routes. */
'use strict';
(() => {
 const copy=o=>JSON.parse(JSON.stringify(o));
 const Lab={route:null,status:'idle',mode:'demo',cursor:0,clock:0,hits:0,damage:0,maxCombo:0,log:[],actions:[],reason:'',lastStart:0,startTick:0,guard:true,speed:1,attempts:0,successes:0,backup:null,manualDelay:0,
  get A(){return globalThis.SVG_FIGHTER;},
  validate(route){
   const fail=message=>{throw new TypeError('无效连段：'+message);};
   if(!route||!INK.Schema.CHARACTERS.includes(route.character))fail('角色');
   if(typeof route.id!=='string'||!/^[a-z0-9_-]{1,80}$/.test(route.id))fail('路线 ID');
   for(const [key,max] of [['title',100],['note',1000],['tier',100]])if(route[key]!==undefined&&(typeof route[key]!=='string'||route[key].length>max))fail(key+' 无效');
   if(route.rulesPreset!==undefined&&!['flow','legacy'].includes(route.rulesPreset))fail('规则模式');if(route.opponent!==undefined&&!INK.Schema.CHARACTERS.includes(route.opponent))fail('对手');if(route.corner!==undefined&&typeof route.corner!=='boolean')fail('角落布尔值');
   if(!Array.isArray(route.steps)||route.steps.length<1||route.steps.length>48)fail('步骤数量 1–48');
   const ids=new Set(this.A.moves[route.character].map(m=>m.id));
   for(const st of route.steps){if(!st||!ids.has(st.move))fail('未知招式 '+st?.move);for(const [key,max]of [['minHits',30],['minFrames',120],['delay',300]])if(st[key]!==undefined&&(!Number.isInteger(st[key])||st[key]<0||st[key]>max))fail(key+' 越界');}
   for(const[key,max]of [['drive',6],['super',3]]){const value=route.meter?.[key];if(value!==undefined&&(!Number.isFinite(value)||value<0||value>max))fail(key+' 资源越界');}
   for(const key of ['expectedHits','minTotal'])if(route[key]!==undefined&&(!Number.isInteger(route[key])||route[key]<1||route[key]>200))fail(key+' 越界');
   if(route.distance!==undefined&&(!Number.isFinite(route.distance)||route.distance<60||route.distance>700))fail('起手距离');
   if(route.midOffset!==undefined&&(!Number.isFinite(route.midOffset)||route.midOffset<0||route.midOffset>200))fail('中场起手位置');
   INK.Schema.safeData(route);return copy(route);
  },
  configure(library){
   if(library?.version!==1||library.kind!=='ink-combo-library'||!Array.isArray(library.routes)||!library.routes.length||library.routes.length>256)throw TypeError('无效连段库');
   const ids=new Set(),routes=library.routes.map(r=>{const data=this.validate(r);if(ids.has(data.id))throw TypeError('重复连段 ID');ids.add(data.id);return data;});
   this.routes={version:1,kind:'ink-combo-library',routes};
  },
  start(route,mode='demo',options={}){
   route=this.validate(route);
   const A=this.A;this.stop(false);this.route=copy(route);this.mode=mode;this.status='starting';
   const names=['dummy','infinite','autohp'];this.backup=Object.fromEntries(names.map(id=>{const n=document.getElementById(id);return[id,n.type==='checkbox'?n.checked:n.value];}));
   A.start(route.character,route.opponent||'ryu','training',options.control==='classic'?'classic':'assist');
   if(A.experience?.exitLessons)A.experience.exitLessons();
   document.getElementById('dummy').value='idle';document.getElementById('infinite').checked=false;document.getElementById('autohp').checked=false;
   const [f,d]=A.fighters,side=options.side===-1?-1:1,corner=route.corner!==false;const edge=side===1?1335:105;
   const mid=720+side*(route.midOffset||0);
   f.x=f.px=corner?edge-side*(route.distance||168):mid-side*(route.distance||168)/2;d.x=d.px=corner?edge:mid+side*(route.distance||168)/2;
   f.dir=side;d.dir=-side;f.super=route.meter?.super??3;f.drive=route.meter?.drive??6;
   this.initial={x:f.x,targetX:d.x,super:f.super,drive:f.drive};this.final=null;this.endedTick=null;this.endedAction=null;this.control=options.control||'assist';this.cursor=0;this.clock=0;this.hits=0;this.damage=0;this.maxCombo=0;this.actions=[];this.log=[];this.trace=[];this.reason='';this.lastStart=0;this.lastContact=0;this.startTick=A.state.tick;this.startAction=A.state.actionTick||0;this.startTempo={...INK.CombatFlow.settings};this.waitTicks=0;this.guard=options.guard!==false;this.manualDelay=options.delay||0;
   this.pending=null;this.inputLog=[];this.bufferFrames=options.bufferFrames??6;this.window={ready:false};this.status='running';this.attempts++;A.state.phase='fight';A.state.paused=!!options.paused;A.state.artSpeed=this.speed;
   A.focusCamera?.();A.render();return this.summary();
  },
  stop(restore=true){this.pending=null;if(this.backup){for(const[id,value]of Object.entries(this.backup)){const n=document.getElementById(id);if(n){if(n.type==='checkbox')n.checked=value;else n.value=value;}}}this.backup=null;this.status='idle';if(restore&&this.A)this.A.state.artSpeed=1;},
  fail(reason){if(this.status!=='running')return;this.pending=null;this.status='failed';this.reason=reason;this.endedAt=this.clock;this.endedTick=this.A.state.tick;this.endedAction=this.A.state.actionTick;this.final={drive:this.A.fighters[0].drive,super:this.A.fighters[0].super};},
  finish(){if(this.status!=='running')return;this.pending=null;this.status='success';this.successes++;this.reason='连续命中成立 · 无无限资源、无脚本伤害';this.endedAt=this.clock;this.endedTick=this.A.state.tick;this.endedAction=this.A.state.actionTick;this.final={drive:this.A.fighters[0].drive,super:this.A.fighters[0].super};},
  onMove(f,m,G){if(this.status!=='running'||f.index!==0)return;const want=this.route.steps[this.cursor];if(!want||m.id!==want.move){this.fail('错误招式：'+m.name+'；当前需要 '+(want?.move||'等待收招'));return;}
   if(this.cursor>0){const prev=this.actions.at(-1),req=this.route.steps[this.cursor-1];if(req.move!=='RUSH'&&prev.hits<(req.minHits||1)){this.fail('过早取消：上一招尚未完成要求的命中');return;}}
   this.pending=null;this.actions.push({move:m.id,name:m.name||m.id,tick:G.tick,frame:this.clock,hits:0,damage:0,needed:want.minHits||1,command:want.command||m.command||'',cost:{drive:f.drive,super:f.super}});this.log.push({type:'action',frame:this.clock,move:m.id,name:m.name||m.id});this.cursor++;this.lastStart=this.clock;this.waitTicks=0;this.window={ready:false};
  },
  onCombat(e,a,d,m){if(this.status!=='running'||a.index!==0)return;this.log.push({type:e.type,frame:this.clock,tick:e.tick,move:e.move,damage:e.damage,combo:a.combo});if(this.log.length>300)this.log.shift();
   if(e.type==='block'||e.type==='parry'){this.fail('断连：木桩恢复后成功'+(e.type==='block'?'防御':'招架'));return;}
   if(e.type!=='hit')return;
   if(this.hits>0&&a.combo<=this.maxCombo){this.fail('断连：引擎的连续命中计数已重置');return;}
   this.hits++;this.maxCombo=a.combo;this.damage+=e.damage;this.lastContact=this.clock;
   const act=[...this.actions].reverse().find(v=>v.move===m.id);if(act){act.hits++;act.damage+=e.damage;}
   if(this.guard)document.getElementById('dummy').value='guard';
   const last=this.route.steps.at(-1);if(this.cursor===this.route.steps.length&&this.actions.at(-1)?.hits>=(last.minHits||m.hits||1)&&this.hits>=(this.route.minTotal||1))this.finish();
  },
  updateWindow(G,fighters){
   const step=this.route?.steps[this.cursor],f=fighters[0],d=fighters[1];if(!step||!f){this.window={ready:false};return this.window;}
   const prev=this.actions.at(-1),prevStep=this.route.steps[this.cursor-1];let ready=!prev||(prevStep.move==='RUSH'?this.clock-this.lastStart>=(prevStep.minFrames||5):prev.hits>=(prevStep.minHits||1));
   if(step.delay&&this.clock-this.lastStart<step.delay)ready=false;
   const targetMove=this.A.moves[f.ch.id].find(m=>m.id===step.move),free=['idle','rush','dash','stance'].includes(f.state)&&!f.attack;
   const decision=this.A.decide(0,step.move),legal=decision.ok;
   // Confirmation can be recorded during hitstop, but execution waits for an actionable step.
   return this.window={ready:!!(ready&&legal&&!G.hitstop),frozen:G.hitstop>0,confirmed:ready,link:targetMove?.category==='normal'&&f.attack?.m.category==='normal',move:step.move,attackFrame:f.attack?.t||0,remaining:Math.max(0,20-INK.CombatFlow.age(G,f.attack)),reason:decision.reason,kind:decision.kind,targetRecovery:d.stateT};
  },
  logInput(event){this.inputLog.push(event);if(this.inputLog.length>200)this.inputLog.splice(0,this.inputLog.length-200);},
  requestStep(bufferFrames=this.bufferFrames??6){
   if(this.status!=='running'||this.mode!=='practice'||this.A.state.paused)return {status:'inactive'};
   if(![0,3,6].includes(bufferFrames))throw RangeError('Practice buffer must be 0, 3 or 6 frames');
   const step=this.route.steps[this.cursor];if(!step)return {status:'complete'};
   this.updateWindow(this.A.state,this.A.fighters);const request={cursor:this.cursor,move:step.move,frame:this.clock,expires:this.clock+bufferFrames};
   if(this.window.ready&&this.A.tryMove(0,step.move)){this.logInput({...request,status:'accepted',delay:0});return{status:'accepted'};}
   if(bufferFrames===0){this.logInput({...request,status:'early'});return{status:'early'};}
   this.pending=request;this.logInput({...request,status:'buffered'});if(this.inputLog.length>200)this.inputLog.shift();return{status:'buffered',remaining:bufferFrames};
  },
  beforeStep(G,fighters){if(this.status!=='running'||G.mode!=='training'||G.phase!=='fight')return;this.clock++;const [f,d]=fighters;
   if(f.ch.id!==this.route.character){this.fail('已切换角色');return;}if(f.drive<-.001||f.super<-.001){this.fail('资源错误');return;}
   if(this.hits>0&&!['hit','tumble','captured','down','rise'].includes(d.state)&&!d.captured&&this.clock-this.lastContact>1){this.fail('断连：木桩已经恢复行动');return;}
   const step=this.route.steps[this.cursor];if(!step){if(this.clock-this.lastStart>200)this.fail('终结技未完成全部命中');return;}
   if(this.cursor>0&&this.clock>1200){this.fail('等待出招超时');return;}
   const prev=this.actions.at(-1),prevStep=this.route.steps[this.cursor-1];
   let ready=!prev||(prevStep.move==='RUSH'?this.clock-this.lastStart>=(prevStep.minFrames||5):prev.hits>=(prevStep.minHits||1));
   if(ready&&step.delay&&this.clock-this.lastStart<step.delay)ready=false;
   if(ready&&this.manualDelay&&this.cursor>0&&this.clock-this.lastContact<this.manualDelay)ready=false;
   const targetMove=this.A.moves[f.ch.id].find(m=>m.id===step.move);const free=['idle','rush','dash','stance'].includes(f.state)&&!f.attack;const decision=this.A.decide(0,step.move),legal=decision.ok;this.window={ready:ready&&legal,link:targetMove?.category==='normal'&&f.attack?.m.category==='normal',move:step.move,attackFrame:f.attack?.t||0,remaining:Math.max(0,20-INK.CombatFlow.age(G,f.attack)),reason:decision.reason,kind:decision.kind,targetRecovery:d.stateT};
   if(this.mode==='practice'&&this.pending){
    const q=this.pending;
    if(q.cursor!==this.cursor||q.move!==step.move)this.pending=null;
    else if(this.clock>q.expires){this.logInput({...q,status:'expired'});this.pending=null;}
    else if(ready&&legal&&this.A.tryMove(0,q.move)){this.logInput({...q,status:'accepted',delay:this.clock-q.frame});this.pending=null;}
   }
   if(this.mode==='demo'&&ready){if(!decision.ok&&!decision.wait){this.fail('无法发动 '+step.move+'：'+decision.reason);return;}this.A.tryMove(0,step.move);}
   if(this.mode==='demo'&&this.clock-this.lastStart>210)this.fail('无法衔接 '+step.move+'：距离、取消条件或资源不成立');
  },
  afterStep(G,fs){if(!this.route||!['running','success'].includes(this.status)||!this.trace)return;const phase=f=>f.state==='attack'?(f.attack.t<f.attack.m.startup?'startup':f.attack.t<f.attack.m.startup+f.attack.m.active?'active':'recovery'):f.state;if(this.status==='running')this.updateWindow(G,fs);if(this.trace.at(-1)?.frame===this.clock)return;this.trace.push({frame:this.clock,tick:G.tick,p:phase(fs[0]),d:phase(fs[1])});if(this.trace.length>360)this.trace.shift();},
  setSpeed(n){if(![.25,.5,1].includes(n))return;this.speed=n;if(this.A)this.A.state.artSpeed=n;},
  summary(){return{status:this.status,character:this.route?.character,route:this.route?.id,mode:this.mode,cursor:this.cursor,frames:this.clock,hits:this.hits,damage:this.damage,maxCombo:this.maxCombo,reason:this.reason,initial:this.initial,remaining:this.final|| (this.A?.fighters?.[0]?{drive:this.A.fighters[0].drive,super:this.A.fighters[0].super}:null),elapsedTicks:(this.endedTick??this.A?.state.tick??0)-this.startTick,actionFrames:(this.endedAction??this.A?.state.actionTick??0)-(this.startAction||0),tempo:{...this.startTempo},actions:copy(this.actions),log:copy(this.log),inputLog:copy(this.inputLog||[]),bufferFrames:this.bufferFrames??6};}
 };
 INK.Combo=Lab;
})();
