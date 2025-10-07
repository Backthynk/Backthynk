# Build Verification Guide

This guide explains how to verify that the binary releases of Backthynk are built from the official source code and have not been tampered with.

## Why Verify?

As an open-source project, we want our users to be able to verify that:
1. The binaries were built from the exact source code in the repository
2. The binaries have not been modified or infected with malware
3. The binaries match the checksums provided in the release

## Quick Verification

For most users, verifying checksums is sufficient:

### Step 1: Download the Release

Download the archive for your platform and the `SHA256SUMS.txt` file from the [releases page](https://github.com/Backthynk/backthynk/releases).

### Step 2: Verify Checksum

**On Linux/macOS:**
```bash
sha256sum -c SHA256SUMS.txt --ignore-missing
```

**On macOS (alternative):**
```bash
shasum -a 256 -c SHA256SUMS.txt --ignore-missing
```

**On Windows (PowerShell):**
```powershell
$expected = (Get-Content SHA256SUMS.txt | Select-String "backthynk-v.*-windows-amd64.zip").ToString().Split()[0]
$actual = (Get-FileHash backthynk-v*-windows-amd64.zip -Algorithm SHA256).Hash.ToLower()
if ($expected -eq $actual) { Write-Host "✓ Checksum verified" -ForegroundColor Green } else { Write-Host "✗ Checksum mismatch!" -ForegroundColor Red }
```

If the checksum matches, you can be confident that:
- The file was not corrupted during download
- The file has not been modified since it was published

## Full Source Verification

For advanced users who want to verify that the binaries were built from specific source code:

### Prerequisites

- Git
- Go 1.25+
- Node.js 24+
- Make
- Platform-specific build tools (see below)

### Build Tools by Platform

#### Linux
```bash
sudo apt-get install build-essential
```

#### macOS
```bash
xcode-select --install
```

#### Windows
Install [MSYS2](https://www.msys2.org/) or [WSL](https://docs.microsoft.com/en-us/windows/wsl/)

### Verification Steps

#### 1. Clone the Repository

```bash
git clone https://github.com/Backthynk/backthynk.git
cd backthynk
```

#### 2. Checkout the Release Commit

Find the commit SHA from the `BUILD_INFO.txt` file in the release, or from the release notes:

```bash
git checkout <COMMIT_SHA>
```

For example:
```bash
git checkout abc1234def5678...
```

#### 3. Build Locally

Build the project for your current platform:

```bash
make build
```

This will create:
- `releases/<platform>/` - Full release build for your platform
- `build/assets/` - Compressed assets

#### 4. Compare Assets

The most reliable way to verify is to compare the **asset checksums**, not the binaries themselves (since binaries may have slight variations due to build environment differences).

**Generate checksums for your local build:**

```bash
# For assets
cd build/assets
find . -type f -exec sha256sum {} \; | sort > ../../local-assets-checksums.txt
cd ../..
```

**Extract and compare with the release:**

```bash
# Download and extract the release archive for your platform
tar -xzf backthynk-v*-<platform>.tar.gz  # Linux/macOS
# or
unzip backthynk-v*-<platform>.zip        # Windows

# Generate checksums for release assets
cd <platform>/assets
find . -type f -exec sha256sum {} \; | sort > ../../release-assets-checksums.txt
cd ../..

# Compare
diff local-assets-checksums.txt release-assets-checksums.txt
```

If the asset checksums match, the release was built from the same source code.

> **Note:** Binary checksums may differ slightly due to:
> - Build timestamps
> - Build environment differences
> - Go compiler variations
>
> Asset checksums (HTML, CSS, JS, images) should be identical.

## Understanding the Build Process

### Local Developer Build

When you run `make build` locally:
1. Detects your current OS and architecture
2. Builds only for your platform
3. Creates optimized assets in `build/assets/`
4. Creates a release directory in `releases/<your-platform>/`

### CI/Workflow Build

When GitHub Actions builds a release:
1. Uses `./scripts/build/build.sh --workflow`
2. Builds for **all** supported platforms:
   - Linux AMD64
   - Linux ARM64
   - macOS AMD64 (Intel)
   - macOS ARM64 (Apple Silicon)
   - Windows AMD64
3. Creates release archives for each platform
4. Generates checksums (`SHA256SUMS.txt`)
5. Publishes to GitHub Releases

## Reproducible Builds

We strive for reproducible builds, but complete reproducibility is challenging due to:
- Go compiler including build timestamps and paths
- Dependency versions may change over time
- Build environment differences

For the most reliable verification:
1. **Verify checksums** - Ensures file integrity
2. **Compare asset checksums** - Assets are fully reproducible
3. **Review the build workflow** - The workflow is transparent and auditable

## Build Information

Each release includes a `BUILD_INFO.txt` file with:
- Version number
- Commit SHA (exact source code used)
- Build date and time
- Platforms included
- Links to source repository and commit

## Security Best Practices

1. **Always download from official sources:**
   - GitHub Releases: https://github.com/Backthynk/backthynk/releases
   - Do not download from third-party sites

2. **Verify checksums:**
   - Download `SHA256SUMS.txt` and verify your download

3. **Check commit signatures:**
   ```bash
   git log --show-signature -1 <COMMIT_SHA>
   ```

4. **Review the code:**
   - The source is open - audit it yourself
   - Check for suspicious code or dependencies

## Reporting Security Issues

If you find a security vulnerability or suspect a compromised release:

**DO NOT** open a public issue.

Contact us privately at: [security@backthynk.com] (or create a private security advisory on GitHub)

## Questions?

- **General questions:** Open an issue on [GitHub](https://github.com/Backthynk/backthynk/issues)
- **Documentation:** Check our [README.md](./README.md)
- **Build issues:** See [CONTRIBUTING.md](./CONTRIBUTING.md)

---

**Last updated:** 2025-10-07
**Applies to:** v0.1.0 and later
