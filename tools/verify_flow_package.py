#!/usr/bin/env python3
"""Verify shipped source files against SHA256SUMS.json (not a signature).
Additional unlisted user files are left alone. Edited listed files report mismatch.
"""
from pathlib import Path
import hashlib,json,sys
root=Path(__file__).resolve().parents[1]
manifest=json.loads((root/'SHA256SUMS.json').read_text(encoding='utf-8'))
failed=[]
for name,expected in manifest.items():
 path=(root/name).resolve()
 if root not in path.parents:failed.append((name,'unsafe path'));continue
 if not path.is_file():failed.append((name,'missing'));continue
 actual=hashlib.sha256(path.read_bytes()).hexdigest()
 if actual!=expected:failed.append((name,'changed'))
for name,why in failed:print(why,name)
print(f'{len(manifest)-len(failed)}/{len(manifest)} packaged files match SHA-256')
sys.exit(1 if failed else 0)
