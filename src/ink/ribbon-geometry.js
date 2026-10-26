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
  class RibbonPool {
    constructor(parent,{capacity=48}={}) {
      if(!Number.isInteger(capacity)||capacity<1||capacity>128)throw RangeError('Ribbon capacity 1..128');
      const {node}=INK.SVG;this.capacity=capacity;this.root=node('g',{'data-ink-swept-ribbons':'world','pointer-events':'none'},parent);
      this.nodes=Array.from({length:capacity},()=>{const g=node('g',{display:'none'},this.root);return {g,edge:node('path',{stroke:'none'},g),body:node('path',{stroke:'none'},g),core:node('path',{fill:'none','stroke-linecap':'round'},g)};});
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
      if(prior&&Math.hypot(point[0]-prior.point[0],point[1]-prior.point[1])<.12){r.last=time;return true;}
      r.points.push({point:point.slice(),time});if(r.points.length>64)r.points.shift();
      while(r.points.length>2&&r.points[1].time<time-(r.memory??12))r.points.shift();
      r.last=time;return true;
    }
    close(key,time) {const i=this.byKey.get(key),r=i===undefined?null:this.live[i];if(r&&!r.closed){r.closed=true;r.last=time;}}
    step(time) {
      const {assign}=INK.SVG;
      for(let i=0;i<this.capacity;i++){const r=this.live[i];if(r&&time-r.last>(r.life??13)){this.byKey.delete(r.key);this.live[i]=null;this.stats.active--;assign(this.nodes[i].g,'display','none');}}
    }
    render(time) {
      const {assign}=INK.SVG;let vertices=0;
      for(let i=0;i<this.capacity;i++) {
        const r=this.live[i],n=this.nodes[i];if(!r)continue;
        const pts=r.points.filter(p=>p.time<=time+1e-6).map(p=>p.point),age=Math.max(0,time-r.last),fade=clamp(1-age/(r.life??13));
        if(pts.length<2||fade<=0){assign(n.g,'display','none');continue;}
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
  INK.RibbonGeometry={sweep};INK.RibbonPool=RibbonPool;
})();
