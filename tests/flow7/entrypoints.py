"""Launch-page links/layout, observed locally without pretending file permission succeeded."""
from pathlib import Path
import datetime,hashlib,json,os,shutil
from html.parser import HTMLParser
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];O=R/'qa/flow7';rows=[];errors=[]
class Links(HTMLParser):
 def __init__(self):super().__init__();self.links=[]
 def handle_starttag(self,tag,attrs):
  d=dict(attrs)
  if tag=='a' and d.get('href'):self.links.append(d['href'])
for name in ['OPEN-ME.html','index.html']:
 p=R/name;parser=Links();parser.feed(p.read_text(encoding='utf-8'))
 missing=[x for x in parser.links if not (R/x).is_file()];rows.append({'name':name+' local targets exist','pass':not missing,'links':parser.links,'missing':missing})
rows.append({'name':'Root launch pages match','pass':(R/'OPEN-ME.html').read_bytes()==(R/'index.html').read_bytes()})
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ.get('INK_CHROMIUM') or shutil.which('chromium'),headless=True,args=['--no-sandbox'])
 for width,height in [(1440,1000),(390,844)]:
  p=b.new_page(viewport={'width':width,'height':height});p.on('pageerror',lambda e:errors.append(str(e)));p.set_content((R/'OPEN-ME.html').read_text(encoding='utf-8'),wait_until='load');d=p.evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth,title:document.title,links:[...document.querySelectorAll(".btn")].map(n=>({text:n.textContent,width:n.getBoundingClientRect().width}))})');rows.append({'name':str(width)+'px root launcher layout','pass':d['scroll']==width and '07' in d['title'],'detail':d});p.screenshot(path=str(O/('launcher-'+str(width)+'.png')),full_page=True);p.close()
 b.close()
report={'suite':'flow7-root-entrypoints','capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceSha256':{n:hashlib.sha256((R/n).read_bytes()).hexdigest() for n in ['OPEN-ME.html','index.html']},'total':len(rows),'passed':sum(r['pass'] for r in rows),'tests':rows,'browserErrors':errors,'scope':'Local file existence plus embedded document layout. Not a file:// authorization test.'};(O/'entrypoints.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print('ENTRYPOINTS',report['passed'],'/',report['total']);raise SystemExit(0 if not errors and report['passed']==report['total'] else 1)
