"""Real trade and launch contacts must reuse snapshots taken before reaction writes."""
from pathlib import Path
import os,json,hashlib
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/hit-body';h=(R/'dist/INK-Street-Fighter-6.html').read_bytes()
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ['INK_CHROMIUM'],headless=True);p=b.new_page();p.set_content(h.decode());p.wait_for_function('window.INKDuel?.ready');errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
 rows=p.evaluate('''()=>{const A=SVG_FIGHTER,G=A.state,K=INK.Kinetic,change=INK.StateTransitions.change,original=K.contact;let contacts=[],transitions=[];
 K.contact=function(g,a,d,m,type,damage,context){if(type==='hit')contacts.push({actor:d.index,from:context.presentationFrom,oldReaction:d._inkReaction});return original.apply(this,arguments);};
 INK.StateTransitions.change=function(f,next,from){if(next==='hit'||next==='tumble')transitions.push({actor:f.index,next,from});return change.apply(this,arguments);};
 const out=[];function setup(){A.start('ryu','ryu','training','classic',42);G.paused=true;document.getElementById('dummy').value='idle';A.teleport(0,560);A.teleport(1,720);contacts=[];transitions=[];}
 try{setup();A.tryMove(0,'sLP');A.tryMove(1,'sLP');G.paused=true;for(let i=0;i<20&&contacts.length<2;i++)A.step();out.push({name:'mutual contact',count:contacts.length,states:contacts.map(c=>c.from?.state),clean:contacts.length===2&&contacts.every(c=>!c.oldReaction&&c.from?.state==='attack'),same:contacts.every(c=>transitions.filter(t=>t.actor===c.actor).every(t=>t.from===c.from))});
 setup();A.teleport(1,710);A.tryMove(0,'cHP');G.paused=true;for(let i=0;i<50&&!contacts.length;i++)A.step();out.push({name:'hit to tumble',count:contacts.length,transitions:transitions.map(t=>t.next),same:contacts.length===1&&transitions.length===2&&transitions.every(t=>t.from===contacts[0].from),state:A.fighters[1].state});
 }finally{K.contact=original;INK.StateTransitions.change=change;}return out;}''');b.close()
(O/'transaction.json').write_text(json.dumps({'htmlSha256':hashlib.sha256(h).hexdigest(),'rows':rows,'errors':errors},indent=2)+'\n');print(json.dumps(rows,indent=2));assert not errors and rows[0]['clean'] and all(r['same'] for r in rows) and rows[1]['state']=='tumble'
