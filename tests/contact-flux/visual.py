from pathlib import Path
import os,json,hashlib
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/contact-flux';O.mkdir(exist_ok=True);html=(R/'dist/INK-Street-Fighter-6.html').read_bytes()
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ['INK_CHROMIUM'],headless=True);p=b.new_page(viewport={'width':1440,'height':1100});errors=[];p.on('pageerror',lambda e:errors.append(str(e)));p.set_content(html.decode());p.wait_for_function('window.INKDuel?.ready')
 p.evaluate('''()=>{window.fluxSample=(id,result,special=false)=>{const A=SVG_FIGHTER,G=A.state;A.start(id,'ryu','training','classic',42);G.paused=true;document.getElementById('dummy').value='idle';document.getElementById('infinite').checked=false;A.teleport(0,560);A.teleport(1,700);if(result==='block')A.press(1,'right');if(result==='parry')A.press(1,'PAR');if(result==='armor')A.tryMove(1,'DI');const move=special?A.moves[id].find(m=>m.category==='special'&&!m.od&&m.base===(id==='mai'?'hissatsu':'shoryu')).id:'sMP';A.tryMove(0,move);for(let i=0;i<40&&!INK.VFX.trails?.live.some(r=>r?.contactOnly);i++)A.step();if(special){for(let i=0;i<25&&G.hitstop;i++)A.step();A.step(2);}A.render();INK.VFX.trails.render(INK.VFX.time);const pool=INK.VFX.trails,index=pool.live.findIndex(r=>r?.contactOnly),r=pool.live[index],node=pool.nodes[index];const traces=pool.live.filter(v=>v&&!v.contactOnly&&v.contact);return {id,result,special,move,linkedTrails:traces.length,deformedTrails:traces.filter(v=>JSON.stringify(INK.MaterialFlow.geometry(v.points,INK.VFX.time,{...v,contactTime:INK.VFX.time}))!==JSON.stringify(INK.MaterialFlow.geometry(v.points,INK.VFX.time,{...v,contact:null}))).length,actual:r?.contact.result,contactCount:pool.live.filter(r=>r?.contactOnly).length,finite:node?[...node.material].every(n=>!/(NaN|Infinity)/.test(n.getAttribute('d')||'')):false,layers:node?node.material.filter(n=>n.getAttribute('display')!=='none').length:0,strokes:node?node.material.filter(n=>n.getAttribute('display')!=='none').map(n=>n.getAttribute('stroke')):[],frozen:r?Object.isFrozen(r.contact):false};};}''')
 rows=p.evaluate("()=>INK.Schema.CHARACTERS.flatMap(id=>['hit','block','parry','armor'].map(result=>fluxSample(id,result)))")
 rows+=p.evaluate("()=>[fluxSample('ken','hit',true),fluxSample('mai','block',true)]")
 p.locator('.kinetic-launch button').click();p.locator('#fight-practice').click()
 for id,result in [('ken','hit'),('mai','block')]:
  p.evaluate('([id,result])=>fluxSample(id,result,true)',[id,result]);p.locator('#f-battle-mount').screenshot(path=str(O/(id+'-'+result+'.png')))
 b.close()
(O/'visual.json').write_text(json.dumps({'htmlSha256':hashlib.sha256(html).hexdigest(),'rows':rows,'errors':errors},indent=2)+'\n')
print(json.dumps(rows,indent=2));assert not errors;assert all(r['actual']==r['result'] and r['finite'] and r['frozen'] and r['contactCount']==1 and 0<r['layers']<=3 for r in rows)

assert all(r['linkedTrails']>0 and r['deformedTrails']>0 for r in rows if r['special'])
