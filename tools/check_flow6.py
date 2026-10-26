#!/usr/bin/env python3
"""Build and run FLOW 06 checks, or validate already recorded evidence.
Report-only never substitutes for running a missing or stale test. The optional
20-minute soak is intentionally separate from the fast test entry point.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'qa/flow6'
SIMPLE = ['anatomy', 'regression-core', 'compatibility', 'socket-matrix',
          'anatomy-browser', 'browser', 'portability', 'transition-matrix']
COMMANDS = [
    [sys.executable, 'tools/build_forge.py'],
    ['node', 'tests/flow6/anatomy.test.js'],
    ['node', 'tests/flow6/regression-core.test.js'],
    [sys.executable, 'tests/flow6/inherited.py'],
    [sys.executable, 'tests/flow6/compatibility.py'],
    [sys.executable, 'tests/flow6/browser.py'],
    [sys.executable, 'tests/flow6/regression-browser.py'],
    [sys.executable, 'tests/flow6/portability.py'],
    [sys.executable, 'tests/flow6/transition-matrix.py'],
    ['node', 'tests/flow6/continuity-metrics.js'],
]

def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--report-only', action='store_true')
    parser.add_argument('--require-soak', action='store_true')
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    executed = []
    if not args.report_only:
        for i, command in enumerate(COMMANDS):
            print('RUN', ' '.join(command), flush=True)
            result = subprocess.run(command, cwd=ROOT, text=True, encoding='utf-8',
                                    errors='replace', stdout=subprocess.PIPE,
                                    stderr=subprocess.STDOUT)
            log = OUT / f'check-{i:02d}-{Path(command[-1]).stem}.log'
            log.write_text(result.stdout, encoding='utf-8')
            executed.append({'command': command, 'exitCode': result.returncode,
                             'log': str(log.relative_to(ROOT))})
            print(result.stdout, end='', flush=True)
            if result.returncode:
                print('FAILED. Earlier evidence was not promoted to a new pass.', file=sys.stderr)
                return result.returncode
    html_sha = digest(ROOT / 'dist/INK-Street-Fighter-6.html')
    player_sha = digest(ROOT / 'dist/INK-Street-Fighter-6-Player.html')
    errors: list[str] = []
    evidence: dict[str, dict] = {}

    def load(name: str) -> dict:
        path = OUT / f'{name}.json'
        try:
            data = json.loads(path.read_text(encoding='utf-8'))
        except (OSError, ValueError) as exc:
            errors.append(f'{name}: missing/invalid evidence: {exc}')
            return {}
        if data.get('htmlSha256') != html_sha:
            errors.append(f'{name}: HTML SHA-256 does not match this build')
        if data.get('browserErrors'):
            errors.append(f'{name}: unhandled browser errors were recorded')
        return data

    for name in SIMPLE:
        data = load(name)
        total, passed = data.get('total', 0), data.get('passed', -1)
        if not isinstance(total, int) or total <= 0 or passed != total:
            errors.append(f'{name}: incomplete result {passed}/{total}')
        if name == 'transition-matrix' and data.get('routePassed') != data.get('routeTotal'):
            errors.append('transition-matrix: a real route failed')
        evidence[name] = {'path': f'qa/flow6/{name}.json', 'total': total,
                          'passed': passed, 'sha256': digest(OUT/f'{name}.json') if data else None}
    boundary = load('key-boundary-continuity')
    if boundary.get('passed') is not True or boundary.get('totalFailures', 1) != 0 or boundary.get('checks', 0) <= 0:
        errors.append('key-boundary-continuity: failed or empty')
    evidence['key-boundary-continuity'] = {k: boundary.get(k) for k in ['checks', 'passed', 'maximumDisplacement', 'thresholdPixels']}
    inherited = load('regression')
    if inherited.get('passed') is not True:
        errors.append('regression: an inherited command failed')
    results = inherited.get('results', {})
    for name in ['ink', 'forge', 'flow']:
        data = results.get(name, {})
        if data.get('total', 0) <= 0 or data.get('passed') != data.get('total'):
            errors.append(f'inherited {name}: incomplete result')
        evidence['inherited-' + name] = {k: data.get(k) for k in ['total', 'passed']}
    for name in ['mechanics', 'replays']:
        data = results.get(name, [])
        if not isinstance(data, list) or not data:
            errors.append(f'inherited {name}: missing rows')
            continue
        passed = sum(bool(r.get('pass')) if name == 'mechanics' else
                     bool(r.get('started') and r.get('finite') and r.get('validSVG')) for r in data)
        if passed != len(data):
            errors.append(f'inherited {name}: incomplete result {passed}/{len(data)}')
        evidence['inherited-' + name] = {'total': len(data), 'passed': passed}
    if results.get('browserErrors'):
        errors.append('inherited regression: browser errors recorded')
    soak_path = OUT / 'endurance.json'
    soak = json.loads(soak_path.read_text(encoding='utf-8')) if soak_path.exists() else {}
    full_soak = (soak.get('htmlSha256') == html_sha and soak.get('status') == 'passed'
                 and soak.get('elapsedWallSeconds', 0) >= 1200 and not soak.get('browserErrors'))
    if args.require_soak and not full_soak:
        errors.append('A passed >=1,200 wall-second soak bound to this build is required')
    evidence['endurance'] = {k: soak.get(k) for k in ['htmlSha256', 'status', 'elapsedWallSeconds', 'completedRoutes', 'startedAt', 'finishedAt']}
    evidence['endurance']['fullSoakAccepted'] = full_soak
    report = {'suite': 'flow6-final-validation', 'capturedAt': datetime.now(timezone.utc).isoformat(),
              'htmlSha256': html_sha, 'playerHtmlSha256': player_sha,
              'status': 'passed' if not errors else 'failed', 'reportOnly': args.report_only,
              'required20MinuteSoak': args.require_soak, 'commandsThisInvocation': executed,
              'evidence': evidence, 'errors': errors,
              'note': 'Counts are separate test contracts and sample matrices, not unique user scenarios. '
                      'Report-only verifies recorded evidence; it does not run tests. '
                      'Key-boundary metrics are finite sampled checks, not a proof of all possible motions.'}
    (OUT / 'validation.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print('FLOW 06', report['status'].upper(), 'HTML', html_sha, flush=True)
    for error in errors:
        print('FAIL', error, file=sys.stderr)
    return 1 if errors else 0

if __name__ == '__main__':
    raise SystemExit(main())
