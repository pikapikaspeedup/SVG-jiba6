/* Simulation-owned identity. Reading a graph never allocates an entity ID. */
'use strict';
(() => {
 let serial=0;
 const kinds=new Set(['attack','projectile','throw']);
 function create(kind,value){if(!kinds.has(kind))throw TypeError('Unknown combat entity');Object.defineProperty(value,'combatID',{value:kind+':'+(++serial),enumerable:true});return value;}
 function graph(fighters,shots,extra=null){
  const entities=new Map(),actors=new Map(fighters.map(f=>[f,'fighter:'+f.index]));
  function ref(v){if(!v)return null;if(actors.has(v))return actors.get(v);if(!v.combatID)throw Error('Combat entity missing creation ID');visit(v);return v.combatID;}
  function value(v){if(v===null||typeof v!=='object')return v;if(actors.has(v)||v.combatID)return {$ref:ref(v)};if(v instanceof Map)return {$map:[...v].map(([k,x])=>[value(k),value(x)])};if(v instanceof Set)return {$set:[...v].map(value)};if(Array.isArray(v))return v.map(value);if(Object.getPrototypeOf(v)!==Object.prototype&&Object.getPrototypeOf(v)!==null)throw TypeError('Opaque combat entity state');return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,value(x)]));}
  // DOM and projectile paint configuration have no collision authority.
  const effectState=new Set(['_inkTimeline','_inkEdges','_inkCursor']);
  const paint=new Set(['node','visual','spin','spinKind']);
  function visit(v){if(entities.has(v.combatID))return;const row={};entities.set(v.combatID,row);for(const [k,x] of Object.entries(v)){if(effectState.has(k))continue;if(v.combatID.startsWith('projectile:')&&paint.has(k))continue;try{row[k]=value(x);}catch(e){throw new TypeError(v.combatID+'.'+k+': '+e.message);}}}
  const roots={fighters:fighters.map(f=>({id:actors.get(f),attack:ref(f.attack),throw:ref(f.throwAction)})),shots:shots.map(ref)};
  const detached=value(extra);
  return {serial,roots,extra:detached,entities:[...entities].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([id,state])=>({id,state}))};
 }
 INK.CombatEntities=Object.freeze({create,graph,reset:()=>{serial=0;},inspect:()=>({serial})});
})();
