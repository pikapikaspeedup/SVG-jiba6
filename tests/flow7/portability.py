"""Independent portable generations plus actual local-file persistence where supported.
Does not substitute a synthetic origin success for an OS directory-permission test.
"""
from pathlib import Path
import datetime,hashlib,json,os,shutil,tempfile
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/flow7';data=(R/'dist/INK-Street-Fighter-6.html').read_bytes();rows=[];errors=[];requests=[];native={}
def check(name,condition,detail=None):
 rows.append({'name':name,'pass':bool(condition),'detail':detail});print('PASS' if condition else 'FAIL',name,detail if not condition else '',flush=True)
with sync_playwright() as pw, tempfile.TemporaryDirectory(prefix='flow7-roundtrip-') as temp:
 b=pw.chromium.launch(executable_path=os.environ.get('INK_CHROMIUM') or shutil.which('chromium'),headless=True,args=['--no-sandbox'])
 def page(text=None,path=None):
  p=b.new_page(viewport={'width':1280,'height':900});p.on('pageerror',lambda e:errors.append(str(e)));p.on('request',lambda r:requests.append(r.url))
  if path:p.goto(path.as_uri(),wait_until='load',timeout=60000)
  else:p.set_content(text,wait_until='load',timeout=60000)
  p.wait_for_function('window.INKRhythmLab?.ready',timeout=60000);return p
 # Native file:// is attempted rather than assumed unsupported from prior runs.
 try:
  p=page(path=R/'dist/INK-Street-Fighter-6.html');native={'opened':True,'scheme':p.url.split(':')[0],'storage':p.evaluate('INKForge.store.mode')}
 except Exception as e:
  native={'opened':False,'error':str(e)};p=page(data.decode())
 q=p.evaluate('''async()=>{const F=INKForge,L=INKRhythmLab,C=INK.Combo;await F.loadMove('mai','sMP');const rules=structuredClone(F.state.draft.transitions);rules.edges[0].end=11;rules.edges[0].label='二代导出测试';F.editTransitions(rules);const saved=await F.save();const r=structuredClone(C.routes.routes.find(r=>r.id==='mai-flow-cascade'));r.id='user-roundtrip';r.title='我的扇舞 </script><script>window.roundTripProbe=1</script>';L.importLibrary(r);L.setDraft(r);L.setSettings({rhythm:'weighted',rules:'flow',speed:.85,buffer:12});const files=INK.Portable.packageFiles(F.store,false);return{saved,id:F.store.id,end:F.store.byGame('mai','sMP').transitions.edges[0].end,settings:INK.CombatFlow.settings,routes:C.routes.routes.length,packageRoutes:JSON.parse(files['assets/ink/combos.json']).routes.length,assetCount:Object.keys(files).filter(k=>k.includes('/moves/')).length,readme:files['使用说明.txt'],build:F.store.manifest.build};}''')
 check('Save edited transition, current route library and settings before export',q['end']==11 and q['routes']==23 and q['packageRoutes']==23 and q['assetCount']==690 and q['build']=='7.0.0' and 'FLOW 7' in q['readme'],q)
 exported=p.evaluate('INK.Portable.html(INKForge.store)');player=p.evaluate('INK.Portable.html(INKForge.store,{playerOnly:true})')
 if native['opened']:
  p.reload(wait_until='load');p.wait_for_function('window.INKRhythmLab?.ready');q=p.evaluate('''()=>({storage:INKForge.store.mode,edge:INKForge.store.byGame('mai','sMP').transitions.edges[0].end,speed:INK.CombatFlow.settings.speed,buffer:INK.CombatFlow.settings.buffer,routes:INK.Combo.routes.routes.length})''');check('Native file reload retains saved motion, route and rhythm settings',q['edge']==11 and q['speed']==.85 and q['buffer']==12 and q['routes']==23,q)
 p.close()
 inspect='''()=>({version:SVG_FIGHTER.version,id:INKForge.store.id,edge:INKForge.store.byGame('mai','sMP').transitions.edges[0].end,label:INKForge.store.byGame('mai','sMP').transitions.edges[0].label,settings:{...INK.CombatFlow.settings},route:INK.Combo.routes.routes.find(r=>r.id==='user-roundtrip'),routes:INK.Combo.routes.routes.length,probe:window.roundTripProbe||null,external:!!document.querySelector('script[src],link[rel="stylesheet"][href^="http"],img[src^="http"]'),player:document.body.classList.contains('forge-player')})'''
 p=page(exported);q=p.evaluate(inspect);id1=q['id'];check('Independent creator export reopens with new engine, custom edge/route/settings',q['version']=='7.0.0-ink-rhythm' and q['edge']==11 and q['settings']['speed']==.85 and q['settings']['buffer']==12 and q['routes']==23 and q['route'] is not None,q)
 check('Exported route title is inert text, not executable script',q['probe'] is None and '</script>' in q['route']['title'],q['route']['title']);check('Export has no external runtime script/style/image dependency',not q['external'])
 q=p.evaluate('''()=>{const C=INK.Combo,A=SVG_FIGHTER;C.start(C.routes.routes.find(r=>r.id==='user-roundtrip'),'demo',{paused:true});for(let i=0;i<1200&&C.status==='running';i++)A.step();const q=C.summary();C.stop();return q;}''');check('Exported edited route executes 12 real hits with configured starting resources',q['status']=='success' and q['hits']==12 and q['damage']==3640,q)
 second=p.evaluate('INK.Portable.html(INKForge.store)');p.close();p=page(second);q=p.evaluate(inspect);check('Second-generation export retains route, edge, tempo and safe text',q['id']!=id1 and q['edge']==11 and q['settings']['buffer']==12 and q['settings']['speed']==.85 and q['route'] is not None and q['probe'] is None,q);p.close()
 p=page(player);awaited=p.evaluate('INKRhythmLab.show("user-roundtrip")');q=p.evaluate('''()=>({player:document.body.classList.contains('forge-player'),authorHidden:document.getElementById('r7-editor').hidden||getComputedStyle(document.getElementById('r7-editor')).display==='none',composer:INKRhythmLab.active,settings:INK.CombatFlow.settings,route:INK.Combo.route.id})''');check('Player export hides edge authoring but retains custom route composer and settings',q['player'] and q['authorHidden'] and q['composer'] and q['route']=='user-roundtrip' and q['settings']['speed']==.85,q);p.close()
 # New document loads in a fresh context must not inherit the edited portable ID.
 p=page(data.decode());q=p.evaluate('''()=>({id:INKForge.store.id,edge:INKForge.store.byGame('mai','sMP').transitions.edges[0].end,routes:INK.Combo.routes.routes.length})''');check('Independent original v7 remains unmodified by portable exports',q['id']=='ink-flow-sf6-v7' and q['edge']==12 and q['routes']==22,q)
 q=p.evaluate('''async()=>{const F=INKForge,r=structuredClone(F.store.byGame('mai','sMP'));delete r.transitions;const tracks=JSON.stringify(r.clip.tracks);await F.importData(r);const got=F.store.byGame('mai','sMP');return{absent:got.transitions===undefined,tracksPreserved:tracks===JSON.stringify(got.clip.tracks)};}''');check('Older v6-shaped motion import remains accepted without silent edge injection',q['absent'] and q['tracksPreserved'],q);p.close();b.close()
check('No unhandled browser script errors across reopens',not errors,errors)
network=[r for r in requests if r.startswith(('http:','https:'))];check('No network request needed for tested local or embedded HTML',not network,network)
report={'suite':'flow7-portability','capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'htmlSha256':hashlib.sha256(data).hexdigest(),'total':len(rows),'passed':sum(r['pass'] for r in rows),'tests':rows,'browserErrors':errors,'nativeLocalFile':native,'networkRequests':network,'scope':'Native file open/reload is separately reported. Independent complete-HTML generations also tested. No OS directory-picker grant or true phone performance asserted.'};(O/'portability.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');raise SystemExit(0 if report['passed']==report['total'] else 1)
