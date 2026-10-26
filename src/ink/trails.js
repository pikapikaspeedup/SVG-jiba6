/* FLOW 04 · world-space swept traces, surviving attack changes without DOM clones.
 * Fixed retained capacity. Geometry is sampled once by the simulation; display
 * evaluates age analytically. There is no render-schedule-dependent history.
 */
'use strict';
(() => {
  const {node,assign}=INK.SVG,{clamp}=INK;
  function shape(points,width) {
    const pts=INK.Motion.resample(points,9),a=[],b=[];
    pts.forEach((p,i)=>{
      const p0=pts[Math.max(0,i-1)],p1=pts[Math.min(8,i+1)],dx=p1[0]-p0[0],dy=p1[1]-p0[1],len=Math.hypot(dx,dy)||1;
      const w=width*Math.sin((i/8)*Math.PI*.82)*.5;a.push([p[0]-dy/len*w,p[1]+dx/len*w]);b.push([p[0]+dy/len*w,p[1]-dx/len*w]);
    });return 'M'+a.map(q=>q.join(' ')).join('L')+'L'+b.reverse().map(q=>q.join(' ')).join('L')+'Z';
  }
  class TrailPool {
    constructor(parent,{capacity=64}={}) {
      if(!Number.isInteger(capacity)||capacity<1||capacity>256)throw RangeError('Trail capacity 1..256');
      this.capacity=capacity;this.root=node('g',{'data-ink-trails':'world','pointer-events':'none'},parent);
      this.nodes=Array.from({length:capacity},()=>{const g=node('g',{display:'none'},this.root);return{g,body:node('path',{stroke:'none'},g),core:node('path',{fill:'none','stroke-linecap':'round'},g)};});
      this.live=Array(capacity).fill(null);this.stats={active:0,peak:0,dropped:0,capacity};
    }
    add({points,birth,life=10,width=8,color='#ff9f68',core='#fff1cb',opacity=.5}) {
      if(!points?.length||points.some(q=>!q.every(Number.isFinite)))return false;
      if(Math.hypot(points.at(-1)[0]-points[0][0],points.at(-1)[1]-points[0][1])<3)return false;
      const i=this.live.findIndex(p=>p===null);if(i<0){this.stats.dropped++;return false;}
      const data={birth,life,opacity};this.live[i]=data;
      const n=this.nodes[i];assign(n.body,'d',shape(points,width));assign(n.body,'fill',color);
      assign(n.core,'d','M'+points.map(q=>q.join(' ')).join('L'));assign(n.core,'stroke',core);assign(n.core,'stroke-width',Math.max(.7,width*.11));
      this.stats.active++;this.stats.peak=Math.max(this.stats.peak,this.stats.active);return true;
    }
    render(t) {for(let i=0;i<this.capacity;i++){const p=this.live[i],n=this.nodes[i];if(!p)continue;const age=t-p.birth;assign(n.g,'display',age<0||age>=p.life?'none':'inline');if(age>=0&&age<p.life)assign(n.g,'opacity',(p.opacity*(1-age/p.life)**1.65).toFixed(4));}}
    step(t) {for(let i=0;i<this.capacity;i++){const p=this.live[i];if(p&&t>=p.birth+p.life){this.live[i]=null;this.stats.active--;assign(this.nodes[i].g,'display','none');}}}
    clear() {this.live.fill(null);for(const n of this.nodes)assign(n.g,'display','none');this.stats.active=0;}
    destroy() {this.root.remove();this.live=[];this.nodes=[];}
  }
  INK.TrailPool=TrailPool;
})();
