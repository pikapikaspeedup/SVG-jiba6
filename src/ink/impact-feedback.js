/* FLOW 07 — phase-directed impact shapes, not an extra unbounded particle pool.
 * Contact is authored once by combat. The 320-slot world bank owns all births.
 * Delayed follow-through uses the same frozen simulation clock as the limbs.
 */
'use strict';
(() => {
  const {hash,materials}=INK.Particles;
  Object.assign(INK.Particles.shapes,{
    slash:'M-1.3 .55C-.95-.55 .05-1.3 1.3-.8C.25-.8-.65-.2-1.3 .55Z',
    shield:'M-.45-1C.65-.85.65.85-.45 1L-.25.7C.33.45.33-.45-.25-.7Z',
    cross:'M-1.2-.08L-.18-.17-.04-1 .15-.13 1.2.04.16.2.01 1-.15.14Z',
    thrust:'M-1.5-.07L.45-.16 1.2 0 .45.16-1.5.07Z'
  });
  function classify(m,result,last){
    if(result==='block'||result==='parry')return 'guard';
    if(m?.super&&last)return 'finisher';
    if(m?.kind==='upper'||m?.launch)return 'launch';
    if(m?.contactPart==='fan'||m?.base==='hissatsu')return 'fan';
    if(m?.contactPart==='foot'||m?.pose==='kick')return 'kick';
    return 'strike';
  }
  function direction(owner,m,kind,dir){
    if(kind==='launch')return dir===-1?-105:-75;
    if(kind==='fan')return dir===-1?205:-25;
    // Use the actual projected striking chain, bounded so a wildly edited
    // rig cannot aim the whole screen's impact feedback backwards.
    if(owner&&globalThis.SVG_FIGHTER&&INK.Runtime?.store){
      const p=SVG_FIGHTER.visualPose(owner),r=INK.Runtime.visualRig(owner,p),s=INK.Rig.sockets(p,r);
      const c=kind==='kick'?s.frontLeg:s.frontArm;
      const x=(c[2][0]-c[1][0])*dir,y=c[2][1]-c[1][1];
      if(Math.hypot(x,y)>2){const a=Math.atan2(y,x)*180/Math.PI;return Number.isFinite(a)?a:0;}
    }
    return dir===-1?180:0;
  }
  const Impact={events:[],
    classify,
    emit(pool,{x,y,frame,G,owner,m,result,last,dir,response,material,reduced}){
      const kind=classify(m,result,last),seed=hash([G.tick,owner?.index,m?.id,kind].join(':'));
      const angle=response?Math.atan2(response.responseDir[1],response.responseDir[0])*180/Math.PI+response.turn*20:direction(owner,m,kind,dir),multi=(m?.hits||1)>1&&!last,size=kind==='finisher'?37:multi?17:kind==='kick'?30:24;
      const add=(species,scale,rotation=angle,delay=0,life=10,opacity=.85)=>pool.add({x,y,birth:frame+delay,life,vx:0,vy:0,gravity:0,size:size*scale,angle:rotation,color:material.core,species,stretch:1,opacity,priority:4,
        sizeCurve:[[0,.75],[.22,1],[1,1.5]],opacityCurve:[[0,1],[.18,.88],[.65,.36],[1,0]]});
      if(kind==='guard')add('shield',1.1,dir===-1?180:0,0,11,.7);
      else if(kind==='fan'){add('slash',1.45,angle,0,multi?7:12);if(!reduced)add('slash',1.1,angle+20,2,11,.5);}
      else if(kind==='launch'){add('thrust',1.6,angle,0,9,.72);add('cross',.64,angle+35,0,7,.78);}
      else if(kind==='finisher'){add('cross',1.2,angle,0,9);add('ring',.9,0,2,15,.55);}
      else {add(kind==='kick'?'thrust':'cross',1,angle,0,multi?6:9);}
      // Intermediate blows are deliberately economical. The final contact
      // releases the slower debris instead of every hit spawning a smoke cloud.
      if(!multi&&kind!=='guard'&&!reduced){
        pool.emit({x,y,frame:frame+3,seed:seed+7,count:owner?.ch?.id==='mai'?4:3,material,
          direction:dir,angle:-42,spread:140,speed:2.5,life:24,size:2.5,
          species:owner?.ch?.id==='mai'?'petal':material.species,drag:.07,priority:1});
      }
      this.events.push({tick:G.tick,move:m?.id,kind,multi,angle,frame,response:response||null,delayed:!multi&&!reduced});if(this.events.length>128)this.events.shift();
      return kind;
    },
    clear(){this.events=[];}
  };
  INK.ImpactFeedback=Impact;
})();
