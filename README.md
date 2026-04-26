This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## System-wide typing capture (macOS)

Bi-grammar can analyze your everyday typing across any macOS app via a Python
helper that streams keystrokes into Bi-grammar through a local WebSocket bridge.

### One-time setup

1. **Grant Accessibility permission to your terminal** so `pynput` can read
   keys system-wide:
   `System Settings → Privacy & Security → Accessibility` → enable Terminal
   (or iTerm / your shell of choice). You may need to fully quit and reopen
   the terminal for the change to take effect.
2. **Install the Python dependencies**:
   ```bash
   pip3 install -r scripts/requirements.txt
   ```
3. **Install the Node dependencies** (adds `ws` and `concurrently`):
   ```bash
   npm install
   ```

### Run

In one terminal, start Next.js + the WebSocket bridge together:

```bash
npm run dev:all
```

In a second terminal, start the capture script:

```bash
python3 scripts/keymaxx_capture.py
```

Open <http://localhost:3000>. Type anywhere on your Mac. After ~5 seconds of
consistent typing (no gap > 3s), a small **Recording** toast appears in the
bottom-right corner of the Bi-grammar tab. After 15 seconds of inactivity, the
session ends, the toast fades out, and the session is saved with mode
`system_wide`. The on-screen typing test is unaffected.

> **Privacy:** only printable characters, Space, and Backspace are forwarded.
> Modifiers, function keys, arrows, and navigation keys are dropped. Data
> stays on `localhost`.

If you only want to run the bridge separately:

```bash
npm run ws-bridge   # ws://127.0.0.1:8765
```

Environment variables (optional):
- `PORT`: WebSocket bridge port (default: 8765)
- `HOST`: WebSocket bridge host (default: 127.0.0.1)
- `NEXT_PUBLIC_KEYMAXX_WS_URL`: Browser connection URL (default: ws://127.0.0.1:8765)

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
