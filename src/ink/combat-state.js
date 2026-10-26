/* Explicit simulation DTO; rendering resources and transport are not combat state. */
'use strict';
(() => {
 const actorFields=('index renderScale hp drive super burnout burnT driveDelay x px y py vy vx push dir move state stateT stateAge attack branchT branchReady denjin stock flameStock maiFollowUntil maiFollowEnhanced maiAirFollow maiFollowCancel install invuln rushBuff combo comboDamage comboTimer comboScale captured captureKind capturedBy captureWasParry capturePhase captureX captureY throwAction throwInvuln juggle knockOnLand landT landMax airLock parryAge parryPaid parryStart aiWait crouch input lastHitTick lastThrow hitstun blockstun walkT downPoseFrom tumbleFrom roundResult aiGuard aiParry win lastHitDamage perfectScale jumpPre jumpDir ai hitHeight hitDir hitPush _inkVisualClock _inkPoseVelocity _inkState _inkTransition _inkStateBlend _inkActionOrigin _inkRetreat _inkContactEpoch').split(' ');
 const globalFields=('actionTick screen mode control difficulty phase phaseT tick clock round wins hitstop slow result lastWinner _inkStepFrozen trial').split(' ');
 const pick=(v,keys)=>Object.fromEntries(keys.map(k=>[k,v[k]]));
 function capture(G,fighters,gameTime){
  const groups={global:{...pick(G,globalFields),gameTime},actors:fighters.map(f=>({...pick(f,actorFields),character:f.ch.id})),input:{frame:INK.Input.frame,serial:INK.Input.serial,window:INK.Input.window},random:INK.Random.combat.inspect(),spacing:INK.Spacing.authority(),controllers:{combo:INK.Combo.status==='running'?pick(INK.Combo,'route status mode cursor clock hits damage maxCombo actions lastStart startTick guard manualDelay pending bufferFrames waitTicks lastContact startAction'.split(' ')):null,spacing:INK.Spacing.training?.authority?.()||null}};
  const graph=INK.CombatEntities.graph(fighters,G.shots,groups);
  return {...graph.extra,entities:{serial:graph.serial,roots:graph.roots,rows:graph.entities}};
 }
 function signature(state){const groups=Object.fromEntries(Object.entries(state).map(([k,v])=>[k,INK.Canonical.hash(v)]));return {groups,root:INK.Canonical.hash(groups)};}
 function difference(expected,actual,path='$'){
  if(Object.is(expected,actual))return null;
  if(expected===null||actual===null||typeof expected!=='object'||typeof actual!=='object'||Array.isArray(expected)!==Array.isArray(actual))return {path,expected,actual};
  const keys=[...new Set([...Object.keys(expected),...Object.keys(actual)])].sort();
  for(const key of keys){if(!Object.hasOwn(expected,key)||!Object.hasOwn(actual,key))return {path:path+'.'+key,expected:expected[key],actual:actual[key],missing:!Object.hasOwn(expected,key)?'expected':'actual'};const d=difference(expected[key],actual[key],path+'.'+key);if(d)return d;}return null;
 }
 function firstDivergence(expected,actual){
  if(!Array.isArray(expected)||!Array.isArray(actual))throw TypeError('Expected ordered signature arrays');
  for(let tick=0;tick<Math.max(expected.length,actual.length);tick++){
   const a=expected[tick],b=actual[tick];if(!a||!b)return {tick,kind:'length',expected:!!a,actual:!!b};
   if(a.root!==b.root){const groups=[...new Set([...Object.keys(a.groups),...Object.keys(b.groups)])].filter(k=>a.groups[k]!==b.groups[k]);return {tick,kind:'state',groups,expected:a.root,actual:b.root};}
  }return null;
 }
 INK.CombatState=Object.freeze({capture,signature,difference,firstDivergence,actorFields:Object.freeze(actorFields),globalFields:Object.freeze(globalFields)});
})();
