# 📚 Null Library — The Art of Infinite Production

> An AI-powered multi-agent publishing platform for creating unlimited books with zero API costs.

---

## What Is Null Library?

Null Library is a desktop + web application that guides you through the entire book creation pipeline: from market research and genre selection, to outlining, writing every chapter, generating illustrations, and producing a publish-ready EPUB for Amazon KDP or any platform.

It runs on Windows, Mac, and Linux (via Electron) or in any modern browser.

---

## ⚡ The NullProxy Engine (Plain English)

### What it is
Instead of requiring expensive monthly API keys, Null Library uses a clever system that logs into AI tools **exactly the way a normal user would** — through the real browser login pages (Google, Anthropic, etc.). Once you log in, it saves your session token locally. Every AI call in the app then goes through that token, making requests that look like they come from a logged-in browser user.

**Result:** You get full AI capability at no cost, using free-tier browser accounts.

### How it works (step by step)
1. A tiny local server opens briefly on your machine to catch the login callback URL.
2. Your real browser opens to the provider's login page (e.g., Google's sign-in page).
3. You log in normally. The token is captured automatically in the background.
4. The token is stored securely in your app's local data folder — never sent anywhere.
5. From then on, every AI call routes through that token as if you were browsing the web.

### Why it works
All major AI providers have browser-based OAuth login flows. The tokens those flows produce can be used to make API calls. Null Library uses the same OAuth client IDs that official CLI tools use (Google's `gemini-cli`, Kiro IDE, GitHub Copilot, etc.) — so the tokens are legitimate and fully authorized.

### Multiple accounts → No rate limits
Add multiple Google/Anthropic/OpenAI accounts per provider. The app rotates through them in round-robin order, spreading API usage so no single account hits rate limits. 5 Google accounts = 5× the free capacity.

### Smart routing
Different AI tasks are automatically routed to the best model:

| Task | Default Provider |
|------|-----------------|
| Long-form creative writing (chapters) | Gemini 2.5 Flash (Google OAuth) |
| Market research / JSON analysis | Gemini 2.5 Flash or Claude Haiku |
| Cover copy / marketing text | Claude Sonnet (Kiro OAuth) |
| Image prompt generation | Gemini Flash |
| Quality critique / proofreading | Claude Sonnet (Kiro OAuth) |
| General fallback | Gemini Flash |

### Failsafe chain
The app never fails completely. It tries each layer in order:

```
1. NullProxy OAuth accounts     ← primary (free, no API key)
2. Manual API keys in settings  ← fallback (your own paid keys)
3. Free Google Gemini           ← last resort (always available)
```

---

## 🚀 Setup Wizard

On first launch, a setup wizard walks you through connecting AI accounts:

1. **Welcome** — Overview of the NullProxy Engine
2. **Connect Accounts** — Click "Connect" per provider; your browser opens the login page
3. **API Keys** — Optionally add fallback API keys (Gemini, Claude, OpenAI)
4. **Ready** — Summary and launch

You can re-run the wizard anytime from **AI Proxy Settings** in the menu.

---

## ⚙️ Settings: AI Proxy Options

Open from the title bar menu → **AI Proxy Settings**.

### Status Tab
- Per-provider account health (green/red indicator)
- Total accounts connected / healthy count
- **Multi-Account Round Robin** toggle — rotate through accounts for load balancing
- **Failsafe Mode** toggle — fall back to free Gemini if all proxy accounts fail

### Accounts Tab
- Add new OAuth accounts per provider (click "+" → browser login)
- Remove accounts
- View per-account usage stats (call count, last used date)

### Routing Tab
- Drag to reorder provider priority
- Per-task routing rules (which providers are tried for each task type)

### API Keys Tab
- Enter manual API keys (used as fallback only)
- Google Gemini, Anthropic Claude, OpenAI

---

## 📖 Features

- **Market Research**: Hot genre finder, topic brainstorming, competitor analysis
- **Book Outlining**: AI-generated table of contents from market data
- **Chapter Writing**: Generate full chapters in parallel (High-Concurrency mode)
- **Humanization**: Pass all chapters through a humanizer for natural tone
- **Illustration**: AI image prompts and image generation per chapter
- **Cover Design**: Generate KDP-ready book cover art
- **EPUB Export**: Publish-ready EPUB with images, author bio, and back matter
- **KDP Marketing**: Auto-generated descriptions, categories, and keywords
- **Batch Mode**: Generate entire libraries of books automatically
- **KDP Automation**: Bot-assisted upload to Amazon KDP (Electron only)
- **Project Save/Load**: Full project state saved to disk as JSON

---

## 🔧 Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Build Electron app
npm run electron:build
```

### Environment Variables
```env
# Fallback Gemini API key (optional — NullProxy Engine doesn't need it)
VITE_GOOGLE_API_KEY=AIza...
```

---

## 🏗️ Architecture

```
App.tsx                        Main React app with wizard gate
├── SetupWizardStep            First-run OAuth setup wizard
├── ProxySettingsModal         AI Proxy settings UI
├── TitleBar                   Custom frame with Null Library branding
└── steps/                     Book creation pipeline steps

services/
├── aiService.ts               Unified AI router (proxy → key → free Gemini)
├── nullProxyService.ts        NullProxy Engine (routing, round-robin, OAuth calls)
├── oauthSetupService.ts       OAuth browser login flow bridge
├── geminiService.ts           Legacy Gemini service (kept for compatibility)
└── desktopBridge.ts           Electron/Tauri/Browser bridge

electron/
├── main.ts                    OAuth IPC handlers, local callback server
└── preload.ts                 Secure IPC bridge (contextIsolation)
```

---

## Logo

The Null Library logo depicts a **digital brain made of interlocking puzzle pieces** contained within the outline of an open book — symbolizing structured intelligence and infinite creative possibility. See `components/NullLibraryLogo.tsx`.

---

## License

MIT — do whatever you want. Build infinite books.

---

## 🔑 Configuring OAuth Providers (Electron)

OAuth proxy connections require registering OAuth 2.0 client credentials. Set them in a `.env` file (gitignored):

```env
# Gemini CLI OAuth (Google Cloud Platform scope)
# Register at https://console.cloud.google.com → APIs & Services → Credentials
# Or use credentials from the open-source gemini-cli project
GEMINI_CLI_CLIENT_ID=your-client-id.apps.googleusercontent.com
GEMINI_CLI_CLIENT_SECRET=your-client-secret

# Second Google account channel (optional, for load balancing)
GEMINI_ANTIGRAVITY_CLIENT_ID=your-second-client-id.apps.googleusercontent.com
GEMINI_ANTIGRAVITY_CLIENT_SECRET=your-second-client-secret
```

Copy `.env.example` to `.env` and fill in your values. If you don't configure OAuth credentials, manual API keys (Settings → API Keys) and free Gemini still work.
