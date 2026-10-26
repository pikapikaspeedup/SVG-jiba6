"""Verify rendering frequency cannot change a real combo's combat result.
These are deterministic scheduling patterns, not measured display refresh rates.
"""
from pathlib import Path
import os, shutil, json
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('INK_CHROMIUM') or shutil.which('chromium') or shutil.which('google-chrome'),headless=True,args=['--no-sandbox'])
 page=b.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((R/'dist/INK-Street-Fighter-6.html').read_text(),wait_until='load',timeout=60000);page.wait_for_function('!!window.INKComboUI')
 rows=page.evaluate('''()=>{
  const A=SVG_FIGHTER,C=INK.Combo,out=[];
  const plain=q=>JSON.stringify({status:q.status,hits:q.hits,damage:q.damage,frames:q.frames,remaining:q.remaining,actions:q.actions.map(a=>({move:a.move,frame:a.frame,hits:a.hits,damage:a.damage}))});
  for(const r of C.routes.routes.filter(r=>r.id.endsWith('-extended'))){
   let baseline;
   for(const mode of ['none','sparse','integer','subframes']){
    C.start(r,'demo',{paused:false});let renders=0,finite=true;
    for(let i=0;i<900&&C.status==='running';i++){
     A.step(1);
     if(mode==='integer'||mode==='sparse'&&i%3===0){A.render();renders++;}
     if(mode==='subframes'){A.renderFraction(.17);A.renderFraction(.81);renders+=2;}
     if(mode!=='none'&&i%15===0)for(const f of A.fighters)if(f.inkRenderer&&/NaN|Infinity/.test(f.inkRenderer.root?.outerHTML||f.inkRenderer.group.outerHTML))finite=false;
    }
    const q=C.summary(),state=plain(q);if(mode==='none')baseline=state;
    out.push({name:r.id+' / '+mode,pass:q.status==='success'&&state===baseline&&finite,mode,renders,hits:q.hits,damage:q.damage,combatFrames:q.frames,remaining:q.remaining,finite});C.stop();
   }
  }
  A.state.paused=true;return out;
 }''')
 result={'total':len(rows),'passed':sum(r['pass'] for r in rows),'tests':rows,'errors':errors,'note':'Synthetic sparse/integer/two-subframe schedules over fixed combat steps, not hardware refresh-rate benchmarks.'}
 (R/'qa/flow/render-invariance.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
 print('Render invariance',result['passed'],'/',len(rows),'errors',errors,flush=True)
 for r in rows:
  if not r['pass']:print(r)
 b.close()
 if result['passed']!=result['total'] or errors:raise SystemExit(1)
