/* FLOW 05 — reusable distance/time emitters and simulation-owned emitter bank.
 * Emission ordinals advance even when quality culls a particle. Low quality is
 * therefore a subset, not a new random sequence. Teleports never draw long beams.
 */
'use strict';
(() => {
  const {clamp}=INK;
  const stats={births:0,culled:0,teleports:0,cancelled:0,instances:0};
  class DistanceEmitter {
    constructor({seed=1,spacing=16,rate=.25,burst=2,maxPerStep=24,maxDistance=280,recordStats=true}={}) {
      if(!Number.isFinite(spacing)||spacing<=0||!Number.isFinite(rate)||rate<0||rate>20||!Number.isInteger(burst)||burst<0||burst>64||!Number.isInteger(maxPerStep)||maxPerStep<1||maxPerStep>128||!Number.isFinite(maxDistance)||maxDistance<=0)throw RangeError('Invalid emitter configuration');
      this.recordStats=!!recordStats;this.seed=seed>>>0;this.spacing=spacing;this.rate=rate;this.burst=burst;this.maxPerStep=maxPerStep;this.maxDistance=maxDistance;
      this.previous=null;this.distanceCarry=0;this.timeCarry=0;this.ordinal=0;this.closed=false;
    }
    advance(point,time,{quality=1.5,enabled=true}={}) {
      if(!point?.every(Number.isFinite)||point.length!==2||!Number.isFinite(time))throw TypeError('Finite emitter point/time required');
      if(!Number.isFinite(quality)||quality<0||quality>1.5)throw RangeError('Emitter quality 0..1.5');
      if(this.closed)return [];
      const previous=this.previous;
      if(previous&&time<previous.time)throw RangeError('Emitter cannot advance backwards');
      if(previous&&time===previous.time)return [];
      const dt=previous?time-previous.time:0,dx=previous?point[0]-previous.point[0]:0,dy=previous?point[1]-previous.point[1]:0,d=Math.hypot(dx,dy);
      this.previous={point:point.slice(),time};
      if(previous&&d>this.maxDistance){this.distanceCarry=0;this.timeCarry=0;if(this.recordStats)stats.teleports++;return [];}
      const candidates=[];let candidateCount=0;
      if(!previous){candidateCount=this.burst;for(let i=0;i<this.burst;i++)candidates.push({u:1,mode:'burst'});}
      else {
        const distanceCount=Math.floor((this.distanceCarry+d+1e-8)/this.spacing);
        candidateCount+=distanceCount;for(let i=0;i<Math.min(distanceCount,this.maxPerStep);i++)candidates.push({u:d?clamp((this.spacing-this.distanceCarry+i*this.spacing)/d):1,mode:'distance'});
        this.distanceCarry=(this.distanceCarry+d)-distanceCount*this.spacing;
        const timeCount=Math.floor(this.timeCarry+dt*this.rate+1e-8);
        candidateCount+=timeCount;for(let i=0;i<Math.min(timeCount,this.maxPerStep);i++)candidates.push({u:dt*this.rate?clamp((1-this.timeCarry+i)/(dt*this.rate)):1,mode:'time'});
        this.timeCarry=this.timeCarry+dt*this.rate-timeCount;
      }
      candidates.sort((a,b)=>a.u-b.u||a.mode.localeCompare(b.mode));candidates.length=Math.min(candidates.length,this.maxPerStep);const out=[];
      for(let i=0;i<candidates.length;i++) {
        const {u,mode}=candidates[i],ordinal=this.ordinal++,seed=INK.Particles.hash(this.seed+':'+ordinal);
        if(!enabled||quality<=0||INK.Particles.random(this.seed,ordinal)>quality/1.5){if(this.recordStats)stats.culled++;continue;}
        out.push({point:previous?[previous.point[0]+dx*u,previous.point[1]+dy*u]:point.slice(),
          time:previous?previous.time+dt*u:time,velocity:dt?[dx/dt,dy/dt]:[0,0],ordinal,seed,mode});if(this.recordStats)stats.births++;
      }
      const skipped=candidateCount-candidates.length;this.ordinal+=skipped;if(this.recordStats)stats.culled+=skipped;
      return out;
    }
    close() {this.closed=true;}
  }
  function config(event,record) {
    const p=event.particles||{},off=p.count===0;
    return {spacing:p.spacing??(record.category==='normal'?32:event.type==='flame'?13:21),
      rate:off?0:p.rate??(p.count??(record.category==='normal'?6:20))/Math.max(1,event.duration),
      burst:off?0:p.burst??(record.category==='normal'?1:3),maxPerStep:24};
  }
  function makeParticle(birth,event,record,{direction=1,scale=1}={}) {
    const {random,materials}=INK.Particles,base=materials[record.character]||materials.ryu,cfg=event.particles||{};
    const rnd=i=>random(birth.seed,i),a=(event.rotation+180+(rnd(0)-.5)*(cfg.spread??75))*Math.PI/180;
    const speed=(cfg.speed??3.2)*(.35+rnd(1))*scale,inherit=cfg.inheritVelocity??.18;
    const species=cfg.species||base.species;
    return {x:birth.point[0],y:birth.point[1],birth:birth.time,life:(cfg.life??28)*(.75+rnd(2)*.25),
      vx:Math.cos(a)*speed*direction+clamp(birth.velocity[0]*inherit,-14,14),vy:Math.sin(a)*speed+clamp(birth.velocity[1]*inherit,-14,14),
      gravity:cfg.gravity??base.gravity,drag:cfg.drag??.045,size:(cfg.size??2.5)*scale*(.65+rnd(3)*.7),
      angle:rnd(4)*360,spin:(rnd(5)-.5)*(species==='petal'?8:5),color:ordinalColor(birth.ordinal,event.color,base.core),species,
      opacity:event.opacity*.8,stretch:species==='shard'||species==='spark'?3.5:1,curl:cfg.curl??0,phase:rnd(6)*Math.PI*2,
      priority:0,sizeCurve:cfg.sizeCurve,opacityCurve:cfg.opacityCurve,heat:cfg.heat??(record.character==='mai'&&species==='ember')};
  }
  function ordinalColor(ordinal,color,core){return ordinal%5===0?core:color;}
  class EmitterBank {
    constructor(pool,ribbons) {this.pool=pool;this.ribbons=ribbons;this.actors=new Map();this.nextInstance=0;this.revision=-1;this.stats={instances:0,acceptedBirths:0,poolDrops:0,cancelledActions:0,eventEdges:0};}
    cancel(index,time,reason='cancel') {
      const actor=this.actors.get(index);if(!actor)return;
      for(const state of actor.emitters.values()){state.emitter.close();this.ribbons.close(state.key,time);}
      this.actors.delete(index);stats.cancelled++;this.stats.cancelledActions++;
    }
    update(f,record,frame,time,pointAt,settings) {
      const index=f.index??f.id;let actor=this.actors.get(index);
      if(!f.attack||!record){this.cancel(index,time,'state');return;}
      if(!actor||actor.attack!==f.attack||actor.record!==record||frame<actor.frame) {
        this.cancel(index,time,'new-action');actor={attack:f.attack,record,frame:-1,worldTime:time-1,instance:++this.nextInstance,emitters:new Map(),lastEdge:0,fallbackTimeline:null};
        this.actors.set(index,actor);stats.instances++;this.stats.instances++;
      }
      const prev=actor.frame<0?Math.max(0,frame-1):actor.frame;
      const delta=Math.max(.00001,frame-prev),worldDelta=Math.max(0,time-actor.worldTime);
      // Production edges come from Runtime.tick's simulation-owned timeline.
      // A standalone bank has the same scheduler as a fallback, never render time.
      let edges=f.attack._inkEdges;
      if(!f.attack._inkTimeline){actor.fallbackTimeline??=new INK.EventTimeline(record.fx,{instance:actor.instance});edges=actor.fallbackTimeline.advance(frame);}
      const open=event=>{
        if(actor.emitters.has(event.id))return;
        const seed=INK.Particles.hash(`${record.character}:${record.key}:${actor.instance}:${event.id}`);
        actor.emitters.set(event.id,{event,key:`${index}:${actor.instance}:${event.id}`,emitter:new DistanceEmitter({...config(event,record),seed})});
      };
      // A bank first attached halfway through a move resumes active events only.
      if(actor.frame<0&&f.attack._inkTimeline)for(const event of f.attack._inkTimeline.active.values())open(event);
      for(const edge of edges||[]){if(edge.serial<=actor.lastEdge)continue;actor.lastEdge=edge.serial;this.stats.eventEdges++;
        if(edge.kind==='start')open(edge.event);
        else {const s=actor.emitters.get(edge.event.id);if(s)s.endPending=true;}
      }
      for(const [id,state]of actor.emitters) {
        const event=state.event,end=event.frame+event.duration;
        if(frame<event.frame||prev>=end){if(frame>=end){state.emitter.close();this.ribbons.close(state.key,time);actor.emitters.delete(id);}continue;}
        const start=Math.max(prev,event.frame),stop=Math.min(frame,end),samples=Math.min(8,Math.max(1,Math.ceil((stop-start)*2)));
        for(let j=state.emitter.previous?1:0;j<=samples;j++) {
          const at=start+(stop-start)*j/samples,q=pointAt(at,event.socket),stamp=time-(frame-at)/delta*worldDelta;
          const enabled=settings.enabled&&event.particles?.count!==0;
          const births=state.emitter.advance(q,stamp,{quality:settings.quality*(settings.reducedMotion?.55:1),enabled});
          for(const b of births){if(this.pool.add(makeParticle(b,event,record,{direction:f.dir,scale:f.renderScale||f.ch.scale||1})))this.stats.acceptedBirths++;else this.stats.poolDrops++;}
          if(settings.enabled&&!settings.reducedMotion&&record.category!=='normal') {
            const base=INK.Particles.materials[record.character]||INK.Particles.materials.ryu;
            this.ribbons.push(state.key,q,stamp,{birth:stamp,memory:event.trailFrames??12,life:14,width:(event.width??16)*event.scale*.9,
              opacity:event.opacity*.6,color:event.color,core:base.core,dark:base.dark,flame:event.type==='flame'});
          }
        }
        if(state.endPending||frame>=end){state.emitter.close();this.ribbons.close(state.key,time);actor.emitters.delete(id);}
      }
      actor.frame=frame;actor.worldTime=time;
    }
    clear() {for(const key of this.actors.keys())this.cancel(key,0,'reset');this.actors.clear();this.nextInstance=0;}
  }
  INK.FXEmitter={DistanceEmitter,EmitterBank,config,makeParticle,stats,version:'5.0.0'};
})();
