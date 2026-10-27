/* FLOW 08 — bounded scene feedback sampled from real evaluated poses.
 * Ground contact, afterimages and camera displacement obey the world FX clock.
 * Retained silhouette renderers never read stale legacy DOM or last f.pose.
 */
'use strict';
(() => {
 const {node,assign}=INK.SVG,{clamp}=INK;
 const Scene={version:'8.0.0',slots:[],rushes:[],capacity:6,stats:{captures:0,peak:0,dropped:0,groundContacts:0},
  ground(x,color,strength,G){
   const W=INK.VFX,pool=W.mount();if(!pool)return false;
   if(!W.settings.enabled)return true;
   const s=clamp(Number.isFinite(strength)?strength:1,.2,2.5),t=W.time,reduced=W.settings.reducedMotion;
   const seed=INK.Particles.hash('ground:'+G.tick+':'+x),material={...INK.Particles.materials.luke,color,core:'#eee0cd'};
   pool.add({x,y:670,birth:t,life:reduced?10:16,vx:0,vy:0,gravity:0,size:14*s,angle:0,color,species:'ring',stretch:4.5,opacity:reduced?.2:.35,priority:2});
   if(!reduced){pool.emit({x,y:668,frame:t,seed,count:Math.round(5*s),material,angle:-90,spread:155,speed:2.2*s,life:25,size:4.8,species:'smoke',gravity:.025,opacity:.15,priority:0});
    pool.emit({x,y:669,frame:t,seed:seed+1,count:Math.round(3*s),material,angle:-90,spread:160,speed:2.8*s,life:18,size:1.6,species:'spark',gravity:.12,opacity:.42,priority:1});}
   this.stats.groundContacts++;return true;
  },
  ghost(f){
   const W=INK.VFX;if(!W.settings.enabled||W.settings.reducedMotion||!INK.Runtime.enabled)return true;
   const parent=document.getElementById('ghosts');if(!parent)return false;
   this.slots=this.slots.filter(s=>s.root.isConnected);
   const t=W.time;let slot=this.slots.find(s=>s.end<=t);
   if(!slot&&this.slots.length<this.capacity){slot={root:node('g',{'data-ink-afterimage':'true','pointer-events':'none'},parent),renderer:null,end:0};this.slots.push(slot);}
   if(!slot){this.stats.dropped++;return true;}
   const R=INK.Runtime,profile=R.profile(f.ch.id),p=SVG_FIGHTER.visualPose(f),rig=R.visualRig(f,p),ctx=INK.State.contextForFX(f);
   if(!slot.renderer||slot.character!==f.ch.id){slot.renderer?.destroy();slot.renderer=new INK.Renderer(slot.root,profile);slot.renderer.setMode('silhouette');slot.character=f.ch.id;}
   slot.renderer.render(p,{rig,frame:ctx?.frame||0,secondary:true,motion:R.presentation(f,ctx?.record,ctx?.frame||0,f.attack?.t||0),expression:['hit','tumble','down'].includes(f.state)?'hurt':'neutral'});
   const scale=f.renderScale||f.ch.scale||1;
   const framed=!!INK.VisualFrame?.get(p);
   assign(slot.root,'transform',`translate(${f.x} ${665+f.y}) scale(${scale})`+(framed?'':` scale(${f.dir*(p.depth||1)} 1) translate(${p.rootShift||0} ${p.floor||0}) rotate(${p.spin||0} 0 -180)`));
   slot.root.style.setProperty('--ink-echo-color',f.state==='rush'?'#6dffc0':f.ch.color);
   assign(slot.root,'display','inline');assign(slot.root,'opacity',.22*W.settings.intensity);
   slot.start=t;slot.end=t+15;slot.actor=f.index;slot.pose=INK.copy(p);slot.sockets=INK.copy(INK.Rig.sockets(p,rig));slot.clock=f._inkVisualClock;
   this.stats.captures++;this.stats.peak=Math.max(this.stats.peak,this.slots.filter(s=>s.end>t).length);return true;
  },
  rush(f){
   const W=INK.VFX;if(!W.settings.enabled||W.settings.reducedMotion)return;
   const parent=document.getElementById('ghosts');if(!parent)return;
   let e=this.rushes.findLast(r=>r.actor===f.index&&r.active);
   if(f.stateAge<=1&&(!e||e.birth!==W.time)){
    if(e)e.active=false;
    const root=node('g',{'data-drive-paint':'true','pointer-events':'none'},parent);
    parent.insertBefore(root,parent.firstChild);
    const bloom=node('path',{fill:'#93ff54',d:'M-10-115C-44-142-82-127-72-169L-110-161  -87-188 -124-201 -82-211 -95-248 -57-226 -45-269 -28-237 0-263 4-229 33-241 21-211 48-203 23-188 38-166 9-172Z'},root);
    const teal=node('path',{fill:'#18dfbe',d:'M25-124C-6-145-47-148-84-132L-137-154-119-128-187-118-138-104-205-80-142-84-177-57-104-79C-65-65-32-75 2-91L-39-66 17-84 40-106Z'},root);
    const lime=node('path',{fill:'#e5ff70',d:'M-3-117L-49-100-84-54-70-89-145-58-112-92-184-85-130-105-165-116-100-115-66-137Z'},root);
    const streak=node('path',{fill:'none',stroke:'#a4ffe4','stroke-linecap':'round','stroke-width':5,d:'M-30-148Q-91-163-150-152M-37-104Q-99-95-161-75M-58-62Q-115-53-163-30'},root);
    let mai=null;if(f.ch.id==='mai'){
     const layer=node('g',{'data-mai-drive':'true','pointer-events':'none'},root);root.insertBefore(layer,bloom);
     mai={layer,arcs:Array.from({length:3},(_,i)=>node('path',{fill:'none',stroke:i===1?'#eaffab':'#62ffe1','stroke-width':i===1?3:2,'stroke-linecap':'round'},layer)),drops:Array.from({length:8},(_,i)=>node('path',{fill:i%2?'#dfff8e':'#46efcb',d:'M-3 0 Q-2 -5 1 -8 L4 -1 1 3Z'},layer))};
    }
    e={root,bloom,teal,lime,streak,mai,actor:f.index,birth:W.time,x:f.x,y:f.y,dir:f.dir,scale:f.renderScale||f.ch.scale||1,active:true};this.rushes.push(e);
    while(this.rushes.length>4)this.rushes.shift().root.remove();
   }
   if(e&&e.active){e.x=f.x;e.y=f.y;e.dir=f.dir;}
  },
  render(G,alpha=1){INK.GroundContact?.render(G,alpha);INK.SuperDirector?.render(G,alpha);INK.StageLight?.render(G,alpha);INK.ProjectileFlow?.render(G,alpha);INK.Kinetic?.render(G,alpha);INK.Aerial?.render(G,globalThis.SVG_FIGHTER?.fighters||[]);const W=INK.VFX,visible=W.settings.enabled&&!W.settings.reducedMotion,t=G.paused||G.hitstop||W.frozen?W.time:W.time-1+clamp(alpha);
   for(const s of this.slots){const age=t-s.start,life=s.end-s.start,on=visible&&age>=0&&age<life;assign(s.root,'display',on?'inline':'none');if(on)assign(s.root,'opacity',.22*Math.pow(1-age/life,1.35)*W.settings.intensity);}
   for(const e of this.rushes){const age=t-e.birth,on=visible&&age>=0&&age<18;assign(e.root,'display',on?'inline':'none');if(!on)continue;
    const growth=.65+.35*clamp(age/3),fade=clamp((18-age)/9),scale=e.scale;
    assign(e.root,'transform',`translate(${e.x} ${665+e.y}) scale(${e.dir*scale} ${scale})`);assign(e.root,'opacity',fade*W.settings.intensity);
    assign(e.bloom,'transform',`scale(${growth} ${growth})`);assign(e.bloom,'opacity',.72*clamp((11-age)/6));
    assign(e.teal,'transform',`translate(${-Math.min(28,age*2)} 0) scale(${.85+Math.min(.35,age*.025)} 1)`);assign(e.teal,'opacity',.72);
    assign(e.lime,'opacity',.8*clamp((13-age)/7));assign(e.streak,'opacity',.7);
    if(e.mai){
     e.mai.arcs.forEach((p,i)=>{const y=-202+i*51,span=125+i*20+age*2;assign(p,'d',`M-18 ${y} Q${-span*.45} ${y-36+i*13} ${-span} ${y+12-i*9}`);assign(p,'opacity',.68*clamp((15-age)/8));});
     e.mai.drops.forEach((p,i)=>{const x=-43-i*19-age*(1.4+i*.08),y=-230+(i%4)*52+Math.sin(i*2+age*.2)*8;assign(p,'transform',`translate(${x} ${y}) rotate(${i*29+age*4}) scale(${.65+(i%3)*.25})`);assign(p,'opacity',.76*clamp((15-age)/8));});
    }
   }
   this.rushes=this.rushes.filter(e=>{if(t-e.birth<18)return true;e.root.remove();return false;});
  },
  camera(){return[0,0];}, // FLOW 09: hit feedback never translates the scenery.

  clear(){INK.GroundContact?.clear();for(const s of this.slots){s.renderer?.destroy();s.root.remove();}this.slots=[];for(const e of this.rushes)e.root.remove();this.rushes=[];},
  inspect(){return{...this.stats,capacity:this.capacity,retained:this.slots.length,active:this.slots.filter(s=>s.end>INK.VFX.time).length};}
 };
 INK.SceneFeedback=Scene;
})();
