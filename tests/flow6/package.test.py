"""Negative delivery-verifier checks against a real packaged source snapshot.
Corrupt archives are created only in a temporary directory and are discarded.
"""
from pathlib import Path
import argparse, datetime, hashlib, json, subprocess, sys, tempfile, zipfile
R=Path(__file__).resolve().parents[2];O=R/'qa/flow6'
p=argparse.ArgumentParser(description=__doc__);p.add_argument('archive',type=Path);a=p.parse_args();rows=[]
with tempfile.TemporaryDirectory(prefix='flow6-package-negative-') as name:
 temp=Path(name)
 for kind,expected in [('tampered-source','hashes do not match'),('traversal','Unsafe archive entry')]:
  target=temp/(kind+'.zip')
  with zipfile.ZipFile(a.archive) as source,zipfile.ZipFile(target,'w',compression=zipfile.ZIP_STORED) as out:
   for info in source.infolist():
    data=source.read(info.filename)
    if kind=='tampered-source' and info.filename.endswith('/game.js'):
     data+=b'\n/* deliberate negative-test mutation */\n'
    out.writestr(info.filename,data)
   if kind=='traversal':out.writestr('../../must-not-be-written.txt',b'negative test')
  report=temp/(kind+'.json')
  result=subprocess.run([sys.executable,str(R/'tools/verify_flow6_package.py'),str(target),'--report',str(report)],capture_output=True,text=True)
  data=json.loads(report.read_text());ok=result.returncode==1 and data['status']=='failed' and expected in data.get('error','')
  rows.append({'name':kind,'pass':ok,'exitCode':result.returncode,'expectedRejection':data.get('error')});print('PASS' if ok else 'FAIL','reject',kind,flush=True)
report={'suite':'flow6-package-verifier-negative-tests','capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'htmlSha256':hashlib.sha256((R/'dist/INK-Street-Fighter-6.html').read_bytes()).hexdigest(),'testedSourceSnapshotSha256':hashlib.sha256(a.archive.read_bytes()).hexdigest(),'verifierSha256':hashlib.sha256((R/'tools/verify_flow6_package.py').read_bytes()).hexdigest(),'total':len(rows),'passed':sum(r['pass'] for r in rows),'tests':rows,'note':'Expected rejection of corrupted temporary archives; not a successful delivery check of those archives. The clean final archive is checked independently after packaging.'}
(O/'package-tests.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');raise SystemExit(0 if report['passed']==report['total'] else 1)
