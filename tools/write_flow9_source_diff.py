#!/usr/bin/env python3
"""Write/verifiably reverse/forward-apply the actual v8→v9 engine/UI source patch.
Baseline ZIP must be the user's original v8 source. Test logs/videos are excluded
from this patch; their source files are present separately in the delivery ZIP.
"""
from pathlib import Path
import argparse,datetime,difflib,hashlib,json,shutil,subprocess,tempfile,zipfile
R=Path(__file__).resolve().parents[1];O=R/'qa/flow9';sha=lambda b:hashlib.sha256(b).hexdigest()
def main():
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--baseline',required=True,type=Path);args=ap.parse_args();z=zipfile.ZipFile(args.baseline);prefix=z.namelist()[0].split('/')[0]+'/';members=set(z.namelist())
 scope=['game.js','VERSION.json','OPEN-ME.html','index.html','README.md','README-FLOW.md','tools/build_forge.py','assets/ink/project.json','docs/FLOW9-ENGINE.md','docs/FLOW9-PLAN.md']
 scope += [str(p.relative_to(R)) for folder in ['src/ink','forge'] for p in (R/folder).rglob('*') if p.is_file() and p.suffix in {'.js','.css','.html','.json'}]
 entries=[];chunks=[]
 for name in sorted(set(scope)):
  p=R/name
  if not p.exists():continue
  after=p.read_bytes();before=z.read(prefix+name) if prefix+name in members else None
  if before==after:continue
  left='' if before is None else before.decode('utf-8');right=after.decode('utf-8');diff=list(difflib.unified_diff(left.splitlines(keepends=True),right.splitlines(keepends=True),fromfile='/dev/null' if before is None else 'a/'+name,tofile='b/'+name))
  # Explicit newline markers keep patch(1) correct for non-newline-terminated JSON.
  for line in diff:
   chunks.append(line)
   if not line.endswith('\n'):chunks.append('\n\\ No newline at end of file\n')
  entries.append({'path':name,'beforeSha256':sha(before) if before is not None else None,'afterSha256':sha(after),'beforeBytes':len(before or b''),'afterBytes':len(after)})
 patch=R/'CHANGESET-FLOW9-ENGINE.patch';patch.write_text(''.join(chunks),encoding='utf-8');tool=shutil.which('patch');reverse=forward=False;errors=[]
 if not tool:raise SystemExit('patch executable required to verify generated diff')
 with tempfile.TemporaryDirectory(prefix='flow9-diff-') as temp:
  t=Path(temp)
  for e in entries:p=t/e['path'];p.parent.mkdir(parents=True,exist_ok=True);shutil.copy(R/e['path'],p)
  c=subprocess.run([tool,'--batch','-R','-p1','-i',str(patch)],cwd=t,capture_output=True,text=True);(O/'source-diff-reverse.log').write_text(c.stdout+c.stderr)
  reverse=c.returncode==0 and all((not (t/e['path']).exists()) if e['beforeSha256'] is None else (t/e['path']).is_file() and sha((t/e['path']).read_bytes())==e['beforeSha256'] for e in entries)
  c=subprocess.run([tool,'--batch','-p1','-i',str(patch)],cwd=t,capture_output=True,text=True);(O/'source-diff-forward.log').write_text(c.stdout+c.stderr)
  forward=c.returncode==0 and all((t/e['path']).is_file() and sha((t/e['path']).read_bytes())==e['afterSha256'] for e in entries)
 report={'suite':'flow9-source-diff','status':'passed' if reverse and forward else 'failed','capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'baselineArchiveSha256':sha(args.baseline.read_bytes()),'patchSha256':sha(patch.read_bytes()),'scope':'Engine, rendering, UI, build integration, entrypoints and current docs. Test/evidence/history output changes are not part of this source patch.','changedFiles':len(entries),'reverseMatchesOriginal':reverse,'appliedSourceMatches':forward,'files':entries};(O/'source-diff.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print('PATCH',report['status'],len(entries),'files');return 0 if report['status']=='passed' else 1
if __name__=='__main__':raise SystemExit(main())
