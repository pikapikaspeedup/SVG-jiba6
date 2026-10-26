#!/usr/bin/env python3
"""Extract an actual archive to a new directory, verify each file, rebuild both games.
--record writes working-tree QA; without it the archived reports are not changed.
"""
from pathlib import Path
import argparse, datetime, hashlib, json, os, subprocess, sys, tempfile, zipfile
ROOT=Path(__file__).resolve().parents[1]
def sha(data):return hashlib.sha256(data).hexdigest()
def verify(archive,record=False):
    archive=Path(archive).resolve()
    with tempfile.TemporaryDirectory(prefix='ink-flow5-rebuild-') as temp:
        dest=Path(temp)
        with zipfile.ZipFile(archive) as z:
            assert z.testzip() is None, 'ZIP CRC error'
            for item in z.infolist():
                path=(dest/item.filename).resolve()
                assert dest in path.parents and not item.filename.startswith('/'), 'Unsafe ZIP path'
                assert not ((item.external_attr>>16)&0o170000)==0o120000, 'Symlink in archive'
            z.extractall(dest)
        roots=[p for p in dest.iterdir() if p.is_dir()]
        assert len(roots)==1, 'Expected one archive root'
        root=roots[0]
        manifest=json.loads((root/'SHA256SUMS.json').read_text(encoding='utf-8'))
        for rel,expected in manifest.items():
            path=(root/rel).resolve();assert root in path.parents, 'Unsafe manifest path'
            assert path.is_file() and sha(path.read_bytes())==expected, 'Checksum mismatch: '+rel
        names=['INK-Street-Fighter-6.html','INK-Street-Fighter-6-Player.html']
        before={n:sha((root/'dist'/n).read_bytes()) for n in names}
        env={**os.environ,'PYTHONUTF8':'1','PYTHONIOENCODING':'utf-8'}
        build=subprocess.run([sys.executable,'tools/build_forge.py'],cwd=root,env=env,capture_output=True,text=True,encoding='utf-8',check=True)
        after={n:sha((root/'dist'/n).read_bytes()) for n in names}
        assert before==after, 'Fresh source build differs from shipped games'
        assert (root/'game.js').read_bytes()==(root/'dist/game-forge.js').read_bytes(), 'Generated game integration differs'
        report={'capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'archive':archive.name,
                'archiveSha256':sha(archive.read_bytes()),'manifestFilesVerified':len(manifest),
                'freshDirectory':True,'buildCommand':[sys.executable,'tools/build_forge.py'],
                'buildOutput':build.stdout.strip(),'before':before,'after':after,'passed':True,
                'htmlSha256':before[names[0]],'note':'Byte-for-byte rebuild of the two shipped HTML games from an extracted source archive; native browser file permissions are separate.'}
    if record:
        (ROOT/'qa/flow5/source-rebuild.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False,indent=2),flush=True)
    return report
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('archive',type=Path);p.add_argument('--record',action='store_true');a=p.parse_args();verify(a.archive,a.record)
