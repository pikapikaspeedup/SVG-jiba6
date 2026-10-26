"""Measure final hitstop-release renderer rewind in literal v6 vs actual v7.
This is an isolated real-hit rendering fixture, not a whole-game continuity proof.
"""
from pathlib import Path
from datetime import datetime,timezone
import hashlib,json,os,shutil
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/flow7';rows=[];errors=[]
script="""()=>{const A=SVG_FIGHTER,G=A.state;INK.Combo.stop();if(INK.CombatFlow)INK.CombatFlow.set({rhythm:'legacy',rules:'legacy',speed:1});A.start('mai','ryu','training','assist');G.phase='fight';G.paused=false;document.getElementById('infinite').checked=false;document.getElementById('autohp').checked=false;document.getElementById('dummy').value='idle';const[f,d]=A.fighters;f.x=f.px=1167;d.x=d.px=1335;f.dir=1;d.dir=-1;const snap=()=>Object.fromEntries(['rearArm','frontArm','rearLeg','frontLeg'].map(k=>[k,structuredClone(f[k].points)]));if(!A.tryMove(0,'sMP'))throw Error('start failed');for(let i=0;i<120&&!(f.attack?.hitConfirmed&&G.hitstop>0);i++)A.step();if(!(f.attack?.hitConfirmed&&G.hitstop>0))throw Error('no real hit');A.renderFraction(1);const before=snap(),frame=f.attack.t,freeze=G.hitstop;A.step(freeze);const differences=[];for(const alpha of [0,.15,.5,.85,1]){A.renderFraction(alpha);const now=snap();differences.push({alpha,max:Math.max(...Object.keys(before).flatMap(k=>before[k].map((p,i)=>Math.hypot(p[0]-now[k][i][0],p[1]-now[k][i][1]))))});}const result={frame,endFrame:f.attack.t,freeze,differences,maximum:Math.max(...differences.map(d=>d.max))};G.paused=true;return result;}"""
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ.get('INK_CHROMIUM') or shutil.which('chromium'),headless=True,args=['--no-sandbox'])
 for name,path in [('literal-v6',R/'legacy/flow6/baseline-v6.html'),('v7',R/'dist/INK-Street-Fighter-6.html')]:
  p=b.new_page();p.on('pageerror',lambda e:errors.append(str(e)));data=path.read_bytes();p.set_content(data.decode('utf-8'),wait_until='load',timeout=60000);p.wait_for_function('window.INKForge?.ready');result=p.evaluate(script);rows.append({'version':name,'htmlSha256':hashlib.sha256(data).hexdigest(),**result});p.close()
 b.close()
passed=not errors and rows[0]['maximum']>1 and rows[1]['maximum']<1e-8 and all(r['frame']==r['endFrame'] for r in rows)
report={'suite':'flow7-literal-freeze-comparison','capturedAt':datetime.now(timezone.utc).isoformat(),'htmlSha256':rows[1]['htmlSha256'],'status':'passed' if passed else 'failed','versions':rows,'browserErrors':errors,'units':'Actor-local SVG coordinates, not screen/device pixels. One real sMP contact, same legacy stop length, actual unpaused renderer, sampled interpolation alpha.'};(O/'freeze-origin-comparison.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(report,ensure_ascii=False));raise SystemExit(0 if passed else 1)
