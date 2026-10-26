#!/usr/bin/env python3
"""Upgrade editor assets to FLOW in-between curves and authored emitter profiles.
Idempotent. Does not alter combat timing, damage, meter, or hit-box windows.
"""
import json
from pathlib import Path
R=Path(__file__).resolve().parents[1]
counts={'clips':0,'turnStudies':0,'emitters':0,'socketCorrections':0}
for path in sorted((R/'assets/ink/characters').glob('*/moves/*.json')):
 d=json.loads(path.read_text());c=d['character'];t=d['clip']['tracks'];meta=d['clip'].setdefault('meta',{});kind=meta.get('kind','');D=d['clip']['duration'];a=d['binding']['startup'];z=a+d['binding']['active']
 if meta.get('flowEdition')==3: continue
 for name,keys in t.items():
  if name not in ['fw','rw','fa','ra','lean','head','chest','pelvis','bob','floor','rootShift','turn']: continue
  for key in keys:
   if len(key)>2 and key[2]=='smooth':key[2]='spline'
 def track(name,keys):t[name]=[[round(f,3),v,'spline'] for f,v in keys]
 if d['category']=='special' and kind=='upper':
  # Normalized choreography phases; actual active/startup timing stays unchanged.
  end=z+(D-z)*.55
  angles={'ken':[0,-12,30,105,210,295,360],'ryu':[0,-8,20,58,132,58,0],
   'luke':[0,-8,18,40,62,30,0],'chun':[0,-9,24,60,28,12,0],
   'cammy':[0,-5,20,45,65,32,0],'juri':[0,-18,18,100,170,76,0],
   'mai':[0,-8,16,35,60,28,0],'iori':[0,-20,28,110,195,285,360]}[c]
  times=[0,a*.6,a,a+(z-a)*.5,z,end,D]
  track('yaw',list(zip(times,angles)));track('turn',[(0,0),(D,0)]);track('depth',[(0,1),(D,1)])
  track('headYaw',[(0,0),(a,-8),(z,-18 if c in ['ken','iori'] else -10),(end,9),(D,0)])
  track('pelvisYaw',[(0,0),(a,-10),(z,-17),(end,-8),(D,0)])
  meta['turnNote']='Authored axial yaw: front → side → back at fractional frames. Sagittal flip is a separate spin track.'
  counts['turnStudies']+=1
  if c in ['chun','cammy','juri','mai']:
   for fx in d['fx']:
    if fx['socket']=='frontHand':fx['socket']='frontFoot';counts['socketCorrections']+=1
  # Allow the uppercut trail to persist into flight while collision is still owned by combat.
  for fx in d['fx']:fx['duration']=min(D-fx['frame'],max(fx['duration'],int((D-a)*.62)))
 if d['category']=='special' and kind in ['spin','drill'] and not (c=='mai' and d['gameId'].startswith('musabi')):
  # True axial turns, not toggling between two drawings. Multiple revolutions intentionally unwrapped.
  turns=2 if c in ['chun','cammy'] and z-a>16 else 1
  track('yaw',[(0,0),(a*.65,-12),(a,20),(a+(z-a)*.35,125*turns),(z,310*turns),(D,360*turns)])
  track('turn',[(0,0),(D,0)]);track('depth',[(0,1),(D,1)]);counts['turnStudies']+=1
 for fx in d['fx']:
  # Editor-authored particle descriptors travel with JSON and all offline exports.
  normal=d['category']=='normal';super_=d['category']=='super';fire=c in ['ken','mai'];species='ember' if fire else 'shard' if c in ['juri','iori'] else 'fleck' if c=='chun' else 'spark'
  fx['particles']={'count':6 if normal else 90 if super_ else 64,'life':16 if normal else 27,'speed':4.6 if fire else 5.6,'size':1.2 if normal else 4.2 if fire else 2.4,'spread':100 if fire else 65,'species':species}
  if normal:fx['opacity']=min(fx['opacity'],.38)
  else:fx['opacity']=max(fx['opacity'],.82 if fx['type']=='silk' else .9)
  if c=='luke' and not normal:fx['particles']['speed']=7;fx['particles']['spread']=30
  if kind=='upper' and c=='iori':fx['type']='claw'
  if c=='mai' and d['gameId'].startswith('shinobibachi'):fx['socket']='frontElbow';fx['rotation']=0
  if c=='mai' and d['gameId'].startswith('musabi'):fx['socket']='chest';fx['rotation']=38
  if c=='cammy' and d['gameId'].startswith('strike'):fx['rotation']=42
  counts['emitters']+=1
 meta['flowEdition']=3
 path.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n');counts['clips']+=1
print(json.dumps(counts))
