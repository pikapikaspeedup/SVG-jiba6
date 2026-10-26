/* FLOW 05 — shared, arc-length swept-ribbon geometry.
 * Fixed-width tangent-normal offsets avoid unbounded joins on reversals. Duplicate samples,
 * zero speed, opposing normals and teleports have explicit finite behavior.
 */
'use strict';
(() => {
  const {clamp}=INK;
  function sweep(points,{width=12,samples=24,taper=.8,age=0,wave=0}={}) {
    if(!Number.isFinite(width)||width<=0||!Number.isFinite(age)||!Number.isFinite(wave))throw RangeError('Finite positive ribbon width required');
    if(!Array.isArray(points)||points.length<2)return {body:'',core:'',points:[],length:0};
    const clean=[];
    for(const p of points) {
      if(!Array.isArray(p)||p.length<2||!Number.isFinite(p[0])||!Number.isFinite(p[1]))throw TypeError('Finite 2D ribbon points required');
      if(!clean.length||Math.hypot(p[0]-clean.at(-1)[0],p[1]-clean.at(-1)[1])>.02)clean.push(p.slice(0,2));
    }
    if(clean.length<2)return {body:'',core:'',points:clean,length:0};
    const pts=INK.Motion.resample(clean,Math.max(3,Math.min(64,Math.round(samples)))),a=[],b=[];
    let lastNormal=[0,1],length=0;
    for(let i=0;i<pts.length;i++) {
      if(i)length+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);
      const prev=pts[Math.max(0,i-1)],next=pts[Math.min(pts.length-1,i+1)],dx=next[0]-prev[0],dy=next[1]-prev[1],len=Math.hypot(dx,dy);
      let nx=len>.001?-dy/len:lastNormal[0],ny=len>.001?dx/len:lastNormal[1];
      if(i&&nx*lastNormal[0]+ny*lastNormal[1]<0){nx=-nx;ny=-ny;}lastNormal=[nx,ny];
      const u=i/(pts.length-1),envelope=Math.pow(Math.sin(Math.PI*(.02+u*.95)),taper);
      const half=width*.5*envelope*(1+wave*Math.sin(u*17-age*.38)),p=pts[i];
      a.push([p[0]+nx*half,p[1]+ny*half]);b.push([p[0]-nx*half,p[1]-ny*half]);
    }
    const path=ps=>ps.map(p=>p.map(x=>x.toFixed(2)).join(' ')).join('L');
    return {body:'M'+path(a)+'L'+path(b.reverse())+'Z',core:'M'+path(pts),points:pts,length};
  }
  const traceProfiles={wave:{hmax:9,Lmax:64,memory:4,life:6},fire:{hmax:10,Lmax:76,memory:5,life:6},silk:{hmax:6,Lmax:90,memory:5,life:7},cut:{hmax:5,Lmax:48,memory:3,life:4},pressure:{hmax:11,Lmax:44,memory:3,life:5},vortex:{hmax:8,Lmax:92,memory:5,life:7},fan:{hmax:36,Lmax:100,memory:4,life:6},claw:{hmax:9,Lmax:68,memory:4,life:6}};
  function contactMatches(r,c){const score=c?.impactScore,beat=c?.hitIndex??score?.rhythm?.hitIndex,channel=c?.channel??c?.socket??score?.channel,epoch=c?.epoch??score?.epoch;return !!c&&(beat==null||r.hitIndex==null||beat===r.hitIndex)&&(channel==null||channel===(r.channel||r.socket))&&(epoch==null||epoch===r.epoch);}
  function clipPlane(poly,point,normal){const out=[],d=p=>(p[0]-point[0])*normal[0]+(p[1]-point[1])*normal[1];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=d(a),db=d(b);if(da<=0)out.push(a);if((da<=0)!==(db<=0)){const t=da/(da-db);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}}return out;}
  function sweepSections(rows,style={}) {
    const finite=p=>Array.isArray(p)&&p.length>=2&&p.slice(0,2).every(Number.isFinite),clean=[];
    for(const r of rows||[]){const point=r.tip||r.point;if(!finite(point)||!Number.isFinite(r.time)||!Number.isFinite(r.actionAge))continue;const prior=clean.at(-1);if(prior&&(r.time<=prior.time||r.actionAge<=prior.actionAge))continue;if(prior&&(r.attackID!==prior.attackID||r.epoch!==prior.epoch||Math.hypot(point[0]-prior.point[0],point[1]-prior.point[1])>280))clean.length=0;clean.push({...r,point:point.slice(0,2)});if(clean.length>64)clean.shift();}
    const limits=traceProfiles[style.mode]||traceProfiles.wave;let retained=0;
    for(let i=clean.length-1;i>0;i--){const newer=clean[i],older=clean[i-1],distance=Math.hypot(newer.point[0]-older.point[0],newer.point[1]-older.point[1]);if(retained+distance>limits.Lmax){
      const u=distance>0?(limits.Lmax-retained)/distance:0,lerp=(a,b)=>a.map((v,j)=>v+(b[j]-v)*u),cut={...newer};
      for(const key of ['point','tip','joint','edgeA','edgeB','rootWorld'])if(finite(newer[key])&&finite(older[key]))cut[key]=lerp(newer[key],older[key]);
      for(const key of ['time','actionAge','actorTime'])if(Number.isFinite(newer[key])&&Number.isFinite(older[key]))cut[key]=newer[key]+(older[key]-newer[key])*u;
      if(newer.rim?.length===older.rim?.length&&newer.rim?.length)cut.rim=newer.rim.map((p,j)=>lerp(p,older.rim[j]));
      clean.splice(0,i,cut);break;
    }retained+=distance;}

    if(clean.length<2)return {layers:[],length:0,maxSpeed:0,maxCurvature:0};
    const local=(r,key='point')=>{const p=r[key];return finite(r.rootWorld)?[p[0]-r.rootWorld[0],p[1]-r.rootWorld[1]]:p;},distance=(a,b,key='point')=>Math.hypot(local(a,key)[0]-local(b,key)[0],local(a,key)[1]-local(b,key)[1]);
    const mode=style.mode||'wave',normal=style.category==='normal',left=[],right=[],core=[],curve=[],speed=[];let length=0,maxCurvature=0;
    for(let i=0;i<clean.length;i++){const r=clean[i],a=clean[Math.max(0,i-1)],b=clean[Math.min(clean.length-1,i+1)],dx=b.point[0]-a.point[0],dy=b.point[1]-a.point[1],d=Math.hypot(dx,dy),dt=b.actionAge-a.actionAge,arc=distance(r,a)+distance(b,r),edgeArc=mode==='fan'?Math.max(...['edgeA','edgeB'].map(k=>finite(a[k])&&finite(r[k])&&finite(b[k])?distance(r,a,k)+distance(b,r,k):0)):0,v=dt>0?Math.min(80,Math.max(arc,edgeArc)/dt):0;speed.push(v);if(i)length+=Math.hypot(r.point[0]-clean[i-1].point[0],r.point[1]-clean[i-1].point[1]);let curvature=0;if(i&&i<clean.length-1){const x=r.point[0]-a.point[0],y=r.point[1]-a.point[1],xx=b.point[0]-r.point[0],yy=b.point[1]-r.point[1];curvature=Math.atan2(x*yy-y*xx,x*xx+y*yy);}maxCurvature=Math.max(maxCurvature,Math.abs(curvature));curve.push(curvature);
     const n=d>1e-6?[-dy/d,dx/d]:[0,1],u=i/(clean.length-1),edge=finite(r.edgeA)&&finite(r.edgeB)?Math.abs((r.edgeB[0]-r.edgeA[0])*n[0]+(r.edgeB[1]-r.edgeA[1])*n[1]):2;
     const envelope=Math.sin(Math.PI*(.04+.92*u)),gain=mode==='cut'?.25:mode==='silk'?.35:mode==='pressure'?.68:.5;
     const shape=mode==='wave'?.55+.45*u:mode==='pressure'?.75+.25*Math.cos(u*Math.PI*6):mode==='fan'?.7+.3*(1-u):1;
     const w=Math.min(limits.hmax,Math.max(.45,edge*.5)*gain*(Math.min(v,35)/35)*envelope*shape*(normal?1.3:1));
     const curl=mode==='vortex'?Math.sin(curvature)*w*.6:mode==='fire'?Math.min(w*.3,length*.03)*Math.sin(u*Math.PI):0,p=[r.point[0]+n[0]*curl,r.point[1]+n[1]*curl];
     left.push([p[0]+n[0]*w,p[1]+n[1]*w]);right.push([p[0]-n[0]*w,p[1]-n[1]*w]);core.push(p);
    }
    let edgeTravel=0;if(mode==='fan')for(let i=1;i<clean.length;i++)for(const key of ['edgeA','edgeB'])if(finite(clean[i][key])&&finite(clean[i-1][key]))edgeTravel+=Math.hypot(clean[i][key][0]-clean[i-1][key][0],clean[i][key][1]-clean[i-1][key][1]);
    if((length<.15&&edgeTravel<.15)||Math.max(...speed)<.05)return {layers:[],length,maxSpeed:Math.max(...speed),maxCurvature};
    const path=p=>'M'+p.map(q=>q.map(v=>v.toFixed(2)).join(' ')).join('L'),color=style.color||'#c9c6bd',hot=style.core||'#eee9dd';
    let body=path(left)+'L'+right.slice().reverse().map(q=>q.map(v=>v.toFixed(2)).join(' ')).join('L')+'Z';
    let inner=path(core);
    const c=style.contact,clipPatch=(poly,r)=>{
      if(c?.result!=='block'||!contactMatches(r,c)||r.time<c.born-1)return poly;
      const point=c.point,n=c.impactScore?.normalWorld||c.incoming||c.responseDir;
      if(!finite(point)||!finite(n))return poly;
      const half=finite(r.edgeA)&&finite(r.edgeB)?Math.hypot(r.edgeA[0]-r.edgeB[0],r.edgeA[1]-r.edgeB[1])*.5:2;
      if(Math.hypot(r.point[0]-point[0],r.point[1]-point[1])>Math.max(12,half*1.5))return poly;
      return clipPlane(poly,point,n);
    },polygon=(points,r)=>{const clipped=clipPatch(points,r);return clipped.length>2?path(clipped)+'Z':'';};
    // Each measured pair is an independent patch: reversals cannot create
    // one global left/right polygon that crosses the entire history.
    body='';for(let i=1;i<clean.length;i++)body+=polygon([left[i-1],left[i],right[i],right[i-1]],clean[i]);
    if(c?.result==='block'&&clean.some((r,i)=>{const poly=[left[i],right[i]];return clipPatch(poly,r)!==poly;})){inner='';for(let i=1;i<clean.length;i++){const segment=clipPatch([core[i-1],core[i]],clean[i]);if(segment.length>=2)inner+=path(segment.slice(0,2));}}
    if(mode==='fan'){
      // Actual edge pairs sweep bounded quads; do not symmetrize around tip or
      // invent thickness when the final fan projection is edge-on.
      const edge=(r,key)=>{const q=r[key];if(!finite(q))return r.point;const dx=q[0]-r.point[0],dy=q[1]-r.point[1],d=Math.hypot(dx,dy),k=d>160?160/d:1;return [r.point[0]+dx*k,r.point[1]+dy*k];},tail=clean.slice(-(normal?4:7));body='';inner='';
      for(let i=1;i<tail.length;i++){const a=tail[i-1],b=tail[i],ar=a.rim,br=b.rim;if(ar?.length===br?.length&&ar?.length>1){for(let j=1;j<ar.length;j++)body+=polygon([ar[j-1],br[j-1],br[j],ar[j]],b);}else body+=polygon([edge(a,'edgeA'),edge(b,'edgeA'),edge(b,'edgeB'),edge(a,'edgeB')],b);}
      inner='';for(let i=1;i<tail.length;i++){const segment=clipPatch([edge(tail[i-1],'edgeA'),edge(tail[i],'edgeA')],tail[i]);if(segment.length>=2)inner+=path(segment.slice(0,2));}
    }
    if(mode==='claw'){inner='';for(let i=1,teeth=0;i<core.length&&teeth<3;i++){if(Math.abs(curve[i])<.05&&i%3)continue;teeth++;const a=core[i],v=left[i],d=Math.hypot(v[0]-a[0],v[1]-a[1]),k=Math.min(1,8/(d||1),length*.25/(d||1)),b=[a[0]+(v[0]-a[0])*k,a[1]+(v[1]-a[1])*k];const segment=clipPatch([a,b],clean[i]);if(segment.length>=2)inner+=path(segment.slice(0,2));}}
    const layers=[{d:body,fill:color,stroke:'none',width:0,opacity:mode==='cut'?.18:.24},{d:inner,fill:'none',stroke:hot,width:mode==='pressure'?1.8:mode==='cut'?.75:1.05,opacity:.65,dash:mode==='pressure'?'5 4':'none'}];
    // A fan's swept edge is already in the measured section. It does not grow
    // a synthetic arc when the wrist is still; silhouette uses the same path.
    if(mode==='fan')layers[0].opacity=.14;
    if(mode==='silk'){layers[0].fill='none';layers[0].stroke=color;layers[0].width=.65;layers[0].opacity=.38;}
    if(style.reduced)layers.splice(1);
    return {layers,length,maxSpeed:Math.max(...speed),meanSpeed:speed.reduce((a,b)=>a+b,0)/speed.length,maxCurvature};
  }
  class RibbonPool {
    constructor(parent,{capacity=48}={}) {
      if(!Number.isInteger(capacity)||capacity<1||capacity>128)throw RangeError('Ribbon capacity 1..128');
      const {node}=INK.SVG;this.capacity=capacity;this.root=node('g',{'data-ink-swept-ribbons':'world','pointer-events':'none'},parent);
      this.nodes=Array.from({length:capacity},()=>{const g=node('g',{display:'none'},this.root);return {g,material:Array.from({length:6},()=>node('path',{display:'none','stroke-linecap':'round','stroke-linejoin':'round'},g)),edge:node('path',{stroke:'none'},g),body:node('path',{stroke:'none'},g),core:node('path',{fill:'none','stroke-linecap':'round'},g)};});
      this.live=Array(capacity).fill(null);this.byKey=new Map();this.stats={active:0,peak:0,dropped:0,capacity,vertices:0};
    }
    push(key,point,time,style={}) {
      if(!point?.every(Number.isFinite)||!Number.isFinite(time))return false;
      let i=this.byKey.get(key),r=i===undefined?null:this.live[i];
      if(!r){i=this.live.findIndex(p=>p===null);if(i<0){this.stats.dropped++;return false;}r={key,points:[],last:time,closed:false,...style};this.live[i]=r;this.byKey.set(key,i);this.stats.active++;this.stats.peak=Math.max(this.stats.peak,this.stats.active);}
      if(r.closed)return false;
      const prior=r.points.at(-1);
      if(prior&&time<prior.time)return false;
      if(prior&&Math.hypot(point[0]-prior.point[0],point[1]-prior.point[1])>280)r.points=[];
      if(prior&&!style.sections&&Math.hypot(point[0]-prior.point[0],point[1]-prior.point[1])<.12){r.last=time;return true;}
      r.points.push({point:point.slice(),time});if(r.points.length>64)r.points.shift();
      while(r.points.length>2&&r.points[1].time<time-(r.memory??12))r.points.shift();
      r.last=time;return true;
    }
    pushSection(key,row,style={}) {
      const point=row?.tip||row?.point;if(!Array.isArray(point)||point.length<2||!point.slice(0,2).every(Number.isFinite)||!Number.isFinite(row.time)||!Number.isFinite(row.actionAge))return false;
      const index=this.byKey.get(key),existing=index===undefined?null:this.live[index],prior=existing?.points.at(-1);
      if(prior&&(row.time<=prior.time||row.actionAge<=prior.actionAge))return false;
      const candidate=existing?.contact||style.contact,c=contactMatches({...style,...row},candidate)?candidate:null;
      if(c&&row.time>c.born){
        if(c.result!=='hit'||(existing?.afterContact||0)>=2){if(existing){existing.closed=true;if(c.result==='armor')existing.life=Math.min(existing.life||6,4);}return false;}
      }
      if(prior&&row.epoch===prior.epoch&&row.attackID===prior.attackID){const delta=(a,b)=>Array.isArray(a)&&Array.isArray(b)?Math.hypot(a[0]-b[0],a[1]-b[1]):0;if(delta(point,prior.point)<.12&&delta(row.edgeA,prior.edgeA)<.12&&delta(row.edgeB,prior.edgeB)<.12)return false;}
      if(existing&&prior&&(row.epoch!==prior.epoch||row.attackID!==prior.attackID)){existing.points=[];}
      if(!this.push(key,point,row.time,{...style,sections:true}))return false;
      const r=this.live[this.byKey.get(key)],last=r.points.at(-1);if(c&&row.time>c.born)r.afterContact=(r.afterContact||0)+1;
      // push() suppresses stationary points. Preserve no invented movement.
      if(last?.time!==row.time)return true;
      Object.assign(last,{tip:point.slice(0,2),joint:row.joint?.slice(0,2),edgeA:row.edgeA?.slice(0,2),edgeB:row.edgeB?.slice(0,2),rootWorld:row.rootWorld?.slice(0,2),socket:row.socket||style.socket,channel:row.channel||style.channel||row.socket||style.socket,hitIndex:row.hitIndex??style.hitIndex,rim:row.rim?.map(p=>p.slice(0,2)),geometryQuality:row.geometryQuality,actionAge:row.actionAge,phase:row.phase,attackID:row.attackID,epoch:row.epoch});return true;
    }
    contact(source,snapshot,time) {
      if(!source||!snapshot)return 0;let count=0;
      for(const r of this.live)if(r&&(r.source===source||r.sourceAttack===source)&&contactMatches({...r,...r.points.at(-1)},snapshot)){
        // A trade may seal its emitter before the same-step collision event.
        // Attach only that first, fully identified contact; never reopen it.
        if(r.closed){const row=r.points.at(-1),score=snapshot.impactScore,beat=snapshot.hitIndex??score?.rhythm?.hitIndex,channel=snapshot.channel??snapshot.socket??score?.channel,epoch=snapshot.epoch??score?.epoch;if(r.contact||!row||beat==null||channel==null||epoch==null||beat!==row.hitIndex||channel!==(row.channel||row.socket)||epoch!==row.epoch||snapshot.born!==time||r.last!==time)continue;}
if(r.contact!==snapshot)r.afterContact=0;r.contact=snapshot;if(snapshot.result==='armor'){r.life=Math.min(r.life||6,4);r.memory=Math.min(r.memory||8,3);}count++;}
      return count;
    }
    stamp(snapshot,time,style={}) {
      if(!snapshot||!Number.isFinite(time))return false;
      const key='contact:'+(snapshot.serial??snapshot.id??('local-'+(this.contactSerial=(this.contactSerial||0)+1)));if(this.byKey.has(key))return true;
      let i=this.live.findIndex(r=>r===null);
      if(i<0){
        const rank=r=>r.contactOnly?2:r.closed?0:1;let best=0;
        for(let j=1;j<this.capacity;j++){const a=this.live[j],b=this.live[best];if(rank(a)<rank(b)||rank(a)===rank(b)&&a.last<b.last)best=j;}
        i=best;this.byKey.delete(this.live[i].key);this.stats.active--;this.stats.evicted=(this.stats.evicted||0)+1;
      }
      this.live[i]={...style,key,contact:snapshot,contactOnly:true,points:[],closed:true,last:time,life:Math.min(12,snapshot.duration||12)};this.byKey.set(key,i);this.stats.active++;this.stats.peak=Math.max(this.stats.peak,this.stats.active);return true;
    }
    close(key,time) {const i=this.byKey.get(key),r=i===undefined?null:this.live[i];if(r&&!r.closed){r.closed=true;r.last=time;}}
    step(time) {
      const {assign}=INK.SVG;
      for(let i=0;i<this.capacity;i++){const r=this.live[i];if(r&&time-r.last>(r.life??13)){this.byKey.delete(r.key);this.live[i]=null;this.stats.active--;assign(this.nodes[i].g,'display','none');}}
    }
    render(time,caps=null) {
      const {assign}=INK.SVG;let vertices=0;
      for(let i=0;i<this.capacity;i++) {
        const r=this.live[i],n=this.nodes[i];if(!r)continue;
        let visibleRows=r.points.filter(p=>p.time<=time+1e-6);
        const cap=caps?.get?.(r.source)?.get?.(r.socket),last=visibleRows.at(-1);
        const capContactOK=!r.contact||cap?.time<=r.contact.born||r.contact.result==='hit'&&(r.afterContact||0)<2;
        if(r.sections&&!r.closed&&capContactOK&&last&&cap&&['startup','active'].includes(cap.phase)&&cap.actionAge>last.actionAge&&cap.time>=last.time&&cap.attackID===last.attackID&&cap.epoch===last.epoch&&contactMatches({...r,...last},{hitIndex:cap.hitIndex,channel:cap.channel,epoch:cap.epoch})){
          const point=cap.tip||cap.point;if(Array.isArray(point)&&point.length>=2&&point.slice(0,2).every(Number.isFinite))visibleRows=[...visibleRows,{...cap,point:point.slice(0,2),tip:point.slice(0,2)}];
        }
        const pts=visibleRows.map(p=>p.point),age=Math.max(0,time-r.last),fade=clamp(1-age/(r.life??13));
        if((pts.length<2&&!r.contactOnly)||fade<=0){assign(n.g,'display','none');continue;}
        const material=r.contactOnly||INK.MaterialFlow?.active()&&r.character;
        for(const part of [n.edge,n.body,n.core])assign(part,'display',material?'none':'inline');
        for(const part of n.material)assign(part,'display','none');
        if(material){
          const c=r.contact,base=INK.Particles?.materials?.[c?.character]||{},palette=c?.result==='armor'?{color:'#e6b45c',core:'#fff1bb'}:['block','parry'].includes(c?.result)?{color:'#79cfff',core:'#e3f7ff'}:c?.category==='normal'?{color:'#c9c6bd',core:'#eee9dd'}:{color:base.color,core:base.core};
          const layers=r.contactOnly?(INK.ContactFlux?.section(c,time,{...palette,...r})||[]):INK.MaterialFlow.geometry(visibleRows,time,{...r,contactTime:time});
          assign(n.g,'display',layers.length?'inline':'none');assign(n.g,'opacity',(r.contactOnly?1:fade*fade)*(r.opacity??.65));
          layers.forEach((layer,j)=>{const p=n.material[j];if(!p)return;assign(p,'display','inline');assign(p,'d',layer.d);assign(p,'fill',layer.fill);assign(p,'stroke',layer.stroke||'none');assign(p,'stroke-width',layer.width);assign(p,'opacity',layer.opacity);assign(p,'stroke-dasharray',layer.dash||'none');});
          vertices+=layers.length*24;continue;
        }
        const s=sweep(pts,{width:(r.width??14)*(.55+.45*fade),samples:24,age:time,wave:r.flame?.09:0});
        assign(n.g,'display','inline');assign(n.g,'opacity',(fade*fade*(r.opacity??.65)).toFixed(4));
        assign(n.edge,'d',s.body);assign(n.edge,'fill',r.dark||'#af4356');assign(n.edge,'opacity',.35);
        const inner=sweep(pts,{width:(r.width??14)*.72*fade,samples:24,age:time,wave:r.flame?.12:0});
        assign(n.body,'d',inner.body);assign(n.body,'fill',r.color||'#ffaa65');
        assign(n.core,'d',s.core);assign(n.core,'stroke',r.core||'#fff0c0');assign(n.core,'stroke-width',Math.max(.65,(r.width??14)*.065*fade));
        vertices+=s.points.length;
      }
      this.stats.vertices=vertices;
    }
    clear() {this.byKey.clear();this.live.fill(null);for(const n of this.nodes)INK.SVG.assign(n.g,'display','none');this.stats.active=0;this.stats.vertices=0;}
    destroy() {this.clear();this.root.remove();this.nodes=[];}
  }
  INK.RibbonGeometry={sweep,sweepSections,traceProfiles,contactMatches,clipPlane};INK.RibbonPool=RibbonPool;
})();
