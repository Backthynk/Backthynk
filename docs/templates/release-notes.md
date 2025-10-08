{{CHANGELOG}}

<br />

---

## Download & Installation

Choose the archive for your platform below:

- **Linux (AMD64/x86_64):** [backthynk-v{{VERSION}}-linux-amd64.tar.gz]({{REPO_URL}}/releases/download/v{{VERSION}}/backthynk-v{{VERSION}}-linux-amd64.tar.gz)
- **Linux (ARM64):** [backthynk-v{{VERSION}}-linux-arm64.tar.gz]({{REPO_URL}}/releases/download/v{{VERSION}}/backthynk-v{{VERSION}}-linux-arm64.tar.gz)
- **macOS (Intel):** [backthynk-v{{VERSION}}-macos-amd64.tar.gz]({{REPO_URL}}/releases/download/v{{VERSION}}/backthynk-v{{VERSION}}-macos-amd64.tar.gz)
- **macOS (Apple Silicon):** [backthynk-v{{VERSION}}-macos-arm64.tar.gz]({{REPO_URL}}/releases/download/v{{VERSION}}/backthynk-v{{VERSION}}-macos-arm64.tar.gz)
- **Windows (AMD64):** [backthynk-v{{VERSION}}-windows-amd64.zip]({{REPO_URL}}/releases/download/v{{VERSION}}/backthynk-v{{VERSION}}-windows-amd64.zip)


### Important Notice

As this is an open-source project, the binaries are not signed with paid developer certificates.

**On macOS:**
- Right-click the binary and select "Open"
- Click "Open" again in the security dialog
- Or run: `xattr -d com.apple.quarantine backthynk-v{{VERSION}}`

**On Windows:**
- Windows Defender may show a SmartScreen warning
- Click "More info" → "Run anyway"
- Or add an exception in Windows Security

## Build Verification

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
# Compare with SHA256SUMS.txt below
```

**On macOS:**
```bash
cd releases/macos-arm64  # or macos-amd64 for Intel
shasum -a 256 backthynk-v{{VERSION}}
# Compare with SHA256SUMS.txt below
```

**On Windows (PowerShell):**
```powershell
cd releases\windows-amd64
Get-FileHash backthynk-v{{VERSION}}.exe -Algorithm SHA256
# Compare with SHA256SUMS.txt below
```

If the checksums match, the binary is authentic and unmodified.

### SHA256 Checksums
```
{{CHECKSUMS}}
```
