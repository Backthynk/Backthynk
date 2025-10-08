# Backthynk - Quick Start (Linux)

## Starting the App

```bash
./backthynk-v{{VERSION}}
```

The app will start in your terminal.

---

## Security Warning Bypass

Since this is an open-source project without a paid developer certificate, Linux may block execution.

**Fix:** Make the binary executable
```bash
chmod +x backthynk-v{{VERSION}}
```

---

## Verify Authenticity (Optional)

Want to verify the binary is legitimate? Here's how:

**Step 1:** Open terminal in the folder containing the binary

**Step 2:** Run SHA256 checksum:
```bash
sha256sum backthynk-v{{VERSION}}
```

**Step 3:** You'll see output like:
```
a1b2c3d4e5f6... backthynk-v{{VERSION}}
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
