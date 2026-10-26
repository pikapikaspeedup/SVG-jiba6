"""Capture literal V5 and V6 production renderers, not an emulated legacy toggle.
Requires Playwright, Pillow and ffmpeg. Screens are sampled by animation time,
not by wall FPS; this is a slow-motion comparison, not a performance benchmark.
"""
from pathlib import Path
import argparse, datetime, hashlib, json, os, shutil, subprocess, tempfile
from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/flow6';P=argparse.ArgumentParser();P.add_argument('--baseline',type=Path,default=R/'legacy/flow5/baseline-v5.html');args=P.parse_args()
old=args.baseline.read_bytes();new=(R/'dist/INK-Street-Fighter-6.html').read_bytes();rows=[];errors=[];selected=[]
setup='''label=>{SVG_FIGHTER.state.paused=true;INK.VFX.settings.enabled=false;const svg=document.createElementNS(INK.SVG.NS,'svg');svg.id='comparison-stage';svg.setAttribute('viewBox','0 0 460 640');svg.style='position:fixed;inset:0;width:460px;height:640px;z-index:999999;background:#f5efe3';document.body.appendChild(svg);const S=INK.SVG;S.node('path',{d:'M20 588H440M230 72V602',stroke:'#c6c9b8','stroke-width':1},svg);S.node('ellipse',{cx:230,cy:591,rx:104,ry:7,fill:'#405948',opacity:.09},svg);const tag=S.node('text',{x:24,y:35,'font-size':21,'font-family':'system-ui',fill:'#293f32'},svg);tag.textContent=label;const title=S.node('text',{x:24,y:64,'font-size':14,'font-family':'system-ui',fill:'#60745f'},svg);const group=S.node('g',{},svg),profile=INKForge.store.profile('mai'),actor=new INK.Renderer(group,profile);actor.setStyle(profile.previewStyle||{});window.comparison={svg,group,profile,actor,title};}'''
draw='''({key,frame,yaw})=>{const c=comparison,rec=INKForge.store.getMove('mai',key),clip=INKForge.store.clip(rec);let p=INK.MotionGraph.compose(rec,frame,clip.sample(frame),c.profile);if(yaw!==null){p.yaw=yaw;p.turn=0;p.headYaw=p.chestYaw=p.pelvisYaw=0;}c.group.setAttribute('transform',`translate(230 586) scale(${1.2*(p.depth||1)} 1.2) translate(${p.rootShift||0} ${p.floor||0}) rotate(${p.spin||0} 0 -180)`);c.actor.render(p,{frame,secondary:false});c.title.textContent=yaw!==null?'IDLE / TURN '+yaw.toFixed(1)+'°':key+' / '+frame.toFixed(2)+' F';return{yaw:p.yaw,frame,duration:rec.clip.duration};}'''
with tempfile.TemporaryDirectory(prefix='flow6-video-') as temp:
 d=Path(temp)
 with sync_playwright() as pw:
  b=pw.chromium.launch(executable_path=os.environ.get('INK_CHROMIUM') or shutil.which('chromium'),headless=True,args=['--no-sandbox']);pages=[]
  for data,label in [(old,'V5 / ORIGINAL SOURCE'),(new,'V6 / CONTINUOUS JOINTS')]:
   page=b.new_page(viewport={'width':460,'height':640},device_scale_factor=1);page.on('pageerror',lambda e:errors.append(str(e)));page.set_content(data.decode(),wait_until='load',timeout=60000);page.wait_for_function('window.INKEngineLab');page.evaluate(setup,label);pages.append(page)
  plans=[('idle',0,360),('sHK',None,None),('sMK',None,None),('ryuuenbu-heavy',None,None)]
  idx=0
  for part,(key,_,turn) in enumerate(plans):
   duration=pages[1].evaluate('(k)=>INKForge.store.getMove("mai",k).clip.duration',key)
   for i in range(61):
    frame=0 if turn else duration*i/60;yaw=360*i/60 if turn else None;param={'key':key,'frame':frame,'yaw':yaw};ims=[]
    for k,page in enumerate(pages):
     state=page.evaluate(draw,param);shot=d/f'part-{k}.png';page.screenshot(path=str(shot));ims.append(Image.open(shot).convert('RGB'))
    canvas=Image.new('RGB',(920,674),'#f5efe3');canvas.paste(ims[0],(0,0));canvas.paste(ims[1],(460,0));paint=ImageDraw.Draw(canvas);paint.line((460,0,460,640),fill='#acb6a2',width=1);paint.text((24,650),'Actual SVG renderers + their shipped assets / FX OFF / sampled slow motion',fill='#485b48');canvas.save(d/f'frame-{idx:04d}.png');
    if part==0 and i in [0,15,30,45] or part==1 and abs(frame-22)<=duration/120 or part==2 and abs(frame-16)<=duration/120 or part==3 and i in [24,42]:
     dest=O/f'compare-{key}-{i:02d}.png';canvas.save(dest);selected.append({'file':dest.name,**param})
    idx+=1
   print('CAPTURE',key,61,'frames',flush=True)
  b.close()
 ffmpeg=shutil.which('ffmpeg')
 if not ffmpeg:raise RuntimeError('ffmpeg is required for the comparison video')
 result=subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-y','-framerate','12','-i',str(d/'frame-%04d.png'),'-c:v','libx264','-preset','medium','-crf','19','-pix_fmt','yuv420p','-movflags','+faststart',str(O/'v5-v6-motion-comparison.mp4')],capture_output=True,text=True,check=True)
 # One 4-row frame comparison using a turn and the actual repaired moves.
 picks=[next(q for q in selected if q['key']=='idle' and q['yaw']==90),next(q for q in selected if q['key']=='sHK'),next(q for q in selected if q['key']=='sMK'),next(q for q in selected if q['key']=='ryuuenbu-heavy')]
 sheet=Image.new('RGB',(920,674*4),'#f5efe3')
 for i,q in enumerate(picks):sheet.paste(Image.open(O/q['file']), (0,674*i))
 sheet.save(O/'v5-v6-motion-comparison.png')
report={'suite':'flow6-literal-version-visual-comparison','capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'baselineSha256':hashlib.sha256(old).hexdigest(),'htmlSha256':hashlib.sha256(new).hexdigest(),'frames':idx,'presentationFPS':12,'videoSeconds':idx/12,'networkAssets':False,'browserErrors':errors,'selectedFrames':selected,'note':'Literal frozen V5 and final V6 each execute their own production renderer and shipped assets. This compares BOTH engine and asset repairs; it is not an isolated algorithm benchmark. Secondary oscillation and FX are disabled to expose joints. Camera and source animation time are identical. Video is deterministic sampled slow motion, not a hardware FPS measurement.'}
(O/'visual-comparison.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print('COMPARISON',idx,'frames',errors,flush=True)
raise SystemExit(1 if errors else 0)
