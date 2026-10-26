/* FLOW 08 — bounded scene feedback sampled from real evaluated poses.
 * Ground contact, afterimages and camera displacement obey the world FX clock.
 * Retained silhouette renderers never read stale legacy DOM or last f.pose.
 */
'use strict';
(() => {
 const {node,assign}=INK.SVG,{clamp}=INK;
 const Scene={version:'8.0.0',slots:[],capacity:6,stats:{captures:0,peak:0,dropped:0,groundContacts:0},
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
   assign(slot.root,'transform',`translate(${f.x} ${665+f.y}) scale(${scale}) scale(${f.dir*(p.depth||1)} 1) translate(${p.rootShift||0} ${p.floor||0}) rotate(${p.spin||0} 0 -180)`);
   slot.root.style.setProperty('--ink-echo-color',f.state==='rush'?'#6dffc0':f.ch.color);
   assign(slot.root,'display','inline');assign(slot.root,'opacity',.22*W.settings.intensity);
   slot.start=t;slot.end=t+15;slot.actor=f.index;slot.pose=INK.copy(p);slot.sockets=INK.copy(INK.Rig.sockets(p,rig));slot.clock=f._inkVisualClock;
   this.stats.captures++;this.stats.peak=Math.max(this.stats.peak,this.slots.filter(s=>s.end>t).length);return true;
  },
  render(G,alpha=1){const W=INK.VFX,visible=W.settings.enabled&&!W.settings.reducedMotion,t=G.paused||G.hitstop||W.frozen?W.time:W.time-1+clamp(alpha);
   for(const s of this.slots){const age=t-s.start,life=s.end-s.start,on=visible&&age>=0&&age<life;assign(s.root,'display',on?'inline':'none');if(on)assign(s.root,'opacity',.22*Math.pow(1-age/life,1.35)*W.settings.intensity);}
  },
  camera(){return[0,0];}, // FLOW 09: hit feedback never translates the scenery.

  clear(){for(const s of this.slots){s.renderer?.destroy();s.root.remove();}this.slots=[];},
  inspect(){return{...this.stats,capacity:this.capacity,retained:this.slots.length,active:this.slots.filter(s=>s.end>INK.VFX.time).length};}
 };
 INK.SceneFeedback=Scene;
})();
