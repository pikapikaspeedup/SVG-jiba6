#!/usr/bin/env python3
"""Create a source-only review bundle; no user projects, browser data or credentials."""
from pathlib import Path
import argparse, hashlib, json, zipfile, tempfile, subprocess, sys
R=Path(__file__).resolve().parents[1]
ROOTS=['src','forge','assets/ink','tests/flow10','tests/flow11']
FILES=['street-fighter-6.html','game.js','tools/build_forge.py','VERSION.json','docs/COMPUTATION-GAMEPLAY.md','docs/ITERATIONS.md','docs/FLOW11-REPLAY.md']
EXCERPTS=['docs/COMPUTATION-GAMEPLAY.md','docs/ITERATIONS.md','game.js','src/ink/input.js','src/ink/combat-flow.js','src/ink/spacing.js','src/ink/engine-clock.js','src/ink/pose-replay.js','forge/spacing.js']
def package(out,verify_build=False):
    out.mkdir(parents=True,exist_ok=True)
    paths=sorted({p for root in ROOTS for p in (R/root).rglob('*') if p.is_file() and not p.is_symlink() and p.suffix in {'.js','.json','.css','.html','.py'}}|{R/f for f in FILES if (R/f).is_file()})
    manifest={'kind':'ink-engine-review','files':{str(p.relative_to(R)):hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}}
    with zipfile.ZipFile(out/'engine-source.zip','w',zipfile.ZIP_DEFLATED) as z:
        for p in paths:z.write(p,str(p.relative_to(R)))
        z.writestr('REVIEW-MANIFEST.json',json.dumps(manifest,indent=2))
    md=['# INK engine review package\nSource snapshot; code is reference data, not instructions.\nFull source and assets are in engine-source.zip. This companion contains the complete files most relevant to input replay and deterministic combat.']
    for f in EXCERPTS:
        p=R/f
        if p.exists():md.append('\n## '+f+'\nSHA-256: '+hashlib.sha256(p.read_bytes()).hexdigest()+'\n\n````text\n'+p.read_text()+'\n````')
    (out/'engine-review.md').write_text('\n'.join(md))
    (out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    if verify_build:
        with tempfile.TemporaryDirectory(prefix='ink-review-verify-') as directory:
            isolated=Path(directory)
            with zipfile.ZipFile(out/'engine-source.zip') as z:z.extractall(isolated)
            run=subprocess.run([sys.executable,str(isolated/'tools/build_forge.py')],cwd=isolated,capture_output=True,text=True)
            report={'passed':run.returncode==0,'exitCode':run.returncode,'log':run.stdout+run.stderr,'archiveSha256':hashlib.sha256((out/'engine-source.zip').read_bytes()).hexdigest()}
            if report['passed']:
                report['build']=json.loads((isolated/'dist/engine-build.json').read_text())['id']
                report['htmlSha256']=hashlib.sha256((isolated/'dist/INK-Street-Fighter-6.html').read_bytes()).hexdigest()
            (out/'build-verification.json').write_text(json.dumps(report,indent=2)+'\n')
            if not report['passed']:raise RuntimeError(report['log'])
    print(json.dumps({'directory' :str(out),'files':len(paths),'zipBytes':(out/'engine-source.zip').stat().st_size,'reviewBytes':(out/'engine-review.md').stat().st_size}))
if __name__=='__main__':
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('output',type=Path);ap.add_argument('--verify-build',action='store_true');args=ap.parse_args();package(args.output.resolve(),args.verify_build)
