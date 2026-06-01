import React from 'react';
import { createRoot } from 'react-dom/client';

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
