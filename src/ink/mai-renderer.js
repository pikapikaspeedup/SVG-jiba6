/* FLOW 04 · Mai's retained articulated fan and authored accessory deformation.
 * Independent fan ribs rotate around one grip instead of scaling a paper image.
 * Hair, cloth and the tassel are cosmetic: they never feed collision or movement.
 */
'use strict';
(() => {
  const {node,assign}=INK.SVG,{clamp,rad}=INK;
  const point=(r,a)=>[Math.cos(a)*r,Math.sin(a)*r];
  class MaiFan {
    constructor(root) {
      this.root=root;assign(root,'data-ink-part','articulated-fan');
      this.panels=Array.from({length:10},(_,i)=>({
        leaf:node('path',{fill:i%2?'#f7e5c8':'#fff4db',stroke:'none'},root),
        rim:node('path',{fill:i%2?'#c74450':'#df5660',stroke:'none'},root)
      }));
      this.ribs=Array.from({length:11},()=>node('path',{fill:'none',stroke:'#9e7959','stroke-width':1.05,'stroke-linecap':'round'},root));
      this.brush=node('path',{fill:'none',stroke:'#c64952','stroke-width':1.3,'stroke-linecap':'round'},root);
      node('path',{d:'M-5-5L12-4 12 5-5 6Z',fill:'#d8b781',stroke:'#654834','stroke-width':.8},root);
      node('circle',{cx:1,cy:.5,r:2.1,fill:'#7c5640'},root);
    }
    render(openness,stats) {
      const open=clamp(openness,.015,1),span=rad(7+135*open),start=-span/2;
      if(open===this.last)return;this.last=open;
      for(let i=0;i<10;i++) {
        const a=start+span*i/10,b=start+span*(i+1)/10,A=point(79,a),B=point(79,b),C=point(9,b),D=point(9,a);
        assign(this.panels[i].leaf,'d',`M${D}L${A}A79 79 0 0 1 ${B}L${C}Z`,stats);
        const c=point(67,b),d=point(67,a);
        assign(this.panels[i].rim,'d',`M${A}A79 79 0 0 1 ${B}L${c}A67 67 0 0 0 ${d}Z`,stats);
      }
      for(let i=0;i<=10;i++){const a=start+span*i/10;assign(this.ribs[i],'d',`M${point(7,a)}L${point(79,a)}`,stats);}
      const a=point(56,start*.66),b=point(54,start*.08),c=point(48,span*.25);
      assign(this.brush,'d',`M${a}Q${b} ${c}M${point(33,span*.23)}Q${point(43,span*.19)} ${point(49,span*.1)}`,stats);
    }
  }
  function smoothPath(points) {
    if(!points.length)return '';
    let d='M'+points[0].join(' ');
    for(let i=1;i<points.length-1;i++)d+=`Q${points[i]} ${(points[i][0]+points[i+1][0])/2} ${(points[i][1]+points[i+1][1])/2}`;
    return d+'L'+points.at(-1).join(' ');
  }
  function strip(points,width) {
    const left=[],right=[];
    points.forEach((p,i)=>{
      const prev=points[Math.max(0,i-1)],next=points[Math.min(points.length-1,i+1)],dx=next[0]-prev[0],dy=next[1]-prev[1],L=Math.hypot(dx,dy)||1;
      const u=i/(points.length-1),w=width*(1-u*.73)*(u<.08?.7:1);
      left.push([p[0]-dy/L*w,p[1]+dx/L*w]);right.push([p[0]+dy/L*w,p[1]-dx/L*w]);
    });
    return smoothPath(left)+'L'+right.at(-1).join(' ')+smoothPath(right.reverse()).replace(/^M/,'L')+'Z';
  }
  class MaiSecondary {
    constructor(renderer) {
      this.renderer=renderer;renderer.hair.replaceChildren();renderer.trail.replaceChildren();
      this.hair=node('path',{fill:'url(#atelier-mai-hair)',stroke:'#392632','stroke-width':1.25},renderer.hair);
      this.hairLight=node('path',{fill:'none',stroke:'#aa6655','stroke-width':3,'stroke-linecap':'round',opacity:.72},renderer.hair);
      this.hairLine=node('path',{fill:'none',stroke:'#4a2c34','stroke-width':1.1,'stroke-linecap':'round'},renderer.hair);
      this.ribbon=node('path',{fill:'#f1dcc0',stroke:'#60404a','stroke-width':1.2,'stroke-linejoin':'round'},renderer.trail);
      this.ribbonShade=node('path',{fill:'none',stroke:'#c6a789','stroke-width':2.4,opacity:.85},renderer.trail);
      this.tassel=node('g',{'data-ink-part':'obi-tassel'},renderer.trail);
      node('circle',{r:10.5,fill:'#f6e7d0',stroke:'#63424c','stroke-width':1.1},this.tassel);
      node('path',{d:'M-1-8Q-4 0-1 8M-8-2Q0 3 8 1',fill:'none',stroke:'#b8a084','stroke-width':1.1},this.tassel);
    }
    render(p,motion,frame,stats) {
      const h=motion?.hair||0,c=motion?.cloth||0,f=motion?.flutter||0,hc=motion?.hairChain||[h,h,h],cc=motion?.clothChain||[c,c,c];
      // Original attachment coordinate system: its anchor is mapped to the neck
      // by Renderer. Only the downstream curve bends; the grip never separates.
      const X=-55+h*.92,Y=-275+Math.abs(h)*.24;
      assign(this.hair,'d',`M-11-377Q-47-402-59-379C-69-361 ${X-28+hc[1]*.3} ${Y-37} ${X} ${Y}L${X+14} ${Y+2}C${X-8} ${Y-30} ${-31+hc[0]*.45} -351-28-370L-10-368Z`,stats);
      assign(this.hairLight,'d',`M-36-379C-57-370 ${X-23+hc[1]*.3} ${Y-29} ${X+2} ${Y-8}`,stats);
      assign(this.hairLine,'d',`M-46-377C-52-354 ${X-19} ${Y-37} ${X+7} ${Y-5}`,stats);
      const pts=Array.from({length:12},(_,i)=>{
        const t=i/11,delayed=Math.sin(t*Math.PI*.9),wave=Math.sin(t*6-frame*.16)*f*t*t;
        const local=cc[Math.min(2,Math.floor(t*3))],lag=cc[0]*(1-t)+local*t;return[-25-38*Math.sin(t*Math.PI*.72)+lag*.94*t*t+wave,-205+133*t-Math.abs(lag)*.28*delayed];
      });
      assign(this.ribbon,'d',strip(pts,8.5),stats);
      assign(this.ribbonShade,'d',smoothPath(pts.map((q,i)=>[q[0]+2*(1-i/11),q[1]])),stats);
      const end=pts.at(-1);assign(this.tassel,'transform',`translate(${end}) rotate(${c*.8})`,stats);
    }
  }
  INK.MaiFan=MaiFan;INK.MaiSecondary=MaiSecondary;
})();
