from pathlib import Path
import os, shutil
from html.parser import HTMLParser
from playwright.sync_api import sync_playwright
import json,hashlib
R=Path(__file__).resolve().parents[2];results=[]
class Links(HTMLParser):
 def __init__(self):super().__init__();self.links=[]
 def handle_starttag(self,tag,attrs):
  if tag=='a':self.links += [v for k,v in attrs if k=='href']
for path in ['index.html','OPEN-ME.html']:
 obj=Links();obj.feed((R/path).read_text());bad=[link for link in obj.links if not link.startswith(('http:','https:','#','data:'))and not(R/link).is_file()];assert not bad,(path,bad);results.append({'name':path+' local entry links exist','pass':True,'links':obj.links})
with sync_playwright()as p:
 b=p.chromium.launch(executable_path=os.environ.get('INK_CHROMIUM') or shutil.which('chromium') or shutil.which('google-chrome'),headless=True,args=['--no-sandbox']);page=b.new_page();errs=[];page.on('pageerror',lambda e:errs.append(str(e)))
 for path in ['index.html','docs/FLOW-GUIDE.html']:
  for w,h in [(1440,1000),(390,844)]:
   page.set_viewport_size({'width':w,'height':h});page.set_content((R/path).read_text(),wait_until='load');q=page.evaluate('({overflow:document.documentElement.scrollWidth>innerWidth+1,images:[...document.images].every(i=>i.complete&&i.naturalWidth>0)})');assert not q['overflow'] and q['images'],q;results.append({'name':f'{path} at {w}x{h}', 'pass':True,'detail':q})
 page.set_viewport_size({'width':1440,'height':1000});page.set_content((R/'dist/INK-Street-Fighter-6.html').read_text(),wait_until='load');page.wait_for_function('!!window.INKComboUI')
 q=page.evaluate("({version:INK.VERSION,project:INKForge.store.id,game:SVG_FIGHTER.version,manifest:INKForge.store.manifest.build,comboRoutes:INK.Combo.routes.routes.length})");assert q['project']=='ink-flow-sf6-v4'and q['manifest']=='4.0.0' and q['comboRoutes']==16;q['pass']=True;q['name']='Standalone version and new storage namespace';results.append(q)
 text=page.evaluate('INK.Portable.html(INKForge.store)');page.set_content(text,wait_until='load');page.wait_for_function('!!window.INKComboUI');second=page.evaluate('INK.Portable.html(INKForge.store)');assert abs(len(text)-len(second))<1024;results.append({'name':'Repeated HTML export does not recursively grow template','pass':True,'firstBytes':len(text.encode()),'secondBytes':len(second.encode())})
 assert not errs;results.append({'name':'No browser script errors','pass':True});b.close()
report={'total':len(results),'passed':len(results),'tests':results,'errors':errs};(R/'qa/flow/delivery-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False,indent=2))
