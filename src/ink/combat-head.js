/* Readable front-to-three-quarter combat heads. Fixed nodes, pure geometry. */
'use strict';
(() => {
 const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(v)?v:0)),fmt=v=>Number(v.toFixed(3));
 const profiles=Object.freeze({ryu:{jaw:25,chin:13,eye:1,brow:2.4},ken:{jaw:24,chin:12,eye:1.05,brow:2.1},chun:{jaw:21,chin:9,eye:1.12,brow:1.5},cammy:{jaw:21,chin:10,eye:1.02,brow:1.6},luke:{jaw:27,chin:15,eye:.95,brow:2.3},juri:{jaw:21,chin:9,eye:1.14,brow:1.8},mai:{jaw:19.5,chin:8.5,eye:1.18,brow:1.25},iori:{jaw:24,chin:11,eye:.9,brow:2}});
 const keys=['neck','skull','shade','cheek','earL','earR','eyeL','eyeR','irisL','irisR','pupilL','pupilR','glintL','glintR','lidL','lidR','browL','browR','nose','noseLight','mouth','teeth','lip','identity','hair','hairCap','hairFringe','hairLock','decor'];
 function sample(c,{look=0,mood={}}={}){
  const id=c.id,p=profiles[id]||profiles.ryu,l=clamp(look,-1,1),abs=Math.abs(l),head=clamp(mood.head),body=clamp(mood.body),leg=clamp(mood.leg),hurt=Math.max(head,body,leg*.6),guard=clamp(mood.guard)*(1-hurt),brace=clamp(mood.brace)*(1-head*.8),power=clamp(mood.power)*(1-hurt),center=l*7,jaw=p.jaw,chin=p.chin,parts={};
  const path=(key,d,extra={})=>parts[key]={d,...extra},point=(x,y)=>`${fmt(x)} ${fmt(y)}`;
  path('neck','M-12 14L-15 33-23 45Q0 54 23 45L14 32 12 14Z');
  // Width remains substantial at every heading; near cheek and jaw shift
  // independently from the forehead rather than mirroring the entire head.
  path('skull',`M-27-23Q-27-43 0-44Q27-43 28-23L${point(27+2*l,-3)}Q${point(jaw+center*.3,19)} ${point(chin+center,30)}Q${point(center,39)} ${point(-chin+center,30)}Q${point(-jaw+center*.3,19)} -27-3Z`);
  path('shade',id==='mai'?`M${point(-25+center*.15,-18)}Q${point(-24+center,7)} ${point(-11+center,24)}Q${point(-5+center,31)} ${point(center,34)}L${point(-chin+center,30)}Q-26 16-27-3Z`:`M${point(-24+center*.15,-18)}Q${point(-21+center,14)} ${point(center,34)}L${point(-chin+center,30)}Q-26 16-27-3Z`,{opacity:fmt((id==='mai'?.14:.22)+.08*abs)});
  path('cheek',`M${point(8+center,8)}Q${point(21+center*.35,4)} ${point(24+center*.25,9)}L${point(18+center*.5,22)} ${point(7+center,24)}Z`,{opacity:.22});
  for(const side of [-1,1]){const key=side<0?'L':'R',near=side*l,visibility=1-clamp(near)*.6,x=side*(25-abs*2),ex=center+side*(11-abs*2),width=(6.1+near*1.6)*p.eye,open=Math.max(.5,((id==='mai'?5.4:3.8)*(1-.88*head-.45*body-.2*leg-.35*guard-.55*brace)+power*.7)*(1-.95*clamp(mood.blink))),y=-2+body*.9,tilt=(({ryu:2.5,ken:2,chun:1.5,cammy:2.6,luke:2.2,juri:3.2,mai:1.3,iori:3.3}[id]||2)+guard*1.2+brace*1.5+power*2-head*2)*side;
   path('ear'+key,`M${point(x,-6)}Q${point(x+side*9,-9)} ${point(x+side*7,3)}Q${point(x+side*3,13)} ${point(x,8)}Z`,{opacity:fmt(visibility)});
   path('eye'+key,`M${point(ex-width,y)}Q${point(ex,y-open-tilt*.2)} ${point(ex+width,y-tilt*.35)}Q${point(ex,y+open*.65)} ${point(ex-width,y)}Z`,{opacity:fmt(1-clamp(-near)*.35),stroke:'none'});
   parts['iris'+key]={cx:fmt(ex+clamp(mood.gazeX??l,-1,1)*Math.max(0,width-3)*.38),cy:fmt(y-tilt*.12+clamp(mood.gazeY,-1,1)*open*.12),rx:fmt(Math.max(1.2,(id==='mai'?2.6:2.2)+near*.5)),ry:fmt(Math.max(.1,open*(id==='mai'?.46:.42))),opacity:fmt((1-head*.7)*clamp((open-.5)/1.2))};
   if(id==='mai'){
    const iris=parts['iris'+key];
    parts['pupil'+key]={cx:iris.cx,cy:iris.cy,rx:fmt(iris.rx*.47),ry:fmt(iris.ry*.76),opacity:iris.opacity};
    parts['glint'+key]={cx:fmt(iris.cx-.65),cy:fmt(iris.cy-Math.min(.65,iris.ry*.4)),rx:.65,ry:fmt(Math.min(.8,iris.ry*.4)),opacity:iris.opacity};
   }
   path('lid'+key,`M${point(ex-width,y)}Q${point(ex,y-open-tilt*.2)} ${point(ex+width,y-tilt*.35)}${id==='mai'?`M${point(ex+side*width,y-tilt*.25)}l${fmt(side*2.3)} -1.7M${point(ex+side*(width-1.2),y-tilt*.25)}l${fmt(side*1.7)} -2`:''}`,{'stroke-width':c.female?1.2:1.05});
   path('brow'+key,`M${point(ex-width,-10-tilt)}Q${point(ex,-12+hurt*2)} ${point(ex+width,-10+tilt)}`,{'stroke-width':p.brow});
  }
  const nose=center+l*4;
  path('nose',id==='mai'?`M${point(center+1,-4)}Q${point(nose+2,2)} ${point(nose+2*l,7)}L${point(nose-1.5,8.5)}M${point(nose+1.5,8.5)}L${point(nose+3.5,8)}`:`M${point(center,-6)}Q${point(nose,1)} ${point(nose+2*l,8)}L${point(nose-3,10)}M${point(nose+1,10)}L${point(nose+5,9)}`);
  path('noseLight',`M${point(center+2,-4)}L${point(nose+2,6)}`);
  const mouthX=center+l*1.4,mouthWidth=8+power*2+head*1.5,opening=head*6+body*5+leg*1.2+power*6+brace*2,smirk=id==='juri'?2*(1-hurt):0,my=19;
  path('mouth',id==='mai'&&opening<1?`M${point(mouthX-mouthWidth*.72,my)}Q${point(mouthX,my-1.1)} ${point(mouthX+mouthWidth*.72,my)}Q${point(mouthX,my+2)} ${point(mouthX-mouthWidth*.72,my)}Z`:`M${point(mouthX-mouthWidth,my)}Q${point(mouthX,my-smirk)} ${point(mouthX+mouthWidth,my-smirk)}L${point(mouthX+mouthWidth,my+opening-smirk)}Q${point(mouthX,my+opening-smirk)} ${point(mouthX-mouthWidth,my+opening)}Z`,{opacity:fmt(.65+.35*Math.max(hurt,power,brace))});
  path('teeth',`M${point(mouthX-mouthWidth+2,my+.5)}L${point(mouthX+mouthWidth-2,my-smirk+.5)} ${point(mouthX+mouthWidth-2,my+2)} ${point(mouthX-mouthWidth+2,my+2)}Z`,{opacity:fmt(clamp(brace+power*.8+head*.35))});
  path('lip',`M${point(mouthX-3,my+opening+5)}Q${point(mouthX,my+opening+6)} ${point(mouthX+3,my+opening+5)}`,{opacity:.28});
  path('identity',id==='ryu'?`M${point(-18+center*.5,16)}L${point(center-6,29)} ${point(center+10,32)}M${point(center-9,25)}l3 3M${point(center+1,29)}l3 2`:id==='luke'?`M${point(center-17,5)}l4 6M${point(center-13,4)}l4 6`:id==='cammy'?`M${point(center+12,7)}l5 4`:id==='iori'?`M${point(center-12,3)}l7-1`:'',{opacity:.65});
  // Original silhouettes and identifying accessories remain fixed assets;
  // modest parallax does not swap or flip their authored topology.
  parts.hair={opacity:['iori','ken'].includes(id)?0:1,transform:`translate(${fmt(l*2)} 0)`};parts.decor={transform:`translate(${fmt(l*2.5)} 0)`};
  const sculpted=id==='iori'||id==='ken',lock=-23*l-8*(1-abs),color=id==='iori'?'#a62d4b':'#d9b25c';
  path('hairCap',id==='iori'?'M-29-12Q-35-39-12-47L12-46Q35-36 29-12L20-23 4-30-12-26Z':'M-29-10L-34-27-24-37-11-45 5-46 24-38 32-22 27-6 20-19 6-27-10-21Z',{opacity:sculpted?1:0,fill:color});
  path('hairFringe',`M-26-25Q-5-43 25-25L${point(13+l*5,-10)} ${point(5+l*4,-21)} ${point(-4+l*5,-12)} ${point(-12+l*3,-22)} -23-9Z`,{opacity:sculpted?1:0,fill:color});
  path('hairLock',id==='iori'?`M${point(lock-8,-29)}Q${point(lock-2,-32)} ${point(lock+8,-24)}Q${point(lock+5,4)} ${point(lock-2,25)}L${point(lock-9,34)}Q${point(lock-5,7)} ${point(lock-8,-29)}Z`:`M${point(lock-6,-24)}L${point(lock+3,-18)} ${point(lock+2,9)} ${point(lock-4,18)} ${point(lock-9,-3)}Z`,{opacity:sculpted?1:0,fill:color});
  return {look:l,mood:{head,body,leg,guard,brace,power},parts};
 }
 function markup(c){
  const palette=globalThis.SF6Art?.palette?.[c.id]||{skin:['#e4b596','#c99073','#885849'],hair:['#4a3a34','#29252a','#15171b']},skin=`url(#atelier-${c.id}-skin)`,hair=`url(#atelier-${c.id}-hair)`,s=sample(c),stroke='#332d35';
  const attrs=o=>Object.entries(o).map(([k,v])=>`${k}="${String(v).replaceAll('&','&amp;').replaceAll('"','&quot;')}"`).join(' ');
  return keys.map(key=>{if(!s.parts[key])return '';const common={'data-combat-head':key,...s.parts[key]};delete common['stroke-width'];delete common.fill;delete common.stroke;if(key==='hair'||key==='decor')return `<g ${attrs(common)}>${key==='hair'?`<path d="${INK.Art?.[c.id]?.hair||''}" fill="${hair}" stroke="${stroke}" stroke-width="1.25"/>`:INK.Art?.[c.id]?.decoration(c,palette,skin,hair)||''}</g>`;
   if(key.startsWith('pupil')||key.startsWith('glint'))return `<ellipse ${attrs(common)} fill="${key.startsWith('glint')?'#fff7e8':'#221b21'}"/>`;
   if(key.startsWith('iris'))return `<ellipse ${attrs(common)} fill="${c.id==='juri'?'#976492':c.id==='chun'||c.id==='cammy'?'#648785':'#493e40'}"/>`;
   const line=/^(lid|brow|nose|lip|identity)/.test(key),fill=key==='shade'?palette.skin[2]:key==='cheek'?palette.skin[0]:key.startsWith('eye')?'#f8e9da':key==='mouth'?'#63333d':key==='teeth'?'#fff2d9':line?'none':skin;
   return `<path ${attrs(common)} fill="${s.parts[key]?.fill||fill}" stroke="${s.parts[key]?.stroke|| (key==='noseLight'?palette.skin[0]:line?stroke:key==='shade'||key==='cheek'?'none':stroke)}" stroke-width="${s.parts[key]?.['stroke-width']??(line?1:1.2)}" stroke-linecap="round" stroke-linejoin="round"/>`;}).join('');
 }
 INK.CombatHead={profiles,sample,markup,keys:Object.freeze(keys)};
})();
