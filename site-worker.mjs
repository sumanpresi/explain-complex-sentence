import {handleAI} from './ai.mjs';
import {assets} from './assets.mjs';
export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/api/ai') return handleAI(request);
    const file = assets[url.pathname === '/' ? '/index.html' : url.pathname];
    if (!Array.isArray(file)) return new Response('Not found', {status:404});
    const [type,content] = file;
    return new Response(Uint8Array.from(atob(content),char => char.charCodeAt(0)),{headers:{
      'Content-Type':type,
      'Cross-Origin-Opener-Policy':'same-origin-allow-popups',
      'Referrer-Policy':'strict-origin-when-cross-origin'
    }});
  }
};