"""All existing routes, both directions, three rhythm profiles, full/off FX.
Hitstop deliberately changes elapsed ticks; never assert profiles have equal
wall-clock duration. Assert outcome/action duration and FX invariance instead.
"""
from pathlib import Path
import datetime,hashlib,json,shutil
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/flow9';data=(R/'dist/INK-Street-Fighter-6.html').read_bytes();errors=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox']);p=b.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.set_content(data.decode(),wait_until='load',timeout=60000);p.wait_for_function('window.INKFluidLab?.ready')
 result=p.evaluate('''()=>{const A=SVG_FIGHTER,C=INK.Combo,V=INK.VFX,T=INK.CombatFlow,rows=[],references={};for(const r of C.routes.routes)for(const side of [1,-1])for(const rhythm of ['weighted','fluid','legacy']){let fxReference=null;for(const effects of [true,false]){T.set({rhythm,rules:r.rulesPreset||'flow',speed:1});V.setEnabled(effects);C.start(r,'demo',{paused:true,side});for(let i=0;i<1800&&C.status==='running';i++){A.step();if(i%2===0)A.renderFraction(.6);}const q=C.summary(),outcome={hits:q.hits,damage:q.damage,actionFrames:q.actionFrames,remaining:q.remaining},signature=JSON.stringify(outcome),key=r.id+'/'+side;if(!references[key])references[key]=signature;const exact=JSON.stringify({...outcome,ticks:q.elapsedTicks});if(fxReference===null)fxReference=exact;rows.push({route:r.id,side,rhythm,effects,status:q.status,...outcome,ticks:q.elapsedTicks,reason:C.reason,pass:q.status==='success'&&q.hits===r.expectedHits&&fxReference===exact&&references[key]===signature});C.stop();}}return{rows};}''');b.close()
report={'suite':'flow9-three-rhythms-all-routes','utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'htmlSha256':hashlib.sha256(data).hexdigest(),'browserErrors':errors,'total':len(result['rows']),'passed':sum(r['pass'] for r in result['rows']),**result}
(O/'rhythm-matrix.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print('RHYTHM',report['passed'],'/',report['total'],errors);[print('FAIL',r) for r in result['rows'] if not r['pass']];raise SystemExit(0 if not errors and report['total']==report['passed'] else 1)
