"""Dash-to-strike handoff through public inputs; no simulated hit replacement."""
from pathlib import Path
import os,json,hashlib
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2]; O=R/'qa/movement-strike'; O.mkdir(parents=True,exist_ok=True)
html=(R/'dist/INK-Street-Fighter-6.html').read_bytes()
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ['INK_CHROMIUM'],headless=True)
 p=b.new_page(viewport={'width':1440,'height':900}); errors=[]; p.on('pageerror',lambda e:errors.append(str(e)))
 p.set_content(html.decode()); p.wait_for_function('window.INKDuel?.ready&&INK.MovementStrike');p.locator('.kinetic-launch button').click()
 rows=[]
 for held in [True,False]:
  row=p.evaluate('''held=>{const A=SVG_FIGHTER,G=A.state,V=INK.VisualFrame;
   A.start('ryu','ken','training','classic',42);G.paused=false;document.getElementById('dummy').value='idle';A.teleport(0,450);A.teleport(1,1200);A.step();A.press(0,'right');A.step();A.release(0,'right');A.step();A.press(0,'right');A.step(7);
   const f=A.fighters[0],entry=f.state;let prior=V.get(A.visualPose(f));if(!held)A.release(0,'right');A.press(0,'MP');let activeError=0,finite=true,maxFootJump=0,maxResidual=0,metadata=null,trace=[];
   for(let i=0;i<32;i++){A.step();const frame=V.get(A.visualPose(f));metadata=metadata||f.attack?.m.movementStrike;for(const k of ['rear','front']){const a=frame.worldFeet[k],z=prior.worldFeet[k];maxFootJump=Math.max(maxFootJump,Math.hypot(a[0]-z[0],a[1]-z[1]));finite&&=a.every(Number.isFinite);}maxResidual=Math.max(maxResidual,...Object.values(frame.bridge?.residuals||{}));
    if(f.attack&&f.attack.t>=f.attack.m.startup&&f.attack.t<f.attack.m.startup+f.attack.m.active){const view=Object.create(f);view._inkFrameTransition=null;const target=V.get(A.visualPose(view));for(const key of INK.FrameBridge.contactChains(f))for(let j=0;j<3;j++)activeError=Math.max(activeError,Math.hypot(...frame.joints3D[key][j].map((v,k)=>v-target.joints3D[key][j][k])));}
    trace.push({i,state:f.state,t:f.attack?.t,x:f.x,feet:frame.worldFeet,bridge:frame.bridge?.age});prior=frame;
   }G.paused=true;return {held,entry,metadata:metadata||null,activeError,finite,maxFootJump,maxResidual,trace};}''',held)
  rows.append(row)
 b.close()
report={'htmlSha256':hashlib.sha256(html).hexdigest(),'cases':rows,'errors':errors,'scope':'Two real public dash-to-MP entries; measures feet and active-chain deadline. Not a visual-quality or endurance claim.'}
(O/'presentation.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps([{k:v for k,v in r.items() if k!='trace'} for r in rows],indent=2))
assert not errors and all(r['entry']=='dash' and r['finite'] and r['activeError']<1e-7 for r in rows)
assert rows[0]['metadata'] and rows[1]['metadata'] is None
