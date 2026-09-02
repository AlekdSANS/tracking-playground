export const RUNNER_TIMEOUT_MS = 4000

export function createSimulationSummary(payload) {
  const parameterNames = Object.keys(payload).filter((key) => key !== 'event')
  return {
    triggerName: payload.event,
    parameterNames,
    parameterCount: parameterNames.length,
    dataLayerLength: 1,
    networkRequests: 0,
  }
}

export const DISPOSABLE_RUNNER_DOCUMENT = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; style-src 'unsafe-inline'; font-src 'none'; media-src 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'">
    <meta name="referrer" content="no-referrer">
    <style>
      body{margin:0;background:#101116;color:#eef0f5;font:12px ui-monospace,monospace}
      .box{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:center;margin:10px;padding:14px;border:1px solid #343741;border-radius:10px}
      .dot{color:#b6ff67}.muted{display:block;margin-top:3px;color:#858994;font-size:10px}
    </style>
  </head>
  <body>
    <div class="box"><span class="dot">●</span><div>Fresh isolated process<span class="muted" id="status">Waiting for one validated payload…</span></div></div>
    <script>
      (() => {
        const status = document.getElementById('status');
        addEventListener('message', event => {
          if (event.data?.type !== 'runner:connect' || !event.ports[0]) return;
          const port = event.ports[0];
          const runId = event.data.runId;
          port.onmessage = message => {
            if (message.data?.type !== 'runner:execute' || message.data.runId !== runId) return;
            try {
              const payload = JSON.parse(JSON.stringify(message.data.payload));
              if (!payload || typeof payload !== 'object' || Array.isArray(payload) || typeof payload.event !== 'string') throw new Error('Invalid payload');
              const dataLayer = [];
              dataLayer.push(payload);
              const parameterNames = Object.keys(payload).filter(key => key !== 'event');
              status.textContent = 'One event simulated. Disposing…';
              port.postMessage({ type: 'runner:result', runId, payload, summary: { triggerName: payload.event, parameterNames, parameterCount: parameterNames.length, dataLayerLength: dataLayer.length, networkRequests: 0 } });
            } catch (error) {
              port.postMessage({ type: 'runner:error', runId, message: 'The isolated process rejected the payload.' });
            }
          };
          port.start();
          port.postMessage({ type: 'runner:ready', runId });
        }, { once: true });
      })();
    </script>
  </body>
</html>`
