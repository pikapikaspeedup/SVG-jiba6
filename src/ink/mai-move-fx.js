/* Mai's retained SVG fire sheets. All anchors come from the rendered body.
 * These are attack motion, not fabricated contact flashes or screen filters. */
'use strict';
(()=>{
 const {node,assign}=INK.SVG,{clamp}=INK;let serial=0;
 const angle=(a,b)=>Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI;
 const round=v=>Math.round(v*100)/100;
 const at=(c,r,ry,a)=>[c[0]+Math.cos(a)*r,c[1]+Math.sin(a)*ry];
 const line=points=>'M'+points.map(p=>p.map(round).join(' ')).join('L');
 function band(c,r,ry,a,b,width){
  const points=Array.from({length:13},(_,i)=>at(c,r,ry,a+(b-a)*i/12));
  const inside=Array.from({length:13},(_,i)=>at(c,Math.max(1,r-width),Math.max(1,ry-width*.6),b+(a-b)*i/12));
  return line(points)+'L'+inside.map(p=>p.map(round).join(' ')).join('L')+'Z';
 }
 class MaiMoveFX{
  constructor(back,front){
   this.back=node('g',{'data-mai-svg-fx':'back','pointer-events':'none'},back);
   this.front=node('g',{'data-mai-svg-fx':'front','pointer-events':'none'},front);
   this.nodes={back:Array.from({length:24},()=>node('path',{display:'none'},this.back)),front:Array.from({length:24},()=>node('path',{display:'none'},this.front))};
   this.cursor={back:0,front:0};
   const id='mai-fire-'+(++serial),defs=node('defs',{},this.front);
   const gradient=(name,stops)=>{const g=node('linearGradient',{id:id+'-'+name,x1:'0%',y1:'100%',x2:'0%',y2:'0%'},defs);for(const [offset,color,opacity]of stops)node('stop',{offset,'stop-color':color,'stop-opacity':opacity},g);return `url(#${id}-${name})`;};
   this.paint={fire:gradient('outer',[['0%','#c82b43',.2],['24%','#e9483e',.85],['62%','#ff9653',.95],['100%','#ffd58f',.05]]),
    core:gradient('core',[['0%','#ff9d50',.9],['55%','#ffd48c',.95],['100%','#fff3c8',.15]])};
  }
  supports(record){return record?.character==='mai'&&!!record.clip.meta?.maiChoreography;}
  hide(){assign(this.back,'display','none');assign(this.front,'display','none');}
  path(layer,d,fill,opacity=1,stroke='none',width=0,transform=''){
   const n=this.nodes[layer][this.cursor[layer]++];if(!n)return;
   assign(n,'display','inline');assign(n,'d',d);assign(n,'fill',fill);assign(n,'opacity',opacity);
   assign(n,'stroke',stroke);assign(n,'stroke-width',width);assign(n,'stroke-linejoin','round');
   assign(n,'stroke-linecap','round');assign(n,'transform',transform);
  }
  jet(q,heading,length,width,phase,gain=1,layer='front'){
   const tr=`translate(${q[0]} ${q[1]}) rotate(${heading})`,w=width,L=length,k=Math.sin(phase)*w*.15;
   this.path(layer,`M18 0C-8 ${-w*1.3} ${-L*.2} ${-w-k} ${-L*.39} ${-w*.7}Q${-L*.48} ${-w*2.1} ${-L*.59} ${-w*.42}Q${-L*.78} ${-w*.82} ${-L} ${-w*.12}Q${-L*.7} ${w*.2} ${-L*.52} ${w*.6}Q${-L*.35} ${w*1.8} ${-L*.22} ${w*.78}Q-12 ${w*1.25} 18 0Z`,this.paint.fire,.8*gain,'none',0,tr);
   this.path(layer,`M13 0Q${-L*.12} ${-w*.8} ${-L*.3} ${-w*.5}Q${-L*.43} ${-w*1.2} ${-L*.51} ${-w*.12}L${-L*.79} 0Q${-L*.46} ${w*.1} ${-L*.3} ${w*.55}Q-8 ${w*.7} 13 0Z`,this.paint.core,.86*gain,'none',0,tr);
   this.path(layer,`M8 0Q${-L*.18} ${-w*.23} ${-L*.48} 0Q${-L*.18} ${w*.26} 8 0Z`,'#fff2cf',.78*gain,'none',0,tr);
   this.path(layer,`M-9 ${-w*.9}Q${-L*.36} ${-w*1.3} ${-L*.7} ${-w*.4}M-14 ${w*.9}Q${-L*.38} ${w*1.15} ${-L*.79} ${w*.4}`,'none',.6*gain,'#ffe1a4',1.2,tr);
  }
  motes(q,frame,gain=1,count=5,spread=80,direction=1){
   const reduced=INK.VFX.settings.reducedMotion;
   for(let i=0;i<count;i++){
    const u=reduced?(i+.5)/count:(frame*.037+i*.193)%1,side=i%2?1:-1;
    const x=q[0]-direction*(18+u*spread),y=q[1]+side*(8+u*23)-u*30;
    this.path('front','M0-3Q3 0 0 4Q-3 0 0-3Z',i%2?'#ffd996':'#f58653',gain*(1-u)*.7,'none',0,`translate(${x} ${y}) rotate(${i*57}) scale(${.5+u*.6})`);
   }
  }
  pillar(q,frame,age,life,gain,side){
   const reduced=INK.VFX.settings.reducedMotion,wave=reduced?0:Math.sin(frame*.16+side)*7,
    grow=(.3+.7*clamp((age+1)/5))*clamp((life-age)/5),tr=`translate(${q[0]} ${q[1]+7}) scale(${gain} ${gain*grow})`;
   this.path(side<0?'back':'front',`M-52 2C-70-43-50-81-37-105C-56-136-30-182-20-207Q-33-250 ${wave}-323Q17-265 12-230C40-196 49-157 34-127C63-91 66-39 48 2Z`,this.paint.fire,.9,'none',0,tr);
   this.path(side<0?'back':'front',`M-31 2C-43-36-24-68-18-96Q-31-131-5-181Q-11-217 ${wave+10}-272Q27-219 18-189Q39-146 22-104C42-65 41-25 29 2Z`,this.paint.core,.88,'none',0,tr);
   this.path('front','M-12 2Q-27-40-6-80Q-14-107 5-151Q22-111 13-81Q29-39 14 2Z','#fff0bf',.65,'none',0,tr);
   this.path(side<0?'back':'front','M-47-15Q-57-71-31-116M33-20Q48-72 24-126M-11-30Q-17-69-5-101','none',.55,'#ffe8ba',1.3,tr);
   this.path('back',`M${q[0]-62*gain} ${q[1]+5}Q${q[0]} ${q[1]-9} ${q[0]+62*gain} ${q[1]+5}Q${q[0]} ${q[1]+18} ${q[0]-62*gain} ${q[1]+5}Z`,'#ffab65',.13*grow);
  }
  render(record,frame,pose,rig,move=null,actor=null){
   const settings=INK.VFX.settings;
   if(!this.supports(record)||!settings.enabled){this.hide();return 0;}
   this.cursor={back:0,front:0};assign(this.back,'display','inline');assign(this.front,'display','inline');
   const s=record.binding.startup,a=record.binding.active,family=record.clip.meta.maiChoreography.family,
    cast=['fan-cast','fan-double-cast','fan-follow'].includes(family),releases=record.clip.meta.maiChoreography.releases||[s],release=cast?releases.findLast(t=>t<=frame)??s:s,
    end=cast?release+5:s+a,age=frame-release,fade=frame<release||frame>=record.clip.duration?0:clamp((age+1)/2)*clamp((end+3-frame)/3),
    phase=settings.reducedMotion?0:frame*.23,boost=move?.flameEnhanced?1.2:move?.od?1.1:1,
    direction=INK.VisualFrame?.get(pose)?actor?.dir||1:1,
    q=name=>INK.Runtime.socket(pose,rig,name),hand=q('frontHand'),tip=q('fanTip'),chest=q('chest'),elbow=q('frontElbow');
   if(fade>0&&frame<end+3){
    if(family==='flame-wheel'){
     const dx=tip[0]-chest[0],dy=tip[1]-chest[1],r=clamp(Math.hypot(dx,dy),75,178),heading=Math.atan2(dy,dx),center=[chest[0],chest[1]+22];
     for(let i=0;i<6;i++){
      const b=heading-direction*i*.27,e=b-direction*.45,layer=Math.sin((b+e)/2)>0?'front':'back';
      this.path(layer,band(center,r+12,52*boost,e,b,19*boost),this.paint.fire,fade*(.8-i*.075));
      if(i<3)this.path(layer,band(center,r+8,48*boost,e+direction*.08,b,5),'#ffe4a9',fade*(.75-i*.12));
     }
     this.jet(tip,angle(chest,tip),78,14,phase,fade*.8);this.motes(tip,frame,fade,4,65,direction);
    }else if(family==='rising-backflip'){
     const foot=q('frontFoot'),knee=q('frontKnee');
     this.jet(foot,angle(knee,foot),130*boost,22*boost,phase,fade);
     this.path('back',line([q('rearFoot'),q('rearKnee'),q('pelvis')]),'none',fade*.35,'#ffd19a',2.2);
     this.motes(foot,frame,fade,5,75,direction);
    }else if(['elbow-comet','super-elbow-comet','diagonal-body-dive'].includes(family)){
     const superMove=family==='super-elbow-comet',dive=family==='diagonal-body-dive';
     const airborne=dive||superMove&&actor?.y<0,heading=airborne?Math.atan2(actor?.vy??9,direction*Math.max(2,Math.abs(actor?.vx??10)))*180/Math.PI:direction<0?180:0;
     this.jet(elbow,heading,(superMove?245:dive?162:185)*boost,(superMove?36:24)*boost,phase,fade);
     const hip=q('pelvis'),tail=q('rearFoot');
     this.path('back',`M${tail}Q${hip[0]-direction*60} ${hip[1]-35} ${elbow[0]-direction*22} ${elbow[1]-24}`,'none',fade*.5,'#ffe3be',superMove?2.1:1.4);
     this.motes(elbow,frame,fade,superMove?7:4,superMove?190:120,direction);
    }else if(family==='flame-pillars'){
     this.pillar(q('rearFoot'),frame,age,a,boost*.9,-1);
     this.pillar(q('frontFoot'),frame+3,Math.max(0,age-2),a,boost*.85,1);
     this.motes([chest[0]+direction*45,chest[1]-20],frame,fade,6,100,direction);
    }else if(family.startsWith('sakura-')){
     const u=clamp(age/a),beat=Math.min(7,Math.floor(u*8)),pulse=1-clamp((u*8-beat)/.95),r=clamp(Math.hypot(tip[0]-chest[0],tip[1]-chest[1]),70,170),h=Math.atan2(tip[1]-chest[1],tip[0]-chest[0]);
     this.path(beat%2?'back':'front',band(chest,r+18,83,h-direction*1.6,h+direction*.12,14),'#f58968',fade*pulse*.53);
     this.path('front',band(chest,r+11,78,h-direction*1.45,h+direction*.08,3),'#ffe4b9',fade*pulse*.9);
     if(beat===7){this.jet(tip,angle(chest,tip),150,25,phase,fade);this.motes(tip,frame,fade,7,120,direction);}
     else this.motes(tip,frame,fade*pulse,3,55,direction);
    }else if(cast){
     const u=clamp(age/5),reach=50+u*90;
     this.path('back',`M${hand[0]-direction*10} ${hand[1]-15}Q${hand[0]+direction*40} ${hand[1]-27} ${hand[0]+direction*reach} ${hand[1]-9}M${hand[0]-direction*3} ${hand[1]+12}Q${hand[0]+direction*55} ${hand[1]+23} ${hand[0]+direction*(reach-12)} ${hand[1]+8}`,'none',fade*(1-u)*.65,'#ffe9ca',1.4);
    }else if(record.category==='normal'||record.category==='unique'||record.category==='branch'){
     const kick=family==='kick',endPoint=kick?q('frontFoot'):family==='elbow'?elbow:tip,origin=kick?q('frontKnee'):hand,r=clamp(Math.hypot(endPoint[0]-origin[0],endPoint[1]-origin[1]),20,76),h=Math.atan2(endPoint[1]-origin[1],endPoint[0]-origin[0]);
     this.path('front',band(origin,r+8,r*.68,h-direction*.7,h+direction*.18,2.2),'#f6e0c3',fade*.36);
    }else if(family==='air-throw-wrap'){
     const hip=q('pelvis'),foot=q('rearFoot');this.path('back',`M${foot}Q${hip[0]-direction*70} ${hip[1]-40} ${chest[0]-direction*20} ${chest[1]-42}`,'none',fade*.3,'#f8dfc4',1.4);
    }
   }
   for(const layer of ['back','front'])for(let i=this.cursor[layer];i<this.nodes[layer].length;i++)assign(this.nodes[layer][i],'display','none');
   this.active=this.cursor.back+this.cursor.front;return this.active;
  }
 }
 INK.MaiMoveFX=MaiMoveFX;
})();
