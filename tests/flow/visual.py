"""Capture actual SVG renderer outputs; no substitute paintings or concept images."""
from pathlib import Path
import os, shutil
from playwright.sync_api import sync_playwright
from PIL import Image,ImageDraw,ImageFont
import json
R=Path(__file__).resolve().parents[2];Q=R/'qa/flow';Q.mkdir(exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('INK_CHROMIUM') or shutil.which('chromium') or shutil.which('google-chrome'),headless=True,args=['--no-sandbox']);pg=b.new_page(viewport={'width':1600,'height':1320});err=[];pg.on('pageerror',lambda e:err.append(str(e)))
 pg.set_content((R/'dist/INK-Street-Fighter-6.html').read_text(),wait_until='load',timeout=60000);pg.wait_for_function('!!window.INKComboUI')
 pg.screenshot(path=str(Q/'home.png'),full_page=True)
 pg.evaluate("async()=>{await INKComboUI.show();SVG_FIGHTER.state.paused=true;for(let i=0;i<600&&INK.Combo.status==='running';i++)SVG_FIGHTER.step(1);SVG_FIGHTER.step(2);SVG_FIGHTER.render();INK.VFX.render(SVG_FIGHTER.state,1);INKComboUI.draw()}")
 print('SUCCESS',pg.evaluate('INK.Combo.summary()'));pg.screenshot(path=str(Q/'combo-success.png'),full_page=True)
 pg.evaluate("async()=>{await INKComboUI.run('demo',true);SVG_FIGHTER.step(170);SVG_FIGHTER.render();INK.VFX.render(SVG_FIGHTER.state,1);INKComboUI.draw()}");pg.screenshot(path=str(Q/'combo-live.png'),full_page=True)
 pg.evaluate("async()=>{INKComboUI.close();await INKForge.loadMove('ken','shoryu_3');await INKForge.route('studio');INKForge.atFrame(14.5);document.getElementById('f-handles').style.display='none'}")
 pg.locator('[data-inspector=fx]').click();pg.screenshot(path=str(Q/'studio-emitter.png'),full_page=True)
 # Each cell is the actual editor SVG at an authored frame, rendered in Chromium.
 cells=[];seq=[0,6,9,12.5,16,24,32,42]
 for i,f in enumerate(seq):
  pg.evaluate('(f)=>INKForge.atFrame(f)',f);fn=Q/f'turn-{i}.png';pg.locator('#f-work-svg').screenshot(path=str(fn));cells.append((Image.open(fn).convert('RGB'),f,pg.evaluate('INKForge.state.pose.yaw')))
 fontPath=os.environ.get('INK_QA_FONT','/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf');font=ImageFont.truetype(fontPath,14) if Path(fontPath).is_file() else ImageFont.load_default();big=ImageFont.truetype(fontPath,23) if Path(fontPath).is_file() else ImageFont.load_default()
 sheet=Image.new('RGB',(1480,700),'#19292c');d=ImageDraw.Draw(sheet);d.text((28,20),'INK / FLOW 04     KEN — CONTINUOUS AXIAL TURN',font=big,fill='#e8d7bb');d.text((28,53),'Actual SVG poses · bounded in-betweens · independent head and pelvis yaw',font=font,fill='#acc3b7')
 for i,(im,f,yaw) in enumerate(cells):
  im.thumbnail((354,255));x=20+i%4*366;y=86+i//4*302;sheet.paste(im,(x+(354-im.width)//2,y));d.text((x+10,y+263),f'{f:g} F     /     {yaw:.1f} deg',font=font,fill='#e9c9a3')
 sheet.save(Q/'turn-study.png')
 studies={'ryu':'hasho_3','ken':'shoryu_3','chun':'bird_2','cammy':'arrow_3','luke':'flash_3','juri':'gooh_3','mai':'shinobibachi_3','iori':'oniYaki_3'};cells=[]
 for id,move in studies.items():
  info=pg.evaluate("async({id,move})=>{const r=INKForge.store.byGame(id,move);await INKForge.loadMove(id,r.key);INKForge.atFrame(r.binding.startup+Math.min(7,r.binding.active*.7));return{frame:INKForge.state.frame,fx:r.fx.map(e=>e.type+' / '+e.socket)}}",{'id':id,'move':move});fn=Q/f'fx-{id}.png';pg.locator('#f-work-svg').screenshot(path=str(fn));cells.append((Image.open(fn).convert('RGB'),id,info))
 sheet=Image.new('RGB',(1480,725),'#19292c');d=ImageDraw.Draw(sheet);d.text((28,20),'INK / FLOW 04     MOTION-ATTACHED VFX',font=big,fill='#e8d7bb');d.text((28,53),'Eight materials · limb trajectories · seeded emitters · actual game assets',font=font,fill='#acc3b7')
 for i,(im,id,info) in enumerate(cells):
  im.thumbnail((354,255));x=20+i%4*366;y=86+i//4*314;sheet.paste(im,(x+(354-im.width)//2,y));d.text((x+10,y+261),id.upper()+'  /  '+str(round(info['frame'],1))+' F',font=font,fill='#e9c9a3');d.text((x+10,y+281),' + '.join(info['fx'])[:43],font=font,fill='#acc3b7')
 sheet.save(Q/'effects-study.png');print('ERRORS',err);b.close()
