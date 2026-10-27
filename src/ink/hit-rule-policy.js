/* Content eligibility for the ground hit family. Independent of
 * display switches; stores advance revision through their public transactions. */
'use strict';
(()=>{
 const characters=['ryu','ken','chun','cammy','luke','juri','mai','iori'],states=Object.freeze(['@hit-high','@hit-low']),clone=x=>JSON.parse(JSON.stringify(x)),freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
 let installed=null,signature=null;const originals=new Map(),cache=new WeakMap();
 const relevant=row=>({responseRevision:INK.HitRuleData?.revision??1,solverRevision:'native-hit-1',model:row.model,rig:row.rig,records:Object.fromEntries(states.map(id=>{const r=row.records[id];return [id,{clip:r.clip,boxes:r.boxes,binding:r.binding}];}))});
 function installBaseline(bundle){
  const rows={};for(const character of characters){const c=bundle?.characters?.[character];if(!c?.model||!c.rig)throw TypeError('Missing hit character baseline');const records={};for(const state of states){const r=Object.values(c.moves||{}).find(m=>m.gameId===state);if(!r)throw TypeError('Missing hit state '+state);records[state]=clone(r);}rows[character]={character,model:clone(c.model),rig:clone(c.rig),records};}
  const text=INK.Canonical.encode(rows);if(signature!==null){if(text!==signature)throw Error('Hit baseline already installed');return;}
  installed=freeze(rows);signature=text;for(const [character,row] of Object.entries(rows)){const text=INK.Canonical.encode(relevant(row));originals.set(character,Object.freeze({text,fingerprint:INK.Canonical.sha256(text)}));}
 }
 const baseline=character=>installed?.[character]||null;
 function evaluate(f,{store=INK.Runtime?.store}={}){
  const character=f?.ch?.id||'',revision=Number.isFinite(store?.revision)?store.revision:null,answer=(mode,reason,fingerprint=null)=>freeze({mode,reason,character,fingerprint,revision});
  if(!baseline(character))return answer('legacy','unsupported');
  if(!store?.byGame||!store.getModel||!store.getRig)return answer('legacy','missing-store');
  let cached=null;if(revision!==null){cached=cache.get(store);if(!cached||cached.revision!==revision){cached={revision,decisions:new Map()};cache.set(store,cached);}if(cached.decisions.has(character))return cached.decisions.get(character);}
  const remember=d=>{if(cached)cached.decisions.set(character,d);return d;},records={};
  for(const state of states){const r=store.byGame(character,state);if(!r)return remember(answer('legacy','missing-state'));records[state]=r;}
  const text=INK.Canonical.encode(relevant({records,model:store.getModel(character),rig:store.getRig(character)})),original=originals.get(character),same=text===original.text;
  return remember(answer(same?'native':'legacy',same?'original-content':'edited-content',same?original.fingerprint:INK.Canonical.sha256(text)));
 }
 const supports=(f,options)=>evaluate(f,options).mode==='native';
 // Called BEFORE setState clears the source owner. This is entry eligibility,
 // not a per-render ownership gate; an episode must retain its committed decision.
 function entry(f,frame,options={}){
  const decision=evaluate(f,options),answer=(ok,reason)=>Object.freeze({ok,reason,policy:decision});
  if(decision.mode!=='native')return answer(false,decision.reason);
  if(f.y!==0||f.airLock||f.captured||f.throwAction||f.hp<=0||['hit','stun','tumble','down','rise','ko','win','captured','throwing'].includes(f.state))return answer(false,'outside-ground-entry');
  const attack=f.attack,m=attack?.m;
  const nativeAttack=f.state==='attack'&&!!attack?.combatID&&['sMP','sHP','cMK'].includes(m?.id)&&m.category==='normal'&&!m.air&&!m.throw&&!m.wakeStrike&&INK.StrikeModelPolicy?.read(f)?.mode==='native';
  const defense=!attack&&['idle','dash','rush','recovery','block','parry'].includes(f.state)&&INK.DefensePolicy?.evaluate(f,options)?.mode==='native';
  if(!nativeAttack&&!defense)return answer(false,'unsupported-source-owner');
  if(!frame?.nativeBody||frame.space!=='actor-screen'||frame.bridge||frame.carrierSpec?.representation!=='spatial3D'||frame.mode!==(nativeAttack?'strike-model':'defense-body'))return answer(false,'untrusted-carrier');
  const row=baseline(f.ch.id),lengths=row.rig.lengths;
  for(const name of ['rearArm','frontArm','rearLeg','frontLeg']){
   const chain=frame.joints3D?.[name],expected=lengths.slice(name.endsWith('Leg')?2:0,name.endsWith('Leg')?4:2);
   if(!Array.isArray(chain)||chain.length!==3||!chain.every(q=>Array.isArray(q)&&q.length===3&&q.every(Number.isFinite)))return answer(false,'invalid-chain');
   for(let i=0;i<2;i++)if(Math.abs(Math.hypot(...chain[i+1].map((v,j)=>v-chain[i][j]))-expected[i])>1e-4)return answer(false,'non-native-length');
  }
  for(const key of ['pelvis','chest','neck','head'])if(!Array.isArray(frame.joints3D[key])||frame.joints3D[key].length!==3||!frame.joints3D[key].every(Number.isFinite))return answer(false,'invalid-body');
  return answer(true,nativeAttack?'native-strike-entry':'native-defense-entry');
 }
 const eligible=(f,frame,options)=>entry(f,frame,options).ok;
 INK.HitRulePolicy=Object.freeze({install:installBaseline,installBaseline,baseline,evaluate,supports,eligible,entry,states});
})();
