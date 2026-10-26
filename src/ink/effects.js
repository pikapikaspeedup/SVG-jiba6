/* INK FLOW authored VFX: motion-sampled ribbons, ballistic particles and small
 * light cores. Reverse seek reconstructs particles from their birth frames.
 * Whiffing a move never emits a fake contact flash: live impacts are combat events.
 */
'use strict';
(() => {
  const {node,assign}=INK.SVG,{clamp,mat,rad}=INK;
  const {ParticleSystem,materials,hash,random}=INK.Particles;
  const setting={quality:1,enabled:true,intensity:1,reducedMotion:false};
  const curve=pts=>{if(pts.length<2)return '';let d='M'+pts[0].join(' ');for(let i=1;i<pts.length-1;i++){const a=pts[i],b=pts[i+1];d+=`Q${a} ${(a[0]+b[0])/2} ${(a[1]+b[1])/2}`;}return d+'L'+pts.at(-1).join(' ');};
  const offset=(pts,amount,wave=0,phase=0)=>pts.map((p,i)=>{const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy)||1,t=i/(pts.length-1),v=amount+Math.sin(t*Math.PI*3+phase)*wave*Math.sin(t*Math.PI);return[p[0]-dy/length*v,p[1]+dx/length*v];});
  const rootMat=p=>mat.multiply(mat.compose(0,0,0,p.depth||1,1),mat.multiply(mat.compose(p.rootShift||0,(p.floor||0)-180,p.spin||0),mat.compose(0,180)));
  class Effects {
    constructor(parent){this.backRoot=node('g',{'data-ink-fx':'back','pointer-events':'none'},parent);this.root=node('g',{'data-ink-fx':'flow','pointer-events':'none'},parent);this.group=this.root;this.visible=true;this.cache=new Map();this.record=null;
      this.ribbons=Array.from({length:12},()=>{const g=node('g',{},this.root);return{g,paths:Array.from({length:4},()=>node('path',{'fill':'none','stroke-linecap':'round','stroke-linejoin':'round'},g)),tongues:Array.from({length:4},()=>node('path',{display:'none',stroke:'none'},g))};});
      // Keep the previous inspector handle as a read-only compatibility alias.
      this.nodes=this.ribbons;
      this.particles=new ParticleSystem(this.root,{capacity:144});this.stats={active:0,historyHits:0};
    }
    births(record,event,profile){
      this.catalogue??=new Map();if(this.catalogue.has(event.id))return this.catalogue.get(event.id);
      const seed=hash(record.character+record.key+event.id),emitter=new INK.FXEmitter.DistanceEmitter({...INK.FXEmitter.config(event,record),seed,recordStats:false}),out=[];
      const end=Math.min(record.clip.duration,event.frame+event.duration);
      for(let t=event.frame;t<=end+1e-7;t=Math.min(end,t+.5)){
        const p=INK.MotionGraph.compose(record,t,this.clip.sample(t),profile,null,this.graphOptions||INK.MotionGraph.settings),rig=INK.Rig.solveAnimation(profile,p);
        const point=mat.point(rootMat(p),INK.Runtime.socket(p,rig,event.socket));
        out.push(...emitter.advance(point,t,{quality:1.5,enabled:event.particles?.count!==0}));
        if(t===end)break;
      }
      this.catalogue.set(event.id,{seed,births:out});return this.catalogue.get(event.id);
    }
    point(record,t,socket,profile,currentInverse){
      t=clamp(t,0,record.clip.duration);
      // Live world-space sockets are owned by simulation. Do not reconstruct
      // previous poses using today's blend/landing state or current renderer.
      const points=this.context?.socketHistory?.get(socket);
      if(points?.length&&t>=points[0].t-1e-7&&t<=points.at(-1).t+1e-7){
        let low=0,high=points.length-1;while(high-low>1){const m=(low+high)>>1;if(points[m].t<=t)low=m;else high=m;}
        const a=points[low],b=points[high],u=b.t===a.t?0:clamp((t-a.t)/(b.t-a.t)),x=a.x+(b.x-a.x)*u,y=a.y+(b.y-a.y)*u,c=this.context;
        this.stats.historyHits++;return mat.point(currentInverse,[(x-c.x)/(c.scale*c.dir),(y-665-c.y)/c.scale]);
      }
      const lo=Math.floor(t*4)/4,hi=Math.min(record.clip.duration,lo+.25),u=(t-lo)/.25;
      const at=time=>{const key=time+'|'+socket;let q=this.context?.history?null:this.cache.get(key);if(!q){let evaluated=this.frameSamples?.get(time);if(!evaluated){const context=this.context?.history?{...INK.MotionGraph.rootAt(this.context,time),history:this.context.history,origin:this.context.origin}:null,p=INK.MotionGraph.compose(record,time,this.clip.sample(time),profile,context,this.graphOptions||INK.MotionGraph.settings);evaluated={p,r:INK.Rig.solveAnimation(profile,p),matrix:rootMat(p)};this.frameSamples?.set(time,evaluated);}q=mat.point(evaluated.matrix,INK.Runtime.socket(evaluated.p,evaluated.r,socket));if(!this.context?.history)this.cache.set(key,q);if(this.cache.size>2048)this.cache.delete(this.cache.keys().next().value);}return q;};
      const a=at(lo),b=at(hi),q=[a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u];let result=q;
      const context=this.context,rows=context?.history;
      if(rows?.length){let l=rows[0],h=l;for(let i=1;i<rows.length;i++){h=rows[i];if(h.t>=t)break;l=h;}
        const u=l.t===h.t?0:clamp((t-l.t)/(h.t-l.t)),x=l.x+(h.x-l.x)*u,y=l.y+(h.y-l.y)*u,scale=(l.scale??context.scale)+((h.scale??context.scale)-(l.scale??context.scale))*u,dir=(u<1?l.dir:h.dir)??context.dir;
        result=[(q[0]*scale*dir+x-context.x)/(context.scale*context.dir),(q[1]*scale+y-context.y)/context.scale];
      }return mat.point(currentInverse,result);
    }
    render(record,frame,pose,rig,context=null){this.context=context;this.frameSamples=new Map();if(!record||!this.visible||!setting.enabled){assign(this.root,'display','none');assign(this.backRoot,'display','none');this.stats.active=0;return;}assign(this.root,'display','inline');assign(this.backRoot,'display','inline');assign(this.root,'opacity',setting.intensity);assign(this.backRoot,'opacity',setting.intensity);
      const profile=rig.profile||INK.Runtime.profile(record.character);
      if(this.record!==record||this.profileKey!==JSON.stringify([profile.id,profile.rigLengths,profile.rigRearShoulder,profile.rigFrontShoulder,profile.rigHipWidth])||this.quality!==setting.quality||this.graphKey!==JSON.stringify(this.graphOptions||INK.MotionGraph.settings)){this.record=record;this.profile=profile;this.profileKey=JSON.stringify([profile.id,profile.rigLengths,profile.rigRearShoulder,profile.rigFrontShoulder,profile.rigHipWidth]);this.quality=setting.quality;this.graphKey=JSON.stringify(this.graphOptions||INK.MotionGraph.settings);this.cache.clear();this.catalogue=null;this.clip=new (INK.CompiledClip||INK.Clip)(record.clip);}
      const inverse=mat.inverse(rootMat(pose)),base=materials[record.character]||materials.ryu;let used=0,slot=0;
      for(const ev of record.fx){const age=frame-ev.frame,life=ev.particles?.life??28;if(age<0||age>ev.duration+life)continue;
        const matl={...base,color:ev.color},active=age<ev.duration+4,traceFrame=Math.min(frame,ev.frame+ev.duration),seed=hash(record.character+record.key+ev.id),config=ev.particles||{},isBeam=['wave','shock','streak'].includes(ev.type),isFire=['flame','pillar'].includes(ev.type),scale=ev.scale;
                if(active&&used<this.ribbons.length){const v=this.ribbons[used++],tail=ev.trailFrames??(record.category==='normal'?4:9);let pts=[];v.layer=ev.layer||'front';
          for(let i=0;i<13;i++){const at=Math.max(0,ev.frame-6,traceFrame-tail+tail*i/12);pts.push(this.point(record,at,ev.socket,profile,inverse));}
          pts=INK.Motion.resample(pts,17);const q=age>=ev.duration?pts.at(-1):INK.Runtime.socket(pose,rig,ev.socket),turn=rad(ev.rotation),len=Math.min(100,Math.hypot(pts[0][0]-pts.at(-1)[0],pts[0][1]-pts.at(-1)[1]));
          if(len<12){pts.length=0;for(let i=0;i<13;i++){const t=i/12,l=(1-t)*(isBeam?134:90)*scale;pts.push([q[0]-Math.cos(turn)*l+Math.sin(turn)*Math.sin(t*Math.PI)*12,q[1]-Math.sin(turn)*l-Math.cos(turn)*Math.sin(t*Math.PI)*12]);}}
          if(isFire&&record.clip.meta?.kind==='upper'){
            const joint=ev.socket==='frontFoot'?'frontKnee':ev.socket==='rearFoot'?'rearKnee':ev.socket==='rearHand'?'rearElbow':'frontElbow',pivot=INK.Runtime.socket(pose,rig,joint),dx=q[0]-pivot[0],dy=q[1]-pivot[1];
            pts.length=0;for(let i=0;i<13;i++){const t=i/12;pts.push([pivot[0]+dx*t*1.13,pivot[1]+dy*t*1.13]);}
          }
          const fade=Math.min(1,age/2+.3)*clamp((ev.duration+4-age)/4),width=(ev.width??(record.category==='normal'?3:isFire?22:ev.type==='crescent'?15:11))*scale;
          assign(v.g,'display','inline');assign(v.g,'opacity',ev.opacity*fade);v.tongues.forEach(n=>assign(n,'display','none'));
          const d=curve(pts);v.paths.forEach((n,j)=>{assign(n,'fill','none');assign(n,'d',d);assign(n,'stroke',j===0?matl.dark:j===1?matl.color:matl.core);assign(n,'stroke-width',width*[2.1,1,.23,.075][j]);assign(n,'opacity',[.12,.55,.9,.9][j]);});
          // Material-specific silhouettes, not one recolored ring.
          if(['flame','wave','crescent','fan'].includes(ev.type)){
            const n=v.paths[0],hot=ev.type==='flame';assign(n,'d',INK.RibbonGeometry.sweep(pts,{width:width*(hot?1.9:2.1),wave:hot?.12:0,age:frame}).body);assign(n,'fill',ev.color);assign(n,'stroke','none');assign(n,'opacity',hot?.6:.38);
            assign(v.paths[1],'d',INK.RibbonGeometry.sweep(pts,{width:width*(hot?.64:.26),age:frame}).body);assign(v.paths[1],'fill',matl.core);assign(v.paths[1],'stroke','none');assign(v.paths[1],'opacity',.75);
            assign(v.paths[2],'d',curve(offset(pts,width*.9,hot?4:1,frame*.13)));assign(v.paths[2],'stroke-width',1.2);assign(v.paths[2],'opacity',.55);
          }
          if(isFire){
            // Small flame tongues roll around the actual striking extremity.
            // Their phase is analytic: subframes and backwards scrubbing agree.
            const end=pts.at(-1),prev=pts[Math.max(0,pts.length-5)],dx=end[0]-prev[0],dy=end[1]-prev[1],motion=Math.hypot(dx,dy),theta=(motion>3?Math.atan2(dy,dx):turn)+Math.PI;
            v.tongues.forEach((n,j)=>{const phase=frame*.32+j*1.7,off=(j-1.5)*6*scale,L=(24+Math.sin(phase)*7+(j===1?12:0))*scale,w=(j===1?5:3.5)*scale;assign(n,'display','inline');assign(n,'transform',`translate(${q[0]} ${q[1]}) rotate(${theta*180/Math.PI})`);assign(n,'d',`M-5 ${off-w}Q${L*.45} ${off-w*2} ${L} ${off+Math.sin(phase)*6}Q${L*.55} ${off+w*3} 0 ${off+w}Z`);assign(n,'fill',j===1?matl.core:ev.color);assign(n,'opacity',j===1?.8:.62);});
          }
          if(ev.type==='silk')v.paths.forEach((n,j)=>{assign(n,'d',curve(offset(pts,(j-1.5)*5,7,frame*.08+j)));assign(n,'stroke-width',j===1?4:1.7);assign(n,'opacity',j===1?.95:.65);});
          if(ev.type==='spiral')v.paths.forEach((n,j)=>{assign(n,'d',curve(offset(pts,0,22*scale,frame*.19+j*Math.PI/2)));assign(n,'stroke-width',j===1?4.5:1.9);assign(n,'opacity',j===1?.92:.48);});
          if(ev.type==='claw')v.paths.forEach((n,j)=>{assign(n,'d',curve(offset(pts,(j-1)*8,2,frame*.12)));assign(n,'stroke-width',j===3?1.0:3.4);assign(n,'opacity',j===3?.3:.75);});
          if(ev.type==='shock'){const s=24+Math.sin(age*.6)*4;v.paths.forEach((n,j)=>{const x=q[0]+j*5,r=s+j*7;assign(n,'d',`M${x-6} ${q[1]-r}Q${x+r*.8} ${q[1]} ${x-6} ${q[1]+r}`);assign(n,'stroke-width',j===1?3:1);assign(n,'opacity',.65-j*.12);});}
          if(ev.type==='pillar'){v.paths.forEach((n,j)=>{const x=q[0]+(j-1.5)*13;assign(n,'d',`M${x-24} ${q[1]+23}Q${x+40} ${q[1]-95} ${x-8} ${q[1]-190}Q${x+28} ${q[1]-260} ${x-5} ${q[1]-338}`);assign(n,'stroke-width',(j===0?28:11)*scale);});}
          if(ev.type==='ring'){v.paths.forEach((n,j)=>{const r=(25+age*1.3+j*6)*scale;assign(n,'d',`M${q[0]+r} ${q[1]}A${r} ${r} 0 1 0 ${q[0]-r} ${q[1]}A${r} ${r} 0 1 0 ${q[0]+r} ${q[1]}`);assign(n,'stroke-width',j===1?2:.8);});}
        }
        // Detached particles are owned by the world bank in battle. In an
        // editor/preview, reconstruct the same emitter kernel at 120 Hz.
        if(!context?.history){const catalog=this.births(record,ev,profile);
          for(const b of catalog.births){
            if(slot>=this.particles.capacity)break;
            if(random(catalog.seed,b.ordinal)>setting.quality/1.5*(setting.reducedMotion?.55:1))continue;
            const age=frame-b.time;if(age<0||age>=life)continue;
            const particle=INK.FXEmitter.makeParticle(b,ev,record,{scale}),q=this.point(record,b.time,ev.socket,profile,inverse),z=mat.point(inverse,[0,0]);
            const vel=mat.point(inverse,[particle.vx,particle.vy]),gravity=mat.point(inverse,[0,particle.gravity]),curl=mat.point(inverse,[particle.curl||0,0]);
            Object.assign(particle,{x:q[0],y:q[1],vx:vel[0]-z[0],vy:vel[1]-z[1],gravityX:gravity[0]-z[0],gravity:gravity[1]-z[1],curlX:curl[0]-z[0],curlY:curl[1]-z[1],angle:particle.angle-Math.atan2(rootMat(pose)[1],rootMat(pose)[0])*180/Math.PI});
            if(this.particles.draw(slot,particle,frame))slot++;
          }
        }
      }
      const order=this.ribbons.map((v,i)=>i<used?v.layer:'front').join('|');if(order!==this.layerOrder){this.layerOrder=order;for(let i=0;i<this.ribbons.length;i++){const v=this.ribbons[i],back=i<used&&v.layer==='back';if(back)this.backRoot.appendChild(v.g);else this.root.insertBefore(v.g,this.particles.root);}}
      for(let i=used;i<this.ribbons.length;i++)assign(this.ribbons[i].g,'display','none');
      for(let i=slot;i<this.particles.capacity;i++)assign(this.particles.nodes[i],'display','none');this.stats.active=slot;
    }
    destroy(){this.root.remove();this.backRoot.remove();this.cache.clear();}
  }
  const World={pool:null,trails:null,bank:null,time:0,lastTick:-1,frozen:false,settings:setting,
    mount(){
      const el=document.getElementById('impact-fx');if(!el)return null;
      if(!this.pool||!this.pool.root.isConnected){this.pool?.destroy();this.trails?.destroy();this.trails=new INK.RibbonPool(el,{capacity:64});this.pool=new ParticleSystem(el,{capacity:320});this.bank=new INK.FXEmitter.EmitterBank(this.pool,this.trails);}
      return this.pool;
    },
    burst(x,y,color,count=16,kind='hit',context=null,G){
      const pool=this.mount();if(!pool)return false;if(!setting.enabled)return true;
      const owner=context?.owner,m=context?.move,phased=INK.CombatFlow?.settings.rhythm!=='legacy'&&!!m,multi=phased&&(m?.hits||1)>1&&!context?.last,guard=['block','parry'].includes(kind),big=!!m?.super,last=!!context?.last;
      const base=guard?materials.guard:materials[owner?.ch?.id]||materials.ryu,dir=context?.direction||owner?.dir||1,seed=hash([G.tick,owner?.index,kind,m?.id,x,y].join(':')),frame=this.time;
      pool.quality=setting.quality*(setting.reducedMotion?.55:1);
      pool.emit({x,y,frame,seed,count:guard?8:multi?7:big?20:14,material:base,direction:dir,angle:-12,spread:guard?220:155,speed:guard?4.5:big?10:7.5,life:guard?17:27,size:guard?1.2:2,species:'spark',priority:2});
      if(!guard){
        pool.emit({x,y,frame,seed:seed+1,count:multi?2:big?9:5,material:base,direction:dir,angle:-35,spread:230,speed:2.8,life:33,size:2.2,priority:1});
        if(!setting.reducedMotion&&!multi)pool.emit({x,y,frame:frame+(phased?3:0),seed:seed+2,count:3,material:{...base,color:'#c9b7a4',core:'#ede2cf'},direction:dir,angle:0,spread:170,speed:1.3,life:23,size:7,species:'smoke',opacity:.14});
        if(!phased&&owner?.ch.id==='mai'&&(m?.contactPart==='fan'||big))pool.emit({x,y,frame,seed:seed+3,count:big&&last?10:4,material:{...base,color:'#ed8d91',core:'#ffe4c8'},direction:dir,angle:-45,spread:220,speed:2.6,life:38,size:3.1,species:'petal',gravity:.035,curl:3,priority:1});
        pool.add({x,y,birth:frame,life:5,vx:0,vy:0,gravity:0,size:big?28:18,angle:seed%45,color:base.core,species:'impact',stretch:1.25,opacity:.88,priority:4});
      }
      if(phased)INK.ImpactFeedback.emit(pool,{x,y,frame,G,owner,m,result:kind,last,dir,material:base,reduced:setting.reducedMotion});
      else pool.add({x,y,birth:frame,life:guard?12:9,vx:0,vy:0,gravity:0,size:guard?19:big?34:20,angle:15,color:base.core,species:'ring',stretch:.65,opacity:.55,priority:3});return true;
    },
    dust(x,G){const p=this.mount();if(!p)return false;if(!setting.enabled||setting.reducedMotion)return true;p.emit({x,y:670,frame:this.time,seed:hash('dust'+x+G.tick),count:7,material:{...materials.luke,color:'#adbcad',core:'#d1c7ae'},angle:-90,spread:150,speed:1.3,life:26,size:9,species:'smoke',gravity:-.02,opacity:.16});return true;},
    // This hook runs AFTER movement and contact. All trail history is physics
    // history, not a snapshot of whichever display frame happened to be drawn.
    captureRoots(fighters,G=globalThis.SVG_FIGHTER?.state){
      for(const f of fighters){
        const a=f.attack;
        if(!a){this.bank?.cancel(f.index,this.time);f._inkTrail=null;f._inkFxPrevious=null;continue;}
        const rec=INK.Runtime.record(f,a.m);if(!rec)continue;
        if(f._inkTrail?.attack!==a){f._inkTrail={attack:a,socketHistory:new Map(),socketNames:[...new Set(rec.fx.map(e=>e.socket))],socketUntil:0,rows:[{...(f._inkActionOrigin||{x:f.x,y:f.y,dir:f.dir,scale:f.renderScale||f.ch.scale||1.04}),t:0}]};f._inkFxPrevious=new Map();}
        const rows=f._inkTrail.rows,t=INK.Runtime.clipFrame(rec,a.m,a.t),root={t,x:f.x,y:f.y,dir:f.dir,scale:f.renderScale||f.ch.scale||1.04};
        if(rows.at(-1)?.t===t)rows[rows.length-1]=root;else rows.push(root);if(rows.length>40)rows.shift();
        const poseCache=new Map(),pointAt=(at,name)=>{
          let sample=poseCache.get(at);
          if(!sample){const r=INK.MotionGraph.rootAt({history:rows,origin:f._inkActionOrigin},at);sample=INK.Runtime.visualSample(f,rec,at,r);sample.root=r;poseCache.set(at,sample);}
          const r=sample.root,q=INK.Runtime.socket(sample.pose,sample.rig,name);
          return INK.Rig.world(sample.pose,q,{x:r.x,y:665+r.y,scale:r.scale,facing:r.dir});
        };
        if(setting.enabled&&f._inkTrail.socketNames.length){
          const h=f._inkTrail,previous=h.socketHistory.size?Math.max(h.socketUntil,t-24):Math.max(0,t-18);
          const times=[];if(!h.socketHistory.size)times.push(previous);
          for(let at=Math.floor(previous*2+1e-7)/2+.5;at<=t+1e-7;at+=.5)times.push(Math.min(at,t));
          if(!times.length||Math.abs(times.at(-1)-t)>1e-7)times.push(t);
          for(const at of times)for(const name of h.socketNames){const q=pointAt(at,name);let list=h.socketHistory.get(name);if(!list){list=[];h.socketHistory.set(name,list);}
            const entry={t:at,x:q[0],y:q[1]};if(list.at(-1)?.t===at)list[list.length-1]=entry;else list.push(entry);if(list.length>96)list.shift();
          }
          h.socketUntil=t;
        }else if(!setting.enabled){f._inkTrail.socketHistory.clear();f._inkTrail.socketUntil=t;}
        this.bank?.update(f,rec,t,this.time,pointAt,setting);
      }
      if(!setting.enabled||!this.pool)return;
      if(this.time%2===0)for(const f of fighters)if(f.state==='rush')this.pool.emit({x:f.x-f.dir*30,y:665+f.y-80,frame:this.time,seed:hash('rush'+this.time+f.index),count:5,material:materials.drive,direction:-f.dir,angle:-15,spread:95,speed:4,life:24,size:2.6});
      if(this.time%3===0)for(const shot of G?.shots||[]){if(shot.life<=0)continue;this.pool.emit({x:shot.x-25*(shot.dir||1),y:shot.y,frame:this.time,seed:hash('shot'+this.time+shot.owner.index),count:2,material:materials[shot.owner.ch.id],direction:-(shot.dir||1),angle:0,spread:40,speed:2,life:17,size:2});}
    },
    step(G,fighters){
      const pool=this.mount();if(!pool)return;this.lastTick=G.tick;
      this.frozen=!!G.hitstop||!!(G.slow>0&&G.tick%2===0);
      if(!this.frozen)this.time++;
      pool.step(this.time);this.trails.step(this.time);pool.quality=setting.quality*(setting.reducedMotion?.55:1);
    },
    render(G,alpha){INK.SceneFeedback?.render(G,alpha);if(!this.pool)return;
      const visible=setting.enabled?'inline':'none';assign(this.pool.root,'display',visible);assign(this.trails.root,'display',visible);if(!setting.enabled)return;
      assign(this.pool.root,'opacity',setting.intensity);assign(this.trails.root,'opacity',setting.intensity);
      const t=G.paused||G.hitstop||this.frozen?this.time:this.time-1+clamp(alpha);
      this.pool.render(t);this.trails.render(t);
    },
    clear(){INK.SceneFeedback?.clear();INK.StateTransitions?.clear();INK.ImpactFeedback?.clear();this.bank?.clear();this.pool?.clear();this.trails?.clear();this.time=0;this.frozen=false;for(const f of globalThis.SVG_FIGHTER?.fighters||[]){f._inkTrail=null;f._inkFxPrevious=null;}},
    quality(value){if(!Number.isFinite(value))throw TypeError('Finite FX quality required');setting.quality=clamp(value,.25,1.5);},
    setEnabled(value){setting.enabled=!!value;},
    get stats(){return this.pool?.stats||{active:0,peak:0,dropped:0,capacity:320};},
    get trailStats(){return this.trails?.stats||{active:0,peak:0,dropped:0,capacity:64};}
  };
  INK.Effects=Effects;INK.VFX=World;
})();
