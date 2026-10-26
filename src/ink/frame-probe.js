/* FLOW 09 — bounded, opt-in-to-view diagnostics. Observes the real rAF loop.
 * Callback intervals are scheduling evidence, not a hardware FPS certificate.
 * Hitstop counts remain separate from missed display deadlines. Never adapts
 * combat speed, drops bone samples or changes gameplay because a device is slow.
 */
'use strict';
(()=>{
 const capacity=600,rows=new Array(capacity);let cursor=0,count=0,last=null,pending=null;
 const q=(a,u)=>a.length?a[Math.floor((a.length-1)*u)]:0;
 INK.FrameProbe={version:'9.0.0',capacity,
  begin(now,G){if(G.screen!=='battle'||G.paused||document.hidden){last=null;pending=null;return;}pending={time:now,interval:last===null?0:Math.max(0,now-last),before:INK.CombatFlow.stats.freeze};last=now;},
  end(cpu,G,clock){if(!pending)return;const row={time:pending.time,interval:pending.interval,cpu:Math.max(0,cpu),tick:G.tick,action:G.actionTick,held:INK.CombatFlow.stats.freeze-pending.before,discarded:clock.stats.discardedSteps};pending=null;rows[cursor]=row;cursor=(cursor+1)%capacity;count=Math.min(capacity,count+1);},
  frames(){return Array.from({length:count},(_,i)=>({...rows[(cursor-count+i+capacity)%capacity]}));},
  inspect(){const a=this.frames(),valid=a.filter(r=>r.interval>0),intervals=valid.map(r=>r.interval).sort((a,b)=>a-b),cpu=a.map(r=>r.cpu).sort((a,b)=>a-b);return{capacity,samples:a.length,windowMs:a.length?a.at(-1).time-a[0].time:0,intervalP50:q(intervals,.5),intervalP95:q(intervals,.95),cpuP95:q(cpu,.95),longIntervals:intervals.filter(v=>v>25).length,veryLongIntervals:intervals.filter(v=>v>50).length,heldSimulationSteps:a.reduce((s,r)=>s+r.held,0),discardedSteps:a.length?a.at(-1).discarded-a[0].discarded:0,viewport:INK.Viewport.inspect()};},
  reset(){rows.fill(undefined);cursor=0;count=0;last=null;pending=null;},
  export(){return{version:1,kind:'ink-flow9-frame-diagnostic',capturedAt:new Date().toISOString(),engine:globalThis.SVG_FIGHTER?.version,settings:{rhythm:{...INK.CombatFlow.settings},viewport:{...INK.Viewport.settings},effects:{...INK.VFX.settings}},summary:this.inspect(),frames:this.frames(),note:'Real browser callback/CPU samples, not video, input recording or certified device FPS.'};}
 };
})();
