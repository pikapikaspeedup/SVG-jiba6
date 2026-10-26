#!/usr/bin/env python3
"""Run FLOW 07 checks, or validate recorded evidence against the current build.
Report-only does not execute any tests. Soak and controlled playback are separate.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'qa/flow7'
def sha(path:Path)->str:return hashlib.sha256(path.read_bytes()).hexdigest()
def main()->int:
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--report-only',action='store_true')
 parser.add_argument('--require-soak',action='store_true')
 parser.add_argument('--require-playback',action='store_true')
 args=parser.parse_args();OUT.mkdir(parents=True,exist_ok=True);executed=[]
 if not args.report_only:
  for script in ['tools/build_forge.py','tools/audit_flow7.py','tests/flow7/final-regressions.py','tests/flow7/render-and-practice.py','tests/flow7/ui.py','tests/flow7/freeze-origin-comparison.py','tests/flow7/character-chain.py','tests/flow7/effect-invariance.py','tests/flow7/entrypoints.py']:
   cmd=[sys.executable,script];print('RUN',*cmd,flush=True)
   proc=subprocess.run(cmd,cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf-8',errors='replace')
   log=OUT/('check-'+Path(script).stem+'.log');log.write_text(proc.stdout,encoding='utf-8');print(proc.stdout,end='',flush=True)
   executed.append({'command':cmd,'exitCode':proc.returncode,'log':str(log.relative_to(ROOT))})
   if proc.returncode:return proc.returncode
 html=sha(ROOT/'dist/INK-Street-Fighter-6.html');errors=[];evidence={}
 def load(name:str,bind:bool=True)->dict:
  path=OUT/(name+'.json')
  try:d=json.loads(path.read_text(encoding='utf-8'))
  except (OSError,ValueError) as exc:errors.append(name+': missing/invalid evidence '+str(exc));return {}
  if bind and d.get('htmlSha256')!=html:errors.append(name+': stale HTML fingerprint')
  if isinstance(d,dict) and d.get('browserErrors'):errors.append(name+': browser errors')
  evidence[name]={'path':str(path.relative_to(ROOT)),'sha256':sha(path)}
  return d
 def count(name,d,total='total',passed='passed'):
  n=d.get(total,0);p=d.get(passed,-1)
  if not isinstance(n,int) or n<=0 or p!=n:errors.append(f'{name}: incomplete {p}/{n}')
  evidence.setdefault(name,{}).update({total:n,passed:p})
 for name in ['regression-core','browser-contracts','smoke','transition-matrix','portability','ui','character-chain','effect-invariance']:
  d=load(name);count(name,d)
  if name=='transition-matrix':count(name,d,'routeTotal','routePassed')
 d=load('contracts',False);count('contracts',d)
 for module,h in d.get('sourceSha256',{}).items():
  if h!=sha(ROOT/'src/ink'/(module+'.js')):errors.append('contracts: stale '+module)
 if not d.get('sourceSha256'):errors.append('contracts: source hashes missing')
 d=load('recovery-observation');count('recovery-observation',d,'samples','passed')
 d=load('final-regressions');count('final-regressions',d)
 if not d.get('unchangedDuringRun'):errors.append('final-regressions: build changed while running')
 for name in ['legacy-mechanics','legacy-replays']:
  rows=load(name,False)
  if not isinstance(rows,list) or not rows:errors.append(name+': rows missing');continue
  n=sum(bool(r.get('pass')) if name.endswith('mechanics') else bool(r.get('started') and r.get('finite') and r.get('validSVG')) for r in rows)
  evidence[name].update(total=len(rows),passed=n,boundBy='final-regressions.json command execution + stable HTML hash')
  if n!=len(rows):errors.append(name+': failed rows')
 if load('legacy-regression-errors',False):errors.append('Legacy script errors')
 d=load('render-and-practice');count('render-and-practice',d,'displayTotal','displayPassed');count('render-and-practice',d,'practiceTotal','practicePassed')
 d=load('entrypoints',False);count('entrypoints',d)
 for name,h in d.get('sourceSha256',{}).items():
  if h!=sha(ROOT/name):errors.append('entrypoints: stale '+name)
 d=load('source-diff')
 if d.get('status')!='passed' or not d.get('appliedSourceMatches'):errors.append('Source patch was not verified')
 for row in d.get('files',[]):
  if row['afterSha256'] is not None and sha(ROOT/row['path'])!=row['afterSha256']:errors.append('Source patch no longer describes '+row['path'])
 d=load('source-audit')
 if d.get('status')!='passed' or d.get('errors'):errors.append('source-audit failed')
 evidence['source-audit'].update({k:d.get(k) for k in ['totalMoves','clipEqual','bindingEqual','boxesEqual','nonTransitionEqual','changedMoveRecords','originalRoutesUnchanged','currentRoutes']})
 d=load('pace-comparison',False);versions={x['version']:x for x in d.get('versions',[])}
 if set(versions)!={'v6','v7-legacy','v7-weighted'}:errors.append('pace-comparison: versions missing')
 else:
  for name,v in versions.items():
   want=sha(ROOT/'legacy/flow6/baseline-v6.html') if name=='v6' else html
   if v.get('htmlSha256')!=want:errors.append('pace-comparison: stale '+name)
   if len(v.get('rows',[]))!=32 or any(r.get('status')!='success' for r in v['rows']):errors.append('pace-comparison: route failure '+name)
  keys=['route','side','hits','damage','totalTicks','actionFrames','remaining']
  old=[{k:r[k] for k in keys} for r in versions['v6']['rows']]
  new=[{k:r[k] for k in keys} for r in versions['v7-legacy']['rows']]
  if old!=new:errors.append('pace-comparison: v6/legacy outcomes differ on old fixtures')
  evidence['pace-comparison'].update(versions=3,cases=96,legacyEquality=old==new)
 d=load('freeze-origin-comparison')
 if d.get('status')!='passed':errors.append('literal freeze comparison failed')
 evidence['freeze-origin-comparison']['maximumRewindByVersion']={v['version']:v['maximum'] for v in d.get('versions',[])}
 soakpath=OUT/'endurance.json';soak=json.loads(soakpath.read_text(encoding='utf-8')) if soakpath.exists() else {}
 full=soak.get('htmlSha256')==html and soak.get('status')=='passed' and soak.get('elapsedWallSeconds',0)>=1200 and not soak.get('browserErrors') and soak.get('completedRoutes',0)>0
 if args.require_soak and not full:errors.append('A completed >=1200 wall-second soak on this HTML is required')
 evidence['endurance']={k:soak.get(k) for k in ['htmlSha256','status','elapsedWallSeconds','completedRoutes','startedAt','finishedAt']};evidence['endurance']['fullSoakAccepted']=full
 if full:evidence['endurance']['sha256']=sha(soakpath)
 playpath=OUT/'playback.json';play=json.loads(playpath.read_text(encoding='utf-8')) if playpath.exists() else {}
 clipok=play.get('htmlSha256')==html and not play.get('browserErrors') and play.get('frames',0)>0 and (OUT/'flow7-playback.mp4').exists()
 if args.require_playback and not clipok:errors.append('Current-hash controlled playback is missing')
 evidence['playback']={'accepted':clipok,'htmlSha256':play.get('htmlSha256'),'frames':play.get('frames'),'seconds':play.get('durationSeconds')}
 if clipok:evidence['playback']['sha256']=sha(playpath)
 report={'suite':'flow7-final-validation','capturedAt':datetime.now(timezone.utc).isoformat(),'htmlSha256':html,'playerHtmlSha256':sha(ROOT/'dist/INK-Street-Fighter-6-Player.html'),'status':'passed' if not errors else 'failed','reportOnly':args.report_only,'commandsThisInvocation':executed,'requiresSoak':args.require_soak,'requiresPlayback':args.require_playback,'evidence':evidence,'errors':errors,'note':'Counts are distinct contracts and sampled matrices, not a sum of unique user scenarios. Report-only only validates existing evidence. Native file permissions and true device FPS are not asserted by embedded-byte browser tests.'}
 (OUT/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print('FLOW 07',report['status'].upper(),'HTML',html,flush=True)
 for e in errors:print('FAIL',e,file=sys.stderr)
 return int(bool(errors))
if __name__=='__main__':raise SystemExit(main())
