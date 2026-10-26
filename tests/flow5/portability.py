"""Real standalone HTML re-export/import checks, without asserting native file permissions."""
from pathlib import Path
import datetime,hashlib,json,os,shutil
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/flow5';O.mkdir(parents=True,exist_ok=True)
html=(R/'dist/INK-Street-Fighter-6.html').read_bytes();rows=[];errors=[];requests=[]
def check(name,condition,detail=None):
 rows.append({'name':name,'pass':bool(condition),'detail':detail});print('PASS' if condition else 'FAIL',name,flush=True)
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ.get('INK_CHROMIUM') or shutil.which('chromium'),headless=True,args=['--no-sandbox'])
 def page(text):
  p=b.new_page(viewport={'width':1280,'height':900});p.on('pageerror',lambda e:errors.append(str(e)));p.on('request',lambda r:requests.append(r.url));p.set_content(text,wait_until='load',timeout=60000);p.wait_for_function('window.INKEngineLab');return p
 p=page(html.decode())
 q=p.evaluate('''async()=>{const F=INKForge,r=structuredClone(F.store.getMove('mai','ryuuenbu-heavy'));r.clip.meta.motion5.weightScale=.6;r.clip.meta.motion5.springs.frequency=.75;r.fx[0].particles.spacing=23;r.fx[0].particles.opacityCurve=[[0,0],[.2,1],[1,0]];await F.store.save({motion:r});return {motion:F.store.getMove('mai',r.key).clip.meta.motion5,fx:F.store.getMove('mai',r.key).fx[0],snapshot:F.store.snapshot().revision};}''')
 check('New graph and emitter data save before portable export',q['motion']['weightScale']==.6 and q['fx']['particles']['spacing']==23,q)
 exported=p.evaluate('INK.Portable.html(INKForge.store)');qpage=page(exported)
 q=qpage.evaluate('''()=>{const F=INKForge,r=F.store.getMove('mai','ryuuenbu-heavy');return{motion:r.clip.meta.motion5,fx:r.fx[0],id:F.store.id,game:SVG_FIGHTER.version,compiled:F.store.clip(r) instanceof INK.CompiledClip,graph:INK.MotionGraph.version,lab:!!INKEngineLab,external:!!document.querySelector('script[src],link[rel="stylesheet"][href^="http"],img[src^="http"]')};}''')
 check('Creator HTML export reopens with actual FLOW5 engines and edited JSON',q['motion']['springs']['frequency']==.75 and q['motion']['weightScale']==.6 and q['fx']['particles']['spacing']==23 and q['compiled'] and q['lab'] and q['graph']=='5.0.0' and q['game']=='5.0.0-ink-flow',q)
 check('Portable export contains no external runtime script/style/image dependency',not q['external'])
 q=qpage.evaluate('''()=>{const C=INK.Combo;C.start(C.routes.routes.find(r=>r.id==='mai-extended'),'demo',{paused:true});for(let i=0;i<900&&C.status==='running';i++)SVG_FIGHTER.step(1);const q=C.summary();C.stop();return q;}''')
 check('Edited portable game still executes real Mai 14 HIT / 3375 damage route',q['status']=='success' and q['hits']==14 and q['damage']==3375,q)
 player=p.evaluate('INK.Portable.html(INKForge.store,{playerOnly:true})');ppage=page(player);ppage.click('#engine5-open')
 q=ppage.evaluate('''()=>({player:document.body.classList.contains('forge-player'),lab:document.querySelector('#engine5-inspector').open,edit:!!document.querySelector('#engine5-edit').getClientRects().length,spacing:INKForge.store.getMove('mai','ryuuenbu-heavy').fx[0].particles.spacing})''')
 check('Edited player export retains inspector and edits but hides authoring entry',q['player'] and q['lab'] and not q['edit'] and q['spacing']==23,q)
 second=qpage.evaluate('INK.Portable.html(INKForge.store)');secondpage=page(second);q=secondpage.evaluate('''()=>{const r=INKForge.store.getMove('mai','ryuuenbu-heavy');return{frequency:r.clip.meta.motion5.springs.frequency,spacing:r.fx[0].particles.spacing,curve:r.fx[0].particles.opacityCurve,version:INKEngineLab.version};}''')
 check('Second-generation HTML export preserves engines, curves and parameters',q['frequency']==.75 and q['spacing']==23 and q['curve']==[[0,0],[.2,1],[1,0]] and q['version']=='5.0.0',q)
 q=p.evaluate('''()=>{const files=INK.Portable.packageFiles(INKForge.store,false),name='assets/ink/characters/mai/moves/ryuuenbu-heavy.json',r=JSON.parse(files[name]);return{moves:Object.keys(files).filter(k=>k.includes('/moves/')).length,name:JSON.parse(files['assets/ink/project.json']).name,build:JSON.parse(files['assets/ink/project.json']).build,spacing:r.fx[0].particles.spacing,readme:files['使用说明.txt']};}''')
 check('In-app asset package has 690 moves and FLOW5 identity, not a stale FLOW4 export',q['moves']==690 and q['build']=='5.0.0' and 'FLOW 5' in q['readme'] and q['spacing']==23,q)
 q=p.evaluate('''async()=>{const F=INKForge,before=JSON.stringify(F.store.snapshot()),r=structuredClone(F.store.getMove('mai','ryuuenbu-heavy'));r.clip.meta.motion5.layers[0].tracks.rootX=[[0,0],[r.clip.duration,80]];let rejected=false;try{await F.importData(r);}catch(e){rejected=true;}return{rejected,unchanged:before===JSON.stringify(F.store.snapshot())};}''')
 check('Unsafe graph-channel import is transactional and preserves prior saved project',q['rejected'] and q['unchanged'],q)
 q=p.evaluate('''async()=>{const F=INKForge,r=structuredClone(F.store.getMove('mai','ryuuenbu-heavy'));delete r.clip.meta.motion5;for(const e of r.fx){if(e.particles){delete e.particles.spacing;delete e.particles.rate;delete e.particles.burst;delete e.particles.inheritVelocity;delete e.particles.sizeCurve;delete e.particles.opacityCurve;delete e.particles.heat;}}const tracks=JSON.stringify(r.clip.tracks);await F.importData(r);await F.route('studio');F.atFrame(24.25);const got=F.store.getMove('mai',r.key);return{absent:got.clip.meta.motion5===undefined,tracksPreserved:tracks===JSON.stringify(got.clip.tracks),finite:!/NaN|Infinity/.test(F.actor.group.outerHTML),compiled:F.store.clip(got) instanceof INK.CompiledClip};}''')
 check('FLOW4-shaped legacy move imports without silently replacing user tracks or adding graph layers',all(q.values()),q)
 b.close()
check('No unhandled script errors during independent HTML reopens',not errors,errors)
check('No network request required by the tested standalone pages',not requests,requests)
report={'suite':'flow5-portability','capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'htmlSha256':hashlib.sha256(html).hexdigest(),'total':len(rows),'passed':sum(r['pass'] for r in rows),'tests':rows,'browserErrors':errors,'networkRequests':requests,'scope':'Independent complete-HTML byte loads and re-export with edited JSON. Native file:// and OS filesystem permissions are not asserted.'}
(O/'portability.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');raise SystemExit(0 if report['passed']==report['total'] else 1)
