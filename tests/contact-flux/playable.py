"""Real-contact finite integration; no contact injection or replay infrastructure."""
from pathlib import Path
import os,json,hashlib
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/contact-flux';O.mkdir(parents=True,exist_ok=True);html=(R/'dist/INK-Street-Fighter-6.html').read_bytes()
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ['INK_CHROMIUM'],headless=True);p=b.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));p.set_content(html.decode());p.wait_for_function('window.INKDuel?.ready&&INK.ContactFlux')
 rows=p.evaluate('''()=>{const A=SVG_FIGHTER,G=A.state,F=INK.ContactFlux,V=INK.VFX,out=[],check=(name,passed,details={})=>out.push({name,passed:!!passed,details});
 function setup(dist=160){A.start('ryu','luke','training','classic',29);G.paused=false;document.getElementById('dummy').value='idle';document.getElementById('autohp').checked=false;A.teleport(0,540);A.teleport(1,540+dist);A.step();}
 function until(fn,n=100){for(let i=0;i<n&&!fn();i++)A.step();return !!fn();}
 const stamps=()=>V.trails?.live.filter(r=>r?.contactOnly)||[];
 for(const type of ['hit','block','parry','armor']){setup();if(type==='block')A.press(1,'right');if(type==='parry')A.press(1,'PAR');if(type==='armor')A.tryMove(1,'DI');A.tryMove(0,'sMP');const source=A.fighters[0].attack;until(()=>G.lastCombatEvent?.defender===1);const c=F.read(source,V.time),s=stamps();check('real '+type+' commits one source-linked section',G.lastCombatEvent?.type===type&&c?.result===type&&s.filter(r=>r.contact===c).length===1,{event:G.lastCombatEvent?.type,result:c?.result,stamps:s.length});
 if(type==='hit'){const before=JSON.stringify(A.combatState()),count=s.length,t=V.time;G.paused=true;for(let i=0;i<20;i++)A.renderFraction(i%3/2);check('frozen renders neither duplicate sections nor alter combat',before===JSON.stringify(A.combatState())&&stamps().length===count&&V.time===t,{count,time:t});G.paused=false;}}
 setup(430);const wave=A.moves.ryu.find(m=>m.base==='hadoken'&&!m.od);A.tryMove(0,wave.id);const waveSource=A.fighters[0].attack;until(()=>G.lastCombatEvent?.defender===1,120);check('projectile contact has section without infecting owner attack',stamps().some(r=>r.contact?.result==='hit')&&!F.read(waveSource,V.time),{event:G.lastCombatEvent?.type,stamps:stamps().length});
 function run(enabled){setup();F.settings.enabled=enabled;A.tryMove(0,'sHP');A.step(65);return A.fighters.map(f=>({hp:f.hp,x:f.x,y:f.y,drive:f.drive,super:f.super,state:f.state,stateT:f.stateT}));}
 const on=run(true),off=run(false);check('visual Flux switch preserves actual combat result',JSON.stringify(on)===JSON.stringify(off),{on,off});F.settings.enabled=true;G.paused=true;return out;}''');b.close()
for r in rows:print('PASS' if r['passed'] else 'FAIL',r)
(O/'playable.json').write_text(json.dumps({'htmlSha256':hashlib.sha256(html).hexdigest(),'rows':rows,'errors':errors},indent=2)+'\n');assert all(r['passed'] for r in rows) and not errors,errors
