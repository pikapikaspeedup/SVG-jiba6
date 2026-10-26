from pathlib import Path
import os,json,hashlib
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/wake-flow';O.mkdir(exist_ok=True);html=(R/'dist/INK-Street-Fighter-6.html').read_bytes()
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ['INK_CHROMIUM'],headless=True);p=b.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));p.set_content(html.decode());p.wait_for_function('window.INKDuel?.ready')
 rows=p.evaluate('''()=>{const A=SVG_FIGHTER,G=A.state,rows=[],check=(name,passed,details)=>rows.push({name,passed,details});
 const down=id=>{A.start(id,'ryu','training','classic',42);G.paused=true;document.getElementById('dummy').value='idle';document.getElementById('infinite').checked=false;document.getElementById('autohp').checked=false;A.teleport(0,560);A.teleport(1,720);A.tryMove(1,'cHK');for(let n=0;n<130&&A.fighters[0].state!=='down';n++)A.step();return A.fighters[0];};
 const rise=f=>{for(let n=0;n<100&&!(f.state==='rise'&&f.stateT<=4);n++)A.step();while(G.hitstop)A.step();};
 for(const id of INK.Schema.CHARACTERS){const f=down(id);check(id+' actual sweep creates wake cycle',f.state==='down'&&!!f._inkWake,{state:f.state,hp:f.hp});const old=f.stateT,drive=f.drive;check(id+' delay adds 18 once free',A.tryMove(0,'WAKE_DELAY')&&f.stateT===old+18&&!A.tryMove(0,'WAKE_DELAY')&&f.drive===drive);rise(f);A.teleport(1,f.x+160);const paid=f.drive,ok=A.tryMove(0,'WAKE_STRIKE'),a=f.attack;check(id+' wake strike pays once and clears inherited protection',ok&&paid-f.drive===1.5&&f.invuln===0&&f.throwInvuln===0&&!A.tryMove(0,'WAKE_STRIKE'));for(let n=0;n<65&&!a?.hitConfirmed;n++)A.step();check(id+' wake strike really hits',!!a?.hitConfirmed,{hp:A.fighters[1].hp,attack:a?.m.id});}
 let f=down('ryu');rise(f);A.teleport(1,f.x+160);document.getElementById('dummy').value='guard';A.tryMove(0,'WAKE_STRIKE');let a=f.attack;for(let n=0;n<50&&!a.confirmed;n++)A.step();while(G.hitstop)A.step();check('Wake strike can be guarded',a.contactResult==='block');for(let n=0;n<40&&A.fighters[1].state!=='idle';n++)A.step();document.getElementById('dummy').value='idle';A.teleport(1,f.x+150);const hp=f.hp,started=A.tryMove(1,'sLP');for(let n=0;n<20&&f.hp===hp;n++)A.step();check('Blocked strike has a real punish window',started&&f.hp<hp,{damage:hp-f.hp,state:f.state});
 f=down('ryu');rise(f);A.teleport(1,f.x+125);A.tryMove(0,'WAKE_STRIKE');A.tryMove(1,'throw');for(let n=0;n<12&&!f.captured;n++)A.step();check('Real throw catches armored wake startup',f.captured&&f.captureKind==='throw',{state:f.state});
 f=down('ryu');rise(f);A.teleport(1,f.x+400);A.tryMove(0,'WAKE_STRIKE');const armor=[];for(let n=0;n<8;n++){A.step();armor.push([f.attack?.t,f.attack?.armor]);}check('Unused armor expires before sixth-frame contacts',armor.every(([t,v])=>t<6?v===1:v===0),armor);
 // Local contact-rule probe follows a real sweep and accepted wake request; no synthetic state.
 f=down('ryu');rise(f);A.tryMove(0,'WAKE_STRIKE');const before=f.hp;const result=A.contact(A.fighters[1],f,A.getMove(A.fighters[1],'sLP'));check('Local contact probe: one armored hit costs health',result==='armor'&&f.hp<before&&f.attack?.armor===0,{result,damage:before-f.hp});
 f=down('ryu');const money=f.drive;A.press(0,'right');A.press(0,'PAR');A.step();A.release(0,'PAR');A.release(0,'right');check('Original Q direction recovery remains paid',!!f._inkRecovery&&f.drive<=money-1+.01,{recovery:f._inkRecovery,drive:f.drive,money});
 return rows;}''');b.close()
for r in rows:print('PASS' if r['passed'] else 'FAIL',r['name'],r.get('details',''))
(O/'playable.json').write_text(json.dumps({'htmlSha256':hashlib.sha256(html).hexdigest(),'rows':rows,'errors':errors},indent=2)+'\n');assert all(r['passed'] for r in rows) and not errors
