"""Real simultaneous accepted strikes exercise audio identity during one callback."""
from pathlib import Path
import os,json,hashlib
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];raw=(R/'dist/INK-Street-Fighter-6.html').read_bytes();errors=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ['INK_CHROMIUM'],headless=True);p=b.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.set_content(raw.decode());p.wait_for_function('window.INKDuel?.ready');p.locator('.kinetic-launch button').click();p.evaluate("document.getElementById('sound-btn').click()");p.wait_for_function('SVG_FIGHTER.soundStatus().enabled')
 result=p.evaluate('''()=>{const A=SVG_FIGHTER,G=A.state;A.start('ryu','ryu','training','classic',42);G.paused=true;document.getElementById('dummy').value='idle';A.teleport(0,500);A.teleport(1,635);A.tryMove(0,'sMP');A.tryMove(1,'sMP');for(let i=0;i<20&&INK.StrikeFeel.inspect().length<2;i++)A.step();const voices=A.soundStatus(),contacts=INK.StrikeFeel.inspect(),held=voices.voices.length;for(let i=0;i<10;i++)A.renderFraction(i%3/2);const after=A.soundStatus();A.reset();return {voices,contactIDs:contacts.map(e=>e.contactID),held:held===after.voices.length,resetVoices:A.soundStatus().voices.length};}''');b.close()
result.update(sha256=hashlib.sha256(raw).hexdigest(),errors=errors);(R/'qa/impact-score/audio.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result));assert not errors and len(set(result['contactIDs']))==2 and sum(v['type']=='hit' for v in result['voices']['voices'])==2 and result['held'] and result['resetVoices']==0 and len(result['voices']['voices'])<=result['voices']['capacity']
