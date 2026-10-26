#!/usr/bin/env python3
"""Package the complete FLOW 04 source, reports and two standalone games.
Build and run QA first. Never commits, publishes, or contacts a remote service.
"""
from pathlib import Path
import argparse, hashlib, json, zipfile
ROOT = Path(__file__).resolve().parents[1]
ROOT_NAMES = {'.gitignore','.nojekyll','NOTICE.txt','OPEN-ME.html','index.html','README.md',
    'README-FORGE.md','README-FLOW.md','VERSION.json','game.js','street-fighter-6.html',
    'requirements-dev.txt','UPDATE-FLOW.md','CHANGELOG-FLOW4.md','TEST-REPORT-FLOW4.md'}
FLOW_QA = {'core-tests.json','browser-tests.json','combo-validation.json','render-invariance.json',
    'mobile-tests.json','validation.json','source-rebuild.json','delivery-check.json','home.png',
    'combo-success.png','combo-live.png','turn-study.png','effects-study.png','studio-emitter.png',
    'mobile-landscape.png','mobile-portrait.png'}
FORBIDDEN = {'.ttf','.otf','.woff','.woff2','.eot','.pyc'}

def sha(data):
    return hashlib.sha256(data).hexdigest()

def files():
    found=[]
    for file in ROOT.rglob('*'):
        if not file.is_file() or file.is_symlink():
            continue
        path=file.relative_to(ROOT);parts=path.parts
        if any(x in parts for x in ['__pycache__','.git','node_modules']) or file.suffix.lower() in FORBIDDEN:
            continue
        include = len(parts)==1 and file.name in ROOT_NAMES
        include |= parts[0] in {'assets','src','forge','docs','tests','tools','test-results'}
        include |= parts[0]=='dist' and file.name in {'INK-Street-Fighter-6.html','INK-Street-Fighter-6-Player.html'}
        include |= parts[0]=='qa' and len(parts)==2 and file.suffix in {'.json','.png'}
        include |= parts[:2]==('qa','flow') and file.name in FLOW_QA
        include |= parts[:2]==('qa','flow4') and file.suffix in {'.json','.png'} and file.name!='endurance-progress.json'
        if include:
            found.append(path)
    return sorted(found,key=lambda p:p.as_posix())

def package(output):
    output.mkdir(parents=True,exist_ok=True)
    version=json.loads((ROOT/'VERSION.json').read_text(encoding='utf-8'))
    assert version['version']=='4.0.0', 'Update package identity for a future release'
    assert sha((ROOT/'game.js').read_bytes())==version['sourceBaseline']['gameSha256']
    for name in ['dist/INK-Street-Fighter-6.html','dist/INK-Street-Fighter-6-Player.html','TEST-REPORT-FLOW4.md']:
        assert (ROOT/name).is_file(), 'Missing release artifact: '+name
    selected=files();manifest={p.as_posix():sha((ROOT/p).read_bytes()) for p in selected}
    (ROOT/'SHA256SUMS.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    selected.append(Path('SHA256SUMS.json'))
    archive=output/'INK-Flow-4-Mai-Source.zip'
    with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for path in selected:
            info=zipfile.ZipInfo('INK-Flow-4-Mai/'+path.as_posix(),date_time=(2026,10,4,0,0,0))
            info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o644<<16
            z.writestr(info,(ROOT/path).read_bytes())
    with zipfile.ZipFile(archive) as z:
        assert z.testzip() is None, 'Archive CRC verification failed'
        assert len(z.namelist())==len(set(z.namelist())), 'Duplicate archive path'
    result={'source':str(archive),'files':len(selected),'bytes':archive.stat().st_size,
            'sha256':sha(archive.read_bytes()),'version':version['version'],'remoteWrites':False}
    print(json.dumps(result,ensure_ascii=False,indent=2))
    return result

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output',nargs='?',type=Path,default=ROOT.parent)
    args=parser.parse_args()
    package(args.output.resolve())
