# Backthynk - Lightweight Micro-blogging Service

A simple, lightweight micro-blogging service for personal use.

## Features

- Hierarchical categories (max 3 levels deep)
- Posts with text, images, and file attachments
- File preview for common formats (Markdown, PDF, images)
- Lightweight Go backend with SQLite storage
- Vanilla JS frontend with Tailwind CSS

## Quick Start

1. Run the server:
   ```bash
   go run ./cmd/server
   ```

2. Open http://localhost:8080 in your browser

## Storage

All data is stored in the `storage/` directory:
- `storage/app.db` - SQLite database
- `storage/uploads/` - Uploaded files

## API Endpoints

- `GET /api/categories` - List all categories
- `POST /api/categories` - Create category
- `GET /api/categories/:id/posts` - Get posts in category
- `POST /api/posts` - Create post
- `POST /api/upload` - Upload file