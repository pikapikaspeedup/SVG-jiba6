/* DUEL BRAIN: decisions consume only the existing delayed observation plus
 * the actor's own resources and flight. Never reads the opponent's inputs. */
'use strict';
(() => {
 const settings={enabled:true},active=()=>settings.enabled&&INK.Kinetic?.settings.enabled;
 function update(f,b,obs,G,api){
  if(!active())return false;const hard=G.difficulty==='hard',easy=G.difficulty==='easy',dist=Math.abs(obs.x-f.x),corner=f.x<205||f.x>1235;
  const q=f._inkDuel||(f._inkDuel={recoveryTried:false,flight:null,waveAttempt:-999,followed:null,recoveries:0,fastDrops:0,counterWaves:0,followUps:0});
  // Pursuit owns its whole paid sequence. Never fall through to the old
  // aerial planner / combo specials while its landing debt is outstanding.
  const pursuit=f._inkPursuit;
  if(pursuit){
   if(pursuit.phase==='flight'&&pursuit.age>=2&&!pursuit.attackUsed&&!f.attack&&f.y<-8){
    const dy=obs.y-f.y,front=(obs.x-f.x)*f.dir>=0;
    if(front&&dist<=260&&Number.isFinite(dy)&&Math.abs(dy)<=150){
     const move=dist<=175&&Math.abs(dy)<=85?'aMP':'aHK';
     if(api.request(f,move)){q.pursuitAttacks=(q.pursuitAttacks||0)+1;b.goal='追空普通技 · 承担落地恢复';}
    }
   }
   return true;
  }
  const launch=f._inkLaunch,delay=hard?3:easy?10:6;
  if(INK.AirPursuit?.active()&&launch&&!launch.used&&launch.source!==q.pursuitSource&&Number.isFinite(launch.at)&&G.actionTick-launch.at>=delay){
   const gate=INK.AirPursuit.decision(f,'AIR_CHASE',G);
   if(!gate?.wait){
    // One roll per real launch source, including declined / expired permits.
    q.pursuitSource=launch.source;
    if(!easy&&gate?.ok&&INK.Random.combat.next()<(hard?.65:.4)&&api.request(f,'AIR_CHASE')){
     q.pursuits=(q.pursuits||0)+1;b.goal='挑空确认 · 付费追空';return true;
    }
   }
  }
  const wake=f._inkWake;
  if(INK.WakeFlow?.active()&&f.state==='down'&&f.stateAge>=6&&q.wakeCycle!==wake?.cycle){
   q.wakeCycle=wake?.cycle;q.wakeStrikeTried=false;const roll=INK.Random.combat.next();
   q.wakeChoice=!easy&&dist<280&&f.drive>=1.5&&roll<(hard?.34:.22)?'strike':roll<(hard?.60:.42)?'delay':'recover';
   if(q.wakeChoice==='delay'&&api.request(f,'WAKE_DELAY')){q.recoveryTried=true;b.goal='延迟起身 · 打乱压制时机';q.delayedWakes=(q.delayedWakes||0)+1;return true;}
   if(q.wakeChoice==='strike')q.recoveryTried=true;
  }
  if(INK.WakeFlow?.active()&&f.state==='rise'&&q.wakeChoice==='strike'&&!q.wakeStrikeTried&&f.stateT<=4){
   q.wakeStrikeTried=true;if(api.request(f,'WAKE_STRIKE')){b.goal='起身迎击 · 承担后摇风险';q.wakeStrikes=(q.wakeStrikes||0)+1;return true;}
  }
  if(f.state!=='down')q.recoveryTried=false;
  if(f.state==='down'&&f.y===0&&f.stateAge>=6&&!q.recoveryTried){q.recoveryTried=true;
   if(!easy&&f.drive>=2&&(corner||dist<300)&&INK.Random.combat.next()<(hard?.78:.48)){
    const direction=corner?(f.x<720?1:-1):(f.x<obs.x?-1:1);if(INK.Aerial.recover(f,G,api.pay,direction)){q.recoveries++;b.goal='消耗斗气 · 方向受身';return true;}
   }
  }
  const flight=f._inkFlight;
  if(flight?.computer&&!flight.landed&&f.y<0){
   if(q.flight!==flight){q.flight=flight;q.airPlan={short:dist<250&&INK.Random.combat.next()<.35,fast:!easy&&INK.Random.combat.next()<(hard?.55:.3),target:obs.x-f.dir*145};}
   const p=q.airPlan,dx=p.target-f.x,wasFast=flight.fast;
   INK.Aerial.control(f,G,{up:!p.short,down:p.fast&&Math.abs(dx)<210&&obs.attack?.kind!=='upper',left:dx<-35,right:dx>35});
   if(flight.fast&&!wasFast){q.fastDrops++;b.goal='快落改变落点';}
  }
  if(f.y===0&&f.landT>0){f.aiGuard=true;return true;}
  if(f.state!=='idle'||f.attack||f.y!==0||f.jumpPre>0)return false;
  const wave=obs.projectiles.find(s=>s.dir*(f.x-s.x)>0),own=G.shots.find(s=>s.owner===f&&s.life>0&&s._flowClashes>0&&s.dir*(s.x-f.x)>0&&s.dir*(obs.x-s.x)>0);
  if(wave&&!easy&&f.drive>=3&&G.tick-q.waveAttempt>120){const m=api.special(f,['projectile','lowprojectile'],3),age=G.tick-obs.t,arrival=(Math.abs(f.x-wave.x)-wave.r)/Math.max(1,wave.v)-age;
   if(m&&arrival>m.startup+6&&arrival<70){q.waveAttempt=G.tick;if(INK.Random.combat.next()<(hard?.65:.35)&&api.attack(f,m,'OD 对波 · 争取跟进')){q.counterWaves++;return true;}}
  }
  if(own&&q.followed!==own&&dist>230&&dist<1000&&!obs.attack){q.followed=own;q.followUps++;api.plan(f,'approach',14,{goal:'穿波掩护 · 跟进压制'});api.run(f,b);return true;}
  if(G.tick>=b.nextDecision&&G.tick-b.lastJump>300&&dist>255&&dist<480&&!obs.attack&&INK.Random.combat.next()<(easy?.08:hard?.24:.16)){b.lastJump=G.tick;api.plan(f,'jump',40,{goal:'空中变速 · 改变接近路线'});api.run(f,b);return true;}
  return false;
 }
 INK.DuelBrain={settings,active,update};
})();
