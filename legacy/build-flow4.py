#!/usr/bin/env python3
"""Build INK FORGE from per-character JSON assets and an immutable game baseline.
Python 3.10+, standard library only. No dependencies, servers or runtime fetches.
"""
from pathlib import Path
import re,json,base64,hashlib
ROOT=Path(__file__).resolve().parents[1]
read=lambda p:(ROOT/p).read_text(encoding='utf-8')
def jsdata(x):
    return json.dumps(x,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c').replace('\u2028','\\u2028').replace('\u2029','\\u2029')
def patch(source,old,new):
    if source.count(old)!=1:raise ValueError(f'Baseline anchor expected once, found {source.count(old)}: {old[:110]}')
    return source.replace(old,new,1)
def game():
    s=read('game.js')
    s=patch(s,"function initFighter(f,index){Object.assign(f,{index,","function initFighter(f,index){Object.assign(f,{_inkState:null,_inkFXEvents:[],_inkTransition:null,_inkTrail:null,_inkInput:null,index,")
    s=patch(s,"function neutralPose(f){return SF6Motion.neutral(f,gameTime,BASE);","function neutralPose(f){return INK.Runtime.neutral(f,gameTime,BASE)||SF6Motion.neutral(f,gameTime,BASE);")
    s=patch(s,"function movePose(f,m,t){return SF6Motion.sample(f,m,t,neutralPose(f),POSES);","function movePose(f,m,t){return INK.Runtime.sample(f,m,t,neutralPose(f))||SF6Motion.sample(f,m,t,neutralPose(f),POSES);")
    s=patch(s,"function desiredPose(f){const p=authoredPose(f);","function desiredPose(f){const legacy=authoredPose(f),p=INK.State.sample(f,legacy)||legacy;")
    s=patch(s,"result.fan=style==='fan-vault'&&t>release?1:result.fan;return result;","result.fan=style==='fan-vault'&&t>release?1:result.fan;return INK.State.throwPose(f,result)||result;")
    s=patch(s,"updateFighter(f)}\nresolveMelee();","updateFighter(f);INK.State.tick(f,G.tick)}\nresolveMelee();")
    s=patch(s,"function poseRig(f,p=desiredPose(f)){const", "function poseRig(f,p=desiredPose(f)){const inkRig=INK.Runtime.rig(f,p);if(inkRig)return inkRig;const")
    s=patch(s,"m=SF6Mai.start(f,m);setState(f,'attack');", "m=INK.Runtime.prepare(f,m);INK.Runtime.capture(f,m);m=SF6Mai.start(f,m);setState(f,'attack');")
    s=patch(s,"}}else a.t++;\nif(m.kind==='denjin'", "}}else a.t++;INK.Runtime.tick(f,G.tick);\nif(m.kind==='denjin'")
    s=patch(s,"return{hurt,hit,throw:throws,push:{x:f.x-53*s,y:FLOOR+f.y-260*s,w:106*s,h:250*s}}}","return INK.Runtime.geometry(f,{hurt,hit,throw:throws,push:{x:f.x-53*s,y:FLOOR+f.y-260*s,w:106*s,h:250*s}},p,rig,world)}")
    start=s.index('function renderFighter(f,dt=1/60,alpha=1){');end=s.index('\nfunction bodyPoint(f,p)',start);legacy=s[start:end]
    prefix=legacy[:legacy.index(" sa(f.core,'transform'")]
    prefix=prefix.replace("function renderFighter(f,dt=1/60,alpha=1){", "function renderFighter(f,dt=1/60,alpha=1){\n if(!INK.Game.enabled){INK.Game.show(f,false);return renderFighterLegacy(f,dt,alpha);}")
    prefix=prefix.replace("const signature=f.state+", "const signature=INK.Runtime.revision+'|'+f.state+")
    prefix=prefix.replace("const reusePose=(G.hitstop>0||G.paused)", "const reusePose=!f._inkFractionalView&&(G.hitstop>0||G.paused)")
    prefix=prefix.replace("f.pose=d;f._renderSignature", "f._inkFractionalView=view!==f;f.pose=d;f._renderSignature")
    suffix=legacy[legacy.index(' if(f.shadow)'):].replace("sa(f.aura,'opacity',aura?.33+Math.sin(gameTime*19)*.07:0);","sa(f.aura,'opacity',0);")
    insert="""
 const limbs=poseRig(f,p),ar=limbs.rearArm,af=limbs.frontArm;
 for(const name of ['rearArm','frontArm','rearLeg','frontLeg'])f[name].points=limbs[name];
 const inkHurt=['hit','stun','tumble','captured','down','ko'].includes(f.state);
 const inkPower=!inkHurt&&(f.portraitPower||f.attack&&f.attack.t>=f.attack.m.startup&&f.attack.t<f.attack.m.startup+f.attack.m.active);
 INK.Game.update(f,p,limbs,f.attack?view.attack.t:gameTime*60,inkHurt?'hurt':inkPower?'power':'rest',frozen,{x:rx,y:ry,scale:s,dir:f.dir});
"""
    s=s[:start]+legacy.replace('function renderFighter(', 'function renderFighterLegacy(',1)+'\n'+prefix+insert+suffix+s[end:]
    s=patch(s,"const list=MOVES[id].filter(m=>(cat==='all'||m.category===cat)","const list=MOVES[id].map(m=>INK.Runtime.prepare({ch:{id}},m)).filter(m=>(cat==='all'||m.category===cat)")
    s=patch(s,'geometry:getCombatGeometry,','geometry:getCombatGeometry,rig:poseRig,')
    s=patch(s,"const names={neon:'雨夜街角 / NEON DISTRICT'", "const names={forge:'FORGE / 日落训练场',neon:'雨夜街角 / NEON DISTRICT'")
    stages={n:'data:image/svg+xml;base64,'+base64.b64encode((ROOT/f'assets/stages/{n}.svg').read_bytes()).decode() for n in ['rooftop','courtyard','forge']}
    s=patch(s,"'assets/stages/'+value+'.svg'",'('+jsdata(stages)+')[value]')
    s=patch(s,"function burst(x,y,col,count=16,kind='hit',context=null){", "function burst(x,y,col,count=16,kind='hit',context=null){if(INK.Game.enabled&&INK.VFX.burst(x,y,col,count,kind,context,G))return;")
    s=patch(s,"function renderMoveFX(f){return SF6FX.render", "function renderMoveFX(f){if(INK.Game.enabled){for(const n of [f.fxArc,f.fxCore,f.fxFill,f.fxExtra])if(n)sa(n,'opacity',0);return;}return SF6FX.render")
    s=patch(s,"G.tick++;for(const f of fighters)","G.tick++;INK.Input.begin(G);INK.VFX.step(G,fighters);for(const f of fighters)")
    s=patch(s,"SF6Studio.update();requestAnimationFrame(frame)","INK.VFX.render(G,G.paused?1:clamp(accumulator/STEP,0,1));SF6Studio.update();requestAnimationFrame(frame)")
    s=patch(s,"function clearBattleFX(){", "function clearBattleFX(){INK.VFX.clear();")
    s=patch(s,"tickThrowActions();G.pendingMelee=[];","INK.Combo.beforeStep(G,fighters);tickThrowActions();G.pendingMelee=[];")
    s=patch(s,"if(G.combatEvents.length>24)G.combatEvents.shift()}","if(G.combatEvents.length>24)G.combatEvents.shift();INK.Combo.onCombat(G.lastCombatEvent,a,d,m)}")
    s=patch(s,"f.input.queue=[];f.crouch=m.normalState==='c';", "INK.Combo.onMove(f,m,G);f.input.queue=[];f.crouch=m.normalState==='c';")
    s=patch(s,"f.rushBuff=80;notify(f,cancel?", "f.rushBuff=80;INK.Combo.onMove(f,{id:'RUSH',name:'斗气取消迸发'},G);notify(f,cancel?")
    s=patch(s,"||G.tick-d.lastHitTick<10)",")")
    s=patch(s,"geometry:getCombatGeometry,rig:poseRig,", "geometry:getCombatGeometry,rig:poseRig,canRush:canRushCancel,canCancel:canCancel,canRekka:canRekkaContinue,tryMove:(i,id)=>requestMove(fighters[i],getMove(fighters[i],id),false),")
    s=patch(s,"updateShots();if(G.mode", "updateShots();INK.VFX.captureRoots(fighters);INK.Combo.afterStep(G,fighters);if(G.mode")
    s=patch(s,"const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,shake=reduced?0:G.shake;","const reduced=INK.VFX.settings.reducedMotion||matchMedia('(prefers-reduced-motion: reduce)').matches,shake=reduced?0:G.shake;")
    s=patch(s,"const cx=camZoom<=1?720:clamp((a.x+b.x)/2,720/camZoom,1440-720/camZoom);", "const tracking=INK.Cinema.enabled&&INK.Combo.status!=='idle';INK.Cinema.sync(tracking);const cx=tracking?(a.x+b.x)/2:camZoom<=1?720:clamp((a.x+b.x)/2,720/camZoom,1440-720/camZoom);")
    s=patch(s,"SF6Studio.install(SVG_FIGHTER);", "SVG_FIGHTER.focusCamera=()=>{camX=(fighters[0].x+fighters[1].x)/2;const bs=fighters.map(actorYBounds);camY=(Math.min(...bs.map(b=>b[0]))+Math.max(...bs.map(b=>b[1])))/2;camZoom=1.065;camStamp=0;};SF6Studio.install(SVG_FIGHTER);")
    s=patch(s,"SF6Studio.install(SVG_FIGHTER);", "SVG_FIGHTER.renderFraction=alpha=>{if(!Number.isFinite(alpha))throw TypeError('Finite interpolation fraction required');for(const f of fighters)renderFighter(f,0,clamp(alpha,0,1));INK.VFX.render(G,clamp(alpha,0,1));};SF6Studio.install(SVG_FIGHTER);")
    s=patch(s,"function dust(x){", "function dust(x){if(INK.Game.enabled&&INK.VFX.dust(x,G))return;")
    s=patch(s,"if(m.id==='PAR')return startParry(f);", "if(buffer&&G.hitstop>0)return INK.Input.enqueue(f,m,G,'hitstop');if(m.id==='PAR')return startParry(f);")
    s=patch(s,"if(buffer){f.input.queue=[{m,t:G.tick}]}", "if(buffer){INK.Input.enqueue(f,m,G)}")
    s=patch(s,"function tryQueue(f){if(f.input.queue.length){let q=f.input.queue[0];if(G.tick-q.t>9)f.input.queue.shift();else requestMove(f,q.m,false)}}", "function tryQueue(f){INK.Input.consume(f,G,requestMove)}")
    s=patch(s,"tryMove:(i,id)=>requestMove(fighters[i],getMove(fighters[i],id),false),", "tryMove:(i,id)=>requestMove(fighters[i],getMove(fighters[i],id),false),inputMove:(i,id)=>requestMove(fighters[i],getMove(fighters[i],id),true),")
    # Reduced motion suppresses fullscreen hit flashes without altering combat.
    s=patch(s,"sa($('hit-flash'),'opacity',G.flash);","sa($('hit-flash'),'opacity',(!INK.VFX.settings.enabled||INK.VFX.settings.reducedMotion||matchMedia('(prefers-reduced-motion: reduce)').matches)?0:G.flash*INK.VFX.settings.intensity);")
    s=s.replace("version:'5.0.0-atelier'","version:'4.0.0-ink-flow'")
    return s

def assets():
    root=ROOT/'assets/ink';manifest=json.loads((root/'project.json').read_text(encoding='utf-8'));chars={}
    for id in ['ryu','ken','chun','cammy','luke','juri','mai','iori']:
        d=root/'characters'/id
        model=json.loads((d/'model.json').read_text(encoding='utf-8'));rig=json.loads((d/'rig.json').read_text(encoding='utf-8'));moves={}
        for path in sorted((d/'moves').glob('*.json')):
            m=json.loads(path.read_text(encoding='utf-8'))
            if m['key']!=path.stem or m['character']!=id:raise ValueError('Bad asset identity: '+str(path))
            if m['key'] in moves:raise ValueError('Duplicate asset: '+str(path))
            moves[m['key']]=m
        chars[id]={'model':model,'rig':rig,'moves':moves}
    return {'manifest':manifest,'characters':chars}

def script(text):return '<script>\n'+text.replace('</script','<\\/script')+'\n</script>'
def build():
    (ROOT/'dist').mkdir(exist_ok=True)
    base_hash=hashlib.sha256((ROOT/'game.js').read_bytes()).hexdigest()
    expected=json.loads(read('VERSION.json'))['sourceBaseline']['gameSha256']
    if base_hash!=expected:raise ValueError('game.js baseline changed: review and port the adapter before building')
    source=game();(ROOT/'dist/game-forge.js').write_text(source,encoding='utf-8',newline='\n')
    html=read('street-fighter-6.html')
    html=re.sub(r'<title>.*?</title>','<title>INK FLOW 04 · 不知火舞 / 花焰动作与连段工坊</title>',html,count=1)
    html=html.replace('</head>','<style>\n'+read('forge/style.css')+'\n'+read('forge/flow.css')+'\n'+read('forge/mai.css')+'\n</style></head>')
    includes=['src/ink/core.js','src/ink/inbetween.js','src/ink/motion.js','src/ink/input.js','src/ink/assets.js',*['src/ink/art/'+id+'.js' for id in ['ryu','ken','chun','cammy','luke','juri','mai','iori']],'src/ink/design.js','src/ink/renderer.js','src/ink/mai-renderer.js','src/ink/project.js','src/ink/runtime.js','src/ink/states.js','src/ink/particles.js','src/ink/trails.js','src/ink/effects.js','src/ink/combo.js','src/ink/cinema.js','src/ink/portable.js','src/ink/game-adapter.js','dist/game-forge.js']
    html=patch(html,'<script src="game.js"></script>','\n'.join('<script src="'+x+'"></script>' for x in includes))
    html=html.replace('<script src="src/atelier-studio.js"></script>','<script src="src/atelier-studio.js"></script>')
    html=html.replace('</body>',read('forge/shell.html')+'\n<script id="ink-asset-bundle" type="application/json">'+jsdata(assets())+'</script>\n<script id="ink-export-template" type="application/json">__INK_TEMPLATE_DATA__</script>\n<script id="ink-user-project" type="application/json">__INK_PROJECT_DATA__</script>\n<script id="ink-combo-library" type="application/json">'+jsdata(json.loads(read('assets/ink/combos.json'))) +' </script>\n<script src="forge/app.js"></script>\n<script src="forge/flow.js"></script>\n<script src="forge/mai.js"></script>\n</body>')
    html=re.sub(r'<script src="([^\"]+)"></script>',lambda m:script(read(m[1])),html)
    template=html
    html=html.replace('>__INK_TEMPLATE_DATA__</script>','>'+jsdata(template)+'</script>',1).replace('>__INK_PROJECT_DATA__</script>','>{}</script>',1)
    path=ROOT/'dist/INK-Street-Fighter-6.html';path.write_text(html,encoding='utf-8',newline='\n')
    player_seed={'version':2,'kind':'ink-project-overrides','projectId':'ink-flow-player-3','revision':0,'createdAt':0,'models':{},'rigs':{},'moves':{},'presentation':'player'}
    player_html=html.replace('<script id="ink-user-project" type="application/json">{}</script>','<script id="ink-user-project" type="application/json">'+jsdata(player_seed)+'</script>',1)
    (ROOT/'dist/INK-Street-Fighter-6-Player.html').write_text(player_html,encoding='utf-8',newline='\n')
    (ROOT/'dist/forge-template.html').write_text(template,encoding='utf-8',newline='\n')
    assert hashlib.sha256((ROOT/'game.js').read_bytes()).hexdigest()==base_hash
    print('Built',path.name,len(html.encode()),'bytes; baseline unchanged',base_hash[:16])
if __name__=='__main__':build()
