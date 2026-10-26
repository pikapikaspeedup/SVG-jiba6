"""Original v8 / final v9 each execute their actual production frame callback.
No camera is replaced or suppressed in the camera segments. Fixed output clock
makes matched visual comparisons reproducible. NOT a measured FPS benchmark.
"""
from pathlib import Path
import argparse,datetime,hashlib,json,shutil,tempfile,subprocess,io
from PIL import Image
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/flow9';ap=argparse.ArgumentParser();ap.add_argument('--quick',action='store_true');opt=ap.parse_args();old=(R/'legacy/flow8/baseline-v8.html').read_bytes();new=(R/'dist/INK-Street-Fighter-6.html').read_bytes();errors=[];segments=[]
setup=r'''async({version,kind,speed})=>{
const A=SVG_FIGHTER,G=A.state;INK.Combo.stop();await INKForge.route('battle');A.start('mai','ryu','training','classic');G.paused=true;document.querySelector('#dummy').value='idle';document.querySelector('#autohp').checked=false;document.querySelector('#infinite').checked=false;INK.VFX.setEnabled(kind!=='subframe');INK.VFX.settings.reducedMotion=false;INK.VFX.settings.intensity=1;INK.CombatFlow.set({rhythm:'weighted',rules:'flow',speed:1});G.artSpeed=1;G.artCloseup=false;
const[f,d]=A.fighters;f.x=f.px=kind==='combo'?480:530;d.x=d.px=kind==='subframe'?1080:680;f.dir=1;d.dir=-1;f.input.held.clear();d.input.held.clear();f.super=3;f.drive=6;
if(kind==='combo'){const r=INK.Combo.routes.routes.find(r=>r.id==='mai-flow-cascade');INK.Combo.start(r,'demo',{paused:false,side:1});}
document.getElementById('f9-capture')?.remove();const pane=document.createElement('div');pane.id='f9-capture';pane.style='position:fixed;inset:0;width:720px;height:586px;z-index:2147483647;background:#e8e5d8;color:#304c3b;font-family:Arial,sans-serif';const header=document.createElement('div');header.style='height:70px;padding:12px 20px;box-sizing:border-box;background:#293f35;color:#eeeada;font-size:17px';header.textContent=version+' / '+{camera:'命中与出招 · 观察背景',combo:'真实连段 · 观察镜头与衔接',subframe:'同一时刻重画 · 观察姿态回跳'}[kind];const note=document.createElement('small');note.style='display:block;font-size:11px;margin-top:6px;color:#b6c3ae';note.textContent=kind==='subframe'?'固定模拟时刻与 alpha · 在首绘/复绘间切换 · 关闭特效':`${speed}× 时间采样 / 同一重心停顿与完整特效 / 各自原生镜头`;header.append(note);pane.append(header);
const svg=document.getElementById('game');svg.setAttribute('viewBox','0 0 1440 930');svg.style='display:block;position:absolute;left:0;top:70px;width:720px;height:465px;max-height:none';pane.append(svg);const footer=document.createElement('div');footer.style='position:absolute;left:20px;right:20px;bottom:13px;font:11px monospace;line-height:1.6;overflow-wrap:anywhere';pane.append(footer);document.body.append(pane);
if(typeof window.__productionFrame!=='function')throw Error('Production rAF callback not captured');G.paused=false;INK.EngineClock.reset();INK.Viewport?.reset();const now=performance.now();window.capture9={kind,speed,tick:0,footer,base:now,cameras:[],states:[],move:null,phase:0};__productionFrame(now);return{version:A.version,callback:__productionFrame.name};}'''
step=r'''frame=>{const A=SVG_FIGHTER,G=A.state,s=capture9,f=A.fighters[0];
if(s.kind==='subframe'){
 const cycle=Math.floor(frame/45),phase=frame%45;
 if(phase===0){A.reset();G.paused=true;A.fighters[0].x=A.fighters[0].px=530;A.fighters[1].x=A.fighters[1].px=1080;A.tryMove(0,['sMP','sHK','hissatsu_0'][cycle%3]);A.step(3);G.paused=false;G.hitstop=0;G._inkStepFrozen=false;A.fighters[0]._inkHoldAction=-1;A.renderFraction(.35);s.first=document.getElementById('camera').innerHTML;s.before=structuredClone(A.fighters[0].visualPose);A.renderFraction(.35);s.second=document.getElementById('camera').innerHTML;s.after=structuredClone(A.fighters[0].visualPose);s.label=['sMP','sHK','hissatsu_0'][cycle%3];}
 // A detached visual snapshot is used ONLY for a labelled fixed-time replay.
 // Actual first and repeat renders above came from each unmodified runtime.
 const which=Math.floor(phase/8)%2;document.getElementById('camera').innerHTML=which?s.second:s.first;
 s.footer.textContent=`${s.label} · 同一时间：3F / alpha 0.35 · ${which?'再次绘制':'第一次绘制'}`;
 return{kind:s.kind,label:s.label,which,before:s.before,after:s.after};
}
if(s.kind==='camera'){if(frame===8)A.tryMove(0,'sHP');if(frame===43)A.tryMove(0,'sHK');if(frame===80)A.tryMove(0,'hissatsu_2');}
__productionFrame(s.base+(frame+1)*1000/30*s.speed);const camera=document.querySelector('#camera').getAttribute('transform');s.cameras.push(camera);s.footer.textContent=`${G.tick} F · ${f.combo} HIT · ${f.comboDamage} DAMAGE\n${camera}`;
return{tick:G.tick,action:G.actionTick,camera,hit:f.combo,damage:f.comboDamage,status:INK.Combo.status,summary:INK.Combo.status==='success'?INK.Combo.summary():null};}'''
# Fixed-time snapshots replace SVG children, so do not reuse those pages for real
# combat afterwards. Each segment gets a fresh original/new runtime.
plans=[('camera',150,1),('combo',180,1)]
if opt.quick:plans=[('camera',12,1)]
with sync_playwright() as pw,tempfile.TemporaryDirectory(prefix='flow9-compare-') as temp:
 t=Path(temp);b=pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox']);idx=0
 for kind,count,speed in plans:
  pages=[]
  for label,data in [('FLOW 08 · 原始版本',old),('FLOW 09 · 稳镜与流畅',new)]:
   p=b.new_page(viewport={'width':720,'height':586});p.on('pageerror',lambda e:errors.append(str(e)));p.set_content(data.decode(),wait_until='load',timeout=60000);p.wait_for_function('window.INKResponseLab?.ready');p.evaluate("()=>{window.requestAnimationFrame=cb=>{if(cb?.name==='frame')window.__productionFrame=cb;return 0;};}");p.wait_for_timeout(80);p.evaluate(setup,dict(version=label,kind=kind,speed=speed));pages.append(p)
  rows=[]
  for n in range(count):
   images=[];states=[]
   for p in pages:
    states.append(p.evaluate(step,n));images.append(Image.open(io.BytesIO(p.locator('#f9-capture').screenshot(animations='disabled'))).convert('RGB'))
   result=Image.new('RGB',(1440,586));result.paste(images[0],(0,0));result.paste(images[1],(720,0));result.save(t/f'{idx:05d}.png');idx+=1;rows.append(states)
   if n in {int(count*.25),int(count*.5),int(count*.75)}:result.save(O/f'compare-{kind}-{n:03d}.png')
  for p in pages:p.close()
  segments.append(dict(kind=kind,playbackScale=speed,frames=count,rows=rows,cameraTransforms=[len(set(r[i].get('camera','') for r in rows)) for i in [0,1]]));print(kind,'frames',count,'camera counts',segments[-1]['cameraTransforms'],'last',rows[-1],flush=True)
 b.close();dest=O/('flow9-comparison-quick.mp4' if opt.quick else 'flow9-comparison.mp4');subprocess.run([shutil.which('ffmpeg'),'-hide_banner','-loglevel','error','-y','-framerate','30','-i',str(t/'%05d.png'),'-c:v','libx264','-preset','medium','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',str(dest)],check=True)
report=dict(suite='flow9-original-v8-comparison',capturedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),htmlSha256=hashlib.sha256(new).hexdigest(),baselineSha256=hashlib.sha256(old).hexdigest(),frames=idx,fps=30,durationSeconds=idx/30,segments=segments,browserErrors=errors,scope='Original v8 and current production rAF callback executed independently at the same supplied timestamps, same weighted rhythm, full FX and 1x setting. Camera is native, NOT manually fixed. Offline capture is a visual comparison, not hardware FPS evidence.')
(O/('comparison-quick.json' if opt.quick else 'comparison.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print('COMPARISON',idx,'frames',errors);raise SystemExit(1 if errors else 0)
