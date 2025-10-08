{{CHANGELOG}}

---

## Download & Installation

Choose the archive for your platform below:

- **Linux (AMD64/x86_64):** [backthynk-v{{VERSION}}-linux-amd64.tar.gz]({{REPO_URL}}/releases/download/v{{VERSION}}/backthynk-v{{VERSION}}-linux-amd64.tar.gz)
- **Linux (ARM64):** [backthynk-v{{VERSION}}-linux-arm64.tar.gz]({{REPO_URL}}/releases/download/v{{VERSION}}/backthynk-v{{VERSION}}-linux-arm64.tar.gz)
- **macOS (Intel):** [backthynk-v{{VERSION}}-macos-amd64.tar.gz]({{REPO_URL}}/releases/download/v{{VERSION}}/backthynk-v{{VERSION}}-macos-amd64.tar.gz)
- **macOS (Apple Silicon):** [backthynk-v{{VERSION}}-macos-arm64.tar.gz]({{REPO_URL}}/releases/download/v{{VERSION}}/backthynk-v{{VERSION}}-macos-arm64.tar.gz)
- **Windows (AMD64):** [backthynk-v{{VERSION}}-windows-amd64.zip]({{REPO_URL}}/releases/download/v{{VERSION}}/backthynk-v{{VERSION}}-windows-amd64.zip)
- **All Platforms:** [backthynk-v{{VERSION}}-all-platforms.zip]({{REPO_URL}}/releases/download/v{{VERSION}}/backthynk-v{{VERSION}}-all-platforms.zip)

### Quick Start
1. Download and extract the archive for your platform
2. Run: `./backthynk-latest` (or `.\backthynk-latest.exe` on Windows)

## Build Verification

**Commit:** [`{{COMMIT_SHORT}}`]({{REPO_URL}}/commit/{{COMMIT_SHA}})

To verify this build is from the official source:
1. Clone the repository: `git clone {{REPO_URL}}.git`
2. Checkout the release commit: `git checkout {{COMMIT_SHA}}`
3. Build locally: `make bundle && make build --all`
4. Compare checksums below with your local build

See [`VERIFY.md`]({{REPO_URL}}/blob/{{COMMIT_SHA}}/docs/VERIFY.md) for detailed verification instructions.

### SHA256 Checksums
```
{{CHECKSUMS}}
```
