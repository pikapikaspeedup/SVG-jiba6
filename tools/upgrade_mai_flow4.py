#!/usr/bin/env python3
"""One-time, idempotent FLOW 03 -> 04 Mai visual asset migration.
Preserves game IDs, binding, boxes, durations, phases and combat-owned rules.
No external files, libraries, network, or authoritative frame-data claims.
"""
from pathlib import Path
import json, math
ROOT=Path(__file__).resolve().parents[1]
MOVES=ROOT/'assets/ink/characters/mai/moves'
FIRE='#ef835c'; GOLD='#ffcf86'; SILK='#f5dfbc'; PETAL='#e88d9b'
def track(keys):
    return [[round(t,4),v,e] for t,v,e in keys]
def effect(id,at,duration,kind,socket,*,width=10,scale=1,color=FIRE,opacity=.65,rotation=0,trail=8,layer='front',count=18,species='ember',speed=2.8,life=28,size=2.2,curl=1.3,gravity=-.065):
    return dict(id=id,frame=round(at),duration=round(duration),type=kind,socket=socket,scale=scale,color=color,rotation=rotation,opacity=opacity,trailFrames=trail,width=width,layer=layer,particles=dict(count=count,life=life,speed=speed,size=size,spread=95,species=species,gravity=gravity,drag=.035,curl=curl))
changed=[]
for path in sorted(MOVES.glob('*.json')):
    d=json.loads(path.read_text());key=d['key'];cat=d['category'];gid=d['gameId']
    if not(cat in ('normal','special','super') or key in ('idle','midare')): continue
    meta=d['clip'].setdefault('meta',{})
    if meta.get('flowEdition')==4: continue
    b=d['binding'];s=b['startup'];a=b['active'];end=s+a;total=d['clip']['duration'];tracks=d['clip']['tracks'];kind=meta.get('kind')
    meta.update(flowEdition=4,visualRevision='mai-flower-flame-1',secondaryBeats=[])
    if key=='idle':
        tracks['fan']=track([(0,.91,'spline'),(30,.84,'spline'),(60,.94,'spline'),(90,.87,'spline'),(total,.91,'spline')])
        tracks['fanAngle']=track([(0,-9,'spline'),(30,-6,'spline'),(60,-10,'spline'),(90,-12,'spline'),(total,-9,'spline')])
    else:
        # Preserve every original key's value. Bounded tangents ease velocity
        # changes without overshooting authored positions or hit reach.
        for channel,keys in tracks.items():
            if channel in ('rootX','rootY','reachScale','reachFoot'): continue
            for k in keys:
                if k[2]=='linear': k[2]='spline'
        meta['secondaryBeats']=[dict(frame=s,amplitude=6 if cat=='normal' else 10),dict(frame=end,amplitude=-4 if cat=='normal' else -7)]
        if cat=='normal':
            if kind=='punch':
                tracks['fan']=track([(0,.88,'spline'),(max(1,s-3),.28,'load'),(s,1,'strike'),(end,.91,'spline'),(min(total-1,end+6),.6,'spline'),(total,.92,'spline')])
                tracks['fanAngle']=track([(0,-9,'spline'),(max(1,s-3),-26,'load'),(s,14,'strike'),(end,22,'spline'),(min(total-1,end+6),-13,'spline'),(total,-9,'spline')])
            d['fx']=[effect('fan-ink' if kind=='punch' else 'silk-cut',s,a,'fan' if kind=='punch' else 'crescent','fanTip' if kind=='punch' else 'frontFoot',color=SILK,width=3.2,scale=.8,opacity=.38,count=4,species='fleck',speed=1.7,size=1.2,life=15,gravity=.025,curl=.6,trail=4)]
        elif gid.startswith('kachosen_'):
            d['fx']=[effect('fan-release',s,max(3,a),'fan','fanTip',color=SILK,width=6,opacity=.5,count=8,species='fleck',speed=2.4,life=20,gravity=.02,curl=2,trail=5)]
            if gid.endswith('_3'): d['fx'].append(effect('od-release',s,a+2,'silk','frontHand',color=GOLD,width=4,opacity=.5,count=9,layer='back',trail=5))
        elif gid.startswith('hissatsu_'):
            tracks['fan']=track([(0,.92,'spline'),(max(1,s-4),.22,'load'),(s,1,'strike'),(end,1,'spline'),(min(total-1,end+8),.65,'spline'),(total,.92,'spline')])
            d['fx']=[effect('fan-flame',s,a,'flame','fanTip',width=15,opacity=.7,trail=11,count=28,speed=3.2),effect('fan-silk',s+2,max(3,a-2),'fan','frontHand',width=5,color=SILK,opacity=.48,trail=9,layer='back',count=7,species='petal',gravity=.035,speed=1.7,life=35,curl=3,size=2.7)]
        elif gid.startswith('ryuenbu_'):
            d['fx']=[effect('rising-leg',s,a,'flame','frontFoot',width=14,opacity=.74,rotation=-75,trail=9,count=29,speed=3.2),effect('rising-wake',s+3,max(3,a-3),'silk','rearFoot',width=4,color=GOLD,opacity=.45,rotation=-110,trail=12,layer='back',count=8,speed=1.8,life=32)]
        elif gid.startswith('shinobibachi_'):
            d['fx']=[effect('elbow-comet',s,a,'flame','frontElbow',width=17,opacity=.72,trail=12,count=25,speed=4.5),effect('flip-silk',max(0,s-7),7,'silk','rearFoot',color=SILK,width=4,opacity=.48,rotation=-25,trail=7,layer='back',count=5,species='fleck',speed=2,life=18,gravity=.025,curl=1)]
        elif gid.startswith('musabi_'):
            d['fx']=[effect('flying-wake',s,a,'flame','frontElbow',width=12,opacity=.65,rotation=35,trail=12,count=21,speed=3),effect('flying-silk',s+2,max(3,a-2),'silk','rearFoot',color=SILK,width=3.6,opacity=.48,rotation=45,trail=10,layer='back',count=6,species='fleck',gravity=.015)]
        elif gid=='SA1':
            d['fx']=[effect('left-kagerou',s,a,'pillar','rearFoot',scale=.78,width=13,opacity=.62,rotation=-95,layer='back',count=31,speed=2.4,life=38),effect('right-kagerou',s+3,a-3,'pillar','frontFoot',scale=.65,width=11,opacity=.45,rotation=-80,count=22,speed=2.8,life=35),effect('kagerou-fan',s+1,a-2,'fan','fanTip',width=7,color=GOLD,opacity=.48,trail=12,count=9,species='petal',gravity=.03,curl=3,life=39)]
            meta['secondaryBeats']=[dict(frame=s+round(i*a/5),amplitude=7 if i%2==0 else -5) for i in range(5)]
        elif gid=='SA2':
            d['fx']=[effect('super-elbow-comet',s,a,'flame','frontElbow',width=22,opacity=.75,trail=16,count=42,speed=4.5,life=34),effect('super-elbow-silk',s+2,a-2,'streak','rearHand',width=8,color=GOLD,opacity=.4,trail=14,layer='back',count=17,speed=3.3,life=29)]
            meta['secondaryBeats']=[dict(frame=s+round(i*a/5),amplitude=8 if i%2==0 else -6) for i in range(5)]
        elif gid in ('SA3','CA'):
            d['fx']=[]
            for i in range(8):
                at=s+math.ceil(i*a/8);last=i==7
                d['fx'].append(effect('sakura-sweep-'+str(i+1),at,min(12,end-at),'flame' if last else 'fan','fanTip',width=21 if last else 9+(i%2)*2,color=FIRE if last or i%2==0 else GOLD,opacity=.8 if last else .56,trail=13 if last else 8,layer='front' if i%2==0 or last else 'back',count=19 if last else 7,speed=3.8 if last else 2.4,life=34 if last else 23))
                if i in (1,3,5,7):d['fx'].append(effect('sakura-petals-'+str(i+1),at,7,'silk','rearHand',width=3.5,color=PETAL,opacity=.4,trail=6,layer='back',count=11 if last else 5,species='petal',gravity=.035,curl=4,speed=2.5,life=42,size=3.4))
            meta['secondaryBeats']=[dict(frame=s+math.ceil(i*a/8),amplitude=(12 if i==7 else 7)*(-1 if i%2 else 1)) for i in range(8)]
            # Fan opens into every sweep, then folds slightly for the return.
            keys=[(0,.92,'spline'),(s-4,.35,'load')]
            for i in range(8):
                at=s+math.ceil(i*a/8);keys.extend([(at,1,'strike'),(min(at+6,end-1),.62 if i<7 else 1,'spline')])
            keys.extend([(end,.92,'spline'),(total,.92,'spline')]);tracks['fan']=track(sorted({k[0]:k for k in keys}.values()))
        elif key=='midare':
            d['fx']=[effect('midare-fan',s,a,'fan','fanTip',width=8,color=SILK,opacity=.6,trail=7,count=9,species='petal',gravity=.035,curl=3,life=33)]
    meta['visualNote']='FLOW 04：折扇开合、饰物惯性、分层轨迹。装饰节拍不生成命中；世界位移与伤害仍由战斗引擎决定。'
    path.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n');changed.append(key)
print(json.dumps({'changed':len(changed),'assets':changed},ensure_ascii=False,indent=2))
