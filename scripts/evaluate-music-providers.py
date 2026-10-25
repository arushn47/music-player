"""Read-only public-provider sample; no accounts, playback URLs or lyric contents."""
import argparse, concurrent.futures, json, time, urllib.parse, urllib.request
from pathlib import Path

SAMPLES = [
    ("malayalam", "Sushin Shyam", "Kumbalangi Nights"),
    ("tamil", "Anirudh Ravichander", "Vikram"),
    ("telugu", "M. M. Keeravani", "RRR"),
    ("hindi", "Amit Trivedi", "Dev D"),
    ("punjabi", "Diljit Dosanjh", "GOAT"),
    ("international", "Taylor Swift", "Midnights"),
]
def fetch(url):
    start = time.monotonic()
    try:
        request = urllib.request.Request(url, headers={"User-Agent": "Lumaire/1.0.5 (https://github.com/arushn47/music-player)", "Accept": "application/json"})
        with urllib.request.urlopen(request, timeout=10) as response:
            raw = response.read(4_000_001)
            if len(raw) > 4_000_000: raise ValueError("response exceeded 4 MB")
            value = json.loads(raw)
        return {"ok": True, "ms": round((time.monotonic()-start)*1000), "value": value}
    except Exception as error:
        return {"ok": False, "ms": round((time.monotonic()-start)*1000), "error": str(error)[:160]}
def run(day):
    result = {"date": day, "samples": [], "charts": {}, "listenbrainz": {}}
    urls = {
        "apple_music_in": "https://rss.marketingtools.apple.com/api/v2/in/music/most-played/10/songs.json",
        "apple_music_us": "https://rss.marketingtools.apple.com/api/v2/us/music/most-played/10/songs.json",
        "itunes_in": "https://itunes.apple.com/in/rss/topsongs/limit=10/json",
        "listenbrainz": "https://api.listenbrainz.org/1/explore/fresh-releases/?"+urllib.parse.urlencode({"release_date":day,"days":3,"past":"true","future":"false"}),
    }
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        responses = dict(zip(urls, pool.map(fetch, urls.values())))
    for key, response in responses.items():
        value = response.pop("value", {})
        if key == "listenbrainz":
            rows = value.get("payload", {}).get("releases", [])
            response["total"] = len(rows)
            for language, artist, album in SAMPLES:
                response[language+"_sample_artist_hits"] = sum(artist.lower() in row.get("artist_credit_name", "").lower() for row in rows)
            response["language_field_available"] = any("language" in row for row in rows)
            response["sample"] = [{k:r.get(k) for k in ["release_name","artist_credit_name","release_date"]} for r in rows[:5]]
            result[key] = response
        else:
            rows = value.get("feed", {}).get("results", value.get("feed", {}).get("entry", []))
            response["entries"] = len(rows)
            response["artwork_entries"] = sum(bool(row.get("artworkUrl100") or row.get("im:image")) for row in rows)
            response["title"] = value.get("feed", {}).get("title")
            result["charts"][key] = response
    failures = 0
    for language, artist, album in SAMPLES:
        row = {"language":language,"artist_name":artist,"album":album}
        for entity, query in [("artist", 'artist:"'+artist+'"'), ("release-group", 'releasegroup:"'+album+'" AND artist:"'+artist+'"')]:
            time.sleep(1.1)
            response = fetch("https://musicbrainz.org/ws/2/"+entity+"/?"+urllib.parse.urlencode({"query":query,"fmt":"json","limit":5}))
            value = response.pop("value", {})
            records = value.get("artists" if entity=="artist" else "release-groups", [])
            response["results"] = len(records)
            response["sample"] = [{"name":r.get("name",r.get("title")),"score":r.get("score"),"date":r.get("first-release-date"),"credits":len(r.get("artist-credit",[]))} for r in records[:2]]
            row[entity] = response
            failures = 0 if response["ok"] else failures+1
        result["samples"].append(row)
        if failures >= 2:
            result["musicbrainz_probe_stopped"] = "Two consecutive provider failures; avoid further requests. Coverage is inconclusive."
            break
    return result
if __name__ == "__main__":
    parser=argparse.ArgumentParser(); parser.add_argument("--date", required=True); parser.add_argument("--output", default=".test-data/provider-evaluation.json")
    args=parser.parse_args();
    from datetime import date
    assert date.fromisoformat(args.date).isoformat() == args.date
    output=run(args.date); Path(args.output).write_text(json.dumps(output,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps(output,ensure_ascii=False,indent=2))
