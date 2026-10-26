"""Short live CPU matches; decisions must use the same paid move API."""
from pathlib import Path
import os,json,hashlib
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/pressure-flow';html=(R/'dist/INK-Street-Fighter-6.html').read_bytes()
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ['INK_CHROMIUM'],headless=True);p=b.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));p.set_content(html.decode());p.wait_for_function('window.INKPressureLab?.ready')
 samples=p.evaluate('''()=>{const A=SVG_FIGHTER,G=A.state,out=[];document.getElementById('difficulty').value='hard';for(const [i,id]of INK.Schema.CHARACTERS.entries()){A.start(id,INK.Schema.CHARACTERS[(i+1)%8],'demo','classic',147+i);G.paused=true;const counts={pursuit:0,pressure:0,defenses:0},seen=new WeakMap();let damage=false,finite=true;for(let t=0;t<1800;t++){A.step();for(const f of A.fighters){damage||=f.hp<10000;finite&&=[f.x,f.y,f.hp,f.drive].every(Number.isFinite)&&f.drive>=0;const now={pursuit:f._inkTactics?.pursuit||0,pressure:f._inkTactics?.pressure||0,defenses:f._inkPressure?.choices||0},old=seen.get(f)||{};for(const k in now)counts[k]+=Math.max(0,now[k]-(old[k]||0));seen.set(f,now);}if(t%90===0){A.render();INK.VFX.render(G,1);}}out.push({id,counts,damage,finite});}return out;}''');b.close()
 totals={k:sum(s['counts'][k] for s in samples) for k in ['pursuit','pressure','defenses']}
 rows=[{'name':'All eight live CPU pairings exchange damage with finite state','passed':all(s['damage'] and s['finite'] for s in samples)},{'name':'CPU actually chooses paid pursuit, pressure and defense','passed':all(v>0 for v in totals.values()),'details':totals}]
 report={'htmlSha256':hashlib.sha256(html).hexdigest(),'rows':rows,'samples':samples,'errors':errors};(O/'cpu.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2));assert all(r['passed'] for r in rows) and not errors
