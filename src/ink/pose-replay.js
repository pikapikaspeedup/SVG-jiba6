/* FLOW 08 — evaluated-pose interchange and bounded real-simulation recording.
 * Records the solved source joint angles, NOT only authored wrist targets.
 * This is pose playback/diagnostics, not rollback netcode or input resimulation.
 * Imported data contains no executable code, SVG, URLs or DOM fragments.
 */
'use strict';
(() => {
 const clone=v=>JSON.parse(JSON.stringify(v)),parts=['rearArm','frontArm','rearLeg','frontLeg'];
 const finite=(v,a=-10000,b=10000)=>{if(!Number.isFinite(v)||v<a||v>b)throw TypeError('回放数值无效');return v;};
 const plain=o=>!!o&&typeof o==='object'&&!Array.isArray(o);
 function keys(o,allowed){if(!plain(o)||Object.keys(o).some(k=>!allowed.includes(k)))throw TypeError('回放字段无效');}
 function text(v,n=120){if(typeof v!=='string'||v.length>n)throw TypeError('回放文本无效');return v;}
 function numeric(o,maxKeys=60){if(!plain(o)||Object.keys(o).length>maxKeys)throw TypeError('回放通道无效');for(const[k,v]of Object.entries(o)){if(!/^[a-zA-Z][a-zA-Z0-9]*$/.test(k))throw TypeError('回放通道名无效');if(Array.isArray(v)){if(v.length>4||!v.length)throw TypeError('回放向量无效');v.forEach(x=>finite(x));}else finite(v);}return o;}
 const PoseFrame={version:1,
  capture(f){const R=INK.Runtime,p=SVG_FIGHTER.visualPose(f),rig=R.visualRig(f,p),ctx=INK.State.contextForFX(f);
   return{character:f.ch.id,x:f.x,y:f.y,dir:f.dir,scale:f.renderScale||f.ch.scale||1,state:f.state,clip:INK.Presentation.key(f),frame:ctx?.frame||0,pose:clone({...INK.basePose,...p}),angles:Object.fromEntries(parts.map(k=>[k,INK.Articulation.angles(rig.anatomy.source[k])])),secondary:Object.fromEntries(Object.entries(R.presentation(f,ctx?.record,ctx?.frame||0,f.attack?.t||0)).filter(([,v])=>typeof v==='number'||Array.isArray(v)).map(([k,v])=>[k,clone(v)])),expression:['hit','tumble','down','ko'].includes(f.state)?'hurt':f.attack&&f.attack.t>=f.attack.m.startup&&f.attack.t<f.attack.m.startup+f.attack.m.active?'power':'rest',hp:f.hp,drive:f.drive,super:f.super,combo:f.combo,damage:f.comboDamage};
  },
  restore(frame,profile){const p=clone(frame.pose);INK.Articulation.attachSnapshot(p,frame.angles);return{pose:p,rig:INK.Anatomy.solve(profile,p,{force:true})};},
  interpolate(a,b,u){if(u<=0||a.dir!==b.dir||a.character!==b.character)return clone(a);if(u>=1)return clone(b);const out=clone(a);out.pose=INK.blend(a.pose,b.pose,u);for(const k of ['x','y','scale','frame'])out[k]=INK.lerp(a[k],b[k],u);for(const name of parts)out.angles[name]=a.angles[name].map((v,i)=>v+((((b.angles[name][i]-v+180)%360)+360)%360-180)*u);out.secondary=INK.blend(a.secondary,b.secondary,u);return out;},
  validate(f){keys(f,['character','x','y','dir','scale','state','clip','frame','pose','angles','secondary','expression','hp','drive','super','combo','damage']);if(!INK.Schema.CHARACTERS.includes(f.character))throw TypeError('未知回放角色');finite(f.x,-100,1540);finite(f.y,-1800,200);if(![-1,1].includes(f.dir))throw TypeError('回放朝向无效');finite(f.scale,.2,3);text(f.state,40);text(f.clip,140);finite(f.frame,0,100000);numeric(f.pose);for(const k of Object.keys(INK.basePose))if(!Object.hasOwn(f.pose,k))throw TypeError('缺少必需姿态通道：'+k);for(const k of ['rw','fw','ra','fa'])if(!Array.isArray(f.pose[k])||f.pose[k].length!==2)throw TypeError('缺少回放肢体坐标');finite(f.pose.depth??1,.05,3);keys(f.angles,parts);for(const k of parts){if(!Array.isArray(f.angles[k])||f.angles[k].length!==2)throw TypeError('缺少已解算关节角');f.angles[k].forEach(v=>finite(v,-100000,100000));}numeric(f.secondary,20);if(!['rest','power','hurt'].includes(f.expression))throw TypeError('回放表情无效');finite(f.hp,0,10000);finite(f.drive,0,6.001);finite(f.super,0,3.001);finite(f.combo,0,1000);finite(f.damage,0,100000);return f;}
 };
 const Replay={version:1,capacity:600,recording:false,frames:[],events:[],characters:{},title:'实战姿态记录',startTick:0,totalCaptured:0,
  begin(title='实战姿态记录'){text(title);if(!INK.Game.enabled||!INK.Anatomy.settings.enabled)throw Error('录制需要启用连续骨架引擎');if(SVG_FIGHTER.fighters.length!==2)throw Error('请先进入训练对战');this.title=title;this.frames=[];this.events=[];this.characters={};this.totalCaptured=0;this.startTick=SVG_FIGHTER.state.tick;
   for(const f of SVG_FIGHTER.fighters)this.characters[f.ch.id]={model:clone(INK.Runtime.store.getModel(f.ch.id)),rig:clone(INK.Runtime.store.getRig(f.ch.id))};this.recording=true;this.capture(SVG_FIGHTER.state,SVG_FIGHTER.fighters);return true;
  },
  capture(G,fighters){if(!this.recording||fighters.length!==2)return;const old=this.frames.at(-1),tick=G.tick-this.startTick;if(old?.tick===tick)return;if(old&&tick<old.tick){this.recording=false;return;}
   if(fighters.some(f=>!this.characters[f.ch.id])){this.recording=false;return;}
   const frame={tick,action:G.actionTick||0,frozen:!!G.hitstop||!!G._inkStepFrozen,actors:fighters.map(PoseFrame.capture)};this.frames.push(frame);this.totalCaptured++;
   if(old)fighters.forEach((f,i)=>{const a=old.actors[i],b=frame.actors[i];if(a.clip!==b.clip)this.events.push({tick,actor:i,type:'state',label:a.clip+' → '+b.clip});if(a.y<0&&b.y>=0)this.events.push({tick,actor:i,type:'land',label:'落地'});if(a.dir!==b.dir)this.events.push({tick,actor:i,type:'facing',label:'规则换向'});});
   for(const e of G.combatEvents||[])if(e.tick===G.tick)this.events.push({tick,actor:e.defender,type:'contact',label:e.type+' · '+e.move+' · '+e.damage});
   if(this.frames.length>this.capacity)this.frames.shift();const start=this.frames[0].tick;this.events=this.events.filter(e=>e.tick>=start).slice(-240);
  },
  stop(){this.recording=false;return this.frames.length;},
  export(){if(!this.frames.length)throw Error('还没有录制的姿态');return{version:1,kind:'ink-pose-replay',hz:60,title:this.title,engine:INK.VERSION,characters:clone(this.characters),frames:clone(this.frames),events:clone(this.events)};},
  validate(data){INK.Schema.safeData(data);keys(data,['version','kind','hz','title','engine','characters','frames','events']);if(data.version!==1||data.kind!=='ink-pose-replay'||data.hz!==60)throw TypeError('不支持的姿态回放格式');text(data.title);text(data.engine,100);if(!plain(data.characters)||Object.keys(data.characters).length<1||Object.keys(data.characters).length>2)throw TypeError('回放包含 1–2 种角色');
   for(const[id,c]of Object.entries(data.characters)){keys(c,['model','rig']);INK.Schema.model(c.model);INK.Schema.rig(c.rig);if(c.model.character!==id||c.rig.character!==id)throw TypeError('回放角色绑定不一致');}
   if(!Array.isArray(data.frames)||!data.frames.length||data.frames.length>600)throw TypeError('回放最多 600 帧');let tick=-1;
   for(const f of data.frames){keys(f,['tick','action','frozen','actors']);finite(f.tick,0,100000000);if(!Number.isInteger(f.tick)||f.tick<=tick)throw TypeError('回放时间必须递增');tick=f.tick;finite(f.action,0,1e9);if(typeof f.frozen!=='boolean'||!Array.isArray(f.actors)||f.actors.length!==2)throw TypeError('回放帧无效');for(const [i,a]of f.actors.entries()){PoseFrame.validate(a);if(a.character!==data.frames[0].actors[i]?.character)throw TypeError('同一角色槽位不能中途换人');if(!data.characters[a.character])throw TypeError('缺少回放角色资产');}}
   if(!Array.isArray(data.events)||data.events.length>240)throw TypeError('回放事件过多');for(const e of data.events){keys(e,['tick','actor','type','label']);finite(e.tick,data.frames[0].tick,tick);if(!Number.isInteger(e.tick)||![0,1].includes(e.actor)||!['state','land','facing','contact'].includes(e.type))throw TypeError('回放事件无效');text(e.label,300);}return clone(data);
  },
  parse(source){if(typeof source!=='string'||new TextEncoder().encode(source).length>8000000)throw TypeError('姿态回放不超过 8 MB');return this.validate(JSON.parse(source));},
  load(data){const v=this.validate(data);this.recording=false;this.title=v.title;this.characters=v.characters;this.frames=v.frames;this.events=v.events;return this.frames.length;},
  profile(id){const c=this.characters[id];if(!c)throw Error('缺少回放角色');const a=c.model,b=c.rig;return{...INK.assets.byID[id],...a,id,rigLengths:b.lengths.slice(),rigRearShoulder:b.rearShoulder.slice(),rigFrontShoulder:b.frontShoulder.slice(),rigHipWidth:b.hipWidth,rigHeadOffset:b.headOffset,previewStyle:{...a.style}};},
  sample(index){if(!Number.isFinite(index)||!this.frames.length)throw Error('无有效回放帧');const at=INK.clamp(index,0,this.frames.length-1),i=Math.floor(at),a=this.frames[i],b=this.frames[Math.min(i+1,this.frames.length-1)],u=at-i;return{...a,actors:a.actors.map((p,j)=>PoseFrame.interpolate(p,b.actors[j],u))};},
  clear(){this.stop();this.frames=[];this.events=[];this.characters={};}
 };
 INK.PoseFrame=PoseFrame;INK.Replay=Replay;
})();
