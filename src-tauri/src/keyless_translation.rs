use crate::{translation::Line, Result};
use serde_json::Value;
use std::{collections::HashMap, time::Duration};

const TRANSLATE: &str = "https://translate.google.com/translate_a/single";
const RECOVER: &str = "https://inputtools.google.com/request";

#[derive(Debug, serde::Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Processed {
    romanisation: HashMap<String, String>,
    translation: HashMap<String, String>,
    line_languages: HashMap<String, Vec<String>>,
    warnings: Vec<String>,
}

fn supported(language: &str) -> bool {
    matches!(
        language,
        "auto"
            | "en"
            | "ta"
            | "ml"
            | "te"
            | "hi"
            | "bn"
            | "kn"
            | "mr"
            | "gu"
            | "pa"
            | "ja"
            | "ko"
            | "es"
            | "fr"
            | "de"
            | "pt"
            | "ar"
            | "zh-CN"
    )
}

fn same(left: &str, right: &str) -> bool {
    let normalize = |s: &str| {
        s.chars()
            .filter(|c| c.is_alphanumeric())
            .flat_map(char::to_lowercase)
            .collect::<String>()
    };
    normalize(left) == normalize(right)
}

fn latin(text: &str) -> bool {
    static NON_LATIN: std::sync::OnceLock<regex::Regex> = std::sync::OnceLock::new();
    !NON_LATIN
        .get_or_init(|| regex::Regex::new(r"[\p{L}&&\P{Latin}]").unwrap())
        .is_match(text)
}

async fn read_json(response: reqwest::Response) -> Result<Value> {
    if !response.status().is_success() {
        return Err(if response.status().as_u16() == 429 {
            "Google translation is busy. Wait a little and retry."
        } else {
            return Err(format!(
                "Google translation is unavailable (HTTP {}). Retry later.",
                response.status().as_u16()
            ));
        }
        .into());
    }
    let mut response = response;
    let mut bytes = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| "Translation download failed. Retry.")?
    {
        if bytes.len() + chunk.len() > 128 * 1024 {
            return Err("Translation response is too large.".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    serde_json::from_slice(&bytes)
        .map_err(|_| "Google returned an unreadable translation. Retry.".into())
}

fn translated(body: &Value) -> Result<(String, String, String)> {
    let parts = body[0]
        .as_array()
        .ok_or("Google returned an invalid translation.")?;
    let mut text = String::new();
    let mut roman = String::new();
    for part in parts {
        if let Some(value) = part[0].as_str() {
            text.push_str(value);
        }
        if let Some(value) = part[3].as_str() {
            roman.push_str(value);
        }
    }
    let language = body[2]
        .as_str()
        .filter(|s| s.len() <= 35 && s.bytes().all(|b| b.is_ascii_alphabetic() || b == b'-'))
        .ok_or("Google did not identify the lyric language.")?;
    if text.trim().is_empty() || text.len() > 8000 || roman.len() > 8000 {
        return Err("Google returned missing or oversized text.".into());
    }
    Ok((text, roman, language.into()))
}

async fn translate(
    client: &reqwest::Client,
    endpoint: &str,
    text: &str,
    language: &str,
) -> Result<(String, String, String)> {
    let response = client
        .post(endpoint)
        .header("Accept", "application/json")
        .form(&[
            ("client", "at"),
            ("sl", language),
            ("tl", "en"),
            ("dt", "t"),
            ("q", text),
        ])
        .send()
        .await
        .map_err(|_| "Could not reach Google translation. Check your connection and retry.")?;
    translated(
        &read_json(response)
            .await
            .map_err(|error| format!("Translation: {error}"))?,
    )
}

async fn process_line(
    client: reqwest::Client,
    endpoint: String,
    recovery: String,
    text: String,
    language: String,
    english_hint: bool,
) -> Result<(String, String, String)> {
    // Recheck English hints with the provider; local detection can mislabel mixed lyrics.
    let direct = translate(
        &client,
        &endpoint,
        &text,
        if english_hint { "auto" } else { &language },
    )
    .await?;
    if english_hint && direct.2 == "en" {
        return Ok(direct);
    }
    let source = if language == "auto" {
        direct.2.as_str()
    } else {
        language.as_str()
    };
    // Recovery can alter English words in mixed lines: only retry an entirely unchanged Latin line.
    if same(&direct.0, &text)
        && latin(&text)
        && matches!(
            source,
            "ta" | "ml" | "te" | "hi" | "bn" | "kn" | "mr" | "gu" | "pa" | "ja"
        )
    {
        let tool = format!("{source}-t-i0-und");
        let response = client
            .post(&recovery)
            .header("Accept", "application/json")
            .form(&[
                ("text", text.as_str()),
                ("itc", &tool),
                ("num", "1"),
                ("cp", "0"),
                ("cs", "1"),
                ("ie", "utf-8"),
                ("oe", "utf-8"),
            ])
            .send()
            .await
            .map_err(|_| "Script recovery could not connect. Retry.")?;
        let body = read_json(response)
            .await
            .map_err(|error| format!("Script recovery: {error}"))?;
        if body[0] == "SUCCESS" {
            if let Some(native) = body[1][0][1][0]
                .as_str()
                .filter(|s| !s.is_ascii() && s.len() <= 8000)
            {
                let recovered = translate(&client, &endpoint, native, source).await?;
                if same(&recovered.0, native) {
                    return Err("Recovered script was not translated. Retry or try Gemini.".into());
                }
                return Ok(recovered);
            }
        }
    }
    Ok(direct)
}

#[tauri::command]
pub async fn process_keyless_lyrics(lines: Vec<Line>, language: String) -> Result<Processed> {
    process_from(lines, language, TRANSLATE, RECOVER).await
}

async fn process_from(
    lines: Vec<Line>,
    language: String,
    endpoint: &str,
    recovery: &str,
) -> Result<Processed> {
    let analysis = crate::lyric_languages::analyze(&lines)?;
    if !supported(&language) {
        return Err("Choose a supported source language.".into());
    }
    let mut result = Processed {
        line_languages: analysis.line_languages,
        ..Default::default()
    };
    if (analysis.english_only && language == "auto") || language == "en" {
        return Ok(result);
    }
    let client = reqwest::Client::builder()
        .http1_only()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
        .connect_timeout(Duration::from_secs(4))
        .timeout(Duration::from_secs(12))
        .build()
        .map_err(|_| "Could not start translation.")?;
    let mut grouped: Vec<(String, Vec<String>)> = Vec::new();
    for line in &lines {
        if !line.text.chars().any(char::is_alphabetic) {
            continue;
        }
        if let Some((_, ids)) = grouped.iter_mut().find(|(text, _)| text == &line.text) {
            ids.push(line.id.clone());
        } else {
            grouped.push((line.text.clone(), vec![line.id.clone()]));
        }
    }
    let deadline = tokio::time::Instant::now() + Duration::from_secs(90);
    let mut failed = 0;
    let mut last_error = String::new();
    for pair in grouped.chunks(2) {
        let mut jobs = Vec::new();
        for (text, ids) in pair {
            jobs.push((
                text,
                ids,
                tokio::spawn(process_line(
                    client.clone(),
                    endpoint.into(),
                    recovery.into(),
                    text.clone(),
                    language.clone(),
                    ids.iter().any(|id| result.line_languages[id] == ["eng"]),
                )),
            ));
        }
        for (text, ids, mut job) in jobs {
            let response = tokio::time::timeout_at(deadline, &mut job).await;
            let value = match response {
                Ok(Ok(Ok(value))) => value,
                other => {
                    job.abort();
                    failed += ids.len();
                    last_error = match other {
                        Ok(Ok(Err(error))) => error,
                        _ => "Translation timed out. Retry the unfinished lines.".into(),
                    };
                    continue;
                }
            };
            let (translation, roman, detected) = value;
            let unchanged = same(&translation, text);
            // Unknown Latin text can be romanized lyrics; never label a no-op as confirmed English.
            if unchanged {
                failed += ids
                    .iter()
                    .filter(|id| result.line_languages[*id] != ["eng"])
                    .count();
                continue;
            }
            for id in ids {
                result.translation.insert(id.clone(), translation.clone());
                if !text.is_ascii()
                    && !roman.trim().is_empty()
                    && roman.chars().all(|c| {
                        !c.is_alphabetic() || c.is_ascii() || ('\u{00c0}'..='\u{024f}').contains(&c)
                    })
                {
                    result.romanisation.insert(id.clone(), roman.clone());
                }
                result
                    .line_languages
                    .insert(id.clone(), vec![detected.clone()]);
            }
        }
        if tokio::time::Instant::now() >= deadline {
            result.warnings.push(
                "Time limit reached. Some lines remain untranslated; retry or try Gemini.".into(),
            );
            break;
        }
    }
    if failed > 0 {
        result.warnings.push(format!("{failed} lines could not be translated. Choose the source language for romanized lyrics, retry, or try Gemini. {last_error}"));
    }
    if result.translation.is_empty() && failed > 0 {
        return Err(result.warnings.join(" "));
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::provider_http::tests::server;
    fn lines(texts: &[&str]) -> Vec<Line> {
        texts
            .iter()
            .enumerate()
            .map(|(i, text)| Line {
                id: format!("line-{i}"),
                text: text.to_string(),
            })
            .collect()
    }
    fn body(text: &str, lang: &str) -> String {
        serde_json::json!([[[text, "original", null, null]], null, lang]).to_string()
    }
    fn run(lines: Vec<Line>, language: &str, endpoint: &str) -> Result<Processed> {
        tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap()
            .block_on(process_from(lines, language.into(), endpoint, endpoint))
    }
    #[test]
    fn validates_and_skips_english_without_network() {
        assert!(latin("naalai mazhai — nān"));
        assert!(!latin("நாளை"));
        assert!(run(
            lines(&["I will always be here when you need me"]),
            "auto",
            "invalid"
        )
        .unwrap()
        .translation
        .is_empty());
        assert!(run(lines(&["தமிழ்"]), "https://evil.test", "invalid").is_err());
        assert!(run(
            lines(&["தமிழ்"])
                .into_iter()
                .chain(lines(&["more"]))
                .collect(),
            "auto",
            "invalid"
        )
        .is_err());
        assert!(translated(&serde_json::json!({})).is_err());
        assert!(translated(&serde_json::json!([[["", null]], null, "ta"])).is_err());
    }
    #[test]
    fn english_hint_does_not_discard_a_different_translation() {
        let (url, server) = server(vec![(
            "200 OK",
            body("A different translated sentence", "hi"),
        )]);
        let output = run(
            lines(&["I will always be here when you need me"]),
            "hi",
            &url,
        )
        .unwrap();
        assert_eq!(
            output.translation["line-0"],
            "A different translated sentence"
        );
        assert!(server.join().unwrap()[0].contains("sl=auto"));
    }
    #[test]
    fn recovers_script_deduplicates_and_preserves_ids() {
        let text = "naalai mazhai vanthaalum naan unnudan nadappen";
        let (url, server) = server(vec![
            ("200 OK", body(text, "ta")),
            (
                "200 OK",
                serde_json::json!(["SUCCESS", [[text, ["நாளை மழை வந்தாலும் நான் உன்னுடன் நடப்பேன்"]]]])
                    .to_string(),
            ),
            (
                "200 OK",
                body("Even if it rains tomorrow I will walk with you", "ta"),
            ),
        ]);
        let output = run(lines(&[text, text]), "ta", &url).unwrap();
        assert_eq!(output.translation.len(), 2);
        assert_eq!(output.translation["line-0"], output.translation["line-1"]);
        assert!(output.warnings.is_empty());
        let requests = server.join().unwrap();
        assert_eq!(requests.len(), 3);
        assert!(requests[0].contains("sl=ta"));
        assert!(requests[1].contains("itc=ta-t-i0-und"));
    }
    #[test]
    fn partial_failures_are_visible_and_noops_are_not_success() {
        let (url, server) = server(vec![
            ("503 Service Unavailable", "{}".into()),
            ("200 OK", body("I will walk with you", "ta")),
        ]);
        let output = run(lines(&["தமிழ் ஒன்று", "தமிழ் இரண்டு"]), "ta", &url).unwrap();
        assert_eq!(output.translation.len(), 1);
        assert_eq!(output.warnings.len(), 1);
        server.join().unwrap();
        let (url, server) =
            crate::provider_http::tests::server(vec![("200 OK", body("naeil biga wado", "ko"))]);
        assert!(run(lines(&["naeil biga wado"]), "ko", &url).is_err());
        server.join().unwrap();
    }
    #[test]
    #[ignore = "opt-in real Google translation; synthetic text only"]
    fn live_keyless_translation() {
        let output = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap()
            .block_on(process_from(
                lines(&[
                    "naalai mazhai vanthaalum naan unnudan nadappen",
                    "I will always be here when you need me",
                ]),
                "ta".into(),
                TRANSLATE,
                RECOVER,
            ))
            .unwrap();
        assert!(output.translation["line-0"].to_lowercase().contains("rain"));
        assert!(!output.translation.contains_key("line-1"));
    }
}
