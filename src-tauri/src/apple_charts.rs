use crate::provider_http;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::{HashMap, HashSet},
    sync::OnceLock,
    time::{Duration, Instant},
};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChartEntry {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub artwork_url: Option<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppleChart {
    pub country: String,
    pub source: String,
    pub updated_at: Option<String>,
    pub entries: Vec<ChartEntry>,
    pub stale: bool,
    pub warning: Option<String>,
}
fn text(value: Option<&str>) -> Option<String> {
    let value = value?.trim();
    (!value.is_empty() && value.len() <= 4000 && !value.chars().any(char::is_control))
        .then(|| value.to_string())
}
fn artwork(value: Option<&str>) -> Option<String> {
    let url = reqwest::Url::parse(value?).ok()?;
    (url.scheme() == "https"
        && url
            .host_str()
            .is_some_and(|host| host.ends_with(".mzstatic.com"))
        && url.username().is_empty()
        && url.password().is_none()
        && url.port_or_known_default() == Some(443))
    .then(|| {
        url.to_string()
            .replace("100x100bb", "600x600bb")
            .replace("170x170bb", "600x600bb")
    })
}
fn parse(value: &Value, country: &str, music: bool) -> Result<AppleChart, String> {
    let rows = value["feed"][if music { "results" } else { "entry" }]
        .as_array()
        .filter(|rows| !rows.is_empty() && rows.len() <= 100)
        .ok_or("Apple chart is unavailable.")?;
    let mut entries = Vec::new();
    let mut seen = HashSet::new();
    for row in rows {
        let id = if music {
            row["id"].as_str()
        } else {
            row["id"]["attributes"]["im:id"].as_str()
        };
        let Some(id) = id.and_then(|id| {
            id.parse::<u64>()
                .ok()
                .filter(|n| *n > 0)
                .map(|n| n.to_string())
        }) else {
            continue;
        };
        let title = if music {
            row["name"].as_str()
        } else {
            row["im:name"]["label"].as_str()
        };
        let artist = if music {
            row["artistName"].as_str()
        } else {
            row["im:artist"]["label"].as_str()
        };
        let (Some(title), Some(artist)) = (text(title), text(artist)) else {
            continue;
        };
        if !seen.insert(id.clone()) {
            continue;
        }
        let image = if music {
            row["artworkUrl100"].as_str()
        } else {
            row["im:image"]
                .as_array()
                .and_then(|images| images.last())
                .and_then(|image| image["label"].as_str())
        };
        entries.push(ChartEntry {
            id: format!("itunes:{id}"),
            title,
            artist,
            artwork_url: artwork(image),
        });
        if entries.len() == 10 {
            break;
        }
    }
    // Dropping a bad chart row would silently change the displayed ranks.
    if entries.len() != 10 {
        return Err("Apple returned an incomplete Top 10 chart.".into());
    }
    Ok(AppleChart {
        country: country.into(),
        source: if music {
            "Apple Music · Most Played"
        } else {
            "iTunes Store · Top Songs"
        }
        .into(),
        updated_at: text(
            value["feed"]["updated"]
                .as_str()
                .or_else(|| value["feed"]["updated"]["label"].as_str()),
        ),
        entries,
        stale: false,
        warning: None,
    })
}
async fn load(music_base: &str, itunes_base: &str, country: &str) -> Result<AppleChart, String> {
    let primary = provider_http::optional_json(
        &format!("{music_base}/api/v2/{country}/music/most-played/10/songs.json"),
        &[],
    )
    .await
    .and_then(|value| parse(&value, country, true));
    if primary.is_ok() {
        return primary;
    }
    let mut fallback = provider_http::optional_json(
        &format!("{itunes_base}/{country}/rss/topsongs/limit=10/json"),
        &[],
    )
    .await
    .and_then(|value| parse(&value, country, false))?;
    fallback.warning = Some(
        "Apple Music couldn't load; showing Apple's iTunes Store chart for this country.".into(),
    );
    Ok(fallback)
}
type Cache = HashMap<String, (Instant, AppleChart)>;
static CACHE: OnceLock<tokio::sync::Mutex<Cache>> = OnceLock::new();
static FAILED: OnceLock<tokio::sync::Mutex<HashMap<String, Instant>>> = OnceLock::new();
static GATE: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());
#[tauri::command]
pub async fn apple_chart(country: String, refresh: bool) -> Result<AppleChart, String> {
    if country.len() != 2 || !country.bytes().all(|c| c.is_ascii_lowercase()) {
        return Err("Choose a valid chart country.".into());
    }
    let cache = CACHE.get_or_init(|| tokio::sync::Mutex::new(HashMap::new()));
    let _guard = GATE.lock().await;
    let cached = cache.lock().await.get(&country).cloned();
    if let Some((at, value)) = &cached {
        if (!refresh && at.elapsed() < Duration::from_secs(3600))
            || at.elapsed() < Duration::from_secs(30)
        {
            return Ok(value.clone());
        }
    }
    let failures = FAILED.get_or_init(|| tokio::sync::Mutex::new(HashMap::new()));
    if failures
        .lock()
        .await
        .get(&country)
        .is_some_and(|at| at.elapsed() < Duration::from_secs(30))
    {
        if let Some((at, mut value)) = cached {
            if at.elapsed() < Duration::from_secs(86400) {
                value.stale = true;
                value.warning = Some("Showing the last saved chart; retry refresh shortly.".into());
                return Ok(value);
            }
        }
        return Err("Apple charts are temporarily unavailable. Retry shortly; JioSaavn charts remain available.".into());
    }
    match load(
        "https://rss.marketingtools.apple.com",
        "https://itunes.apple.com",
        &country,
    )
    .await
    {
        Ok(value) => {
            let mut entries = cache.lock().await;
            if entries.len() >= 16 {
                if let Some(key) = entries
                    .iter()
                    .min_by_key(|(_, entry)| entry.0)
                    .map(|(key, _)| key.clone())
                {
                    entries.remove(&key);
                }
            }
            entries.insert(country, (Instant::now(), value.clone()));
            Ok(value)
        }
        Err(error) => {
            let mut failed = failures.lock().await;
            if failed.len() >= 16 {
                failed.clear();
            }
            failed.insert(country, Instant::now());
            drop(failed);
            if let Some((at, mut value)) = cached {
                if at.elapsed() < Duration::from_secs(86400) {
                    value.stale = true;
                    value.warning =
                        Some("Showing the last saved chart; Apple couldn't refresh it.".into());
                    return Ok(value);
                }
            }
            Err(format!("Apple charts couldn't load for this country. JioSaavn charts remain available. {error}"))
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    #[ignore = "explicit official Apple country chart check; requires network"]
    fn live_country_charts() {
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        for country in ["in", "us"] {
            let value = rt.block_on(apple_chart(country.into(), false)).unwrap();
            assert_eq!(value.entries.len(), 10);
            assert_eq!(value.country, country);
            println!(
                "{country}: {}, {} entries, {} artwork URLs",
                value.source,
                value.entries.len(),
                value
                    .entries
                    .iter()
                    .filter(|entry| entry.artwork_url.is_some())
                    .count()
            );
        }
    }
    #[test]
    fn charts_preserve_ranking_source_and_safe_artwork() {
        let rows:Vec<_>=(1..=10).map(|id|serde_json::json!({"id":id.to_string(),"name":format!("Song {id}"),"artistName":"Artist","artworkUrl100":"https://is1-ssl.mzstatic.com/image/100x100bb.jpg"})).collect();
        let chart = parse(&serde_json::json!({"feed":{"results":rows}}), "in", true).unwrap();
        assert_eq!(chart.entries.len(), 10);
        assert_eq!(chart.entries[0].id, "itunes:1");
        assert!(chart.entries[0]
            .artwork_url
            .as_ref()
            .unwrap()
            .contains("600x600bb"));
        assert_eq!(chart.source, "Apple Music · Most Played");
        assert!(parse(
            &serde_json::json!({"feed":{"results":[rows[0]]}}),
            "in",
            true
        )
        .is_err());
        assert!(artwork(Some("https://mzstatic.com.evil.test/image.jpg")).is_none());
        assert!(artwork(Some("https://user@is1.mzstatic.com/image.jpg")).is_none());
    }
    #[test]
    fn apple_music_failure_uses_labeled_itunes_chart() {
        let rows:Vec<_>=(1..=10).map(|id|serde_json::json!({"id":{"attributes":{"im:id":id.to_string()}},"im:name":{"label":"Song"},"im:artist":{"label":"Artist"},"im:image":[]})).collect();
        let (base, server) = crate::provider_http::tests::server(vec![
            ("200 OK", "{}".into()),
            (
                "200 OK",
                serde_json::json!({"feed":{"entry":rows}}).to_string(),
            ),
        ]);
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        let result = rt.block_on(load(&base, &base, "in")).unwrap();
        assert_eq!(result.source, "iTunes Store · Top Songs");
        assert!(result.warning.is_some());
        assert_eq!(server.join().unwrap().len(), 2);
    }
}
