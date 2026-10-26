from pathlib import Path
import os,json,hashlib
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];raw=(R/'dist/INK-Street-Fighter-6.html').read_bytes();errors=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ['INK_CHROMIUM'],headless=True);p=b.new_page(viewport={'width':1440,'height':1000});p.on('pageerror',lambda e:errors.append(str(e)));p.set_content(raw.decode());p.wait_for_function('window.INKDuel?.ready&&INK.StrikeScore');p.locator('.kinetic-launch button').click()
 result=p.evaluate('''()=>{const A=SVG_FIGHTER,G=A.state,dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]),rows=[],plates=[];
 for(const id of ['ryu','ken','chun','cammy','luke','juri','mai','iori'])for(const move of ['sMP','sHP','cMK']){
  A.start(id,'ryu','training','classic',42);G.paused=true;document.getElementById('dummy').value='idle';A.teleport(0,450);A.teleport(1,1150);INK.VFX.settings.enabled=false;
  const accepted=A.tryMove(0,move),f=A.fighters[0],m=f.attack.m,name=move==='cMK'?'frontLeg':'frontArm',end=m.startup+m.active,frames=[Math.round(m.startup*.45),m.startup,Math.floor(m.startup+(m.active-1)/2),end,Math.round(end+m.recovery*.28),Math.round(end+m.recovery*.75)],unique=[...new Set(frames)].sort((a,b)=>a-b);
  for(const t of unique){while(f.attack&&f.attack.t<t)A.step();if(!f.attack)throw Error('Unexpected end '+id+move);
   const cp=A.pose(f),cr=INK.Runtime.rig(f,cp),vp=A.visualPose(f),vf=INK.VisualFrame.get(vp),chain=INK.Rig.sockets(cp,cr)[name].map(q=>INK.Rig.world(cp,q,{x:0,y:0,scale:1,facing:f.dir})),native=vf.carrierSpec.nativeChains[name],lengths=INK.Anatomy.lengths(INK.Runtime.profile(id)).slice(move==='cMK'?2:0,move==='cMK'?4:2),repeated=INK.VisualFrame.get(A.visualPose(f));
   const row={id,move,t,accepted,active:t>=m.startup&&t<=end,chainError:Math.max(...chain.map((q,i)=>dist(q,vf.joints3D[name][i]))),nativeError:Math.max(...lengths.map((l,i)=>Math.abs(l-dist(native[i],native[i+1])))),wristError:dist(vf.endFrames[name].slice(4),vf.joints3D[name][2]),repeat:JSON.stringify(vf.joints3D)===JSON.stringify(repeated.joints3D),compatibility:vf.contactCompatibility||null};rows.push(row);
   if(t===frames[0]||t===m.startup||t===frames[4]||t===frames[5]){A.render();plates.push({id,move,t,stage:t<m.startup?'准备':t===m.startup?'接触':t===frames[4]?'回收':'归护',svg:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="250 270 480 440"><defs>'+document.querySelector('#game defs').innerHTML+'</defs>'+f.root.outerHTML+'</svg>'});}
  }
 }
 return {rows,plates};}''')
 plates=result.pop('plates');gallery=pw.chromium.launch(executable_path=os.environ['INK_CHROMIUM'],headless=True);g=gallery.new_page(viewport={'width':1120,'height':2500});import base64,html
 for move in ['sMP','sHP','cMK']:
  cells=''.join('<article><img src="data:image/svg+xml;base64,'+base64.b64encode(r['svg'].encode()).decode()+'"><p>'+html.escape(r['id']+' · '+r['stage']+' · '+str(r['t'])+'F')+'</p></article>' for r in plates if r['move']==move)
  g.set_content('<html><meta charset="utf-8"><style>body{margin:20px;background:#eee9df;color:#242124;font:16px sans-serif}main{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}article{background:#faf8f4}img{width:100%;height:258px}p{margin:4px 12px 10px}h1{font-size:24px}</style><h1>八角色 '+move+' · 实际引擎姿态</h1><main>'+cells+'</main></html>');g.screenshot(path=str(R/'qa/strike-score'/('poses-'+move+'.png')),full_page=True)
 gallery.close();b.close()
result.update(sha256=hashlib.sha256(raw).hexdigest(),errors=errors);(R/'qa/strike-score/playable.json').write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n')
print(json.dumps({'samples':len(result['rows']),'activeMaxError':max(r['chainError'] for r in result['rows'] if r['active']),'nativeMaxError':max(r['nativeError'] for r in result['rows']),'wristMaxError':max(r['wristError'] for r in result['rows']),'errors':errors},ensure_ascii=False))
assert not errors
assert all(r['accepted'] and r['repeat'] and r['nativeError']<1e-6 and r['wristError']<1e-6 for r in result['rows'])
assert all(r['chainError']<1e-6 and r['compatibility'] for r in result['rows'] if r['active'])
