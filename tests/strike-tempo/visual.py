from pathlib import Path
import os,json,hashlib,math
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/strike-tempo';O.mkdir(exist_ok=True);html=(R/'dist/INK-Street-Fighter-6.html').read_bytes()
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ['INK_CHROMIUM'],headless=True);p=b.new_page(viewport={'width':1440,'height':1100});p.set_content(html.decode());p.wait_for_function('window.INKDuel?.ready')
 p.evaluate('''()=>{window.tempoSetup=(id,button)=>{const A=SVG_FIGHTER,G=A.state;A.start(id,'ryu','training','classic',42);G.paused=false;document.getElementById('dummy').value='idle';document.getElementById('infinite').checked=false;A.teleport(0,500);A.teleport(1,1100);A.press(0,button);for(let i=0;i<50&&A.fighters[0].attack?.tempo?.phase!=='holding';i++)A.step();};window.tempoSample=()=>{const A=SVG_FIGHTER,f=A.fighters[0],p=A.visualPose(f),r=INK.Runtime.visualRig(f,p),s=INK.Rig.sockets(p,r),world={x:f.x,y:665+f.y,scale:f.renderScale||f.ch.scale||1,facing:f.dir},points={};for(const k of ['frontArm','rearArm','frontLeg','rearLeg'])points[k]=s[k].map(v=>INK.Rig.world(p,v,world));return {state:f.state,t:f.attack?.t,tempo:f.attack?.tempo?.phase,age:f.attack?.tempo?.age??f._inkTempo?.age,x:f.x,points,body:[p.bob||0,p.chestYaw||0,p.pelvisYaw||0]};};}''')
 rows=p.evaluate('''()=>{const A=SVG_FIGHTER,out=[];for(const id of INK.Schema.CHARACTERS)for(const button of ['HP','HK']){tempoSetup(id,button);const samples=[tempoSample()];for(let i=0;i<8;i++){A.step();samples.push(tempoSample());}const frozen=JSON.stringify(tempoSample())===JSON.stringify(tempoSample());A.release(0,button);for(let i=0;i<4;i++){A.step();samples.push(tempoSample());}out.push({id,button,frozen,samples});}for(const id of ['ryu','juri']){tempoSetup(id,'HP');A.step(6);const accepted=A.tryMove(0,'FEINT'),samples=[tempoSample()];for(let i=0;i<12;i++){A.step();samples.push(tempoSample());}A.release(0,'HP');out.push({id,feint:true,accepted,samples});}return out;}''')
 p.locator('.kinetic-launch button').click();p.locator('#fight-practice').click()
 for id,button in [('ryu','HP'),('juri','HK')]:
  p.evaluate('([id,button])=>{tempoSetup(id,button);SVG_FIGHTER.step(8);SVG_FIGHTER.state.paused=true;SVG_FIGHTER.render()}',[id,button]);p.locator('#f-battle-mount').screenshot(path=str(O/(id+'-hold.png')))
 b.close()
for row in rows:
 assert row.get('accepted',True) and row.get('frozen',True)
 if not row.get('feint'):assert row['samples'][0]['tempo']=='holding'
 assert all(math.isfinite(v) for s in row['samples'] for chain in s['points'].values() for point in chain for v in point)
 row['maxEndpointStep']=max(math.dist(a['points'][k][2],z['points'][k][2]) for a,z in zip(row['samples'],row['samples'][1:]) for k in a['points'])
 row['holdSupportTravel']=max(math.dist(row['samples'][0]['points']['rearLeg'][2],s['points']['rearLeg'][2]) for s in row['samples'][:9])
(O/'visual.json').write_text(json.dumps({'htmlSha256':hashlib.sha256(html).hexdigest(),'rows':rows},indent=2)+'\n')
print(json.dumps([{k:v for k,v in r.items() if k!='samples'} for r in rows],indent=2))
