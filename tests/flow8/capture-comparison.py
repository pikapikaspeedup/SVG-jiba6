"""Unmodified v7 vs current production HTML, actual simulated movement/contact.
Output 30fps with a common fixed camera, controlled subframes and labelled slow
motion. NOT a measured hardware FPS benchmark or official-game comparison.
"""
from pathlib import Path
import argparse,datetime,hashlib,json,shutil,tempfile,subprocess,io
from PIL import Image
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/flow8';ap=argparse.ArgumentParser();ap.add_argument('--baseline',type=Path,default=(R/'legacy/flow7/baseline-v7.html'));args=ap.parse_args();old=args.baseline.read_bytes();new=(R/'dist/INK-Street-Fighter-6.html').read_bytes();errors=[];segments=[]
setup='''async({version,kind,speed})=>{await INKForge.route('battle');INK.Combo.stop();const A=SVG_FIGHTER,G=A.state;A.start('mai','ryu','training','classic');G.paused=true;document.querySelector('#dummy').value='idle';document.querySelector('#autohp').checked=false;document.querySelector('#infinite').checked=false;INK.VFX.setEnabled(kind==='echo');INK.VFX.settings.reducedMotion=false;INK.VFX.settings.intensity=1;INK.CombatFlow.set({rhythm:'weighted',rules:'flow',speed:1});const[f,d]=A.fighters;f.x=f.px=520;d.x=d.px=kind==='knockdown'?678:1030;f.dir=1;d.dir=-1;f.input.held.clear();d.input.held.clear();
 document.getElementById('v8-capture')?.remove();const pane=document.createElement('div');pane.id='v8-capture';pane.style='position:fixed;inset:0;width:720px;height:620px;z-index:2147483647;background:#e8e5d8;color:#304c3b;font-family:Arial,sans-serif';const header=document.createElement('div');header.style='height:63px;padding:14px 22px;box-sizing:border-box;background:#293f35;color:#eeeada;font-size:17px';header.textContent=version+' / '+{walk:'行走 · 停步 · 后退',jump:'起跳 · 落地 · 缓冲',knockdown:'真实扫腿 · 倒地 · 起身',echo:'OD 冲刺 · 真实身体残影'}[kind];const note=document.createElement('small');note.style='display:block;font-size:11px;margin-top:6px;color:#b6c3ae';note.textContent=`${speed}× 慢放 / 同一 60 Hz 模拟 / ${kind==='echo'?'完整特效':'关闭特效'} / 固定相同镜头`;header.append(note);pane.append(header);const svg=document.getElementById('game');svg.setAttribute('viewBox','250 0 1020 750');svg.style='display:block;position:absolute;left:0;top:63px;width:720px;height:529px;max-height:none';pane.append(svg);svg.querySelector('#camera').setAttribute('transform','');svg.querySelector('#camera').style.transform='none';const footer=document.createElement('div');footer.style='position:absolute;left:22px;right:22px;bottom:9px;font:12px monospace';pane.append(footer);document.body.append(pane);window.capture8={kind,speed,tick:0,footer,steps:0,move:null};A.renderFraction(1);return A.version;}'''
step='''frame=>{const A=SVG_FIGHTER,G=A.state,s=capture8,f=A.fighters[0],target=(frame+1)*2*s.speed,until=Math.floor(target+1e-9);G.paused=false;while(s.tick<until){const n=s.tick;if(s.kind==='walk'){if(n===5)f.input.held.add('right');if(n===35)f.input.held.clear();if(n===55)f.input.held.add('left');if(n===85)f.input.held.clear();}if(s.kind==='jump'){if(n===5)f.input.held.add('up');if(n===9)f.input.held.clear();}if(s.kind==='knockdown'&&n===8)A.move(0,'cHK');if(s.kind==='echo'&&n===8){const m=A.moves.mai.find(m=>m.od&&!m.super&&m.travel>0&&m.base==='shinobibachi')||A.moves.mai.find(m=>m.od&&!m.super&&m.travel>0);s.move=m.id;A.move(0,m.id);}A.step();s.tick++;}const alpha=target-until;A.renderFraction(alpha);G.paused=true;s.footer.textContent=`${A.fighters[0].state} / ${A.fighters[1].state}   ·   ${s.tick} F   ·   ${f.combo} HIT   ·   ${f.comboDamage} DAMAGE`;return{steps:s.tick,actorStates:A.fighters.map(f=>f.state),hits:f.combo,damage:f.comboDamage,fx:G.fx.length,ghosts:G.ghosts.length,move:s.move};}'''
plans=[('walk',110,.25),('jump',110,.25),('knockdown',175,.5),('echo',100,.5)]
with sync_playwright() as pw,tempfile.TemporaryDirectory(prefix='flow8-compare-') as temp:
 t=Path(temp);b=pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox']);idx=0
 for kind,ticks,speed in plans:
  pages=[]
  for label,data in [('FLOW 07 · 原始版本',old),('FLOW 08 · 响应引擎',new)]:
   p=b.new_page(viewport={'width':720,'height':620});p.on('pageerror',lambda e:errors.append(str(e)));p.set_content(data.decode(),wait_until='load',timeout=60000);p.wait_for_function('window.INKRhythmLab?.ready');p.evaluate('window.requestAnimationFrame=()=>0');p.wait_for_timeout(60);p.evaluate(setup,dict(version=label,kind=kind,speed=speed));pages.append(p)
  count=round(ticks/(2*speed));last=None
  for n in range(count):
   images=[];states=[]
   for p in pages:
    states.append(p.evaluate(step,n));images.append(Image.open(io.BytesIO(p.locator('#v8-capture').screenshot(animations='disabled'))).convert('RGB'))
   result=Image.new('RGB',(1440,620));result.paste(images[0],(0,0));result.paste(images[1],(720,0));result.save(t/f'{idx:05d}.png');idx+=1;last=states
   if n in {int(count*.25),int(count*.5),int(count*.75)}:result.save(O/f'compare-{kind}-{n:03d}.png')
  for p in pages:p.close()
  segments.append(dict(kind=kind,simulationSteps=ticks,slowMotion=speed,frames=count,final=last));print(kind,'frames',count,'total',idx,'result',last,flush=True)
 b.close();subprocess.run([shutil.which('ffmpeg'),'-hide_banner','-loglevel','error','-y','-framerate','30','-i',str(t/'%05d.png'),'-c:v','libx264','-preset','medium','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',str(O/'flow8-comparison.mp4')],check=True)
report=dict(suite='flow8-unmodified-v7-comparison',capturedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),htmlSha256=hashlib.sha256(new).hexdigest(),baselineSha256=hashlib.sha256(old).hexdigest(),frames=idx,fps=30,durationSeconds=idx/30,segments=segments,browserErrors=errors,scope='Both original source runtimes executed independently. Actual contact/inputs, common fixed camera. Deliberately labelled slow-motion. Not hardware FPS or official-game data.')
(O/'comparison.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print('COMPARISON',idx,'frames',errors);raise SystemExit(1 if errors else 0)
