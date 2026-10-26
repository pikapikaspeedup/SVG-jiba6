/* FLOW 09 — camera comfort is independent of hit feedback and articulated bounds.
 * Stable mode is exactly stationary. Follow mode tracks physics roots through a
 * dead zone, never head/hand/foot extension, confirmed hits or particle amplitude.
 * The legacy "close-up" button is an explicit opt-in; changing it resets tracking.
 */
'use strict';
(() => {
 const {clamp}=INK,settings={mode:'stable'};
 let x=720,y=455,zoom=1,last=null,lastMode='';
 const Viewport={version:'9.0.0',settings,stats:{samples:0,stableFrames:0},
  reset(){x=720;y=455;zoom=1;last=null;lastMode='';},
  set(patch){if(!patch||Object.keys(patch).some(k=>k!=='mode')||!['stable','follow'].includes(patch.mode))throw TypeError('镜头模式必须为 stable 或 follow');Object.assign(settings,patch);this.reset();return{...settings};},
  sample(G,fighters,now,alpha=1){
   if(!Number.isFinite(now)||!Number.isFinite(alpha))throw TypeError('Finite camera time required');
   this.stats.samples++;
   const explicit=!!G.artCloseup,mode=explicit?'closeup':settings.mode;
   if(mode==='stable'||!fighters.length){last=now;lastMode=mode;this.stats.stableFrames++;return 'matrix(1 0 0 1 0 0)';}
   if(lastMode!==mode){x=720;y=455;zoom=1;last=now;lastMode=mode;}
   const frozen=G.paused||G.hitstop>0||G._inkStepFrozen||INK.VFX?.frozen;
   const dt=last===null?0:clamp((now-last)/1000,0,.05);last=now;
   const a=clamp(alpha),xs=fighters.map(f=>(f.px??f.x)+(f.x-(f.px??f.x))*a),ys=fighters.map(f=>(f.py??f.y)+(f.y-(f.py??f.y))*a);
   const middle=(Math.min(...xs)+Math.max(...xs))/2,minY=Math.min(0,...ys),distance=Math.max(...xs)-Math.min(...xs);
   // Keep ordinary punches, kicks and root pushes inside a generous dead zone.
   const wantX=middle<x-95?middle+95:middle>x+95?middle-95:x;
   const wantY=minY<-120?455+(minY+120)*.3:455;
   const wantZoom=explicit?clamp(1150/Math.max(930,distance+480),.85,1.2):1;
   if(!frozen){const u=1-Math.exp(-dt*3.5);x+=(clamp(wantX,500,940)-x)*u;y+=(wantY-y)*u;zoom+=(wantZoom-zoom)*u;}
   return `translate(720 455) scale(${zoom.toFixed(5)}) translate(${-x.toFixed(4)} ${-y.toFixed(4)})`;
  },
  inspect(){return{...this.stats,mode:settings.mode,x,y,zoom};}
 };
 INK.Viewport=Viewport;
})();
