"""Small natural CPU sample; records input provenance without modifying AI choices."""
from pathlib import Path
import hashlib,json,os
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/strike-tempo';O.mkdir(parents=True,exist_ok=True);html=(R/'dist/INK-Street-Fighter-6.html').read_bytes()
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ['INK_CHROMIUM'],headless=True);p=b.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));p.set_content(html.decode());p.wait_for_function('window.INKDuel?.ready&&INK.StrikeTempo')
 runs=p.evaluate('''()=>{const A=SVG_FIGHTER,G=A.state,out=[];for(let seed=1;seed<=8;seed++){
 document.getElementById('difficulty').value='hard';A.start(seed%2?'ryu':'ken',seed%2?'ken':'luke','demo','classic',seed);G.paused=false;document.getElementById('infinite').checked=false;document.getElementById('autohp').checked=false;A.teleport(0,200);A.teleport(1,1240);A.step(130);A.teleport(0,550);A.teleport(1,seed%2?810:730);
 const seen=new Map(),feints=new Set(),bad=[],completed=[];let starts=0,holds=0,releases=0;const at=G.actionTick;
 for(let i=0;i<650&&G.actionTick-at<300&&G.phase==='fight';i++){A.step();for(const [index,f]of A.fighters.entries()){
 const a=f.attack,t=a?.tempo;if(t&&!seen.has(a)){starts++;seen.set(a,{index,a,held:false,released:false,done:false});if(!f.input.held.has(t.originButton)||f._inkTempoInput?.buttons[t.originButton]?.serial!==t.pressSerial)bad.push('missing actual origin '+index);}
 const entry=seen.get(a);if(entry&&t?.phase==='holding'&&!entry.held){entry.held=true;holds++;}
 if(entry&&t?.phase==='released'&&!entry.released){entry.released=true;releases++;}
 if(f._inkTempo?.phase==='feint')feints.add(f._inkTempo);
 for(const e of seen.values())if(e.index===index&&!e.done&&a!==e.a){e.done=true;completed.push({held:e.held,released:e.released});if(!f._inkTempoAI&&['HP','HK'].some(k=>f.input.held.has(k)))bad.push('orphan held button '+index);}
 }}
 // A real control handoff must release any CPU-owned key, including an interrupted hold.
 G.mode='training';document.getElementById('dummy').value='idle';A.step();const stuck=A.fighters.some(f=>f._inkTempoAI||['HP','HK'].some(k=>f.input.held.has(k)));
 out.push({seed,actionFrames:G.actionTick-at,starts,holds,releases,feints:feints.size,completed:completed.length,bad,stuck});}G.paused=true;return out;}''');b.close()
rows=[{'name':'natural CPU creates real button-origin heavy attacks','passed':sum(r['starts'] for r in runs)>0 and all(not r['bad'] for r in runs)},{'name':'natural CPU holds and releases heavy attacks','passed':sum(r['holds'] for r in runs)>0 and sum(r['releases'] for r in runs)>0},{'name':'CPU control handoff leaves no held attack keys','passed':all(not r['stuck'] for r in runs)}]
report={'htmlSha256':hashlib.sha256(html).hexdigest(),'rows':rows,'runs':runs,'naturalFeints':sum(r['feints'] for r in runs),'errors':errors};(O/'cpu.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False,indent=2));assert all(r['passed'] for r in rows) and not errors,errors
