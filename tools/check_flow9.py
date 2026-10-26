#!/usr/bin/env python3
"""Validate source and optionally current-build browser evidence (Python 3.10+).
--evidence requires genuine matching reports; --require-soak additionally requires
an actual completed >=1500-second endurance run. Does not synthesize test results.
"""
from pathlib import Path
import argparse,datetime,hashlib,json,shutil,subprocess
R=Path(__file__).resolve().parents[1];O=R/'qa/flow9'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--evidence',action='store_true');ap.add_argument('--require-soak',action='store_true');a=ap.parse_args();O.mkdir(parents=True,exist_ok=True);checks=[]
 def check(name,ok,detail=None):checks.append(dict(name=name,pass_=bool(ok),detail=detail));print('PASS' if ok else 'FAIL',name)
 def read(path):
  try:return json.loads(path.read_text())
  except (OSError,ValueError):return {}
 source=read(R/'tests/fixtures/flow8-asset-signatures.json');bad=[p for p,h in source.get('files',{}).items() if not (R/p).is_file() or sha(R/p)!=h];check('707 original move/model/rig/route files preserved',len(source.get('files',{}))==707 and not bad,bad)
 moves=list((R/'assets/ink/characters').glob('*/moves/*.json'));routes=read(R/'assets/ink/combos.json').get('routes',[]);check('690 moves / 22 routes',len(moves)==690 and len(routes)==22)
 version=read(R/'VERSION.json');check('Version 9 and explicit defaults',version.get('version')=='9.0.0' and version.get('engineIteration',{}).get('defaultRhythm')=='fluid' and version.get('engineIteration',{}).get('defaultViewport')=='stable')
 game=(R/'game.js').read_text();build=(R/'tools/build_forge.py').read_text();check('Formal production entrypoints call new systems',all(x in game for x in ['INK.Presentation.bindControl','INK.Presentation.boundary','INK.Viewport.sample','INK.FrameProbe?.begin','INK.FrameProbe?.end']))
 check('Build includes source modules and UI without function-body patching',all(n in build for n in ['viewport.js','frame-probe.js','fluid.js','fluid.css']) and 'patch_game' not in build)
 scripts=[R/'game.js',*sorted((R/'src').rglob('*.js')),*sorted((R/'forge').glob('*.js'))];syntax=[];node=shutil.which('node')
 if node:
  for p in scripts:
   x=subprocess.run([node,'--check',str(p)],capture_output=True,text=True)
   if x.returncode:syntax.append({'file':str(p.relative_to(R)),'error':x.stderr})
  check('Production JavaScript syntax',not syntax,{'scripts':len(scripts),'errors':syntax})
 else:print('SKIP JavaScript syntax: node is not installed')
 for n in ['INK-Street-Fighter-6.html','INK-Street-Fighter-6-Player.html']:
  p=R/'dist'/n;t=p.read_text() if p.exists() else '';check(n+' embeds current runtime',all(x in t for x in ['9.0.0-ink-fluid','INK.FrameProbe','INK.Viewport=Viewport','INKFluidLab={ready:true']))
 current=sha(R/'dist/INK-Street-Fighter-6.html')
 if a.evidence or a.require_soak:
  for name,total in [('contracts',24),('response-contracts',44),('ui',28),('portability',15),('rhythm-matrix',264)]:
   d=read(O/(name+'.json'));ok=d.get('htmlSha256')==current and not d.get('browserErrors') and d.get('passed')==d.get('total') and d.get('total',0)>0 and (total is None or d.get('total')==total);check('Current evidence: '+name,ok,{'passed':d.get('passed'),'total':d.get('total')})
  d=read(O/'same-frame-comparison.json');check('Original/current world joint same-time comparison',d.get('htmlSha256')==current and d.get('pass') and not d.get('browserErrors'))
  d=read(O/'response-state-matrix.json');check('Response-state purity and 44 real route pairs',d.get('htmlSha256')==current and d.get('charactersPassed')==d.get('charactersTotal')==16 and d.get('routePairsPassed')==d.get('routePairsTotal')==44 and not d.get('browserErrors'))
  d=read(O/'final-regressions.json');ok=d.get('htmlSha256')==current and d.get('unchangedDuringRun') and d.get('total')==d.get('passed')==9
  for row in d.get('commands',[]):
   p=R/row['log'];ok=ok and p.exists() and sha(p)==row.get('logSha256')
  check('Nine inherited commands and exact log hashes',ok)
  for name,t,k in [('browser-contracts','total','passed'),('transition-matrix','total','passed'),('recovery-observation','samples','passed'),('render-and-practice','displayTotal','displayPassed'),('effect-invariance','total','passed'),('character-chain','total','passed')]:
   d=read(O/'inherited'/(name+'.json'));check('Inherited current '+name,d.get('htmlSha256')==current and not d.get('browserErrors') and d.get(t,0)>0 and d.get(t)==d.get(k))
  d=read(O/'inherited/legacy-mechanics.json');check('39 original mechanics',isinstance(d,list) and len(d)==39 and all(x.get('pass') for x in d))
  d=read(O/'inherited/legacy-replays.json');check('522 original single-move replays',isinstance(d,list) and len(d)==522 and all(x.get('started') and x.get('finite') and x.get('validSVG') for x in d))
  for label in ['final-candidate-1','final-candidate-2','final-baseline-1','final-baseline-2']:
   d=read(O/(label+'-benchmark.json'));baseline='baseline' in label;expected=sha(R/'legacy/flow8/baseline-v8.html') if baseline else current;check('Independent benchmark: '+label,d.get('htmlSha256')==expected and not d.get('browserErrors') and not d.get('live',{}).get('errors') and d.get('live',{}).get('elapsedWallSeconds',0)>=25 and d.get('live',{}).get('cycles',0)>0)
  d=read(O/'comparison.json');check('Native-camera visual comparison bound to current HTML',d.get('htmlSha256')==current and d.get('baselineSha256')==sha(R/'legacy/flow8/baseline-v8.html') and d.get('frames',0)>0 and not d.get('browserErrors'))
  d=read(O/'source-diff.json');check('Source patch reverses and reapplies exactly',d.get('status')=='passed' and d.get('reverseMatchesOriginal') and d.get('appliedSourceMatches') and all((R/e['path']).exists() and sha(R/e['path'])==e['afterSha256'] for e in d.get('files',[])))
  d=read(O/'final-build-freeze.json');bad=[p for p,h in d.get('files',{}).items() if not (R/p).is_file() or sha(R/p)!=h];check('All production/build inputs unchanged since final freeze',len(d.get('files',{}))>60 and not bad,bad)
 if a.require_soak:
  d=read(O/'endurance.json');check('Completed >=25 minute real final-build endurance',d.get('status')=='passed' and d.get('htmlSha256')==current and d.get('elapsedWallSeconds',0)>=1500 and d.get('completedRoutes',0)>0 and not d.get('browserErrors'),{'elapsedWallSeconds':d.get('elapsedWallSeconds'),'completedRoutes':d.get('completedRoutes')})
 checks=[{'name':c['name'],'pass':c['pass_'],'detail':c['detail']} for c in checks];report={'suite':'flow9-source-and-evidence-validation','utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'htmlSha256':current,'total':len(checks),'passed':sum(c['pass'] for c in checks),'tests':checks,'evidenceValidated':a.evidence or a.require_soak,'soakRequired':a.require_soak};(O/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');return 0 if report['total']==report['passed'] else 1
if __name__=='__main__':raise SystemExit(main())
