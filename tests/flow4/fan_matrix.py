"""Compare real SVG fan transforms against the shared rig socket for all 44
revised Mai assets, six fractional/key phases, and both output mirror transforms.
No mutation of production assets, pose tracks, or combat state is required.
"""
from pathlib import Path
import datetime,hashlib,json,os,shutil
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/flow4';O.mkdir(parents=True,exist_ok=True)
records=[]
for path in sorted((R/'assets/ink/characters/mai/moves').glob('*.json')):
 data=json.loads(path.read_text(encoding='utf-8'))
 if data['clip'].get('meta',{}).get('flowEdition')==4:records.append(data['key'])
assert len(records)==44
errors=[];html=(R/'dist/INK-Street-Fighter-6.html').read_bytes()
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ.get('INK_CHROMIUM') or shutil.which('chromium'),headless=True,args=['--no-sandbox'])
 p=b.new_page(viewport={'width':1440,'height':1080},device_scale_factor=2);p.on('pageerror',lambda e:errors.append(str(e)));p.set_content(html.decode('utf-8'),wait_until='load',timeout=60000);p.wait_for_function('window.INKMaiShowcase')
 result=p.evaluate('''async(keys)=>{const F=INKForge,out=[];await F.route('studio');for(const key of keys){await F.loadMove('mai',key);const r=F.state.draft,s=r.binding.startup,a=r.binding.active,d=r.clip.duration;const times=[0,Math.max(0,s-.25),s+.25,Math.min(d,s+a*.47+.125),Math.min(d,s+a-.25),Math.max(0,d-.25)];for(const t of times){F.atFrame(t);const pose=F.state.pose,rig=F.state.solved,fan=F.actor.frontArm.fan,root=document.querySelector('#f-actor-root'),original=root.getAttribute('transform');for(const side of [1,-1]){root.setAttribute('transform',original+(side===-1?' scale(-1 1)':''));for(const socket of ['fanGrip','fanTip']){const q=INK.Runtime.socket(pose,rig,socket),actual=new DOMPoint(socket==='fanTip'?79:0,0).matrixTransform(fan.getCTM()),expected=new DOMPoint(...q).matrixTransform(root.getCTM()),error=Math.hypot(actual.x-expected.x,actual.y-expected.y);out.push({key,t,side,socket,error,pass:Number.isFinite(error)&&error<.025});}}root.setAttribute('transform',original);}}return out;}''',records)
 b.close()
report={'capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'htmlSha256':hashlib.sha256(html).hexdigest(),'assets':len(records),'poseSamples':len(records)*6,'coordinateChecks':len(result),'maximumError':max(r['error'] for r in result),'total':len(result),'passed':sum(r['pass'] for r in result),'samples':result,'browserErrors':errors,'note':'Actual DOM CTM at deviceScaleFactor 2. Mirrors are renderer output transforms; this does not replace both-direction combat tests.'}
(O/'fan-matrix.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps({k:v for k,v in report.items() if k!='samples'},ensure_ascii=False,indent=2));print('Failures',json.dumps([r for r in result if not r['pass']][:12],ensure_ascii=False));raise SystemExit(0 if report['total']==report['passed'] and not errors else 1)
