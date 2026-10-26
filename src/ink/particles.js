/* INK FLOW particle kernel. SVG-only; fixed capacity, seeded births, analytical
 * integration and retained nodes. Rendering does not mutate simulation or RNG.
 * Units: SVG user units, frames at 60 Hz. No canvas, filters or raster textures.
 */
'use strict';
(() => {
  const {clamp,lerp,rad}=INK,{node,assign}=INK.SVG;
  const shapes={
    impact:'M0-1L.15-.2 .65-.7 .3-.05 1 0 .2.16 .6.8 .03.3-.4 1-.15.2-1 .35-.3-.04-.8-.7-.15-.2Z',
    spark:'M-1 0L0-1 1 0 0 1Z',
    ember:'M-1 .5Q-1.3-1.2 .2-2.6Q.1-.8 1-.5Q1.3 .9 0 1Z',
    smoke:'M-1 0C-1-1-.35-1.3 .3-.9C1.2-1.1 1.4.1 .8.5C.6 1.3-.8 1.1-1 0Z',
    shard:'M-1 0L.6-.35 1 0 .3.3Z',
    ring:'M1 0A1 1 0 1 0-1 0A1 1 0 1 0 1 0Z',
    petal:'M-1 .3C-1.5-1.1-.2-1.9 .7-1.3C1.7-.7 1 .6-.1 1.2Z',
    fleck:'M-1 0Q0-1 1-.25L.2.5-.7.35Z'
  };
  const materials={
    ryu:{color:'#6ad4ed',core:'#e4feff',dark:'#3289b6',species:'shard',gravity:.02},
    ken:{color:'#ff8244',core:'#fff5bf',dark:'#a3472d',species:'ember',gravity:-.11},
    chun:{color:'#66dcc8',core:'#edfff1',dark:'#369c9e',species:'fleck',gravity:-.04},
    cammy:{color:'#94d6ef',core:'#f4ffff',dark:'#427e9e',species:'shard',gravity:.01},
    luke:{color:'#e9b26a',core:'#fff5d2',dark:'#95674d',species:'spark',gravity:.11},
    juri:{color:'#c88fff',core:'#fff1ff',dark:'#754bb3',species:'shard',gravity:-.035},
    mai:{color:'#ffad64',core:'#fff0be',dark:'#b5465c',species:'ember',gravity:-.105},
    iori:{color:'#a881ed',core:'#fae7ff',dark:'#573899',species:'ember',gravity:-.085},
    drive:{color:'#80fcb3',core:'#e8ffbd',dark:'#32ab91',species:'fleck',gravity:-.02},
    guard:{color:'#79cdeb',core:'#e9faff',dark:'#549ab7',species:'shard',gravity:0}
  };
  function hash(value){let n=2166136261;for(const ch of String(value))n=Math.imul(n^ch.charCodeAt(0),16777619);return n>>>0;}
  function random(seed,index=0){let x=(seed+Math.imul(index+1,0x9e3779b9))>>>0;x^=x>>>16;x=Math.imul(x,0x21f0aaad);x^=x>>>15;x=Math.imul(x,0x735a2d97);return ((x^(x>>>15))>>>0)/4294967296;}
  function curve(keys,u,fallback=1){if(!keys?.length)return fallback;let i=1;while(i<keys.length&&keys[i][0]<u)i++;if(i===keys.length)return keys.at(-1)[1];const a=keys[Math.max(0,i-1)],b=keys[i];const t=a[0]===b[0]?0:clamp((u-a[0])/(b[0]-a[0]));return a[1]+(b[1]-a[1])*t;}
  function heatColor(u) {
    const stops=[[0,[255,245,206]],[.3,[255,173,90]],[.7,[218,89,70]],[1,[111,48,72]]];
    let i=1;while(i<stops.length-1&&stops[i][0]<u)i++;const a=stops[i-1],b=stops[i],t=clamp((u-a[0])/(b[0]-a[0]));
    return '#'+a[1].map((x,j)=>Math.round(x+(b[1][j]-x)*t).toString(16).padStart(2,'0')).join('');
  }
  function sample(p,t){const age=t-p.birth;if(age<0||age>=p.life)return null;const u=age/p.life,k=p.drag||0;
    const travel=k>1e-6?-Math.expm1(-k*age)/k:age;
    const accelerationTravel=k>1e-6?(age-travel)/k:.5*age*age;
    return {x:p.x+p.vx*travel+(p.gravityX||0)*accelerationTravel+(p.curlX??p.curl??0)*(Math.sin(age*.21+(p.phase||0))-Math.sin(p.phase||0)),
      y:p.y+p.vy*travel+(p.gravity||0)*accelerationTravel+(p.curlY||0)*(Math.sin(age*.21+(p.phase||0))-Math.sin(p.phase||0)),
      size:p.size*(p.sizeCurve?curve(p.sizeCurve,u):p.species==='smoke'?.45+u*1.6:p.species==='ring'?.25+u*1.8:1-u*.55),
      angle:p.angle+(p.spin||0)*age+(p.species==='petal'?Math.sin(age*.24)*22:0),
      opacity:p.opacity*(p.opacityCurve?curve(p.opacityCurve,u):Math.min(1,age*1.8+.35)*(1-u)**(p.species==='smoke'?1.5:.7)),
      color:p.heat?heatColor(u):p.color,stretch:(p.stretch||1)*(p.species==='petal'?.55+Math.abs(Math.cos(age*.16))*.45:1)};
  }
  class ParticleSystem {
    constructor(parent,{capacity=160,quality=1}={}) {
      if(!Number.isInteger(capacity)||capacity<1||capacity>2048)throw RangeError('Particle capacity 1..2048');
      this.capacity=capacity;this.quality=quality;this.root=node('g',{'data-ink-particles':'retained','pointer-events':'none'},parent);
      this.nodes=Array.from({length:capacity},()=>node('path',{display:'none'},this.root));
      this.live=Array(capacity).fill(null);this.free=Array.from({length:capacity},(_,i)=>capacity-1-i);
      this.stats={active:0,peak:0,dropped:0,evicted:0,capacity};this.lastTime=0;
    }
    add(p){
      let i;
      if(!this.free.length){
        const priority=p.priority||0;let candidate=-1;
        for(let j=0;j<this.live.length;j++){const old=this.live[j];if((old.priority||0)<priority&&(candidate<0||(old.priority||0)<(this.live[candidate].priority||0)||((old.priority||0)===(this.live[candidate].priority||0)&&old.birth<this.live[candidate].birth)))candidate=j;}
        if(candidate<0){this.stats.dropped++;return false;}i=candidate;this.stats.evicted++;
      }else{i=this.free.pop();this.stats.active++;}
      this.live[i]={...p};this.stats.peak=Math.max(this.stats.peak,this.stats.active);return true;
    }
    emit({x,y,frame,seed=1,count=16,material=materials.ryu,direction=1,angle=0,spread=100,speed=7,life=22,size=2.4,species,opacity=.85,gravity,drag=.055,priority=0,curl=0}) {
      const n=Math.min(100,Math.max(0,Math.round(count*this.quality)));
      for(let i=0;i<n;i++){const a=rad(angle+(random(seed,i*7)-.5)*spread),v=speed*(.3+random(seed,i*7+1)*.95),type=species||material.species;
        this.add({x,y,birth:frame,life:life*(.65+random(seed,i*7+2)*.65),vx:Math.cos(a)*v*direction,vy:Math.sin(a)*v,
          gravity:gravity??material.gravity,drag,size:size*(.55+random(seed,i*7+3)),angle:(angle+(random(seed,i*7+4)-.5)*spread)*(direction===-1?-1:1),
          spin:['ember','petal'].includes(type)?(random(seed,i*7+5)-.5)*7:0,color:i%4===0?material.core:material.color,species:type,
          priority,curl,phase:random(seed,i*7+5)*Math.PI*2,stretch:['spark','shard'].includes(type)?3+random(seed,i*7+6)*5:1,opacity});
      }
    }
    draw(i,p,t){const n=this.nodes[i],v=sample(p,t);if(!v||v.size<=1e-6||v.opacity<=0){assign(n,'display','none');return false;}
      assign(n,'display','inline');assign(n,'d',shapes[p.species]||shapes.spark);assign(n,'fill',p.species==='ring'?'none':v.color);
      assign(n,'stroke',p.species==='ring'?p.color:'none');assign(n,'stroke-width',p.species==='ring'?Math.max(.025,.8/v.size):0);
      assign(n,'transform',`translate(${v.x.toFixed(2)} ${v.y.toFixed(2)}) rotate(${v.angle.toFixed(2)}) scale(${(v.size*v.stretch).toFixed(3)} ${v.size.toFixed(3)})`);
      assign(n,'opacity',v.opacity.toFixed(3));return true;
    }
    render(t){for(let i=0;i<this.capacity;i++){const p=this.live[i];if(p)this.draw(i,p,t);}this.lastTime=t;}
    step(t){for(let i=0;i<this.capacity;i++){const p=this.live[i];if(p&&t>=p.birth+p.life){this.live[i]=null;this.free.push(i);this.stats.active--;assign(this.nodes[i],'display','none');}}}
    clear(){for(let i=0;i<this.capacity;i++){this.live[i]=null;assign(this.nodes[i],'display','none');}this.free=Array.from({length:this.capacity},(_,i)=>this.capacity-1-i);this.stats.active=0;}
    destroy(){this.root.remove();this.live=[];this.nodes=[];}
  }
  INK.Particles={ParticleSystem,materials,hash,random,sample,shapes,curve,heatColor};
})();
