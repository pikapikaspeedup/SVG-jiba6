#!/usr/bin/env python3
"""Replace mistaken changing-value holds with continuous incoming transitions.
Equal-value holds (real plateaus) are retained. Timing, boxes and FX are untouched.
"""
from pathlib import Path
import json
R=Path(__file__).resolve().parents[1];changes=[]
channels={'fw','rw','fa','ra','lean','bob','head','chest','pelvis','spin','yaw','chestYaw','pelvisYaw','headYaw','turn','depth','floor','rootShift','ffoot','rfoot'}
for path in (R/'assets/ink/characters').glob('*/moves/*.json'):
 d=json.loads(path.read_text());edit=[]
 for ch,keys in d['clip']['tracks'].items():
  if ch not in channels:continue
  for i,k in enumerate(keys):
   if i and len(k)>2 and k[2]=='hold' and k[1]!=keys[i-1][1]:
    edit.append({'channel':ch,'frame':k[0],'from':keys[i-1][1],'to':k[1]});k[2]='spline'
 if edit:
  changes.append({'asset':str(path.relative_to(R)),'keys':edit});d['clip']['meta']['continuousHolds6']=True;path.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
path=R/'qa/flow6/hold-repair-journal.json';path.write_text(json.dumps({'records':len(changes),'keys':sum(len(r['keys']) for r in changes),'changes':changes},ensure_ascii=False,indent=2)+'\n')
print('Changing-value holds repaired:',len(changes),'records /',sum(len(r['keys']) for r in changes),'keys')
