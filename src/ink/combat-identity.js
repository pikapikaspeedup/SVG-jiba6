/* Freeze effective content for a match; revision and project IDs are not hashes. */
'use strict';
(() => {
 const clone=v=>JSON.parse(JSON.stringify(v));
 function freeze(v){if(v&&typeof v==='object'){for(const x of Object.values(v))freeze(x);Object.freeze(v);}return v;}
 function capture(store=INK.Runtime.sourceStore){
  if(!store||store.mode==='loading')throw Error('资产尚未加载完成');
  const bundle={manifest:clone(store.manifest),characters:{}};
  for(const id of INK.Schema.CHARACTERS)bundle.characters[id]={model:clone(store.getModel(id)),rig:clone(store.getRig(id)),moves:Object.fromEntries(store.list(id).map(m=>[m.key,clone(m)]))};
  freeze(bundle);const hash=INK.Canonical.hash(bundle),view=new INK.AssetStore(bundle);view.mode='session';
  return {hash,view};
 }
 function rules(config){return {contract:'before-tick-v1/neutral-release-v1/ai-order-0-1',config,
  runtime:INK.Runtime.enabled,anatomy:clone(INK.Anatomy.settings),articulation:clone(INK.Articulation.settings),
  spacingRules:clone(INK.Spacing.rules),randomAlgorithm:INK.Random.combat.inspect().algorithm};}
 function envelope(config,commands,identity,proof){return {kind:'ink-combat-inputs',version:1,identity:clone(identity),config:clone(config),commands:clone(commands),...(proof?{proof:clone(proof)}:{})};}
 function parse(source){
  if(typeof source!=='string'||new TextEncoder().encode(source).length>33554432)throw TypeError('输入录带最多 32 MiB');
  const data=JSON.parse(source),keys=(v,allowed)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!allowed.includes(k)))throw TypeError('无效输入录带字段');};
  keys(data,['kind','version','identity','config','commands','proof']);if(data.kind!=='ink-combat-inputs'||data.version!==1)throw TypeError('不支持的输入录带格式');
  keys(data.identity,['build','assets','rules']);for(const key of ['build','assets','rules'])if(typeof data.identity[key]!=='string'||!/^[a-f0-9]{64}$/.test(data.identity[key]))throw TypeError('缺少有效录带身份');
  data.config=INK.SessionConfig.validate(data.config);new INK.CommandStream().load(data.commands);if(data.proof!==undefined)data.proof=INK.CombatTrace.validate(data.proof,data.commands.ticks);return data;
 }
 INK.CombatIdentity=Object.freeze({capture,rules,envelope,parse});
})();
