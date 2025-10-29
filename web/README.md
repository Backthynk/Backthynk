# Backthynk Web

Modern multi-theme web frontend for Backthynk built with Preact, Signals, Preact-ISO, and Goober.

## Architecture

```
web/
├── core/                    # Shared code across all themes
│   ├── api/                # API client functions
│   ├── state/              # Global state management with Signals
│   └── utils/              # Shared utilities
│
└── themes/                 # Theme implementations
    ├── github/             # GitHub-inspired theme
    └── notion/             # Notion-inspired theme (future)
```

## Tech Stack

- **Preact** - Lightweight React alternative (3kb)
- **@preact/signals** - Reactive state management
- **preact-iso** - Routing and SSR support
- **goober** - CSS-in-JS styling (<1kb)
- **Vite** - Build tool and dev server
- **TypeScript** - Type safety

## Development

### Start Development Server

```bash
# From web directory
npm run dev

# Or from project root
cd web && npm run dev
```

The dev server runs on `http://localhost:3000` and proxies API calls to Go backend on `:8080`.

### Build for Production

```bash
# Build active theme (github by default)
npm run build

# Build specific theme
npm run build:github
npm run build:notion
```

Output: `themes/{theme}/dist/`

### Preview Production Build

```bash
npm run preview
```

## Creating a New Theme

1. Create theme directory: `themes/your-theme/`
2. Copy structure from `themes/github/`
3. Update `package.json` name to `@backthynk/theme-your-theme`
4. Customize components and styles
5. Add build script to root `package.json`

## Integration with Go Backend

### Development
- Vite dev server proxies `/api/*` and `/uploads/*` to Go backend
- Go backend must run on port 8080
- Frontend runs on port 3000

### Production
- Build frontend: `npm run build`
- Copy `themes/github/dist/*` to Go's static directory
- Go serves static files and handles routing fallback

## Shared Core

All themes share:
- **API clients** - Consistent API interface
- **State management** - Global signals for spaces, posts, settings
- **Utilities** - Format functions, helpers

Themes customize:
- **Components** - UI implementation
- **Styles** - Goober styled components
- **Layout** - Page structure

## Path Aliases

- `@core/*` - Points to `web/core/*`
- `@/*` - Points to theme's `src/*` (theme-specific)

## Notes

- No Tailwind (replaced with Goober)
- Font Awesome for icons (kept from old implementation)
- TypeScript for type safety
- Workspaces for multi-theme management
