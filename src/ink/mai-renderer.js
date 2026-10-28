/* FLOW 04 · Mai's retained articulated fan and authored accessory deformation.
 * Independent fan ribs rotate around one grip instead of scaling a paper image.
 * Hair, cloth and the tassel are cosmetic: they never feed collision or movement.
 */
'use strict';
(() => {
  const {node,assign}=INK.SVG,{clamp,rad}=INK;
  let costumeClipSerial=0;
  const point=(r,a)=>[Math.cos(a)*r,Math.sin(a)*r];
  // Shared local paper boundary and grip transform for rendering and strike traces.
  const fanGeometry=openness=>{const open=clamp(openness,.015,1),span=rad(7+135*open),start=-span/2;return{open,span,start,tip:[79,0],grip:[0,0],rim:Array.from({length:8},(_,i)=>point(79,start+span*i/7))};};
  const fanTransform=p=>INK.mat.compose(16,0,-18+(p.fanAngle||0));
  INK.FanGeometry=Object.freeze({sample:fanGeometry,transform:fanTransform});
  class MaiFan {
    constructor(root) {
      this.root=root;assign(root,'data-ink-part','articulated-fan');
      this.panels=Array.from({length:10},(_,i)=>({
        leaf:node('path',{fill:i%2?'#e6dac3':'#f7efdd',stroke:'none'},root),
        rim:node('path',{fill:i%2?'#d5c39f':'#ebdfc4',stroke:'none',opacity:.46},root)
      }));
      this.ribs=Array.from({length:11},()=>node('path',{fill:'none',stroke:'#97343c','stroke-width':2,'stroke-linecap':'round'},root));
      this.veins=Array.from({length:11},()=>node('path',{fill:'none',stroke:'#ac967a','stroke-width':.65,'stroke-linecap':'round',opacity:.8},root));
      this.brush=node('path',{fill:'none',stroke:'#b39160','stroke-width':1,'stroke-linecap':'round',opacity:.8},root);
      this.blossoms=Array.from({length:12},()=>node('path',{d:'M0-3C1-5 3-4 3-2C5-3 6-1 4 1C5 3 4 4 2 3C1 5-1 5-2 3C-4 4-5 3-4 1C-6-1-5-3-3-2C-3-4-1-5 0-3Z',fill:'#bf9d68',opacity:.7},root));
      this.edge=node('path',{fill:'none',stroke:'#faf4e4','stroke-width':1.1},root);
      node('path',{d:'M-7-5L12-4 12 5-7 6Z',fill:'#9b2c34',stroke:'#5b302d','stroke-width':.8},root);
      node('circle',{cx:1,cy:.5,r:2.1,fill:'#e0c190'},root);
      // The hanging cord is attached to the fan grip and shares its frame.
      node('path',{d:'M-4 5Q-8 19-8 30',fill:'none',stroke:'#a72c38','stroke-width':1.3,'stroke-linecap':'round'},root);
      node('circle',{cx:-8,cy:30,r:2.3,fill:'#e6d6b9',stroke:'#854b40','stroke-width':.7},root);
      node('path',{d:'M-10 32Q-13 39-11 47Q-8 50-6 46L-6 32Z',fill:'#ad2c3b',stroke:'#672b34','stroke-width':.7},root);
    }
    render(openness,stats) {
      const {open,span,start}=fanGeometry(openness);
      if(open===this.last)return;this.last=open;
      for(let i=0;i<10;i++) {
        const a=start+span*i/10,b=start+span*(i+1)/10,A=point(79,a),B=point(79,b),C=point(32,b),D=point(32,a);
        assign(this.panels[i].leaf,'d',`M${D}L${A}A79 79 0 0 1 ${B}L${C}A32 32 0 0 0 ${D}Z`,stats);
        const c=point(71,b),d=point(71,a);
        assign(this.panels[i].rim,'d',`M${A}A79 79 0 0 1 ${B}L${c}A71 71 0 0 0 ${d}Z`,stats);
      }
      for(let i=0;i<=10;i++){
        const a=start+span*i/10;
        assign(this.ribs[i],'d',`M${point(6,a)}L${point(33,a)}`,stats);
        assign(this.veins[i],'d',`M${point(32,a)}L${point(79,a)}`,stats);
      }
      assign(this.edge,'d',`M${point(79,start)}A79 79 0 0 1 ${point(79,start+span)}`,stats);
      const a=point(55,start*.8),b=point(62,start*.1),c=point(52,span*.36);
      assign(this.brush,'d',`M${a}Q${b} ${c}M${point(47,start*.45)}Q${point(53,start*.3)} ${point(60,start*.24)}M${point(49,span*.2)}Q${point(57,span*.22)} ${point(61,span*.34)}`,stats);
      this.blossoms.forEach((n,i)=>{
        const a=start+span*((i%6)+.45)/6,q=point(i<6?55:68,a+(i<6?0:span*.035));
        assign(n,'transform',`translate(${q}) rotate(${a*180/Math.PI}) scale(${i<6?.88:.55})`,stats);
        assign(n,'opacity',open<.24?0:(i<6?.72:.52),stats);
      });
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
      const u=i/(points.length-1),w=typeof width==='function'?width(u):width*(1-u*.73)*(u<.08?.7:1);
      left.push([p[0]-dy/L*w,p[1]+dx/L*w]);right.push([p[0]+dy/L*w,p[1]-dx/L*w]);
    });
    return smoothPath(left)+'L'+right.at(-1).join(' ')+smoothPath(right.reverse()).replace(/^M/,'L')+'Z';
  }
  class MaiSecondary {
    constructor(renderer) {
      this.renderer=renderer;renderer.hair.replaceChildren();renderer.trail.replaceChildren();renderer.coat.replaceChildren();
      this.hair=node('path',{'data-ink-part':'mai-ponytail',fill:'url(#atelier-mai-hair)',stroke:'#201b21','stroke-width':1.2,'stroke-linejoin':'round'},renderer.hair);
      this.hairShade=node('path',{fill:'#17151b',opacity:.55},renderer.hair);
      this.hairLight=node('path',{fill:'none',stroke:'#88746d','stroke-width':3,'stroke-linecap':'round',opacity:.53},renderer.hair);
      this.hairLines=Array.from({length:3},(_,i)=>node('path',{fill:'none',stroke:i?'#4c3c3b':'#ab8c7c','stroke-width':i?1.1:.8,'stroke-linecap':'round',opacity:i?.76:.45},renderer.hair));
      this.ribbon=node('path',{'data-ink-part':'mai-sash',fill:'#eaeae4',stroke:'#777a7b','stroke-width':1.05,'stroke-linejoin':'round'},renderer.trail);
      this.ribbonShade=node('path',{fill:'none',stroke:'#9da4a3','stroke-width':3.1,'stroke-linecap':'round',opacity:.5},renderer.trail);
      this.ribbonLight=node('path',{fill:'none',stroke:'#ffffff','stroke-width':2.1,'stroke-linecap':'round',opacity:.8},renderer.trail);
      this.tassel=node('g',{'data-ink-part':'obi-tassel'},renderer.trail);
      node('path',{d:'M-7 7C-10 16-10 29-2 36L0 39Q10 30 8 19L6 7Z',fill:'#e9eae4',stroke:'#888e8d','stroke-width':.9},this.tassel);
      node('path',{d:'M-4 10C-7 19-6 29-1 35M0 10Q-2 25 0 37M4 10Q7 26 1 36',fill:'none',stroke:'#aeb5b2','stroke-width':.8},this.tassel);
      node('circle',{r:12,fill:'#a92936',stroke:'#4d2930','stroke-width':1.1},this.tassel);
      node('path',{d:'M-9-5Q0-10 9-4M-11 0Q0-5 11 1M-9 6Q0 2 9 7M-7-8Q-1-4 3 9',fill:'none',stroke:'#d8aa65','stroke-width':.9},this.tassel);
      node('circle',{cx:-4,cy:-5,r:1.5,fill:'#f6cc86',opacity:.8},this.tassel);

      // The front apron and the back bow occupy different disjoint regions as
      // the pelvis turns, just like the torso's front/profile/back attachments.
      const coatRoot=renderer.coat,defs=node('defs',{},coatRoot),serial=++costumeClipSerial;
      const frontClip=node('clipPath',{id:'ink-mai-costume-front-'+serial,clipPathUnits:'userSpaceOnUse'},defs);
      const backClip=node('clipPath',{id:'ink-mai-costume-back-'+serial,clipPathUnits:'userSpaceOnUse'},defs);
      this.frontRect=node('rect',{y:-300,height:400},frontClip);
      this.backRect=node('rect',{y:-300,height:400},backClip);
      const coat=node('g',{'clip-path':'url(#'+frontClip.id+')'},coatRoot);
      this.leftFlap=node('path',{'data-ink-part':'mai-left-hip-flap',fill:'#bc283d',stroke:'#512c36','stroke-width':1.1,'stroke-linejoin':'round'},coat);
      this.rightFlap=node('path',{'data-ink-part':'mai-right-hip-flap',fill:'#a92136',stroke:'#512c36','stroke-width':1.1,'stroke-linejoin':'round'},coat);
      this.flapShade=node('path',{fill:'#771c30',opacity:.42},coat);
      this.flapTrim=node('path',{fill:'none',stroke:'#f7eee5','stroke-width':4,'stroke-linecap':'round'},coat);
      this.flapLines=node('path',{fill:'none',stroke:'#fa8880','stroke-width':.8,opacity:.7},coat);
      this.apron=node('path',{'data-ink-part':'mai-front-panel',fill:'#bb213b',stroke:'#572b36','stroke-width':1.1,'stroke-linejoin':'round'},coat);
      this.apronShadow=node('path',{fill:'#731a30',opacity:.42},coat);
      this.apronLight=node('path',{fill:'#f06466',opacity:.31},coat);
      this.apronTrim=node('path',{fill:'none',stroke:'#f3e6dc','stroke-width':3.1,'stroke-linecap':'round'},coat);
      this.apronFold=node('path',{fill:'none',stroke:'#752036','stroke-width':1,'stroke-linecap':'round',opacity:.72},coat);
      this.apronFlowers=Array.from({length:4},()=>node('path',{d:'M0-3C1-5 3-4 3-2C5-3 6-1 4 1C5 3 4 4 2 3C1 5-1 5-2 3C-4 4-5 3-4 1C-6-1-5-3-3-2C-3-4-1-5 0-3Z',fill:'#f58b86',opacity:.35},coat));
      const back=node('g',{'data-ink-part':'mai-back-bow','clip-path':'url(#'+backClip.id+')'},coatRoot);
      this.backLeft=node('path',{fill:'#b72238',stroke:'#502c35','stroke-width':1.1,'stroke-linejoin':'round'},back);
      this.backRight=node('path',{fill:'#d53547',stroke:'#502c35','stroke-width':1.1,'stroke-linejoin':'round'},back);
      this.backFold=node('path',{fill:'none',stroke:'#f5eee5','stroke-width':4,'stroke-linecap':'round','stroke-linejoin':'round'},back);
      this.backSeams=node('path',{fill:'none',stroke:'#842136','stroke-width':1,opacity:.7},back);
      node('path',{d:'M-10-220C-25-227-34-222-38-214C-36-208-31-206-26-205C-23-212-16-214-7-211L5-212C13-218 21-219 28-216C26-223 17-227 6-223Z',fill:'#f1f0e8',stroke:'#888887','stroke-width':1},back);
      node('path',{d:'M-30-216Q-20-221-11-216M8-218Q17-222 25-217',fill:'none',stroke:'#b7bcb8','stroke-width':1.2},back);
      node('path',{d:'M-8-221Q-1-224 7-220L9-210Q0-207-9-210Z',fill:'#e1e4df',stroke:'#858989','stroke-width':.8},back);
    }
    render(p,motion,frame,stats) {
      const h=motion?.hair||0,c=motion?.cloth||0,f=motion?.flutter||0,hc=motion?.hairChain||[h,h,h],cc=motion?.clothChain||[c,c,c];
      // Original attachment coordinate system: its anchor is mapped to the neck
      // by Renderer. Only the downstream curve bends; the grip never separates.
      const x=-68+hc[2]*.8, mid=-66+hc[1]*.52, y=-208+Math.abs(h)*.18;
      assign(this.hair,'d',`M-32-390C-42-410-65-415-78-399C-92-382-89-351 ${mid-14}-319C${mid-21}-277 ${x-17} ${y-32} ${x} ${y}Q${x+8} ${y+7} ${x+17} ${y+1}C${x+4} ${y-33} ${mid+6}-286 ${mid+7}-320C${-55+hc[0]*.28}-352-57-379-32-390Z`,stats);
      assign(this.hairShade,'d',`M-76-394C-88-375-81-345 ${mid-10}-316C${mid-17}-274 ${x-13} ${y-30} ${x+2} ${y-3}C${x-6} ${y-38} ${mid-4}-282 ${mid-3}-319C-66-356-67-379-76-394Z`,stats);
      assign(this.hairLight,'d',`M-44-398C-61-404-73-394-74-374C-75-351 ${mid-5}-325 ${mid-6}-300C${mid-10}-265 ${x-5} ${y-36} ${x+4} ${y-12}`,stats);
      const hairLines=[
        `M-48-399C-63-399-70-386-69-369C-67-337 ${mid+1}-311 ${x+1} ${y-27}`,
        `M-60-400C-77-391-80-369 ${mid-9}-336C${mid-12}-302 ${x-12} ${y-39} ${x-2} ${y-10}`,
        `M-35-389C-57-378-56-353 ${mid+5}-328C${mid+10}-291 ${x+13} ${y-35} ${x+13} ${y-9}`
      ];
      this.hairLines.forEach((n,i)=>assign(n,'d',hairLines[i],stats));
      const pts=Array.from({length:12},(_,i)=>{
        const t=i/11,delayed=Math.sin(t*Math.PI*.9),wave=Math.sin(t*6-frame*.16)*f*t*t;
        const local=cc[Math.min(2,Math.floor(t*3))],lag=cc[0]*(1-t)+local*t;
        return[-25-29*Math.sin(t*Math.PI*.8)+lag*.75*t*t+wave,-207+121*t-Math.abs(lag)*.22*delayed];
      });
      assign(this.ribbon,'d',strip(pts,t=>6+10*Math.sin(Math.PI*t*.82)),stats);
      assign(this.ribbonShade,'d',smoothPath(pts.map((q,i)=>[q[0]-4-3*Math.sin(Math.PI*i/11),q[1]])),stats);
      assign(this.ribbonLight,'d',smoothPath(pts.map((q,i)=>[q[0]+3+3*Math.sin(Math.PI*i/11),q[1]])),stats);
      const end=pts.at(-1);assign(this.tassel,'transform',`translate(${end}) rotate(${c*.8})`,stats);

      // Each hip flap and the front panel has its own moving edge; their roots
      // remain in the pelvis frame while spring-chain lag changes the free ends.
      const left=clamp(cc[1]*.34,-13,13),right=clamp(cc[1]*.25,-10,10),tip=clamp(cc[2]*.45,-17,17),flutter=clamp(f*2,-5,5);
      const yaw=INK.VisualFrame?.get(p)?.materialAngles?.pelvis??INK.Turn.angle(p,'pelvis'),backStart=INK.Turn.bands(yaw,65).back[0];
      assign(this.frontRect,'x',-80,stats);assign(this.frontRect,'width',Math.max(0,backStart+80),stats);
      assign(this.backRect,'x',backStart,stats);assign(this.backRect,'width',Math.max(0,80-backStart),stats);
      assign(this.leftFlap,'d',`M-6-212C-22-225-42-227 ${-54+left}-211L${-46+left}-197Q-36-196-27-202L-9-207Z`,stats);
      assign(this.rightFlap,'d',`M5-212C23-226 41-226 ${53+right}-211L${45+right}-197Q36-196 27-202L8-207Z`,stats);
      assign(this.flapShade,'d',`M${-51+left*.8}-207Q${-41+left*.6}-202-28-205L-11-209-27-202Q${-38+left*.5}-196 ${-46+left}-197ZM9-209L27-202Q${38+right*.5}-196 ${45+right}-197L${51+right*.8}-207Q${38+right*.5}-201 27-205Z`,stats);
      assign(this.flapTrim,'d',`M${-45+left*.6}-211Q${-34+left*.35}-218-23-211M23-211Q${34+right*.35}-218 ${45+right*.6}-211`,stats);
      assign(this.flapLines,'d',`M${-47+left*.7}-204Q${-36+left*.4}-208-27-204M27-204Q${37+right*.4}-209 ${47+right*.7}-204`,stats);
      assign(this.apron,'d',`M-12-211Q0-214 12-211L${14+tip*.18}-187L${18+tip*.5}-148L${12+tip}-115Q${tip}-109 ${-16+tip}-116L${-20+tip*.5}-148L-17-184Z`,stats);
      assign(this.apronShadow,'d',`M-12-210L-16-183L${-19+tip*.5}-147L${-16+tip}-116L${-8+tip}-115L${-8+tip*.55}-151L-7-190Z`,stats);
      assign(this.apronLight,'d',`M5-210L9-183L${10+tip*.4}-154L${7+tip}-119L${tip}-114L${2+tip*.4}-154L1-190Z`,stats);
      assign(this.apronTrim,'d',`M-13-204L-15-184L${-18+tip*.5}-150L${-15+tip}-118`,stats);
      assign(this.apronFold,'d',`M-2-206Q${-5+flutter}-177 ${-4+tip*.4}-153L${-3+tip}-120M10-202Q${7+flutter}-176 ${9+tip*.4}-153`,stats);
      this.apronFlowers.forEach((n,i)=>assign(n,'transform',`translate(${(-5+i%2*12)+tip*(i+1)/5} ${-187+i*17}) scale(${.55+(i%2)*.14})`,stats));
      assign(this.backLeft,'d',`M-3 -214 Q-25 -229 -43 -214 L${-52+left} -183 Q${-42+left} -177 -28 -177 L-4 -188 Z`,stats);
      assign(this.backRight,'d',`M3 -214 Q25 -229 43 -214 L${52+right} -183 Q${42+right} -177 28 -177 L4 -188 Z`,stats);
      assign(this.backFold,'d',`M-39 -210 Q${-33+left*.5} -201 ${-12+left*.2} -193 M12 -193 Q${33+right*.5} -201 39 -210`,stats);
      assign(this.backSeams,'d',`M-38 -205 Q${-32+left*.5} -190 ${-27+left} -181 M38 -205 Q${32+right*.5} -190 ${27+right} -181 M-4 -208 L-4 -190 M4 -208 L4 -190`,stats);
    }
  }
  INK.MaiFan=MaiFan;INK.MaiSecondary=MaiSecondary;
})();
