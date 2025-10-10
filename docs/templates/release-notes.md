<details><summary>See patch note</summary>

<br />

{{CHANGELOG}}

<br />
</details>

---

</details>

## Download & Installation

Choose the archive for your platform below:

- **Linux (AMD64/x86_64):** [backthynk-v{{VERSION}}-linux-amd64.tar.gz]({{REPO_URL}}/releases/download/v{{VERSION}}/backthynk-v{{VERSION}}-linux-amd64.tar.gz)
- **Linux (ARM64):** [backthynk-v{{VERSION}}-linux-arm64.tar.gz]({{REPO_URL}}/releases/download/v{{VERSION}}/backthynk-v{{VERSION}}-linux-arm64.tar.gz)
- **macOS (Intel):** [backthynk-v{{VERSION}}-macos-amd64.tar.gz]({{REPO_URL}}/releases/download/v{{VERSION}}/backthynk-v{{VERSION}}-macos-amd64.tar.gz)
- **macOS (Apple Silicon):** [backthynk-v{{VERSION}}-macos-arm64.tar.gz]({{REPO_URL}}/releases/download/v{{VERSION}}/backthynk-v{{VERSION}}-macos-arm64.tar.gz)
- **Windows (AMD64):** [backthynk-v{{VERSION}}-windows-amd64.zip]({{REPO_URL}}/releases/download/v{{VERSION}}/backthynk-v{{VERSION}}-windows-amd64.zip)

---

## Quick Start

<details><summary><b>Linux</b></summary>

### Starting the App
```bash
./backthynk-v{{VERSION}}
```

### Security Warning Bypass
Since this is an open-source project without a paid developer certificate, Linux may block execution.

**Fix:** Make the binary executable
```bash
chmod +x backthynk-v{{VERSION}}
```

</details>

<details><summary><b>macOS</b></summary>

### Starting the App
```bash
./backthynk-v{{VERSION}}
```

### Security Warning Bypass
Since this is an open-source project without a paid Apple Developer certificate, macOS will block the app.

**Fix:** Remove quarantine attribute
```bash
xattr -d com.apple.quarantine backthynk-v{{VERSION}}
```

Or right-click the binary → "Open" → click "Open" again in the dialog.

</details>

<details><summary><b>Windows</b></summary>

### Starting the App
Double-click `backthynk-v{{VERSION}}.exe` or run from Command Prompt:
```cmd
backthynk-v{{VERSION}}.exe
```

### Security Warning Bypass
Since this is an open-source project without a paid Microsoft certificate, Windows Defender SmartScreen will block the app.

**Fix:**
1. Click "More info"
2. Click "Run anyway"

Or add an exception in Windows Security settings.

</details>

## Build Verification

<details><summary>See build verification process guide</summary>

<br />

**Commit:** [`{{COMMIT_SHORT}}`]({{REPO_URL}}/commit/{{COMMIT_SHA}})

You can verify these binaries are authentic by reproducing the build locally.

### Quick Verification

**Step 1:** Clone and checkout the release commit
```bash
git clone {{REPO_URL}}.git
cd backthynk
git checkout {{COMMIT_SHA}}
```

**Step 2:** Build using Docker (ensures identical build environment)
```bash
make build-with-docker
```

**Step 3:** Compare SHA256 checksums

**On Linux:**
```bash
cd releases/linux-amd64
sha256sum backthynk-v{{VERSION}}
# Compare with the one from release
```

**On macOS:**
```bash
cd releases/macos-arm64  # or macos-amd64 for Intel
shasum -a 256 backthynk-v{{VERSION}}
# Compare with the one from release
```

**On Windows (PowerShell):**
```powershell
cd releases\windows-amd64
Get-FileHash backthynk-v{{VERSION}}.exe -Algorithm SHA256
# Compare with the one from release
```

If the checksums match, the binary is authentic and unmodified.

</details>

### SHA256 Checksums
```
{{CHECKSUMS}}
```
