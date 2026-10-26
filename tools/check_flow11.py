#!/usr/bin/env python3
"""FLOW11 work-in-progress gate. Passing does not mean replay is implemented."""
from pathlib import Path
import argparse,hashlib,json,subprocess,sys,shutil,runpy
R=Path(__file__).resolve().parents[1];O=R/'qa/flow11'
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--browser',action='store_true');p.add_argument('--evidence',action='store_true');a=p.parse_args();O.mkdir(parents=True,exist_ok=True)
 rows=[]
 def check(name,ok):rows.append({'name':name,'passed':bool(ok)});print('PASS' if ok else 'FAIL',name,flush=True)
 node=shutil.which('node');check('Node available',node is not None)
 if node:
  r=subprocess.run([node,'--test','tests/flow11/random.test.js','tests/flow11/command-stream.test.js','tests/flow11/session-config.test.js','tests/flow11/canonical.test.js'],cwd=R,capture_output=True,text=True);(O/'random-unit.log').write_text(r.stdout+r.stderr);check('Random, command, config and canonical encoding contracts',r.returncode==0)
 for name in ['INK-Street-Fighter-6.html','INK-Street-Fighter-6-Player.html']:
  check(name+' contains current RNG implementation',(R/'src/ink/random.js').read_text().replace('</script','<\\/script') in (R/'dist'/name).read_text())
 cmd=[sys.executable,'tools/check_spacing.py','--output',str(O/'spacing')]
 if a.browser:cmd.append('--browser')
 elif a.evidence:cmd.append('--evidence')
 check('Inherited spacing and production gate',subprocess.run(cmd,cwd=R).returncode==0)
 if a.browser:check('Grouped combat state browser checks',subprocess.run([sys.executable,'tests/flow11/state-browser.py'],cwd=R).returncode==0)
 if a.browser:check('Combat entity browser checks',subprocess.run([sys.executable,'tests/flow11/entities-browser.py'],cwd=R).returncode==0)
 if a.browser:check('Asset and rule identity browser checks',subprocess.run([sys.executable,'tests/flow11/identity-browser.py'],cwd=R).returncode==0)
 if a.browser:check('Canonical session browser checks',subprocess.run([sys.executable,'tests/flow11/session-browser.py'],cwd=R).returncode==0)
 if a.browser:check('Command boundary browser checks',subprocess.run([sys.executable,'tests/flow11/command-browser.py'],cwd=R).returncode==0)
 if a.browser:check('CPU repeatability and lesson browser checks',subprocess.run([sys.executable,'tests/flow11/random-browser.py'],cwd=R).returncode==0)
 identity=json.loads((R/'dist/engine-build.json').read_text())
 check('Build manifest matches complete current production closure',identity==runpy.run_path(str(R/'tools/build_forge.py'))['identity']())
 digest=hashlib.sha256((R/'dist/INK-Street-Fighter-6.html').read_bytes()).hexdigest()
 if a.browser or a.evidence:
  try:report=json.loads((O/'random-browser.json').read_text())
  except (ValueError,OSError):report={}
  check('Current browser evidence',report.get('htmlSha256')==digest and len(report.get('rows',[]))>=9 and all(r.get('passed') is True for r in report.get('rows',[])) and report.get('errors')==[])
 if a.browser or a.evidence:
  try:command=json.loads((O/'command-browser.json').read_text())
  except (ValueError,OSError):command={}
  check('Current command evidence',command.get('htmlSha256')==digest and len(command.get('rows',[]))>=12 and all(x.get('passed') is True for x in command.get('rows',[])) and command.get('errors')==[])
 if a.browser or a.evidence:
  try:session=json.loads((O/'session-browser.json').read_text())
  except (ValueError,OSError):session={}
  check('Current session evidence',session.get('htmlSha256')==digest and len(session.get('rows',[]))>=13 and all(x.get('passed') is True for x in session.get('rows',[])) and session.get('errors')==[])
 if a.browser or a.evidence:
  try:asset=json.loads((O/'identity-browser.json').read_text())
  except (ValueError,OSError):asset={}
  check('Current identity evidence',asset.get('htmlSha256')==digest and len(asset.get('rows',[]))>=16 and all(x.get('passed') is True for x in asset.get('rows',[])) and asset.get('errors')==[])
 if a.browser or a.evidence:
  try:entities=json.loads((O/'entities-browser.json').read_text())
  except (ValueError,OSError):entities={}
  check('Current combat entity evidence',entities.get('htmlSha256')==digest and len(entities.get('rows',[]))>=9 and all(x.get('passed') is True for x in entities.get('rows',[])) and entities.get('errors')==[])
 if a.browser or a.evidence:
  try:state=json.loads((O/'state-browser.json').read_text())
  except (ValueError,OSError):state={}
  check('Current grouped state evidence',state.get('htmlSha256')==digest and len(state.get('rows',[]))>=10 and all(x.get('passed') is True for x in state.get('rows',[])) and state.get('errors')==[])
 try:proof=json.loads((O/'build-identity.json').read_text())
 except (ValueError,OSError):proof={}
 check('Independent archive build evidence',proof.get('build')==identity['id'] and len(proof.get('rows',[]))>=7 and all(x.get('passed') is True for x in proof.get('rows',[])))
 (O/'validation.json').write_text(json.dumps({'scope':'FLOW11 random and simulation prerequisites only; full input replay incomplete','htmlSha256':digest,'rows':rows},indent=2)+'\n')
 return 0 if all(r['passed'] for r in rows) else 1
if __name__=='__main__':raise SystemExit(main())
