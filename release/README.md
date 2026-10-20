# Prepared 1.0.4 preview assets

The two existing files in this folder are shareable installers, not source files:

- `Lumaire-1.0.4-Windows-x64-Setup.exe`
- `Lumaire-1.0.4-Android-arm64.apk`

`SHA256SUMS.txt` records hashes of these exact files. `RELEASE-NOTES.md` records what is actually included/tested. Do not upload the `.apk.idsig` sidecar or any `.tools` signing files. Binaries are ignored by Git; attach them as GitHub Release assets.

These binaries predate the Windows updater implementation. They must not be described as updater-enabled or paired with a newly fabricated `latest.json`. A preview release keeps them separate from the future stable release workflow.

Once the repository is publicly visible and its reviewed source is committed/pushed, the following commands prepare a **draft** preview using the source commit that actually matches these builds. `BUILD_SOURCE_COMMIT` below is a placeholder to replace with that verified commit; do not guess it. GitHub CLI must be installed and authenticated.

```powershell
gh release create v1.0.4-preview --repo arushn47/music-player --target BUILD_SOURCE_COMMIT --draft --prerelease --title 'Lumaire 1.0.4 preview' --notes-file release/RELEASE-NOTES.md release/Lumaire-1.0.4-Windows-x64-Setup.exe release/Lumaire-1.0.4-Android-arm64.apk release/SHA256SUMS.txt
```

Do not run this until build provenance is established. Current binaries were built from uncommitted local work, so a matching public source commit has not been established yet. Rebuilding from a reviewed commit is the reliable route. The stable Windows workflow intentionally rejects `-preview` tags and will not run for this preview tag.

Review the draft's files and notes, then explicitly publish it when ready:

```powershell
gh release edit v1.0.4-preview --repo arushn47/music-player --draft=false --prerelease
```

No upload, release or repository-visibility change was performed while preparing this package. For future signed Windows releases use `docs/windows-release-publishing.md`. Android release signing/hosting remains a separate step; the Windows workflow does not build APKs.
