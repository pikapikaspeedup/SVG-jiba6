/* Real-contact geometry snapshots. Rendering reads; it never records collisions. */
'use strict';
(() => {
 let history=new WeakMap(),serial=0,independent=[];
 const settings={enabled:true},active=()=>settings.enabled&&INK.Kinetic?.settings.enabled!==false;
 const results=new Set(['hit','block','parry','armor']);
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const finite=p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1]);
 const unit=(v,fallback=[1,0])=>{if(typeof v==='number')v=[v,0];if(!finite(v))return fallback.slice();const n=Math.hypot(...v);return n>1e-8?[v[0]/n,v[1]/n]:fallback.slice();};
 const frozen=p=>Object.freeze(p.slice(0,2));
 function commit(source,config={}){
  if(!active()||!results.has(config.result)||!finite(config.point))return null;
  const born=config.born??INK.VFX?.time;if(!Number.isFinite(born))return null;
  const object=source!==null&&(typeof source==='object'||typeof source==='function'),prior=object?history.get(source)||[]:independent;
  const incoming=unit(config.incoming??config.responseDir),responseDir=unit(config.responseDir,incoming);
  const key=config.id??[born,config.result,...config.point,config.character||'ryu',config.category||'normal',config.strength||1,config.part||'',config.multi||0,config.last??''].join(':');
  const duplicate=prior.find(c=>c.id===key);if(duplicate)return duplicate;
  const c=Object.freeze({id:key,serial:++serial,point:frozen(config.point),incoming:frozen(incoming),responseDir:frozen(responseDir),result:config.result,born,life:12,duration:12,character:config.character||'ryu',category:config.category||'normal',strength:clamp(Number.isFinite(config.strength)?config.strength:1,1,3),multi:config.multi??false,last:config.last??true,part:config.part||null,scale:1});
  if(object)history.set(source,[...prior,c].slice(-8));else independent=[...prior,c].slice(-8);return c;
 }
 function read(source,time){if(!active()||!source||!['object','function'].includes(typeof source)||!Number.isFinite(time))return null;const rows=history.get(source)||[];for(let i=rows.length-1;i>=0;i--){const c=rows[i];if(time>=c.born&&time-c.born<c.life)return c;}return null;}
 function local(c,pointFn){
  if(!c||typeof pointFn!=='function')return null;
  const p=pointFn(c.point.slice()),i=pointFn([c.point[0]+c.incoming[0],c.point[1]+c.incoming[1]]),r=pointFn([c.point[0]+c.responseDir[0],c.point[1]+c.responseDir[1]]);
  if(!finite(p)||!finite(i)||!finite(r))return null;
  const scale=Math.hypot(i[0]-p[0],i[1]-p[1]);if(scale<1e-8)return null;
  return Object.freeze({...c,point:frozen(p),incoming:frozen(unit([i[0]-p[0],i[1]-p[1]])),responseDir:frozen(unit([r[0]-p[0],r[1]-p[1]])),scale:c.scale*scale});
 }
 const envelope=(c,time)=>c&&Number.isFinite(time)&&time>=c.born?clamp(1-(time-c.born)/c.life,0,1)**2:0;
 function deform(points,c,time){
  if(!Array.isArray(points)||points.some(p=>!finite(p)))throw TypeError('ContactFlux requires finite 2D points');
  const fade=active()?envelope(c,time):0;if(!fade)return points.map(p=>p.slice(0,2));
  const scale=c.scale||1,radius=(c.category==='normal'?64:90)*scale,n=c.incoming,t=[-n[1],n[0]],normal=c.category==='normal';
  const strength=(normal?.7:1)*(.8+.15*c.strength),out=[];
  for(const p of points){const x=p[0]-c.point[0],y=p[1]-c.point[1],d=Math.hypot(x,y),u=clamp(1-d/radius,0,1),w=u*u*(3-2*u)*fade*strength;let dx=0,dy=0;
   if(w){const along=x*n[0]+y*n[1],across=x*t[0]+y*t[1];let forward=0,side=0;
    if(c.result==='hit')forward=13*scale;
    else if(c.result==='block'){forward=-along*.75;side=across*.48;}
    else if(c.result==='armor')forward=-Math.max(0,along)*.85-3*scale;
    else {forward=-Math.max(0,along)*.65;const turn=c.responseDir[0]*t[0]+c.responseDir[1]*t[1];side=(Math.abs(turn)>.1?Math.sign(turn):-1)*(12*scale+Math.max(0,along)*.35);}
    dx=(n[0]*forward+t[0]*side)*w;dy=(n[1]*forward+t[1]*side)*w;const len=Math.hypot(dx,dy),max=24*scale;if(len>max){dx*=max/len;dy*=max/len;}
   }out.push([p[0]+dx,p[1]+dy]);
  }return out;
 }
 const modes={ryu:'wave',ken:'fire',chun:'silk',cammy:'cut',luke:'pressure',juri:'vortex',mai:'fan',iori:'claw'};
 function section(c,time,style={}){
  const fade=active()?envelope(c,time):0;if(!fade)return [];
  const normal=c.category==='normal',reduced=!!style.reduced,intermediate=!!c.multi&&!c.last,detailScale=intermediate?.7:1,count=normal||reduced?1:intermediate?2:3,mode=style.mode||modes[c.character],scale=c.scale||1,n=c.incoming,t=[-n[1],n[0]],color=style.color||'#bcecff',core=style.core||'#ffffff';
  // Apply contact response after the character's canonical path is chosen so
  // flame/fan/claw/vortex overrides cannot erase collision causality.
  const point=(a,b)=>{
   if(c.result==='hit')a=a*1.15+(reduced?0:8);
   else if(c.result==='block'){a*=.36;b*=1.25;}
   else if(c.result==='armor'){a=a*.42-(reduced?0:3);b*=.65;}
   else {const side=c.responseDir[0]*t[0]+c.responseDir[1]*t[1],sign=Math.abs(side)>.1?Math.sign(side):-1,oldA=a;a=a*.45-b*(reduced?.16:.38)*sign;b=b*.72+oldA*(reduced?.25:.55)*sign+(reduced?0:9)*sign;}
   return [c.point[0]+scale*detailScale*(n[0]*a+t[0]*b),c.point[1]+scale*detailScale*(n[1]*a+t[1]*b)].map(v=>v.toFixed(2)).join(' ');
  },layers=[];
  for(let j=0;j<count;j++){
   const length=(normal?12:22+j*7)*(.7+.3*c.strength)*(reduced?.55:1),bend=c.result==='hit'?10:c.result==='armor'?2:c.result==='parry'?-12:-5,offset=j*3;
   let d='M'+point(offset,-length)+'Q'+point(bend+offset,0)+' '+point(offset,length);
   if(mode==='cut'||mode==='pressure')d='M'+point(offset,-length)+'L'+point(bend+offset,0)+'L'+point(offset,length);
   if(mode==='claw')d='M'+point(-6+j*4,-length)+'Q'+point(12+j*3,0)+' '+point(-3+j*4,length*.6);
   if(mode==='fan')d='M'+point(-4,0)+'Q'+point(10+j*2,-length)+' '+point(4+j*4,length);
   if(mode==='vortex')d='M'+point(-6,-length)+'C'+point(18,-length)+' '+point(-18,length)+' '+point(6,length);
   if(mode==='fire')d='M'+point(0,-length)+'L'+point(8+j*3,-length*.3)+'L'+point(-4,length*.2)+'L'+point(3,length);
   layers.push({d,fill:'none',stroke:j===0?core:color,width:(normal?1.4:j===0?2.2:1.2)*scale*detailScale,opacity:fade*(normal?.48:.65-j*.12)});
  }return layers;
 }
 const clear=()=>{history=new WeakMap();serial=0;independent=[];};
 INK.ContactFlux={settings,active,commit,read,local,deform,section,clear};
})();
