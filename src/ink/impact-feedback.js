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
    thrust:'M-1.5-.07L.45-.16 1.2 0 .45.16-1.5.07Z',
    brace:'M-.9-.45L-.3-.75.55-.6.9-.15.7.55-.1.8-.8.4ZM-.5-.1L.05-.35.5.1-.05.35Z'
  });
  function classify(m,result,last){
    if(result==='armor')return 'brace';
    if(result==='block'||result==='parry')return 'guard';
    if(m?.super&&last)return 'finisher';
    if(m?.kind==='upper'||m?.launch)return 'launch';
    if(m?.contactPart==='fan'||m?.base==='hissatsu')return 'fan';
    if(m?.contactPart==='foot'||m?.pose==='kick')return 'kick';
    return 'strike';
  }
  function direction(owner,m,kind,dir){
    // Use the actual projected striking chain, bounded so a wildly edited
    // rig cannot aim the whole screen's impact feedback backwards.
    if(owner&&globalThis.SVG_FIGHTER&&INK.Runtime?.store){
      const p=SVG_FIGHTER.visualPose(owner),r=INK.Runtime.visualRig(owner,p),s=INK.Rig.sockets(p,r);
      const c=kind==='kick'?s.frontLeg:s.frontArm;
      const world={x:owner.x,y:665+owner.y,scale:owner.renderScale||owner.ch.scale||1,facing:dir},end=INK.Rig.world(p,c[2],world),joint=INK.Rig.world(p,c[1],world),x=end[0]-joint[0],y=end[1]-joint[1];
      if(Math.hypot(x,y)>2){const a=Math.atan2(y,x)*180/Math.PI;return Number.isFinite(a)?a:0;}
    }
    return dir===-1?180:0;
  }
  const Impact={events:[],
    classify,
    emit(pool,{x,y,frame,G,owner,m,result,last,dir,response,incoming,material,reduced}){
      const kind=classify(m,result,last),seed=hash([G.tick,owner?.index,m?.id,kind].join(':'));
      const facts=INK.StrikeFeel?.contactSound({response,incoming,direction:dir}),observed=Array.isArray(incoming)&&incoming.slice(0,2).every(Number.isFinite)&&Math.hypot(...incoming)>1e-6;
      const angle=observed?Math.atan2(incoming[1],incoming[0])*180/Math.PI:direction(owner,m,kind,dir),multi=(m?.hits||1)>1&&!last,zone=response?.zone||'body',size=(kind==='finisher'?32:multi?14:kind==='kick'?26:21)*(facts?.mode==='glance'?.72:1),normalAngle=facts?Math.atan2(facts.normal[1],facts.normal[0])*180/Math.PI:angle;

      const causal=INK.ContactFlux?.active()&&m&&!m.throw;
      const add=(species,scale,rotation=angle,delay=0,life=10,opacity=.85,stretch=1)=>pool.add({x,y,birth:frame+delay,life,vx:0,vy:0,gravity:0,size:size*scale*(causal?.65:1),angle:rotation,color:material.core,species,stretch,opacity:opacity*(causal?.45:1),priority:4,
        sizeCurve:[[0,.75],[.22,1],[1,1.5]],opacityCurve:[[0,1],[.18,.88],[.65,.36],[1,0]]});
      if(kind==='brace')add('brace',.75,normalAngle,0,7,.6);
      else if(kind==='guard')add('shield',.9,normalAngle,0,9,.65,.65);
      else if(facts?.mode==='slice'){add('slash',1.15,angle,0,multi?5:8,.72,1.25);}
      else if(facts?.mode==='glance'){add('thrust',.8,angle,0,5,.6,1.2);}
      else if(kind==='fan'){add('slash',1.45,angle,0,multi?7:12);if(!reduced&&!multi)add('slash',1.1,angle+20,2,11,.5);}
      else if(kind==='launch'){add('thrust',1.35,angle,0,8,.72);if(!reduced&&!multi)add('cross',.55,angle+35,0,6,.65);}
      else if(kind==='finisher'){add('cross',1.1,angle,0,8);if(!multi&&!reduced)add('thrust',.7,angle,2,7,.45);}
      else {add(zone==='leg'||kind==='kick'?'thrust':'cross',facts?.body??1,angle,0,multi?5:8,.8,zone==='body'?.8:1);}
      // Intermediate blows are deliberately economical. The final contact
      // releases the slower debris instead of every hit spawning a smoke cloud.
      if(!multi&&kind!=='guard'&&kind!=='brace'&&!reduced&&facts?.mode!=='glance'){
        pool.emit({x,y,frame:frame+3,seed:seed+7,count:2,material,
          direction:1,angle:angle+(facts?.mode==='slice'?35:-20),spread:facts?.mode==='slice'?35:85,speed:1.8,life:18,size:1.8,
          species:owner?.ch?.id==='mai'?'petal':material.species,drag:.07,priority:1});
      }
      this.events.push({tick:G.tick,move:m?.id,kind,multi,angle,zone,contact:facts,frame,response:response||null,delayed:!multi&&kind!=='guard'&&kind!=='brace'&&!reduced&&facts?.mode!=='glance'});if(this.events.length>128)this.events.shift();
      return kind;
    },
    clear(){this.events=[];}
  };
  INK.ImpactFeedback=Impact;
})();
