"""Focused real contacts: eight bodies, sustained multihit, switches and exits."""
from pathlib import Path
import json,hashlib
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
raw=(ROOT/'dist/INK-Street-Fighter-6.html').read_bytes();errors=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/Users/miaomiaomiao/Library/Caches/ms-playwright/chromium-1169/chrome-mac/Chromium.app/Contents/MacOS/Chromium',headless=True)
 p=b.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.set_content(raw.decode());p.wait_for_function('window.INKDuel?.ready');p.locator('.kinetic-launch button').click()
 result=p.evaluate('''()=>{const A=SVG_FIGHTER,G=A.state;
 function setup(defender,attacker,gap=200){A.start(defender,attacker,'training','classic',42);G.paused=true;document.getElementById('dummy').value='idle';document.getElementById('autohp').checked=false;A.teleport(0,450);A.teleport(1,450+gap);A.step(12);return A.fighters;}
 function trace(d){const ep=d._inkHitRule,q=INK.HitRule.sample(d);return q?{time:q.time,owner:ep.owner,sourceOwner:ep.source.owner,hurt:A.geometry(d).hurt.length,part:ep.lastContact?.hurtID,count:ep.contactCount,head:q.model.head,chest:q.model.chest,feet:q.worldFeet,mode:INK.VisualFrame.get(A.visualPose(d)).mode}:null;}
 const rows=[];for(const id of ['ryu','ken','chun','cammy','luke','juri','mai','iori'])for(const move of ['sHP','cMK']){const [d,a]=setup(id,'ken'),accepted=A.tryMove(1,move),samples=[];let source=null,sourceSame=true;
 for(let t=0;t<80;t++){A.step();if(INK.HitRule.owns(d)){source??=d._inkHitRule.source;sourceSame&&=source===d._inkHitRule.source;const q=trace(d);if(!samples.length||q.time-samples[0].time>=2&&samples.length<4)samples.push(q);}}
 rows.push({id,move,accepted,damage:10000-d.hp,samples,sourceSame,state:d.state});}
 const [d,a]=setup('ryu','chun',175),accepted=A.tryMove(1,'legs_2'),beats=[],owners=new Set();let last=0,source=null,sourceSame=true;
 for(let t=0;t<140;t++){A.step();if(INK.HitRule.owns(d)){const ep=d._inkHitRule;source??=ep.source;sourceSame&&=source===ep.source;owners.add(ep.owner);if(ep.contactCount!==last){last=ep.contactCount;beats.push(trace(d));}}}
 const multi={accepted,damage:10000-d.hp,beats,owners:[...owners],sourceSame,events:G.combatEvents.filter(e=>e.defender===0),exitMP:A.tryMove(0,'sMP')};
 const flags={};for(const disabled of [false,true]){const [d,a]=setup('mai','ken',200);const saved={runtime:INK.Runtime.enabled,kinetic:INK.Kinetic.settings.enabled,motion:INK.MotionGraph.settings.enabled,hit:INK.HitBody.settings.enabled,strike:INK.StrikeFeel.settings.enabled};if(disabled){INK.Runtime.enabled=false;INK.Kinetic.settings.enabled=false;INK.MotionGraph.settings.enabled=false;INK.HitBody.settings.enabled=false;INK.StrikeFeel.settings.enabled=false;}A.tryMove(1,'sHP');const states=[];let clock=-1;for(let t=0;t<75;t++){A.step();if(INK.HitRule.owns(d)&&d._inkVisualClock!==clock){clock=d._inkVisualClock;states.push({clock,x:d.x,hp:d.hp,stateT:d.stateT,hurt:A.geometry(d).hurt});}A.visualPose(d);if(!disabled){A.visualPose(d);A.visualPose(d);}}flags[disabled?'off':'on']={damage:10000-d.hp,states};INK.Runtime.enabled=saved.runtime;INK.Kinetic.settings.enabled=saved.kinetic;INK.MotionGraph.settings.enabled=saved.motion;INK.HitBody.settings.enabled=saved.hit;INK.StrikeFeel.settings.enabled=saved.strike;}
 return {rows,multi,visualSwitchesEqual:JSON.stringify(flags.on)===JSON.stringify(flags.off),flags};}''')
 b.close()
report={'htmlSha256':hashlib.sha256(raw).hexdigest(),'errors':errors,**result};out=ROOT/'qa/hit-rule';out.mkdir(exist_ok=True);(out/'fight.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
assert not errors,errors
assert all(r['accepted'] and r['sourceSame'] and r['samples'] and all(s['hurt']==20 and s['mode']=='hit-rule' for s in r['samples']) for r in result['rows'])
assert len(result['multi']['beats'])>=4 and len(result['multi']['owners'])==1 and result['multi']['sourceSame'],result['multi']
assert result['visualSwitchesEqual'],'Presentation switches changed native hit combat'
print(json.dumps({'htmlSha256':report['htmlSha256'],'eightBodyFights':len(result['rows']),'multiBeats':len(result['multi']['beats']),'multiDamage':result['multi']['damage'],'exitMP':result['multi']['exitMP'],'visualSwitchesEqual':result['visualSwitchesEqual'],'errors':errors}))
