## Lumaire VERSION

Describe the changes in this release and link the matching source tag/build run. State whether this is a preview or stable release.

### Downloads

| Platform | Asset | Requirements |
| --- | --- | --- |
| Windows | Actual uploaded x64 setup EXE | Windows x64, WebView2 |
| Android | Actual uploaded signed ARM64 APK | Android 8.0+, ARM64 |

List only assets actually attached. Include `SHA256SUMS.txt` for the binaries. A Windows updater-enabled release must also include its generated `.exe.sig` and `latest.json`; do not fabricate them or reuse signatures from another build.

### Changes

- Summarize user-visible changes actually included in these binaries.

### Verified

- Record the platforms/devices and checks actually exercised.

### Known limitations

- Record missing tests and known issues.
- State whether Windows Authenticode signing is present.
- State whether these exact binaries include the in-app updater.

### Installation

Run the Windows installer or open the Android APK. Check the SHA-256 checksum against `SHA256SUMS.txt`. Android development builds with a different signing certificate cannot be updated in place; uninstalling them removes private app data.
