"""Bundled Android resolver. No downloads, credentials, cookies or remote code updates."""
import collections
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
from urllib.parse import urlparse

def run(request_json, qjs, cache, wheels):
    request = json.loads(request_json)
    logs = collections.deque(maxlen=60)
    diagnostic = {'python': sys.version.split()[0], 'challengesRequested': 0, 'challengesSolved': 0}
    def safe(message):
        return re.sub(r'https?://\S+', '[URL]', str(message))[:400]
    class Logger:
        def debug(self, message, **kwargs): logs.append(safe(message))
        def info(self, message, **kwargs): logs.append(safe(message))
        def warning(self, message, **kwargs): logs.append(safe(message))
        def error(self, message, **kwargs): logs.append(safe(message))
    try:
        for filename in sorted(os.listdir(wheels)):
            if filename.endswith('.whl'):
                sys.path.insert(0, os.path.join(wheels, filename))
        os.environ['TMPDIR'] = cache
        tempfile.tempdir = cache
        import yt_dlp
        import yt_dlp.version
        import yt_dlp_ejs
        diagnostic.update(ytDlp=yt_dlp.version.__version__, ejs=yt_dlp_ejs.version)
        options = {
            'format': 'bestaudio[ext=m4a][protocol=https]/bestaudio[protocol=https]',
            'skip_download': True, 'noplaylist': True, 'socket_timeout': 10,
            'retries': 0, 'extractor_retries': 0, 'cachedir': False,
            'logger': Logger(), 'js_runtimes': {'quickjs': {'path': qjs}},
            'remote_components': set(),
        }
        op = request.get('operation')
        if op == 'probe':
            check = subprocess.run([qjs, '-e', 'print("LUMAIRE_QJS_OK")'], capture_output=True, text=True, timeout=10)
            if check.returncode or check.stdout.strip() != 'LUMAIRE_QJS_OK':
                raise RuntimeError('Bundled QuickJS could not start.')
            return json.dumps({'available': True, 'diagnostic': diagnostic})
        if op == 'search':
            query = request.get('query', '').strip()
            if not 1 <= len(query) <= 200:
                raise ValueError('Enter a search of 1–200 characters.')
            count = min(10, max(1, int(request.get('maxResults') or 10)))
            options.update(extract_flat=True, playlistend=count)
            with yt_dlp.YoutubeDL(options) as ydl:
                info = ydl.extract_info(f'ytsearch{count}:{query}', download=False)
            results = []
            for entry in info.get('entries', []):
                if not entry or not re.fullmatch(r'[\w-]{11}', entry.get('id', ''), flags=re.ASCII):
                    continue
                results.append({
                    'id': entry['id'], 'title': entry.get('title') or 'Untitled',
                    'duration': entry.get('duration'), 'thumbnail': entry.get('thumbnail'),
                    'channel': entry.get('channel') or entry.get('uploader'),
                    'track': entry.get('track'), 'artist': entry.get('artist'), 'album': entry.get('album'),
                })
            return json.dumps({'results': results})
        if op not in ('resolve', 'challenge'):
            raise ValueError('Unsupported Android resolver operation.')
        video = request.get('videoId', '')
        if not re.fullmatch(r'[A-Za-z0-9_-]{11}', video):
            raise ValueError('Invalid YouTube video ID.')
        # Diagnostic observer preserves real provider requests/results unchanged.
        from yt_dlp.extractor.youtube.jsc._builtin.quickjs import QuickJSJCP
        original = QuickJSJCP._real_bulk_solve
        def observe(provider, requests):
            diagnostic['challengesRequested'] += len(requests)
            diagnostic['challengeTypes'] = sorted({r.type.value for r in requests})
            for result in original(provider, requests):
                response = getattr(result, 'response', None)
                outputs = response.output.results if response is not None else {}
                valid = {challenge: output for challenge, output in outputs.items()
                         if isinstance(output, str) and output and output != challenge
                         and not output.startswith('enhanced_except_')}
                if valid:
                    diagnostic['challengesSolved'] += 1
                    diagnostic.setdefault('challengeTransforms', []).extend({
                        'inputSha256': hashlib.sha256(challenge.encode()).hexdigest(),
                        'outputSha256': hashlib.sha256(output.encode()).hexdigest(),
                    } for challenge, output in valid.items())
                yield result
        if op == 'challenge':
            options.update(verbose=True, ignore_no_formats_error=True,
                           extractor_args={'youtube': {'player_client': [request.get('client') or 'web_safari']}})
            QuickJSJCP._real_bulk_solve = observe
        try:
            with yt_dlp.YoutubeDL(options) as ydl:
                info = ydl.extract_info('https://www.youtube.com/watch?v=' + video, download=False)
        finally:
            QuickJSJCP._real_bulk_solve = original
        if op == 'challenge':
            diagnostic['logs'] = list(logs)
            if diagnostic['challengesSolved'] < 1:
                raise RuntimeError('This live source did not yield a successfully solved JS challenge.')
            return json.dumps({'diagnostic': diagnostic, 'liveChallengeSolved': True})
        url = info.get('url', '')
        parsed = urlparse(url)
        if parsed.scheme != 'https' or not (parsed.hostname or '').endswith('.googlevideo.com') or parsed.port not in (None, 443):
            raise RuntimeError('No supported HTTPS audio stream was returned.')
        allowed = {'user-agent', 'referer', 'accept', 'accept-language', 'origin', 'sec-fetch-mode'}
        headers = {}
        for key, value in info.get('http_headers', {}).items():
            if key.lower() not in allowed or len(value) > 4096 or '\r' in value or '\n' in value:
                raise RuntimeError('The source requires an unsupported HTTP header.')
            headers[key] = value
        # Validate a small range before handing a fresh signed URL to Media3.
        import urllib.request
        with urllib.request.urlopen(urllib.request.Request(url, headers={**headers, 'Range': 'bytes=0-1023'}), timeout=15) as response:
            if response.status not in (200, 206) or not response.read(1024):
                raise RuntimeError('The audio source returned no playable data.')
            diagnostic['streamProbeStatus'] = response.status
        diagnostic.update(format=info.get('format_id'), codec=info.get('acodec'), headerNames=list(headers))
        return json.dumps({'url': url, 'headers': headers, 'duration': info.get('duration'),
                           'title': info.get('title'), 'container': info.get('ext'), 'codec': info.get('acodec'),
                           'track': info.get('track'), 'artist': info.get('artist'), 'album': info.get('album'),
                           'diagnostic': diagnostic})
    except Exception as error:
        diagnostic.update(logs=list(logs), exception=type(error).__name__)
        return json.dumps({'error': safe(error), 'diagnostic': diagnostic})
