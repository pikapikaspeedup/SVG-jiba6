"""Compare the uploaded v6 with v7 settings, not with the official game.
Identical authored old routes, same resource/spacing, first request to last hit.
Stepped simulation ticks are a 1x 60-Hz scale, not measured realtime FPS.
"""
from pathlib import Path
import datetime,hashlib,json,os,shutil,argparse
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/flow7'
a=argparse.ArgumentParser();a.add_argument('--baseline',type=Path,default=R/'legacy/flow6/baseline-v6.html');args=a.parse_args();errors=[];out=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ.get('INK_CHROMIUM') or shutil.which('chromium'),headless=True,args=['--no-sandbox'])
 for label,path,rhythm in [('v6',args.baseline,None),('v7-legacy',R/'dist/INK-Street-Fighter-6.html','legacy'),('v7-weighted',R/'dist/INK-Street-Fighter-6.html','weighted')]:
  p=b.new_page();data=path.read_bytes();p.on('pageerror',lambda e:errors.append(str(e)));p.set_content(data.decode(),wait_until='load',timeout=60000);p.wait_for_function('window.INKForge?.ready');rows=p.evaluate('''({rhythm})=>{const A=SVG_FIGHTER,C=INK.Combo,G=A.state,rows=[];if(INK.CombatFlow)INK.CombatFlow.set({rhythm,rules:'legacy',speed:1});for(const route of C.routes.routes.filter(r=>!r.rulesPreset))for(const side of [1,-1]){C.start(route,'demo',{paused:true,side});const tick=G.tick;for(let i=0;i<2000&&C.status==='running';i++)A.step();const q=C.summary();rows.push({route:route.id,side,status:q.status,hits:q.hits,damage:q.damage,totalTicks:G.tick-tick,actionFrames:q.frames,nominalSeconds:(G.tick-tick)/60,remaining:q.remaining,reason:q.reason});C.stop();}return rows;}''',{'rhythm':rhythm});out.append({'version':label,'htmlSha256':hashlib.sha256(data).hexdigest(),'rows':rows});p.close()
 b.close()
report={'suite':'flow7-v6-timing-comparison','capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'basis':'First request through final required hit; 1x 60-Hz ticks. Final-hit freeze and recovery not included. This is NOT a measured official SF6 comparison.','versions':out,'browserErrors':errors};(O/'pace-comparison.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
for v in out:
 print(v['version'],'routes',len(v['rows']),'success',sum(x['status']=='success' for x in v['rows']))
 for r in v['rows']:
  if r['side']==1 and r['route'].startswith('mai'):print(r)
raise SystemExit(0 if not errors and all(r['status']=='success' for v in out for r in v['rows']) else 1)
