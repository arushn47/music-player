import importlib.util
import json
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('resolver', Path(__file__).parents[1] / 'src-tauri/android-streaming/src/main/python/lumaire_resolver.py')
resolver = importlib.util.module_from_spec(spec)
spec.loader.exec_module(resolver)


class PlaylistTests(unittest.TestCase):
    def test_canonical_public_link(self):
        self.assertEqual(resolver.playlist_url('https://music.youtube.com/playlist?list=PLabcdefghijk&si=tracking'), 'https://www.youtube.com/playlist?list=PLabcdefghijk')

    def test_reject_untrusted_targets(self):
        for url in ('http://127.0.0.1/playlist?list=PLabcdefghijk', 'https://youtube.com.evil.test/playlist?list=PLabcdefghijk', 'https://user@youtube.com/playlist?list=PLabcdefghijk', 'https://youtube.com:444/playlist?list=PLabcdefghijk', 'https://youtube.com/playlist?list=bad/path'):
            with self.subTest(url=url), self.assertRaises(ValueError):
                resolver.playlist_url(url)

    def test_preserve_order_and_bound_metadata_without_stream_urls(self):
        rows = [{'id': str(i), 'title': 'Song', 'artist': 'Artist', 'duration': 123, 'url': 'private stream URL'} for i in range(505)]
        result = json.loads(resolver.playlist_payload({'title': 'Mix', 'entries': rows}))
        self.assertEqual(result['title'], 'Mix')
        self.assertEqual(len(result['entries']), 501)
        self.assertEqual(result['entries'][0]['id'], '0')
        self.assertEqual(result['entries'][-1]['id'], '500')
        self.assertNotIn('url', result['entries'][0])
        self.assertEqual(json.loads(resolver.playlist_payload({'entries': [None]}))['entries'][0]['id'], None)

    def test_reject_oversized_payload(self):
        with self.assertRaises(ValueError):
            resolver.playlist_payload({'title': 'x' * 8_000_001})


if __name__ == '__main__':
    unittest.main()
