"""Real production HTML checks; INK_CHROMIUM may select an installed browser.
Runs the actual simulation, UI, exports and legacy mechanics. No external server.
"""
from pathlib import Path
import datetime, hashlib, json, os, shutil
from playwright.sync_api import sync_playwright

R = Path(__file__).resolve().parents[2]
O = Path(os.environ.get('INK_QA_DIR', R / 'qa/flow10'))
O.mkdir(parents=True, exist_ok=True)
html = (R / 'dist/INK-Street-Fighter-6.html').read_bytes()
rows, errors = [], []

def check(name, passed, detail=None):
    rows.append(dict(name=name, passed=bool(passed), detail=detail))
    print('PASS' if passed else 'FAIL', name, '' if passed else detail, flush=True)

with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=os.environ.get('INK_CHROMIUM') or shutil.which('chromium'), headless=True)
    page = browser.new_page(viewport={'width': 1440, 'height': 1150})
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.set_content(html.decode(), timeout=60000)
    page.wait_for_function('window.INKSpacingLab?.ready')
    check('Classic rules remain the fresh-page default', page.evaluate('!INK.Spacing.settings.enabled'))
    page.locator('#s10-open').click()
    check('Home opens a playable lesson through a real click', page.locator('#s10-panel').is_visible())
    page.keyboard.press('x')
    check('Keyboard X starts a real committed retreat',page.evaluate("INK.Spacing.events.some(e=>e.type==='retreat'&&e.player===0)"))
    page.evaluate('SVG_FIGHTER.state.paused=true')
    result = page.evaluate('''async()=>{
      const A=SVG_FIGHTER,G=A.state,out=[];
      for(const reward of [true,false]){
        INK.Spacing.setReward(reward);await INKSpacingLab.start(true);
        A.step(125);G.paused=true;INKSpacingLab.paint();
        out.push({reward,lesson:INKSpacingLab.lesson,hp:A.fighters.map(f=>f.hp),events:INK.Spacing.inspect().events});
      } return out;
    }''')
    (O / 'reward-ab.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
    on, off = result
    check('Demonstration earns a genuine recovery punish', on['lesson']['success'], on)
    check('Reward off keeps near-miss evidence but removes early cancel', any(e['type']=='near-miss' for e in off['events']) and not any(e['type']=='reentry' for e in off['events']), off)
    check('Same inputs lose the punish window with reward disabled', not any(e['type']=='contact' and e.get('attacker')==0 and e.get('punish') for e in off['events']), off)

    matrix = page.evaluate('''async()=>{
      const A=SVG_FIGHTER,G=A.state,out=[];INK.Spacing.setReward(true);
      for(const distance of [250,270,310])for(const move of ['sHK','sHP'])for(const delay of [60,78]){
        await INKSpacingLab.start(true,{distance,move,delay});A.step(145);G.paused=true;
        out.push({distance,move,delay,lesson:INKSpacingLab.lesson,hp:A.fighters.map(f=>f.hp),events:INK.Spacing.inspect().events});
      }return out;
    }''')
    (O / 'spacing-matrix.json').write_text(json.dumps(matrix, ensure_ascii=False, indent=2))
    check('A fixed retreat/punch recipe does not win all spacing scenarios', any(r['lesson']['success'] for r in matrix) and any(not r['lesson']['success'] for r in matrix), matrix)

    # The following fixtures replace only the geometry provider, then exercise
    # production pendingMelee / classify / commit / hitsDone through real steps.
    physics = page.evaluate('''()=>{
      const A=SVG_FIGHTER,G=A.state,S=INK.Spacing,original=INK.Runtime.geometry,out=[];
      const rect=(x,part='body')=>({x,y:400,w:10,h:10,part});
      function setup(){INKSpacingLab.stop();A.start('ryu','ryu','training','classic');G.paused=false;
        document.getElementById('dummy').value='idle';document.getElementById('autohp').checked=false;
        S.set(true);S.reset();A.fighters[0].x=500;A.fighters[1].x=800;}
      try {
        for(const terminal of [false,true]){
          setup();INK.Runtime.geometry=(f,original,p,rig,world,closing)=>{
            const t=f.attack?.t||0,start=f.attack?.m.startup||0,end=start+(f.attack?.m.active||0);
            const x=terminal?500+200*Math.max(0,t-(end-1)):500+200*Math.max(0,t-start);
            return{...original,hurt:[rect(f.index?600:100)],hit:f.index===0&&f.attack&&t>=start&&(t<end||closing&&t===end)?[rect(x,'fist'),rect(x,'forearm')]:[]};
          };
          A.tryMove(0,'sMP');A.step(20);
          out.push({kind:terminal?'last-active-interval':'tunnel',hp:A.fighters[1].hp,events:S.inspect().events});
        }
        setup();INK.Runtime.geometry=(f,o)=>({...o,hurt:[rect(600)],hit:f.attack?[rect(600,'fist'),rect(600,'forearm')]:[]});
        G.mode='versus';G.clock=6000;A.fighters.forEach(f=>f.hp=1);A.tryMove(0,'sMP');A.tryMove(1,'sMP');
        const attacks=A.fighters.map(f=>f.attack);A.step(6);
        out.push({kind:'lethal-trade',hp:A.fighters.map(f=>f.hp),confirmed:attacks.map(a=>a.hitConfirmed),events:S.inspect().events});
      }finally{INK.Runtime.geometry=original;S.set(false);A.start('ryu','ryu','training','classic');G.paused=true;}
      return out;
    }''')
    for row in physics[:2]:
        contacts=[e for e in row['events'] if e['type']=='contact' and e.get('result')=='hit']
        check(row['kind']+' hits exactly once at an interior TOI', len(contacts)==1 and contacts[0]['swept'] and 0<contacts[0]['time']<1 and row['hp']<10000, row)
    trade=physics[2]
    check('Lethal simultaneous normals trade and retain both confirmations', trade['hp']==[0,0] and trade['confirmed']==[True,True], trade)

    contracts = page.evaluate('''async()=>{
      const A=SVG_FIGHTER,G=A.state,S=INK.Spacing,out=[];
      async function scenario(draws=0,freeze=false){
        S.setReward(true);await INKSpacingLab.start(true);G.paused=false;
        for(let n=0;n<125;n++){A.step();if(freeze&&n===78){const before=JSON.stringify(A.fighters.map(f=>[f.stateT,f.x,f._inkRetreat]));G.hitstop=6;A.step(6);out.push({name:'Freeze preserves retreat clock and grant',ok:before===JSON.stringify(A.fighters.map(f=>[f.stateT,f.x,f._inkRetreat]))});}
          for(let k=0;k<draws;k++)A.renderFraction(k/(draws||1));}
        G.paused=true;return{hp:A.fighters.map(f=>f.hp),events:S.inspect().events.map(e=>({...e,frame:e.frame-INKSpacingLab.lesson.start}))};
      }
      const a=await scenario(),b=await scenario(3),c=await scenario(0,true);
      out.push({name:'Repeated subframe renders cannot change combat',ok:JSON.stringify(a)===JSON.stringify(b),a,b});
      out.push({name:'Freeze does not create a delayed phantom sweep',ok:JSON.stringify(a)===JSON.stringify(c),a,c});
      await INKSpacingLab.start(false);G.paused=false;A.step(65);A.retreat(0);A.step(12);
      const f=A.fighters[0];out.push({name:'Certification cannot immediately cancel early recovery',ok:!!f._inkRetreat?.ready&&!S.canCancel(f,A.getMove(f,'sMP'))});
      A.step(8);G.hitstop=5;out.push({name:'A valid grant cannot start a move during hitstop',ok:!A.tryMove(0,'sMP')});G.hitstop=0;out.push({name:'Only chosen grounded normals consume retreat permission',ok:!S.canCancel(f,A.getMove(f,'SA1'))&&!S.canCancel(f,A.getMove(f,'cMK'))});
      A.setState(f,'hit',12);out.push({name:'Hit removes the grant; no hitstun cancel',ok:!f._inkRetreat&&!A.tryMove(0,'sMP')});
      S.reset();out.push({name:'Reset clears bounded contact state',ok:S.events.length===0});G.paused=true;
      return out;
    }''')
    for row in contracts:
        check(row['name'], row['ok'], row)

    page.evaluate('INK.Spacing.set(false);INK.CombatFlow.set({rhythm:"legacy",rules:"legacy"})')
    mechanics_script=(R/'tests/mechanics.js').read_text().replace('f.maiFollowUntil>G.tick','f.maiFollowUntil>G.actionTick').replace('f.maiAirFollow>G.tick','f.maiAirFollow>G.actionTick')
    mechanics=page.evaluate(mechanics_script)
    check('All 39 inherited mechanics pass in classic mode', len(mechanics)==39 and all(r['pass'] for r in mechanics), [r for r in mechanics if not r['pass']])

    for width,height,touch in [(1440,1150,False),(390,844,True)]:
        p=browser.new_page(viewport={'width':width,'height':height},is_mobile=touch,has_touch=touch)
        p.on('pageerror',lambda e:errors.append(str(e)))
        p.set_content(html.decode(),timeout=60000);p.wait_for_function('window.INKSpacingLab?.ready')
        p.locator('#s10-open').click();p.evaluate('SVG_FIGHTER.state.paused=true')
        p.locator('#s10-distance').select_option('310');p.locator('#s10-delay').select_option('78');p.locator('#s10-retry').click();p.evaluate('SVG_FIGHTER.state.paused=true')
        check(f'{width}: scenario controls apply through UI',p.evaluate('INKSpacingLab.lesson.distance===310&&INKSpacingLab.lesson.delay===78'))
        p.locator('#s10-reward').uncheck()
        check(f'{width}: A/B switch retains geometry rules',p.evaluate('INK.Spacing.settings.enabled&&!INK.Spacing.settings.reentry'))
        p.locator('#s10-reward').check();p.locator('#s10-distance').select_option('270');p.locator('#s10-delay').select_option('60');p.locator('#s10-demo').click()
        p.evaluate('SVG_FIGHTER.step(125);SVG_FIGHTER.state.paused=true;INKSpacingLab.paint()')
        check(f'{width}: demonstration is labelled and completes',p.evaluate('INKSpacingLab.lesson.demo&&INKSpacingLab.lesson.success'))
        dims=p.evaluate('()=>{const e=document.getElementById("s10-panel"),r=e.getBoundingClientRect();return{left:r.left,right:r.right,width:innerWidth,scroll:e.scrollWidth,client:e.clientWidth};}')
        check(f'{width}: spacing panel fits viewport',dims['left']>=0 and dims['right']<=dims['width']+1 and dims['scroll']<=dims['client']+1,dims)
        p.screenshot(path=str(O/f'spacing-{width}.png'),full_page=True)
        with p.expect_download() as event:p.locator('#s10-export').click()
        download=O/f'contacts-{width}.json';event.value.save_as(download);payload=json.loads(download.read_text())
        check(f'{width}: downloaded record contains real contact events',payload['kind']=='ink-spacing-contacts' and any(e['type']=='contact' for e in payload['events']))
        if not touch:
            exported=p.evaluate('INK.Portable.html(INKForge.store)')
            q=browser.new_page();q.on('pageerror',lambda e:errors.append(str(e)));q.set_content(exported,timeout=60000);q.wait_for_function('window.INKSpacingLab?.ready')
            check('Portable HTML retains enabled rules and playable lesson',q.evaluate('INK.Spacing.settings.enabled&&INKSpacingLab.ready'));q.close()
        p.close()
    browser.close()

report=dict(suite='spacing-production-contracts',utc=datetime.datetime.now(datetime.timezone.utc).isoformat(),htmlSha256=hashlib.sha256(html).hexdigest(),total=len(rows),passed=sum(r['passed'] for r in rows),tests=rows,browserErrors=errors,scope='Headless Chromium; mobile viewport is emulated. No real-device or balance certification.')
(O/'browser.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
raise SystemExit(0 if report['passed']==report['total'] and not errors else 1)
