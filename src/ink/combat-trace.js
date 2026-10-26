/* Bounded boundary signatures. A recording is not a successful verification. */
'use strict';
(() => {
 const groups=['global','actors','input','random','spacing','controllers','entities'];
 const clone=v=>JSON.parse(JSON.stringify(v)),hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
 function validate(proof,ticks){
  if(!proof||proof.version!==1||proof.contract!=='grouped-state-v1'||Object.keys(proof).some(k=>!['version','contract','frames'].includes(k))||!Array.isArray(proof.frames)||proof.frames.length!==ticks+1||proof.frames.length>3601)throw TypeError('无效逐步摘要');
  for(const f of proof.frames){if(!f||Object.keys(f).some(k=>!['root','groups'].includes(k))||!hash(f.root)||!f.groups||Object.keys(f.groups).length!==groups.length||groups.some(k=>!hash(f.groups[k]))||INK.Canonical.hash(f.groups)!==f.root)throw TypeError('无效状态摘要身份');}
  return clone(proof);
 }
 class CombatTrace {
  constructor(){this.reset();}
  reset(){this.frames=[];this.expected=null;this.result={status:'idle',tick:0,divergence:null};}
  begin(initial,{proof=null,playback=false}={}){this.reset();this.expected=proof?clone(proof.frames):null;this.result.status=playback?(proof?'checking':'unverified'):'recording';this.append(initial);}
  append(state){
   if(this.result.status==='diverged')return false;
   if(this.frames.length>=3601)throw RangeError('状态记录达到容量上限');
   const signature=INK.CombatState.signature(state),tick=this.frames.length;this.frames.push(signature);this.result.tick=tick;
   if(this.expected){const expected=this.expected[tick];if(!expected||expected.root!==signature.root){this.result={status:'diverged',tick,divergence:{tick,groups:expected?groups.filter(k=>expected.groups[k]!==signature.groups[k]):groups.slice(),expected:expected?.root||null,actual:signature.root}};return false;}if(this.frames.length===this.expected.length)this.result.status='matched';}
   return true;
  }
  export(ticks,state){if(this.frames.length!==ticks+1)throw Error('输入与状态边界不一致');if(INK.CombatState.signature(state).root!==this.frames.at(-1).root)throw Error('状态在模拟步之外改变，请重新录制');if(this.result.status==='diverged')throw Error('重演已有分歧');return {version:1,contract:'grouped-state-v1',frames:clone(this.frames)};}
  inspect(){return clone(this.result);}
 }
 INK.CombatTrace=CombatTrace;INK.CombatTrace.validate=validate;
})();
