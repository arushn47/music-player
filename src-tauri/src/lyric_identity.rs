use regex::Regex;
use std::sync::OnceLock;

pub fn fingerprint(value: &str) -> String {
    // Preserve combining marks: dropping them changes Tamil/Hindi/etc words.
    static PUNCTUATION: OnceLock<Regex> = OnceLock::new();
    PUNCTUATION
        .get_or_init(|| Regex::new(r"[^\p{L}\p{M}\p{N}]").unwrap())
        .replace_all(&value.to_lowercase(), "")
        .into_owned()
}

pub fn title(value: &str) -> String {
    fingerprint(&query_title(value))
}

pub fn query_title(value: &str) -> String {
    static LABELS: OnceLock<Regex> = OnceLock::new();
    static FILM: OnceLock<Regex> = OnceLock::new();
    static FEATURED: OnceLock<Regex> = OnceLock::new();
    let value = LABELS.get_or_init(|| Regex::new(r"(?i)[\[(](?:official\s+(?:music\s+)?video|official\s+audio|lyric\s+video|lyrics|audio|hd|hq|4k)[\])]").unwrap()).replace_all(value, "");
    let value = FILM
        .get_or_init(|| Regex::new(r#"(?i)\s*(?:[-–—]\s*)?(?:[\[(]from\s+|from\s+[\"“]).*$"#).unwrap())
        .replace(&value, "");
    let value = FEATURED
        .get_or_init(|| Regex::new(r"(?i)\s+[\[(]?(?:feat\.?|ft\.?|featuring)\s+.*$").unwrap())
        .replace(&value, "");
    value
        .trim()
        .trim_end_matches(['-', '–', '—'])
        .trim()
        .to_string()
}

pub fn credits(value: &str) -> Vec<String> {
    static SPLIT: OnceLock<Regex> = OnceLock::new();
    let value = value.trim().trim_end_matches(" - Topic");
    if value.is_empty()
        || ["unknownartist", "unknown", "youtube"].contains(&fingerprint(value).as_str())
    {
        return vec![];
    }
    let mut credits = vec![value.to_string()];
    for credit in SPLIT
        .get_or_init(|| {
            Regex::new(r"(?i)\s*(?:,|;|&|、|，|\s+and\s+|\s+(?:feat\.?|ft\.?|featuring)\s+)\s*")
                .unwrap()
        })
        .split(value)
    {
        let credit = credit.trim();
        if !credit.is_empty()
            && !credits
                .iter()
                .any(|c| fingerprint(c) == fingerprint(credit))
        {
            credits.push(credit.to_string());
        }
    }
    credits
}

pub fn primary_artist(value: &str) -> String {
    let credits = credits(value);
    if credits.len() > 1 {
        credits[1].clone()
    } else {
        credits.first().cloned().unwrap_or_default()
    }
}

pub fn artists_match(left: &str, right: &str) -> bool {
    let left = credits(left);
    let right = credits(right);
    left.iter().any(|l| {
        right
            .iter()
            .any(|r| !fingerprint(l).is_empty() && fingerprint(l) == fingerprint(r))
    })
}

pub fn script(text: &str) -> &'static str {
    // Display metadata only; matching never restricts a result to a language.
    for character in text.chars() {
        match character as u32 {
            0x0b80..=0x0bff => return "Tamil",
            0x0900..=0x097f => return "Devanagari",
            0x0980..=0x09ff => return "Bengali",
            0x0c00..=0x0c7f => return "Telugu",
            0x0c80..=0x0cff => return "Kannada",
            0x0d00..=0x0d7f => return "Malayalam",
            0x0600..=0x06ff => return "Arabic script",
            0x0400..=0x04ff => return "Cyrillic",
            0x3040..=0x30ff => return "Japanese",
            0x4e00..=0x9fff => return "Han characters",
            0xac00..=0xd7af => return "Korean",
            0x0e00..=0x0e7f => return "Thai",
            _ => (),
        }
    }
    "Latin / other"
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn film_annotations_match_with_or_without_quotes_and_punctuation_changes() {
        let expected = title("Veezha Veera");
        for suffix in [
            r#"(From "OM Chapter 1: Udhiram - The Blood Wood") [Tamil]"#,
            "(From OM Chapter 1_ Udhiram - The Blood Wood) [Tamil]",
            "[From OM Chapter 1 - Udhiram]",
            r#"- From "OM Chapter 1""#,
        ] { assert_eq!(title(&format!("Veezha Veera {suffix}")), expected); }
        assert_ne!(title("Veezha Veera (Live) (From OM Chapter 1)"), expected);
        assert_ne!(title("Veezha Veera 2 (From OM Chapter 1)"), expected);
        assert_eq!(query_title("From Me To You"), "From Me To You");
    }
    #[test]
    fn multilingual_identity_preserves_words_and_handles_catalog_credits() {
        assert!(artists_match("Noor, Khan, Madhurxo", "Noor"));
        assert!(artists_match(
            "Sai Abhyankkar",
            "Sai Abhyankkar, V.M. Mahalingam, Pa. Vijay"
        ));
        assert!(!artists_match("Cover Artist", "Sia"));
        assert_eq!(primary_artist("Noor, Khan, Madhurxo"), "Noor");
        assert_eq!(
            title("Karuppa Kooda Va - From \"Karuppu\""),
            title("Karuppa Kooda Va")
        );
        assert_ne!(title("கூட"), title("கட"));
        assert_eq!(title("Sunflower ft. Swae Lee"), title("Sunflower"));
        assert_ne!(title("Song (Live)"), title("Song"));
    }
}
