/* FLOW panorama and continuous combat framing. Wide, vector-authored scenery;
 * no duplicated suns, no teleporting actors and no changed collision bounds. */
'use strict';
(()=>{
 const N=INK.SVG.node;
 function panorama(parent){
  const g=N('g',{'data-flow-stage':'panorama'},parent),defs=N('defs',{},g);
  const sky=N('linearGradient',{id:'flow-sky',x2:0,y2:1},defs);N('stop',{'stop-color':'#152328'},sky);N('stop',{offset:1,'stop-color':'#50615e'},sky);
  const floor=N('linearGradient',{id:'flow-floor',x2:0,y2:1},defs);N('stop',{'stop-color':'#425553'},floor);N('stop',{offset:1,'stop-color':'#202f32'},floor);
  N('path',{d:'M-1100-600H2750V900H-1100Z',fill:'url(#flow-sky)'},g);
  // One sunset, viewed through a wide industrial training hall.
  N('circle',{cx:580,cy:328,r:106,fill:'#d3a57b',opacity:'.34'},g);
  for(let i=0;i<24;i++){const x=-1050+i*170,h=65+(i*83)%140;N('path',{d:`M${x} 535V${530-h}h${76+i%3*22}V535Z`,fill:i%2?'#314446':'#283c40'},g);}
  N('path',{d:'M-1100 520H2750V627H-1100Z',fill:'#293e3f'},g);
  for(let x=-1000;x<2700;x+=60)N('path',{d:`M${x} 526l72 101m0-101l-72 101`,stroke:'#687e70','stroke-width':'.5',opacity:'.26',fill:'none'},g);
  // Steel ribs, overhead rafters and practical lamps.
  for(let x=-1050;x<2750;x+=315){N('path',{d:`M${x} 24h20v602h-20ZM${x+20} 145l80-83h30l-110 121Z`,fill:'#1b2d32'},g);N('path',{d:`M${x+28} 110h240v8h-240Z`,fill:'#9eaa90',opacity:'.2'},g);N('path',{d:`M${x+76} 146h93l8 6h-109Z`,fill:'#e7d3a1',opacity:'.55'},g);}
  N('path',{d:'M-1100 0H2750V90H-1100Z',fill:'#17272d'},g);N('path',{d:'M-1100 90H2750M-1100 118H2750',stroke:'#73937e','stroke-width':1,opacity:'.3'},g);
  N('path',{d:'M-1100 626H2750V1100H-1100Z',fill:'url(#flow-floor)'},g);N('path',{d:'M-1100 650H2750M-1100 665H2750M-1100 734H2750M-1100 838H2750',stroke:'#a6b8a0','stroke-width':1,opacity:'.24',fill:'none'},g);
  for(let x=-2000;x<3500;x+=260)N('path',{d:`M${720+(x-720)*.6} 626L${x} 960`,stroke:'#849b89','stroke-width':1,opacity:'.16'},g);
  for(const x of [105,1335]){N('path',{d:`M${x-84} 661h160m-149 10h25m8 0h25m8 0h25m8 0h25`,stroke:'#d6ae79','stroke-width':3,opacity:'.52'},g);const t=N('text',{x:x-75,y:622,fill:'#a7beb0','font-family':'monospace','font-size':11,'letter-spacing':3,opacity:'.65'},g);t.textContent='CORNER / 端';}
  const sign=N('g',{transform:'translate(890 371)'},g);N('path',{d:'M0 0h332v92H0Z',fill:'#1d3033',stroke:'#6a8477','stroke-width':1},sign);let text=N('text',{x:21,y:32,fill:'#e3c7a1','font-family':'monospace','font-size':13,'letter-spacing':7},sign);text.textContent='INK / FLOW 05';text=N('text',{x:21,y:68,fill:'#879f90','font-family':'monospace','font-size':11,'letter-spacing':3},sign);text.textContent='MOTION • COMBO HALL';
  return g;
 }
 INK.Cinema={enabled:true,mounted:false,
  sync(active){const camera=document.getElementById('camera');if(!camera)return;
   if(!this.mounted){this.external=camera.querySelector('image');this.background=document.getElementById('background');this.stage=panorama(camera);camera.insertBefore(this.stage,document.getElementById('ground-fx'));this.mounted=true;}
   const wide=globalThis.SVG_FIGHTER?.state.stage==='forge';this.stage.style.display=wide?'':'none';if(this.external)this.external.style.display=wide?'none':'';if(this.background)this.background.style.display=wide?'none':'';
  }
 };
})();
