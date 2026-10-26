"""Measure actual source and projected joints at real successful move handoffs.
No manual damage, confirm flag, extra resource, or forced successful route.
Zero-duration bridges are recorded separately, not counted as smooth handoffs.
"""
from pathlib import Path
import datetime, hashlib, json, os, shutil
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2]; O=R/'qa/flow7'; html=(R/'dist/INK-Street-Fighter-6.html').read_bytes();errors=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ.get('INK_CHROMIUM') or shutil.which('chromium'),headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1280,'height':900});page.on('pageerror',lambda e:errors.append(str(e)));page.set_content(html.decode(),wait_until='load',timeout=60000);page.wait_for_function('window.INKRhythmLab?.ready')
 data=page.evaluate('''()=>{const A=SVG_FIGHTER,R=INK.Runtime,C=INK.Combo,rows=[],routes=[],pending=new WeakMap(),capture=R.capture,onMove=C.onMove;let routeId='',side=1;
 const get=f=>{const p=A.visualPose(f),rig=R.visualRig(f,p);return{pose:p,sockets:INK.Rig.sockets(p,rig),source:rig.anatomy.source};};
 R.capture=function(f,m){const previous=f.attack;pending.set(f,{from:get(f),previous:previous?.m.id,previousFrame:previous?.t,confirmed:!!previous?.confirmed,state:f.state,next:m.id});return capture.call(this,f,m);};
 C.onMove=function(f,m,g){const old=pending.get(f);if(old&&old.next===m.id){pending.delete(f);if(old.previous&&old.confirmed&&old.state==='attack'){
 const next=get(f),duration=f._inkJointTransition?.duration||0;let max=0,sourceMax=0;for(const name of ['rearArm','frontArm','rearLeg','frontLeg'])for(let j=0;j<3;j++){const a=old.from.sockets[name][j],b=next.sockets[name][j],c=old.from.source[name][j],d=next.source[name][j];max=Math.max(max,Math.hypot(a[0]-b[0],a[1]-b[1]));sourceMax=Math.max(sourceMax,Math.hypot(c[0]-d[0],c[1]-d[1]));}
 rows.push({route:routeId,side,previous:old.previous,previousFrame:old.previousFrame,next:m.id,duration,maximumJointDisplacement:max,maximumSourceJointDisplacement:sourceMax,pass:duration<=0||max<.002,instantaneous:duration<=0});}}
 return onMove.call(this,f,m,g);};
 try{for(const route of C.routes.routes)for(const s of [1,-1]){routeId=route.id;side=s;C.start(route,'demo',{paused:true,side});for(let n=0;n<1100&&C.status==='running';n++)A.step(1);const q=C.summary();routes.push({id:route.id,side,status:q.status,hits:q.hits,expected:route.expectedHits,pass:q.status==='success'&&q.hits===route.expectedHits});C.stop();}}finally{R.capture=capture;C.onMove=onMove;A.state.paused=true;}
 return{rows,routes};}''');b.close()
report={'suite':'flow7-real-cancel-joint-matrix','capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'htmlSha256':hashlib.sha256(html).hexdigest(),'routeTotal':len(data['routes']),'routePassed':sum(r['pass'] for r in data['routes']),'total':len(data['rows']),'passed':sum(r['pass'] for r in data['rows']),'maximumJointDisplacement':max((r['maximumJointDisplacement'] for r in data['rows'] if not r['instantaneous']),default=0),'instantaneousHandoffs':sum(r['instantaneous'] for r in data['rows']),'tests':data['rows'],'routes':data['routes'],'browserErrors':errors,'note':'Measurements are at the exact same actor-local time on either side of a real hit/guard-confirmed cancel. Opponent-relative facing and world root motion are battle-owned.'}
(O/'transition-matrix.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print('REAL CANCELS',report['passed'],'/',report['total'],'MAX',report['maximumJointDisplacement'],'ROUTES',report['routePassed'],'/',report['routeTotal'], 'ERRORS',errors,flush=True)
for r in data['rows']:
 if not r['pass']:print('FAIL',r,flush=True)
raise SystemExit(0 if not errors and report['routePassed']==report['routeTotal'] and report['passed']==report['total'] else 1)
