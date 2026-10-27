/* Content eligibility for the voluntary jump and landing family. Independent of
 * display switches; stores advance revision through their public transactions. */
'use strict';
(()=>{
 const characters=['ryu','ken','chun','cammy','luke','juri','mai','iori'],states=Object.freeze(['@jump','@land']),clone=x=>JSON.parse(JSON.stringify(x)),freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
 let installed=null,signature=null;const originals=new Map(),cache=new WeakMap();
 const relevant=row=>({solverRevision:'air-body-1',dataRevision:INK.AirBodyData?.revision??1,model:row.model,rig:row.rig,records:Object.fromEntries(states.map(id=>{const r=row.records[id];return [id,{clip:r.clip,boxes:r.boxes,binding:r.binding}];}))});
 function installBaseline(bundle){
  const rows={};for(const character of characters){const c=bundle?.characters?.[character];if(!c?.model||!c.rig)throw TypeError('Missing air body character baseline');const records={};for(const state of states){const r=Object.values(c.moves||{}).find(m=>m.gameId===state);if(!r)throw TypeError('Missing air body state '+state);records[state]=clone(r);}rows[character]={character,model:clone(c.model),rig:clone(c.rig),records};}
  const text=INK.Canonical.encode(rows);if(signature!==null){if(text!==signature)throw Error('Defense baseline already installed');return;}
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
 INK.AirBodyPolicy=Object.freeze({installBaseline,baseline,evaluate,states});
})();
