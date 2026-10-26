#!/usr/bin/env python3
"""FLOW5 verification, sequential by design to avoid concurrent-browser pressure.
--report-only aggregates saved evidence; it does not execute the tests.
--require-soak requires 20 real minutes on the exact current HTML bytes.
"""
from pathlib import Path
import argparse, datetime, hashlib, json, os, subprocess, sys
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'qa/flow5'
os.environ['PYTHONUTF8']='1'
os.environ['PYTHONIOENCODING']='utf-8'

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def load(path):
    return json.loads(path.read_text(encoding='utf-8'))

def aggregate(require_soak=False):
    version=load(ROOT/'VERSION.json')
    assert version['version']=='5.0.0', 'Unexpected release identity'
    artifacts={name:{'bytes':(ROOT/'dist'/name).stat().st_size,'sha256':digest(ROOT/'dist'/name)}
               for name in ['INK-Street-Fighter-6.html','INK-Street-Fighter-6-Player.html']}
    current=artifacts['INK-Street-Fighter-6.html']['sha256']
    suites={}
    for name in ['core','browser','compatibility','socket-matrix','rhythm-matrix','portability','dual-actor','regression','extra-regression','source-audit']:
        path=OUT/(name+'.json')
        assert path.is_file(), 'Missing report: '+name
        report=load(path)
        assert report.get('htmlSha256')==current, 'Stale build evidence: '+name
        good=report.get('passed') is True if 'total' not in report else report['passed']==report['total']
        assert good, 'Failing report: '+name
        assert not report.get('browserErrors') and not report.get('errors'), 'Browser errors: '+name
        suites[name]={'passed':report['passed'],'total':report.get('total'),
                      'report':str(path.relative_to(ROOT)).replace('\\','/'),'sha256':digest(path)}
    soak={'status':'not-included','matchesCurrentBuild':False}
    path=OUT/'endurance.json'
    if path.exists():
        report=load(path)
        soak={k:report.get(k) for k in ['status','requestedWallSeconds','elapsedWallSeconds','completedRoutes','startedAt','finishedAt']}
        soak.update(matchesCurrentBuild=report.get('htmlSha256')==current,
                    report='qa/flow5/endurance.json',sha256=digest(path))
        soak['errors']=report.get('browserErrors',[])+report.get('final',{}).get('errors',[])
    if require_soak:
        assert soak['matchesCurrentBuild'] and soak['status']=='passed' and soak.get('elapsedWallSeconds',0)>=1200 and not soak.get('errors'), 'A passing current-build 1200-second continuous run is required'
    benchmark=None
    path=OUT/'benchmark.json'
    if path.exists():
        report=load(path)
        assert report['htmlSha256']==current, 'Stale sampler benchmark'
        benchmark={k:report[k] for k in ['samplesPerRun','repetitions','legacyMedianMs','compiledMedianMs','ratio','limitations']}
    baseline=version['sourceBaseline']
    assert digest(ROOT/baseline['archivedAt'])==baseline['gameSha256'], 'Historical source archive changed'
    assert digest(ROOT/'game.js')!=baseline['gameSha256'], 'Expected genuine integrated game source'
    assert (ROOT/'game.js').read_bytes()==(ROOT/'dist/game-forge.js').read_bytes(), 'Build source is not a direct copy'
    summary={'version':version['version'],'assembledAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
             'evidenceMode':'hash-checked saved reports; see each report for execution details',
             'suites':suites,'artifacts':artifacts,'endurance':soak,'samplerBenchmark':benchmark,
             'gameSha256':digest(ROOT/'game.js'),'legacySha256':baseline['gameSha256'],
             'nativeFileProtocol':load(OUT/'file-protocol.json'),
             'limits':{'worldParticles':320,'localParticles':144,'worldRibbonStreams':64,'pointsPerRibbon':64,'rootHistory':40,'socketCache':2048,'lifecycleLog':256},
             'failedAndInterruptedAttempts':[p.name for p in sorted(OUT.glob('endurance-*concurrent.json'))]+[p.name for p in sorted(OUT.glob('endurance-pre-freeze.json'))],
             'limitations':['Native file:// is blocked by the test environment; complete HTML byte loading is not filesystem permission verification.',
                            'Storage handle tests use doubles; mobile tests use emulation, not physical-device performance.',
                            'Support-foot correction is bounded and may leave drift at unreachable targets.',
                            'Spring chains are simplified angular dynamics, not collision-aware cloth.',
                            'Node sampler timing is not SVG/GPU frame rate.',
                            'Historical qa/flow4 evidence is not included as a current-build pass.']}
    OUT.mkdir(parents=True,exist_ok=True)
    (OUT/'validation.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(summary,ensure_ascii=False,indent=2),flush=True)
    return summary

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--report-only',action='store_true')
    parser.add_argument('--soak-seconds',type=int,default=0)
    parser.add_argument('--require-soak',action='store_true')
    args=parser.parse_args()
    if args.report_only and args.soak_seconds:
        parser.error('--report-only does not run a soak; omit --soak-seconds')
    if args.soak_seconds and not 10<=args.soak_seconds<=7200:
        parser.error('--soak-seconds must be 10..7200')
    if not args.report_only:
        commands=[[sys.executable,'tools/build_forge.py'],['node','tests/flow5/core.test.js'],
                  [sys.executable,'tests/flow5/source_audit.py'],[sys.executable,'tests/flow5/browser.py'],
                  [sys.executable,'tests/flow5/compatibility.py'],[sys.executable,'tests/flow5/rhythm_matrix.py'],
                  [sys.executable,'tests/flow5/portability.py'],[sys.executable,'tests/flow5/dual_actor.py'],[sys.executable,'tests/flow5/regression.py'],
                  [sys.executable,'tests/flow5/extra_regression.py'],['node','tests/flow5/benchmark.js']]
        if args.soak_seconds:
            commands.append([sys.executable,'tests/flow5/endurance.py','--seconds',str(args.soak_seconds)])
        for command in commands:
            print('\n=== '+' '.join(command)+' ===',flush=True)
            subprocess.run(command,cwd=ROOT,check=True,env=os.environ.copy())
    aggregate(args.require_soak)
