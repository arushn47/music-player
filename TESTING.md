# Lumaire Testing Guide

This document provides instructions for testing the Lumaire music player, including both local playback and the newly integrated Wikimedia Commons music discovery feature.

## Prerequisites

- Windows 10/11
- Node.js 24+ and npm/pnpm
- Rust/Cargo (for desktop build)
- Internet connection (for Commons testing)
- Local audio files (MP3, WAV, FLAC, etc.)

## Quick Start

```powershell
# Install dependencies
npm install

# Run development server (web UI only, no file access)
npm run dev

# Run desktop application (full functionality)
npm run desktop

# Run unit tests
npm test

# Build for production
npm run build
npm run desktop:build
```

## Test Scenarios

### 1. Local Music Playback (Phase 1-2)

#### Test 1.1: Import Local Files
1. Launch desktop app: `npm run desktop`
2. Click "Add music" or "Add folder"
3. Select audio files from your system
4. ✅ **Expected:** Files appear in Library with metadata

#### Test 1.2: Basic Playback
1. Click play button on any track
2. Verify audio plays
3. Test pause, seek, volume controls
4. ✅ **Expected:** Smooth playback with responsive controls

#### Test 1.3: Queue Management
1. Add multiple tracks to queue using "Play next" or "Add to queue"
2. Reorder tracks using up/down arrows
3. Remove tracks using X button
4. Test "Clear queue" and "Undo"
5. ✅ **Expected:** Queue operations work without losing tracks

#### Test 1.4: Playlists
1. Create a new playlist
2. Add tracks using track menu → "Add to [playlist]"
3. Navigate to playlist
4. Play tracks from playlist
5. ✅ **Expected:** Playlists persist across sessions

#### Test 1.5: Favorites
1. Click heart icon on tracks
2. Navigate to Favorites view
3. Verify only favorited tracks appear
4. ✅ **Expected:** Favorites persist across sessions

#### Test 1.6: Lyrics
1. Play a track
2. Navigate to Lyric Room
3. If auto-lookup finds lyrics (from LRCLIB), verify display
4. Otherwise, click "Attach lyrics" and select an LRC or TXT file
5. Test timing offset adjustment
6. ✅ **Expected:** Lyrics sync with playback, scroll automatically

#### Test 1.7: Session Persistence
1. Play a track, pause at a specific position
2. Close the application
3. Reopen the application
4. ✅ **Expected:** Same track selected, paused at same position

#### Test 1.8: Export/Import Library
1. Settings → Export library
2. Save JSON file
3. Settings → Import backup
4. Type "IMPORT" to confirm
5. ✅ **Expected:** Queue, playlists, settings restored (paths require relinking)

---

### 2. Wikimedia Commons Discovery (Phase 3)

#### Test 2.1: Search Interface
1. Launch desktop app
2. Click "Discover" in sidebar (or select from dropdown)
3. Enter search query: "classical music"
4. Press Enter or click Search button
5. ✅ **Expected:** Results appear with title, artist, license, duration

#### Test 2.2: License Display
1. Search for "jazz" or "folk music"
2. Verify each result shows license type
3. Hover over license column to see full license name
4. ✅ **Expected:** Only CC-BY, CC-BY-SA, CC0, or public domain licenses shown

#### Test 2.3: Play Online Track
1. Search for any term (e.g., "piano")
2. Click play button on a result
3. Wait for streaming to start
4. ✅ **Expected:**
   - Track added to library automatically
   - Track added to queue
   - Audio streams and plays
   - Notification shows "Playing [title] from Wikimedia Commons"

#### Test 2.4: Queue Integration
1. Play a local file
2. Search Commons and click "Play next" on a result
3. Let current track finish
4. ✅ **Expected:** Commons track plays next automatically

#### Test 2.5: Mixed Queue
1. Add 3 local tracks to queue
2. Add 2 Commons tracks to queue
3. Navigate queue panel
4. Play through entire queue
5. ✅ **Expected:** Both local and online tracks play seamlessly

#### Test 2.6: Attribution & Links
1. Search for any track
2. Click track metadata area
3. ✅ **Expected:** Commons file page opens in browser
4. Open track menu (•••) → "View on Commons"
5. ✅ **Expected:** Same page opens
6. Open track menu → "View license"
7. ✅ **Expected:** License details page opens

#### Test 2.7: Format Support
1. Search for "music"
2. Note format column (MP3, OGG, WAV, FLAC)
3. Try playing different formats
4. ✅ **Expected:** MP3, OGG, WAV play on all systems. FLAC may not work everywhere.

#### Test 2.8: Empty Results
1. Search for random gibberish: "xyzabc123"
2. ✅ **Expected:** Message appears: "No results found. Try different keywords."

#### Test 2.9: Network Error Handling
1. Start a search
2. Quickly disconnect WiFi/network
3. ✅ **Expected:** Error message appears with retry option
4. Reconnect network and click retry
5. ✅ **Expected:** Search completes successfully

#### Test 2.10: Settings Display
1. Navigate to Settings
2. Scroll to "Sources" section
3. ✅ **Expected:** Two sources shown:
   - 📁 Local files (Enabled)
   - 🌐 Wikimedia Commons (Enabled)

---

### 3. Integration & Edge Cases

#### Test 3.1: Offline Mode
1. Disconnect from internet
2. Try playing a local file
3. ✅ **Expected:** Local playback works
4. Try navigating to Discover
5. ✅ **Expected:** Search fails with error, but app doesn't crash
6. Try playing a previously added Commons track
7. ✅ **Expected:** Playback fails with network error

#### Test 3.2: Rapid Track Switching
1. Build a queue with 5+ tracks
2. Rapidly click different tracks
3. ✅ **Expected:** No overlapping audio, smooth transitions

#### Test 3.3: Long Session
1. Play a mix of 10+ tracks (local and online)
2. Let them play through
3. ✅ **Expected:** No memory leaks, stable performance

#### Test 3.4: Large Library
1. Import 100+ local files (use "Add folder")
2. Search library
3. Add Commons tracks
4. ✅ **Expected:** No slowdown, searches remain responsive

#### Test 3.5: Keyboard Shortcuts
1. Press Space → Play/Pause
2. Press Alt+→ → Next track
3. Press Alt+← → Previous track
4. ✅ **Expected:** All shortcuts work

#### Test 3.6: Repeat & Shuffle
1. Enable shuffle
2. Add 10 tracks to queue
3. Play through queue
4. ✅ **Expected:** Tracks play in random order
5. Disable shuffle, enable repeat
6. Play queue
7. ✅ **Expected:** Queue repeats indefinitely

---

## Automated Tests

```powershell
# Run all unit tests
npm test

# Run specific test file
npx vitest run src/domain/domain.test.ts
npx vitest run src/player/controller.test.ts

# Run tests in watch mode
npx vitest
```

### Current Test Coverage

- ✅ Domain logic (6 tests)
  - Queue advancement
  - Session restoration
  - Lyric parsing and alignment
- ✅ Player controller (3 tests)
  - State management
  - Playback lifecycle
  - Error handling

---

## Performance Benchmarks

### Expected Performance
- **Search latency:** < 3s (network dependent)
- **Local track load:** < 100ms
- **Online track load:** < 2s (network dependent)
- **Queue operations:** < 10ms
- **UI responsiveness:** 60 FPS

### Performance Testing
1. Open browser DevTools (F12)
2. Go to Performance tab
3. Record while performing operations
4. Check for frame drops or long tasks

---

## Known Issues & Limitations

### Commons Integration
- ❌ **URLs may expire:** If a track fails mid-playback, re-select it to get a fresh URL
- ❌ **No caching:** Online tracks always stream, no offline storage
- ❌ **Codec dependent:** FLAC may not play on all systems
- ❌ **No search filters:** Cannot filter by license, duration, or format yet

### Local Playback
- ❌ **Format support:** Depends on system codecs
- ❌ **No gapless:** Small silence between tracks
- ❌ **No visualization:** No waveform or spectrum display

### Lyrics
- ❌ **Manual only for Commons:** Auto-lookup doesn't work for Commons tracks
- ❌ **Single language:** No multi-language auto-translation

---

## Troubleshooting

### Desktop App Won't Start
```powershell
# Check Rust installation
cargo --version

# Rebuild dependencies
npm install

# Clear cache
Remove-Item -Recurse -Force node_modules
Remove-Item -Recurse -Force src-tauri/target
npm install
```

### Commons Search Fails
- Check internet connection
- Verify firewall allows connections to wikimedia.org
- Check browser console (F12) for CSP errors
- Ensure Tauri CSP includes Commons domains

### Audio Won't Play
- Check browser console for media errors
- Verify codec support: try different format
- Check system audio settings
- Ensure no other app is blocking audio device

### Lyrics Won't Sync
- Check timing offset (may need adjustment)
- Verify LRC file has timestamps
- Ensure track duration matches LRC file

---

## Reporting Issues

When reporting issues, include:

1. **Environment:**
   - OS version
   - Node version
   - Rust/Cargo version
   - Browser (if web mode)

2. **Steps to reproduce:**
   - Exact sequence of actions
   - Expected vs. actual behavior

3. **Logs:**
   - Browser console output (F12)
   - Terminal output
   - Screenshots if UI issue

4. **File info (if relevant):**
   - Audio format
   - File size
   - Metadata

---

## Test Results Template

Use this template to document test results:

```markdown
## Test Results - [Date]

### Environment
- OS: Windows 11
- Node: v24.15.0
- Cargo: 1.99.1
- Browser: Chrome 120

### Local Playback
- [ ] Import files: Pass/Fail
- [ ] Basic playback: Pass/Fail
- [ ] Queue management: Pass/Fail
- [ ] Playlists: Pass/Fail
- [ ] Favorites: Pass/Fail
- [ ] Lyrics: Pass/Fail
- [ ] Persistence: Pass/Fail
- [ ] Export/Import: Pass/Fail

### Commons Discovery
- [ ] Search: Pass/Fail
- [ ] License display: Pass/Fail
- [ ] Play online: Pass/Fail
- [ ] Queue integration: Pass/Fail
- [ ] Mixed queue: Pass/Fail
- [ ] Attribution links: Pass/Fail
- [ ] Format support: Pass/Fail
- [ ] Empty results: Pass/Fail
- [ ] Network errors: Pass/Fail
- [ ] Settings display: Pass/Fail

### Edge Cases
- [ ] Offline mode: Pass/Fail
- [ ] Rapid switching: Pass/Fail
- [ ] Long session: Pass/Fail
- [ ] Large library: Pass/Fail
- [ ] Keyboard shortcuts: Pass/Fail
- [ ] Repeat & shuffle: Pass/Fail

### Notes
[Any observations, bugs found, or suggestions]
```

---

## Next Steps After Testing

1. **Document bugs:** Create GitHub issues for failures
2. **Performance data:** Record actual latency numbers
3. **User feedback:** Share with test users
4. **Accessibility:** Test with screen reader
5. **Mobile:** Consider responsive layout improvements
6. **Deployment:** Prepare signed installer for public release
