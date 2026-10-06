import { handleChatRequest } from './chat.js';
import { assets, firebaseConfig } from './assets.generated.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/chat/')) return handleChatRequest(request, env, firebaseConfig);
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('Método não permitido', { status: 405 });
    const path = url.pathname === '/' ? '/index.html' : url.pathname;
    const asset = assets[path];
    if (!asset) return new Response('Página não encontrada', { status: 404 });
    const bytes = asset.base64 ? Uint8Array.from(atob(asset.body), (character) => character.charCodeAt(0)) : asset.body;
    return new Response(request.method === 'HEAD' ? null : bytes, {
      headers: {
        'Content-Type': asset.type,
        'Cache-Control': path.endsWith('.html') ? 'no-cache' : 'public, max-age=0, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'same-origin',
        'Content-Security-Policy': "default-src 'self'; script-src 'self' https://www.gstatic.com https://www.googletagmanager.com; style-src 'self'; img-src 'self' data: https://*.google-analytics.com; connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firebaseinstallations.googleapis.com https://firebase.googleapis.com https://*.firebaseio.com https://*.firebasedatabase.app wss://*.firebaseio.com wss://*.firebasedatabase.app https://*.google-analytics.com https://analytics.google.com https://www.googletagmanager.com; frame-src https://msa-safety-9f978.firebaseapp.com; base-uri 'self'; form-action 'self'",
      },
    });
  },
};
