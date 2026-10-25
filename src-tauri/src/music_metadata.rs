use crate::{lyric_identity, provider_http};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::HashMap,
    sync::OnceLock,
    time::{Duration, Instant},
};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MusicMetadata {
    pub provider: String,
    pub source_url: String,
    pub name: String,
    pub credits: Vec<String>,
    pub release_date: Option<String>,
    pub country: Option<String>,
    pub entity_type: Option<String>,
    pub disambiguation: Option<String>,
}
pub(crate) fn album_title(value: &str) -> String {
    static LABEL: OnceLock<regex::Regex> = OnceLock::new();
    LABEL
        .get_or_init(|| {
            regex::Regex::new(
                r"(?i)\s*[\[(](?:original\s+(?:motion\s+picture\s+)?soundtrack|ost)[\])]\s*$",
            )
            .unwrap()
        })
        .replace(&lyric_identity::query_title(value), "")
        .trim()
        .to_string()
}
fn normalized(value: &str) -> String {
    lyric_identity::fingerprint(value)
}
fn quoted(value: &str) -> String {
    format!("\"{}\"", value.replace('\\', "\\\\").replace('"', "\\\""))
}
fn uuid(value: &str) -> bool {
    uuid::Uuid::parse_str(value).is_ok()
}
pub(crate) fn date(value: &str) -> Option<String> {
    let parts: Vec<_> = value.split('-').collect();
    if ![1, 2, 3].contains(&parts.len())
        || parts[0].len() != 4
        || !parts[0].bytes().all(|v| v.is_ascii_digit())
    {
        return None;
    }
    if !(1800..=2200).contains(&parts[0].parse::<u32>().ok()?) {
        return None;
    }
    if parts.len() > 1
        && (parts[1].len() != 2 || !(1..=12).contains(&parts[1].parse::<u32>().ok()?))
    {
        return None;
    }
    if parts.len() > 2 {
        let year = parts[0].parse::<u32>().ok()?;
        let month = parts[1].parse::<u32>().ok()?;
        let max = match month {
            4 | 6 | 9 | 11 => 30,
            2 => {
                if year % 4 == 0 && (year % 100 != 0 || year % 400 == 0) {
                    29
                } else {
                    28
                }
            }
            _ => 31,
        };
        if parts[2].len() != 2 || !(1..=max).contains(&parts[2].parse::<u32>().ok()?) {
            return None;
        }
    }
    Some(value.into())
}
fn mb_metadata(value: &Value, kind: &str, title: &str, artist: &str) -> Option<MusicMetadata> {
    let rows = value[if kind == "artist" {
        "artists"
    } else {
        "release-groups"
    }]
    .as_array()?;
    let expected = normalized(&if kind == "artist" {
        title.into()
    } else {
        album_title(title)
    });
    let mut matches = rows.iter().filter(|row| {
        let name = row[if kind == "artist" { "name" } else { "title" }]
            .as_str()
            .unwrap_or("");
        let score = row["score"]
            .as_u64()
            .or_else(|| row["score"].as_str()?.parse().ok())
            .unwrap_or(0);
        let credits: Vec<_> = row["artist-credit"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|credit| credit["artist"]["name"].as_str())
            .collect();
        score >= 95
            && row["id"].as_str().is_some_and(uuid)
            && normalized(&if kind == "artist" {
                name.into()
            } else {
                album_title(name)
            }) == expected
            && (kind == "artist"
                || credits
                    .iter()
                    .any(|credit| lyric_identity::artists_match(credit, artist)))
    });
    let row = matches.next()?;
    if matches.next().is_some() {
        return None;
    }
    let name = row[if kind == "artist" { "name" } else { "title" }].as_str()?;
    let mut credits = Vec::new();
    for credit in row["artist-credit"].as_array().into_iter().flatten() {
        if let Some(name) = credit["name"]
            .as_str()
            .or_else(|| credit["artist"]["name"].as_str())
        {
            if name.len() <= 4000 && !credits.iter().any(|old| old == name) {
                credits.push(name.to_string());
            }
        }
    }
    Some(MusicMetadata {
        provider: "MusicBrainz".into(),
        source_url: format!(
            "https://musicbrainz.org/{}/{}",
            if kind == "artist" {
                "artist"
            } else {
                "release-group"
            },
            row["id"].as_str()?
        ),
        name: name.into(),
        credits,
        release_date: row["first-release-date"].as_str().and_then(date),
        country: row["country"]
            .as_str()
            .filter(|v| v.len() == 2 && v.bytes().all(|c| c.is_ascii_uppercase()))
            .map(String::from),
        entity_type: row[if kind == "artist" {
            "type"
        } else {
            "primary-type"
        }]
        .as_str()
        .filter(|v| v.len() <= 100)
        .map(String::from),
        disambiguation: row["disambiguation"]
            .as_str()
            .filter(|v| !v.is_empty() && v.len() <= 1000)
            .map(String::from),
    })
}
async fn musicbrainz(
    base: &str,
    kind: &str,
    title: &str,
    artist: &str,
) -> Result<Option<MusicMetadata>, String> {
    let entity = if kind == "artist" { "artist" } else { "release-group" };
    let query = if kind == "artist" { format!("artist:{}", quoted(title)) } else { format!("releasegroup:{} AND artist:{}", quoted(&album_title(title)), quoted(&lyric_identity::primary_artist(artist))) };
    let value = brainz_json(&format!("{base}/{entity}/"), &[("query", query), ("fmt", "json".into()), ("limit", "5".into())]).await?;
    Ok(mb_metadata(&value, kind, title, artist))
}

pub(crate) async fn brainz_json(url: &str, params: &[(&str, String)]) -> Result<Value, String> {
    static LAST: tokio::sync::Mutex<Option<tokio::time::Instant>> =
        tokio::sync::Mutex::const_new(None);
    let mut last = LAST.lock().await;
    if let Some(previous) = *last {
        let wait = Duration::from_millis(1100).saturating_sub(previous.elapsed());
        if !wait.is_zero() {
            tokio::time::sleep(wait).await;
        }
    }
    let value = provider_http::optional_json(url, params).await;
    *last = Some(tokio::time::Instant::now());
    value
}
async fn metadata_from(
    mb: &str,
    apple: &str,
    kind: &str,
    title: &str,
    artist: &str,
) -> Option<MusicMetadata> {
    match musicbrainz(mb, kind, title, artist).await {
        Ok(Some(value)) => Some(value),
        _ => crate::itunes_metadata::supplemental_metadata_from(apple, kind, title, artist)
            .await
            .ok()
            .flatten(),
    }
}
type Cache = HashMap<String, (Instant, Option<MusicMetadata>)>;
static CACHE: OnceLock<tokio::sync::Mutex<Cache>> = OnceLock::new();
static GATE: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

#[tauri::command]
pub async fn music_metadata(
    kind: String,
    title: String,
    artist: String,
) -> Result<Option<MusicMetadata>, String> {
    if !["artist", "album"].contains(&kind.as_str())
        || title.trim().is_empty()
        || title.len() > 1000
        || artist.len() > 1000
        || title.chars().chain(artist.chars()).any(char::is_control)
    {
        return Err("Invalid metadata query.".into());
    }
    let key = format!("{kind}\0{title}\0{artist}");
    let cache = CACHE.get_or_init(|| tokio::sync::Mutex::new(HashMap::new()));
    let _guard = GATE.lock().await;
    if let Some((at, value)) = cache.lock().await.get(&key) {
        if at.elapsed() < Duration::from_secs(if value.as_ref().is_some_and(|value| value.provider == "MusicBrainz") { 86400 } else { 300 }) {
            return Ok(value.clone());
        }
    }
    let result = metadata_from(
        "https://musicbrainz.org/ws/2",
        "https://itunes.apple.com/search",
        &kind,
        &title,
        &artist,
    )
    .await;
    let mut entries = cache.lock().await;
    if entries.len() >= 128 {
        if let Some(oldest) = entries
            .iter()
            .min_by_key(|(_, entry)| entry.0)
            .map(|(key, _)| key.clone())
        {
            entries.remove(&oldest);
        }
    }
    entries.insert(key, (Instant::now(), result.clone()));
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    #[ignore = "explicit public metadata integration check; requires network"]
    fn live_regional_metadata() {
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        for (kind, title, artist) in [
            ("artist", "Sushin Shyam", ""),
            (
                "album",
                "Vikram (Original Motion Picture Soundtrack)",
                "Anirudh Ravichander",
            ),
        ] {
            let value = rt
                .block_on(music_metadata(kind.into(), title.into(), artist.into()))
                .unwrap()
                .expect("Expected verified metadata or iTunes fallback");
            println!(
                "{}: provider={}, date={:?}, credits={}",
                title,
                value.provider,
                value.release_date,
                value.credits.len()
            );
            if kind == "album" {
                assert!(!value.credits.is_empty());
                assert!(value.release_date.is_some());
            }
        }
    }
    #[test]
    fn provider_failure_falls_back_to_verified_itunes_metadata() {
        let (base,server)=crate::provider_http::tests::server(vec![
            ("200 OK", "{}".into()),
            ("200 OK", serde_json::json!({"results":[{"artistName":"Anirudh Ravichander","collectionName":"Vikram (Original Motion Picture Soundtrack)","collectionId":42,"releaseDate":"2022-05-15T00:00:00Z"}]}).to_string()),
        ]);
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        let result = rt
            .block_on(metadata_from(
                &base,
                &base,
                "album",
                "Vikram",
                "Anirudh Ravichander",
            ))
            .unwrap();
        assert_eq!(result.provider, "iTunes");
        assert_eq!(result.release_date.as_deref(), Some("2022-05-15"));
        assert_eq!(result.credits, ["Anirudh Ravichander"]);
        let requests = server.join().unwrap();
        assert_eq!(requests.len(), 2);
        assert!(requests[1].contains("entity=album"));
    }
    #[test]
    fn musicbrainz_http_preserves_ids_and_avoids_fallback_on_a_confident_match() {
        let (base,server)=crate::provider_http::tests::server(vec![("200 OK",serde_json::json!({"artists":[{"id":"12345678-1234-1234-1234-123456789012","name":"Sushin Shyam","score":100,"country":"IN","type":"Person"}]}).to_string())]);
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        let result = rt
            .block_on(metadata_from(
                &base,
                "http://127.0.0.1:1",
                "artist",
                "Sushin Shyam",
                "",
            ))
            .unwrap();
        assert_eq!(result.provider, "MusicBrainz");
        assert_eq!(result.country.as_deref(), Some("IN"));
        assert_eq!(server.join().unwrap().len(), 1);
    }
    #[test]
    fn rejects_ambiguous_metadata_and_preserves_structured_credits() {
        let row = serde_json::json!({"id":"12345678-1234-1234-1234-123456789012","title":"Vikram","score":100,"first-release-date":"2022-05-15","primary-type":"Album","artist-credit":[{"name":"Anirudh Ravichander","artist":{"name":"Anirudh Ravichander"}}]});
        let value = serde_json::json!({"release-groups":[row]});
        let hit = mb_metadata(
            &value,
            "album",
            "Vikram (Original Motion Picture Soundtrack)",
            "Anirudh Ravichander",
        )
        .unwrap();
        assert_eq!(hit.release_date.as_deref(), Some("2022-05-15"));
        assert_eq!(hit.credits, ["Anirudh Ravichander"]);
        assert!(mb_metadata(&value, "album", "Vikram", "Other Artist").is_none());
        assert!(mb_metadata(
            &serde_json::json!({"release-groups":[row,row]}),
            "album",
            "Vikram",
            "Anirudh Ravichander"
        )
        .is_none());
        assert!(date("2026-99-42").is_none());
        assert!(date("2025-02-29").is_none());
        assert!(date("2024-02-29").is_some());
        assert_ne!(normalized("கூட"), normalized("கட"));
        assert_eq!(
            album_title("Vikram (Original Motion Picture Soundtrack)"),
            "Vikram"
        );
        assert_ne!(album_title("Vikram (Original Background Score)"), "Vikram");
        assert_eq!(date("2022").as_deref(), Some("2022"));
        assert_eq!(quoted("A \"B\""), "\"A \\\"B\\\"\"");
    }
}
