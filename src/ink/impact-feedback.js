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
    brace:'M-.9-.45L-.3-.75.55-.6.9-.15.7.55-.1.8-.8.4ZM-.5-.1L.05-.35.5.1-.05.35Z',
    deflect:'M-.65-.9Q.8-.1-.6.8L-.15.35Q.15.03-.05-.2ZM-.1-.2L.9-.8.35-.18Z'
  });
  function classify(m,result,last){
    if(result==='armor')return 'brace';
    if(result==='parry')return 'parry';
    if(result==='block')return 'guard';
    if(m?.super&&last)return 'finisher';
    if(m?.kind==='upper'||m?.launch)return 'launch';
    if(m?.contactPart==='fan'||m?.base==='hissatsu')return 'fan';
    if(m?.contactPart==='foot'||m?.pose==='kick')return 'kick';
    return 'strike';
  }
  const Impact={events:[],
    classify,
    emit(pool,{x,y,frame,G,owner,m,result,last,dir,response,incoming,impactScore,material,reduced}){
      if(impactScore&&this.events.some(e=>e.impactScore?.contactID===impactScore.contactID))return classify(m,result,last);
      const kind=classify(m,result,last),seed=hash([G.tick,owner?.index,m?.id,kind].join(':'));
      const facts=INK.StrikeFeel?.contactSound({impactScore,response,incoming,direction:dir}),observed=Array.isArray(incoming)&&incoming.slice(0,2).every(Number.isFinite)&&Math.hypot(...incoming)>1e-6;
      const force=impactScore?.forceWorld||impactScore?.incomingWorld,angle=impactScore?Math.atan2(force[1],force[0])*180/Math.PI:observed?Math.atan2(incoming[1],incoming[0])*180/Math.PI:dir===-1?180:0,multi=impactScore?.rhythm.intermediate??((m?.hits||1)>1&&!last),zone=impactScore?.zone||response?.zone||'body',size=(kind==='finisher'?32:multi?14:kind==='kick'?26:21)*(facts?.mode==='glance'?.72:1)*(impactScore?.energy?(.7+.3*impactScore.energy):1),normalAngle=facts?Math.atan2(facts.normal[1],facts.normal[0])*180/Math.PI:angle;

      const causal=!impactScore&&INK.ContactFlux?.active()&&m&&!m.throw;let used=0;const budget=m?.category==='normal'||multi||reduced?1:2;
      const add=(species,scale,rotation=angle,delay=0,life=10,opacity=.85,stretch=1)=>{if(used++>=budget)return;return pool.add({x,y,birth:frame+delay,life,vx:0,vy:0,gravity:0,size:size*scale*(causal?.65:1),angle:rotation,color:material.core,species,stretch,opacity:opacity*(causal?.45:1),priority:4,
        sizeCurve:[[0,.75],[.22,1],[1,1.5]],opacityCurve:[[0,1],[.18,.88],[.65,.36],[1,0]]});};
      if(kind==='brace')add('brace',.75,normalAngle,0,7,.6);
      else if(kind==='parry')add('deflect',.9,normalAngle,0,6,.85,.7);
      else if(kind==='guard')add('shield',.9,normalAngle,0,9,.65,.65);
      else if(facts?.mode==='slice'){add('slash',1.15,angle,0,multi?5:8,.72,1.25);}
      else if(facts?.mode==='glance'){add('thrust',.8,angle,0,5,.6,1.2);}
      else if(kind==='fan'){add('slash',1.45,angle,0,multi?7:12);if(!reduced&&!multi)add('slash',1.1,angle+20,2,11,.5);}
      else if(kind==='launch'){add('thrust',1.35,angle,0,8,.72);if(!reduced&&!multi)add('cross',.55,angle+35,0,6,.65);}
      else if(kind==='finisher'){add('cross',1.1,angle,0,8);if(!multi&&!reduced)add('thrust',.7,angle,2,7,.45);}
      else {add(zone==='leg'||kind==='kick'?'thrust':'cross',facts?.body??1,angle,0,multi?5:8,.8,zone==='body'?.8:1);}
      // Intermediate blows are deliberately economical. The final contact
      // releases the slower debris instead of every hit spawning a smoke cloud.
      if(!impactScore&&!multi&&kind!=='guard'&&kind!=='parry'&&kind!=='brace'&&!reduced&&facts?.mode!=='glance'){
        pool.emit({x,y,frame:frame+3,seed:seed+7,count:2,material,
          direction:1,angle:angle+(facts?.mode==='slice'?35:-20),spread:facts?.mode==='slice'?35:85,speed:1.8,life:18,size:1.8,
          species:owner?.ch?.id==='mai'?'petal':material.species,drag:.07,priority:1});
      }
      this.events.push({impactScore:impactScore||null,principalCount:used>budget?budget:used,tick:G.tick,move:m?.id,kind,multi,angle,zone,contact:facts,frame,response:response||null,delayed:!multi&&kind!=='guard'&&kind!=='parry'&&kind!=='brace'&&!reduced&&facts?.mode!=='glance'});if(this.events.length>128)this.events.shift();
      return kind;
    },
    clear(){this.events=[];}
  };
  INK.ImpactFeedback=Impact;
})();
