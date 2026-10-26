from pathlib import Path
import os,json,hashlib
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/body-volume';O.mkdir(exist_ok=True);html=(R/'dist/INK-Street-Fighter-6.html').read_bytes()
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ['INK_CHROMIUM'],headless=True);p=b.new_page(viewport={'width':1440,'height':1100});errors=[];p.on('pageerror',lambda e:errors.append(str(e)));p.set_content(html.decode());p.wait_for_function('window.INKDuel?.ready')
 p.evaluate('''()=>{window.volumeSample=(id,mode)=>{const A=SVG_FIGHTER,G=A.state;A.start(id,'ryu','training','classic',42);G.paused=true;document.getElementById('dummy').value='idle';A.teleport(0,560);A.teleport(1,700);if(mode==='guard'){A.press(0,'left');A.tryMove(1,'sMP');for(let i=0;i<40&&A.fighters[0].state!=='block';i++)A.step();}else if(mode==='kick'){A.tryMove(0,'sHK');const f=A.fighters[0];while(f.attack&&f.attack.t<f.attack.m.startup)A.step();}else if(mode==='throw'){A.tryMove(0,'throw');for(let i=0;i<50&&!A.fighters[0].throwAction;i++)A.step();for(let i=0;i<30&&A.fighters[0].throwAction?.t<14;i++)A.step();}A.render();const f=A.fighters[0],r=f.inkRenderer,root=r.group,count=root.querySelectorAll('*').length,before=JSON.stringify([f.x,f.y,f.hp,f.state,f.attack?.t]),markup=root.innerHTML;for(let i=0;i<4;i++)A.render();const sockets=INK.Rig.sockets(A.visualPose(f),INK.Runtime.visualRig(f,A.visualPose(f)));return {id,mode,state:f.state,nodes:count,bounded:root.querySelectorAll('*').length===count,pure:before===JSON.stringify([f.x,f.y,f.hp,f.state,f.attack?.t]),repeat:markup===root.innerHTML,finite:![...root.querySelectorAll('path, use, g')].some(n=>['d','transform','opacity'].some(k=>/(NaN|Infinity)/.test(n.getAttribute(k)||''))),legRaise:['rearLeg','frontLeg'].map(k=>Math.max(sockets[k][0][1]-sockets[k][1][1],sockets[k][0][1]-sockets[k][2][1])),legExposure:['rearLeg','frontLeg'].map(k=>+r.foregroundLimbs[k].group.getAttribute('opacity')),rootMasks:['rearLeg','frontLeg'].every(k=>!!r.foregroundLimbs[k].use.getAttribute('mask')&&!r.foregroundLimbs[k].end.getAttribute('mask')),noHandCircle:['rearArm','frontArm'].every(k=>!/[aA]/.test(r.foregroundLimbs[k].path.getAttribute('d')||'')),overlays:Object.keys(r.foregroundLimbs||{}).length,endRefs:Object.values(r.foregroundLimbs||{}).every(v=>v.end.getAttribute('href')!==v.use.getAttribute('href')),folds:['rearLeg','frontLeg','rearArm','frontArm'].filter(k=>r[k].foldShade?.getAttribute('d')).length};};}''')
 rows=p.evaluate("()=>INK.Schema.CHARACTERS.flatMap(id=>['idle','guard','kick','throw'].map(mode=>volumeSample(id,mode)))")
 p.locator('.kinetic-launch button').click();p.locator('#fight-practice').click()
 for id,mode in [('ken','kick'),('mai','guard')]:
  p.evaluate('([id,mode])=>volumeSample(id,mode)',[id,mode]);p.locator('#f-battle-mount').screenshot(path=str(O/(id+'-'+mode+'.png')))
 # Reuse the actual special-contact setup without rewriting phase-six evidence.
 flux=(R/'tests/contact-flux/visual.py').read_text().split("p.evaluate('''",1)[1].split("''')",1)[0]
 p.evaluate(flux)
 for id,result in [('ken','hit'),('mai','block')]:
  p.evaluate('([id,result])=>fluxSample(id,result,true)',[id,result]);p.locator('#f-battle-mount').screenshot(path=str(O/(id+'-'+result+'.png')))
 b.close()
(O/'render.json').write_text(json.dumps({'htmlSha256':hashlib.sha256(html).hexdigest(),'rows':rows,'errors':errors},indent=2)+'\n')
assert not errors;assert all(r['bounded'] and r['pure'] and r['repeat'] and r['finite'] and r['overlays']==4 and r['endRefs'] for r in rows);assert all(r['state']=='block' for r in rows if r['mode']=='guard');assert all(r['state']=='throwing' for r in rows if r['mode']=='throw');print('32 actual idle/guard/heavy-kick/throw samples: finite, pure, bounded retained nodes and repeat render passed; max nodes',max(r['nodes'] for r in rows))

assert all(r['rootMasks'] and r['noHandCircle'] for r in rows)
# A raised idle guard is legitimate; standing limbs below the hip stay behind.
assert all(e==0 for r in rows for raised,e in zip(r['legRaise'],r['legExposure']) if raised<=-10)
assert all(e>0 for r in rows for raised,e in zip(r['legRaise'],r['legExposure']) if raised>-10)
assert any(max(r['legExposure'])>.5 for r in rows if r['mode']=='kick')
