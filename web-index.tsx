import React from 'react';
import { createRoot } from 'react-dom/client';

// Self-hosted brand fonts (BRAND-002). Bundled by Vite into /assets and served
// same-origin, so the tight CSP (`font-src 'self'`) needs no third-party origins
// and no user IP/UA ever reaches Google Fonts. Variable files cover every weight;
// browsers fetch only the unicode subsets they actually render.
import '@fontsource-variable/plus-jakarta-sans/index.css';
import '@fontsource-variable/plus-jakarta-sans/wght-italic.css';
import '@fontsource-variable/space-grotesk/index.css';

async function main() {
  try {
    const container = document.getElementById('root')!;
    const root = createRoot(container);
    const { default: App } = await import('./App');
    root.render(<App />);
  } catch (err: any) {
    document.getElementById('root')!.innerHTML =
      `<div style="color:red;padding:20px;font-family:monospace;font-size:14px;background:#1a0000">
        <b>Render Error:</b><br/>${err?.message}<br/><pre>${err?.stack}</pre>
      </div>`;
  }
}

main();
