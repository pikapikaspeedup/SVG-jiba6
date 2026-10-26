"""Capture a contact sheet from the actual shipped Mai SVG, not drawn mockups.
Requires Playwright, Chromium and Pillow. Does not modify assets or production code.
"""
from pathlib import Path
from io import BytesIO
import datetime, hashlib, json, os, shutil
from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'qa/flow4';OUT.mkdir(parents=True,exist_ok=True)
MOVES=[('ryuuenbu-heavy','RYUUENBU / FAN FLAME',[9.5,18.5,27.25,45.5]),
       ('hishou-ryuuenjin-heavy','HISHOU RYUUENJIN / RISING KICK',[7.5,14.5,26.25,46]),
       ('hissatsu-shinobi-bachi-heavy','SHINOBI BACHI / ELBOW DASH',[12,23.5,31.5,49]),
       ('kagerou-no-mai','KAGEROU NO MAI / SA1',[5.5,14.5,32.5,59]),
       ('enbu-ada-zakura','ENBU ADA ZAKURA / SA3',[8.5,30.5,68.5,98.25])]
def font(size):
    # Use an installed font only for the PNG; never distribute its font file.
    for name in ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf','C:/Windows/Fonts/arial.ttf']:
        if Path(name).is_file():return ImageFont.truetype(name,size)
    return ImageFont.load_default()
width=1600;cell_w=384;cell_h=299;left=20;gap=8;header=104;row_h=364
sheet=Image.new('RGB',(width,header+len(MOVES)*row_h+40),'#101d20');draw=ImageDraw.Draw(sheet)
draw.text((24,20),'INK FLOW 04  /  MAI MOTION CONTACT SHEET',font=font(27),fill='#f1e6d5')
draw.text((24,60),'Real SVG captures  |  Fractional asset frames  |  No generated or substituted animation',font=font(17),fill='#b5bcb4')
rows=[];errors=[];html=(ROOT/'dist/INK-Street-Fighter-6.html').read_bytes()
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=os.environ.get('INK_CHROMIUM') or shutil.which('chromium'),headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1080});page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(html.decode('utf-8'),wait_until='load',timeout=60000);page.wait_for_function('window.INKMaiShowcase')
    page.evaluate('INK.VFX.quality(1);INK.VFX.settings.reducedMotion=false;INKMaiShowcase.open()')
    for ri,(key,label,frames) in enumerate(MOVES):
        y=header+ri*row_h;draw.text((left,y),label,font=font(17),fill='#f4bc82')
        page.evaluate('(key)=>INKMaiShowcase.select(key)',key)
        for ci,frame in enumerate(frames):
            page.evaluate('(t)=>INKMaiShowcase.seek(t)',frame)
            png=page.locator('#mai-preview-svg').screenshot(type='png',animations='disabled')
            img=Image.open(BytesIO(png)).convert('RGB').resize((cell_w,cell_h),Image.Resampling.LANCZOS)
            x=left+ci*(cell_w+gap);sheet.paste(img,(x,y+29));draw.text((x+8,y+334),f'FRAME {frame:5.2f}',font=font(14),fill='#cbd1c6')
            state=page.evaluate('({frame:INKMaiShowcase.frame,key:INKMaiShowcase.record.key,events:INKMaiShowcase.record.fx.length,finite:!(/NaN|Infinity/.test(document.querySelector("#mai-preview-svg").outerHTML))})')
            assert state['key']==key and abs(state['frame']-frame)<1e-8 and state['finite'],state
            rows.append({**state,'captureSha256':hashlib.sha256(png).hexdigest()})
    browser.close()
assert not errors,errors
sheet.save(OUT/'mai-contact-sheet.png',optimize=True)
report={'kind':'actual-browser-visual-contact-sheet','capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'htmlSha256':hashlib.sha256(html).hexdigest(),'total':len(rows),'passed':len(rows),'captures':rows,'browserErrors':errors,'note':'Finite/identity checks are automatic; visual quality is manually inspected. This is not an extra set of combat simulations.'}
(OUT/'visual-sheet.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='captures'},ensure_ascii=False,indent=2))
