#!/usr/bin/env python3
"""Mai turn choreography uses unturned targets, then the shared axial projector.
No simultaneous screen-space hand swap + second full-body rotation.
"""
from pathlib import Path
import json
R=Path(__file__).resolve().parents[1];changes=[]
for path in (R/'assets/ink/characters/mai/moves').glob('ryuuenbu-*.json'):
 d=json.loads(path.read_text());s=d['binding']['startup'];a=d['binding']['active'];e=s+a;D=d['clip']['duration'];tr=d['clip']['tracks']
 times=[0,s*.6,s,s+a*.32,s+a*.65,e,e+(D-e)*.55,D]
 def track(name,values):tr[name]=[[round(t,4),v,'spline'] for t,v in zip(times,values)]
 old={k:tr.get(k) for k in ['fw','rw','ra','fa','lean','bob','chest','pelvis','yaw','pelvisYaw','headYaw','fanAngle','depth']}
 track('fw',[[113,-313],[54,-321],[154,-284],[153,-309],[150,-283],[149,-286],[90,-307],[113,-313]])
 track('rw',[[-23,-285],[-53,-299],[-71,-285],[-67,-281],[-68,-295],[-56,-291],[-32,-290],[-23,-285]])
 track('ra',[[-104,-16],[-109,-16],[-106,-16],[-101,-16],[-107,-16],[-110,-16],[-106,-16],[-104,-16]])
 track('fa',[[82,-16],[87,-16],[109,-16],[113,-16],[106,-16],[99,-16],[86,-16],[82,-16]])
 track('lean',[-6,-9,5,2,5,2,-5,-6]);track('bob',[1,4,3,2,3,2,1,1]);track('chest',[0,-5,5,3,4,2,-2,0]);track('pelvis',[0,-2,0,2,1,0,-1,0])
 track('yaw',[0,-14,12,124,250,350,360,360]);track('pelvisYaw',[0,-5,-12,-16,-13,-7,0,0]);track('headYaw',[0,7,-8,-9,-7,-3,0,0]);track('depth',[1]*len(times))
 track('fanAngle',[-9,-18,8,10,3,14,-10,-9]);tr['turn']=[[0,0,'spline'],[D,0,'spline']]
 d['clip']['meta']['anatomy6']={'revision':'axial-fan-sweep','space':'unturned-author','notes':'整条四肢先在未转身空间求解；扇和脚随投影旋转，不再提前左右换手。'}
 changes.append({'asset':str(path.relative_to(R)),'before':old,'after':{k:tr[k] for k in old}});path.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
(R/'qa/flow6/mai-turn-journal.json').write_text(json.dumps({'records':len(changes),'changes':changes},ensure_ascii=False,indent=2)+'\n');print('Mai axial turn assets:',len(changes))
