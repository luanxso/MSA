import assert from 'node:assert/strict';

export const firebaseConfig = {
  apiKey: 'public-test-api-key', projectId: 'msa-test',
  databaseURL: 'https://msa-test-default-rtdb.firebaseio.com',
};

export function token(uid, overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  const claims = { aud: 'msa-test', iss: 'https://securetoken.google.com/msa-test', sub: uid, exp: now + 3600, auth_time: now, ...overrides };
  return `${Buffer.from('{"alg":"RS256"}').toString('base64url')}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.test-signature`;
}

// O servidor de teste simula as respostas oficiais, sem criar contas ou enviar tokens ao Firebase.
export function mockFirebase(t) {
  const profiles = new Map(['a', 'b', 'c'].map((uid, index) => [uid, { nome: `Funcionário ${uid}`, re: String(1001 + index), status: 'ativo', cargo: 'operador' }]));
  const identities = new Map([...profiles].map(([uid, profile]) => [uid, { localId: uid, email: `re-${profile.re}@msa-test.invalid` }]));
  const state = { profiles, identities, rejectedTokens: new Set(), calls: 0, unavailable: false };
  t.mock.method(globalThis, 'fetch', async (input, options = {}) => {
    state.calls += 1;
    if (state.unavailable) throw new Error('Rede indisponível');
    const url = new URL(input);
    if (url.hostname === 'identitytoolkit.googleapis.com') {
      assert.equal(options.method, 'POST');
      assert.equal(url.searchParams.get('key'), firebaseConfig.apiKey);
      const idToken = JSON.parse(options.body).idToken;
      const uid = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString()).sub;
      if (state.rejectedTokens.has(idToken) || !identities.has(uid)) return Response.json({ error: { message: 'INVALID_ID_TOKEN' } }, { status: 400 });
      return Response.json({ users: [identities.get(uid)] });
    }
    assert.equal(url.origin, firebaseConfig.databaseURL);
    const uid = decodeURIComponent(url.pathname.slice('/perfis/'.length, -'.json'.length));
    assert.equal(JSON.parse(Buffer.from(url.searchParams.get('auth').split('.')[1], 'base64url').toString()).sub, uid);
    return Response.json(profiles.get(uid) || null);
  });
  return state;
}
