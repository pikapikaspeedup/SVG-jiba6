"""Mai's complete keyboard rhythm routes: ready/early/freeze-safe/strict input.
Uses real DOM keyboard handlers and the combat engine, never calls tryMove to
execute practice steps, never writes damage or cancels, and records failures.
"""
from pathlib import Path
import datetime,hashlib,json,os,shutil
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/flow4';O.mkdir(parents=True,exist_ok=True)
errors=[];cases=[];html=(R/'dist/INK-Street-Fighter-6.html').read_bytes()
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ.get('INK_CHROMIUM') or shutil.which('chromium'),headless=True,args=['--no-sandbox'])
 p=b.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.set_content(html.decode(),wait_until='load',timeout=60000);p.wait_for_function('window.INKComboUI')
 p.evaluate("async()=>{await INKComboUI.show();SVG_FIGHTER.state.paused=true;document.querySelector('#flow-control').value='rhythm';}")
 for rid in ['mai-confirm','mai-extended']:
  for side in [1,-1]:
   for buffer in [0,3,6]:
    for lead in [0,2]:
     data=p.evaluate('''({rid,side,buffer,lead})=>{const A=SVG_FIGHTER,C=INK.Combo,r=C.routes.routes.find(x=>x.id===rid);INKComboUI.select(rid);document.querySelector('#flow-buffer').value=buffer;
       C.start(r,'demo',{paused:true,side});A.step(700);if(C.status!=='success')throw Error('Reference demo failed');const ref=C.summary(),schedule=ref.actions.map((a,i)=>Math.max(0,a.frame-1-(i?lead:0)));
       C.start(r,'practice',{paused:true,side,control:'rhythm',bufferFrames:buffer});let sent=0;
       for(let n=0;n<800&&C.status==='running';n++){
        C.updateWindow(A.state,A.fighters);
        if(sent<schedule.length&&(lead===0?C.window.ready:C.clock>=schedule[sent])){A.state.paused=false;document.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyG',key:'g',bubbles:true}));document.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyG',key:'g',bubbles:true}));A.state.paused=true;sent++;}
        A.step(1);
       }
       const q=C.summary(),strictEarly=buffer===0&&lead>0;return{rid,side,buffer,lead,status:q.status,hits:q.hits,damage:q.damage,cursor:q.cursor,expectedHits:r.expectedHits,expectedDamage:ref.damage,timing:lead===0?'first legal window':'two frames before reference step',schedule,inputs:q.inputLog,remaining:q.remaining,pass:strictEarly?q.status!=='success'&&q.inputLog.some(i=>i.status==='early')&&!q.inputLog.some(i=>i.status==='buffered'):q.status==='success'&&q.hits===r.expectedHits&&q.damage===ref.damage&&q.remaining.drive>=0&&q.remaining.super>=0};}''',dict(rid=rid,side=side,buffer=buffer,lead=lead))
     cases.append(data);print(('PASS' if data['pass'] else 'FAIL'),rid,side,buffer,lead,data['status'],data['hits'],flush=True)
 # A held key must not request additional steps. Actual browser keydown.repeat
 # semantics are delivered through the same DOM listener, not Combo.requestStep.
 extra=p.evaluate('''()=>{const A=SVG_FIGHTER,C=INK.Combo,r=C.routes.routes.find(x=>x.id==='mai-confirm');C.start(r,'practice',{paused:false,control:'rhythm',bufferFrames:6});document.querySelector('#flow-buffer').value=6;
 document.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyG',key:'g',bubbles:true}));A.state.paused=true;
 for(let n=0;n<40;n++){A.state.paused=false;document.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyG',key:'g',repeat:true,bubbles:true}));A.state.paused=true;A.step(1);}
 return{name:'Held G repeats do not auto-request a second step',cursor:C.cursor,inputs:C.inputLog,pass:C.cursor===1&&C.inputLog.length===1};}''');cases.append(extra);print('PASS' if extra['pass'] else 'FAIL',extra['name'],flush=True)
 extra=p.evaluate('''()=>{const A=SVG_FIGHTER,C=INK.Combo,r=C.routes.routes.find(x=>x.id==='mai-confirm');C.start(r,'practice',{paused:false,control:'rhythm'});const select=document.querySelector('#flow-buffer');select.focus();for(let i=0;i<4;i++)select.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyG',key:'g',bubbles:true}));A.state.paused=true;A.step(12);return{name:'G while editing a focused setting does not start a move',cursor:C.cursor,inputs:C.inputLog,pass:C.cursor===0&&C.inputLog.length===0};}''');cases.append(extra);print('PASS' if extra['pass'] else 'FAIL',extra['name'],flush=True)
 b.close()
report={'capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'total':len(cases),'passed':sum(r['pass'] for r in cases),'tests':cases,'htmlSha256':hashlib.sha256(html).hexdigest(),'browserErrors':errors,'note':'Complete Mai routes through DOM G keyboard events. Early strict-mode cases intentionally fail to complete; a pass means the game rejected rather than auto-playing. Timings are simulation-controlled test schedules, not human reaction-time measurements.'}
(O/'rhythm-matrix.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps({k:v for k,v in report.items() if k!='tests'},ensure_ascii=False,indent=2));raise SystemExit(0 if report['total']==report['passed'] and not errors else 1)
