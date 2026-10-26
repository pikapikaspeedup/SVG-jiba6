"""Real simulation sessions: canonical reset, physical ingress, command replay.
Detailed state signatures and offline replay validation are separate unfinished work.
"""
from pathlib import Path
import os,json,hashlib
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/flow11';O.mkdir(exist_ok=True);html=(R/'dist/INK-Street-Fighter-6.html').read_bytes()
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ['INK_CHROMIUM'],headless=True);p=b.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));p.set_content(html.decode());p.wait_for_function('window.INKSpacingLab?.ready')
 out=p.evaluate('''()=>{const A=SVG_FIGHTER,G=A.state,rows=[];const check=(name,passed)=>rows.push({name,passed});
 const config={characters:['ryu','ken'],seed:75,mode:'training',preset:'spacing',spacing:true};
 const snap=()=>({tick:G.tick,action:G.actionTick,hitstop:G.hitstop,slow:G.slow,phase:G.phase,clock:G.clock,input:[INK.Input.frame,INK.Input.serial],rng:INK.Random.combat.inspect(),fighters:A.fighters.map(f=>({hp:f.hp,x:f.x,y:f.y,dir:f.dir,state:f.state,t:f.stateT,attack:f.attack&&[f.attack.m.id,f.attack.t,[...f.attack.hitsDone]],held:[...f.input.held],dirs:f.input.dirs,queue:f.input.queue.map(q=>[q.m.id,q.inkFrame,q.serial]),drive:f.drive,super:f.super}))});
 A.session.begin(config);G.paused=true;const clean=JSON.stringify(snap());A.inputMove(0,'hadoken_1');A.step(100);G.slow=8;G.hitstop=7;A.fighters[0].extensionLeftover=999;G.unexpectedOldField=999;INK.Input.serial=1234;
 A.session.begin(config);G.paused=true;check('Canonical restart matches a clean start after old combat and clocks',JSON.stringify(snap())===clean);check('Fresh actors and global state discard unknown leftover fields',!('extensionLeftover'in A.fighters[0])&&!('unexpectedOldField'in G));
 const trace=[];for(let i=0;i<180;i++){if(i===0)A.press(0,'right');if(i===8)A.release(0,'right');if(i===12)A.inputMove(0,'sMP');if(i===80)A.inputMove(1,'sHK');if(i===86)A.retreat(0);A.step();trace.push(JSON.stringify(snap()));}
 const tape=A.commands.export();check('Public requests are queued once on the canonical timeline',tape.events.length===5);A.session.play(config,tape);G.paused=true;const repeat=[];for(let i=0;i<tape.ticks;i++){A.step();repeat.push(JSON.stringify(snap()));}check('Commands regenerate the same 180-step battle trajectory',JSON.stringify(trace)===JSON.stringify(repeat));
 const end=G.tick;A.press(0,'HP');A.retreat(0);A.step();check('Playback rejects public live commands and stops at the recorded end',G.tick===end&&A.commands.inspect().pending===0);
 const before=JSON.stringify(snap());try{A.session.play(config,{version:1,ticks:3,events:[{tick:2,order:0,command:{type:'move',actor:0,id:'does_not_exist',buffer:true}}]});}catch{}check('Invalid move imports do not change the current battle',JSON.stringify(snap())===before);
 // DOM events exercise the actual keyboard/touch source aggregation synchronously;
 // pause only outside each event batch so wall-clock scheduling cannot add steps.
 A.session.begin(config);G.paused=false;window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyJ',bubbles:true}));
 const button=document.querySelector('[data-btn="LP"]');button.dispatchEvent(new PointerEvent('pointerdown',{pointerId:99,pointerType:'touch',bubbles:true}));window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyJ',bubbles:true}));G.paused=true;A.step();
 check('Releasing keyboard keeps a button still held by touch',A.fighters[0].input.held.has('LP'));
 G.paused=false;button.dispatchEvent(new PointerEvent('pointerup',{pointerId:99,pointerType:'touch',bubbles:true}));G.paused=true;A.step();const physical=A.commands.export();check('Shared-device ownership records only the effective press and release',physical.events.length===2&&physical.events[0].command.press[0]==='LP'&&physical.events[1].command.release[0]==='LP'&&!A.fighters[0].input.held.has('LP'));
 A.session.begin(config);G.paused=false;for(const type of ['keydown','keyup','keydown'])window.dispatchEvent(new KeyboardEvent(type,{code:'KeyK',bubbles:true}));G.paused=true;A.step();const edges=A.commands.export().events;check('Press release press before one step retains all ordered edges',edges.length===3&&edges.every(e=>e.tick===1)&&edges.map(e=>e.order).join(',')==='0,1,2');
 A.session.begin(config);G.paused=true;A.press(0,'HP');A.step();const held=JSON.stringify([...A.fighters[0].input.held]);A.session.transportPause(true);A.session.transportPause(false);A.session.transportPause(true);check('Replay transport pause preserves held battle input',JSON.stringify([...A.fighters[0].input.held])===held);
 const cpu={characters:['ryu','ken'],seed:912,mode:'demo'};A.session.begin(cpu);G.paused=true;const ai=[];for(let i=0;i<600;i++){A.step();ai.push(JSON.stringify(snap()));}const aiTape=A.commands.export();A.session.play(cpu,aiTape);G.paused=true;let matched=true;for(let i=0;i<600;i++){A.step();if(JSON.stringify(snap())!==ai[i])matched=false;}check('CPU decisions are recomputed from seed without recording AI output',matched&&aiTape.events.length===0);
 A.session.begin(config);G.paused=false;window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyD',bubbles:true}));window.dispatchEvent(new Event('blur'));A.step();const resets=A.commands.export().events.filter(e=>e.command.type==='neutral');check('Focus loss records one reset and clears held input on the next step',resets.length===1&&A.fighters[0].input.held.size===0);window.dispatchEvent(new Event('focus'));
 return rows;}''')
 p.evaluate("async()=>{await INKForge.route('battle');SVG_FIGHTER.session.begin({characters:['ryu','ken'],seed:24,spacing:true,preset:'spacing'});}")
 p.keyboard.down('d');p.keyboard.press('k');p.keyboard.up('d');p.keyboard.press('x')
 real=p.evaluate("""()=>{const A=SVG_FIGHTER,G=A.state;G.paused=true;A.step(90);const snapshot=()=>JSON.stringify({tick:G.tick,action:G.actionTick,rng:INK.Random.combat.inspect(),fighters:A.fighters.map(f=>({hp:f.hp,x:f.x,y:f.y,state:f.state,t:f.stateT,drive:f.drive,held:[...f.input.held],attack:f.attack&&[f.attack.m.id,f.attack.t]}))});const before=snapshot(),config=A.session.config(),tape=A.commands.export();A.session.play(config,tape);G.paused=true;A.step(tape.ticks);return {same:before===snapshot(),events:tape.events.length};}""")
 out.append({'name':'Actual browser keyboard input regenerates the same combat result','passed':real['same'] and real['events']>=5})
 b.close()
for row in out:print('PASS' if row['passed'] else 'FAIL',row['name'],flush=True)
(O/'session-browser.json').write_text(json.dumps({'htmlSha256':hashlib.sha256(html).hexdigest(),'rows':out,'errors':errors},indent=2)+'\n')
assert all(x['passed'] for x in out) and not errors
