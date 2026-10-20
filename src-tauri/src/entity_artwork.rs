use crate::{lyric_identity, provider_http, Result};
use rusqlite::OptionalExtension;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::AppHandle;

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EntityArtwork {
    url: String,
    source_url: String,
    credit: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    Artist,
    Album,
}

fn musician(description: &str) -> bool {
    let words: Vec<_> = description
        .to_lowercase()
        .split(|ch: char| !ch.is_alphanumeric() && ch != '-')
        .filter(|word| !word.is_empty())
        .map(str::to_string)
        .collect();
    [
        "singer",
        "rapper",
        "musician",
        "composer",
        "lyricist",
        "band",
        "musical group",
        "hip-hop artist",
    ]
    .iter()
    .any(|word| {
        words
            .windows(word.split_whitespace().count())
            .any(|parts| parts.join(" ") == *word)
    })
}

fn portrait_file(data: &Value) -> Option<&str> {
    let matches: Vec<_> = data["query"]["pages"]
        .as_object()?
        .values()
        .filter(|page| {
            page.get("missing").is_none()
                && page["pageprops"].get("disambiguation").is_none()
                && page["pageprops"]["wikibase_item"].as_str().is_some()
                && page["pageprops"]["wikibase-shortdesc"]
                    .as_str()
                    .is_some_and(musician)
        })
        .collect();
    if matches.len() != 1 {
        return None;
    }
    matches[0]["pageprops"]["page_image_free"]
        .as_str()
        .or_else(|| matches[0]["pageimage"].as_str())
}

async fn json(base: &str, params: &[(&str, String)]) -> Result<Value> {
    provider_http::get(base, params)
        .await?
        .error_for_status()
        .map_err(|_| "Artwork catalogue is unavailable.")?
        .json()
        .await
        .map_err(|_| "Invalid artwork catalogue response.".into())
}

async fn portrait(wikipedia: &str, commons: &str, name: &str) -> Result<Option<EntityArtwork>> {
    // Exact article names and explicit redirects avoid unrelated search-result photos.
    let titles = [
        name.to_string(),
        format!("{name} (musician)"),
        format!("{name} (rapper)"),
        format!("{name} (band)"),
        format!("{name} (singer)"),
    ]
    .join("|");
    let pages = json(
        wikipedia,
        &[
            ("action", "query".into()),
            ("titles", titles),
            ("redirects", "1".into()),
            ("prop", "pageimages|pageprops".into()),
            ("piprop", "name".into()),
            ("pilicense", "free".into()),
            ("format", "json".into()),
        ],
    )
    .await?;
    let Some(file) = portrait_file(&pages).filter(|file| !file.is_empty() && file.len() <= 500)
    else {
        return Ok(None);
    };
    let image = json(
        commons,
        &[
            ("action", "query".into()),
            ("titles", format!("File:{file}")),
            ("prop", "imageinfo".into()),
            ("iiprop", "url|mime|extmetadata".into()),
            ("iiurlwidth", "300".into()),
            ("format", "json".into()),
        ],
    )
    .await?;
    let info = image["query"]["pages"]
        .as_object()
        .into_iter()
        .flat_map(|pages| pages.values())
        .find_map(|page| page["imageinfo"].as_array()?.first());
    Ok(info.and_then(portrait_image))
}

fn portrait_image(info: &Value) -> Option<EntityArtwork> {
    let metadata = &info["extmetadata"];
    if !crate::libre_license(metadata["License"]["value"].as_str()?) {
        return None;
    }
    let url = info["thumburl"].as_str().or_else(|| info["url"].as_str())?;
    let source_url = info["descriptionurl"].as_str()?;
    if !matches!(
        info["mime"].as_str(),
        Some("image/jpeg" | "image/png" | "image/webp")
    ) || !reqwest::Url::parse(url).is_ok_and(|url| {
        url.scheme() == "https"
            && matches!(
                url.host_str(),
                Some("upload.wikimedia.org" | "thumb.wikimedia.org")
            )
    }) || !reqwest::Url::parse(source_url)
        .is_ok_and(|url| url.scheme() == "https" && url.host_str() == Some("commons.wikimedia.org"))
    {
        return None;
    }
    Some(EntityArtwork {
        url: url.into(),
        source_url: source_url.into(),
        credit: format!(
            "{} · {} · Wikimedia Commons",
            crate::plain_metadata(&metadata["Artist"]),
            crate::plain_metadata(&metadata["LicenseShortName"])
        ),
    })
}

#[tauri::command]
pub async fn lookup_entity_artwork(
    app: AppHandle,
    kind: Kind,
    name: String,
    artist: String,
    track_title: String,
) -> Result<Option<EntityArtwork>> {
    if [&name, &artist, &track_title]
        .iter()
        .any(|text| text.len() > 2000)
        || name.trim().is_empty()
    {
        return Err("Invalid artwork identity.".into());
    }
    if name.to_lowercase().starts_with("unknown ") {
        return Ok(None);
    }
    let key = serde_json::to_string(&(
        match kind {
            Kind::Artist => "artist",
            Kind::Album => "album",
        },
        name.trim().to_lowercase(),
        artist.trim().to_lowercase(),
    ))
    .map_err(crate::err)?;
    let cached_key = key.clone();
    let cached: Option<String> = crate::work(app.clone(), move |_, db| {
        db.query_row(
            "SELECT metadata FROM entity_artwork WHERE identity=?1",
            [cached_key],
            |row| row.get(0),
        )
        .optional()
        .map_err(crate::err)
    })
    .await?;
    if let Some(cached) = cached {
        return serde_json::from_str(&cached).map_err(crate::err);
    }
    let artwork = match kind {
        Kind::Artist => {
            portrait(
                "https://en.wikipedia.org/w/api.php",
                "https://commons.wikimedia.org/w/api.php",
                &name,
            )
            .await?
        }
        Kind::Album => crate::lookup_metadata(track_title, artist, 0.0)
            .await?
            .filter(|metadata| {
                lyric_identity::fingerprint(&metadata.album) == lyric_identity::fingerprint(&name)
            })
            .and_then(|metadata| {
                metadata.artwork_url.map(|url| EntityArtwork {
                    url,
                    source_url: String::new(),
                    credit: format!("{} · {}", metadata.artist, metadata.album),
                })
            }),
    };
    if let Some(value) = &artwork {
        let metadata = serde_json::to_string(value).map_err(crate::err)?;
        crate::work(app, move |_, db| {
            db.execute("INSERT INTO entity_artwork(identity,metadata) VALUES(?1,?2) ON CONFLICT(identity) DO UPDATE SET metadata=excluded.metadata", [key, metadata]).map_err(crate::err)?;
            Ok(())
        }).await?;
    }
    Ok(artwork)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    #[ignore = "explicit public Wikipedia/Commons check; requires network"]
    fn live_regional_artist_portraits() {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        let mut found = 0;
        for name in ["Sai Abhyankkar", "Emiway", "KR$NA"] {
            let image = runtime
                .block_on(portrait(
                    "https://en.wikipedia.org/w/api.php",
                    "https://commons.wikimedia.org/w/api.php",
                    name,
                ))
                .unwrap();
            println!(
                "{name}: {}",
                image
                    .as_ref()
                    .map(|image| image.source_url.as_str())
                    .unwrap_or("no verified portrait")
            );
            found += usize::from(image.is_some());
        }
        assert!(
            found >= 2,
            "Expected portraits for at least two public artist records"
        );
    }
    #[test]
    fn portrait_http_contract_preserves_credits_and_rejects_ambiguous_people() {
        let mut pages = serde_json::json!({"query":{"pages":{"1":{"pageprops":{"wikibase_item":"Q123","wikibase-shortdesc":"Indian rapper","page_image_free":"Portrait.jpg"}}}}});
        assert_eq!(portrait_file(&pages), Some("Portrait.jpg"));
        let (base, server) = provider_http::tests::server(vec![
            ("200 OK", pages.to_string()),
            ("200 OK", r#"{"query":{"pages":{"1":{"imageinfo":[{"mime":"image/jpeg","thumburl":"https://thumb.wikimedia.org/portrait.jpg","descriptionurl":"https://commons.wikimedia.org/wiki/File:Portrait.jpg","extmetadata":{"License":{"value":"cc-by-sa-4.0"},"Artist":{"value":"Photographer"},"LicenseShortName":{"value":"CC BY-SA 4.0"}}}]}}}}"#.into()),
        ]);
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        let image = runtime
            .block_on(portrait(&base, &base, "Stage Name"))
            .unwrap()
            .unwrap();
        assert!(image.credit.contains("Photographer"));
        assert!(image.url.ends_with("portrait.jpg"));
        let requests = server.join().unwrap();
        assert_eq!(requests.len(), 2);
        assert!(requests[1].contains("titles=File%3APortrait.jpg"));
        pages["query"]["pages"]["2"] = pages["query"]["pages"]["1"].clone();
        assert!(portrait_file(&pages).is_none());
        pages["query"]["pages"]["2"]["pageprops"]["disambiguation"] = "".into();
        assert!(portrait_file(&pages).is_some());
    }
    #[test]
    fn portrait_hosts_and_image_license_are_verified() {
        assert!(musician("Indian hip-hop artist (born 1995)"));
        assert!(musician("Pakistani rock band"));
        assert!(!musician("2025 film"));
        assert!(!musician("bandwidth specialist"));
        let mut image = serde_json::json!({"mime":"image/jpeg","thumburl":"https://upload.wikimedia.org/a.jpg","descriptionurl":"https://commons.wikimedia.org/wiki/File:Artist.jpg","extmetadata":{"License":{"value":"cc-by-sa-4.0"},"Artist":{"value":"<b>Photographer</b>"},"LicenseShortName":{"value":"CC BY-SA 4.0"}}});
        assert!(portrait_image(&image)
            .unwrap()
            .credit
            .contains("Photographer"));
        image["thumburl"] = "https://evil.example/a.jpg".into();
        assert!(portrait_image(&image).is_none());
        image["thumburl"] = "https://upload.wikimedia.org/a.jpg".into();
        image["extmetadata"]["License"]["value"] = "all-rights-reserved".into();
        assert!(portrait_image(&image).is_none());
    }
}
