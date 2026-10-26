"""Combat contracts, mirrored routes and render-schedule independence.
Explicitly uses simulation-controlled scheduling, not hardware FPS claims.
"""
from pathlib import Path
import datetime,hashlib,json,os,shutil,zipfile
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/flow5';O.mkdir(parents=True,exist_ok=True);rows=[];errors=[]
html=(R/'dist/INK-Street-Fighter-6.html').read_bytes()
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ.get('INK_CHROMIUM') or shutil.which('chromium'),headless=True,args=['--no-sandbox'])
 p=b.new_page(viewport={'width':1280,'height':900});p.on('pageerror',lambda e:errors.append(str(e)));p.set_content(html.decode(),wait_until='load',timeout=60000);p.wait_for_function('window.INKEngineLab')
 output=p.evaluate('''()=>{const A=SVG_FIGHTER,C=INK.Combo,V=INK.VFX,rows=[],baseline=new Map();const plain=q=>JSON.stringify({status:q.status,hits:q.hits,damage:q.damage,frames:q.frames,remaining:q.remaining,actions:q.actions.map(a=>({move:a.move,frame:a.frame,hits:a.hits,damage:a.damage}))});
 for(const enabled of [false,true])for(const route of C.routes.routes)for(const side of [1,-1]){
  INK.MotionGraph.settings.enabled=enabled;C.start(route,'demo',{paused:true,side});const hp=A.fighters[1].hp;
  for(let n=0;n<900&&C.status==='running';n++)A.step(1);A.render();const q=C.summary(),key=route.id+':'+side,current=plain(q);if(!enabled)baseline.set(key,current);
  const valid=q.status==='success'&&q.hits===route.expectedHits&&q.maxCombo===q.hits&&hp-A.fighters[1].hp===q.damage&&q.remaining.drive>=0&&q.remaining.super>=0&&!document.querySelector('#infinite').checked&&document.querySelector('#dummy').value==='guard'&&current===baseline.get(key)&&!/NaN|Infinity/.test(document.querySelector('#game').outerHTML);
  rows.push({name:route.id+' / '+side+' / graph '+enabled,pass:valid,graphEnabled:enabled,side,...q});C.stop();
 }INK.MotionGraph.settings.enabled=true;return rows;}''');rows+=output
 print('MIRRORED GRAPH MATRIX',sum(r['pass'] for r in output),'/',len(output),flush=True)
 output=p.evaluate('''()=>{const A=SVG_FIGHTER,C=INK.Combo,V=INK.VFX,rows=[];const plain=q=>JSON.stringify({status:q.status,hits:q.hits,damage:q.damage,frames:q.frames,remaining:q.remaining,actions:q.actions.map(a=>({move:a.move,frame:a.frame,hits:a.hits,damage:a.damage}))});
 for(const route of C.routes.routes.filter(r=>r.id.endsWith('-extended'))){let baseline;
 for(const mode of ['none','sparse','integer','fractional']){C.start(route,'demo',{paused:false});let renders=0;
 for(let n=0;n<900&&C.status==='running';n++){A.step(1);if(mode==='integer'||mode==='sparse'&&n%3===0){A.renderFraction(1);renders++;}if(mode==='fractional'){A.renderFraction(.17);A.renderFraction(.81);renders+=2;}}
 const q=C.summary(),state=plain(q);if(mode==='none')baseline=state;rows.push({name:route.id+' / '+mode,pass:q.status==='success'&&state===baseline,mode,renders,...q});C.stop();
 }}A.state.paused=true;return rows;}''');rows+=output
 print('RENDER SCHEDULE MATRIX',sum(r['pass'] for r in output),'/',len(output),flush=True)
 # Actual final SVG transforms, including all new per-Mai graph layers.
 output=p.evaluate('''async()=>{const F=INKForge,out=[];await F.route('studio');for(const rec of F.store.list('mai').filter(r=>r.clip.meta?.motion5)){await F.loadMove('mai',rec.key);const r=F.state.draft,s=r.binding.startup,a=r.binding.active,d=r.clip.duration;for(const t of [0,Math.max(0,s-.25),s+.25,Math.min(d,s+a*.47+.125),Math.min(d,s+a-.25),Math.max(0,d-.25)]){F.atFrame(t);const pose=F.state.visualPose,rig=INK.Rig.solveAnimation(F.profile(),pose),fan=F.actor.frontArm.fan,root=document.querySelector('#f-actor-root'),original=root.getAttribute('transform');for(const side of [1,-1]){root.setAttribute('transform',original+(side===-1?' scale(-1 1)':''));for(const socket of ['fanGrip','fanTip']){const q=INK.Runtime.socket(pose,rig,socket),actual=new DOMPoint(socket==='fanTip'?79:0,0).matrixTransform(fan.getCTM()),expected=new DOMPoint(...q).matrixTransform(root.getCTM()),error=Math.hypot(actual.x-expected.x,actual.y-expected.y);out.push({key:r.key,t,side,socket,error,pass:Number.isFinite(error)&&error<.025});}}root.setAttribute('transform',original);}}return out;}''')
 sockets={'total':len(output),'passed':sum(r['pass'] for r in output),'maximumError':max(r['error'] for r in output),'samples':output,'htmlSha256':hashlib.sha256(html).hexdigest(),'note':'Final visual graph pose matched to actual SVG fan CTM. This is not the raw combat pose.'};(O/'socket-matrix.json').write_text(json.dumps(sockets,ensure_ascii=False,indent=2)+'\n');print('SOCKETS',sockets['passed'],'/',sockets['total'],'MAX',sockets['maximumError'],flush=True)
 b.close()
report={'suite':'flow5-combat-render','capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'htmlSha256':hashlib.sha256(html).hexdigest(),'total':len(rows),'passed':sum(r['pass'] for r in rows),'tests':rows,'browserErrors':errors,'note':'64 mirrored graph on/off routes plus 32 synthetic render-scheduling cases. Hardware refresh rates are not measured by this suite.'}
(O/'compatibility.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print('COMPATIBILITY',report['passed'],'/',report['total'],errors,flush=True)
raise SystemExit(0 if report['passed']==report['total'] and sockets['passed']==sockets['total'] and not errors else 1)
