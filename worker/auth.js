export class EmployeeAuthError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function tokenClaims(token, config) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error();
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(payload));
    if (claims.aud !== config.projectId || claims.iss !== `https://securetoken.google.com/${config.projectId}` || typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 128 || !Number.isFinite(claims.exp) || claims.exp <= Date.now() / 1000) throw new Error();
    return claims;
  } catch { throw new EmployeeAuthError(401, 'Sua sessão expirou. Entre novamente.'); }
}

async function firebaseRequest(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return { status: response.status, ok: response.ok, data: await response.json() };
  } catch { throw new EmployeeAuthError(503, 'Não foi possível verificar seu acesso. Tente novamente.'); }
  finally { clearTimeout(timer); }
}

export async function authenticatedEmployee(request, config) {
  const authorization = request.headers.get('Authorization') || '';
  const match = /^Bearer ([A-Za-z0-9._-]+)$/.exec(authorization);
  if (!match || match[1].length > 12000) throw new EmployeeAuthError(401, 'Entre para acessar as conversas.');
  if (!config?.apiKey || !config.projectId || !config.databaseURL) throw new EmployeeAuthError(503, 'O serviço de acesso está indisponível.');
  const token = match[1];
  const claims = tokenClaims(token, config);

  // A validação do token é realizada pelo Firebase; ler o JWT não autentica o usuário.
  const lookup = await firebaseRequest(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(config.apiKey)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token }),
  });
  if (!lookup.ok) {
    const code = lookup.data?.error?.message || '';
    if (code.includes('USER_DISABLED')) throw new EmployeeAuthError(403, 'Seu acesso está bloqueado. Procure o responsável pelo sistema.');
    if (code.includes('INVALID_ID_TOKEN') || code.includes('TOKEN_EXPIRED') || code.includes('USER_NOT_FOUND') || code.includes('CREDENTIAL_MISMATCH')) throw new EmployeeAuthError(401, 'Sua sessão expirou. Entre novamente.');
    throw new EmployeeAuthError(503, 'Não foi possível verificar seu acesso. Tente novamente.');
  }
  const identity = lookup.data?.users?.[0];
  if (!identity || identity.localId !== claims.sub || typeof identity.email !== 'string') throw new EmployeeAuthError(401, 'Sua sessão expirou. Entre novamente.');
  if (identity.disabled) throw new EmployeeAuthError(403, 'Seu acesso está bloqueado. Procure o responsável pelo sistema.');
  if (identity.validSince && (!Number.isFinite(claims.auth_time) || claims.auth_time < Number(identity.validSince))) throw new EmployeeAuthError(401, 'Sua sessão expirou. Entre novamente.');

  const profileURL = new URL(`${config.databaseURL.replace(/\/$/, '')}/perfis/${encodeURIComponent(identity.localId)}.json`);
  profileURL.searchParams.set('auth', token);
  const result = await firebaseRequest(profileURL.toString());
  if (!result.ok) throw new EmployeeAuthError(result.status === 401 || result.status === 403 ? 403 : 503, 'Não foi possível validar seu perfil. Procure o responsável pelo sistema.');
  const profile = result.data;
  if (!profile || typeof profile.nome !== 'string' || !profile.nome.trim() || profile.nome.length > 120 || typeof profile.re !== 'string' || !/^\d{1,10}$/.test(profile.re) || identity.email !== `re-${profile.re}@${config.projectId}.invalid`) throw new EmployeeAuthError(403, 'Seu cadastro precisa ser revisado pelo responsável pelo sistema.');
  if (profile.status === 'bloqueado') throw new EmployeeAuthError(403, 'Seu acesso está bloqueado. Procure o responsável pelo sistema.');
  if (profile.status !== 'ativo') throw new EmployeeAuthError(403, 'Seu cadastro ainda aguarda liberação.');
  if (!['operador', 'supervisor', 'chefe'].includes(profile.cargo)) throw new EmployeeAuthError(403, 'Seu cargo precisa ser liberado pelo responsável pelo sistema.');
  return { id: `firebase:${identity.localId}`, name: profile.nome.trim(), re: profile.re, role: profile.cargo };
}
