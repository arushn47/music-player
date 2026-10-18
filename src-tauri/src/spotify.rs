use base64::Engine;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::time::{Duration, SystemTime};

/// Spotify API client with token caching
pub struct SpotifyClient {
    client_id: String,
    client_secret: String,
    token_cache: Mutex<Option<CachedToken>>,
    unavailable_until: Mutex<Option<SystemTime>>,
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn metadata_uses_the_renderer_camel_case_contract() {
        let value = serde_json::to_value(SpotifyMetadata {
            title: "Song".into(),
            artist: "Artist".into(),
            album: "Album".into(),
            duration_ms: 173000,
            artwork_url: None,
            spotify_url: "".into(),
            spotify_id: "id".into(),
        })
        .unwrap();
        assert_eq!(value["durationMs"], 173000);
        assert!(value.get("artworkUrl").is_some());
        assert!(value.get("duration_ms").is_none());
    }
}

struct CachedToken {
    access_token: String,
    expires_at: SystemTime,
}

#[derive(Debug, Serialize, Deserialize)]
struct TokenResponse {
    access_token: String,
    token_type: String,
    expires_in: u64,
}

#[derive(Debug, Deserialize)]
struct SpotifySearchResponse {
    tracks: SpotifyTracksPage,
}

#[derive(Debug, Deserialize)]
struct SpotifyTracksPage {
    items: Vec<SpotifyTrack>,
}

#[derive(Debug, Deserialize)]
struct SpotifyTrack {
    name: String,
    artists: Vec<SpotifyArtist>,
    album: SpotifyAlbum,
    duration_ms: u64,
    external_urls: SpotifyExternalUrls,
    id: String,
}

#[derive(Debug, Deserialize)]
struct SpotifyArtist {
    name: String,
}

#[derive(Debug, Deserialize)]
struct SpotifyAlbum {
    name: String,
    images: Vec<SpotifyImage>,
}

#[derive(Debug, Deserialize)]
struct SpotifyImage {
    url: String,
    width: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct SpotifyExternalUrls {
    spotify: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpotifyMetadata {
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration_ms: u64,
    pub artwork_url: Option<String>,
    pub spotify_url: String,
    pub spotify_id: String,
}

impl SpotifyClient {
    pub fn new(client_id: String, client_secret: String) -> Self {
        Self {
            client_id,
            client_secret,
            token_cache: Mutex::new(None),
            unavailable_until: Mutex::new(None),
        }
    }

    /// Get a valid access token, refreshing if necessary
    async fn get_token(&self) -> Result<String, String> {
        // Check cache first
        {
            let cache = self.token_cache.lock().map_err(|e| e.to_string())?;
            if let Some(ref cached) = *cache {
                if SystemTime::now() < cached.expires_at {
                    return Ok(cached.access_token.clone());
                }
            }
        }

        // Request new token
        let client = crate::provider_http::client()?;
        let auth = base64::engine::general_purpose::STANDARD
            .encode(format!("{}:{}", self.client_id, self.client_secret));

        let response = client
            .post("https://accounts.spotify.com/api/token")
            .header("Authorization", format!("Basic {}", auth))
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body("grant_type=client_credentials")
            .send()
            .await
            .map_err(|e| format!("Spotify token request failed: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("Spotify auth failed: {}", response.status()));
        }

        let token_data: TokenResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse token response: {}", e))?;

        // Cache the token
        let expires_at =
            SystemTime::now() + Duration::from_secs(token_data.expires_in.saturating_sub(60));
        let access_token = token_data.access_token.clone();

        {
            let mut cache = self.token_cache.lock().map_err(|e| e.to_string())?;
            *cache = Some(CachedToken {
                access_token: access_token.clone(),
                expires_at,
            });
        }

        Ok(access_token)
    }

    /// Search for a track by title and artist
    pub async fn search_track(
        &self,
        title: &str,
        artist: &str,
        duration: f64,
    ) -> Result<Option<SpotifyMetadata>, String> {
        if self
            .unavailable_until
            .lock()
            .map_err(|e| e.to_string())?
            .is_some_and(|until| SystemTime::now() < until)
        {
            return Ok(None);
        }
        let token = self.get_token().await?;

        // Build search query
        let query = if !artist.is_empty() {
            format!("track:{} artist:{}", title, artist)
        } else {
            format!("track:{}", title)
        };

        eprintln!("[Spotify] Searching: {}", query);

        let client = crate::provider_http::client()?;
        let response = client
            .get("https://api.spotify.com/v1/search")
            .header("Authorization", format!("Bearer {}", token))
            .query(&[
                ("q", query),
                ("type", "track".to_string()),
                ("limit", "5".to_string()),
            ])
            .send()
            .await
            .map_err(|e| format!("Spotify search failed: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            if status == reqwest::StatusCode::FORBIDDEN
                || status == reqwest::StatusCode::TOO_MANY_REQUESTS
            {
                // Don't repeat a known account/quota failure for every play.
                let seconds = response
                    .headers()
                    .get("retry-after")
                    .and_then(|v| v.to_str().ok())
                    .and_then(|v| v.parse::<u64>().ok())
                    .unwrap_or(300)
                    .max(60);
                *self.unavailable_until.lock().map_err(|e| e.to_string())? =
                    Some(SystemTime::now() + Duration::from_secs(seconds));
            }
            let body = response.text().await.unwrap_or_default();
            eprintln!("[Spotify] Search failed with status {}: {}", status, body);
            return Err(format!("Spotify search returned: {}", status));
        }

        let body_text = response
            .text()
            .await
            .map_err(|e| format!("Failed to read Spotify response: {}", e))?;

        let search_result: SpotifySearchResponse = serde_json::from_str(&body_text)
            .map_err(|e| format!("Failed to parse Spotify response: {}", e))?;

        let Some(track) = search_result.tracks.items.iter().find(|track| {
            !crate::lyric_identity::title(title).is_empty()
                && crate::lyric_identity::title(&track.name) == crate::lyric_identity::title(title)
                && track
                    .artists
                    .iter()
                    .any(|a| crate::lyric_identity::artists_match(&a.name, artist))
                && (duration <= 0.0 || (track.duration_ms as f64 / 1000.0 - duration).abs() <= 10.0)
        }) else {
            return Ok(None);
        };
        let artist_name = track
            .artists
            .first()
            .map(|a| a.name.clone())
            .unwrap_or_else(|| "Unknown Artist".to_string());

        // Get best quality artwork (prefer medium size ~300px)
        let artwork_url = track
            .album
            .images
            .iter()
            .filter(|img| img.width.map(|w| w >= 200 && w <= 400).unwrap_or(false))
            .next()
            .or_else(|| track.album.images.first())
            .map(|img| img.url.clone());

        let metadata = SpotifyMetadata {
            title: track.name.clone(),
            artist: artist_name,
            album: track.album.name.clone(),
            duration_ms: track.duration_ms,
            artwork_url,
            spotify_url: track.external_urls.spotify.clone(),
            spotify_id: track.id.clone(),
        };

        eprintln!(
            "[Spotify] Found: '{}' by '{}' from '{}'",
            metadata.title, metadata.artist, metadata.album
        );

        Ok(Some(metadata))
    }
}
