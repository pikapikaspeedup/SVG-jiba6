"""Original/current actual world joint positions: repeat a frozen input time.
Coordinates are SVG stage units, not physical monitor pixels. No physics advance
between the two renders, same alpha. Browser callback is stopped deliberately.
"""
from pathlib import Path
import datetime,hashlib,json,shutil
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/flow9';errors=[];allrows=[]
script='''async()=>{const A=SVG_FIGHTER,G=A.state,R=INK.Runtime,rows=[],names=['frontHand','rearHand','frontElbow','rearElbow','frontFoot','rearFoot','frontKnee','rearKnee'];await INKForge.route('battle');INK.CombatFlow.set({rhythm:'weighted',rules:'flow',speed:1});INK.VFX.setEnabled(false);
function points(f){const p=f.visualPose,r=R.visualRig(f,p);return Object.fromEntries(names.map(n=>[n,INK.Rig.world(p,R.socket(p,r,n),{x:f.x,y:665+f.y,scale:f.renderScale||f.ch.scale||1.04,facing:f.dir})]));}
for(const char of A.characters.map(c=>c.id))for(const move of ['sMP','sHK'])for(const direction of [1,-1]){A.start(char,'ryu','training','classic');G.paused=true;document.querySelector('#dummy').value='idle';const [f,d]=A.fighters;f.x=f.px=direction===1?400:1040;d.x=d.px=direction===1?1120:320;f.dir=direction;d.dir=-direction;A.tryMove(0,move);A.step(3);G.paused=false;G.hitstop=0;G._inkStepFrozen=false;for(const f of A.fighters)f._inkHoldAction=-1;A.renderFraction(.35);const first=points(f);A.renderFraction(.35);const repeated=points(f);const distances=Object.fromEntries(names.map(n=>[n,Math.hypot(first[n][0]-repeated[n][0],first[n][1]-repeated[n][1])]));rows.push({char,move,direction,maxWorldJointDelta:Math.max(...Object.values(distances)),distances,first,repeated});G.paused=true;}return rows;}'''
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox'])
 for version,path in [('v8',R/'legacy/flow8/baseline-v8.html'),('v9',R/'dist/INK-Street-Fighter-6.html')]:
  p=b.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.set_content(path.read_text(),wait_until='load',timeout=60000);p.wait_for_function('window.INKResponseLab?.ready');p.evaluate('()=>{window.requestAnimationFrame=()=>0;}');p.wait_for_timeout(60);rows=p.evaluate(script);allrows.append({'version':version,'htmlSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'samples':len(rows),'maxWorldJointDelta':max(r['maxWorldJointDelta'] for r in rows),'rows':rows});p.close()
 b.close()
report={'suite':'flow9-world-joint-repeat-comparison','utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'htmlSha256':allrows[1]['htmlSha256'],'baselineSha256':allrows[0]['htmlSha256'],'pass':not errors and allrows[1]['maxWorldJointDelta']<1e-8 and allrows[0]['maxWorldJointDelta']>1,'browserErrors':errors,'versions':allrows,'scope':'Two native runtimes, identical 3 simulated steps and .35 alpha. Eight world joint sockets per actor, 8 characters × 2 moves × 2 directions. No claim about every transition or physical-device pixels.'}
(O/'same-frame-comparison.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print('WORLD JOINT REPEAT',report['pass'],[(x['version'],x['maxWorldJointDelta']) for x in allrows],errors);raise SystemExit(0 if report['pass'] else 1)
