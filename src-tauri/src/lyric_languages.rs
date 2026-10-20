use crate::translation::Line;
use std::collections::{HashMap, HashSet};
use whatlang::Lang;

#[derive(serde::Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct LanguageAnalysis {
    pub line_languages: HashMap<String, Vec<String>>,
    pub english_only: bool,
}

pub fn analyze(lines: &[Line]) -> crate::Result<LanguageAnalysis> {
    if lines.is_empty() || lines.len() > 500
        || lines.iter().map(|line| line.text.len()).sum::<usize>() > 80_000
        || lines.iter().any(|line| line.id.len() > 100 || line.text.len() > 4000)
        || lines.iter().map(|line| &line.id).collect::<HashSet<_>>().len() != lines.len()
    {
        return Err("Language detection requires unique IDs, up to 500 lines and 80 KB per song.".into());
    }
    let text = lines.iter().map(|line| line.text.as_str()).collect::<Vec<_>>().join("\n");
    let english_context = whatlang::detect(&text)
        .is_some_and(|info| info.lang() == Lang::Eng && info.is_reliable());
    let mut line_languages = HashMap::new();
    let mut english_only = true;
    let mut textual_lines = 0;
    for line in lines {
        let mut languages = Vec::new();
        if line.text.chars().any(char::is_alphabetic) {
            textual_lines += 1;
            if let Some(info) = whatlang::detect(&line.text) {
                // Short lines need both their own English evidence and reliable song context.
                if info.is_reliable() || (info.lang() == Lang::Eng && info.confidence() >= 0.55 && (english_context || line.text.split_whitespace().count() >= 6)) {
                    languages.push(info.lang().code().to_string());
                }
            }
            english_only &= languages == ["eng"];
        }
        line_languages.insert(line.id.clone(), languages);
    }
    Ok(LanguageAnalysis { line_languages, english_only: english_only && textual_lines > 0 })
}

#[tauri::command]
pub fn detect_lyric_languages(lines: Vec<Line>) -> crate::Result<LanguageAnalysis> {
    analyze(&lines)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn lines(texts: &[&str]) -> Vec<Line> {
        texts.iter().enumerate().map(|(i, text)| Line { id: i.to_string(), text: text.to_string() }).collect()
    }
    #[test]
    fn english_is_local_but_latin_script_is_not_assumed_english() {
        let english = lines(&["I will always be here when you need me", "There is nothing in the world that we cannot do", "You are the only one who knows the way back home"]);
        assert!(analyze(&english).unwrap().english_only);
        for text in ["en uyire unakkaga naan varuven", "tum mere dil mein rehte ho", "Yo te quiero con todo mi corazón", "♪"] {
            assert!(!analyze(&lines(&[text])).unwrap().english_only, "{text}");
        }
    }
    #[test]
    fn mixed_song_retains_english_and_native_languages() {
        let result = analyze(&lines(&["I will always be here when you need me", "உன்னோடு நான் வாழ்ந்த காலங்கள் எல்லாம் என் நினைவில் இருக்கும்"])).unwrap();
        assert!(!result.english_only);
        assert_eq!(result.line_languages["0"], ["eng"]);
        assert_eq!(result.line_languages["1"], ["tam"]);
    }
}
