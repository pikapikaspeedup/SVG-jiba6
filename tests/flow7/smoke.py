from pathlib import Path
import json,hashlib,datetime,os,shutil
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/flow7';html=(R/'dist/INK-Street-Fighter-6.html').read_text();errors=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ.get('INK_CHROMIUM') or shutil.which('chromium'),headless=True,args=['--no-sandbox'])
 p=b.new_page(viewport={'width':1440,'height':1000});p.on('pageerror',lambda e:errors.append(str(e)));p.set_content(html,wait_until='load',timeout=60000)
 p.wait_for_function('window.INKForge?.ready',timeout=60000)
 rows=p.evaluate('''()=>{const C=INK.Combo,A=SVG_FIGHTER,T=INK.CombatFlow,rows=[];
 for(const rules of ['legacy','flow'])for(const rhythm of ['legacy','weighted'])for(const r of C.routes.routes.filter(r=>!r.rulesPreset))for(const side of [1,-1]){
  T.set({rules,rhythm});C.start(r,'demo',{paused:true,side});
  for(let i=0;i<1600&&C.status==='running';i++)A.step();
  const q=C.summary();rows.push({route:r.id,rules,rhythm,side,status:q.status,hits:q.hits,expected:r.expectedHits,frames:q.frames,ticks:q.elapsedTicks,damage:q.damage,reason:q.reason,pass:q.status==='success'&&q.hits===r.expectedHits});C.stop();
 }
 T.set({rhythm:'weighted',rules:'flow'});A.state.paused=true;return rows;
 }''')
 p.screenshot(path=str(O/'smoke.png'));b.close()
r={'suite':'flow7-initial-route-smoke','capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'htmlSha256':hashlib.sha256(html.encode()).hexdigest(),'total':len(rows),'passed':sum(x['pass'] for x in rows),'tests':rows,'errors':errors}
(O/'smoke.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n');print(r['passed'],'/',r['total'],'errors',errors)
for x in rows:
 if not x['pass']:print('FAIL',x)
raise SystemExit(0 if r['passed']==r['total'] and not errors else 1)
