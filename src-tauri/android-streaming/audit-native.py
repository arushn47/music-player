"""Inspect actual APK contents, including native modules inside Chaquopy ZIPs."""
import hashlib
import io
import json
from pathlib import Path
import struct
import sys
import zipfile

root = Path(__file__).resolve().parents[2]
output = root / 'test-results/android-streaming'
apk = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else output / 'proof.apk'
rows = []

def inspect(data, name):
    if data[:4] == b'\x7fELF':
        assert data[4:6] == b'\x02\x01', 'Expected ARM64 little-endian ELF'
        phoff = struct.unpack_from('<Q', data, 32)[0]
        entsize, count = struct.unpack_from('<HH', data, 54)
        loads = [struct.unpack_from('<IIQQQQQQ', data, phoff + i * entsize) for i in range(count)]
        loads = [entry for entry in loads if entry[0] == 1]
        rows.append({'path': name, 'sha256': hashlib.sha256(data).hexdigest(),
                     'loadAlignments': [entry[-1] for entry in loads],
                     'aligned16K': all(entry[-1] >= 16384 and entry[2] % 16384 == entry[3] % 16384 for entry in loads)})
    elif zipfile.is_zipfile(io.BytesIO(data)):
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            for child in archive.namelist():
                if child.endswith(('.so', '.imy', '.zip')):
                    inspect(archive.read(child), name + '!/' + child)

inspect(apk.read_bytes(), apk.name)
report = {'apkSha256': hashlib.sha256(apk.read_bytes()).hexdigest(), 'elfCount': len(rows),
          'allElf16KAligned': all(row['aligned16K'] for row in rows), 'libraries': rows,
          'limitation': 'Static ELF check only; the test phone uses 4 KB pages.'}
destination = Path(sys.argv[2]) if len(sys.argv) > 2 else output / 'native-alignment.json'
destination.write_text(json.dumps(report, indent=2))
print(json.dumps({key: value for key, value in report.items() if key != 'libraries'}, indent=2))
