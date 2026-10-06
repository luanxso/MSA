/* Carregamento do SDK separado da interface. Uma falha de rede não desativa os formulários. */
window.MSA = window.MSA || {};
(() => {
  'use strict';
  const sdkURL = 'https://www.gstatic.com/firebasejs/12.19.0/';
  let connection;
  function deadline(promise, milliseconds = 15000) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(Object.assign(new Error('Serviço indisponível.'), { code: 'app/network-timeout' })), milliseconds);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }
  async function analytics(app) {
    try {
      const sdk = await import(sdkURL + 'firebase-analytics.js');
      if (!await sdk.isSupported()) return;
      const cleanURL = value => { try { const url = new URL(value); return url.origin + url.pathname; } catch { return ''; } };
      sdk.initializeAnalytics(app, { config: {
        page_location: cleanURL(location.href),
        page_referrer: cleanURL(document.referrer)
      } });
      MSA.firebase.analytics = sdk.getAnalytics(app);
    } catch {
      /* Bloqueadores ou Analytics indisponível não impedem o acesso. */
    }
  }
  async function initialize() {
    const [appSDK, authSDK, databaseSDK] = await Promise.all([
      import(sdkURL + 'firebase-app.js'),
      import(sdkURL + 'firebase-auth.js'),
      import(sdkURL + 'firebase-database.js')
    ]);
    const app = appSDK.getApps().length ? appSDK.getApp() : appSDK.initializeApp(MSA.firebaseConfig);
    const client = {
      app,
      auth: authSDK.getAuth(app),
      database: databaseSDK.getDatabase(app),
      authSDK,
      databaseSDK
    };
    void analytics(app);
    return client;
  }
  MSA.firebase = {
    analytics: null,
    ready() {
      if (!connection) connection = deadline(initialize()).catch(error => { connection = null; throw error; });
      return connection;
    }
  };
})();
