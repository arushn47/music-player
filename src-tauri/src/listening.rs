//! Device-local, cumulative listening checkpoints. No library membership is created.
use crate::{err, work, Result};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use tauri::AppHandle;

const QUALIFIED_MS: i64 = 10_000;
const MAX_TIME: i64 = 8_640_000_000_000_000;
const MAX_LISTENED: i64 = 7 * 24 * 60 * 60 * 1000;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ListeningRecord {
    pub id: String,
    pub track_id: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub artwork_url: Option<String>,
    pub provider_id: Option<String>,
    pub source_id: Option<String>,
    #[serde(default)]
    pub metadata_source_id: Option<String>,
    pub started_at: i64,
    pub updated_at: i64,
    pub listened_ms: i64,
    pub days: BTreeMap<String, i64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListeningHistory {
    pub generation: i64,
    pub records: Vec<ListeningRecord>,
}

pub fn initialize(db: &Connection) -> Result<()> {
    db.execute_batch(
        "CREATE TABLE IF NOT EXISTS listening_state (
            id INTEGER PRIMARY KEY CHECK(id=1), generation INTEGER NOT NULL CHECK(generation>=0));
         INSERT OR IGNORE INTO listening_state(id,generation) VALUES(1,0);
         CREATE TABLE IF NOT EXISTS listening_records (
            id TEXT PRIMARY KEY, started_at INTEGER NOT NULL, listened_ms INTEGER NOT NULL,
            data TEXT NOT NULL);
         CREATE INDEX IF NOT EXISTS listening_started ON listening_records(started_at DESC);",
    )
    .map_err(err)
}

fn generation(db: &Connection) -> Result<i64> {
    db.query_row(
        "SELECT generation FROM listening_state WHERE id=1",
        [],
        |r| r.get(0),
    )
    .map_err(err)
}

fn valid_date(value: &str) -> bool {
    let bytes = value.as_bytes();
    if bytes.len() != 10
        || bytes[4] != b'-'
        || bytes[7] != b'-'
        || !bytes
            .iter()
            .enumerate()
            .all(|(i, b)| i == 4 || i == 7 || b.is_ascii_digit())
    {
        return false;
    }
    let year = value[..4].parse::<u32>().unwrap_or(0);
    let month = value[5..7].parse::<u32>().unwrap_or(0);
    let day = value[8..].parse::<u32>().unwrap_or(0);
    let leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
    let max = match month {
        2 => {
            if leap {
                29
            } else {
                28
            }
        }
        4 | 6 | 9 | 11 => 30,
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        _ => 0,
    };
    year > 0 && day > 0 && day <= max
}

fn stable_identity(record: &ListeningRecord) -> bool {
    match (record.provider_id.as_deref(), record.source_id.as_deref()) {
        (None, None) => uuid::Uuid::parse_str(&record.track_id).is_ok(),
        (Some("youtube"), Some(id)) => {
            id.len() == 11
                && id
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
                && record.track_id == format!("youtube:{id}")
        }
        (Some("wikimedia-commons"), Some(id)) => {
            !id.is_empty()
                && id.len() <= 20
                && !id.starts_with('0')
                && id.bytes().all(|b| b.is_ascii_digit())
                && record.track_id == format!("wikimedia-commons:{id}")
        }
        _ => false,
    }
}

fn safe_artwork(value: &str, track_id: &str) -> bool {
    if let Some(local) = value.strip_prefix("local:") {
        let (id, query) = local.split_once('?').unwrap_or((local, ""));
        return id == track_id
            && uuid::Uuid::parse_str(id).is_ok()
            && (query.is_empty()
                || (query.starts_with("v=")
                    && query[2..].bytes().all(|b| b.is_ascii_digit() || b == b'-')));
    }
    let Ok(url) = reqwest::Url::parse(value) else {
        return false;
    };
    url.scheme() == "https"
        && url.username().is_empty()
        && url.password().is_none()
        && url.port_or_known_default() == Some(443)
        && url.query().is_none()
        && url.fragment().is_none()
        && url.host_str().is_some_and(|host| {
            matches!(
                host,
                "i.ytimg.com"
                    | "c.saavncdn.com"
                    | "i.scdn.co"
                    | "upload.wikimedia.org"
                    | "coverartarchive.org"
                    | "archive.org"
                    | "lastfm.freetls.fastly.net"
                    | "lastfm-img.freetls.fastly.net"
            ) || host.ends_with(".archive.org")
                || host.ends_with(".mzstatic.com")
        })
}

pub(crate) fn validate(record: &mut ListeningRecord) -> Result<()> {
    let text_valid = [&record.title, &record.artist, &record.album]
        .iter()
        .all(|s| s.len() <= 2048 && !s.chars().any(char::is_control));
    let sum = record
        .days
        .values()
        .try_fold(0_i64, |sum, value| sum.checked_add(*value));
    if uuid::Uuid::parse_str(&record.id).is_err()
        || !stable_identity(record)
        || record.metadata_source_id.as_ref().is_some_and(|id| !crate::catalog::valid_catalog_id(id))
        || !text_valid
        || record.started_at < 0
        || record.updated_at < record.started_at
        || record.updated_at > MAX_TIME
        || record.listened_ms < 0
        || record.listened_ms > MAX_LISTENED
        || record.listened_ms > record.updated_at - record.started_at + 1000
        || record.days.len() > 366
        || sum != Some(record.listened_ms)
        || record
            .days
            .iter()
            // A local calendar day may contain 25 hours across a DST rollback.
            .any(|(day, time)| !valid_date(day) || *time < 0 || *time > 90_000_000)
    {
        return Err("Invalid listening checkpoint. Existing history was preserved.".into());
    }
    // Artwork is optional; unsupported URLs must never persist credentials/query data.
    if record
        .artwork_url
        .as_ref()
        .is_some_and(|url| url.len() > 2048 || !safe_artwork(url, &record.track_id))
    {
        record.artwork_url = None;
    }
    Ok(())
}

pub(crate) fn read(db: &Connection) -> Result<ListeningHistory> {
    let mut stmt = db.prepare("SELECT data FROM listening_records WHERE listened_ms>=?1 ORDER BY started_at DESC,id DESC").map_err(err)?;
    let rows = stmt
        .query_map([QUALIFIED_MS], |r| r.get::<_, String>(0))
        .map_err(err)?;
    let records = rows
        .map(|row| serde_json::from_str(&row.map_err(err)?).map_err(err))
        .collect::<Result<Vec<ListeningRecord>>>()?;
    Ok(ListeningHistory {
        generation: generation(db)?,
        records,
    })
}

pub(crate) fn checkpoint(
    db: &mut Connection,
    expected_generation: i64,
    mut record: ListeningRecord,
) -> Result<bool> {
    validate(&mut record)?;
    let tx = db.transaction().map_err(err)?;
    if generation(&tx)? != expected_generation {
        return Ok(false);
    }
    let accepted = write_record(&tx, record.clone())?;
    if accepted { crate::device_sync::checkpoint(&tx, &record)?; }
    tx.commit().map_err(err)?;
    Ok(accepted)
}

pub(crate) fn write_record(db: &Connection, mut record: ListeningRecord) -> Result<bool> {
    validate(&mut record)?;
    let existing: Option<String> = db
        .query_row(
            "SELECT data FROM listening_records WHERE id=?1",
            [&record.id],
            |r| r.get(0),
        )
        .optional()
        .map_err(err)?;
    if let Some(existing) = existing {
        let previous: ListeningRecord = serde_json::from_str(&existing).map_err(err)?;
        if previous.track_id != record.track_id
            || previous.started_at != record.started_at
            || previous.provider_id != record.provider_id
            || previous.source_id != record.source_id
        {
            return Err("A listening checkpoint cannot change its playback identity.".into());
        }
        // Retries and delayed writes may not regress either totals or day attribution.
        if record.listened_ms < previous.listened_ms
            || record.updated_at < previous.updated_at
            || previous
                .days
                .iter()
                .any(|(day, time)| record.days.get(day).unwrap_or(&0) < time)
        {
            return Ok(true);
        }
    }
    let data = serde_json::to_string(&record).map_err(err)?;
    db.execute(
        "INSERT INTO listening_records(id,started_at,listened_ms,data) VALUES(?1,?2,?3,?4)
        ON CONFLICT(id) DO UPDATE SET listened_ms=excluded.listened_ms,data=excluded.data",
        params![record.id, record.started_at, record.listened_ms, data],
    )
    .map_err(err)?;
    Ok(true)
}

pub(crate) fn clear(db: &mut Connection) -> Result<i64> {
    let tx = db.transaction().map_err(err)?;
    let next = generation(&tx)?
        .checked_add(1)
        .ok_or("Listening history generation limit reached.")?;
    tx.execute("DELETE FROM listening_records", [])
        .map_err(err)?;
    crate::device_sync::local(&tx, crate::device_sync::key(&["clear"]), serde_json::json!(true))?;
    tx.commit().map_err(err)?;
    Ok(next)
}

#[tauri::command]
pub async fn get_listening_history(app: AppHandle) -> Result<ListeningHistory> {
    work(app, |_, db| read(db)).await
}

#[tauri::command]
pub async fn checkpoint_listening(
    app: AppHandle,
    generation: i64,
    record: ListeningRecord,
) -> Result<bool> {
    work(app, move |_, db| checkpoint(db, generation, record)).await
}

#[tauri::command]
pub async fn clear_listening_history(app: AppHandle) -> Result<i64> {
    work(app, |_, db| clear(db)).await
}

#[cfg(test)]
mod tests {
    use super::*;
    fn record(time: i64) -> ListeningRecord {
        ListeningRecord {
            id: uuid::Uuid::new_v4().to_string(),
            track_id: "youtube:cL0KKSPjZf8".into(),
            title: "A track".into(),
            artist: "Artist".into(),
            album: "Album".into(),
            artwork_url: None,
            provider_id: Some("youtube".into()),
            source_id: Some("cL0KKSPjZf8".into()),
            metadata_source_id: None,
            started_at: 1_760_000_000_000,
            updated_at: 1_760_000_000_000 + time,
            listened_ms: time,
            days: BTreeMap::from([("2026-10-19".into(), time)]),
        }
    }
    fn db() -> Connection {
        let mut db = Connection::open_in_memory().unwrap();
        crate::initialize(&mut db).unwrap();
        db
    }
    #[test]
    fn cumulative_checkpoints_are_idempotent_monotonic_and_do_not_save_tracks() {
        let mut db = db();
        let mut row = record(12_000);
        assert!(checkpoint(&mut db, 0, row.clone()).unwrap());
        assert!(checkpoint(&mut db, 0, row.clone()).unwrap());
        row.listened_ms = 5_000;
        row.updated_at -= 7_000;
        row.days.insert("2026-10-19".into(), 5_000);
        assert!(checkpoint(&mut db, 0, row.clone()).unwrap());
        assert_eq!(read(&db).unwrap().records[0].listened_ms, 12_000);
        row.listened_ms = 20_000;
        row.updated_at += 15_000;
        row.days.insert("2026-10-19".into(), 20_000);
        checkpoint(&mut db, 0, row).unwrap();
        assert_eq!(read(&db).unwrap().records.len(), 1);
        assert_eq!(read(&db).unwrap().records[0].listened_ms, 20_000);
        assert_eq!(crate::snapshot(&db).unwrap().tracks.len(), 0);
    }
    #[test]
    fn catalogue_provenance_round_trips_and_legacy_records_remain_readable() {
        let mut db = db();
        let mut row = record(12_000);
        let mut legacy = serde_json::to_value(&row).unwrap();
        legacy.as_object_mut().unwrap().remove("metadataSourceId");
        let legacy: ListeningRecord = serde_json::from_value(legacy).unwrap();
        assert!(legacy.metadata_source_id.is_none());
        checkpoint(&mut db, 0, legacy).unwrap();
        for id in ["itunes:18446744073709551615", "saavn:QAbmbZ7O", "musicbrainz:recording:c4197d72-b3dd-445f-bdb8-a7f6598b5f74"] {
            row.metadata_source_id = Some(id.into());
            checkpoint(&mut db, 0, row.clone()).unwrap();
            let saved = read(&db).unwrap().records.remove(0);
            assert_eq!(saved.metadata_source_id, row.metadata_source_id);
            assert_eq!(saved.track_id, row.track_id);
            assert_eq!(saved.source_id, row.source_id);
        }
        for id in [
            "itunes:0",
            "itunes:01",
            "itunes:-1",
            "itunes:1.5",
            "itunes:1\n",
            "youtube:1",
            "itunes:18446744073709551616",
            "itunes:123456789012345678901",
            "saavn:QAbmbZ7",
            "saavn:QAbmbZ7OO",
            "saavn:QAbmbZ7/",
            "saavn:QAbmbZ7O\n",
            "saavn:../../../",
            "saavn:",
        ] {
            row.metadata_source_id = Some(id.into());
            assert!(checkpoint(&mut db, 0, row.clone()).is_err(), "{id}");
        }
        assert_eq!(
            read(&db).unwrap().records[0].metadata_source_id.as_deref(),
            Some("musicbrainz:recording:c4197d72-b3dd-445f-bdb8-a7f6598b5f74")
        );
    }
    #[test]
    fn threshold_and_clear_generation_block_delayed_writes() {
        let mut db = db();
        let mut row = record(9_999);
        checkpoint(&mut db, 0, row.clone()).unwrap();
        assert!(read(&db).unwrap().records.is_empty());
        row.listened_ms = 10_000;
        row.updated_at += 1;
        row.days.insert("2026-10-19".into(), 10_000);
        checkpoint(&mut db, 0, row.clone()).unwrap();
        assert_eq!(read(&db).unwrap().records.len(), 1);
        assert_eq!(clear(&mut db).unwrap(), 1);
        assert!(!checkpoint(&mut db, 0, row.clone()).unwrap());
        assert!(read(&db).unwrap().records.is_empty());
        assert!(checkpoint(&mut db, 1, row).unwrap());
    }
    #[test]
    fn history_and_generation_survive_reopen() {
        let path =
            std::env::temp_dir().join(format!("lumaire-listening-{}.db", uuid::Uuid::new_v4()));
        {
            let mut db = Connection::open(&path).unwrap();
            crate::initialize(&mut db).unwrap();
            clear(&mut db).unwrap();
            checkpoint(&mut db, 1, record(15_000)).unwrap();
        }
        {
            let mut db = Connection::open(&path).unwrap();
            crate::initialize(&mut db).unwrap();
            let history = read(&db).unwrap();
            assert_eq!(history.generation, 1);
            assert_eq!(history.records[0].listened_ms, 15_000);
        }
        let _ = std::fs::remove_file(path);
    }
    #[test]
    fn schema_v1_migration_preserves_library_and_session() {
        let mut db = Connection::open_in_memory().unwrap();
        db.execute_batch(
            "CREATE TABLE tracks(id TEXT PRIMARY KEY,path TEXT UNIQUE,metadata TEXT NOT NULL);
            CREATE TABLE app_state(id INTEGER PRIMARY KEY CHECK(id=1),data TEXT NOT NULL);
            INSERT INTO tracks VALUES('keep','private-path','original-metadata');
            INSERT INTO app_state VALUES(1,'original-session'); PRAGMA user_version=1;",
        )
        .unwrap();
        crate::initialize(&mut db).unwrap();
        assert_eq!(
            db.query_row("SELECT metadata FROM tracks WHERE id='keep'", [], |r| {
                r.get::<_, String>(0)
            })
            .unwrap(),
            "original-metadata"
        );
        assert_eq!(
            db.query_row("SELECT data FROM app_state", [], |r| r.get::<_, String>(0))
                .unwrap(),
            "original-session"
        );
        assert_eq!(
            db.query_row("PRAGMA user_version", [], |r| r.get::<_, i64>(0))
                .unwrap(),
            2
        );
        assert_eq!(read(&db).unwrap().generation, 0);
    }
    #[test]
    fn rejects_invalid_ids_times_dates_and_identity_changes_and_redacts_artwork() {
        let mut db = db();
        let mut row = record(12_000);
        row.artwork_url = Some("https://c.saavncdn.com/517/cover.jpg".into());
        checkpoint(&mut db, 0, row.clone()).unwrap();
        assert_eq!(read(&db).unwrap().records[0].artwork_url.as_deref(), row.artwork_url.as_deref());
        for url in ["https://c.saavncdn.com.evil.test/cover.jpg", "https://c.saavncdn.com/cover.jpg?token=secret"] {
            row.artwork_url = Some(url.into());
            checkpoint(&mut db, 0, row.clone()).unwrap();
            assert!(read(&db).unwrap().records[0].artwork_url.is_none());
        }
        row.artwork_url = Some("https://googlevideo.com/audio?token=secret".into());
        checkpoint(&mut db, 0, row.clone()).unwrap();
        assert!(read(&db).unwrap().records[0].artwork_url.is_none());
        row.track_id = "youtube:other-id000".into();
        row.source_id = Some("other-id000".into());
        assert!(checkpoint(&mut db, 0, row).is_err());
        let mut row = record(12_000);
        row.track_id = "https://stream.example/secret".into();
        assert!(checkpoint(&mut db, 0, row).is_err());
        let mut row = record(12_000);
        row.updated_at = row.started_at - 1;
        assert!(checkpoint(&mut db, 0, row).is_err());
        let mut row = record(12_000);
        row.days = BTreeMap::from([("2026-02-30".into(), 12_000)]);
        assert!(checkpoint(&mut db, 0, row).is_err());
        let mut row = record(12_000);
        row.days.insert("2026-10-19".into(), 1);
        assert!(checkpoint(&mut db, 0, row).is_err());
    }
}
