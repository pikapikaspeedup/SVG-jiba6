#!/usr/bin/env python3
"""Prove both standalone artifacts rebuild identically from isolated source.
This is a source-tree proof; check_source_zip.py additionally verifies the final ZIP.
No existing dist files are copied into the clean build directory.
"""
from pathlib import Path
import datetime, hashlib, json, shutil, subprocess, sys, tempfile
ROOT=Path(__file__).resolve().parents[1]
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def main():
    inputs=[Path('game.js'),Path('street-fighter-6.html'),Path('VERSION.json'),Path('tools/build_forge.py')]
    for folder in ['src','assets','forge']:
        inputs.extend(p.relative_to(ROOT) for p in (ROOT/folder).rglob('*') if p.is_file() and '__pycache__' not in p.parts)
    inputs=sorted(set(inputs),key=str)
    digests={p.as_posix():sha(ROOT/p) for p in inputs}
    source_hash=hashlib.sha256(json.dumps(digests,sort_keys=True,separators=(',',':')).encode()).hexdigest()
    names=['INK-Street-Fighter-6.html','INK-Street-Fighter-6-Player.html']
    before={name:sha(ROOT/'dist'/name) for name in names}
    with tempfile.TemporaryDirectory(prefix='ink-flow4-rebuild-') as tmp:
        dest=Path(tmp)
        for path in inputs:
            (dest/path).parent.mkdir(parents=True,exist_ok=True)
            shutil.copyfile(ROOT/path,dest/path)
        subprocess.run([sys.executable,'tools/build_forge.py'],cwd=dest,check=True)
        after={name:sha(dest/'dist'/name) for name in names}
        assert after==before, 'Clean build differs from the release artifacts'
    result={'kind':'isolated-source-tree-rebuild','cleanRebuild':True,
        'verifiedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceFileCount':len(inputs),
        'sourceTreeSha256':source_hash,'artifacts':after,
        'note':'No generated HTML was provided to the temporary builder. Final archive integrity is separately checked by tools/check_source_zip.py.'}
    for path in ['qa/flow/source-rebuild.json','qa/source-package-check.json']:
        (ROOT/path).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(result,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
