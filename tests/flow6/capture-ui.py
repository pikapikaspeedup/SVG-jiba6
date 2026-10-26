from pathlib import Path
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);p=b.new_page(viewport={'width':1440,'height':1000});p.on('pageerror',lambda e:print('ERROR',e.stack));p.set_content((R/'dist/INK-Street-Fighter-6.html').read_text(),wait_until='load',timeout=60000);p.wait_for_function('window.INKContinuityLab');p.screenshot(path=str(R/'qa/flow6/home.png'),full_page=True)
 p.evaluate('INKContinuityLab.open(); INKContinuityLab.seek(37.5)');p.screenshot(path=str(R/'qa/flow6/anatomy-desktop.png'));print(p.evaluate('({boneError:INKContinuityLab.state.boneError,wristError:INKContinuityLab.state.wristError})'))
 p.set_viewport_size({'width':390,'height':844});p.screenshot(path=str(R/'qa/flow6/anatomy-mobile.png'));print(p.evaluate('({w:innerWidth,doc:document.documentElement.scrollWidth,dialog:document.querySelector("#continuity6-dialog").clientWidth,content:document.querySelector("#continuity6-dialog").scrollWidth})'))
 b.close()
