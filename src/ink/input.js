/* FLOW 04 · explicit input requests, aged in actionable simulation frames.
 * No autopilot: every queued command originates from an actual input request.
 * Hitstop/super freeze does not eat the nine-frame buffer. No rule is bypassed.
 */
'use strict';
(() => {
  const Input={frame:0,window:9,serial:0,
    begin(G) {if(G.screen==='battle'&&G.phase==='fight'&&!G.hitstop&&!(G.slow>0&&G.tick%2===0))this.frame++;},
    enqueue(f,m,G,reason='early') {
      if(!m||G.phase!=='fight'||f.hp<=0||f.captured||['throwing','ko','win'].includes(f.state))return false;
      f.input.queue=[{m,t:G.tick,inkFrame:this.frame,serial:++this.serial,reason}];
      f._inkInput={status:'buffered',move:m.id,frame:this.frame,reason};this.log(f,{...f._inkInput,serial:this.serial});return false;
    },
    consume(f,G,request) {
      const q=f.input.queue[0];if(!q)return false;
      const age=q.inkFrame==null?G.tick-q.t:this.frame-q.inkFrame;
      if(age>this.window){f.input.queue.shift();f._inkInput={status:'expired',move:q.m.id,age};this.log(f,{...f._inkInput,serial:q.serial});return false;}
      if(G.hitstop)return false;
      const ok=request(f,q.m,false);
      if(ok){if(f.input.queue[0]===q)f.input.queue.shift();f._inkInput={status:'consumed',move:q.m.id,age};this.log(f,{...f._inkInput,serial:q.serial});}return ok;
    },
    log(f,e){if(!f._inkInputLog)f._inkInputLog=[];f._inkInputLog.push({...e});if(f._inkInputLog.length>64)f._inkInputLog.shift();},
    reset(f) {f.input?.queue?.splice(0);f._inkInput=null;},
    inspect(f) {const q=f.input?.queue?.[0];return q?{move:q.m.id,remaining:Math.max(0,this.window-(this.frame-(q.inkFrame??this.frame))),reason:q.reason}:null;}
  };INK.Input=Input;
})();
