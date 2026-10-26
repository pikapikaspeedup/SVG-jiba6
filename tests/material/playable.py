from pathlib import Path
import os,json,hashlib
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/material';html=(R/'dist/INK-Street-Fighter-6.html').read_bytes()
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ['INK_CHROMIUM'],headless=True);p=b.new_page(viewport={'width':1440,'height':1100});errors=[];p.on('pageerror',lambda e:errors.append(str(e)));p.set_content(html.decode());p.wait_for_function('window.INKDuel?.ready');p.locator('.kinetic-launch button').click();p.locator('#fight-practice').click()
 rows=p.evaluate('''()=>{const A=SVG_FIGHTER,G=A.state,out=[],check=(name,passed,details)=>out.push({name,passed,details});
 const setup=id=>{A.start(id,'ken','training','classic',123);G.paused=true;document.getElementById('dummy').value='idle';document.getElementById('autohp').checked=false;A.teleport(0,560);A.teleport(1,780);};
 for(const id of INK.Schema.CHARACTERS){setup(id);const m=A.moves[id].find(m=>m.category==='special'&&m.strength===1&&!m.air&&!m.throw&&!m.kind.includes('projectile'));A.inputMove(0,m.id);let visible=0,shapes=new Set(),peak=0;for(let i=0;i<55;i++){A.step();A.render();INK.VFX.render(G,1);peak=Math.max(peak,INK.VFX.stats.active);for(const r of INK.VFX.trails.live)if(r?.character===id){visible++;for(const l of INK.MaterialFlow.geometry(r.points,INK.VFX.time,r)){if(/NaN|Infinity/.test(l.d))throw Error(id+' invalid ribbon');shapes.add(l.d);}}}check(id+' produces moving material ribbons during a real special',visible>0&&shapes.size>5,{move:m.id,visible,shapes:shapes.size,peak});}
 setup('ken');const m=A.moves.ken.find(m=>m.category==='special'&&m.strength===1&&!m.air&&!m.kind.includes('projectile'));A.inputMove(0,m.id);A.step(m.startup+3);A.render();INK.VFX.render(G,1);const before=JSON.stringify({time:INK.VFX.time,particles:INK.VFX.pool.live,rows:INK.VFX.trails.live,hp:A.fighters.map(f=>f.hp)});for(let i=0;i<20;i++){A.render();INK.VFX.render(G,1);}check('Repeated paused draws neither emit nor advance combat',before===JSON.stringify({time:INK.VFX.time,particles:INK.VFX.pool.live,rows:INK.VFX.trails.live,hp:A.fighters.map(f=>f.hp)}));

 const rows=[{point:[0,0],time:0},{point:[50,-20],time:2},{point:[110,0],time:4}];const modes=INK.Schema.CHARACTERS.map(character=>JSON.stringify(INK.MaterialFlow.geometry(rows,5,{character,width:24})).replace(/#[a-fA-F0-9]+/g,'COLOR'));check('Eight material families differ in geometry beyond their colors',new Set(modes).size===8);
 const pool={items:[],add(p){this.items.push(p);}};const opts={x:0,y:0,frame:0,owner:A.fighters[0],m,result:'hit',dir:1,last:true,reduced:false,G};INK.MaterialFlow.contact(pool,opts);const hit=pool.items.reduce((n,p)=>n+p.vx,0)/pool.items.length;pool.items=[];INK.MaterialFlow.contact(pool,{...opts,result:'block'});const guard=pool.items.reduce((n,p)=>n+p.vx,0)/pool.items.length;check('Contact release travels through a hit and reflects from guard',hit>0&&guard<0,{hit,guard});
 INK.MaterialFlow.settings.enabled=false;A.render();INK.VFX.render(G,1);check('Legacy FX comparison hides material paths',INK.VFX.trails.nodes.every(n=>n.material.every(p=>p.getAttribute('display')==='none')));INK.MaterialFlow.settings.enabled=true; const combat=[];for(const enabled of [false,true]){INK.MaterialFlow.settings.enabled=enabled;setup('ken');A.inputMove(0,m.id);A.step(70);combat.push(A.fighters.map(f=>[f.hp,f.drive,f.x,f.y,f.state]));}check('Material upgrade preserves the same attack damage and fighter outcome',JSON.stringify(combat[0])===JSON.stringify(combat[1]));return out;}''')
 p.locator('#kinetic-character').select_option('ken');p.evaluate("SVG_FIGHTER.state.paused=true")
 p.locator('#material-coach button').click();p.evaluate("SVG_FIGHTER.step(14);SVG_FIGHTER.render();INK.VFX.render(SVG_FIGHTER.state,1)")
 p.locator('#f-battle-mount').screenshot(path=str(O/'ken.png'))
 for char in ['juri','mai','iori']:
  p.locator('#kinetic-character').select_option(char);p.evaluate("SVG_FIGHTER.state.paused=true")
  p.locator('#material-coach button').click();p.evaluate("SVG_FIGHTER.step(18);SVG_FIGHTER.render();INK.VFX.render(SVG_FIGHTER.state,1)")
  p.locator('#game').screenshot(path=str(O/(char+'.png')))
 p.set_viewport_size({'width':390,'height':844});rows.append({'name':'Material controls fit narrow viewport','passed':p.locator('#material-coach').evaluate('(e)=>e.getBoundingClientRect().right<=innerWidth+1')});b.close()
for r in rows:print('PASS' if r['passed'] else 'FAIL',r['name'],r.get('details',''))
(O/'playable.json').write_text(json.dumps({'htmlSha256':hashlib.sha256(html).hexdigest(),'rows':rows,'errors':errors},indent=2)+'\n');print(errors);assert all(r['passed'] for r in rows) and not errors
