//! Provider composition only. Audio identity is still verified by the playback resolver.
use crate::{catalog::{self, AlbumDetails, ArtistDetails, CatalogAlbum, CatalogEntities}, itunes_metadata::{self, CatalogTrack}, lyric_identity};
use std::{collections::HashMap, sync::{Arc, Mutex, OnceLock}, time::{Duration, Instant}};

const SAAVN: &str = "https://www.jiosaavn.com/api.php";
#[derive(Clone)]
enum Value { Songs(Vec<CatalogTrack>), Entities(CatalogEntities), Artist(ArtistDetails), Album(AlbumDetails) }
type Entries = HashMap<String, (Instant, Value)>;
static CACHE: OnceLock<Mutex<Entries>> = OnceLock::new();
type Flights = HashMap<String, Arc<tokio::sync::Mutex<()>>>;
static FLIGHTS: OnceLock<Mutex<Flights>> = OnceLock::new();
fn cached(key: &str) -> Option<Value> {
    CACHE.get_or_init(|| Mutex::new(HashMap::new())).lock().unwrap_or_else(|e| e.into_inner()).get(key).filter(|(until, _)| *until > Instant::now()).map(|(_, value)| value.clone())
}
fn stale(key: &str) -> Option<Value> {
    CACHE.get_or_init(|| Mutex::new(HashMap::new())).lock().unwrap_or_else(|e| e.into_inner()).get(key).filter(|(until, _)| Instant::now().saturating_duration_since(*until) < Duration::from_secs(3600)).map(|(_, value)| value.clone())
}
fn save(key: &str, value: Value, complete: bool) {
    let mut entries = CACHE.get_or_init(|| Mutex::new(HashMap::new())).lock().unwrap_or_else(|e| e.into_inner());
    if entries.len() >= 128 { if let Some(oldest) = entries.iter().min_by_key(|(_, (until, _))| *until).map(|(key, _)| key.clone()) { entries.remove(&oldest); } }
    entries.insert(key.into(), (Instant::now() + Duration::from_secs(if complete { 600 } else { 30 }), value));
}
async fn flight(key: &str) -> tokio::sync::OwnedMutexGuard<()> {
    let lock = {
        let mut entries = FLIGHTS.get_or_init(|| Mutex::new(HashMap::new())).lock().unwrap_or_else(|e| e.into_inner());
        entries.retain(|_, value| Arc::strong_count(value) > 1);
        entries.entry(key.into()).or_insert_with(|| Arc::new(tokio::sync::Mutex::new(()))).clone()
    };
    lock.lock_owned().await
}
async fn bounded<T>(seconds: u64, future: impl std::future::Future<Output = Result<T, String>>) -> Result<T, String> {
    tokio::time::timeout(Duration::from_secs(seconds), future).await.map_err(|_| "Catalog provider timed out. Retry shortly.".to_string())?
}

fn catalog_title(title: &str) -> String {
    static COLLABORATION: OnceLock<regex::Regex> = OnceLock::new();
    COLLABORATION.get_or_init(|| regex::Regex::new(r"(?i)\s*[\[(](?:with|feat\.?|ft\.?|featuring)\s+[^\])]+[\])]").unwrap()).replace_all(title, "").into_owned()
}
pub fn relevance(query: &str, title: &str, artist: &str) -> u32 {
    let q = lyric_identity::fingerprint(query);
    if q.is_empty() { return 0; }
    let title_key = lyric_identity::fingerprint(title);
    let core = catalog_title(title);
    let artist_key = lyric_identity::fingerprint(artist);
    if q == title_key || q == lyric_identity::fingerprint(&core) { return 1000; }
    if q == lyric_identity::fingerprint(core.split(['(', '[']).next().unwrap_or(&core)) { return 950; }
    if q == artist_key || catalog::artist_names(artist).iter().any(|credit| lyric_identity::fingerprint(credit) == q) { return 900; }
    let haystack = format!("{title_key}{artist_key}");
    let terms: Vec<_> = query.split(|c: char| !c.is_alphanumeric() && !matches!(c, '\u{094d}' | '\u{0d4d}')).filter(|word| !word.is_empty() && !["and", "with", "featuring", "feat", "ft"].contains(&word.to_lowercase().as_str())).collect();
    if terms.is_empty() || !terms.iter().all(|word| haystack.contains(&lyric_identity::fingerprint(word))) { return 0; }
    100 + if title_key.contains(&q) { 100 } else { 0 }
}
fn credits(track: &CatalogTrack) -> Vec<String> {
    let names = if track.artists.is_empty() { catalog::artist_names(&track.artist) } else { track.artists.iter().flat_map(|credit| catalog::artist_names(&credit.name)).collect() };
    names.iter().map(|name| lyric_identity::fingerprint(name)).filter(|name| !name.is_empty()).collect()
}
pub(crate) fn same_recording(a: &CatalogTrack, b: &CatalogTrack) -> bool {
    if a.id == b.id { return true; }
    if lyric_identity::title(&catalog_title(&a.title)) != lyric_identity::title(&catalog_title(&b.title)) || a.duration <= 0.0 || b.duration <= 0.0 || (a.duration - b.duration).abs() > 3.0 { return false; }
    let left = credits(a); let right = credits(b);
    !left.is_empty() && !right.is_empty() && (left[0] == right[0] || left.iter().all(|name| right.contains(name)) || right.iter().all(|name| left.contains(name)))
}
fn usable(query: &str, track: &CatalogTrack) -> bool {
    let artist = track.artist.to_lowercase();
    static VERSIONS: OnceLock<regex::Regex> = OnceLock::new();
    let versions = VERSIONS.get_or_init(|| regex::Regex::new(r"(?i)\b(?:lo[\s\p{Pd}]*fi|mashup|cover|karaoke|slowed|sped[\s\p{Pd}]*up|nightcore|ringtone)\b").unwrap());
    !["original sound", "unknown artist", "ringtone"].iter().any(|label| artist.contains(label)) && !versions.find_iter(&track.title).any(|version| !lyric_identity::fingerprint(query).contains(&lyric_identity::fingerprint(version.as_str())))
}
pub(crate) fn merge_songs(query: &str, primary: Vec<CatalogTrack>, secondary: Vec<CatalogTrack>, limit: usize) -> Vec<CatalogTrack> {
    let rank = |tracks: Vec<CatalogTrack>| tracks.into_iter().enumerate().map(|(index, track)| {
        let keyword = relevance(query, &track.title, &track.artist);
        let keyword_score = if keyword >= 900 { 330 } else { 200 + keyword.saturating_sub(100) / 2 };
        // Apple exposes no play counts; preserve provider rank and use neutral missing popularity.
        let popularity = track.play_count.map(|count| ((count as f64).ln_1p() * 8.0).min(160.0) as u32).unwrap_or(80);
        let provider_rank = 100u32.saturating_sub(index as u32 * 3);
        (track, keyword, keyword_score + popularity + provider_rank)
    });
    let mut result: Vec<(CatalogTrack, u32)> = Vec::new();
    for (track, keyword, score) in rank(primary).chain(rank(secondary)).filter(|(track, keyword, _)| usable(query, track) && *keyword > 0) {
        let _ = keyword;
        // Keep a provider's distinct release visible instead of replacing it with another provider's compilation.
        if let Some((old, old_score)) = result.iter_mut().find(|(old, _)| same_recording(old, &track)
            && (old.id.split(':').next() == track.id.split(':').next()
                || lyric_identity::fingerprint(&old.album) == lyric_identity::fingerprint(&track.album))) {
            *old_score = (*old_score).max(score);
            if old.artwork_url.is_none() { old.artwork_url = track.artwork_url; }
        } else { result.push((track, score)); }
    }
    result.sort_by_key(|(_, score)| std::cmp::Reverse(*score));
    result.into_iter().take(limit).map(|(track, _)| track).collect()
}
pub async fn search(query: &str, limit: usize) -> Result<Vec<CatalogTrack>, String> {
    let key = format!("songs:{}", query.trim().to_lowercase());
    let _guard = flight(&key).await;
    if let Some(Value::Songs(mut rows)) = cached(&key) { rows.truncate(limit); return Ok(rows); }
    let (saavn, apple, brainz) = tokio::join!(bounded(6, catalog::search_from(SAAVN, query, 30)), bounded(10, itunes_metadata::search_catalog(query.into(), Some(60))), bounded(4, crate::brainz_catalog::search(query)));
    if saavn.is_err() && apple.is_err() && brainz.is_err() {
        if let Some(Value::Songs(mut rows)) = stale(&key) { rows.truncate(limit); return Ok(rows); }
        return Err("Both catalog providers are unavailable. Direct YouTube search is still separate; retry the catalog shortly.".into());
    }
    let complete = saavn.is_ok() && apple.is_ok() && brainz.is_ok();
    let rows = merge_songs(query, saavn.unwrap_or_default(), apple.unwrap_or_default(), 60);
    let mut rows = merge_songs(query, rows, brainz.unwrap_or_default(), 60);
    save(&key, Value::Songs(rows.clone()), complete && !rows.is_empty());
    rows.truncate(limit); Ok(rows)
}
fn same_album(a: &CatalogAlbum, b: &CatalogAlbum) -> bool {
    a.id == b.id || (crate::music_metadata::album_title(&a.title).to_lowercase() == crate::music_metadata::album_title(&b.title).to_lowercase() && lyric_identity::artists_match(&a.artist, &b.artist) && (a.year.is_none() || b.year.is_none() || a.year == b.year))
}
fn merge_albums(primary: Vec<CatalogAlbum>, secondary: Vec<CatalogAlbum>) -> Vec<CatalogAlbum> {
    let mut rows = primary;
    for album in secondary { if !rows.iter().any(|old| same_album(old, &album)) { rows.push(album); } }
    rows
}
pub async fn entities(query: &str) -> Result<CatalogEntities, String> {
    let key = format!("entities:{}", query.trim().to_lowercase()); let _guard = flight(&key).await;
    if let Some(Value::Entities(rows)) = cached(&key) { return Ok(rows); }
    let (saavn, apple) = tokio::join!(bounded(6, catalog::search_entities_from(SAAVN, query)), bounded(11, async { Ok(itunes_metadata::entities_from_tracks(query, search(query, 60).await?)) }));
    if saavn.is_err() && apple.is_err() {
        if let Some(Value::Entities(mut rows)) = stale(&key) { rows.warning = Some("Providers could not refresh. Showing cached catalog results.".into()); return Ok(rows); }
        return Err("Artist and album providers are temporarily unavailable.".into());
    }
    let complete = saavn.is_ok() && apple.is_ok();
    let empty = || CatalogEntities { artists: vec![], albums: vec![], warning: None };
    let mut primary = saavn.unwrap_or_else(|_| empty()); let secondary = apple.unwrap_or_else(|_| empty());
    primary.artists.retain(|artist| relevance(query, &artist.name, "") > 0);
    for artist in secondary.artists {
        if let Some(old) = primary.artists.iter_mut().find(|old| lyric_identity::fingerprint(&old.name) == lyric_identity::fingerprint(&artist.name)) {
            if old.id.contains(":name:") && !artist.id.contains(":name:") { *old = artist; }
        } else { primary.artists.push(artist); }
    }
    primary.artists.sort_by_key(|artist| std::cmp::Reverse(relevance(query, &artist.name, ""))); primary.artists.truncate(6);
    primary.albums.retain(|album| relevance(query, &album.title, &album.artist) > 0);
    primary.albums = merge_albums(primary.albums, secondary.albums);
    primary.albums.sort_by_key(|album| std::cmp::Reverse(relevance(query, &album.title, &album.artist))); primary.albums.truncate(6);
    if !complete { primary.warning = Some("Some catalog providers could not refresh. Showing verified available results.".into()); }
    save(&key, Value::Entities(primary.clone()), complete); Ok(primary)
}
fn decoded_name(value: &str) -> Result<String, String> {
    let name = urlencoding::decode(value).map_err(|_| "Invalid artist or album name encoding.")?.trim().to_string();
    if !(1..=200).contains(&name.chars().count()) || name.chars().any(char::is_control) { return Err("Invalid artist or album name.".into()); }
    Ok(name)
}
fn known_artist(id: &str) -> Option<String> {
    CACHE.get_or_init(|| Mutex::new(HashMap::new())).lock().unwrap_or_else(|e| e.into_inner()).values().find_map(|(_, value)| match value {
        Value::Entities(value) => value.artists.iter().find(|artist| artist.id == id).map(|artist| artist.name.clone()),
        Value::Songs(rows) => rows.iter().flat_map(|track| &track.artists).find(|credit| credit.id.as_deref() == Some(id)).map(|credit| credit.name.clone()),
        Value::Artist(value) if value.info.id == id => Some(value.info.name.clone()), _ => None,
    })
}
fn known_album(id: &str) -> Option<(String, String)> {
    CACHE.get_or_init(|| Mutex::new(HashMap::new())).lock().unwrap_or_else(|e| e.into_inner()).values().find_map(|(_, value)| {
        let found = match value { Value::Entities(value) => value.albums.iter().find(|album| album.id == id), Value::Artist(value) => value.albums.iter().find(|album| album.id == id), Value::Album(value) if value.info.id == id => Some(&value.info), _ => None };
        found.map(|album| (album.title.clone(), crate::lyric_identity::primary_artist(&album.artist)))
    })
}
pub async fn artist(id: &str) -> Result<ArtistDetails, String> {
    let key = format!("artist:{id}"); let _guard = flight(&key).await;
    if let Some(Value::Artist(value)) = cached(&key) { return Ok(value); }
    let name = id.strip_prefix("artist:name:").or_else(|| id.strip_prefix("saavn:artist:name:")).map(decoded_name).transpose()?.or_else(|| known_artist(id));
    let saavn_id = if id.starts_with("artist:name:") { format!("saavn:artist:name:{}", urlencoding::encode(name.as_deref().unwrap_or(""))) } else { id.into() };
    let primary = if id.starts_with("musicbrainz:") { bounded(12, crate::brainz_catalog::artist(id)).await } else if id.starts_with("itunes:") { bounded(12, itunes_metadata::lookup_artist(id.into())).await } else { bounded(6, catalog::lookup_saavn_artist(SAAVN, &saavn_id)).await };
    let mut value = match primary {
        Ok(value) => value,
        Err(error) => match name {
            Some(name) if id.starts_with("itunes:") => bounded(6, catalog::lookup_saavn_artist(SAAVN, &format!("saavn:artist:name:{}", urlencoding::encode(&name)))).await.map_err(|_| error)?,
            Some(name) => bounded(15, itunes_metadata::named_artist(&name)).await.map_err(|_| error)?,
            None => match stale(&key) { Some(Value::Artist(value)) => return Ok(value), _ => return Err(error) },
        },
    };
    let mut complete = true;
    if !value.info.id.starts_with("itunes:") {
        if let Ok(extra) = bounded(4, itunes_metadata::named_artist(&value.info.name)).await {
            value.top_tracks = merge_songs(&value.info.name, value.top_tracks, extra.top_tracks, 30);
            value.albums = merge_albums(value.albums, extra.albums);
            if value.info.artwork_url.is_none() { value.info.artwork_url = extra.info.artwork_url; }
        } else { complete = false; }
    }
    save(&key, Value::Artist(value.clone()), complete); Ok(value)
}
pub async fn album(id: &str) -> Result<AlbumDetails, String> {
    let key = format!("album:{id}"); let _guard = flight(&key).await;
    if let Some(Value::Album(value)) = cached(&key) { return Ok(value); }
    let primary = if id.starts_with("musicbrainz:") { bounded(12, crate::brainz_catalog::album(id)).await } else if id.starts_with("itunes:") { bounded(12, itunes_metadata::lookup_album(id.into())).await } else { bounded(6, catalog::lookup_saavn_album(SAAVN, id)).await };
    let value = match primary {
        Ok(value) if !value.partial => value,
        result => {
            let names = id.strip_prefix("saavn:album:search:").and_then(|value| value.split_once(':')).map(|(artist, title)| Ok::<_, String>((decoded_name(title)?, decoded_name(artist)?))).transpose()?.or_else(|| known_album(id));
            if let Some((title, artist)) = names { match bounded(12, itunes_metadata::named_album(&title, &artist)).await { Ok(value) => value, Err(_) => result? } } else { match result { Ok(value) => value, Err(error) => match stale(&key) { Some(Value::Album(value)) => return Ok(value), _ => return Err(error) } } }
        }
    };
    save(&key, Value::Album(value.clone()), !value.partial); Ok(value)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn song(id: &str, title: &str, artist: &str, duration: f64) -> CatalogTrack {
        CatalogTrack { play_count: None, id: id.into(), title: title.into(), artist: artist.into(), artists: catalog::artist_names(artist).into_iter().map(|name| itunes_metadata::CatalogArtistCredit { name, id: None }).collect(), artist_id: None, album: "Release".into(), album_id: None, duration, artwork_url: None, genre: None, language: None }
    }
    #[test]
    fn song_search_keeps_original_release_and_remix_instead_of_only_a_compilation() {
        let mut compilation = song("saavn:abcd1234", "Evening Song", "Singer & Guest", 230.0);
        compilation.album = "Holiday Collection".into();
        let mut original = song("itunes:1", "Evening Song", "Singer & Guest", 229.4);
        original.album = "Artist Album".into();
        let mut remix = song("itunes:2", "Evening Song (feat. Collaborator) [Remix]", "Singer & Guest", 230.4);
        remix.album = original.album.clone();
        let mut other_compilation = compilation.clone(); other_compilation.id = "saavn:efgh5678".into(); other_compilation.album = "Another Collection".into();
        let rows = merge_songs("Evening Song", vec![compilation, other_compilation], vec![original, remix], 20);
        let ids: Vec<_> = rows.iter().map(|row| row.id.as_str()).collect();
        assert_eq!(rows.len(), 3);
        assert!(ids.contains(&"itunes:1"));
        assert!(ids.contains(&"itunes:2"));
        assert!(relevance("Evening Song", "Evening Song (feat. Collaborator) [Remix]", "Singer") >= 900);
        // The second provider merge must not collapse the retained release again.
        assert_eq!(merge_songs("Evening Song", rows, vec![], 20).len(), 3);
    }
    #[test]
    fn wishes_merges_apple_despite_nonempty_unrelated_saavn_results() {
        let primary = vec![song("saavn:W57dnWhs", "Wishes Hasan Raheem", "Original Sound - Wishes Hasan Raheem", 15.0)];
        let official = song("itunes:1703418141", "Wishes", "Hasan Raheem, Umair & Talwiinder", 219.0);
        let rows = merge_songs("Hasan Raheem Wishes", primary, vec![official], 20);
        assert_eq!(rows.len(), 1); assert_eq!(rows[0].id, "itunes:1703418141");
    }
    #[test]
    fn pal_pal_requires_the_requested_artist_not_just_a_common_title() {
        let wrong = song("itunes:1071250381", "Pal Pal", "Arijit Singh", 240.0);
        assert!(merge_songs("Afusic Pal Pal", vec![wrong], vec![], 20).is_empty());
        assert!(merge_songs("Afusic Pal Pal", vec![song("saavn:LorkLIpV", "Pal Pal X Afusic Lo-Fi", "Anand Tripathi", 180.0)], vec![], 20).is_empty());
        assert_eq!(merge_songs("Afusic Pal Pal", vec![], vec![song("itunes:2", "Pal Pal", "Afusic & AliSoomroMusic", 148.0)], 20).len(), 1);
    }
    #[test]
    fn keyword_and_popularity_keep_official_pal_pal_collaboration_and_reject_irrelevant_hits() {
        let obscure = song("saavn:abcd1234", "Pal Pal", "Another Artist", 130.0);
        let mut official = song("itunes:2", "Pal Pal (with Talwiinder)", "Afusic, Talwiinder & AliSoomroMusic", 205.0);
        official.play_count = Some(1_440_000_000);
        let mut unrelated = song("itunes:3", "Other Hit", "Another Superstar", 200.0); unrelated.play_count = Some(u64::MAX);
        let rows = merge_songs("Pal Pal", vec![obscure], vec![official.clone(), unrelated], 20);
        assert_eq!(rows[0].id, official.id); assert_eq!(rows.len(), 2);
        assert_eq!(merge_songs("Pal Pal Afusic", vec![], vec![official], 20).len(), 1);
    }
    #[test]
    fn dedup_requires_recording_version_credits_and_duration_and_prefers_primary() {
        let primary = song("saavn:abcd1234", "Wishes", "Hasan Raheem, Umair & Talwiinder", 219.0);
        let same = song("itunes:1", "Wishes", "Hasan Raheem & Talwiinder", 218.0);
        let live = song("itunes:2", "Wishes (Live)", "Hasan Raheem", 219.0);
        let another = song("itunes:3", "Wishes", "Other Singer", 219.0);
        let longer = song("itunes:4", "Wishes", "Hasan Raheem", 250.0);
        assert!(same_recording(&primary, &same));
        for row in [&live, &another, &longer] { assert!(!same_recording(&primary, row)); }
        let rows = merge_songs("Wishes", vec![primary], vec![same, live, another, longer], 20);
        assert_eq!(rows.len(), 4); assert_eq!(rows[0].id, "saavn:abcd1234");
    }
    #[test]
    fn hasan_raheem_exact_credit_ranks_above_substrings_and_missing_artist() {
        assert!(relevance("Hasan Raheem", "Hasan Raheem", "") > relevance("Hasan Raheem", "Hasan Raheem Tribute", ""));
        assert_eq!(relevance("Hasan Raheem", "Hasan Rahim Tribute", ""), 0);
        assert_eq!(relevance("മഴ", "മഴ", "Singer"), 1000);
        assert_eq!(relevance("Hasan Raheem", "Wishes", "Hasan Raheem, Umair & Talwiinder"), 900);
    }
    #[test]
    fn cache_coalesces_identical_work_and_bounds_expiry() {
        let rt = tokio::runtime::Builder::new_current_thread().enable_all().build().unwrap();
        let count = std::sync::atomic::AtomicUsize::new(0);
        rt.block_on(async {
            let task = || async {
                let _guard = flight("test:coalesce").await;
                if cached("test:coalesce").is_none() { count.fetch_add(1, std::sync::atomic::Ordering::SeqCst); tokio::time::sleep(Duration::from_millis(5)).await; save("test:coalesce", Value::Songs(vec![]), false); }
            };
            tokio::join!(task(), task());
        });
        assert_eq!(count.load(std::sync::atomic::Ordering::SeqCst), 1);
        assert!(cached("test:coalesce").is_some());
        CACHE.get().unwrap().lock().unwrap().get_mut("test:coalesce").unwrap().0 = Instant::now() - Duration::from_secs(1);
        assert!(cached("test:coalesce").is_none()); assert!(stale("test:coalesce").is_some());
    }
    #[test]
    fn invalid_and_ambiguous_locators_never_become_provider_queries() {
        assert!(decoded_name("%00Hasan").is_err()); assert!(decoded_name("").is_err());
        let a = CatalogAlbum { id: "1".into(), title: "Release".into(), artist: "Hasan Raheem".into(), artists: vec![], year: Some(2023), artwork_url: None, track_count: None };
        let mut b = a.clone(); b.id = "2".into(); b.year = Some(2024); assert!(!same_album(&a, &b));
    }
    #[test]
    #[ignore = "explicit live search provider verification"]
    fn live_search_preserves_original_and_remix() {
        let rt = tokio::runtime::Builder::new_current_thread().enable_all().build().unwrap();
        rt.block_on(async {
            let rows = search("despacito", 20).await.unwrap();
            println!("{:?}", rows.iter().map(|row| (&row.id, &row.title, &row.artist, &row.album)).collect::<Vec<_>>());
            assert!(rows.iter().any(|row| row.title == "Despacito" && row.artist.contains("Luis Fonsi") && row.album == "VIDA"));
            assert!(rows.iter().any(|row| row.title.contains("Justin Bieber") && row.title.contains("Remix") && row.artist.contains("Luis Fonsi")));
        });
    }
    #[test]
    #[ignore = "explicit live provider and MusicBrainz coverage verification"]
    fn live_pakistani_catalog() {
        let rt = tokio::runtime::Builder::new_current_thread().enable_all().build().unwrap();
        rt.block_on(async {
            for query in ["Hasan Raheem Wishes", "Afusic Pal Pal", "Hasan Raheem"] {
                let start = Instant::now(); let rows = search(query, 30).await.unwrap();
                println!("{query}: {} rows in {:?}: {:?}", rows.len(), start.elapsed(), rows.iter().take(5).map(|row| (&row.id, &row.title, &row.artist)).collect::<Vec<_>>());
                assert!(rows.iter().all(|row| relevance(query, &row.title, &row.artist) > 0));
                if query.contains("Wishes") { assert!(rows.iter().any(|row| row.title == "Wishes" && row.artist.contains("Hasan Raheem"))); }
            }
            let profile = artist("artist:name:Hasan%20Raheem").await.unwrap();
            println!("artist: {} {}, tracks={}, albums={}", profile.info.id, profile.info.name, profile.top_tracks.len(), profile.albums.len());
            assert!(catalog::same_name(&profile.info.name, "Hasan Raheem")); assert!(!profile.top_tracks.is_empty()); assert!(!profile.albums.is_empty());
            if let Some(release) = profile.albums.first() { let details = album(&release.id).await.unwrap(); assert!(!details.tracks.is_empty()); println!("album {}: {} tracks", details.info.title, details.tracks.len()); }
            let metadata = crate::music_metadata::music_metadata("artist".into(), "Hasan Raheem".into(), "".into()).await.unwrap();
            println!("identity: {:?}", metadata.as_ref().map(|value| (&value.provider, &value.source_url))); assert!(metadata.is_some());
        });
    }
}
