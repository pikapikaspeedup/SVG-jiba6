/* FLOW 05 — the production fixed-step scheduler, not a demo-only helper.
 * Wall-clock milliseconds enter once. Combat runs at 60 Hz. Display alpha does
 * not step combat. Pause/scene/visibility changes discard pending wall time.
 */
'use strict';
(() => {
  const {finite,clamp}=INK;
  class SimulationClock {
    constructor({hz=60,maxSteps=8,maxElapsed=250}={}) {
      if(!Number.isFinite(hz)||hz<=0||hz>240||!Number.isInteger(maxSteps)||maxSteps<1||maxSteps>120||!Number.isFinite(maxElapsed)||maxElapsed<=0)throw RangeError('Invalid simulation clock settings');
      this.hz=hz;this.stepMs=1000/hz;this.maxSteps=maxSteps;this.maxElapsed=maxElapsed;
      this.last=null;this.accumulator=0;this.active=false;this.paused=false;
      this.stats={ticks:0,callbacks:0,discardedSteps:0,clampedMs:0,pauses:0,alpha:1,lastSteps:0};
    }
    reset() {this.last=null;this.accumulator=0;this.stats.alpha=1;this.stats.lastSteps=0;}
    advance(now,{active=true,paused=false,speed=1}={},step=()=>{}) {
      finite(now,'Finite timestamp required');finite(speed,'Finite playback speed required');
      if(speed<0||speed>4)throw RangeError('Speed must be 0..4');
      if(typeof step!=='function')throw TypeError('Simulation callback required');
      const elapsed=this.last===null?0:Math.max(0,now-this.last);
      this.last=now;this.stats.callbacks++;this.stats.lastSteps=0;
      const switched=active!==this.active||paused!==this.paused;
      if(paused&&!this.paused)this.stats.pauses++;
      this.active=active;this.paused=paused;
      if(switched||!active||paused||speed===0){this.accumulator=0;this.stats.alpha=1;return 1;}
      const bounded=Math.min(elapsed,this.maxElapsed);this.stats.clampedMs+=elapsed-bounded;
      this.accumulator+=bounded*speed;
      let count=0;
      while(this.accumulator+1e-8>=this.stepMs&&count<this.maxSteps) {
        step();this.accumulator=Math.max(0,this.accumulator-this.stepMs);count++;this.stats.ticks++;
      }
      if(this.accumulator+1e-8>=this.stepMs) {
        const drop=Math.floor((this.accumulator+1e-8)/this.stepMs);this.stats.discardedSteps+=drop;
        this.accumulator=Math.max(0,this.accumulator-drop*this.stepMs);
      }
      this.stats.lastSteps=count;this.stats.alpha=clamp(this.accumulator/this.stepMs);return this.stats.alpha;
    }
    inspect() {return {...this.stats,hz:this.hz,active:this.active,paused:this.paused,pendingMs:this.accumulator};}
  }
  INK.SimulationClock=SimulationClock;
  INK.EngineClock=new SimulationClock();
})();
