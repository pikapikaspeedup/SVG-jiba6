"""Capture actual combat at a controlled nominal 60-Hz time scale.
Movie runs at 30fps: each frame advances 2 * selectedSpeed simulation ticks,
with a fractional accumulator for 0.85x. Fixed identical camera, no fake hits.
This is not a hardware performance recording.
"""
from pathlib import Path
import argparse,hashlib,datetime,json,os,shutil,subprocess,tempfile,io
from PIL import Image
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/flow7';a=argparse.ArgumentParser();a.add_argument('--baseline',type=Path,default=R/'legacy/flow6/baseline-v6.html');args=a.parse_args();old=args.baseline.read_bytes();new=(R/'dist/INK-Street-Fighter-6.html').read_bytes();errors=[];frames=0;segments=[]
setup='''async({label,route,speed,rhythm,subtitle})=>{await INKForge.route('battle');const A=SVG_FIGHTER,C=INK.Combo;C.stop();if(INK.CombatFlow)INK.CombatFlow.set({rhythm,rules:'flow',speed});INK.VFX.setEnabled(true);INK.VFX.settings.reducedMotion=false;INK.VFX.settings.intensity=1;C.start(C.routes.routes.find(r=>r.id===route),'demo',{paused:true,side:1});const NS=INK.SVG.NS;
 const pane=document.createElement('div');pane.id='record-pane';pane.style='position:fixed;inset:0;width:720px;height:534px;z-index:2147483647;background:#172723;color:#e4e3c9;font-family:Arial,sans-serif';
 const title=document.createElement('div');title.style='height:58px;box-sizing:border-box;padding:12px 20px;font-size:16px';title.textContent=label;pane.appendChild(title);const small=document.createElement('small');small.textContent='  /  '+subtitle;small.style='display:block;color:#b7c5ae;font-size:11px;margin-top:5px';title.append(small);
 const game=document.getElementById('game');game.style='position:absolute;left:0;top:62px;width:720px;height:405px;display:block;max-height:none';pane.appendChild(game);document.body.appendChild(pane);document.getElementById('camera').style.transform='translate(-480px, -40px)';
 const footer=document.createElement('div');footer.style='position:absolute;left:20px;right:20px;top:480px;display:flex;justify-content:space-between;font-family:monospace;font-size:14px';pane.appendChild(footer);window.rec={pane,footer,speed,acc:0,steps:0};A.renderFraction(1);return{route:C.route.id,version:A.version};}'''
step='''frame=>{const A=SVG_FIGHTER,C=INK.Combo,r=rec;r.acc+=2*r.speed;const steps=Math.floor(r.acc+1e-8);r.acc-=steps;A.step(steps);r.steps+=steps;A.renderFraction(1);const q=C.summary();r.footer.textContent=`${q.hits} HIT  /  ${q.damage} DAMAGE  /  ${r.speed.toFixed(2)}x                 ${((frame+1)/30).toFixed(2)}s`;return{status:q.status,hits:q.hits,damage:q.damage,gameTicks:r.steps,elapsedTicks:q.elapsedTicks,actions:q.actions.map(a=>a.move),resources:q.remaining};}'''
plans=[{'label':'旧路线，同一时间标尺','seconds':6,'left':{'label':'FLOW 06 / 1.00×','route':'mai-extended','speed':1,'rhythm':'legacy','subtitle':'原始 14 HIT 路线 · 原始停顿'},'right':{'label':'FLOW 07 / 1.00×','route':'mai-extended','speed':1,'rhythm':'weighted','subtitle':'相同路线 · 强弱分拍 / 末击收束'},'old':True},
{'label':'整体降速与停顿风格分离','seconds':7,'left':{'label':'FLOW 07 / 1.00×','route':'mai-extended','speed':1,'rhythm':'weighted','subtitle':'重心节奏 · 标准速度'},'right':{'label':'FLOW 07 / 0.85×','route':'mai-extended','speed':.85,'rhythm':'weighted','subtitle':'重心节奏 · 双方同步舒缓'},'old':False},
{'label':'新的有限命中连携','seconds':6,'left':{'label':'扇舞 · 重击衔接','route':'mai-flow-fan','speed':1,'rhythm':'weighted','subtitle':'中拳 → 重拳 → 轻龙炎舞 / 无起手能量'},'right':{'label':'忍步 · 仇樱收束','route':'mai-flow-cascade','speed':1,'rhythm':'weighted','subtitle':'蹲中拳 → 中脚 → 重拳 → OD 忍蜂 → SA3'},'old':False}]
with tempfile.TemporaryDirectory(prefix='flow7-video-') as tmp, sync_playwright() as pw:
 t=Path(tmp);b=pw.chromium.launch(executable_path=os.environ.get('INK_CHROMIUM') or shutil.which('chromium'),headless=True,args=['--no-sandbox']);idx=0
 for plan in plans:
  pages=[]
  for side in ['left','right']:
   p=b.new_page(viewport={'width':720,'height':534},device_scale_factor=1);p.on('pageerror',lambda e:errors.append(str(e)));p.set_content((old if side=='left' and plan['old'] else new).decode(),wait_until='load',timeout=60000);p.wait_for_function('window.INKForge?.ready');p.evaluate(setup,plan[side]);pages.append(p)
  result=None
  for frame in range(plan['seconds']*30):
   ims=[];states=[]
   for p in pages:
    states.append(p.evaluate(step,frame));ims.append(Image.open(io.BytesIO(p.locator('#record-pane').screenshot())).convert('RGB'))
   image=Image.new('RGB',(1440,534));image.paste(ims[0],(0,0));image.paste(ims[1],(720,0));image.save(t/f'frame-{idx:05d}.png');idx+=1;result=states
   if frame in [30,80,130]:image.save(O/f'playback-{len(segments)+1}-{frame:03d}.png')
  segments.append({'label':plan['label'],'seconds':plan['seconds'],'left':plan['left'],'right':plan['right'],'final':result});print('CAPTURED',plan['label'],idx,'frames',result,flush=True)
  for p in pages:p.close()
 b.close();subprocess.run([shutil.which('ffmpeg'),'-hide_banner','-loglevel','error','-y','-framerate','30','-i',str(t/'frame-%05d.png'),'-c:v','libx264','-preset','medium','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',str(O/'flow7-playback.mp4')],check=True)
report={'suite':'flow7-controlled-real-combat-playback','capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'htmlSha256':hashlib.sha256(new).hexdigest(),'baselineSha256':hashlib.sha256(old).hexdigest(),'frames':idx,'fps':30,'durationSeconds':idx/30,'segments':segments,'browserErrors':errors,'notes':['Actual production combat, assets, damage and particles. Fixed common camera suppresses camera shake only.','Controlled 60Hz simulation stepping; 0.85x consumes 51 simulation ticks per movie second. Not measured native device FPS.','Last-hit summary timing excludes subsequent freeze/recovery. The recording includes the tail animation.']};(O/'playback.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print('VIDEO',idx,'FRAMES','ERRORS',errors,flush=True);raise SystemExit(1 if errors or any(s['status']!='success' for seg in segments for s in seg['final']) else 0)
