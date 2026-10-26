from pathlib import Path
import os,json,hashlib
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/aerial';html=(R/'dist/INK-Street-Fighter-6.html').read_bytes()
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ['INK_CHROMIUM'],headless=True);p=b.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));p.set_content(html.decode());p.wait_for_function('window.INKDuel?.ready')
 rows=p.evaluate('''()=>{const A=SVG_FIGHTER,G=A.state,rows=[],check=(name,passed,details)=>rows.push({name,passed,details});
 function setup(id='ryu'){A.start(id,'ken','training','classic',12);G.paused=true;document.getElementById('dummy').value='idle';document.getElementById('infinite').checked=false;document.getElementById('autohp').checked=false;A.teleport(0,300);A.teleport(1,1100);}
 function jump({tap=false,fast=false,steer=false,id='ryu'}={}){setup(id);const f=A.fighters[0];A.press(0,'up');let min=0,air=false,frames=0;for(let i=0;i<100;i++){if(tap&&i===1)A.release(0,'up');if(fast&&f.y<0&&f.vy>=-.5){A.release(0,'up');A.press(0,'down');}if(steer&&f.y<0)A.press(0,'right');A.step();min=Math.min(min,f.y);if(f.y<0){air=true;frames++;}if(air&&f.y===0)break;}A.release(0,'up');A.release(0,'down');A.release(0,'right');return {min,frames,x:f.x,landing:f.landT,fast:!!f._inkFlight?.fast,cut:!!f._inkFlight?.cut};}
 const short=jump({tap:true}),full=jump(),fast=jump({fast:true}),steer=jump({steer:true});check('Tap produces a shorter lower jump than holding up',short.cut&&short.min>full.min+60&&short.frames<full.frames,{short,full});check('Fast descent reduces airtime and commits to longer landing recovery',fast.fast&&fast.frames<full.frames&&fast.landing>=11&&fast.landing>full.landing,{fast,full});check('Air steering changes horizontal travel with bounded speed',steer.x>full.x+50&&Math.abs(A.fighters[0].vx)<=5.7,{steer});
 const f=A.fighters[0];jump({fast:true});A.press(0,'up');const recovery=A.fighters[0].landT;let grounded=true;for(let i=0;i<recovery;i++){A.step();grounded&&=A.fighters[0].y===0;}check('Holding up cannot skip the landing commitment',grounded);A.release(0,'up');
 setup();A.press(0,'up');A.step(5);A.release(0,'up');const before=A.fighters[0].vy;A.press(0,'up');A.step();check('Pressing up in the air does not create a second jump',A.fighters[0].vy>before);A.release(0,'up');
 setup();A.inputMove(0,'shoryuken_1');A.step(22);check('Special launch keeps its authored trajectory outside jump steering',!A.fighters[0]._inkFlight);const specialV=A.fighters[0].vx;A.press(0,'right');A.press(0,'down');A.step();check('Directional inputs cannot steer a special launch',A.fighters[0].vx===specialV);
 let all=true;for(const id of INK.Schema.CHARACTERS){const r=jump({tap:true,id});all&&=Number.isFinite(r.min)&&r.min<0&&r.landing>0;}check('All eight characters complete the new jump and landing cycle',all);
 setup();A.teleport(0,560);A.teleport(1,720);A.inputMove(1,'cHK');for(let i=0;i<100&&A.fighters[0].state!=='down';i++)A.step();const victim=A.fighters[0],hp=victim.hp,meter=victim.drive,x=victim.x;A.press(0,'left');A.press(0,'PAR');A.release(0,'PAR');A.release(0,'left');check('Grounded knockdown accepts one paid recovery after real damage',victim.state==='down'&&!!victim._inkRecovery&&Math.abs(victim.drive-(meter-1))<.001&&hp<10000);const paid=victim.drive;A.press(0,'PAR');A.release(0,'PAR');check('Repeated recovery requests cannot spend repeatedly',victim.drive===paid);let frames=0;while(victim.state!=='idle'&&frames++<60)A.step();check('Directional recovery shortens wakeup and moves within its bound',frames<=20&&victim.x<x&&x-victim.x<=42.1&&victim.hp===hp,{frames,travel:x-victim.x});
 setup();A.teleport(0,560);A.teleport(1,720);A.inputMove(1,'cHK');for(let i=0;i<100&&A.fighters[0].state!=='down';i++)A.step();A.press(0,'PAR');A.release(0,'PAR');for(let i=0;i<30&&!INK.Aerial.exposed(A.fighters[0]);i++)A.step();const wake=A.fighters[0],wakeHP=wake.hp;const result=A.contact(A.fighters[1],wake,A.getMove(A.fighters[1],'sLP'));check('Quick recovery loses strike immunity during its final recovery frames',result==='hit'&&wake.hp<wakeHP);
 INK.Aerial.settings.enabled=false;const legacy=jump({tap:true});INK.Aerial.settings.enabled=true;check('Disabling Air Flow restores the original full jump for a tap',Math.abs(legacy.min-full.min)<1);return rows;}''')
 p.locator('.kinetic-launch button').click();p.locator('#fight-practice').click();p.evaluate("SVG_FIGHTER.state.paused=true")
 p.locator('#air-hold').dispatch_event('keydown',{'code':'Space'})
 p.evaluate("SVG_FIGHTER.step(12)")
 rows.append({'name':'Hold-jump control starts a real full-height jump','passed':p.evaluate("SVG_FIGHTER.fighters[0].y<0&&!SVG_FIGHTER.fighters[0]._inkFlight.cut")})
 p.locator('#air-hold').dispatch_event('keyup',{'code':'Space'})
 p.evaluate("SVG_FIGHTER.step()")
 rows.append({'name':'Releasing hold control cuts the real jump','passed':p.evaluate("SVG_FIGHTER.fighters[0]._inkFlight.cut&&!SVG_FIGHTER.fighters[0].input.held.has('up')")})
 p.locator('#air-drill').click();p.evaluate("()=>{const A=SVG_FIGHTER;A.state.paused=true;for(let i=0;i<100&&A.fighters[0].state!=='down';i++)A.step();}")
 p.locator('#air-recover').click()
 rows.append({'name':'Sweep and recovery buttons perform a paid wakeup','passed':p.evaluate("!!SVG_FIGHTER.fighters[0]._inkRecovery&&SVG_FIGHTER.fighters[0].drive<5.1")})
 p.locator('#air-coach').screenshot(path=str(O/'controls.png'))
 p.set_viewport_size({'width':390,'height':844})
 rows.append({'name':'Air controls fit a narrow viewport','passed':p.evaluate("document.getElementById('air-coach').getBoundingClientRect().right<=innerWidth+1")})
 b.close()
for r in rows:print('PASS' if r['passed'] else 'FAIL',r['name'],r.get('details',''))
(O/'playable.json').write_text(json.dumps({'htmlSha256':hashlib.sha256(html).hexdigest(),'rows':rows,'errors':errors},indent=2)+'\n');print(errors);assert all(r['passed'] for r in rows) and not errors
