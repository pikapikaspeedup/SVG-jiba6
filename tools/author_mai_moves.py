#!/usr/bin/env python3
"""Author Mai's native SVG choreography. No images or generated hit flashes.

The existing bindings stay intact. New command normals/target-combo actions
receive their own clips; roots and contacts remain simulation-owned.
"""
from pathlib import Path
from copy import deepcopy
import json
import math

ROOT = Path(__file__).resolve().parents[1]
DIR = ROOT / 'assets/ink/characters/mai/moves'
REST = dict(lean=-6, bob=0, head=3, chest=0, pelvis=0, yaw=0,
            chestYaw=0, pelvisYaw=0, headYaw=0, spin=0, turn=0, depth=1,
            floor=0, rootShift=0, open=1, fan=.92, fanAngle=-9,
            ffoot=0, rfoot=0, reachScale=1, reachFoot=0,
            frontArmProjection=1, rearArmProjection=1,
            frontLegProjection=1, rearLegProjection=1,
            rw=[-23, -285], fw=[113, -313], ra=[-104, -16], fa=[82, -16])


def pose(**values):
    return {**deepcopy(REST), **values}


def fx(name, start, length, kind, socket, width=8, layer='front', count=8):
    return dict(id=name, frame=round(start), duration=max(1, min(120, round(length))),
                type=kind, socket=socket, scale=1, color='#f58b56', rotation=0,
                opacity=.66, width=width, trailFrames=8, layer=layer,
                particles=dict(count=count, life=26, speed=2.4, size=1.6,
                               spread=80, species='ember' if kind in ('flame', 'pillar') else 'fleck',
                               gravity=-.06, drag=.04, curl=1.4, spacing=16,
                               rate=.12, burst=2, inheritVelocity=.2))


written = []


def author(key, frames, family, effects=None, support=False, label=None):
    path = DIR / (key + '.json')
    rec = json.loads(path.read_text())
    s, a, r = (rec['binding'][k] for k in ('startup', 'active', 'recovery'))
    total = s + a + r
    # Each phase has its own authored timing. Fractional keys are retained.
    mapped = []
    for phase, u, values, curve in frames:
        t = s * u if phase == 's' else s + a * u if phase == 'a' else s + a + r * u
        mapped.append((round(t, 4), pose(**values), curve))
    mapped = sorted({t: (t, p, c) for t, p, c in mapped}.values())
    rec['clip']['tracks'] = {k: [[t, p[k], c] for t, p, c in mapped] for k in REST}
    meta = rec['clip'].setdefault('meta', {})
    meta['maiChoreography'] = dict(version=1, family=family,
                                 description=label or rec['name'],
                                 source='Capcom Mai character guide / SVG interpretation',
                                 rootOwner='combat', contactOwner='combat')
    if family in ('fan', 'elbow', 'kick', 'air-grab', 'air-throw-wrap'):
        meta['kind'] = 'throw' if family.startswith('air-') else 'kick' if family == 'kick' else 'punch'
    meta['secondaryBeats'] = [dict(frame=s, amplitude=6), dict(frame=s+a, amplitude=-4)]
    meta['motion5'] = dict(version=1, weightScale=1, layers=[],
                          contacts=[dict(id='rear-plant', socket='rearFoot', start=0,
                                         end=max(4, min(total-3, s+a)), fadeIn=1,
                                         fadeOut=2, strength=.9, maxCorrection=24)] if support else [],
                          springs=dict(frequency=.36 if rec['category']=='normal' else .3,
                                       damping=.64, hairStrength=1.15, clothStrength=1.05))
    rec['fx'] = effects(s, a, r) if effects else []
    rec['clip']['meta']['visualRevision'] = 'mai-native-choreography-2026-10'
    path.write_text(json.dumps(rec, ensure_ascii=False, indent=2) + '\n')
    written.append(key)


def normal(key, wind, contact, recoil=None, family='fan', support=True, extra=None):
    recoil = recoil or wind
    frames = [('s', 0, {}, 'spline'), ('s', .56, wind, 'spline'),
              ('s', .8, wind, 'load'), ('a', 0, contact, 'strike'),
              ('a', .55, {**contact, 'chest': contact.get('chest', 0)+2}, 'spline'),
              ('a', 1, contact, 'spline'), ('r', .24, recoil, 'spline'),
              ('r', .68, {**wind, 'lean': -5, 'chest': 0, 'pelvis': 0}, 'spline'),
              ('r', 1, {}, 'spline')]
    if extra:
        frames = extra
    author(key, frames, family,
           lambda s,a,r: [fx('weapon-release', s, a+2, 'fan' if family=='fan' else 'crescent',
                             'fanTip' if family=='fan' else 'frontElbow' if family=='elbow' else 'frontFoot',
                             2.5, count=2)] if family != 'air-grab' else [], support)


# All eighteen buttons have distinct load, contact and recovery silhouettes.
normal('sLP', dict(fw=[58,-298], fan=.08, lean=-9),
       dict(fw=[153,-290], rw=[-18,-308], fan=.08, fanAngle=-22, lean=5, chest=4),
       dict(fw=[73,-291], rw=[-23,-304], fan=.08))
normal('sMP', dict(fw=[43,-308], fan=.12, fanAngle=-25, chest=-7, pelvis=3),
       dict(fw=[165,-285], rw=[-30,-312], fan=.2, fanAngle=-15, lean=7, chest=9, pelvis=-3),
       dict(fw=[102,-286], fan=.18, chest=-3))
normal('sHP', dict(fw=[25,-350], rw=[-64,-272], fan=.55, yaw=-28, chest=-13, pelvis=7),
       dict(fw=[158,-254], rw=[-64,-312], fan=1, fanAngle=38, yaw=22, lean=15, chest=14, pelvis=-6),
       dict(fw=[122,-266], fan=.7, fanAngle=60, yaw=37, lean=9))
normal('sLK', dict(fa=[69,-77], fw=[101,-323], lean=-9),
       dict(fa=[165,-82], ra=[-88,-16], fw=[90,-327], rw=[-47,-285], lean=-10, ffoot=56),
       dict(fa=[82,-104], fw=[102,-318], lean=-8), 'kick')
normal('sMK', dict(fa=[63,-152], ra=[-82,-16], fw=[83,-330], chest=-8),
       dict(fa=[215,-171], ra=[-79,-16], fw=[66,-330], rw=[-103,-261], lean=-21, chest=-12, ffoot=72),
       dict(fa=[85,-155], ra=[-82,-16], fw=[80,-324], lean=-16), 'kick')
normal('sHK', dict(fa=[58,-210], ra=[-85,-16], fw=[69,-319], yaw=-34, pelvis=-12),
       dict(fa=[173,-282], ra=[-75,-16], fw=[58,-317], rw=[-93,-275], yaw=98, chest=-15, lean=-21, ffoot=72),
       dict(fa=[75,-176], ra=[-85,-16], fw=[80,-319], yaw=185, lean=-14), 'kick', False)
normal('cLP', dict(bob=57, fw=[55,-265], rw=[-40,-250], fa=[96,-16], ra=[-92,-16], fan=.09),
       dict(bob=59, fw=[153,-251], rw=[-28,-267], fa=[97,-16], ra=[-92,-16], fan=.1, lean=10),
       dict(bob=57, fw=[75,-263], fa=[96,-16], ra=[-92,-16], fan=.1), support=False)
normal('cMP', dict(bob=57, fw=[50,-283], rw=[-76,-252], fa=[98,-16], ra=[-95,-16], yaw=-24, fan=.13),
       dict(bob=52, fw=[26,-281], rw=[-91,-263], fa=[105,-16], ra=[-94,-16], yaw=68, chest=16, lean=7, fan=.1),
       dict(bob=55, fw=[65,-284], rw=[-64,-263], fa=[98,-16], ra=[-95,-16], yaw=36, fan=.13), 'elbow', False)
normal('cHP', dict(bob=62, fw=[51,-244], rw=[-70,-263], fa=[91,-16], ra=[-95,-16], fan=.4, yaw=-26),
       dict(bob=38, fw=[137,-351], rw=[-71,-242], fa=[109,-16], ra=[-96,-16], fan=1, fanAngle=-55, yaw=30, lean=-8),
       dict(bob=48, fw=[107,-304], rw=[-59,-254], fa=[102,-16], ra=[-96,-16], fan=.7, yaw=48), support=False)
normal('cLK', dict(bob=72, fa=[88,-24], ra=[-71,-16], fw=[100,-262], rw=[-45,-252]),
       dict(bob=73, fa=[168,-24], ra=[-68,-16], fw=[94,-265], rw=[-49,-249], lean=-9, ffoot=38),
       dict(bob=72, fa=[105,-38], ra=[-71,-16], fw=[100,-262]), 'kick', False)
normal('cMK', dict(bob=63, fa=[96,-49], ra=[-77,-16], fw=[99,-286], rw=[-44,-256], chest=-8),
       dict(bob=68, fa=[222,-28], ra=[-72,-16], fw=[83,-279], rw=[-76,-247], lean=-15, ffoot=67, pelvis=-8),
       dict(bob=65, fa=[115,-50], ra=[-76,-16], fw=[95,-278], lean=-11), 'kick', False)
normal('cHK', dict(bob=65, fa=[80,-49], ra=[-72,-16], fw=[67,-280], yaw=-38),
       dict(bob=69, fa=[226,-28], ra=[-64,-16], fw=[55,-283], rw=[-112,-230], yaw=83, lean=-11, ffoot=79),
       dict(bob=65, fa=[88,-50], ra=[-73,-16], fw=[91,-277], yaw=180), 'kick', False)
normal('aLP', dict(fw=[63,-294], rw=[-27,-285], fa=[74,-117], ra=[-69,-108], fan=.12),
       dict(fw=[153,-271], rw=[-31,-294], fa=[94,-121], ra=[-77,-120], fan=.12, lean=11, fanAngle=10),
       dict(fw=[84,-291], fa=[81,-120], ra=[-73,-112], fan=.2), support=False)
normal('aMP', dict(fw=[62,-322], rw=[-61,-283], fa=[72,-139], ra=[-83,-127], fan=.4, yaw=-22),
       dict(fw=[143,-344], rw=[-88,-266], fa=[104,-134], ra=[-86,-145], fan=.86, fanAngle=-41, yaw=22, lean=-7),
       dict(fw=[106,-321], fa=[80,-142], ra=[-82,-128], fan=.48), support=False)
normal('aHP', dict(fw=[44,-360], rw=[-73,-298], fa=[66,-163], ra=[-70,-143], fan=.15, chest=-13),
       dict(fw=[119,-225], rw=[-76,-314], fa=[120,-140], ra=[-84,-130], fan=.17, fanAngle=63, lean=25, chest=14),
       dict(fw=[95,-279], fa=[81,-150], ra=[-77,-137], fan=.25, lean=13), support=False)
normal('aLK', dict(fa=[73,-164], ra=[-73,-148], fw=[84,-319], yaw=-9),
       dict(fa=[164,-116], ra=[-114,-137], fw=[85,-323], rw=[-75,-277], lean=-11, ffoot=50),
       dict(fa=[89,-153], ra=[-87,-147], fw=[96,-318]), 'kick', False)
normal('aMK', dict(fa=[65,-174], ra=[-93,-162], fw=[87,-323], chest=-7),
       dict(fa=[204,-169], ra=[-115,-139], fw=[81,-332], rw=[-104,-264], lean=-18, ffoot=73, yaw=20),
       dict(fa=[100,-151], ra=[-96,-143], fw=[94,-319], lean=-9), 'kick', False)
normal('aHK', dict(fa=[65,-194], ra=[-89,-151], fw=[75,-320], yaw=-39, pelvis=-9),
       dict(fa=[202,-248], ra=[-111,-150], fw=[55,-324], rw=[-106,-271], yaw=48, lean=-25, ffoot=77),
       dict(fa=[87,-174], ra=[-91,-143], fw=[85,-320], yaw=112, lean=-13), 'kick', False)


for strength, suffix in enumerate(('light','medium','heavy','od')):
    power = (0, .12, .24, .3)[strength]
    # Fan cast: display the fan during loading, release from the actual wrist,
    # keep the throwing hand empty, then retrieve into guard.
    author('kachousen-'+suffix, [
        ('s',0,{},'spline'), ('s',.36,dict(fw=[30,-289], rw=[-58,-291], fan=1, fanAngle=-35, lean=-13, chest=-10),'spline'),
        ('s',.72,dict(fw=[44,-323], rw=[-58,-285], fan=1, fanAngle=-58, chest=-15, pelvis=7, lean=-16),'load'),
        ('a',0,dict(fw=[162,-281], rw=[-73,-288], fan=0, lean=13, chest=12, pelvis=-5, ra=[-123,-16], fa=[108,-16]),'strike'),
        ('a',1,dict(fw=[146,-275], rw=[-65,-301], fan=0, lean=10, chest=7, ra=[-123,-16], fa=[108,-16]),'spline'),
        ('r',.3,dict(fw=[111,-281], rw=[-41,-299], fan=0, lean=4),'spline'),
        ('r',.67,dict(fw=[100,-310], fan=.18, fanAngle=-25, lean=-5),'spline'), ('r',1,{},'spline')],
        'fan-cast', lambda s,a,r:[fx('fan-release',s,a,'fan','fanTip',5,count=3)], True)

    # A full axial turn uses unturned arm targets. No duplicate whole-body spin.
    author('ryuuenbu-'+suffix, [
        ('s',0,{},'spline'), ('s',.56,dict(fw=[42,-322], rw=[-63,-277], fan=.24, fanAngle=-44, yaw=-28, chest=-12, pelvis=7, bob=8),'load'),
        ('a',0,dict(fw=[156,-282], rw=[-72,-288], fan=1, fanAngle=8, yaw=14, lean=8, chest=12, fa=[112,-16],ra=[-108,-16]),'strike'),
        ('a',.28,dict(fw=[149,-306], rw=[-66,-275], fan=1, fanAngle=-7, yaw=110, lean=3, chest=7, fa=[112,-16],ra=[-104,-16]),'spline'),
        ('a',.64,dict(fw=[153,-279], rw=[-70,-293], fan=1, fanAngle=16, yaw=245, lean=7, chest=8, fa=[108,-16],ra=[-110,-16]),'spline'),
        ('a',1,dict(fw=[145,-274], rw=[-58,-299], fan=1, fanAngle=29, yaw=350, lean=4, fa=[104,-16],ra=[-112,-16]),'spline'),
        ('r',.35,dict(fw=[88,-302], fan=.45, fanAngle=-32, yaw=360, chest=-5),'spline'),
        ('r',1,dict(yaw=360),'spline')], 'flame-wheel',
        lambda s,a,r:[fx('fan-fire-sheet',s,a,'flame','fanTip',18+power*12,count=22),fx('turning-silk',s+2,a-2,'silk','rearHand',4,'back',5)], False)

    # Knee chamber, rising kick and a genuine backflip through the recovery.
    author('hishou-ryuuenjin-'+suffix, [
        ('s',0,{},'spline'), ('s',.52,dict(bob=23,lean=8,fa=[77,-110],fw=[83,-315],rw=[-45,-283],fan=.08),'load'),
        ('a',0,dict(lean=-28,fa=[126,-321],ra=[-64,-94],fw=[64,-291],rw=[-68,-289],fan=0,ffoot=78),'strike'),
        ('a',.25,dict(lean=-12,fa=[84,-374],ra=[-80,-151],fw=[54,-306],rw=[-63,-291],fan=0,spin=-32,ffoot=82),'spline'),
        ('a',.59,dict(fa=[124,-304],ra=[-65,-212],fw=[62,-301],rw=[-56,-291],fan=0,spin=-167,ffoot=46),'spline'),
        ('a',1,dict(fa=[79,-151],ra=[-61,-110],fw=[78,-314],rw=[-38,-281],fan=.08,spin=-314),'spline'),
        ('r',.28,dict(fa=[85,-93],ra=[-88,-49],fw=[90,-313],fan=.3,spin=-360,bob=8),'spline'),
        ('r',.65,dict(spin=-360,bob=10,fa=[90,-16],ra=[-99,-16],fan=.7),'spline'),
        ('r',1,dict(spin=-360),'spline')], 'rising-backflip',
        lambda s,a,r:[fx('rising-fire',s,a,'flame','frontFoot',19,'front',22),fx('heel-wake',s+2,a-2,'silk','rearFoot',4,'back',4)])

    author('hissatsu-shinobi-bachi-'+suffix, [
        ('s',0,{},'spline'), ('s',.22,dict(bob=17,fw=[62,-280],fan=.05,lean=5),'load'),
        ('s',.5,dict(fw=[78,-377],rw=[-46,-357],fa=[121,-230],ra=[-84,-239],fan=0,spin=-96,bob=0),'spline'),
        ('s',.79,dict(fw=[68,-326],rw=[-45,-304],fa=[129,-198],ra=[-105,-172],fan=0,spin=-276,bob=0),'spline'),
        ('a',0,dict(lean=42,fw=[2,-345],rw=[-105,-172],fa=[45,-125],ra=[-159,-157],fan=0,spin=-360,floor=-18),'strike'),
        ('a',.5,dict(lean=46,fw=[0,-346],rw=[-112,-176],fa=[39,-128],ra=[-165,-159],fan=0,spin=-360,floor=-19, chest=7),'spline'),
        ('a',1,dict(lean=30,fw=[12,-339],rw=[-106,-193],fa=[75,-79],ra=[-139,-110],fan=0,spin=-360,floor=-6),'spline'),
        ('r',.25,dict(lean=12,bob=19,fa=[112,-16],ra=[-98,-16],fw=[83,-300],fan=.12,spin=-360),'spline'),
        ('r',.62,dict(spin=-360,fw=[103,-313],fan=.65),'spline'),('r',1,dict(spin=-360),'spline')],
        'elbow-comet',lambda s,a,r:[fx('elbow-fire',s,a,'flame','frontElbow',21,'front',20),fx('cartwheel-wind',max(0,s-6),6,'silk','rearFoot',4,'back',3)])

    author('musasabi-no-mai-'+suffix, [
        ('s',0,dict(fa=[84,-149],ra=[-84,-143],fan=.08),'spline'),
        ('s',.43,dict(lean=-12,fw=[54,-324],rw=[-49,-321],fa=[70,-227],ra=[-64,-232],fan=0,bob=4),'load'),
        ('s',.78,dict(lean=21,fw=[48,-333],rw=[-83,-279],fa=[112,-132],ra=[-109,-167],fan=0,bob=10),'spline'),
        ('a',0,dict(lean=55,fw=[-5,-345],rw=[-111,-178],fa=[47,-128],ra=[-162,-165],fan=0,chest=7),'strike'),
        ('a',.6,dict(lean=59,fw=[-8,-343],rw=[-116,-181],fa=[43,-123],ra=[-165,-159],fan=0,chest=9),'spline'),
        ('a',1,dict(lean=37,fw=[12,-329],rw=[-107,-205],fa=[76,-75],ra=[-129,-102],fan=0),'spline'),
        ('r',.35,dict(lean=16,bob=15,fw=[88,-301],fan=.25),'spline'),('r',1,{},'spline')],
        'diagonal-body-dive',lambda s,a,r:[fx('body-dive-fire',s,a,'flame','frontElbow',17,'front',17),fx('body-dive-wind',s,a,'silk','rearFoot',4,'back',4)])


author('kagerou-no-mai', [
    ('s',0,{},'spline'),('s',.42,dict(bob=20,fw=[14,-267],rw=[-25,-266],fa=[77,-16],ra=[-76,-16],fan=.05),'load'),
    ('s',.8,dict(bob=6,fw=[48,-356],rw=[-49,-345],fan=.1,lean=-5),'spline'),
    ('a',0,dict(lean=-8,head=-9,fw=[60,-399],rw=[-64,-385],fa=[84,-16],ra=[-79,-16],fan=.12,chest=-6),'strike'),
    ('a',.25,dict(lean=-7,fw=[88,-366],rw=[-91,-351],fan=1,fanAngle=-32),'spline'),
    ('a',.63,dict(lean=1,fw=[126,-310],rw=[-103,-299],fan=1,fanAngle=25,chest=8),'spline'),
    ('a',1,dict(lean=-3,fw=[104,-293],rw=[-58,-293],fan=1),'spline'),
    ('r',.37,dict(fw=[97,-300],rw=[-31,-286],fan=.7,chest=-3),'spline'),('r',1,{},'spline')],
    'flame-pillars',lambda s,a,r:[fx('kagerou-rear',s,a,'pillar','rearFoot',22,'back',24),fx('kagerou-front',s+2,a-2,'pillar','frontFoot',19,'front',22)])

author('chou-hissatsu-shinobi-bachi', [
    ('s',0,{},'spline'),('s',.36,dict(bob=18,fw=[53,-285],fan=0),'load'),
    ('s',.75,dict(spin=-264,fw=[62,-355],rw=[-43,-330],fa=[129,-224],ra=[-111,-164],fan=0),'spline'),
    ('a',0,dict(spin=-360,lean=46,fw=[0,-346],rw=[-112,-176],fa=[43,-130],ra=[-164,-162],fan=0,floor=-23),'strike'),
    ('a',.46,dict(spin=-360,lean=49,fw=[-3,-347],rw=[-118,-180],fa=[38,-135],ra=[-170,-165],fan=0,floor=-25,chest=8),'spline'),
    ('a',.85,dict(spin=-360,lean=46,fw=[0,-346],rw=[-114,-179],fa=[43,-130],ra=[-162,-155],fan=0,floor=-20),'spline'),
    ('a',1,dict(spin=-360,lean=26,fw=[65,-326],fa=[124,-46],ra=[-98,-68],fan=0,floor=-8),'spline'),
    ('r',.32,dict(spin=-360,bob=16,fw=[87,-303],fan=.16),'spline'),('r',1,dict(spin=-360),'spline')],
    'super-elbow-comet',lambda s,a,r:[fx('super-fire-wake',s,a,'flame','frontElbow',29,'front',30),fx('super-wind',s,a,'streak','rearHand',8,'back',7)])

for key in ('enbu-ada-zakura','enbu-ada-zakura-ca'):
    frames=[('s',0,{},'spline'),('s',.5,dict(fw=[34,-316],rw=[-47,-284],fan=.22,yaw=-22,chest=-11),'load')]
    cuts=[dict(fw=[160,-283],rw=[-73,-302],lean=14,yaw=8,fan=1,fanAngle=12),
          dict(fw=[98,-368],rw=[-92,-265],lean=-9,yaw=73,fan=1,fanAngle=-42,fa=[88,-105]),
          dict(fw=[149,-269],rw=[-101,-312],lean=13,yaw=173,fan=1,fanAngle=49),
          dict(fw=[142,-333],rw=[-86,-278],lean=-4,yaw=280,fan=1,fanAngle=-31),
          dict(fw=[154,-254],rw=[-106,-310],lean=19,yaw=367,fan=1,fanAngle=48),
          dict(fw=[117,-368],rw=[-93,-261],lean=-18,yaw=409,fan=1,fanAngle=-43,fa=[118,-215],ra=[-78,-100],floor=-38),
          dict(fw=[149,-276],rw=[-82,-317],lean=14,yaw=526,fan=1,fanAngle=36,fa=[157,-110],ra=[-105,-140],floor=-21),
          dict(fw=[157,-253],rw=[-106,-318],lean=22 if key.endswith('-ca') else 16,yaw=716,fan=1,fanAngle=58,chest=15,fa=[129,-16],ra=[-117,-16])]
    for i,cut in enumerate(cuts):
        frames += [('a',i/8,cut,'strike'),('a',(i+.5)/8,{**cut,'fan':.6,'chest':-3},'spline')]
    frames += [('a',1,{**cuts[-1],'yaw':720,'chest':4},'spline'),('r',.28,dict(yaw=720,fw=[108,-271],fan=.5,fanAngle=32,lean=10),'spline'),('r',.68,dict(yaw=720,fw=[95,-314],fan=.8),'spline'),('r',1,dict(yaw=720),'spline')]
    author(key,frames,'sakura-critical' if key.endswith('-ca') else 'sakura-eight-cuts',
           lambda s,a,r:[fx('sakura-cut-'+str(i),s+math.ceil(i*a/8),min(11,a-math.ceil(i*a/8)),'flame' if i==7 else 'fan','fanTip',21 if i==7 else 8,'front' if i%2==0 else 'back',10 if i==7 else 3) for i in range(8)])


def create(key, gid, name, command, category, timing):
    source=json.loads((DIR/'sMP.json').read_text())
    s,a,r=timing
    source.update(key=key,gameId=gid,name=name,command=command,category=category)
    source['binding']=dict(startup=s,active=a,recovery=r,rootPolicy='combat',retimed=False)
    source['clip'].update(id='mai:'+key,name=name,command=command,duration=s+a+r,
                          phases=dict(startup=[0,s],active=[s,s+a],recovery=[s+a,s+a+r]))
    source['clip']['meta'].update(source='authored-mai-native',gameId=gid,legacyID=gid,
                                  note='原生 SVG 独立动作；根位移、资源和接触由战斗模拟负责。')
    source['clip']['tracks']={}
    source.pop('transitions',None)
    (DIR/(key+'.json')).write_text(json.dumps(source,ensure_ascii=False,indent=2)+'\n')


create('kachousen-od-held','@kachosen-od-held','OD 花蝶扇·蓄力双投','236[PP]','choreography',(12,6,21))
author('kachousen-od-held',[
    ('s',0,{},'spline'),('s',.36,dict(fw=[30,-289],rw=[-58,-291],fan=1,fanAngle=-35,lean=-13,chest=-10),'spline'),
    ('s',.72,dict(fw=[44,-323],rw=[-58,-285],fan=1,fanAngle=-58,chest=-15,pelvis=7,lean=-16),'load'),
    ('a',0,dict(fw=[162,-281],rw=[-73,-288],fan=0,lean=13,chest=12,pelvis=-5,ra=[-123,-16],fa=[108,-16]),'strike'),
    ('a',1,dict(fw=[146,-275],rw=[-65,-301],fan=0,lean=10,chest=7,ra=[-123,-16],fa=[108,-16]),'spline'),
    ('r',.2,dict(fw=[61,-312],rw=[-51,-290],fan=.65,fanAngle=-42,lean=-6,chest=-8),'spline'),
    ('r',.53,dict(fw=[35,-324],rw=[-66,-285],fan=1,fanAngle=-55,lean=-13,chest=-12,pelvis=5),'load'),
    ('r',2/3,dict(fw=[163,-282],rw=[-74,-290],fan=0,lean=14,chest=12,pelvis=-4,ra=[-123,-16],fa=[108,-16]),'strike'),
    ('r',.83,dict(fw=[135,-280],rw=[-54,-299],fan=0,lean=7,chest=5),'spline'),
    ('r',1,{},'spline')],'fan-double-cast',
    lambda s,a,r:[fx('held-fan-first',s,5,'fan','fanTip',5,count=3),fx('held-fan-second',s+20,5,'fan','fanTip',5,count=3)],True)
held_path=DIR/'kachousen-od-held.json'
held=json.loads(held_path.read_text())
held['clip']['meta']['maiChoreography']['releases']=[12,32]
held_path.write_text(json.dumps(held,ensure_ascii=False,indent=2)+'\n')


create('senkotsu-uchi','fMP','扇骨打','6MP','unique',(20,3,18))
normal('senkotsu-uchi',dict(fw=[62,-374],rw=[-54,-293],fan=.06,fanAngle=-55,lean=-12,chest=-12),
       dict(fw=[137,-257],rw=[-69,-306],fan=.07,fanAngle=67,lean=17,chest=14,fa=[111,-16],ra=[-113,-16]),
       dict(fw=[107,-275],fan=.13,fanAngle=46,lean=9),support=True)
create('hoshi-kujaku','bHK','星孔雀·一段','4HK','normal',(8,5,20))
normal('hoshi-kujaku',dict(fa=[66,-175],ra=[-84,-16],fw=[78,-325],yaw=-32),
       dict(fa=[165,-280],ra=[-78,-16],fw=[53,-318],rw=[-104,-267],lean=-23,yaw=54,ffoot=72),
       dict(fa=[83,-172],ra=[-84,-16],fw=[86,-316],lean=-13,yaw=85),'kick',False)
create('hien-renkyaku-2','hien2','飞燕连脚·二段','LK > LK','branch',(7,2,20))
normal('hien-renkyaku-2',dict(fa=[85,-127],ra=[-86,-16],fw=[90,-325],fan=.25),
       dict(fa=[170,-135],ra=[-81,-16],fw=[79,-329],rw=[-87,-271],lean=-14,ffoot=65,yaw=18),
       dict(fa=[89,-164],ra=[-83,-16],fw=[86,-321],fan=.25),'kick',False)
create('hien-renkyaku-3','hien3','飞燕连脚·三段','LK > LK > LK','branch',(10,3,28))
normal('hien-renkyaku-3',dict(fa=[83,-190],ra=[-86,-16],fw=[79,-327],fan=.12,yaw=-36),
       dict(fa=[174,-274],ra=[-93,-138],fw=[56,-322],rw=[-95,-267],lean=-21,ffoot=76,yaw=82,fan=.12),
       dict(fa=[77,-180],ra=[-74,-153],fw=[84,-317],yaw=239,fan=.25),'kick',False,
       [('s',0,{},'spline'),('s',.7,dict(fa=[83,-190],fw=[79,-327],fan=.12,yaw=-36),'load'),
        ('a',0,dict(fa=[174,-274],ra=[-93,-138],fw=[56,-322],rw=[-95,-267],lean=-21,ffoot=76,yaw=82,fan=.12),'strike'),
        ('a',1,dict(fa=[161,-252],ra=[-102,-151],fw=[61,-322],lean=-18,ffoot=67,yaw=125,fan=.12),'spline'),
        ('r',.35,dict(fa=[77,-180],ra=[-74,-153],fw=[84,-317],yaw=239,fan=.18),'spline'),
        ('r',.74,dict(fa=[89,-78],ra=[-87,-79],fw=[96,-316],yaw=360,fan=.5),'spline'),('r',1,dict(yaw=360),'spline')])
create('hoshi-kujaku-2','hoshi2','星孔雀·二段','4HK > HK','branch',(9,4,38))
normal('hoshi-kujaku-2',dict(fa=[66,-212],fw=[62,-320],fan=.18,yaw=80,lean=-12),
       dict(fa=[124,-365],ra=[-92,-130],fw=[51,-311],rw=[-91,-279],fan=.15,yaw=176,spin=-28,lean=-19,ffoot=80),
       dict(fa=[74,-176],ra=[-73,-153],fw=[82,-317],fan=.3,yaw=310,spin=-180),'kick',False,
       [('s',0,dict(fa=[83,-172],yaw=85),'spline'),('s',.6,dict(fa=[66,-212],fw=[62,-320],fan=.18,yaw=110),'load'),
        ('a',0,dict(fa=[124,-365],ra=[-92,-130],fw=[51,-311],rw=[-91,-279],fan=.15,yaw=176,lean=-19,ffoot=80),'strike'),
        ('a',1,dict(fa=[148,-310],ra=[-89,-169],fw=[65,-310],fan=.15,yaw=211,spin=-42),'spline'),
        ('r',.3,dict(fa=[76,-191],ra=[-71,-170],fw=[78,-312],fan=.18,yaw=300,spin=-213),'spline'),
        ('r',.6,dict(fa=[89,-91],ra=[-87,-53],fw=[94,-312],fan=.4,yaw=360,spin=-360),'spline'),
        ('r',1,dict(yaw=360,spin=-360),'spline')])
create('yume-zakura','airthrow','梦樱·空中投','空中 LP+LK','system',(5,3,24))
normal('yume-zakura',dict(fw=[75,-276],rw=[-22,-276],fa=[79,-155],ra=[-77,-151],fan=0),
       dict(fw=[139,-270],rw=[61,-272],fa=[94,-180],ra=[-90,-154],fan=0,lean=14),
       dict(fw=[85,-286],rw=[-13,-281],fa=[77,-162],ra=[-75,-156],fan=.16),family='air-grab',support=False)

create('state-throw-air-sequence','@throw-air-sequence','梦樱·空中抓握编排','空中 LP+LK','choreography',(18,13,21))
author('state-throw-air-sequence',[
    ('s',0,dict(fw=[124,-275],rw=[62,-274],fa=[82,-153],ra=[-78,-150],fan=0),'spline'),
    ('s',.5,dict(fw=[117,-279],rw=[52,-278],fa=[123,-243],ra=[-78,-180],fan=0,lean=-12,yaw=32),'spline'),
    ('a',0,dict(fw=[112,-282],rw=[38,-285],fa=[142,-270],ra=[-104,-229],fan=0,lean=-18,yaw=98),'spline'),
    ('a',.62,dict(fw=[126,-260],rw=[-28,-271],fa=[156,-177],ra=[-123,-209],fan=0,lean=12,yaw=196,spin=-38),'spline'),
    ('a',1,dict(fw=[116,-277],rw=[-77,-294],fa=[97,-129],ra=[-84,-132],fan=.12,yaw=310,spin=-18),'spline'),
    ('r',.45,dict(fw=[105,-306],fa=[89,-89],ra=[-87,-83],fan=.5,yaw=360),'spline'),
    ('r',1,dict(yaw=360),'spline')],'air-throw-wrap')

author('midare',[
    ('s',0,dict(fw=[101,-296],fan=.2),'spline'),
    ('s',.65,dict(fw=[29,-327],rw=[-65,-285],fan=1,fanAngle=-51,chest=-12,pelvis=5,lean=-12),'load'),
    ('a',0,dict(fw=[163,-278],rw=[-83,-295],fan=0,lean=17,chest=14,pelvis=-5,ra=[-123,-16],fa=[108,-16]),'strike'),
    ('a',.4,dict(fw=[149,-276],rw=[-72,-297],fan=0,lean=12,chest=8),'spline'),
    ('a',1,dict(fw=[124,-285],fan=0,lean=5),'spline'),
    ('r',.5,dict(fw=[100,-306],fan=.25),'spline'),('r',1,{},'spline')],
    'fan-follow',lambda s,a,r:[fx('follow-cast',s,a,'fan','fanTip',6,count=4)])

# These three moves are solved by the shared native body, which is authoritative
# for both SVG and collision. Update the actual data instead of hiding its output.
data_path=ROOT/'src/ink/strike-model-data.js'
text=data_path.read_text()
native={
    'mai:sMP':dict(family='closed-fan-thrust',polar=[[.39,25,-14],[.76,1,-9],[.92,0,0],[.85,7,11],[.45,29,15]],
                   fans=[.12,.12,.18,.15,.2],angles=[-25,-17,-12,-4,-18],twist=[-8,6,10,8,2]),
    'mai:sHP':dict(family='loaded-open-fan-downcut',polar=[[.46,-50,-36],[.67,-32,-26],[.95,9,0],[.85,31,31],[.49,46,23]],
                   fans=[.32,.75,1,.9,.42],angles=[-48,-22,35,63,15],twist=[-16,21,32,27,7]),
    'mai:cMK':dict(family='low-sandal-reap',polar=[[.56,48,-14],[.8,30,-12],[.96,24,0],[.88,29,17],[.6,52,17]],
                   fans=[.28,.4,.4,.4,.35],angles=[-15,0,0,0,15],twist=[-7,11,16,12,3])
}
for key,recipe in native.items():
    anchor='"'+key+'":'
    start=text.index(anchor)+len(anchor)
    row,used=json.JSONDecoder().raw_decode(text[start:])
    row['family']=recipe['family'];row['designRevision']='mai-native-choreography-2026-10'
    for i,node in enumerate(row['nodes'][:5]):
        node['targetPolar']=recipe['polar'][i];node['fan']=recipe['fans'][i]
        node['fanAngle']=recipe['angles'][i];node['body']['twist']=recipe['twist'][i]
    text=text[:start]+json.dumps(row,ensure_ascii=False,separators=(',',':'))+text[start+used:]
data_path.write_text(text)

manifest_path=ROOT/'assets/ink/project.json'
manifest=json.loads(manifest_path.read_text())
entry=next(c for c in manifest['characters'] if c['id']=='mai')
for key in written:
    if key not in entry['moves']:
        entry['moves'].append(key)
manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print('Authored',len(written),'native Mai clips')
