"""Public-input movement commitment checks; teleports only arrange fixtures."""
from pathlib import Path
import os,json,hashlib
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/movement-strike';O.mkdir(parents=True,exist_ok=True);h=(R/'dist/INK-Street-Fighter-6.html').read_bytes()
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ['INK_CHROMIUM'],headless=True);p=b.new_page(viewport={'width':1440,'height':900});p.set_content(h.decode());p.wait_for_function('window.INKDuel?.ready&&INK.MovementStrike')
 p.evaluate('''()=>{window.msSetup=(kind,hold,wall=false)=>{const A=SVG_FIGHTER,G=A.state;A.start('ryu','ken','training','classic',42);G.paused=false;document.getElementById('dummy').value='idle';document.getElementById('autohp').checked=false;A.teleport(0,wall?1310:450);A.teleport(1,wall?1335:1100);A.step();A.press(0,'right');if(kind==='dash'){A.step();A.release(0,'right');A.step();A.press(0,'right');}else A.press(0,'RUSH');A.step();const f=A.fighters[0],state=f.state;if(!hold)A.release(0,'right');A.press(0,'MP');for(let i=0;i<8&&!f.attack;i++)A.step();return {f,state};};}''')
 rows=[]
 for kind,hold,wall in [('dash',True,False),('dash',False,False),('rush',True,False),('rush',False,False),('rush',True,True)]:
  row=p.evaluate('''([kind,hold,wall])=>{const {f,state}=msSetup(kind,hold,wall),A=SVG_FIGHTER,G=A.state,a=f.attack,base=A.getMove(f,'sMP'),q=a?.m.movementStrike,x=f.x,trace=[];for(let i=0;i<15&&f.attack===a;i++){A.step();trace.push({x:f.x,t:a.t,spent:f._inkMovementStrike?.spent??null});}return {kind,hold,wall,entry:state,move:a?.m.id,metadata:q||null,original:{startup:base.startup,active:base.active,damage:base.damage,total:base.total},actual:a?{startup:a.m.startup,active:a.m.active,damage:a.m.damage,total:a.m.total}:null,dx:f.x-x,maxSpent:Math.max(0,...trace.map(t=>t.spent||0)),trace};}''',[kind,hold,wall]);rows.append(row)
 checks=p.evaluate("""()=>{const A=SVG_FIGHTER,G=A.state,{f}=msSetup('dash',true),out=[];const superMove=A.moves.ken.find(m=>m.super&&!m.ca);const ok=A.tryMove(1,superMove.id),before=JSON.stringify(f._inkMovementStrike),x=f.x;A.step();out.push({name:'super freeze',ok,passed:ok&&before===JSON.stringify(f._inkMovementStrike)&&x===f.x});msSetup('dash',true);const a=A.fighters[0];A.teleport(1,a.x+110);A.tryMove(1,'sLP');for(let i=0;i<25&&a.state!=='hit';i++)A.step();out.push({name:'real incoming hit clears carry',passed:a.state==='hit'&&!a._inkMovementStrike,state:a.state});return out;}""")
 p.locator('.kinetic-launch button').click()
 for label,hold in [('forward',True),('brake',False)]:
  p.evaluate('(hold)=>{msSetup("dash",hold);SVG_FIGHTER.step(2);SVG_FIGHTER.state.paused=true;SVG_FIGHTER.render();}',hold);p.locator('#game').screenshot(path=str(O/(label+'.png')))
 b.close()
report={'sha256':hashlib.sha256(h).hexdigest(),'cases':rows,'checks':checks};(O/'playable.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps([{k:v for k,v in r.items() if k!='trace'} for r in rows]+checks,indent=2));assert all(r['move']=='sMP' and r['actual']['startup']==r['original']['startup'] and r['actual']['active']==r['original']['active'] and r['actual']['damage']==next(x['actual']['damage'] for x in rows if x['kind']==r['kind'] and not x['hold']) and (r['actual']['total']==r['original']['total']+(2 if r['hold'] else 0)) and r['maxSpent']<=18.00001 for r in rows)

assert all(c['passed'] for c in checks),checks
