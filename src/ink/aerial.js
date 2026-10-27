/* AIR FLOW: voluntary jumps own limited steering and a committed fast descent.
 * Launches, throws and special-move trajectories keep their existing authority. */
'use strict';
(() => {
 const settings={enabled:true},clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 let root=null,streaks=[];
 const active=()=>settings.enabled;
 function launch(f,G,computer=false){f._inkFlight=active()?{start:G.actionTick,origin:f.x,cut:false,fast:false,computer,landed:false}:null;}
 function control(f,G,command=null){
  const flight=f._inkFlight;if(!active()||!flight||flight.computer&&!command||flight.landed||f.y>=0||f.captured||!['idle','recovery','attack'].includes(f.state))return;
  if(f.attack&&f.attack.m.category!=='normal')return;
  const held=command?{has:key=>!!command[key]}:f.input.held,dir=(held.has('right')?1:0)-(held.has('left')?1:0);
  // A tap releases only upward impulse; it can never inject a second jump.
  if(!flight.cut&&!held.has('up')){flight.cut=true;if(f.vy<-8)f.vy=-8;}
  if(!flight.fast){f.vx=clamp(f.vx+dir*(f.attack?.12:.26),-5.7,5.7);}
  if(!flight.fast&&held.has('down')&&f.vy>=-.5){flight.fast=true;flight.fastStart=G.actionTick;f.vy=Math.max(7,f.vy);f.vx*=.7;}
  if(flight.fast){f.vy=Math.min(18,f.vy+.45);f.vx*=.985;}
 }
 function land(f,G){
  const flight=f._inkFlight;if(!flight||flight.landed)return;
  flight.landed=true;flight.landedAt=G.actionTick;flight.travel=f.x-flight.origin;
  if(!active()||['down','ko','captured','throwing'].includes(f.state))return;
  if(flight.fast){f.landT=f.landMax=Math.max(f.landT||0,11);if(f.state==='recovery')f.stateT=Math.max(f.stateT,11);}
 }
 function recover(f,G,pay,direction=null){
  if(!active()||f.state!=='down'||f.y!==0||f.hp<=0||f._inkRecovery||f.captured||f.stateT<=2)return false;
  if(!pay(f,1))return false;
  const held=f.input.held,dir=direction===null?(held.has('right')?1:0)-(held.has('left')?1:0):clamp(direction,-1,1);
  f._inkRecovery={direction:dir,selectedAt:G.actionTick,age:0};f.stateT=Math.min(f.stateT,6);return true;
 }
 function recoveryStep(f){if(!active()||!f._inkRecovery||f.state!=='rise')return;const q=f._inkRecovery;q.age++;if(q.age<=6)f.x+=q.direction*(7-q.age)*2;}
 function pose(f,source){
  if(INK.Kinetic?.settings.enabled===false)return source;
  if(active()&&f._inkRecovery&&f.state==='rise'){
   const p=INK.copy(source),u=clamp(f._inkRecovery.age/12,0,1),w=Math.sin(Math.PI*u);p.bob=(p.bob||0)+7*w;p.lean=(p.lean||0)+f._inkRecovery.direction*f.dir*7*w;return INK.Articulation.inherit(source,p);
  }
  if(!active()||!f._inkFlight||f._inkFlight.landed||f.y>=0||f.captured||['hit','tumble','down','ko','throwing'].includes(f.state))return source;
  const p=INK.copy(source),rise=clamp(-f.vy/15,0,1),fall=clamp(f.vy/18,0,1),fast=f._inkFlight.fast;
  p.lean=(p.lean||0)+f.vx*f.dir*.65+(fast?6*fall:0);p.chest=(p.chest||0)-3*rise+2*fall;
  if(!f.attack){p.head=(p.head||0)-3*rise+2*fall;p.pelvis=(p.pelvis||0)+4*rise;
   p.fw=[p.fw[0]-7*rise,p.fw[1]+8*rise-8*fall];p.rw=[p.rw[0]-5*rise,p.rw[1]+6*rise-10*fall];
   p.fa=[p.fa[0],p.fa[1]-12*rise+(fast?5:0)*fall];p.ra=[p.ra[0]-8*rise,p.ra[1]-8*rise];
  }
  return INK.Articulation.inherit(source,p);
 }
 function render(G,fighters){
  if(!root?.isConnected){const parent=document.getElementById('ghosts');if(!parent)return;root=INK.SVG.node('g',{'data-air-flow':'descent','pointer-events':'none'},parent);streaks=[0,1].map(()=>INK.SVG.node('path',{fill:'none','stroke-width':2,'stroke-linecap':'round'},root));}
  fighters.forEach((f,i)=>{const n=streaks[i];if(!n)return;const visible=active()&&INK.Kinetic?.settings.enabled!==false&&INK.VFX.settings.enabled&&!INK.VFX.settings.reducedMotion&&f.y<0&&f._inkFlight?.fast&&!f.captured&&!['hit','tumble'].includes(f.state);INK.SVG.assign(n,'display',visible?'inline':'none');if(!visible)return;
   const x=f.x,y=665+f.y-180,l=Math.min(70,15+f.vy*2.8);INK.SVG.assign(n,'d',`M${x-42} ${y-l}l-4 ${l}M${x+46} ${y-l-18}l4 ${l}M${x-5} ${y-l-65}v${l*.7}`);INK.SVG.assign(n,'stroke',f.ch.color);INK.SVG.assign(n,'opacity',.38*INK.VFX.settings.intensity);
  });
 }
 function inspect(f,G){const q=f._inkFlight;return {enabled:active(),phase:f.y<0?(q?.fast?'fast':f.vy<-.5?'rise':f.vy>.5?'fall':'apex'):f.landT>0?'landing':'ground',cut:!!q?.cut,fast:!!q?.fast,recovery:f.landT||0,travel:q?f.x-q.origin:0,airFrames:q&&!q.landed?G.actionTick-q.start:0};}
 INK.Aerial={exposed:f=>active()&&!!f._inkRecovery&&f.state==='rise'&&f.invuln<=0,settings,launch,control,land,recover,recoveryStep,pose,render,inspect};
})();
