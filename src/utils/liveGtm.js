import { isValidGtmContainerId } from './tagLab'

export const LIVE_GTM_SESSION_MS = 10 * 60 * 1000
export const LIVE_GTM_BRIDGE_HASH = 'sha256-rnY01HQPoD6l29+UxZZU27rSC+maVWlbUdnn0Ik+1kE='

export const LIVE_GTM_BRIDGE_SCRIPT = `(function(){var body=document.body;var containerId=body.dataset.containerId;var sessionToken=body.dataset.sessionToken;var status=document.getElementById('live-status');var port=null;var reports=0;function send(type,detail){if(port)port.postMessage({type:type,sessionToken:sessionToken,detail:detail||{}})}function safeClone(value){try{var text=JSON.stringify(value);if(text.length>12000)return null;return JSON.parse(text)}catch(error){return null}}window.dataLayer=window.dataLayer||[];window.dataLayer.push({'gtm.blocklist':['customPixels','customScripts','nonGooglePixels','nonGoogleScripts','nonGoogleIframes','sandboxedScripts']});function gtag(){window.dataLayer.push(arguments)}gtag('consent','default',{'ad_storage':'denied','ad_user_data':'denied','ad_personalization':'denied','analytics_storage':'granted','functionality_storage':'denied','personalization_storage':'denied','security_storage':'granted'});var nativePush=window.dataLayer.push.bind(window.dataLayer);window.dataLayer.push=function(){var items=Array.prototype.slice.call(arguments);var result=nativePush.apply(window.dataLayer,items);items.forEach(function(item){if(reports>=30||!item||typeof item!=='object'||Array.isArray(item)||typeof item.event!=='string')return;var clone=safeClone(item);if(!clone)return;reports+=1;send('live:event',{payload:clone})});return result};addEventListener('message',function(event){if(event.source!==parent||event.data?.type!=='live:connect'||event.data.sessionToken!==sessionToken||!event.ports[0])return;port=event.ports[0];port.onmessage=function(message){var data=message.data;if(!data||data.sessionToken!==sessionToken||data.type!=='live:push')return;var payload=safeClone(data.payload);if(!payload||typeof payload!=='object'||Array.isArray(payload)||typeof payload.event!=='string')return;window.dataLayer.push(payload);send('live:pushed',{eventName:payload.event})};port.start();send('live:status',{status:'loading'});window.dataLayer.push({'gtm.start':Date.now(),event:'gtm.js'});var script=document.createElement('script');script.async=true;script.src='https://www.googletagmanager.com/gtm.js?id='+encodeURIComponent(containerId);script.onload=function(){status.textContent=containerId+' connected';send('live:status',{status:'connected'})};script.onerror=function(){status.textContent='Container could not load';send('live:status',{status:'error'})};document.head.appendChild(script)},{once:true})})();`

function escapeAttribute(value) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

export function buildLiveGtmDocument(containerId, sessionToken) {
  const normalizedId = containerId.trim().toUpperCase()
  if (!isValidGtmContainerId(normalizedId)) throw new Error('Invalid GTM container ID.')
  if (!/^live-[1-9][0-9]{0,5}$/.test(sessionToken)) throw new Error('Invalid live-session token.')
  const safeId = escapeAttribute(normalizedId)
  const safeToken = escapeAttribute(sessionToken)
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src '${LIVE_GTM_BRIDGE_HASH}' https://www.googletagmanager.com; script-src-elem '${LIVE_GTM_BRIDGE_HASH}' https://www.googletagmanager.com; connect-src https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com; img-src https://www.googletagmanager.com https://*.google-analytics.com; style-src 'unsafe-inline'; frame-src 'none'; worker-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'">
    <meta name="referrer" content="no-referrer">
    <style>body{margin:0;background:#151219;color:#f2edf6;font:12px ui-monospace,monospace}.box{display:grid;grid-template-columns:auto 1fr;gap:11px;align-items:center;margin:10px;padding:14px;border:1px solid #49384e;border-radius:10px}.dot{color:#ff78ce}.muted{display:block;margin-top:4px;color:#a28da7;font-size:10px}</style>
  </head>
  <body data-container-id="${safeId}" data-session-token="${safeToken}">
    <div class="box"><span class="dot">●</span><div>Opt-in Live GTM session<span class="muted" id="live-status">Waiting for secure channel…</span></div></div>
    <script>${LIVE_GTM_BRIDGE_SCRIPT}</script>
  </body>
</html>`
}
