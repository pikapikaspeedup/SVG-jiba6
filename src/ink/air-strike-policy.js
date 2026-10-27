/* Simulation-owned native/legacy choice. Baseline is original bundle content,
 * never a session store's potentially edited bundle. No visual settings. */
'use strict';
(()=>{
 const characters=['ryu','ken','chun','cammy','luke','juri','mai','iori'],moves=['aMP','aHK','cHP'],clone=v=>JSON.parse(JSON.stringify(v)),freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
 let installed=null,signature=null,revision=null;
 const originals=new Map(),cache=new WeakMap();
 const relevant=(record,model,rig)=>({clip:record.clip,boxes:record.boxes,binding:record.binding,model,rig});
 function installBaseline(bundle,{modelRevision='air-strike-pro18-1'}={}){
  const rows={};for(const id of characters){const c=bundle?.characters?.[id];if(!c?.model||!c.rig)throw TypeError('Missing native character baseline');for(const move of moves){const record=Object.values(c.moves||{}).find(r=>r.gameId===move);if(!record)throw TypeError('Missing native move baseline');rows[id+':'+move]={record:clone(record),model:clone(c.model),rig:clone(c.rig)};}}
  const text=INK.Canonical.encode({rows,modelRevision});if(signature!==null){if(text!==signature)throw Error('Native baseline already installed');return;}
  installed=freeze(rows);signature=text;revision=String(modelRevision);
  for(const [key,row] of Object.entries(installed)){const data=relevant(row.record,row.model,row.rig),text=INK.Canonical.encode(data);originals.set(key,Object.freeze({text,fingerprint:INK.Canonical.sha256(text)}));}
 }
 const baseline=(character,move)=>installed?.[character+':'+move]||null;
 function evaluate(f,m,{store=INK.Runtime?.store}={}){
  const character=f?.ch?.id||'',move=m?.id||'',base=baseline(character,move),answer=(mode,reason,fingerprint=null)=>freeze({mode,reason,fingerprint,modelRevision:revision,character,move});
  if(!base)return answer('legacy','unsupported');
  const expectedPart=character==='mai'?(move==='aHK'?'foot':'fan'):character==='iori'?(move==='aHK'?'foot':'hand'):null;
  const airborne=move!=='cHP';
  if(m.category!=='normal'||m.normalState!==(airborne?'a':'c')||(m.contactPart??null)!==expectedPart||!!m.air!==airborne||m.wakeStrike||m.throw||f.captured||(airborne?f.y>=0:f.y!==0||f.airLock))return answer('legacy','variant');
  if(airborne&&INK.AirBodyPolicy?.evaluate(f,{store}).mode!=='native')return answer('legacy','edited-air-family');
  if(!store?.byGame||!store.getModel||!store.getRig)return answer('legacy','missing-store');
  // AssetStore transactions advance revision. Direct out-of-band mutation is
  // intentionally not covered; stores without a finite revision are uncached.
  const key=character+':'+move;let entry=null;
  if(Number.isFinite(store.revision)){entry=cache.get(store);if(!entry||entry.revision!==store.revision){entry={revision:store.revision,decisions:new Map()};cache.set(store,entry);}if(entry.decisions.has(key))return entry.decisions.get(key);}
  const remember=value=>{if(entry)entry.decisions.set(key,value);return value;};
  const record=store.byGame(character,move);if(!record||record.category!=='normal')return remember(answer('legacy','missing-record'));
  const data=relevant(record,store.getModel(character),store.getRig(character)),original=originals.get(key),text=INK.Canonical.encode(data),same=text===original.text,fingerprint=same?original.fingerprint:INK.Canonical.sha256(text);
  return remember(answer(same?'native':'legacy',same?'original-content':'edited-content',fingerprint));
 }
 function latch(attack,decision){
  if(!attack||!attack.combatID)throw TypeError('Latch requires committed attack identity');
  if(Object.hasOwn(attack,'airStrikePolicy'))return attack.airStrikePolicy;
  if(!decision||!['native','legacy'].includes(decision.mode)||decision.move!==attack.m?.id)throw TypeError('Invalid strike model decision');
  const value=freeze(clone(decision));Object.defineProperty(attack,'airStrikePolicy',{value,enumerable:true});return value;
 }
 function read(f,options={}){const a=f?.attack;if(!a)return null;if(a.airStrikePolicy)return a.airStrikePolicy;if(a.combatID)return freeze({mode:'legacy',reason:'unlatched-instance',fingerprint:null,modelRevision:revision,character:f.ch?.id||'',move:a.m?.id||''});return evaluate(f,a.m,options);}
 INK.AirStrikePolicy=Object.freeze({installBaseline,baseline,evaluate,latch,read});
})();
