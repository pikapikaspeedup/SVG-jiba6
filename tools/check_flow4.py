#!/usr/bin/env python3
"""FLOW 04 verification. Build uses only stdlib; tests need Node + Playwright.
--report-only aggregates saved evidence and NEVER represents a new test run.
The 20-minute real-time soak is explicit, to avoid overwriting long-run evidence.
"""
from pathlib import Path
import argparse, datetime, hashlib, json, os, subprocess, sys
ROOT = Path(__file__).resolve().parents[1]
os.environ['PYTHONUTF8'] = '1'

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def aggregate(require_soak=False):
    output = ROOT / 'qa/flow4'
    version = json.loads((ROOT/'VERSION.json').read_text(encoding='utf-8'))
    artifacts = {n:{'bytes':(ROOT/'dist'/n).stat().st_size,'sha256':digest(ROOT/'dist'/n)}
                 for n in ['INK-Street-Fighter-6.html','INK-Street-Fighter-6-Player.html']}
    html_hash = artifacts['INK-Street-Fighter-6.html']['sha256']
    suites = {}
    for name in ['core','browser','rhythm-matrix','fan-matrix']:
        path = output / (name+'.json')
        data = json.loads(path.read_text(encoding='utf-8'))
        assert data['total'] == data['passed'], f'{name} suite failed'
        assert not data.get('browserErrors'), f'{name} browser errors'
        if name != 'core':
            assert data['htmlSha256'] == html_hash, 'Browser evidence is for an earlier HTML build'
        suites[name] = {'total':data['total'],'passed':data['passed'],
                        'report':str(path.relative_to(ROOT)), 'sha256':digest(path)}
    soak_path = output/'endurance.json'
    soak = {'status':'not-included','note':'No completed run for this build has been aggregated.'}
    if soak_path.exists():
        data = json.loads(soak_path.read_text(encoding='utf-8'))
        current = data.get('htmlSha256') == html_hash
        assert not data.get('browserErrors') and not data.get('final',{}).get('errors'), 'Endurance errors were recorded'
        soak = {'status':data.get('status'), 'matchesCurrentBuild':current,
                'elapsedWallSeconds':data.get('elapsedWallSeconds'),
                'requestedWallSeconds':data.get('requestedWallSeconds'),
                'completedRoutes':data.get('completedRoutes'),
                'report':'qa/flow4/endurance.json','sha256':digest(soak_path)}
        if require_soak:
            assert current and data['status']=='passed' and data['elapsedWallSeconds'] >= 1200, 'A current 20-minute soak is required'
    elif require_soak:
        raise AssertionError('Missing completed endurance report')
    baseline = digest(ROOT/'game.js') == version['sourceBaseline']['gameSha256']
    assert baseline, 'Combat baseline changed'
    summary = {'version':version['version'],'assembledAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'suites':suites,'artifacts':artifacts,'endurance':soak,'unchangedGameJs':baseline,
        'originalRegressionReport':'qa/flow/validation.json',
        'contractFixture':'tests/fixtures/flow3-combat-contracts.json',
        'limits':{'worldParticles':320,'localParticlesPerActor':144,'persistentTrailSegments':64,'rootHistoryFrames':40,'socketCacheEntries':2048},
        'fileProtocol':json.loads((output/'file-protocol.json').read_text(encoding='utf-8')),
        'limitations':['Chromium emulation is not a measurement of a physical phone or 120/144 Hz display.',
                       'Native filesystem permissions and browser persistent-storage permissions were not verified end-to-end.',
                       'This remains a fan-made 2.5D SVG adaptation, not official models or frame data.']}
    (output/'validation.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(summary,ensure_ascii=False,indent=2),flush=True)
    return summary

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--report-only',action='store_true')
    parser.add_argument('--with-original',action='store_true',help='Also run the complete inherited regression suite')
    parser.add_argument('--soak-seconds',type=int,default=0,help='Explicit real-time soak; 1200 = 20 minutes')
    parser.add_argument('--require-soak',action='store_true',help='Require saved, passing 20-minute evidence for the current HTML')
    args=parser.parse_args()
    if not args.report_only:
        commands = [[sys.executable,'tools/check_flow.py']] if args.with_original else [[sys.executable,'tools/build_forge.py']]
        commands += [['node','tests/flow4/core.test.js'],[sys.executable,'tests/flow4/browser.py'],[sys.executable,'tests/flow4/rhythm_matrix.py'],[sys.executable,'tests/flow4/fan_matrix.py']]
        if args.soak_seconds:
            commands += [[sys.executable,'tests/flow4/endurance.py','--seconds',str(args.soak_seconds)]]
        for command in commands:
            print('\n=== '+' '.join(command)+' ===',flush=True)
            subprocess.run(command,cwd=ROOT,check=True)
    aggregate(args.require_soak)
