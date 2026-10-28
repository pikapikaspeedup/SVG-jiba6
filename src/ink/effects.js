/* INK FLOW authored VFX: motion-sampled ribbons, ballistic particles and small
 * light cores. Reverse seek reconstructs particles from their birth frames.
 * Whiffing a move never emits a fake contact flash: live impacts are combat events.
 */
'use strict';
(() => {
  const {node,assign}=INK.SVG,{clamp,mat,rad}=INK;
  const {ParticleSystem,materials,hash,random}=INK.Particles;
  const setting={quality:1,enabled:true,intensity:1,reducedMotion:false};
  let pillarSerial=0;
  const curve=pts=>{if(pts.length<2)return '';let d='M'+pts[0].join(' ');for(let i=1;i<pts.length-1;i++){const a=pts[i],b=pts[i+1];d+=`Q${a} ${(a[0]+b[0])/2} ${(a[1]+b[1])/2}`;}return d+'L'+pts.at(-1).join(' ');};
  const offset=(pts,amount,wave=0,phase=0)=>pts.map((p,i)=>{const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy)||1,t=i/(pts.length-1),v=amount+Math.sin(t*Math.PI*3+phase)*wave*Math.sin(t*Math.PI);return[p[0]-dy/length*v,p[1]+dx/length*v];});
  const rootMat=p=>mat.multiply(mat.compose(0,0,0,p.depth||1,1),mat.multiply(mat.compose(p.rootShift||0,(p.floor||0)-180,p.spin||0),mat.compose(0,180)));
  class Effects {
    constructor(parent){this.backRoot=node('g',{'data-ink-fx':'back','pointer-events':'none'},parent);this.root=node('g',{'data-ink-fx':'flow','pointer-events':'none'},parent);this.group=this.root;this.visible=true;this.cache=new Map();this.record=null;
      this.ribbons=Array.from({length:12},()=>{const g=node('g',{},this.root);return{g,paths:Array.from({length:4},()=>node('path',{'fill':'none','stroke-linecap':'round','stroke-linejoin':'round'},g)),tongues:Array.from({length:4},()=>node('path',{display:'none',stroke:'none'},g))};});
      // Keep the previous inspector handle as a read-only compatibility alias.
      this.nodes=this.ribbons;
      this.particles=null;this.stats={active:0,historyHits:0};
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
    maiPalette(){
      if(!this.pillarPalette){
        const id='ink-mai-pillar-'+(++pillarSerial),defs=node('defs',{},this.root),linear=(name,stops)=>{const g=node('linearGradient',{id:id+'-'+name,x1:'0%',y1:'100%',x2:'0%',y2:'0%'},defs);for(const [offset,color,opacity]of stops)node('stop',{offset,'stop-color':color,'stop-opacity':opacity},g);return `url(#${id}-${name})`;};
        const halo=node('radialGradient',{id:id+'-halo'},defs);for(const [offset,color,opacity]of [['0%','#ffcd82',.48],['45%','#f17850',.18],['100%','#ef835c',0]])node('stop',{offset,'stop-color':color,'stop-opacity':opacity},halo);
        this.pillarPalette={halo:`url(#${id}-halo)`,outer:linear('outer',[['0%','#d73546',.82],['35%','#f15d47',.9],['72%','#ffad69',.72],['100%','#ffd9a1',.08]]),inner:linear('inner',[['0%','#ffb45b',.95],['40%','#ffd891',.96],['75%','#fff3d0',.82],['100%','#fff3d0',0]])};
      }
      return this.pillarPalette;
    }
    maiPillar(v,frame,age,duration){
      this.maiPalette();
      if(!v.pillar){
        const halo=node('ellipse',{'pointer-events':'none'},v.g),ground=node('ellipse',{'pointer-events':'none'},v.g);v.g.insertBefore(ground,v.paths[0]);v.g.insertBefore(halo,ground);
        const sparks=Array.from({length:7},()=>node('path',{'pointer-events':'none'},v.g));v.pillar={halo,ground,sparks};
      }
      const palette=this.pillarPalette,phase=setting.reducedMotion?0:frame*.18,wind=Math.sin(phase)*9,rise=clamp((age+1)/6),fall=clamp((duration-age)/6),growth=.38+.62*rise*fall;
      const {halo,ground,sparks}=v.pillar;
      assign(halo,'display','inline');assign(halo,'cx',0);assign(halo,'cy',-125);assign(halo,'rx',106);assign(halo,'ry',185);assign(halo,'fill',palette.halo);assign(halo,'opacity',.52*growth);
      assign(ground,'display','inline');assign(ground,'cx',0);assign(ground,'cy',5);assign(ground,'rx',58);assign(ground,'ry',12);assign(ground,'fill','none');assign(ground,'stroke','#ffd7a0');assign(ground,'stroke-width',2);assign(ground,'opacity',.54*growth);
      const shapes=[
        `M-45 8 C-68 -27 -64 -73 -39 -110 C-58 -132 -43 -183 -22 -207 C-36 -244 -14 -278 ${wind} -338 C8 -292 16 -274 16 -244 C44 -210 47 -175 35 -145 C59 -116 67 -58 45 8Z`,
        `M-29 8 C-42 -35 -35 -75 -18 -103 C-31 -134 -17 -177 -5 -193 C-8 -216 ${wind*.5+6} -254 ${wind*.7+10} -292 C23 -246 27 -209 18 -184 C37 -153 37 -115 22 -91 C40 -54 39 -20 27 8Z`,
        `M-15 8 C-26 -29 -18 -57 -7 -81 C-15 -108 -5 -134 5 -163 C13 -134 21 -110 12 -82 C25 -52 23 -19 15 8Z`,
        `M-34 -12 C-40 -51 -28 -82 -25 -90 M28 -13 C39 -51 27 -80 22 -94 M-10 -18 Q-15 -52 -7 -74`
      ];
      const fills=[palette.outer,palette.inner,palette.inner,'none'];
      v.paths.forEach((n,j)=>{assign(n,'display','inline');assign(n,'transform',`scale(1 ${growth})`);assign(n,'d',shapes[j]);assign(n,'fill',fills[j]);assign(n,'stroke',j===3?'#fff3d7':'none');assign(n,'stroke-width',j===3?1.7:0);assign(n,'stroke-dasharray','none');assign(n,'opacity',[.95,.88,.95,.65][j]);});
      v.tongues.forEach((n,j)=>{const x=(j-1.5)*26,tip=-100-j*34-(setting.reducedMotion?0:Math.sin(phase+j)*11);assign(n,'display','inline');assign(n,'transform',`translate(${x} 0) scale(1 ${growth})`);assign(n,'d',`M-8 4 Q-18 -37 -6 -76 Q0 ${tip+30} 8 ${tip} Q4 -61 13 -36 Q19 -8 9 4Z`);assign(n,'fill',j%2?palette.inner:palette.outer);assign(n,'stroke','none');assign(n,'opacity',.7);});
      sparks.forEach((n,j)=>{const t=setting.reducedMotion?j/7:((age*.047+j*.151)%1),x=(j%2?1:-1)*(26+j*5)+Math.sin(phase+j*2)*5,y=-32-t*270;assign(n,'display','inline');assign(n,'d','M0 -5 Q3 -1 0 3 Q-3 -1 0 -5Z');assign(n,'transform',`translate(${x} ${y*growth}) scale(${.55+(j%3)*.18})`);assign(n,'fill',j%2?'#fff1c4':'#ffad69');assign(n,'stroke','none');assign(n,'opacity',(.28+.5*Math.sin(Math.PI*t))*growth);});
    }
    maiStroke(v,ev,record,frame,pose,rig,move){
      const q=INK.Runtime.socket(pose,rig,ev.socket);if(!q?.slice(0,2).every(Number.isFinite))return false;
      const name=/rear/.test(ev.socket)?'rear':'front',leg=/Foot|Knee/.test(ev.socket),chain=rig[name+(leg?'Leg':'Arm')],origin=chain?.[ev.socket==='fanTip'?2:1]||[q[0]-1,q[1]],angle=Math.atan2(q[1]-origin[1],q[0]-origin[0])*180/Math.PI;
      const age=frame-ev.frame,u=clamp((age+.7)/Math.min(4,ev.duration)),fade=u*clamp((ev.duration-age)/3),phase=setting.reducedMotion?0:frame*.16,fan=ev.type==='fan',fire=ev.type==='flame',silk=ev.type==='silk',normal=record.category==='normal',power=normal?.55:record.category==='super'?2.05:1.45,enhanced=!!move?.flameEnhanced||!!move?.od,scale=(ev.scale||1)*power*(enhanced?1.15:1),palette=this.maiPalette();
      if(v.pillar){assign(v.pillar.halo,'display','none');assign(v.pillar.ground,'display','none');v.pillar.sparks.forEach(n=>assign(n,'display','none'));}
      (ev.layer==='back'?this.backRoot:this.root).appendChild(v.g);assign(v.g,'data-ink-event',ev.id);assign(v.g,'data-mai-effect',ev.type);assign(v.g,'display','inline');assign(v.g,'opacity',Math.min(.94,(ev.opacity??.65)+(normal?.12:.3))*fade);assign(v.g,'transform',`translate(${q[0]} ${q[1]}) rotate(${angle}) scale(${scale})`);
      const wave=Math.sin(phase)*5;
      const shapes=fire?[
        `M-111 8 Q-76 -4 -54 -29 Q-35 -48 -23 -72 Q-21 -41 -3 -39 Q-4 -16 20 -4 Q-11 19 -46 20 Q-79 28 -111 8Z`,
        `M-91 5 Q-57 -7 -35 -30 Q-21 -44 -16 -54 Q-14 -22 11 -5 Q-25 10 -50 12 Q-72 15 -91 5Z`,
        `M-80 6 Q-47 -3 -25 -20 Q-18 -26 -13 -36 Q-9 -17 4 -6 Q-38 5 -80 6Z`,
        `M-102 -2 Q-57 -17 -31 -43 M-76 17 Q-35 12 3 -5`
      ]:fan?[
        `M-118 25 Q-57 -62 29 -48 Q-2 -49 -30 -28 Q-69 -2 -112 31Z`,
        `M-110 21 Q-47 -48 16 -42 Q-37 -27 -105 25Z`,
        `M-94 12 Q-43 -36 3 -37 Q-47 -21 -94 12Z`,
        `M-115 29 Q-53 -57 27 -48 M-97 30 Q-35 -20 10 -27`
      ]:silk?[
        `M-122 -12 Q-67 ${-30+wave} -10 -8 Q-57 -10 -116 -4Z`,
        `M-108 14 Q-56 ${24-wave} 0 6 Q-58 17 -108 18Z`,
        `M-97 1 Q-44 ${-8+wave} -4 0`,
        `M-126 -22 Q-62 ${-38+wave} -18 -17 M-106 25 Q-48 ${29-wave} 3 12`
      ]:[
        `M-110 23 Q-44 -62 27 -40 Q-7 -43 -38 -15 Q-72 14 -107 28Z`,
        `M-99 20 Q-42 -48 12 -38 Q-44 -19 -99 20Z`,
        `M-76 11 Q-34 -32 4 -33 Q-35 -19 -76 11Z`,
        `M-111 29 Q-49 -53 25 -43 M-85 27 Q-29 -18 10 -26`
      ];
      const outer=fire?palette.outer:fan?'#e94b57':silk?'#f2c8ad':'#efb597',inner=fire?palette.inner:fan?'#ffd5a3':'#fff1d2';
      v.paths.forEach((n,j)=>{const line=j===3||silk&&j===2;assign(n,'display','inline');assign(n,'transform','');assign(n,'d',shapes[j]);assign(n,'fill',line?'none':j===0?outer:inner);assign(n,'stroke',line?'#fff1d8':'none');assign(n,'stroke-width',line?(silk?1.6:2):0);assign(n,'stroke-dasharray','none');assign(n,'opacity',[.55,.72,.9,.72][j]);});
      v.tongues.forEach((n,j)=>{const x=-75+j*22,y=(j%2?1:-1)*(17+j*4)+Math.sin(phase+j)*3;assign(n,'display',normal&&j>1?'none':'inline');assign(n,'transform',`translate(${x} ${y}) rotate(${j*31+(setting.reducedMotion?0:frame*3)})`);assign(n,'d',fire?'M-5 2 Q-6-5 1-12 Q2-4 5-1 Q4 4 0 5Z':'M-6 1 Q-3-7 3-5 Q8-1 2 5 Q-2 6-6 1Z');assign(n,'fill',j%2?'#ffe8c4':fire?'#ff9c60':'#ed8c97');assign(n,'stroke','none');assign(n,'opacity',.68);});
      return true;
    }
    renderLive(record,frame,pose,rig,move,actor=null){
      if(record?.character==='mai'&&record.clip.meta?.maiChoreography&&INK.MaiMoveFX){
        this.maiMoveFX??=new INK.MaiMoveFX(this.backRoot,this.root);
        assign(this.root,'display','inline');assign(this.backRoot,'display','inline');
        assign(this.root,'opacity',setting.intensity);assign(this.backRoot,'opacity',setting.intensity);
        this.ribbons.forEach(v=>assign(v.g,'display','none'));
        this.stats.active=this.maiMoveFX.render(record,frame,pose,rig,move,actor);return;
      }
      this.maiMoveFX?.hide();
      // Pillars are sustained authored shapes, not motion trails: a stationary
      // foot cannot supply their vertical geometry through StrikeTrace.
      const events=record?.fx?.filter(e=>(e.type==='pillar'||record.character==='mai'&&['fan','flame','silk','crescent','streak'].includes(e.type))&&frame>=e.frame&&frame<e.frame+e.duration)||[];
      assign(this.root,'display',events.length?'inline':'none');assign(this.backRoot,'display',events.length?'inline':'none');
      assign(this.root,'opacity',setting.intensity);assign(this.backRoot,'opacity',setting.intensity);
      let used=0;
      for(const ev of events){
        if(used>=this.ribbons.length)break;
        const v=this.ribbons[used],age=frame-ev.frame;
        if(ev.type!=='pillar'){if(this.maiStroke(v,ev,record,frame,pose,rig,move))used++;continue;}
        const limb=ev.socket==='rearFoot'?'rearLeg':ev.socket==='frontFoot'?'frontLeg':null,q=limb&&rig?.[limb]?.[2];if(!q?.slice(0,2).every(Number.isFinite))continue;used++;
        const fade=Math.min(1,.45+age/4,Math.max(0,(ev.duration-age)/4)),s=ev.scale||1,phase=frame*.18,wave=Math.sin(phase)*7;
        (ev.layer==='back'?this.backRoot:this.root).appendChild(v.g);
        assign(v.g,'data-ink-event',ev.id);assign(v.g,'data-mai-effect','pillar');assign(v.g,'display','inline');assign(v.g,'opacity',Math.min(1,ev.opacity+.3)*fade);assign(v.g,'transform',`translate(${q[0]} ${q[1]}) scale(${s})`);
        if(record.character==='mai'){this.maiPillar(v,frame,age,ev.duration);continue;}
        if(v.pillar){assign(v.pillar.halo,'display','none');assign(v.pillar.ground,'display','none');v.pillar.sparks.forEach(n=>assign(n,'display','none'));}
        const shapes=[
          `M-48 12 Q-66 -32 -42 -83 Q-58 -132 -19 -188 Q-24 -239 ${wave} -314 Q17 -251 28 -227 Q53 -170 35 -125 Q65 -62 48 12Z`,
          `M-32 12 Q-43 -40 -22 -83 Q-29 -122 -4 -173 Q-5 -213 ${wave*.6+8} -258 Q20 -199 23 -163 Q38 -113 23 -75 Q42 -28 30 12Z`,
          `M-17 12 Q-25 -28 -10 -67 Q-15 -101 4 -150 Q17 -105 12 -73 Q26 -32 17 12Z`,
          `M-39 5 Q-40 -43 -25 -76 M27 4 Q43 -47 23 -91`
        ],colors=[ev.color,'#ffb35e','#fff0bd','#fff6d9'];
        v.paths.forEach((n,j)=>{assign(n,'display','inline');assign(n,'transform','');assign(n,'d',shapes[j]);assign(n,'fill',j===3?'none':colors[j]);assign(n,'stroke',j===3?colors[j]:'none');assign(n,'stroke-width',j===3?2:0);assign(n,'stroke-dasharray','none');assign(n,'opacity',[.74,.82,.9,.55][j]);});
        v.tongues.forEach((n,j)=>{const x=(j-1.5)*22,tip=-120-j*34-Math.sin(phase+j)*13;assign(n,'display','inline');assign(n,'transform',`translate(${x} 0)`);assign(n,'d',`M-9 4 Q-17 -44 -5 -86 Q0 ${tip+28} 9 ${tip} Q5 -61 13 -34 Q17 -11 9 4Z`);assign(n,'fill',j%2?'#ffd080':ev.color);assign(n,'stroke','none');assign(n,'opacity',.46);});
      }
      for(let i=used;i<this.ribbons.length;i++)assign(this.ribbons[i].g,'display','none');
      this.layerOrder=null;this.stats.active=used;
    }
    render(record,frame,pose,rig,context=null){this.context=context;this.frameSamples=new Map();if(!record||!this.visible||!setting.enabled){assign(this.root,'display','none');assign(this.backRoot,'display','none');this.stats.active=0;return;}if(context?.live||record?.character==='mai'&&record.clip.meta?.maiChoreography&&INK.MaiMoveFX){this.renderLive(record,frame,pose,rig,context?.move,context?.actor);if(this.particles)for(const n of this.particles.nodes)assign(n,'display','none');return;}this.maiMoveFX?.hide();assign(this.root,'display','inline');assign(this.backRoot,'display','inline');assign(this.root,'opacity',setting.intensity);assign(this.backRoot,'opacity',setting.intensity);
      this.particles??=new ParticleSystem(this.root,{capacity:144});
      const profile=rig.profile||INK.Runtime.profile(record.character);
      if(this.record!==record||this.profileKey!==JSON.stringify([profile.id,profile.rigLengths,profile.rigRearShoulder,profile.rigFrontShoulder,profile.rigHipWidth])||this.quality!==setting.quality||this.graphKey!==JSON.stringify(this.graphOptions||INK.MotionGraph.settings)){this.record=record;this.profile=profile;this.profileKey=JSON.stringify([profile.id,profile.rigLengths,profile.rigRearShoulder,profile.rigFrontShoulder,profile.rigHipWidth]);this.quality=setting.quality;this.graphKey=JSON.stringify(this.graphOptions||INK.MotionGraph.settings);this.cache.clear();this.catalogue=null;this.clip=new (INK.CompiledClip||INK.Clip)(record.clip);}
      const inverse=mat.inverse(rootMat(pose)),contactTime=context?.fxTime??INK.VFX.time,worldContact=context?.sourceAttack&&INK.ContactFlux?.read(context.sourceAttack,contactTime),localContact=worldContact?INK.ContactFlux.local(worldContact,q=>mat.point(inverse,[(q[0]-context.x)/(context.scale*context.dir),(q[1]-665-context.y)/context.scale])):null,base=materials[record.character]||materials.ryu;let used=0,slot=0;
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
          assign(v.g,'display','inline');assign(v.g,'transform','');assign(v.g,'opacity',ev.opacity*fade);if(v.pillar){assign(v.pillar.halo,'display','none');assign(v.pillar.ground,'display','none');v.pillar.sparks.forEach(n=>assign(n,'display','none'));}v.tongues.forEach(n=>{assign(n,'display','none');assign(n,'stroke','none');});
          const materialActive=INK.MaterialFlow?.active()&&!setting.reducedMotion&&!['pillar','shock','ring'].includes(ev.type);
          if(localContact&&!materialActive)pts=INK.ContactFlux.deform(pts,localContact,contactTime);
          const d=curve(pts);v.paths.forEach((n,j)=>{assign(n,'display','inline');assign(n,'transform','');assign(n,'stroke-dasharray','none');assign(n,'fill','none');assign(n,'d',d);assign(n,'stroke',j===0?matl.dark:j===1?matl.color:matl.core);assign(n,'stroke-width',width*[2.1,1,.23,.075][j]);assign(n,'opacity',[.12,.55,.9,.9][j]);});
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
          if(materialActive){
            const layers=INK.MaterialFlow.geometry(pts.map((point,i)=>({point,time:traceFrame-tail+tail*i/(pts.length-1)})),frame,{...INK.MaterialFlow.style(record.character,ev),category:record.category,contact:localContact,contactTime,width,memory:tail+4,color:ev.color,core:matl.core});
            const paths=[...v.paths,...v.tongues];paths.forEach((n,j)=>{const layer=layers[j];assign(n,'display',layer?'inline':'none');if(!layer)return;assign(n,'transform','');assign(n,'d',layer.d);assign(n,'fill',layer.fill);assign(n,'stroke',layer.stroke||'none');assign(n,'stroke-width',layer.width);assign(n,'opacity',layer.opacity);assign(n,'stroke-dasharray',layer.dash||'none');});
          }

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
  function maiContact(pool,{x,y,frame,seed,owner,m,kind,last,dir,heading,multi}){
    if(owner?.ch?.id!=='mai'||!['hit','throw'].includes(kind)||!m||setting.reducedMotion)return;
    const special=m.category!=='normal',finish=!!m.super&&last,count=finish?8:multi?2:special?5:2;
    const petals={...materials.mai,color:'#ee939b',core:'#fff0d9'};
    pool.emit({x,y,frame,seed:seed+318,count,material:petals,direction:1,angle:heading-25,spread:115,speed:finish?4:2.5,life:finish?32:23,size:finish?3.2:2.1,species:'petal',gravity:.035,drag:.07,curl:2.1,opacity:.68,priority:1});
    if(special&&!multi)pool.emit({x,y,frame,seed:seed+319,count:finish?7:3,material:materials.mai,direction:dir,angle:-45,spread:100,speed:2.7,life:22,size:1.9,species:'ember',gravity:-.09,drag:.06,opacity:.66,priority:1});
  }
  const World={drawCaps:new Map(),pool:null,trails:null,bank:null,time:0,lastTick:-1,frozen:false,settings:setting,
    effectRecord(f,m){return INK.Runtime.record(f,m)||(f?.ch?.id==='mai'&&m?.id==='bHK'?INK.Runtime.record(f,{id:'sHK'}):null);},
    mount(){
      const el=document.getElementById('impact-fx');if(!el)return null;
      if(!this.pool||!this.pool.root.isConnected){this.pool?.destroy();this.trails?.destroy();this.trails=new INK.RibbonPool(el,{capacity:64});this.pool=new ParticleSystem(el,{capacity:320});this.bank=new INK.FXEmitter.EmitterBank(this.pool,this.trails);}
      return this.pool;
    },
    contact(G,owner,target,m,result,context){
      const F=INK.ContactFlux;if(!setting.enabled||!F?.active()||!['hit','block','parry','armor'].includes(result)||!context?.point||m.throw)return null;
      const pool=this.mount();if(!pool)return null;
      const dir=context.direction??owner.dir,source=context.projectile?null:context.sourceAttack||owner.attack;
      const score=context.impactScore,incoming=score?.incomingWorld||context.incoming||[dir,0];
      const snapshot=F.commit(source,{id:score?.contactID||[G.tick,owner.index,target.index,context.projectileID||source?.combatID||m.id,context.hitIndex??0,result].join(':'),point:context.point,incoming,responseDir:score?.normalWorld||context.response?.responseDir||[dir,0],impactScore:score,result,born:this.time,character:owner.ch.id,category:m.category,strength:score?1+score.energy:m.super?3:(m.level||1)+(m.od?.35:0),multi:(m.hits||1)>1&&!context.last,last:!!context.last,part:context.response?.part||m.contactPart||(m.pose==='kick'?'foot':'fist')});
      if(snapshot)this.trails.contact(source,snapshot,this.time);
      return snapshot;
    },
    burst(x,y,color,count=16,kind='hit',context=null,G){
      const pool=this.mount();if(!pool)return false;if(!setting.enabled)return true;
      const score=context?.impactScore,owner=context?.owner,m=context?.move,phased=INK.CombatFlow?.settings.rhythm!=='legacy'&&!!m,multi=phased&&(m?.hits||1)>1&&!context?.last,guard=['block','parry'].includes(kind),big=!!m?.super,last=!!context?.last;
      const base=guard?materials.guard:materials[owner?.ch?.id]||materials.ryu,dir=context?.direction||owner?.dir||1,seed=hash([G.tick,owner?.index,kind,m?.id,x,y].join(':')),frame=this.time;
      pool.quality=setting.quality*(setting.reducedMotion?.55:1);
      const axis=guard?score?.normalWorld:score?.forceWorld||score?.incomingWorld,heading=axis?Math.atan2(axis[1],axis[0])*180/Math.PI:dir<0?180:0,gain=score?clamp(score.energy,.3,1.5):1;
      if(kind==='throw-tech'){
        // Two separating strokes read as broken grip, without a damage flash.
        for(const sign of [-1,1])pool.add({x:x+sign*9,y,birth:frame,life:11,vx:sign*2.4,vy:-.3,gravity:0,size:21,angle:sign<0?180:0,color:'#d9f4ff',species:'shield',stretch:.7,opacity:.75,priority:4,opacityCurve:[[0,1],[.3,.8],[1,0]]});
        pool.emit({x,y,frame,seed,count:6,material:materials.guard,direction:dir,angle:0,spread:180,speed:2.8,life:12,size:1.2,species:'spark',priority:2});return true;
      }
      if(score){
        // A resolved contact has one principal owner and only its material flecks.
        const impactMaterial=kind==='armor'?{...materials.guard,color:'#d79c59',core:'#ffe0a8'}:base;
        INK.ImpactFeedback.emit(pool,{x,y,frame,G,owner,m,result:kind,last,dir,impactScore:score,incoming:context?.incoming,response:context?.response,material:impactMaterial,reduced:setting.reducedMotion});
        INK.MaterialFlow?.contact(pool,{x,y,frame,owner,m,result:kind,dir,last,impactScore:score,response:context?.response,reduced:setting.reducedMotion,G});
        maiContact(pool,{x,y,frame,seed,owner,m,kind,last,dir,heading,multi});
        return true;
      }
      if(kind==='armor'){
        const brace={...materials.guard,color:'#d79c59',core:'#ffe0a8'};
        pool.emit({x,y,frame,seed,count:8,material:brace,direction:1,angle:heading+180,spread:110,speed:3.2*gain,life:13,size:1.4,species:'spark',priority:2});
        INK.ImpactFeedback.emit(pool,{x,y,frame,G,owner,m,result:kind,last,dir,impactScore:context?.impactScore,incoming:context?.incoming,response:context?.response,material:brace,reduced:setting.reducedMotion});return true;
      }
      pool.emit({x,y,frame,seed,count:guard?8:multi?7:big?20:14,material:base,direction:1,angle:heading,spread:guard?180:105,speed:(guard?4.5:big?10:7.5)*gain,life:guard?17:27,size:guard?1.2:2,species:'spark',priority:2});
      if(!guard){
        if(!INK.MaterialFlow?.contact(pool,{x,y,frame,owner,m,result:kind,dir,last,impactScore:score,response:context?.response,reduced:setting.reducedMotion,G}))pool.emit({x,y,frame,seed:seed+1,count:multi?2:big?9:5,material:base,direction:dir,angle:-35,spread:230,speed:2.8,life:33,size:2.2,priority:1});
        if(!setting.reducedMotion&&!multi)pool.emit({x,y,frame:frame+(phased?3:0),seed:seed+2,count:3,material:{...base,color:'#c9b7a4',core:'#ede2cf'},direction:dir,angle:0,spread:170,speed:1.3,life:23,size:7,species:'smoke',opacity:.14});
        if(!phased&&owner?.ch.id==='mai'&&(m?.contactPart==='fan'||big))pool.emit({x,y,frame,seed:seed+3,count:big&&last?10:4,material:{...base,color:'#ed8d91',core:'#ffe4c8'},direction:dir,angle:-45,spread:220,speed:2.6,life:38,size:3.1,species:'petal',gravity:.035,curl:3,priority:1});
        if(!context?.impactScore)pool.add({x,y,birth:frame,life:5,vx:0,vy:0,gravity:0,size:big?28:18,angle:seed%45,color:base.core,species:'impact',stretch:1.25,opacity:INK.ContactFlux?.active()&&m&&!m.throw?.28:.88,priority:4});
      }
      if(guard)INK.MaterialFlow?.contact(pool,{x,y,frame,owner,m,result:kind,dir,last,impactScore:score,response:context?.response,reduced:setting.reducedMotion,G});
      maiContact(pool,{x,y,frame,seed,owner,m,kind,last,dir,heading,multi});
      if(phased)INK.ImpactFeedback.emit(pool,{x,y,frame,G,owner,m,result:kind,last,dir,impactScore:context?.impactScore,incoming:context?.incoming,response:context?.response,material:base,reduced:setting.reducedMotion});
      else pool.add({x,y,birth:frame,life:guard?12:9,vx:0,vy:0,gravity:0,size:guard?19:big?34:20,angle:15,color:base.core,species:'ring',stretch:.65,opacity:.55,priority:3});return true;
    },
    dust(x,G){const p=this.mount();if(!p)return false;if(!setting.enabled||setting.reducedMotion)return true;p.emit({x,y:670,frame:this.time,seed:hash('dust'+x+G.tick),count:7,material:{...materials.luke,color:'#adbcad',core:'#d1c7ae'},angle:-90,spread:150,speed:1.3,life:26,size:9,species:'smoke',gravity:-.02,opacity:.16});return true;},
    drawStrike(f,view,record,pose,world){
      record=record||this.effectRecord(f,f.attack?.m);
      if(!setting.enabled||!f.attack||!view.attack||!record){this.drawCaps.delete(f.index);return;}
      this.drawCaps.set(f.index,{source:f.attack,time:world.fxTime,rows:INK.StrikeTrace.sample(view,record,world.fxTime,{pose,world,epoch:f._inkTrail?.traceEpoch||0})});
    },
    flushStrike(f){
      const staged=f._inkTraceStaged;f._inkTraceStaged=null;
      if(!setting.enabled||staged?.time!==this.time||!staged.record)return;
      const view=Object.create(f);Object.assign(view,{attack:staged.attack,x:staged.x,y:staged.y,dir:staged.dir,renderScale:staged.scale});
      const h=f._inkTrail?.attack===staged.attack?f._inkTrail:{attack:staged.attack,socketNames:[...new Set(staged.record.fx.map(e=>e.socket))],socketHistory:new Map()};
      const traces=INK.StrikeTrace.capture(view,staged.record,this.time,h,staged);
      this.bank?.updateTrace(view,staged.record,INK.Runtime.clipFrame(staged.record,staged.attack.m,staged.age),this.time,traces,setting);
    },
    // This hook runs AFTER movement and contact. All trail history is physics
    // history, not a snapshot of whichever display frame happened to be drawn.
    captureRoots(fighters,G=globalThis.SVG_FIGHTER?.state){
      for(const f of fighters){
        // A trade can erase the attack before this post-contact hook. Preserve
        // its already captured contact-time endpoint, never a hit-body pose.
        if(f._inkTraceStaged?.attack!==f.attack)this.flushStrike(f);else f._inkTraceStaged=null;
        const a=f.attack;
        if(!a){this.drawCaps.delete(f.index);this.bank?.cancel(f.index,this.time);f._inkTrail=null;f._inkFxPrevious=null;continue;}
        const rec=this.effectRecord(f,a.m);if(!rec)continue;
        if(f._inkTrail?.attack!==a){f._inkTrail={attack:a,socketHistory:new Map(),socketNames:[...new Set(rec.fx.map(e=>e.socket))],socketUntil:0,rows:[{...(f._inkActionOrigin||{x:f.x,y:f.y,dir:f.dir,scale:f.renderScale||f.ch.scale||1.04}),t:0}]};f._inkFxPrevious=new Map();}
        const rows=f._inkTrail.rows,t=INK.Runtime.clipFrame(rec,a.m,a.t),root={t,x:f.x,y:f.y,dir:f.dir,scale:f.renderScale||f.ch.scale||1.04};
        if(rows.at(-1)?.t===t)rows[rows.length-1]=root;else rows.push(root);if(rows.length>40)rows.shift();
        if(setting.enabled){
          const traces=INK.StrikeTrace.capture(f,rec,this.time,f._inkTrail);
          this.bank?.updateTrace(f,rec,t,this.time,traces,setting);
        }else{this.bank?.cancel(f.index,this.time);f._inkTrail.socketHistory.clear();}

      }
      INK.Kinetic?.advance(fighters);
      if(!setting.enabled||!this.pool)return;
      for(const f of fighters)if(f.state==='rush'&&!setting.reducedMotion){
        INK.SceneFeedback?.rush(f);
        const x=f.x-f.dir*35,y=665+f.y,seed=hash('rush:'+this.time+':'+f.index);
        if(f.stateAge<=1){
          this.pool.add({x:f.x,y:y-20,birth:this.time,life:12,vx:0,vy:0,gravity:0,size:26,angle:0,color:materials.drive.color,species:'ring',stretch:2.2,opacity:.62,priority:1});
          this.pool.emit({x,y:y-30,frame:this.time,seed,count:12,material:materials.drive,direction:-f.dir,angle:-12,spread:110,speed:5,life:17,size:3.4,species:'shard',opacity:.7,priority:1});
        }
        if(this.time%2===0){
          this.pool.emit({x,y:y-115,frame:this.time,seed,count:6,material:materials.drive,direction:-f.dir,angle:-8,spread:55,speed:5,life:18,size:3.3,species:'shard',opacity:.72});
          this.pool.add({x:x-f.dir*18,y:y-45,birth:this.time,life:9,vx:-f.dir*2.5,vy:-.3,gravity:0,size:5,angle:0,color:materials.drive.core,species:'shard',stretch:7,opacity:.62,priority:0});
        }
      }
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
      const caps=new Map([...this.drawCaps.entries()].filter(([index,c])=>SVG_FIGHTER.fighters.find(f=>f.index===index)?.attack===c.source&&Math.abs(c.time-t)<1e-6).map(([,c])=>[c.source,c.rows]));
      this.pool.render(t);this.trails.render(t,caps);
    },
    invalidateStrike(f){
      this.bank?.cancel(f.index,this.time,'teleport');this.drawCaps.delete(f.index);f._inkTraceStaged=null;
      const h=f._inkTrail;if(h){h.traceEpoch=(h.traceEpoch||0)+1;h.traceTime=undefined;h.traceRoot=null;h.traceCurrent=new Map();h.socketHistory.clear();h.rows=[];}
    },
    clear(){this.drawCaps.clear();INK.ContactFlux?.clear();INK.SuperDirector?.clear();INK.StrikeFeel?.clear();INK.StageLight?.clear();INK.ProjectileFlow?.clear();INK.Kinetic?.clear();INK.SceneFeedback?.clear();INK.StateTransitions?.clear();INK.ImpactFeedback?.clear();this.bank?.clear();this.pool?.clear();this.trails?.clear();this.time=0;this.frozen=false;for(const f of globalThis.SVG_FIGHTER?.fighters||[]){f._inkTrail=null;f._inkTraceStaged=null;f._inkFxPrevious=null;}},
    quality(value){if(!Number.isFinite(value))throw TypeError('Finite FX quality required');setting.quality=clamp(value,.25,1.5);},
    setEnabled(value){setting.enabled=!!value;},
    get stats(){return this.pool?.stats||{active:0,peak:0,dropped:0,capacity:320};},
    get trailStats(){return this.trails?.stats||{active:0,peak:0,dropped:0,capacity:64};}
  };
  INK.Effects=Effects;INK.VFX=World;
})();
