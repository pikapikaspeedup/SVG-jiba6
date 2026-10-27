/* Real floor arrivals own their feedback. No render-time births or root motion. */
'use strict';
(() => {
 const settings={enabled:true},clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
 const surfaces={neon:{kind:'wet',color:'#8bc8dc'},courtyard:{kind:'dust',color:'#d7b280'},rooftop:{kind:'grit',color:'#b5b5cf'}};
 let events=[],root=null,slots=[],serial=0,pending=new WeakMap();
 const active=()=>settings.enabled&&INK.Kinetic?.settings.enabled;
 function commit(f,G,speed,horizontal,kind='step',point=null){
  if(!active()||!Number.isFinite(speed)||speed<3)return null;
  const surface=surfaces[G.stage]||surfaces.neon,force=clamp(speed/14,.2,1.5),heavy=kind==='down'||kind==='throw';
  const e=Object.freeze({id:++serial,actor:f.index,birth:INK.VFX.time,x:Number.isFinite(point?.[0])?point[0]:f.x,kind,heavy,surface:surface.kind,color:surface.color,
   force,drift:clamp(horizontal,-9,9),life:heavy?38:21});
  events.push(e);if(events.length>8)events.shift();return e;
 }
 function armArrival(f,G,speed,horizontal,kind,handoff){
  if(!handoff?.feet||!Number.isFinite(speed)||speed<3)return null;const time=f._inkVisualClock;
  const q={time,last:time-1,epoch:f._inkContactEpoch||0,x:f.x,speed,horizontal,kind,remaining:['rear','front'],until:time+32};pending.set(f,q);return q;
 }
 function step(f,G){const q=pending.get(f);if(!q)return;
  const time=f._inkVisualClock;if(!Number.isFinite(time)||time<q.time||time<q.last||time>q.until||f.y!==0||f.jumpPre>0||f.hp<=0||f.captured||f.throwAction||['hit','tumble','down','rise','ko','throwing','captured'].includes(f.state)||(f._inkContactEpoch||0)!==q.epoch||Math.abs(f.x-q.x)>80){pending.delete(f);return;}
  if(time===q.last||G._inkStepFrozen||G.hitstop>0)return;q.last=time;q.x=f.x;
  const sample=INK.AirStrike?.owns(f)?{model:INK.AirStrike.sample(f)}:INK.StrikeModel?.owns(f)?{model:INK.StrikeModel.sample(f)}:INK.RulePose?.sample(f);if(!sample?.model)return;
  const scale=f.ch.scale||1,feet=sample.worldFeet||INK.StrikeModelFrame.build(f,sample.model,{world:{x:f.x,y:0,dir:f.dir,scale}}).worldFeet,gait=INK.Locomotion?.sample(f,time),ground=665-16*scale;
  for(const key of q.remaining.slice()){const point=feet?.[key],weight=sample.model.support?.weights?.[key]??sample.support?.weights?.[key]??gait?.weights?.[key];
   // Actual solved ankles must reach the floor. A low swing cannot emit only
   // because its planned target lies on the ground; require load when known.
   if(!point||Math.abs(point[1]-ground)>2*scale||Number.isFinite(weight)&&weight<.5)continue;
   commit(f,G,q.speed*(q.remaining.length===2?1:.65),q.horizontal,q.kind,point);q.remaining=q.remaining.filter(k=>k!==key);
  }if(!q.remaining.length)pending.delete(f);
 }
 function mount(){
  if(root?.isConnected)return;const parent=document.getElementById('ground-fx');if(!parent)return;
  const n=INK.SVG.node;root=n('g',{'data-ground-contact':'arrival','pointer-events':'none'},parent);
  slots=Array.from({length:4},()=>{const group=n('g',{},root);return {group,
   outer:n('ellipse',{fill:'none','stroke-width':1.6},group),inner:n('ellipse',{fill:'none','stroke-width':1},group),
   scrape:n('path',{fill:'none','stroke-width':2,'stroke-linecap':'round'},group),
   pieces:Array.from({length:8},()=>n('path',{},group))};});
 }
 function visible(G,alpha=1){const time=G.paused||G.hitstop||INK.VFX.frozen?INK.VFX.time:INK.VFX.time-1+clamp(alpha);return {time,rows:events.filter(e=>time>=e.birth&&time<e.birth+e.life).slice(-4)};}
 function render(G,alpha=1){
  mount();if(!root)return;const S=INK.SVG.assign,W=INK.VFX,on=active()&&W.settings.enabled;
  S(root,'display',on?'inline':'none');if(!on)return;
  const {time,rows}=visible(G,alpha),reduced=W.settings.reducedMotion;
  slots.forEach((slot,i)=>{const e=rows[i];S(slot.group,'display',e?'inline':'none');if(!e)return;
   const age=time-e.birth,u=clamp(age/e.life),energy=e.force*(e.heavy?1.35:.7),spread=(22+Math.sqrt(u)*100)*energy,
    fade=(1-u)**2*W.settings.intensity,wet=e.surface==='wet',y=668;
   S(slot.group,'transform',`translate(${e.x} ${y})`);S(slot.group,'data-surface',e.surface);
   for(const [j,n] of [slot.outer,slot.inner].entries()){
    S(n,'rx',spread*(j?.58:1));S(n,'ry',spread*(j?.08:.13));S(n,'cy',j?1:0);S(n,'stroke',e.color);
    S(n,'opacity',fade*(wet?.52:.2)*(reduced?.5:1));
   }
   const drift=reduced?0:e.drift*age*.65,tail=clamp(Math.abs(drift),0,85),sign=Math.sign(drift)||1;
   S(slot.scrape,'d',`M${-sign*tail} 1Q${-sign*tail*.45} -3 7 0M${-sign*tail*.65} 5L14 4`);
   S(slot.scrape,'stroke',e.color);S(slot.scrape,'opacity',e.heavy?fade*.35:0);
   slot.pieces.forEach((p,j)=>{
    S(p,'display',reduced?'none':'inline');if(reduced)return;
    const side=j%2?1:-1,seed=(j*37+e.id*11)%19/19,v=1.7+seed*3.2,
     x=side*(12+age*v*energy)+drift*.18,h=Math.max(0,age*(2.2+seed*2.3)*energy-age*age*.17),size=(wet?2.5:3.8)*energy*(1-u*.65);
    S(p,'transform',`translate(${x} ${-h}) rotate(${side*age*(wet?1:7)})`);
    S(p,'d',wet?`M0 ${-size*1.7}Q${size} 0 0 ${size}Q${-size} 0 0 ${-size*1.7}Z`:`M${-size} 0L${size*.2} ${-size*.7}L${size} ${size*.5}Z`);
    S(p,'fill',e.color);S(p,'opacity',fade*(wet?.55:e.surface==='dust'?.34:.48));
   });
  });
 }
 function clear(){pending=new WeakMap();events=[];root?.remove();root=null;slots=[];}
 INK.GroundContact={settings,active,commit,armArrival,step,reset:f=>pending.delete(f),render,visible,clear,inspect:()=>({events:events.map(e=>({...e})),slots:slots.length})};
})();
