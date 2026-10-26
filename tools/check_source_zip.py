#!/usr/bin/env python3
"""Verify and rebuild a trusted FLOW source ZIP in a clean temporary directory.
The archive contains executable source; use this only with a source you trust.
Python standard library only. Does not publish or modify the input archive.
"""
from pathlib import Path
import hashlib,json,subprocess,sys,tempfile,zipfile
if len(sys.argv)!=2:raise SystemExit('Usage: python tools/check_source_zip.py /path/INK-Flow-4-Mai-Source.zip')
archive=Path(sys.argv[1]).resolve()
with tempfile.TemporaryDirectory(prefix='ink-flow-check-') as temp:
 dest=Path(temp)
 with zipfile.ZipFile(archive) as z:
  assert len(z.infolist())<20000 and sum(x.file_size for x in z.infolist())<256*1024*1024,'Oversized archive'
  for n in z.namelist():
   p=(dest/n).resolve();assert dest in p.parents,'Unsafe archive path'
  assert z.testzip()is None,'CRC failure';z.extractall(dest)
 roots=list(dest.glob('*/VERSION.json'));assert len(roots)==1,'Expected one project root';root=roots[0].parent
 subprocess.run([sys.executable,'tools/verify_flow_package.py'],cwd=root,check=True)
 names=['INK-Street-Fighter-6.html','INK-Street-Fighter-6-Player.html']
 sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
 before={name:sha(root/'dist'/name)for name in names}
 subprocess.run([sys.executable,'tools/build_forge.py'],cwd=root,check=True)
 after={name:sha(root/'dist'/name)for name in names};assert before==after,'Clean build differed'
 print(json.dumps({'cleanRebuild':True,'artifacts':after,'archiveCrcValid':True},indent=2))
