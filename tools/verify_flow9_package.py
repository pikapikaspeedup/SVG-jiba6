#!/usr/bin/env python3
"""Verify every ZIP file and rebuild both HTML outputs in a new directory.
Python standard library only. Output stays outside the ZIP to avoid recursive
archive checksums. No network access, external services or OS file grants.
"""
from pathlib import Path, PurePosixPath
import argparse,datetime,hashlib,json,os,subprocess,sys,tempfile,zipfile

def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('archive',type=Path);ap.add_argument('--out',type=Path,required=True);a=ap.parse_args();started=datetime.datetime.now(datetime.timezone.utc).isoformat();errors=[];build={};matched=0
 archive=a.archive.resolve();manifest={};html={}
 try:
  with tempfile.TemporaryDirectory(prefix='ink-flow9-verify-') as td:
   root=Path(td)
   with zipfile.ZipFile(archive) as z:
    names=z.namelist()
    if len(names)!=len(set(names)):raise ValueError('Duplicate ZIP paths')
    for info in z.infolist():
     n=PurePosixPath(info.filename)
     if n.is_absolute() or '..' in n.parts or n.parts[0]!='INK-Flow-9-Fluid' or (info.external_attr>>16)&0o170000==0o120000:raise ValueError('Unsafe ZIP path: '+info.filename)
    broken=z.testzip()
    if broken:raise ValueError('Corrupt ZIP file: '+broken)
    z.extractall(root)
   r=root/'INK-Flow-9-Fluid';manifest=json.loads((r/'SOURCE-MANIFEST-FLOW9.json').read_text());files=manifest['files'];actual={p.relative_to(r).as_posix() for p in r.rglob('*') if p.is_file()}-{'SOURCE-MANIFEST-FLOW9.json'}
   if actual!=set(files):raise ValueError('ZIP file set differs from manifest')
   for rel,row in files.items():
    p=r/rel
    if sha(p)!=row['sha256'] or p.stat().st_size!=row['bytes']:errors.append('Fingerprint mismatch: '+rel)
    else:matched+=1
   originals={n:sha(r/'dist'/n) for n in ['INK-Street-Fighter-6.html','INK-Street-Fighter-6-Player.html']}
   # Delete all regenerated outputs: the builder must not merely reuse them.
   for n in [*originals,'game-forge.js','forge-template.html']:
    p=r/'dist'/n
    if p.exists():p.unlink()
   proc=subprocess.run([sys.executable,'tools/build_forge.py'],cwd=r,capture_output=True,text=True,timeout=90,env={**os.environ,'PYTHONDONTWRITEBYTECODE':'1'})
   build={'exitCode':proc.returncode,'stdout':proc.stdout,'stderr':proc.stderr,'freshTemporaryDirectory':True,'removedBuiltOutputsBeforeRebuild':True}
   if proc.returncode:errors.append('Clean build failed')
   for n,before in originals.items():
    after=sha(r/'dist'/n) if (r/'dist'/n).exists() else None;html[n]={'packagedSha256':before,'rebuiltSha256':after,'byteIdentical':before==after}
    if before!=after:errors.append('Rebuild mismatch: '+n)
 except Exception as e:errors.append(type(e).__name__+': '+str(e))
 result={'kind':'ink-flow9-final-delivery-check','status':'passed' if not errors else 'failed','startedAt':started,'finishedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'archiveName':archive.name,'archiveSha256':sha(archive),'archiveBytes':archive.stat().st_size,'manifestFiles':manifest.get('fileCount'),'matchedFiles':matched,'html':html,'cleanBuild':build,'errors':errors,'scope':'All packaged files hash-checked, then both standalone HTML outputs reconstructed from extracted source. Browser and duration evidence are separately recorded in the included report.'}
 a.out.parent.mkdir(parents=True,exist_ok=True);a.out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k not in ['cleanBuild','html']},ensure_ascii=False,indent=2));return 0 if not errors else 1
if __name__=='__main__':raise SystemExit(main())
