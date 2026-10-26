"""Verify the review archive builds independently and fingerprints real inputs."""
from pathlib import Path
import tempfile,subprocess,sys,json,zipfile,hashlib,runpy
R=Path(__file__).resolve().parents[2];O=R/'qa/flow11';O.mkdir(exist_ok=True);rows=[]
def check(name,ok):rows.append({'name':name,'passed':bool(ok)});print('PASS' if ok else 'FAIL',name)
with tempfile.TemporaryDirectory(prefix='ink-build-contract-') as temporary:
 out=Path(temporary)/'bundle'
 subprocess.run([sys.executable,str(R/'tools/package_engine_review.py'),str(out),'--verify-build'],check=True)
 report=json.loads((out/'build-verification.json').read_text());local=json.loads((R/'dist/engine-build.json').read_text())
 check('Source archive builds without workspace dependencies',report['passed'])
 check('Independent build has the same source identity',report['build']==local['id'])
 check('Independent HTML is byte-identical',report['htmlSha256']==hashlib.sha256((R/'dist/INK-Street-Fighter-6.html').read_bytes()).hexdigest())
 extracted=Path(temporary)/'extracted';extracted.mkdir()
 with zipfile.ZipFile(out/'engine-source.zip') as z:
  check('Archive contains base HTML and legacy runtime dependencies','street-fighter-6.html' in z.namelist() and 'src/mai-sf6.js' in z.namelist() and 'src/atelier-studio.js' in z.namelist())
  z.extractall(extracted)
 identity=runpy.run_path(str(extracted/'tools/build_forge.py'))['identity'];before=identity()['id']
 p=extracted/'src/ink/input.js';source=p.read_bytes();p.write_bytes(source+b'\n// changed runtime\n');check('Runtime changes invalidate build identity',identity()['id']!=before);p.write_bytes(source)
 p=next((extracted/'assets/ink/characters/ryu/moves').glob('*.json'));source=p.read_bytes();p.write_bytes(source+b'\n');check('Asset content changes invalidate build identity',identity()['id']!=before);p.write_bytes(source)
 p=extracted/'VERSION.json';p.write_text('{"version":"not-a-combat-identity"}');check('A cosmetic version label is not trusted as code identity',identity()['id']==before)
(O/'build-identity.json').write_text(json.dumps({'build':local['id'],'rows':rows},indent=2)+'\n')
assert all(x['passed'] for x in rows)
