#!/usr/bin/env python3
"""Compare v7 authored data with immutable signatures taken from the user's v6 ZIP."""
from pathlib import Path
import datetime,hashlib,json
R=Path(__file__).resolve().parents[1];O=R/'qa/flow7'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def canon(d):return hashlib.sha256(json.dumps(d,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()
def main():
 ref=json.loads((R/'tests/fixtures/flow6-asset-signatures.json').read_text(encoding='utf-8'));errors=[];changed=[];counts={k:0 for k in ['nonTransitionEqual','clipEqual','bindingEqual','boxesEqual']}
 for rel,old in ref['moves'].items():
  p=R/rel
  if not p.exists():errors.append('Missing '+rel);continue
  d=json.loads(p.read_text(encoding='utf-8'))
  comparisons={'nonTransitionEqual':canon({k:v for k,v in d.items() if k!='transitions'})==old['withoutTransitionsSha256'],'clipEqual':canon(d.get('clip'))==old['clipSha256'],'bindingEqual':canon(d.get('binding'))==old['bindingSha256'],'boxesEqual':canon(d.get('boxes'))==old['boxesSha256']}
  for k,ok in comparisons.items():
   counts[k]+=int(ok)
   if not ok:errors.append(k+': '+rel)
  if sha(p)!=old['rawSha256']:changed.append({'path':rel,'sha256':sha(p),'transitions':d.get('transitions')})
 current=set(str(p.relative_to(R)).replace('\\','/') for p in (R/'assets/ink/characters').glob('*/moves/*.json'))
 if current!=set(ref['moves']):errors.append('Move identity set changed')
 unchanged_models=[]
 for rel,h in ref['characterFiles'].items():
  if '/moves/' not in rel:
   ok=(R/rel).exists() and sha(R/rel)==h;unchanged_models.append(ok)
   if not ok:errors.append('Model/rig changed: '+rel)
 old_routes=json.loads((R/'tests/fixtures/flow6-combo-routes.json').read_text(encoding='utf-8'))
 routes=json.loads((R/'assets/ink/combos.json').read_text(encoding='utf-8'))
 if isinstance(old_routes,dict):old_routes=old_routes['routes']
 now={r['id']:r for r in routes['routes']}
 old_ok=sum(now.get(r['id'])==r for r in old_routes)
 if old_ok!=len(old_routes):errors.append('An original route was altered')
 report={'suite':'flow7-source-audit','capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'htmlSha256':sha(R/'dist/INK-Street-Fighter-6.html'),'baseline':ref['archive'],'baselineSha256':ref['archiveSha256'],'status':'passed' if not errors else 'failed','totalMoves':len(ref['moves']),**counts,'changedMoveRecords':len(changed),'changed':changed,'modelAndRigTotal':len(unchanged_models),'modelAndRigUnchanged':sum(unchanged_models),'originalRoutes':len(old_routes),'originalRoutesUnchanged':old_ok,'currentRoutes':len(routes['routes']),'newRoutes':[r for r in routes['routes'] if r['id'] not in {x['id'] for x in old_routes}],'errors':errors,'note':'This is asset/config equality only, not a claim that new clock, hitstop, input or cancel runtime rules are unchanged.'}
 O.mkdir(exist_ok=True,parents=True);(O/'source-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print('SOURCE AUDIT',report['status'],counts,'changed',len(changed),'old routes',old_ok);return 1 if errors else 0
if __name__=='__main__':raise SystemExit(main())
