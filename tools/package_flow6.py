#!/usr/bin/env python3
"""Package the tested FLOW 06 source and standalone outputs.
Requires current-build validation including a real >=20-minute soak.
Run from the project: python tools/package_flow6.py /path/to/output
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PREFIX = 'INK-Flow-6-Continuity'

def included(path: Path) -> bool:
    parts = path.relative_to(ROOT).parts
    return (path.is_file() and not any(p in {'.git', '__pycache__', 'node_modules', '.pytest_cache'} for p in parts)
            and path.suffix not in {'.pyc', '.pid'} and path.name != 'SHA256SUMS.json')

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', nargs='?', type=Path, default=ROOT.parent)
    args = parser.parse_args()
    output = args.output.resolve()
    if output == ROOT or ROOT in output.parents:
        parser.error('Use an output directory outside the source tree.')
    output.mkdir(parents=True, exist_ok=True)
    subprocess.run([sys.executable, 'tools/check_flow6.py', '--report-only', '--require-soak'], cwd=ROOT, check=True)
    required = ROOT/'TEST-REPORT-FLOW6.md'
    if not required.is_file():
        raise FileNotFoundError('Final TEST-REPORT-FLOW6.md is required before packaging.')
    files = sorted(p for p in ROOT.rglob('*') if included(p))
    manifest = {str(p.relative_to(ROOT)).replace('\\', '/'): hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
    manifest_path = ROOT/'SHA256SUMS.json'
    manifest_path.write_text(json.dumps({'algorithm': 'SHA-256', 'scope': 'All packaged files except this manifest itself.', 'files': manifest}, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    archive = output/f'{PREFIX}-Source.zip'
    with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for path in [*files, manifest_path]:
            z.write(path, str(Path(PREFIX)/path.relative_to(ROOT)).replace('\\', '/'))
    copies = {
        'dist/INK-Street-Fighter-6.html': f'{PREFIX}.html',
        'dist/INK-Street-Fighter-6-Player.html': f'{PREFIX}-Player.html',
        'TEST-REPORT-FLOW6.md': f'{PREFIX}-Report.md',
        'qa/flow6/v5-v6-motion-comparison.mp4': f'{PREFIX}-Comparison.mp4',
        'qa/flow6/v5-v6-motion-comparison.png': f'{PREFIX}-Comparison.png',
    }
    for src, name in copies.items():
        shutil.copyfile(ROOT/src, output/name)
    print('PACKAGED', archive, len(files)+1, 'files', archive.stat().st_size, 'bytes')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
