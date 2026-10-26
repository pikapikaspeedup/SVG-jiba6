"""Negative tests for evidence validation, in a temporary isolated copy.
These are intentionally invalid fixtures, never promoted into real QA files.
"""
from pathlib import Path
import datetime, hashlib, json, shutil, subprocess, sys, tempfile
R=Path(__file__).resolve().parents[2];O=R/'qa/flow6';rows=[]
with tempfile.TemporaryDirectory(prefix='flow6-checker-test-') as name:
 root=Path(name);(root/'tools').mkdir();(root/'qa/flow6').mkdir(parents=True);(root/'dist').mkdir()
 shutil.copyfile(R/'tools/check_flow6.py',root/'tools/check_flow6.py')
 for key in ['anatomy','regression-core','compatibility','socket-matrix','anatomy-browser','browser','portability','transition-matrix','key-boundary-continuity','regression']:
  shutil.copyfile(O/(key+'.json'),root/'qa/flow6'/(key+'.json'))
 for p in ['INK-Street-Fighter-6.html','INK-Street-Fighter-6-Player.html']:
  shutil.copyfile(R/'dist'/p,root/'dist'/p)
 def run(label,expected,args=()):
  p=subprocess.run([sys.executable,'tools/check_flow6.py','--report-only',*args],cwd=root,capture_output=True,text=True)
  result=json.loads((root/'qa/flow6/validation.json').read_text());ok=p.returncode==expected and (result['status']=='passed')==(expected==0)
  rows.append({'name':label,'pass':ok,'exitCode':p.returncode,'expectedExit':expected,'validationErrors':result['errors']});print('PASS' if ok else 'FAIL',label,flush=True)
 run('Accept current quick evidence without claiming a 20-minute soak',0)
 target=root/'qa/flow6/compatibility.json';original=target.read_bytes();j=json.loads(original);j['htmlSha256']='0'*64;target.write_text(json.dumps(j));run('Reject stale HTML SHA-256',1);target.write_bytes(original)
 target=root/'qa/flow6/regression-core.json';original=target.read_bytes();j=json.loads(original);j['passed']=j['total']-1;target.write_text(json.dumps(j));run('Reject a failed test even with the correct HTML hash',1);target.write_bytes(original)
 target=root/'qa/flow6/anatomy.json';original=target.read_bytes();target.unlink();run('Reject missing evidence',1);target.write_bytes(original)
 run('Reject missing 20-minute soak when explicitly required',1,('--require-soak',))
 invalid={'htmlSha256':hashlib.sha256((root/'dist/INK-Street-Fighter-6.html').read_bytes()).hexdigest(),'status':'passed','elapsedWallSeconds':5,'requestedWallSeconds':1200,'browserErrors':[]}
 (root/'qa/flow6/endurance.json').write_text(json.dumps(invalid));run('Reject short run despite a requested 1,200 seconds and a passed label',1,('--require-soak',))
report={'suite':'flow6-checker-negative-tests','capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'htmlSha256':hashlib.sha256((R/'dist/INK-Street-Fighter-6.html').read_bytes()).hexdigest(),'checkerSha256':hashlib.sha256((R/'tools/check_flow6.py').read_bytes()).hexdigest(),'total':len(rows),'passed':sum(r['pass'] for r in rows),'tests':rows,'note':'All negative fixtures exist only in a deleted temporary directory. This tests refusal to accept stale/incomplete QA; it is not a browser or endurance run.'}
(O/'checker-tests.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');raise SystemExit(0 if report['passed']==report['total'] else 1)
