# Backthynk - Quick Start (macOS)

## Starting the App

```bash
./backthynk-v{{VERSION}}
```

The app will start in your terminal.

---

## Security Warning Bypass

Since this is an open-source project without a paid Apple Developer certificate, macOS will block the app.

**Fix:** Remove quarantine attribute
```bash
xattr -d com.apple.quarantine backthynk-v{{VERSION}}
```

Or right-click the binary → "Open" → click "Open" again in the dialog.

---

## Verify Authenticity (Optional)

Want to verify the binary is legitimate? Here's how:

**Step 1:** Open terminal in the folder containing the binary

**Step 2:** Run SHA256 checksum:
```bash
shasum -a 256 backthynk-v{{VERSION}}
```

**Step 3:** You'll see output like:
```
a1b2c3d4e5f6...  backthynk-v{{VERSION}}
```

**Step 4:** Compare this hash with the official one from the release page:
```
{{SHA256}}
```

If they match exactly, the binary is authentic and unmodified.

**Go deeper:** [View the source code]({{REPO_URL}}/tree/{{COMMIT_SHA}}) for this build on GitHub.

Build it yourself:
```bash
git clone {{REPO_URL}}.git
cd backthynk
git checkout {{COMMIT_SHA}}
make build-with-docker
```