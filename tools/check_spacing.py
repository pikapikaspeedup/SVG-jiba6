#!/usr/bin/env python3
"""Validate the spacing experiment without rewriting FLOW9 historical evidence.
Use --browser to run real browser checks, or --evidence to check their fingerprint.
"""
from pathlib import Path
import argparse, hashlib, json, os, shutil, subprocess, sys

R = Path(__file__).resolve().parents[1]
O = R / 'qa/flow10'
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--browser', action='store_true')
    parser.add_argument('--evidence', action='store_true')
    parser.add_argument('--output', type=Path, default=O, help='Report directory; use a new directory for later iterations')
    args = parser.parse_args()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    rows=[]
    def check(name, passed, detail=None):
        rows.append(dict(name=name, passed=bool(passed), detail=detail))
        print('PASS' if passed else 'FAIL', name, flush=True)
    node=shutil.which('node')
    check('Node is available for required syntax and math checks', bool(node))
    if node:
        result=subprocess.run([node,'--test','tests/flow10/contact-solver.test.js','tests/flow10/spacing.test.js'],cwd=R,capture_output=True,text=True)
        (output/'unit-tests.log').write_text(result.stdout+result.stderr)
        check('Contact mathematics and spacing state contracts',result.returncode==0)
        failures=[]
        for p in [R/'game.js',*sorted((R/'src').rglob('*.js')),*sorted((R/'forge').glob('*.js'))]:
            result=subprocess.run([node,'--check',str(p)],capture_output=True,text=True)
            if result.returncode: failures.append(dict(path=str(p.relative_to(R)),error=result.stderr))
        check('Production JavaScript syntax',not failures,failures)
    original=json.loads((R/'tests/fixtures/flow8-asset-signatures.json').read_text())['files']
    changed=[name for name,digest in original.items() if not (R/name).is_file() or sha(R/name)!=digest]
    check('All 707 original action/model/rig/route files preserved',len(original)==707 and not changed,changed)
    modules=['src/ink/contact-solver.js','src/ink/spacing.js','forge/spacing.js']
    for name in ['INK-Street-Fighter-6.html','INK-Street-Fighter-6-Player.html']:
        content=(R/'dist'/name).read_text()
        check(name+' contains current experiment sources',all((R/p).read_text().replace('</script','<\\/script') in content for p in modules))
    if args.browser:
        result=subprocess.run([sys.executable,'tests/flow10/browser.py'],cwd=R,env={**os.environ,'INK_QA_DIR':str(output)})
        check('Production browser suite execution',result.returncode==0)
    digest=sha(R/'dist/INK-Street-Fighter-6.html')
    if args.browser or args.evidence:
        try: evidence=json.loads((output/'browser.json').read_text())
        except (OSError,ValueError): evidence={}
        check('Browser evidence matches this exact HTML',evidence.get('htmlSha256')==digest and evidence.get('total',0)>=28 and evidence.get('passed')==evidence.get('total') and not evidence.get('browserErrors'))
    report=dict(suite='spacing-source-and-evidence',htmlSha256=digest,total=len(rows),passed=sum(r['passed'] for r in rows),tests=rows)
    (output/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    return 0 if report['passed']==report['total'] else 1

if __name__=='__main__':
    raise SystemExit(main())
