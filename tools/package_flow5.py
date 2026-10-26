#!/usr/bin/env python3
"""Package FLOW5 source and evidence. Never uploads, commits or publishes.
A release requires completed current-build QA including the 20-minute run.
--preflight creates a clearly named temporary archive for build checks only.
"""
from pathlib import Path
import argparse, hashlib, json, zipfile
ROOT=Path(__file__).resolve().parents[1]
FORBIDDEN={'.ttf','.otf','.woff','.woff2','.eot','.pyc'}
ROOT_FILES={'.gitignore','.nojekyll','NOTICE.txt','OPEN-ME.html','index.html','README.md',
            'README-FORGE.md','README-FLOW.md','VERSION.json','game.js','street-fighter-6.html',
            'requirements-dev.txt','UPDATE-FLOW.md','CHANGELOG-FLOW4.md','TEST-REPORT-FLOW4.md',
            'PLAN-FLOW5.md','CHANGELOG-FLOW5.md','TEST-REPORT-FLOW5.md'}

def sha(data):
    return hashlib.sha256(data).hexdigest()

def files():
    selected=[]
    for f in ROOT.rglob('*'):
        if not f.is_file() or f.is_symlink():
            continue
        rel=f.relative_to(ROOT);parts=rel.parts
        if any(p in {'__pycache__','.git','node_modules','.pytest_cache'} for p in parts) or f.suffix.lower() in FORBIDDEN:
            continue
        include=len(parts)==1 and f.name in ROOT_FILES
        include|=parts[0] in {'src','forge','assets','docs','tests','tools','legacy','test-results'}
        include|=parts[0]=='dist' and f.name in {'INK-Street-Fighter-6.html','INK-Street-Fighter-6-Player.html','game-forge.js'}
        include|=parts[0]=='qa' and f.suffix.lower() in {'.json','.png','.patch','.log'}
        if parts[0]=='qa' and (f.name.endswith('-progress.json') or f.name.endswith('-first.png')):
            include=False
        if include:
            selected.append(rel)
    return sorted(selected,key=lambda p:p.as_posix())

def package(output,preflight=False):
    output=Path(output);output.mkdir(parents=True,exist_ok=True)
    version=json.loads((ROOT/'VERSION.json').read_text(encoding='utf-8'))
    assert version['version']=='5.0.0', 'Unexpected version'
    assert sha((ROOT/version['sourceBaseline']['archivedAt']).read_bytes())==version['sourceBaseline']['gameSha256'], 'Legacy source changed'
    if not preflight:
        from check_flow5 import aggregate
        aggregate(require_soak=True)
        assert (ROOT/'TEST-REPORT-FLOW5.md').is_file(), 'Missing release report'
    selected=files()
    manifest={p.as_posix():sha((ROOT/p).read_bytes()) for p in selected}
    manifest_bytes=(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n').encode('utf-8')
    if not preflight:
        (ROOT/'SHA256SUMS.json').write_bytes(manifest_bytes)
    name='INK-Flow-5-Engine-Preflight.zip' if preflight else 'INK-Flow-5-Engine-Source.zip'
    archive=output/name
    with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for path in selected+[Path('SHA256SUMS.json')]:
            info=zipfile.ZipInfo('INK-Flow-5-Engine/'+path.as_posix(),date_time=(2026,10,4,0,0,0))
            info.compress_type=zipfile.ZIP_DEFLATED;info.create_system=3;info.external_attr=0o100644<<16
            data=manifest_bytes if path.name=='SHA256SUMS.json' and len(path.parts)==1 else (ROOT/path).read_bytes()
            z.writestr(info,data)
    with zipfile.ZipFile(archive) as z:
        assert z.testzip() is None, 'Archive CRC failed'
        assert len(z.namelist())==len(set(z.namelist())), 'Duplicate archive paths'
    result={'source':str(archive),'files':len(selected)+1,'bytes':archive.stat().st_size,
            'sha256':sha(archive.read_bytes()),'version':'5.0.0','preflight':preflight,'remoteWrites':False}
    print(json.dumps(result,ensure_ascii=False,indent=2),flush=True)
    return result

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output',nargs='?',type=Path,default=ROOT.parent)
    parser.add_argument('--preflight',action='store_true')
    args=parser.parse_args();package(args.output.resolve(),args.preflight)
