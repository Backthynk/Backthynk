# Backthynk - Quick Start (Windows)

## Starting the App

Double-click `backthynk-v{{VERSION}}.exe` or run from Command Prompt:

```cmd
backthynk-v{{VERSION}}.exe
```

A terminal window will open with the app.

---

## Security Warning Bypass

Since this is an open-source project without a paid Microsoft certificate, Windows Defender SmartScreen will block the app.

**Fix:**
1. Click "More info"
2. Click "Run anyway"

Or add an exception in Windows Security settings.

---

## Verify Authenticity (Optional)

Want to verify the binary is legitimate? Here's how:

**Step 1:** Open PowerShell in the folder containing the binary

**Step 2:** Run SHA256 checksum:
```powershell
Get-FileHash backthynk-v{{VERSION}}.exe -Algorithm SHA256
```

**Step 3:** You'll see output like:
```
Algorithm       Hash
---------       ----
SHA256          A1B2C3D4E5F6...
```

**Step 4:** Clone and checkout the release commit
```bash
git clone {{REPO_URL}}.git
cd backthynk
git checkout {{COMMIT_SHA}}
```

**Step 5:** Build using Docker (ensures identical build environment)
```bash
make build-with-docker
```

**Step 6:** Compare the freshly built binary hash with the released one
```powershell
Get-FileHash backthynk-v{{VERSION}}.exe -Algorithm SHA256
Get-FileHash releases/windows-amd64/backthynk-v{{VERSION}}.exe -Algorithm SHA256
```

If they match exactly, the binary is authentic and unmodified from the open sourced code.