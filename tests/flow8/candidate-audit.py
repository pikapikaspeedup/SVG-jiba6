"""Direct observations on the user-supplied, unmodified v7 HTML."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,hashlib,datetime,shutil
R=Path(__file__).resolve().parents[2];O=R/'qa/flow8';data=(R/'dist/INK-Street-Fighter-6.html').read_bytes();errors=[]
script=r'''async()=>{
const A=SVG_FIGHTER,G=A.state;
await INKForge.route('battle');A.start('mai','ryu','training','classic');G.paused=true;document.querySelector('#dummy').value='idle';document.querySelector('#autohp').checked=false;
const rows=[];
function setup(){A.reset();G.paused=true;G.hitstop=0;G._inkStepFrozen=false;for(const f of A.fighters){f._inkHoldAction=-1;f.input.held.clear();}}
function fractions(name){A.render();G.paused=false;G.hitstop=0;G._inkStepFrozen=false;for(const f of A.fighters)f._inkHoldAction=-1;const f=A.fighters[0],samples=[];for(const alpha of [.1,.3,.5,.7,.9]){A.renderFraction(alpha);samples.push({alpha,pose:structuredClone(f.visualPose),root:f.root.getAttribute('transform'),frame:INK.State.contextForFX(f)?.frame});}G.paused=true;const distinct=new Set(samples.map(r=>JSON.stringify(r.pose))).size;rows.push({name,distinctPoseSamples:distinct,samples});}
setup();A.fighters[0].input.held.add('right');A.step(8);fractions('walk');
setup();A.fighters[0].input.held.add('up');A.step(13);A.fighters[0].input.held.clear();fractions('jump-rise-hold');
setup();A.fighters[0].input.held.add('up');A.step(8);A.fighters[0].input.held.clear();A.step(18);fractions('jump-apex');
setup();const f=A.fighters[0];f.y=f.py=-3;f.vy=8;A.step();A.step(2);fractions('land');
setup();INK.VFX.setEnabled(false);const d=A.fighters[1];d.y=d.py=-2;d.vy=12;d.knockOnLand=true;A.setState(d,'tumble');A.step();A.render();const ground=document.querySelector('#ground-fx');rows.push({name:'ground-impact-with-FX-off',legacyFxCount:G.fx.length,groundChildren:ground.children.length,groundDisplay:getComputedStyle(ground).display,visibleMarkup:ground.innerHTML.slice(0,1500)});
setup();const victim=A.fighters[1];const poseBefore=A.visualPose(victim),socketBefore=INK.Rig.sockets(poseBefore,INK.Runtime.visualRig(victim,poseBefore));A.setState(victim,'hit',25);const poseAfter=A.visualPose(victim),socketAfter=INK.Rig.sockets(poseAfter,INK.Runtime.visualRig(victim,poseAfter));let delta=0;for(const name of ['frontArm','rearArm','frontLeg','rearLeg'])for(let k=0;k<3;k++)delta=Math.max(delta,Math.hypot(socketBefore[name][k][0]-socketAfter[name][k][0],socketBefore[name][k][1]-socketAfter[name][k][1]));rows.push({name:'idle-to-hit',maximumImmediateSocketChange:delta,before:poseBefore,after:poseAfter});
G.paused=true;return rows;
}'''
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox']);p=b.new_page(viewport={'width':1440,'height':1000});p.on('pageerror',lambda e:errors.append(str(e)));p.set_content(data.decode(),wait_until='load',timeout=60000);p.wait_for_function('window.INKRhythmLab?.ready');rows=p.evaluate(script);b.close()
report={'suite':'flow8-candidate-observation','capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'htmlSha256':hashlib.sha256(data).hexdigest(),'observations':rows,'browserErrors':errors}
(O/'candidate-observations.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
for r in rows:print(r['name'],{k:v for k,v in r.items() if k not in ['name','samples','before','after','visibleMarkup']})
print('errors',errors)
