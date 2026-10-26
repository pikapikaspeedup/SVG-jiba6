/* Expression follows accepted combat state on the same frozen action clock. */
'use strict';
(() => {
 const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
 function sample(f,time=f._inkVisualClock||0){
  const r=f._inkReaction,age=time-(r?.actorBirth??-100),hit=r?.outcome==='hit'&&age>=0&&age<32,record=f._inkHitEpisode?.contacts.at(-1),zone=record?.zone||r?.zone||'body',hurt=hit?clamp((r.energy||.3)*1.25)*Math.exp(-age*.045)*(f.state==='hit'?1:.25):0;
  const m=f.attack?.m,t=f.attack?.t||0,start=m?.startup||1,active=!!m&&t>=start&&t<start+m.active,power=m?clamp(active?.8:t<start?.12+.5*t/start:.55*Math.exp(-(t-start-m.active)/6)):0;
  const guard=['block','parry'].includes(f.state)?(f.state==='block'?.9:.65):f.aiGuard||f.input?.held?.has(f.dir>0?'left':'right')?.35:0;
  const brace=r?.armor&&age>=0&&age<14?Math.exp(-age*.09)*.9:0;
  const blinkPhase=(time+(f.index||0)*37)%173,blink=Math.sin(Math.PI*clamp((blinkPhase-169)/4))**2;
  // Airborne combat y is negative, matching upward SVG eye coordinates.
  const opponent=globalThis.SVG_FIGHTER?.fighters?.find(a=>a.index!==f.index),gazeX=opponent?clamp((opponent.x-f.x)/220,-1,1):(f.dir<0?-1:1),gazeY=opponent?clamp((opponent.y-f.y)/180,-1,1):0;
  return {head:zone==='head'?hurt:0,body:zone==='body'?hurt:0,leg:zone==='leg'?hurt:0,guard:guard*(1-hurt),brace,power:power*(1-hurt),blink,gazeX,gazeY};
 }
 INK.CombatExpression={sample};
})();
