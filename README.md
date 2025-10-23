# BackThynk
<div align="center">
A lightweight, self-hosted micro-blogging platform for people with messy thoughts

https://github.com/user-attachments/assets/9034c9f5-1ed8-4ef6-a70b-7673624be742
</div>

<br />

## Quickstart

<details open><summary><b>Linux</b></summary>

```bash
# Download and extract (AMD64)
curl -s https://api.github.com/repos/Backthynk/Backthynk/releases/latest | grep "browser_download_url.*linux-amd64.tar.gz" | cut -d '"' -f 4 | wget -qi -
tar -xzf backthynk-*-linux-amd64.tar.gz

# Make executable and run
chmod +x backthynk-*
./backthynk-*

# Open your browser at http://localhost:1369
```

**Note:** For ARM64, replace `linux-amd64` with `linux-arm64`.

</details>

<details><summary><b>macOS</b></summary>

```bash
# Download and extract (Apple Silicon)
curl -s https://api.github.com/repos/Backthynk/Backthynk/releases/latest | grep "browser_download_url.*macos-arm64.tar.gz" | cut -d '"' -f 4 | xargs curl -LO
tar -xzf backthynk-*-macos-arm64.tar.gz

# Remove quarantine and run
xattr -d com.apple.quarantine backthynk-*
./backthynk-*

# Open your browser at http://localhost:1369
```

**Note:** For Intel Macs, replace `macos-arm64` with `macos-amd64`.

</details>

<details><summary><b>Windows</b></summary>

```powershell
# Download and extract
$latestRelease = Invoke-RestMethod -Uri "https://api.github.com/repos/Backthynk/Backthynk/releases/latest"
$downloadUrl = $latestRelease.assets | Where-Object { $_.name -like "*windows-amd64.zip" } | Select-Object -ExpandProperty browser_download_url
Invoke-WebRequest -Uri $downloadUrl -OutFile "backthynk.zip"
Expand-Archive -Path backthynk.zip -DestinationPath .

# Run it
.\backthynk-*.exe

# Open your browser at http://localhost:1369
```

**Note:** Windows Defender may block the app. Click "More info" → "Run anyway" to proceed.

That's it.

</details>

<br />

## What is this?

BackThynk is a personal knowledge dump. 
Not a blog, not a wiki - something in between.
Think Twitter timeline but for your brain. 
Create spaces, nest them, throw in quick thoughts, attach files, and actually find them later.

<div align="center">
 <img alt="home" src="https://raw.githubusercontent.com/Backthynk/assets/refs/heads/main/home.png" width="100%">
</div>

<br />

## Core Features

### 🎯 Spaces & Subspaces
Organize thoughts hierarchically. Create "Work > Projects > ClientName" or "Learning > Go > Snippets"

### 📝 Quick Posts
No titles, no formatting pressure. Just write and post. 140 or 10,000 characters - your choice. Markdown support (coming soon)

### 📎 File Attachments
Drag & drop anything. PDFs, videos, images. They live with your thoughts, not in some separate media library.

### 📅 Timeline View
See everything chronologically. Filter by space. Search (coming soon).

### 🌙 Dark/Light Mode
Easy on the eyes at 3 AM.

### ⚡ Incredibly Low-Weight and Performant 
**Frontend**: **37.7KB** (Brotli) / 44.7KB (gzip) - entire app

**Backend**: **~0.6MB RAM** idle 

**SQLite database**: **no external dependencies**

<br />

## Use Cases

- **Daily Journaling** : Quick entries without the blog overhead
- **Project Notes** : Keep context with your files
- **Learning Log** : Track what you're studying with resources attached
- **Job Applications** : Space per company, posts with resumes/covers attached
- **Bookmarking++** : Not just links but your thoughts about them
- **Code Snippets** : That thing you figured out at 2 AM and will forget


<div align="center">
 <img alt="home" src="https://raw.githubusercontent.com/Backthynk/assets/refs/heads/main/home2.png" width="100%">
</div>
<br />

## Extra Installation Options

### Build it yourself with docker

```bash
git clone https://github.com/Backthynk/backthynk.git
cd backthynk
make build-with-docker # Image building can take ~10-30 minutes first time, depending on your connexion.
cd releases
# cd to your platform 
backthynk
```

<br />

## The Philosophy

**I built this because I needed a place for incomplete thoughts.**

Most note-taking apps want you to write documents, but I just wanted somewhere to dump the 10 things bouncing around my head without thinking about structure, formatting, or whether it's "good enough".

### Why Another Note App?

1. **Blogs are too heavy** - I don't want to write an introduction, body, and conclusion for a Docker command I'll forget
2. **Wikis are too structured** - Not everything fits in a knowledge graph
3. **Social media is too public** - These are my thoughts and I dont want models to be built with them.
4. **Most note apps are too complex** - I don't need databases, tags, backlinks, and 47 different views

### Design Principles

- **Start minimal**, add as needed - Features are opt-in, not opt-out
- **No feature coupling** - Enable file uploads without enabling markdown. Each feature stands alone.
- **Respect the user's machine** - 38KB for a full app.
- **No surprises** - Vanilla JS might be "harder" but it's predictable
- **Own your data** - SQLite database you can read with any tool

### Technical Choices

- **Go + SQLite**: Portable, fast, single binary distribution
- **Vanilla JS**: No framework churn, no build steps, no node_modules
- **Tailwind (minimal)**: Just enough styling without the bloat
- **Unit tested backend**: The foundation is solid, the UI can evolve

<br />

## Current Limitations

This is a working prototype that I use daily, but :

- **Single user only** - No authentication system yet (coming soon)
- **No public sharing** - This is your personal space for now (coming soon)
- **Basic search** - Full-text search (coming soon)
- **No post format** - Markdown support in a Github style standard (coming soon)

### Roadmap Ideas

- Full-text search with SQLite FTS5
- Markdown support within posts (github style format)
- Integrate a self-hosted tiny LLM model to provide custom vizualisation in a Space. (Example: Turn raw text into a more comfortable format to synthetize and analyze)
- Import from Twitter/Mastodon archives


### Contributing
The codebase is intentionally simple. No framework magic, no abstract patterns. If you know Go and JavaScript, you can contribute.

Key files:

- cmd/server/main.go - Entry point
- internal/api/router.go - HTTP routes
- internal/storage/ - Database layer
- web/static/js/main.js - Frontend logic


<br />

### Discord

If you use and like it, please join the discord channel I've created for this project and let's have a chat.

<br />

<p align="center">
  <a target="_blank" href="https://discord.com/invite/W8xDXRQPcm">
    <img width="64px" src="https://cdn-icons-png.flaticon.com/512/3670/3670157.png"/>
  </a>
</p>


<br />

---

<div align="center">
Built for people with too many thoughts and not enough time to organize them properly.
Try it. Break it. Tell me what's missing.
</div>

