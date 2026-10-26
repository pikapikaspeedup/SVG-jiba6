#!/usr/bin/env python3
"""Check current source/asset contracts and optionally run or validate browser evidence.
Default checks source, all inherited asset fingerprints and built entrypoints.
--run executes browser regression tests; --evidence binds saved final reports to
current HTML; --require-soak also requires a completed >=1500s wall-clock test.
"""
from pathlib import Path
import argparse,datetime,hashlib,json,shutil,subprocess,sys
R=Path(__file__).resolve().parents[1];O=R/'qa/flow8'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--run',action='store_true');ap.add_argument('--evidence',action='store_true');ap.add_argument('--require-soak',action='store_true');args=ap.parse_args();O.mkdir(parents=True,exist_ok=True);checks=[];commands=[]
 def check(name,ok,detail=None):checks.append({'name':name,'pass':bool(ok),'detail':detail});print('PASS' if ok else 'FAIL',name)
 base=json.loads((R/'tests/fixtures/flow7-asset-signatures.json').read_text());files=base['files'];bad=[n for n,h in files.items() if not (R/n).is_file() or sha(R/n)!=h];check('All inherited moves/models/rigs/routes unchanged',not bad,{'files':len(files),'mismatches':bad})
 moves=[p for p in (R/'assets/ink/characters').rglob('*.json') if '/moves/' in str(p)];routes=json.loads((R/'assets/ink/combos.json').read_text())['routes'];check('690 move records and 22 routes retained',len(moves)==690 and len(routes)==22,{'moves':len(moves),'routes':len(routes)})
 version=json.loads((R/'VERSION.json').read_text());check('Release metadata is v8 response',version['version']=='8.0.0' and version['engineIteration']['replayCapacity']==600)
 modules=['presentation-clock.js','state-transitions.js','scene-feedback.js','pose-replay.js'];game=(R/'game.js').read_text();check('Formal game source calls all four new systems',all(s in game for s in ['INK.Presentation.begin','INK.Presentation.finish','INK.StateTransitions.land','INK.SceneFeedback.ground','INK.Replay.capture']))
 build=(R/'tools/build_forge.py').read_text();check('Formal build includes new modules and UI',all(m in build for m in modules+['response.js','response.css']))
 check('No runtime source-string patching reintroduced','patch_game' not in build)
 node=shutil.which('node');scripts=[R/'game.js',*sorted((R/'src/ink').glob('*.js')),*sorted((R/'forge').glob('*.js'))];syntax=[]
 if node:
  for p in scripts:
   c=subprocess.run([node,'--check',str(p)],capture_output=True,text=True)
   if c.returncode:syntax.append({'file':str(p.relative_to(R)),'error':c.stderr})
  check('All production JavaScript parses',not syntax,{'scripts':len(scripts),'errors':syntax})
 else:checks.append({'name':'JavaScript syntax check','pass':True,'detail':'Skipped: Node not installed. Build itself requires Python only.'})
 for n in ['INK-Street-Fighter-6.html','INK-Street-Fighter-6-Player.html']:
  p=R/'dist'/n;txt=p.read_text();check(n+' contains production response runtime',all(s in txt for s in ['8.0.0-ink-response','INK.Replay=Replay','INKResponseLab={ready:true','INK.Presentation=Clock']))
 if args.run:
  for name in ['browser-contracts.py','state-matrix.py','ui.py','portability.py']:
   cmd=[sys.executable,str(R/'tests/flow8'/name)];p=subprocess.run(cmd,cwd=R,capture_output=True,text=True);log=O/('check-'+name+'.log');log.write_text(p.stdout+p.stderr);commands.append({'command':cmd,'exitCode':p.returncode,'log':str(log.relative_to(R))});check('Executed '+name,p.returncode==0)
 if args.evidence or args.require_soak:
  html=sha(R/'dist/INK-Street-Fighter-6.html')
  for name in ['browser-contracts','ui','portability','state-matrix','comparison','candidate-observations']:
   p=O/(name+'.json');d=json.loads(p.read_text()) if p.exists() else {};ok=d.get('htmlSha256')==html and not d.get('browserErrors')
   if 'total' in d:ok=ok and d.get('passed')==d.get('total') and d['total']>0
   if name=='state-matrix':ok=ok and d.get('charactersTotal')==d.get('charactersPassed')==16 and d.get('routePairsTotal')==d.get('routePairsPassed')==44
   if name=='comparison':ok=ok and d.get('frames',0)>0
   check('Current-build evidence: '+name,ok,{'sha256':sha(p) if p.exists() else None})
  final_path=O/'final-regressions.json';final=json.loads(final_path.read_text()) if final_path.exists() else {};ok=final.get('htmlSha256')==html and final.get('unchangedDuringRun') and final.get('passed')==final.get('total')==9
  for row in final.get('commands',[]):
   path=R/row['log'];ok=ok and path.exists() and sha(path)==row['logSha256']
  check('Final inherited regression executions bound to current HTML and logs',ok)
  for name,total,passed in [('browser-contracts','total','passed'),('transition-matrix','total','passed'),('recovery-observation','samples','passed'),('render-and-practice','displayTotal','displayPassed'),('effect-invariance','total','passed'),('character-chain','total','passed')]:
   path=O/'inherited'/(name+'.json');d=json.loads(path.read_text()) if path.exists() else {};check('Current inherited evidence: '+name,d.get('htmlSha256')==html and not d.get('browserErrors') and d.get(total,0)>0 and d.get(total)==d.get(passed))
  mechanics=json.loads((O/'inherited/legacy-mechanics.json').read_text());replays=json.loads((O/'inherited/legacy-replays.json').read_text())
  check('All 39 saved original mechanic assertions passed',len(mechanics)==39 and all(x.get('pass') for x in mechanics))
  check('All 522 saved single-move replays started with finite valid SVG',len(replays)==522 and all(x.get('started') and x.get('finite') and x.get('validSVG') for x in replays))
  practice=json.loads((O/'inherited/render-and-practice.json').read_text());cancels=json.loads((O/'inherited/transition-matrix.json').read_text())
  check('Saved G-practice and actual route coverage complete',practice.get('practiceTotal')==practice.get('practicePassed')==36 and cancels.get('routeTotal')==cancels.get('routePassed')==44)
  diff=json.loads((O/'source-diff.json').read_text());check('Source patch reverses to v7 and reapplies to current source',diff.get('status')=='passed' and diff.get('reverseMatchesOriginal') and diff.get('appliedSourceMatches') and all(sha(R/e['path'])==e['afterSha256'] for e in diff['files']))
  freeze=json.loads((O/'final-build-freeze.json').read_text());bad=[n for n,h in freeze['files'].items() if sha(R/n)!=h];check('Production unchanged since final-build freeze',not bad,bad)
 if args.require_soak:
  p=O/'replay-stress.json';d=json.loads(p.read_text()) if p.exists() else {};check('Completed >=3 min real replay-import/seek lifecycle stress on this HTML',d.get('status')=='passed' and d.get('elapsedWallSeconds',0)>=180 and d.get('htmlSha256')==sha(R/'dist/INK-Street-Fighter-6.html') and not d.get('browserErrors'),{'elapsedWallSeconds':d.get('elapsedWallSeconds'),'cycles':d.get('final',{}).get('cycles')})
  p=O/'endurance.json';d=json.loads(p.read_text()) if p.exists() else {};check('Completed >=25 min actual wall-clock endurance on this HTML',d.get('status')=='passed' and d.get('elapsedWallSeconds',0)>=1500 and d.get('htmlSha256')==sha(R/'dist/INK-Street-Fighter-6.html') and not d.get('browserErrors'),{'elapsedWallSeconds':d.get('elapsedWallSeconds'),'completedRoutes':d.get('completedRoutes')})
 report={'suite':'flow8-source-and-evidence-validation','capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'htmlSha256':sha(R/'dist/INK-Street-Fighter-6.html'),'total':len(checks),'passed':sum(x['pass'] for x in checks),'tests':checks,'commands':commands,'evidenceValidated':args.evidence or args.require_soak};(O/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');return 0 if report['total']==report['passed'] else 1
if __name__=='__main__':raise SystemExit(main())
