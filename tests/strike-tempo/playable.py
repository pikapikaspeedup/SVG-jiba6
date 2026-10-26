"""Finite real-input checks; no fabricated combat contacts or hold state."""
from pathlib import Path
import hashlib,json,os
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/strike-tempo';O.mkdir(parents=True,exist_ok=True)
html=(R/'dist/INK-Street-Fighter-6.html').read_bytes()
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ['INK_CHROMIUM'],headless=True)
 p=b.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
 p.set_content(html.decode());p.wait_for_function('window.INKDuel?.ready&&INK.StrikeTempo')
 rows=p.evaluate('''()=>{
 const A=SVG_FIGHTER,G=A.state,out=[];
 const check=(name,passed,details={})=>out.push({name,passed:!!passed,details});
 function setup(id='ryu',dist=500){A.start(id,'ryu','training','classic',31);G.paused=false;document.getElementById('dummy').value='idle';document.getElementById('autohp').checked=false;document.getElementById('infinite').checked=false;A.teleport(0,400);A.teleport(1,400+dist);A.step();return A.fighters[0];}
 function until(fn,n=90){for(let i=0;i<n&&!fn();i++)A.step();return !!fn();}
 function hold(id='ryu'){const f=setup(id);A.press(0,'HP');until(()=>f.attack?.tempo?.phase==='holding',30);return f;}
 let f=setup();A.press(0,'HP');A.release(0,'HP');until(()=>f.attack,6);let a=f.attack,start=a?.m.startup,age=a?.t,steps=0;
 while(f.attack===a&&a.t<start&&steps<30){A.step();steps++;}
 check('tap retains original startup progression',a&&steps===start-age&&!a.tempo?.age,{steps,expected:start-age,tempo:a?.tempo});
 f=hold();a=f.attack;const holdFrame=a?.t;until(()=>a?.tempo?.phase==='released',25);
 check('held HP stops for exactly twelve actionable steps',a?.tempo?.age===12&&a.t===holdFrame+1,{age:a?.tempo?.age,t:a?.t,holdFrame});
 f=hold();a=f.attack;A.press(0,'HK');A.release(0,'HK');A.step();check('unrelated release does not release heavy hold',a?.tempo?.phase==='holding'&&!a.tempo.pendingRelease);
 let before={t:a?.t,at:G.actionTick,age:a?.tempo?.age};A.release(0,'HP');check('release callback does not advance simulation',a?.t===before.t&&G.actionTick===before.at&&a?.tempo?.age===before.age);A.step();check('original release resumes remaining startup',a?.tempo?.phase==='released'&&a.t===before.t+1);
 f=hold();a=f.attack;const superMove=A.moves.ryu.find(m=>m.super&&!m.ca);const superOK=A.tryMove(1,superMove.id);before={t:a?.t,at:G.actionTick,age:a?.tempo?.age};A.release(0,'HP');A.step();check('real super freeze preserves held attack frame and age',superOK&&G.actionTick===before.at&&a?.t===before.t&&a?.tempo?.age===before.age,{hitstop:G.hitstop,super:superMove.id});until(()=>G.actionTick>before.at,100);check('pending release takes effect after freeze',a?.tempo?.phase==='released');
 f=hold();const drive=f.drive,feint=A.tryMove(0,'FEINT'),after=f.drive;const reject=[];for(const id of ['sLP','RUSH','PAR','YIELD','ESCAPE','throw'])reject.push({id,ok:A.tryMove(0,id)});
 check('feint charges half drive and starts twelve-frame recovery',feint&&Math.abs(drive-after-.5)<1e-6&&f.state==='recovery'&&f.stateT===12&&!f.invuln&&!f.throwInvuln,{drive,after,state:f.state,stateT:f.stateT});check('feint recovery rejects cancel entrances',reject.every(x=>!x.ok),reject);
 A.step(11);check('feint remains recovering before final step',f.state==='recovery');A.step();check('feint recovery completes at twelve actions',f.state==='idle',{state:f.state,stateT:f.stateT});
 f=hold();A.teleport(1,f.x+115);const hitOK=A.tryMove(1,'sLP');until(()=>f.hp<10000,30);check('real incoming strike clears tempo',hitOK&&f.hp<10000&&!f.attack?.tempo&&f._inkTempo?.phase!=='holding',{hp:f.hp,state:f.state});
 function luke(){const f=setup('luke');A.press(0,'down');A.step();A.press(0,'left');A.step();A.release(0,'down');A.step();A.release(0,'left');A.press(0,'MP');until(()=>f.attack?.holding,35);return f;}
 f=luke();a=f.attack;check('Luke real quarter-circle input starts native charge',a?.m.kind==='charge'&&a.holding&&!a.tempo,{id:a?.m.id});
 A.press(0,'HK');A.release(0,'HK');A.step();check('Luke unrelated release does not discharge',a?.holding);
 until(()=>a?.holdTicks>=20,30);before={t:a?.t,held:a?.holdTicks};A.release(0,'MP');check('Luke release callback leaves attack clock unchanged',a?.t===before.t);A.step();check('Luke retains perfect native release window',a?.perfect&&!a.holding,{held:before.held,perfect:a?.perfect,damage:a?.m.damage});
 f=luke();a=f.attack;until(()=>!a?.holding,45);check('Luke native charge still times out at thirty-six',a?.holdTicks===36&&!a.holding&&!a.perfect,{ticks:a?.holdTicks,damage:a?.m.damage});
 G.paused=true;return out;
 }''');b.close()
for r in rows:print('PASS' if r['passed'] else 'FAIL',r)
(O/'playable.json').write_text(json.dumps({'htmlSha256':hashlib.sha256(html).hexdigest(),'rows':rows,'errors':errors},indent=2)+'\n')
assert all(r['passed'] for r in rows) and not errors,errors
