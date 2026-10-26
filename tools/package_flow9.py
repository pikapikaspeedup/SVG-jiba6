#!/usr/bin/env python3
"""Create a self-contained release ZIP with a complete SHA-256 manifest.
Run after the full report/evidence are generated. Never packages Python caches,
node_modules, Git metadata or an archive recursively inside the source tree.
"""
from pathlib import Path
import argparse, datetime, hashlib, json, zipfile
R=Path(__file__).resolve().parents[1]
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--out',type=Path,required=True);a=p.parse_args();out=a.out.resolve()
 if out.is_relative_to(R):raise SystemExit('Choose an output location outside the source tree.')
 v=json.loads((R/'qa/flow9/validation.json').read_text());s=json.loads((R/'qa/flow9/endurance.json').read_text())
 current=sha(R/'dist/INK-Street-Fighter-6.html')
 if not(v['passed']==v['total'] and v['evidenceValidated'] and v.get('soakRequired') and s['status']=='passed' and s['elapsedWallSeconds']>=1500 and v['htmlSha256']==s['htmlSha256']==current):raise SystemExit('Final evidence is incomplete, stale or failed.')
 freeze=json.loads((R/'qa/flow9/final-build-freeze.json').read_text())
 if any(sha(R/p)!=h for p,h in freeze['files'].items()):raise SystemExit('Production changed after the tested final-build freeze.')
 if not (R/'TEST-REPORT-FLOW9.md').exists():raise SystemExit('Missing final report.')
 deny={'.git','__pycache__','node_modules','.pytest_cache'};files={}
 for q in sorted(R.rglob('*')):
  rel=q.relative_to(R)
  if not q.is_file() or q.is_symlink() or any(x in deny for x in rel.parts) or q.suffix in {'.pyc','.pyo','.zip','.ttf','.otf','.woff','.woff2'} or rel.as_posix()=='SOURCE-MANIFEST-FLOW9.json':continue
  files[rel.as_posix()]={'sha256':sha(q),'bytes':q.stat().st_size}
 manifest={'kind':'ink-source-manifest','version':1,'release':'9.0.0-fluid','createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'Every regular deliverable file except this self-referential manifest. Python caches, Git metadata, node_modules and nested ZIPs excluded.','fileCount':len(files),'files':files}
 (R/'SOURCE-MANIFEST-FLOW9.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
 out.parent.mkdir(parents=True,exist_ok=True)
 with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
  for rel in [*files,'SOURCE-MANIFEST-FLOW9.json']:z.write(R/rel,'INK-Flow-9-Fluid/'+rel)
 print(json.dumps({'path':str(out),'bytes':out.stat().st_size,'sha256':sha(out),'hashedFiles':len(files),'zipEntries':len(files)+1},indent=2))
if __name__=='__main__':main()
