#!/usr/bin/env python3
"""Build INK FORGE from per-character JSON assets and an explicit game integration source.
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
    # FLOW 05: game.js is the real, checked-in integration source. No runtime
    # function bodies are replaced during the build. Review normal source diffs.
    return read('game.js')

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
def identity():
    # Include the complete production source closure. Unused production modules
    # conservatively invalidate tapes too; never identify a build by its label.
    files=sorted({p for root in ['src','forge','assets/ink'] for p in (ROOT/root).rglob('*') if p.is_file() and not p.is_symlink() and p.suffix in {'.js','.json','.css','.html'}}|{ROOT/'game.js',ROOT/'street-fighter-6.html',ROOT/'tools/build_forge.py'})
    manifest={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
    digest=hashlib.sha256(json.dumps(manifest,sort_keys=True,separators=(',',':')).encode()).hexdigest()
    return {'algorithm':'sha256-source-manifest-v1','id':digest,'files':manifest}

def build():
    (ROOT/'dist').mkdir(exist_ok=True)
    base_hash=hashlib.sha256((ROOT/'game.js').read_bytes()).hexdigest()
    source=game();(ROOT/'dist/game-forge.js').write_text(source,encoding='utf-8',newline='\n')
    html=read('street-fighter-6.html')
    html=re.sub(r'<title>.*?</title>','<title>INK FLOW 09 · 稳镜与流畅动作</title>',html,count=1)
    html=html.replace('</head>','<style>\n'+read('forge/style.css')+'\n'+read('forge/flow.css')+'\n'+read('forge/mai.css')+'\n'+read('forge/engine.css')+'\n'+read('forge/continuity.css')+'\n'+read('forge/rhythm.css')+'\n'+read('forge/response.css')+'\n'+read('forge/fluid.css')+'\n'+read('forge/spacing.css')+'\n'+read('forge/kinetic.css')+'\n'+read('forge/chain.css')+'\n'+read('forge/aerial.css')+'\n'+read('forge/duel.css')+'\n</style></head>')
    includes=['src/ink/core.js','src/ink/canonical.js','src/ink/combat-entities.js','src/ink/combat-state.js','src/ink/combat-trace.js','src/ink/random.js','src/ink/command-stream.js','src/ink/session-config.js','src/ink/combat-identity.js','src/ink/compiled-motion.js','src/ink/engine-clock.js','src/ink/inbetween.js','src/ink/anatomy.js','src/ink/articulation.js','src/ink/motion.js','src/ink/secondary-dynamics.js','src/ink/motion-graph.js','src/ink/combat-flow.js','src/ink/flow-chain.js','src/ink/pressure-flow.js','src/ink/wake-flow.js','src/ink/contact-solver.js','src/ink/spacing.js','src/ink/input.js','src/ink/duel-control.js','src/ink/duel-brain.js','src/ink/assets.js',*['src/ink/art/'+id+'.js' for id in ['ryu','ken','chun','cammy','luke','juri','mai','iori']],'src/ink/design.js','src/ink/skin-geometry.js','src/ink/renderer.js','src/ink/mai-renderer.js','src/ink/project.js','src/ink/runtime.js','src/ink/contact-response.js','src/ink/strike-feel.js','src/ink/kinetic.js','src/ink/guard-body.js','src/ink/strike-motion.js','src/ink/recovery-motion.js','src/ink/body-support.js','src/ink/aerial.js','src/ink/air-pursuit.js','src/ink/air-pursuit-fx.js','src/ink/projectile-flow.js','src/ink/states.js','src/ink/presentation-clock.js','src/ink/state-transitions.js','src/ink/particles.js','src/ink/impact-feedback.js','src/ink/trails.js','src/ink/fx-timeline.js','src/ink/material-flow.js','src/ink/ribbon-geometry.js','src/ink/fx-emitter.js','src/ink/effects.js','src/ink/super-director.js','src/ink/stage-light.js','src/ink/ground-contact.js','src/ink/scene-feedback.js','src/ink/viewport.js','src/ink/frame-probe.js','src/ink/pose-replay.js','src/ink/combo.js','src/ink/cinema.js','src/ink/portable.js','src/ink/game-adapter.js','dist/game-forge.js']
    html=patch(html,'<script src="game.js"></script>','\n'.join('<script src="'+x+'"></script>' for x in includes))
    html=html.replace('<script src="src/atelier-studio.js"></script>','<script src="src/atelier-studio.js"></script>')
    html=html.replace('</body>',read('forge/shell.html')+'\n<script id="ink-asset-bundle" type="application/json">'+jsdata(assets())+'</script>\n<script id="ink-export-template" type="application/json">__INK_TEMPLATE_DATA__</script>\n<script id="ink-user-project" type="application/json">__INK_PROJECT_DATA__</script>\n<script id="ink-combo-library" type="application/json">'+jsdata(json.loads(read('assets/ink/combos.json'))) +' </script>\n<script src="forge/app.js"></script>\n<script src="forge/flow.js"></script>\n<script src="forge/mai.js"></script>\n<script src="forge/engine.js"></script>\n<script src="forge/continuity.js"></script>\n<script src="forge/rhythm.js"></script>\n<script src="forge/response.js"></script>\n<script src="forge/fluid.js"></script>\n<script src="forge/spacing.js"></script>\n<script src="forge/kinetic.js"></script>\n<script src="forge/chain.js"></script>\n<script src="forge/aerial.js"></script>\n<script src="forge/material.js"></script>\n<script src="forge/projectile.js"></script>\n<script src="forge/stage-light.js"></script>\n<script src="forge/strike-feel.js"></script>\n<script src="forge/super-director.js"></script>\n<script src="forge/duel.js"></script>\n<script src="forge/body-contact.js"></script>\n<script src="forge/pressure.js"></script>\n<script src="forge/wake.js"></script>\n<script src="forge/air-pursuit.js"></script>\n</body>')
    html=re.sub(r'<script src="([^\"]+)"></script>',lambda m:script(read(m[1])),html)
    provenance=identity()
    core=script(read('src/ink/core.js'))
    public={k:v for k,v in provenance.items() if k!='files'}
    html=patch(html,core,core+'\n'+script('INK.Build=Object.freeze('+jsdata(public)+');'))
    (ROOT/'dist/engine-build.json').write_text(json.dumps(provenance,indent=2)+'\n',encoding='utf-8')
    template=html
    html=html.replace('>__INK_TEMPLATE_DATA__</script>','>'+jsdata(template)+'</script>',1).replace('>__INK_PROJECT_DATA__</script>','>{}</script>',1)
    path=ROOT/'dist/INK-Street-Fighter-6.html';path.write_text(html,encoding='utf-8',newline='\n')
    player_seed={'version':2,'kind':'ink-project-overrides','projectId':'ink-flow-player-9','revision':0,'createdAt':0,'models':{},'rigs':{},'moves':{},'presentation':'player'}
    player_html=html.replace('<script id="ink-user-project" type="application/json">{}</script>','<script id="ink-user-project" type="application/json">'+jsdata(player_seed)+'</script>',1)
    (ROOT/'dist/INK-Street-Fighter-6-Player.html').write_text(player_html,encoding='utf-8',newline='\n')
    (ROOT/'dist/forge-template.html').write_text(template,encoding='utf-8',newline='\n')
    assert hashlib.sha256((ROOT/'game.js').read_bytes()).hexdigest()==base_hash
    print('Built',path.name,len(html.encode()),'bytes; game source',base_hash[:16])
if __name__=='__main__':build()
