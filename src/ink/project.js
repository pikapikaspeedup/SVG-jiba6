/* INK FLOW / character asset repository.
 * Pure JSON assets, transactional validation, independent model/rig/motion files.
 * No eval, dynamic JS imports, arbitrary SVG markup or network fetches.
 */
'use strict';
(() => {
 const clone=o=>JSON.parse(JSON.stringify(o));
 const CHARACTERS=['ryu','ken','chun','cammy','luke','juri','mai','iori'];
 const SOCKETS=['fanGrip','fanTip','root','head','chest','pelvis','frontHand','rearHand','frontElbow','rearElbow','frontFoot','rearFoot','frontKnee','rearKnee'];
 const FX_TYPES=['streak','wave','flame','silk','spiral','shock','crescent','claw','pillar','ring','impact','fan'];
 const safeKey=/^[a-zA-Z0-9_-]{1,90}$/;
 function assert(test,message){if(!test)throw new Error(message);}
 function plain(o){return !!o&&typeof o==='object'&&!Array.isArray(o);}
 function bounds(n,a,b,label){assert(Number.isFinite(n)&&n>=a&&n<=b,label+' 超出范围 '+a+'…'+b);return n;}
 function integer(n,a,b,label){bounds(n,a,b,label);assert(Number.isInteger(n),label+' 必须是整数');return n;}
 function vec(v,size,a,b,label){assert(Array.isArray(v)&&v.length===size,label+' 维度不正确');v.forEach(n=>bounds(n,a,b,label));return v;}
 function text(s,max,label){assert(typeof s==='string'&&s.length<=max,label+' 不是有效文本');return s;}
 function safeData(data){let nodes=0;function visit(v,depth){assert(++nodes<4000000&&depth<22,'文件结构过大或嵌套过深');if(Array.isArray(v)){assert(v.length<20000,'数组过大');v.forEach(x=>visit(x,depth+1));}else if(plain(v)){for(const[k,x]of Object.entries(v)){assert(!['__proto__','prototype','constructor'].includes(k),'文件包含不安全字段');visit(x,depth+1);}}else if(typeof v==='number')assert(Number.isFinite(v),'文件包含非有限数值');else if(typeof v==='string')assert(v.length<=30000,'字符串过长');else assert(v==null||typeof v==='boolean','只允许 JSON 数据');}visit(data,0);return data;}
 function character(data){assert(CHARACTERS.includes(data.character),'未知角色');}
 function model(data){safeData(data);assert(plain(data)&&data.version===2&&data.kind==='ink-model','模型文件版本错误');character(data);vec(data.arm,3,2,60,'手臂轮廓');vec(data.leg,3,2,70,'腿部轮廓');bounds(data.headScale,.5,1.2,'头部比例');bounds(data.style?.volume,.75,1.3,'肢体体积');bounds(data.style?.head,.8,1.25,'头部样式');if(data.shape)for(const k of ['chest','waist','hip'])bounds(data.shape[k],.75,1.25,'躯干形体 '+k);assert(/^#[0-9a-fA-F]{6}$/.test(data.accent),'强调色必须为六位色值');text(data.name,50,'角色名');text(data.cn,30,'中文名');return clone(data);}
 function rig(data){safeData(data);assert(plain(data)&&data.version===2&&data.kind==='ink-rig','骨架文件版本错误');character(data);vec(data.lengths,4,30,180,'骨长');vec(data.rearShoulder,2,-450,160,'后肩挂点');vec(data.frontShoulder,2,-450,160,'前肩挂点');bounds(data.hipWidth,32,85,'骨盆宽度');vec(data.headOffset,2,-100,100,'头部挂点');return clone(data);}
 function move(data){safeData(data);assert(plain(data)&&data.version===2&&data.kind==='ink-move','招式文件版本错误');character(data);assert(safeKey.test(data.key),'招式文件名无效');assert(typeof data.gameId==='string'&&/^[@a-zA-Z0-9_-]+$/.test(data.gameId),'游戏招式 ID 无效');text(data.name,100,'招式名');text(data.command||'',100,'指令');
  INK.CombatFlow?.validateTransitions(data.transitions,data);
  const b=data.binding;assert(plain(b)&&b.rootPolicy==='combat','根位移必须由战斗模拟负责');integer(b.startup,1,180,'预备帧');integer(b.active,1,300,'有效帧');integer(b.recovery,1,300,'收招帧');const total=b.startup+b.active+b.recovery;assert(total<=700,'动作过长');
  INK.validateClip(data.clip);assert(data.clip.duration===total,'动画时长必须等于战斗时长');assert(data.clip.character===data.character&&data.clip.id===data.character+':'+data.key,'动画所属角色或 ID 不一致');
  const expectedPhases={startup:[0,b.startup],active:[b.startup,b.startup+b.active],recovery:[b.startup+b.active,total]};assert(Object.entries(expectedPhases).every(([name,values])=>values.every((v,i)=>data.clip.phases?.[name]?.[i]===v)),'动画阶段与战斗阶段不一致');
  assert(plain(data.boxes)&&['inherit','custom'].includes(data.boxes.mode),'判定配置无效');assert(Array.isArray(data.boxes.items)&&data.boxes.items.length<=32,'判定框最多 32 个');
  if(data.gameId.startsWith('@'))assert(data.boxes.mode==='inherit'&&data.boxes.items.length===0,'状态动作没有独立攻击判定；由战斗状态或双人投技约束负责');
  const names=new Set();for(const box of data.boxes.items){assert(safeKey.test(box.id)&&!names.has(box.id),'判定框 ID 重复或无效');names.add(box.id);assert(['hit','hurt'].includes(box.kind),'仅支持攻击框和受击框');assert(SOCKETS.includes(box.socket),'未知判定挂点');integer(box.start,0,total-1,'判定开始');integer(box.end,box.start+1,total,'判定结束');if(box.kind==='hit'){assert(box.start>=b.startup&&box.end<=b.startup+b.active,'攻击框必须位于有效阶段内');}bounds(box.x,-600,600,'判定 x');bounds(box.y,-600,600,'判定 y');bounds(box.w,2,500,'判定宽');bounds(box.h,2,500,'判定高');}
  assert(Array.isArray(data.fx)&&data.fx.length<=32,'特效事件最多 32 个');names.clear();for(const e of data.fx){assert(safeKey.test(e.id)&&!names.has(e.id),'特效 ID 重复或无效');names.add(e.id);integer(e.frame,0,total-1,'事件帧');integer(e.duration,1,120,'特效时长');assert(FX_TYPES.includes(e.type)&&SOCKETS.includes(e.socket),'特效或挂点无效');bounds(e.scale,.15,3,'特效比例');bounds(e.rotation,-720,720,'特效角度');bounds(e.opacity,0,1,'特效透明度');assert(/^#[0-9a-fA-F]{6}$/.test(e.color),'特效颜色无效');if(e.trailFrames!==undefined)integer(e.trailFrames,2,24,'轨迹记忆帧');if(e.width!==undefined)bounds(e.width,.3,60,'轨迹宽度');if(e.layer!==undefined)assert(['front','back'].includes(e.layer),'轨迹层级无效');if(e.particles){const p=e.particles;assert(plain(p),'粒子配置无效');if(p.count!==undefined)integer(p.count,0,100,'粒子数量');if(p.life!==undefined)integer(p.life,2,90,'粒子寿命');if(p.speed!==undefined)bounds(p.speed,0,20,'粒子速度');if(p.size!==undefined)bounds(p.size,.2,12,'粒子大小');if(p.spread!==undefined)bounds(p.spread,0,360,'发射角度');if(p.gravity!==undefined)bounds(p.gravity,-.6,.8,'粒子重力');if(p.drag!==undefined)bounds(p.drag,0,.4,'粒子阻力');if(p.curl!==undefined)bounds(p.curl,0,16,'粒子卷动');if(p.species!==undefined)assert(['spark','ember','smoke','shard','fleck','petal'].includes(p.species),'粒子材质无效');if(p.spacing!==undefined)bounds(p.spacing,2,160,'距离发射间距');if(p.rate!==undefined)bounds(p.rate,0,10,'每帧发射率');if(p.burst!==undefined)integer(p.burst,0,32,'初始发射数');if(p.inheritVelocity!==undefined)bounds(p.inheritVelocity,0,1,'继承速度');if(p.heat!==undefined)assert(typeof p.heat==='boolean','热量渐变开关无效');for(const key of ['sizeCurve','opacityCurve'])if(p[key]!==undefined){const c=p[key];assert(Array.isArray(c)&&c.length>=2&&c.length<=8,'寿命曲线需 2–8 个点');let previous=-1;for(const pair of c){assert(Array.isArray(pair)&&pair.length===2,'寿命曲线点无效');bounds(pair[0],0,1,'寿命位置');bounds(pair[1],0,key==='sizeCurve'?3:1,'曲线值');assert(pair[0]>previous,'寿命曲线必须递增');previous=pair[0];}assert(c[0][0]===0&&c.at(-1)[0]===1,'寿命曲线必须覆盖 0–1');}}}
  // The retained runtime pool has 12 slots: reject overflow rather than silently
  // dropping an authored effect. End events precede starts on the same frame.
  const edges=data.fx.flatMap(e=>[[e.frame,1],[e.frame+e.duration,-1]]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);let concurrent=0;for(const [,delta]of edges){concurrent+=delta;assert(concurrent<=12,'同一帧最多显示 12 个特效；请错开事件或缩短持续帧');}
  return clone(data);
 }
 function keyOf(record){return record.character+':'+record.key;}
 function validateBundle(bundle){
  assert(bundle?.manifest?.version===2&&Array.isArray(bundle.manifest.characters),'资产清单无效');
  const listed=bundle.manifest.characters.map(c=>c.id);assert(listed.length===8&&new Set(listed).size===8&&listed.every(id=>CHARACTERS.includes(id)),'资产清单必须包含八个独立角色');
  for(const id of CHARACTERS){const c=bundle.characters?.[id];assert(c&&c.model?.character===id&&c.rig?.character===id,'角色资产缺失或目录身份不匹配：'+id);model(c.model);rig(c.rig);
   const declared=bundle.manifest.characters.find(c=>c.id===id).moves;assert(Array.isArray(declared)&&declared.length===Object.keys(c.moves||{}).length,'动作清单与文件数不一致：'+id);const gameIds=new Set();
   for(const [key,value]of Object.entries(c.moves)){assert(value.key===key&&value.character===id&&declared.includes(key),'动作文件路径与清单不匹配');move(value);assert(!gameIds.has(value.gameId),'重复的游戏动作绑定：'+value.gameId);gameIds.add(value.gameId);}
    for(const value of Object.values(c.moves))for(const edge of value.transitions?.edges||[])for(const target of edge.targets)assert(gameIds.has(target),'连携目标不在当前角色中：'+target);
  }return true;
 }
 const Schema={model,rig,move,bundle:validateBundle,safeData,CHARACTERS,SOCKETS,FX_TYPES,clone,assert};
 class Persistence {
  constructor(name){this.name=name;this.mode='memory';this.db=null;this.error='';}
  async init(){try{this.db=await new Promise((resolve,reject)=>{const q=indexedDB.open('ink-forge-assets',1);q.onupgradeneeded=()=>{if(!q.result.objectStoreNames.contains('projects'))q.result.createObjectStore('projects');};q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);q.onblocked=()=>reject(Error('数据库暂时被另一个页面占用'));});this.mode='indexedDB';}catch(e){this.error=e.message;try{localStorage.setItem('ink-storage-test','1');localStorage.removeItem('ink-storage-test');this.mode='localStorage';}catch(_){this.mode='memory';}}return this;}
  async get(){if(this.mode==='indexedDB')return new Promise((resolve,reject)=>{const r=this.db.transaction('projects','readonly').objectStore('projects').get(this.name);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);});if(this.mode==='localStorage'){const s=localStorage.getItem(this.name);return s?JSON.parse(s):null;}return null;}
  async set(value){if(this.mode==='indexedDB')return new Promise((resolve,reject)=>{const tx=this.db.transaction('projects','readwrite');tx.objectStore('projects').put(value,this.name);tx.oncomplete=()=>resolve(true);tx.onerror=tx.onabort=()=>reject(tx.error||Error('无法保存数据库'));});if(this.mode==='localStorage'){localStorage.setItem(this.name,JSON.stringify(value));return true;}return false;}
 }
 class AssetStore {
  constructor(bundle,embedded=null){this.bundle=bundle;this.manifest=bundle.manifest;this.overrides={models:{},rigs:{},moves:{},skins:{}};this.revision=0;this.listeners=new Set();this.cache=new Map();this.queue=Promise.resolve();this.id=embedded?.projectId||'ink-flow-sf6-v9';this.persistence=new Persistence(this.id);this.embedded=embedded;this.pathHandle=null;this.directoryQueue=Promise.resolve();this.lastSaved=0;this.mode='loading';this.gameMap={};for(const id of CHARACTERS){for(const rec of Object.values(bundle.characters[id].moves))this.gameMap[id+':'+rec.gameId]=id+':'+rec.key;}}
  async init(){
   validateBundle(this.bundle);
   await this.persistence.init();this.mode=this.persistence.mode;
   // A portable HTML is a seed, not a command to discard later local edits.
   // Both candidates are validated before revision comparison.
   const stored=await this.persistence.get().catch(e=>{this.loadError=e.message;return null;}),candidates=[];
   for(const [source,snapshot]of [['embedded',this.embedded],['saved',stored]]){if(!snapshot?.version)continue;try{this.validateSnapshot(snapshot);candidates.push({source,snapshot});}catch(e){this.loadError=source+': '+e.message;}}
   candidates.sort((a,b)=>(b.snapshot.revision||0)-(a.snapshot.revision||0)||(b.source==='saved'?1:-1));
   if(candidates.length){const v=candidates[0].snapshot;this.overrides=this.validateSnapshot(v);this.revision=v.revision||0;this.lastSaved=v.createdAt||0;this.cache.clear();}
   this.emit('ready');return this;
  }
  emit(type,keys=[]){for(const f of this.listeners)f({type,keys,revision:this.revision,mode:this.mode});}
  on(f){this.listeners.add(f);return()=>this.listeners.delete(f);}
  getModel(id){return this.overrides.models[id]||this.bundle.characters[id].model;}
  getRig(id){return this.overrides.rigs[id]||this.bundle.characters[id].rig;}
  getSkin(id){return this.overrides.skins[id]||null;}
  getMove(id,key){return this.overrides.moves[id+':'+key]||this.bundle.characters[id]?.moves[key];}
  byGame(id,gameId){const key=this.gameMap[id+':'+gameId];if(!key)return null;const split=key.indexOf(':');return this.getMove(id,key.slice(split+1));}
  profile(id){const a=this.getModel(id),b=this.getRig(id);return {...INK.assets.byID[id],...a,id,rigLengths:b.lengths.slice(),rigRearShoulder:b.rearShoulder.slice(),rigFrontShoulder:b.frontShoulder.slice(),rigHipWidth:b.hipWidth,rigHeadOffset:b.headOffset,previewStyle:{...a.style}};}
  list(id){return Object.values(this.bundle.characters[id].moves).map(r=>this.getMove(id,r.key));}
  clip(record){const key=keyOf(record),cache=this.cache.get(key);if(cache?.record===record)return cache.clip;const clip=new (INK.CompiledClip||INK.Clip)(record.clip);this.cache.set(key,{record,clip});return clip;}
  modified(id,key){return !!this.overrides.moves[id+':'+key];}
  snapshot(){return{version:2,kind:'ink-project-overrides',projectId:this.id,revision:this.revision,createdAt:this.lastSaved,models:clone(this.overrides.models),rigs:clone(this.overrides.rigs),moves:clone(this.overrides.moves),skins:clone(this.overrides.skins)};}
  validateTargets(rec){for(const edge of rec.transitions?.edges||[])for(const target of edge.targets)assert(!!this.gameMap[rec.character+':'+target],'连携目标不在当前角色中：'+target);return rec;}
  validateSnapshot(s){safeData(s);assert(s?.version===2&&s.kind==='ink-project-overrides','工程文件版本无效');if(s.revision!==undefined)integer(s.revision,0,1000000000,'工程修订号');if(s.createdAt!==undefined)integer(s.createdAt,0,Number.MAX_SAFE_INTEGER,'保存时间');const out={models:{},rigs:{},moves:{},skins:{}};for(const[id,r]of Object.entries(s.models||{})){assert(id===r.character,'模型 ID 不一致');out.models[id]=model(r);}for(const[id,r]of Object.entries(s.rigs||{})){assert(id===r.character,'骨架 ID 不一致');out.rigs[id]=rig(r);}for(const[id,r]of Object.entries(s.skins||{})){assert(id===r.character,'矢量人物 ID 不一致');out.skins[id]=INK.ImageSkin.validate(r);}assert(Object.keys(s.moves||{}).length<=800,'招式数量超限');for(const[key,r]of Object.entries(s.moves||{})){const valid=move(r);assert(key===keyOf(r),'动作索引不一致');assert(this.bundle.characters[r.character]?.moves[r.key]?.gameId===r.gameId,'动作不匹配当前游戏资产');out.moves[key]=this.validateTargets(valid);}return out;}
  applySnapshot(s,notify=true){const next=this.validateSnapshot(s);this.overrides=next;this.revision=Math.max(this.revision+1,s.revision||0);this.cache.clear();if(notify)this.emit('import');}
  async importSnapshot(s){const next=this.validateSnapshot(s);return this.transact(()=>next,'import');}
  transact(change,type='save',keys=[]){const run=async()=>{const next=change(clone(this.overrides));const snapshot={...this.snapshot(),...next,revision:this.revision+1,createdAt:Date.now()};const durable=await this.persistence.set(snapshot);this.overrides=next;this.revision=snapshot.revision;this.lastSaved=snapshot.createdAt;this.cache.clear();this.emit(type,keys);return{durable,mode:this.mode,revision:this.revision};};this.queue=this.queue.then(run,run);return this.queue;}
  async save({motion,model:mo,rig:ri}){const rec=motion?move(motion):null,mdl=mo?model(mo):null,rigged=ri?rig(ri):null;if(rec){assert(this.bundle.characters[rec.character].moves[rec.key]?.gameId===rec.gameId,'招式绑定不匹配');this.validateTargets(rec);}return this.transact(next=>{if(rec)next.moves[keyOf(rec)]=rec;if(mdl)next.models[mdl.character]=mdl;if(rigged)next.rigs[rigged.character]=rigged;return next;},'save',[rec?keyOf(rec):mdl?.character||rigged?.character]);}
  async saveSkin(id,data){assert(CHARACTERS.includes(id),'未知角色');const skin=data?INK.ImageSkin.validate(data):null;if(skin)assert(skin.character===id,'矢量人物所属角色不一致');return this.transact(next=>{if(skin)next.skins[id]=skin;else delete next.skins[id];return next;},'skin',[id]);}
  async reset(id,key,includingModel=false){return this.transact(next=>{delete next.moves[id+':'+key];if(includingModel){delete next.models[id];delete next.rigs[id];}return next;},'reset',[id+':'+key]);}
  files(){const out={'project.json':JSON.stringify(this.manifest,null,2)};for(const id of CHARACTERS){out[`characters/${id}/model.json`]=JSON.stringify(this.getModel(id),null,2);out[`characters/${id}/rig.json`]=JSON.stringify(this.getRig(id),null,2);out[`characters/${id}/image-skin.json`]=JSON.stringify(this.getSkin(id),null,2);for(const m of this.list(id))out[`characters/${id}/moves/${m.key}.json`]=JSON.stringify(m,null,2);}out['project-overrides.json']=JSON.stringify(this.snapshot(),null,2);return out;}
  async connectDirectory(){assert(globalThis.showDirectoryPicker&&globalThis.isSecureContext,'此浏览器不支持目录授权，请使用「导出工程 ZIP」');this.pathHandle=await showDirectoryPicker({id:'ink-project',mode:'readwrite'});return this.pathHandle.name;}
  async readDirectory(){
   assert(this.pathHandle,'尚未连接工程目录');await this.directoryQueue.catch(()=>{});
   // Read the actual per-character files, not only a possibly stale overrides backup.
   // Stage everything first. One missing or invalid file aborts without publication.
   const read=async(dir,name)=>{const handle=await dir.getFileHandle(name);const file=await handle.getFile();assert(file.size<=2000000,'单个资产文件过大：'+name);return JSON.parse(await file.text());};
   const manifest=await read(this.pathHandle,'project.json');assert(manifest.version===this.manifest.version,'工程清单版本不一致');
   const next={version:2,kind:'ink-project-overrides',models:{},rigs:{},moves:{},skins:{}};
   const characters=await this.pathHandle.getDirectoryHandle('characters');
   for(const id of CHARACTERS){const folder=await characters.getDirectoryHandle(id),mdl=model(await read(folder,'model.json')),skeleton=rig(await read(folder,'rig.json'));assert(mdl.character===id&&skeleton.character===id,'角色文件夹与资产 ID 不一致');next.models[id]=mdl;next.rigs[id]=skeleton;try{const skin=await read(folder,'image-skin.json');if(skin){const valid=INK.ImageSkin.validate(skin);assert(valid.character===id,'矢量人物文件夹与资产 ID 不一致');next.skins[id]=valid;}}catch(e){if(e.name!=='NotFoundError')throw e;}const moves=await folder.getDirectoryHandle('moves');
    for(const rec of Object.values(this.bundle.characters[id].moves)){const r=move(await read(moves,rec.key+'.json'));assert(r.key===rec.key&&r.character===id&&r.gameId===rec.gameId,'动作文件与清单不一致');next.moves[keyOf(r)]=r;}
   }
   return this.importSnapshot(next);
  }
  async writeDirectory(files=null){assert(this.pathHandle,'尚未连接工程目录');const entries=Object.entries(files||this.files()),root=this.pathHandle;const run=async()=>{for(const[path,content]of entries){assert(!path.includes('..')&&!path.startsWith('/'),'禁止不安全路径');const parts=path.split('/');let dir=root;for(const segment of parts.slice(0,-1))dir=await dir.getDirectoryHandle(segment,{create:true});const file=await dir.getFileHandle(parts.at(-1),{create:true});const stream=await file.createWritable();try{await stream.write(content);await stream.close();}catch(e){await stream.abort().catch(()=>{});throw e;}}return entries.length;};this.directoryQueue=this.directoryQueue.then(run,run);return this.directoryQueue;}
 }
 function retime(record,startup,active,recovery){const r=clone(record),b=r.binding,old=[0,b.startup,b.startup+b.active,b.startup+b.active+b.recovery],next=[0,startup,startup+active,startup+active+recovery];
  [startup,active,recovery].forEach((n,i)=>integer(n,1,i===0?180:300,'帧数'));
  const map=t=>{for(let i=0;i<3;i++)if(t<=old[i+1]||i===2)return next[i]+(t-old[i])/(old[i+1]-old[i])*(next[i+1]-next[i]);};
  for(const[ch,keys]of Object.entries(r.clip.tracks)){const times=new Map;for(const[t,v,e]of keys){const nt=Math.round(map(t)*1000)/1000;times.set(nt,[nt,v,e||'smooth']);}r.clip.tracks[ch]=[...times.values()].sort((a,b)=>a[0]-b[0]);}
  for(const b of r.clip.meta?.secondaryBeats||[])b.frame=Math.round(map(b.frame)*1000)/1000;
  const graph=r.clip.meta?.motion5;
  if(graph){const keys=track=>[...new Map(track.map(k=>{const t=Math.round(map(k[0])*1000)/1000;return [t,[t,...k.slice(1)]];})).values()].sort((a,b)=>a[0]-b[0]);
   for(const layer of graph.layers||[]){for(const name of Object.keys(layer.tracks))layer.tracks[name]=keys(layer.tracks[name]);if(Array.isArray(layer.weight))layer.weight=keys(layer.weight);}
   for(const c of graph.contacts||[]){const start=c.start,end=c.end;c.start=map(start);c.end=map(end);if(c.fadeIn!==undefined)c.fadeIn=Math.min((c.end-c.start)/2,map(start+c.fadeIn)-c.start);if(c.fadeOut!==undefined)c.fadeOut=Math.min((c.end-c.start)/2,c.end-map(end-c.fadeOut));}
  }
  for(const e of r.clip.events||[])e.frame=Math.min(next[3]-1,Math.round(map(e.frame)));
  for(const e of r.fx){const end=map(Math.min(old[3],e.frame+e.duration));e.frame=Math.min(next[3]-1,Math.round(map(e.frame)));e.duration=Math.max(1,Math.min(120,Math.round(end-e.frame)));}
  for(const box of r.boxes.items){box.start=Math.min(next[3]-1,Math.round(map(box.start)));box.end=Math.max(box.start+1,Math.min(next[3],Math.round(map(box.end))));}
  r.binding={...b,startup,active,recovery,retimed:true};r.clip.duration=next[3];r.clip.phases={startup:[0,startup],active:[startup,startup+active],recovery:[startup+active,next[3]]};return move(r);
 }
 INK.Schema=Schema;INK.AssetStore=AssetStore;INK.Persistence=Persistence;INK.retime=retime;
})();
