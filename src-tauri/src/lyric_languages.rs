use crate::translation::Line;
use std::collections::{HashMap, HashSet};
use whatlang::Lang;

#[derive(serde::Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct LanguageAnalysis {
    pub line_languages: HashMap<String, Vec<String>>,
    pub english_only: bool,
}

// Short lyric fragments defeat n-gram detection; only unambiguous familiar English
// words may inherit a reliable English song context. Unknown Latin words stay eligible.
fn contextual_english(text: &str) -> bool {
    const WORDS: &str = "a an the i me my mine we us our ours you your yours he him his she her hers it its they them their theirs this that these those am is are was were be been being have has had do does did can could will would shall should may might must and or but if then than as at by for from in into of on onto out over under to up down with without about after before again all any both each every few many most no not only other same some such so too very just even now when where why how what who which there here always never cannot knows nothing something everything anything more much less don t s re ve ll m d ain let get got go goes going come came put take keep make made know knew think say said tell see saw look find feel want need give gave love like live life world home way back time day night sun moon money people baby dangerous problems problem aren thing things run running one two three stop start stay good bad best better big little still own right left true ooh oh yeah hey ah uh hmm na la";
    let words: Vec<_> = text.split(|c: char| !c.is_alphabetic()).filter(|word| !word.is_empty()).collect();
    words.len() >= 2 && words.iter().all(|word| WORDS.split_whitespace().any(|known| word.eq_ignore_ascii_case(known)))
}

pub fn section_label(text: &str) -> bool {
    let text = text.trim();
    text.starts_with('[') && text.ends_with(']') && !text.chars().nth(1).is_some_and(|c| c.is_ascii_digit())
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
        if line.text.chars().any(char::is_alphabetic) && !section_label(&line.text) {
            textual_lines += 1;
            let detected = whatlang::detect(&line.text);
            if (english_context || detected.as_ref().is_some_and(|info| info.lang() == Lang::Eng)) && contextual_english(&line.text) {
                languages.push("eng".into());
            } else if let Some(info) = detected {
                // Uncertain Latin fragments may be code-mixed; context alone cannot classify them.
                if info.is_reliable() {
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
    fn english_rap_does_not_need_translation() {
        let input = lines(&["Run it up, the sun is up", "To when it's down, get your money up", "I put money down on all of us", "On my people now, on what I love", "Ooh, baby, it's dangerous", "Your problems, they just aren't the same to us", "[Chorus: Hanumankind]"]);
        let analysis = analyze(&input).unwrap();
        assert!(analysis.english_only, "{analysis:?}");
    }
    #[test]
    fn english_context_does_not_swallow_romanized_or_mixed_lines() {
        let context = "I will always be here when you need me. There is nothing in the world that we cannot do.";
        for line in ["You are meri jaan", "Kal baarish hogi, stay with me", "Mujhe to lage ye bade whack, bethe bethe bane bitter", "en uyire unakkaga naan varuven"] {
            let result = analyze(&lines(&[context, line])).unwrap();
            assert!(!result.english_only, "{line}: {result:?}");
            assert_ne!(result.line_languages["1"], ["eng"], "{line}");
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
