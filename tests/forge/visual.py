"""Actual browser screenshots of the built game and the same retained SVG renderer."""
from pathlib import Path
import os,shutil
from playwright.sync_api import sync_playwright
import json
root=Path(__file__).resolve().parents[2]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('INK_CHROMIUM') or shutil.which('chromium') or shutil.which('google-chrome'),headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1480,'height':1060},device_scale_factor=1);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((root/'dist/INK-Street-Fighter-6.html').read_text(),wait_until='load',timeout=60000);page.wait_for_function('window.INKForge?.ready');page.wait_for_timeout(80)
 page.screenshot(path=str(root/'qa/forge-home-final.png'),full_page=True)
 page.evaluate("async()=>{await INKForge.route('studio');await INKForge.loadMove('mai','hishou-ryuuenjin-medium');INKForge.state.view='overlay';INKForge.state.inspector='motion';INKForge.inspector();INKForge.atFrame(7);}")
 page.screenshot(path=str(root/'qa/forge-studio-final.png'),full_page=True)
 page.evaluate("async()=>{await INKForge.route('battle');SVG_FIGHTER.start('mai','ryu','training','assist');SVG_FIGHTER.state.phase='fight';SVG_FIGHTER.state.paused=true;SVG_FIGHTER.experience.stage('forge');SVG_FIGHTER.practice('mai','hissatsu_2');SVG_FIGHTER.state.hitstop=0;SVG_FIGHTER.step(16);SVG_FIGHTER.render();}")
 page.screenshot(path=str(root/'qa/forge-battle-final.png'),full_page=True)
 # Render a contact sheet with real asset poses; no raster layers or fabricated UI.
 page.evaluate(r"""()=>{
  INKForge.route('assets');SVG_FIGHTER.state.paused=true;
  const wrap=document.createElement('div');wrap.id='qa-sheet';wrap.style.cssText='position:relative;z-index:99999;background:#e7e3d7;color:#203a34;padding:40px 38px;min-height:1060px;width:1480px;box-sizing:border-box;font-family:system-ui';
  wrap.innerHTML='<header style="display:flex;justify-content:space-between;border-bottom:1px solid #abb6a7;padding-bottom:20px"><div><small style="letter-spacing:4px">INK / FLOW 04</small><h1 style="margin:8px 0 0;font-size:34px">八位格斗家，同一个矢量运行时。</h1></div><p style="text-align:right;font:12px monospace;line-height:1.8">ACTUAL SVG RENDER<br>MODEL / RIG / MOTION</p></header><div id="qa-cards" style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding-top:22px"></div>';
  document.body.append(wrap);document.getElementById('forge-app').style.display='none';for(const el of document.body.children)if(el!==wrap)el.style.display='none';
  window.__qaRenders=[];
  for(const id of INK.Schema.CHARACTERS){const profile=INKForge.store.profile(id),cell=document.createElement('section');cell.style.cssText='background:#efebdf;border:1px solid #c3caba;border-radius:5px;padding:12px 12px 4px';cell.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:19px">'+profile.name+'</b><span style="font-size:12px">'+profile.cn+'</span></div><svg viewBox="0 0 330 420" width="100%"><defs></defs></svg><p style="font-size:10px;margin:0 0 7px;color:#718176">'+profile.description+'</p>';wrap.querySelector('#qa-cards').append(cell);const svg=cell.querySelector('svg');INK.SVG.node('path',{d:'M12 405H318',stroke:'#c2cbbb','stroke-width':1},svg);const group=INK.SVG.node('g',{transform:'translate(155 400) scale(.97)'},svg),renderer=new INK.Renderer(group,profile);renderer.setStyle(profile.previewStyle);renderer.render(INKForge.store.clip(INKForge.store.byGame(id,'@idle')).sample(0),{frame:0,secondary:false});window.__qaRenders.push(renderer);}
 }""")
 page.screenshot(path=str(root/'qa/forge-characters-final.png'),full_page=True)
 page.evaluate(r"""()=>{
  document.querySelector('#qa-sheet h1').textContent='动作，不只是换一种颜色。';const grid=document.getElementById('qa-cards');grid.innerHTML='';
  const examples=[['ryu','hadoken_2',.15],['ken','dragonlash_2',.35],['chun','bird_2',.4],['cammy','arrow_2',.42],['luke','rising_2',.32],['juri','tensen_2',.32],['mai','ryuenbu_2',.32],['iori','oniYaki_2',.3]];
  for(const [id,gameId,ratio]of examples){const profile=INKForge.store.profile(id),record=INKForge.store.byGame(id,gameId)||INKForge.store.list(id).find(x=>x.category==='special'),t=record.binding.startup+record.binding.active*ratio,pose=INKForge.store.clip(record).sample(t),cell=document.createElement('section');cell.style.cssText='background:#efebdf;border:1px solid #c3caba;border-radius:5px;padding:12px 12px 4px';cell.innerHTML='<div style="display:flex;justify-content:space-between"><b>'+profile.name+'</b><span style="font-size:12px">'+record.name+'</span></div><svg viewBox="0 0 370 420" width="100%"><defs></defs></svg><p style="font:10px monospace;color:#718176;margin:0 0 6px">'+record.command+' / '+t.toFixed(1)+' F / '+record.key+'</p>';grid.append(cell);const svg=cell.querySelector('svg');const camera=INK.SVG.node('g',{},svg),group=INK.SVG.node('g',{transform:'scale('+(pose.depth||1)+' 1) rotate('+(pose.spin||0)+' 0 -180)'},camera),renderer=new INK.Renderer(group,profile),fx=new INK.Effects(group);renderer.setStyle(profile.previewStyle);renderer.render(pose,{frame:t,expression:'power',secondary:false});fx.render(record,t,pose,renderer.lastRig);const bounds=camera.getBBox(),fit=Math.min(320/Math.max(1,bounds.width),335/Math.max(1,bounds.height));camera.setAttribute('transform','translate('+(185-(bounds.x+bounds.width/2)*fit)+' '+(209-(bounds.y+bounds.height/2)*fit)+') scale('+fit+')');window.__qaRenders.push(renderer);}
 }""")
 page.screenshot(path=str(root/'qa/forge-motions-final.png'),full_page=True)
 (root/'qa/forge-visual-errors.json').write_text(json.dumps(errors,ensure_ascii=False,indent=2));b.close();print('screenshots saved; errors:',errors)

if errors:raise SystemExit(1)
