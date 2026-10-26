#!/usr/bin/env python3
"""Author FLOW 05 presentation layers and emitters without touching combat data.
Run on FLOW 04 assets once; idempotent for the fields owned by this migration.
"""
from pathlib import Path
import json
R=Path(__file__).resolve().parents[1]
changed=[]
for path in (R/'assets/ink/characters/mai/moves').glob('*.json'):
    record=json.loads(path.read_text(encoding='utf-8'))
    if record['category'] not in ['normal','special','super'] and record['gameId']!='@idle':
        continue
    binding=record['binding'];s=binding['startup'];a=binding['active'];end=s+a;total=record['clip']['duration']
    normal=record['category']=='normal';idle=record['gameId']=='@idle';scale=.48 if normal else 1
    times=[0,round(s*.65,3),round(s+min(a*.42,6),3),end,round(end+(total-end)*.52,3),total]
    def track(values):
        return [[t,v,'spline'] for t,v in sorted(dict(zip(times,values)).items())]
    layers=[]
    if not idle:
        layers.append({'id':'mai-torso-counterrotation','mode':'additive','weight':1,
          'tracks':{'chest':track([0,-4*scale,10*scale,5*scale,-3*scale,0]),
                    'pelvis':track([0,3*scale,-5*scale,-3*scale,2*scale,0]),
                    'headYaw':track([0,2*scale,-5*scale,-2*scale,2*scale,0])}})
        if not record['gameId'].startswith('a'):
            layers.append({'id':'mai-fan-follow-through','mode':'additive','weight':1,
              'tracks':{'fanAngle':track([0,-6*scale,11*scale,6*scale,-4*scale,0])}})
    contacts=[]
    # Explicit authoring: never infer a plant on an airborne or rotating attack.
    grounded=(record['gameId'].startswith('s') and normal) or path.stem.startswith(('ryuuenbu-','kachousen-'))
    if grounded:
        contacts=[{'id':'rear-support','socket':'rearFoot','start':0,'end':min(total-3,end+3),
                   'fadeIn':2,'fadeOut':3,'strength':.92,'maxCorrection':32}]
    record['clip'].setdefault('meta',{})['motion5']={
       'version':1,'weightScale':1,'layers':layers,'contacts':contacts,
       'springs':{'frequency':.38 if normal else .31,'damping':.5 if normal else .4,'hairStrength':1.15,'clothStrength':1.1}}
    for event in record['fx']:
        particles=event.setdefault('particles',{})
        particles.update(spacing=24 if normal else 13 if event['type']=='flame' else 18,
                         rate=round((particles.get('count',12 if normal else 22))/max(1,event['duration'])*.38,3),
                         burst=1 if normal else 3,inheritVelocity=.2 if normal else .28)
        if particles.get('species')=='petal':
            particles.update(sizeCurve=[[0,.45],[.18,1],[.75,.85],[1,.3]],opacityCurve=[[0,.2],[.1,.9],[.75,.7],[1,0]],heat=False)
        elif event['type']=='flame':
            particles.update(sizeCurve=[[0,.3],[.12,1.25],[.48,.9],[1,.1]],opacityCurve=[[0,.2],[.1,1],[.7,.65],[1,0]],heat=True)
    path.write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    changed.append(path.stem)
(R/'qa/flow5/mai-assets.json').write_text(json.dumps({'count':len(changed),'assets':sorted(changed),'scope':'Only presentation graph metadata and emitter configuration; no base tracks, binding or boxes modified.'},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('FLOW 05 Mai assets:',len(changed))
