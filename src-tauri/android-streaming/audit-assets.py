"""Audit packaged launcher artwork, pinned wheels and licence notice presence."""
import hashlib
import json
from pathlib import Path
import sys
import zipfile

root = Path(__file__).resolve().parents[2]
apk = Path(sys.argv[1]).resolve()
destination = Path(sys.argv[2]).resolve()
with zipfile.ZipFile(apk) as archive:
    hashes = {hashlib.sha256(archive.read(name)).hexdigest(): name
              for name in archive.namelist() if name.endswith('.png')}
    icons = [{'source': str(source.relative_to(root)),
              'apkResource': hashes.get(hashlib.sha256(source.read_bytes()).hexdigest())}
             for source in sorted((root / 'src-tauri/icons/android').glob('mipmap-*/*.png'))]
    notices = [f'assets/licenses/{source.name}'
               for source in (root / 'src-tauri/android-streaming/src/main/assets/licenses').iterdir()]
    notices += ['assets/licenses/THIRD_PARTY_NOTICES.md', 'assets/licenses/THIRD_PARTY_LICENSES.txt']
    missing = [name for name in notices if name not in archive.namelist()]
    wheels = {name: hashlib.sha256(archive.read(name)).hexdigest()
              for name in archive.namelist() if name.startswith('assets/python-wheels/')}
    expected = {
        'assets/python-wheels/yt_dlp-2026.8.19-py3-none-any.whl': '1d57897e94c6665a0a6f9bc54b34e584284e32c034ffab3a7df25d8f7b24eedf',
        'assets/python-wheels/yt_dlp_ejs-0.8.0-py3-none-any.whl': '79300e5fca7f937a1eeede11f0456862c1b41107ce1d726871e0207424f4bdb4',
    }
report = {'apkSha256': hashlib.sha256(apk.read_bytes()).hexdigest(),
          'icons': icons, 'noticeCount': len(notices), 'missingNotices': missing,
          'wheelHashes': wheels, 'wheelHashesMatch': wheels == expected}
report['passed'] = len(icons) == 15 and all(row['apkResource'] for row in icons) and not missing and wheels == expected
destination.write_text(json.dumps(report, indent=2))
print(json.dumps({key: value for key, value in report.items() if key not in ('icons', 'wheelHashes')}, indent=2))
sys.exit(0 if report['passed'] else 1)
