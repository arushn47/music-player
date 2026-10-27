import importlib.util
import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.tools/android-streaming/yt_dlp-2026.8.19-py3-none-any.whl'))
import yt_dlp
spec = importlib.util.spec_from_file_location('resolver', ROOT / 'src-tauri/android-streaming/src/main/python/lumaire_resolver.py')
resolver = importlib.util.module_from_spec(spec)
spec.loader.exec_module(resolver)


class AudioSelectionTests(unittest.TestCase):
    def test_real_yt_dlp_selectors_exclude_combined_and_unknown_video_formats(self):
        formats = [
            dict(format_id='140', ext='m4a', acodec='mp4a.40.2', vcodec='none', protocol='https', url='https://media.test/a'),
            dict(format_id='251', ext='webm', acodec='opus', vcodec='none', protocol='https', url='https://media.test/b'),
            dict(format_id='18', ext='mp4', acodec='aac', vcodec='h264', protocol='https', url='https://media.test/video'),
        ]
        with yt_dlp.YoutubeDL({'quiet': True}) as ydl:
            for selector in [resolver.AUDIO_FORMAT, resolver.DOWNLOAD_FORMAT]:
                selected = list(ydl.build_format_selector(selector)({'formats': formats, 'has_merged_format': True, 'incomplete_formats': False}))
                self.assertEqual([row['format_id'] for row in selected], ['140'])
            self.assertEqual(list(ydl.build_format_selector(resolver.DOWNLOAD_FORMAT)({'formats': formats[1:], 'has_merged_format': True, 'incomplete_formats': False})), [])
            only_video = [formats[-1], dict(formats[0], vcodec=None)]
            self.assertEqual(list(ydl.build_format_selector(resolver.AUDIO_FORMAT)({'formats': only_video, 'has_merged_format': True, 'incomplete_formats': False})), [])

    def test_rejects_video_silent_and_unverified_results(self):
        resolver.validate_audio_only({'vcodec': 'none', 'acodec': 'aac'})
        for info in [{}, {'vcodec': 'h264', 'acodec': 'aac'}, {'vcodec': 'none', 'acodec': 'none'}, {'acodec': 'aac'}]:
            with self.assertRaises(RuntimeError):
                resolver.validate_audio_only(info)


if __name__ == '__main__':
    unittest.main()
