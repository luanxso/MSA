/* Adaptador Firebase. A interface continua dependendo somente de MSA.auth. */
window.MSA = window.MSA || {};
(() => {
  'use strict';
  const REMEMBER = 'msa.auth.remembered-re';
  const aliasDomain = 'msa-safety-9f978.invalid';
  let current = null;
  const emailForRE = re => `re-${re}@${aliasDomain}`;
  const failure = (code, message, field) => Object.assign(new Error(message), { code, field, userFacing: true });
  function request(promise) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(Object.assign(new Error('Tempo de conexão excedido.'), { code: 'database/network-timeout' })), 20000);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }
  function validate(values, mode) {
    const errors = MSA.validation.form(values, mode);
    if (Object.keys(errors).length) {
      const [field, message] = Object.entries(errors)[0];
      throw failure('VALIDATION', message, field);
    }
  }
  function translated(error) {
    if (error.userFacing) return error;
    const code = String(error.code || '').toLowerCase();
    if (['auth/invalid-credential', 'auth/invalid-login-credentials', 'auth/wrong-password', 'auth/user-not-found'].includes(code)) {
      return failure(code, 'RE ou senha incorretos. Verifique os dados e tente novamente.', 'senha');
    }
    if (code === 'auth/email-already-in-use') return failure(code, 'Este RE já possui cadastro. Acesse sua conta ou procure o suporte interno.', 're');
    if (['auth/weak-password', 'auth/password-does-not-meet-requirements'].includes(code)) return failure(code, 'A senha não atende aos requisitos de segurança. Use uma senha com pelo menos 6 caracteres.', 'senha');
    if (code === 'auth/user-disabled') return failure(code, 'Seu acesso está bloqueado. Procure o responsável pelo sistema.');
    if (code === 'auth/too-many-requests') return failure(code, 'Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente.');
    if (code.includes('permission_denied') || code.includes('permission-denied')) return failure(code, 'Não foi possível acessar seu perfil. Procure o responsável pelo sistema.');
    if (['auth/operation-not-allowed', 'auth/configuration-not-found', 'auth/invalid-api-key', 'auth/app-not-authorized', 'auth/unauthorized-domain'].includes(code)) {
      return failure(code, 'O serviço de acesso ainda precisa ser configurado. Procure o responsável pelo sistema.');
    }
    if (code.includes('network') || code === 'auth/timeout' || error instanceof TypeError) return failure(code, 'Não foi possível conectar ao serviço. Verifique sua conexão e tente novamente.');
    return failure(code || 'SERVICE', 'Não foi possível concluir a operação. Tente novamente ou procure o suporte interno.');
  }
  function publicUser(firebaseUser, profile) {
    if (!profile || typeof profile.nome !== 'string' || !profile.nome.trim() || typeof profile.re !== 'string' || !MSA.config.re.pattern.test(profile.re) || firebaseUser.email !== emailForRE(profile.re)) {
      throw failure('PROFILE_MISSING', 'Seu acesso ainda não está completo. Volte ao cadastro com o mesmo RE e senha ou procure o suporte interno.');
    }
    if (!['pendente', 'ativo', 'bloqueado'].includes(profile.status)) throw failure('PROFILE_INVALID', 'Seu perfil precisa ser revisado pelo responsável pelo sistema.');
    if (profile.status === 'ativo' && !MSA.config.roles.some(role => role.id === profile.cargo)) throw failure('ROLE_INVALID', 'Escolha Operador, Supervisor ou Chefe no cadastro.');
    return Object.freeze({
      id: firebaseUser.uid,
      nome: profile.nome,
      re: profile.re,
      cargoSolicitado: profile.cargoSolicitado,
      cargo: profile.status === 'ativo' ? profile.cargo : null,
      status: profile.status,
      setorId: profile.setorId || '',
      maquinaId: profile.maquinaId || '',
      createdAt: profile.createdAt
    });
  }
  const profileRef = (client, uid) => client.databaseSDK.ref(client.database, `perfis/${uid}`);
  async function readProfile(client, firebaseUser) {
    const snapshot = await request(client.databaseSDK.get(profileRef(client, firebaseUser.uid)));
    let profile = snapshot.val();
    if (profile && profile.status !== 'bloqueado') {
      const previousRole = profile.cargo || profile.cargoSolicitado;
      const cargo = previousRole === 'gestor' ? 'chefe' : previousRole;
      if (MSA.config.roles.some(role => role.id === cargo) && (profile.status === 'pendente' || profile.cargo !== cargo || profile.setorId == null || profile.maquinaId == null)) {
        const maquinaId = cargo === 'operador' ? (profile.maquinaId || '') : '';
        const setorId = cargo === 'chefe' || (cargo === 'operador' && !maquinaId) ? '' : (profile.setorId || '');
        const patch = { cargo, status: 'ativo', setorId, maquinaId };
        await request(client.databaseSDK.update(profileRef(client, firebaseUser.uid), patch));
        profile = { ...profile, ...patch };
      }
    }
    return publicUser(firebaseUser, profile);
  }
  async function quietlySignOut(client) {
    current = null;
    try { await client.authSDK.signOut(client.auth); } catch { /* A próxima leitura valida a sessão novamente. */ }
  }
  MSA.auth = {
    mode: 'firebase',
    async ready() {
      try {
        const client = await MSA.firebase.ready();
        await client.auth.authStateReady();
        current = client.auth.currentUser ? await readProfile(client, client.auth.currentUser) : null;
        return current;
      } catch (error) { current = null; throw translated(error); }
    },
    async register(values) {
      validate(values, 'cadastro');
      const re = values.re.trim();
      let client;
      try {
        client = await MSA.firebase.ready();
        await client.auth.authStateReady();
        await client.authSDK.setPersistence(client.auth, client.authSDK.browserSessionPersistence);
        let credential;
        try {
          credential = await client.authSDK.createUserWithEmailAndPassword(client.auth, emailForRE(re), values.senha);
        } catch (error) {
          if (error.code !== 'auth/email-already-in-use') throw error;
          /* Retoma um cadastro cujo Auth foi criado, mas cujo perfil não pôde ser salvo. */
          try { credential = await client.authSDK.signInWithEmailAndPassword(client.auth, emailForRE(re), values.senha); }
          catch (signInError) {
            if (['auth/invalid-credential', 'auth/invalid-login-credentials', 'auth/wrong-password', 'auth/user-not-found'].includes(signInError.code)) {
              throw failure('DUPLICATE_RE', 'Este RE já possui cadastro. Acesse sua conta ou procure o suporte interno.', 're');
            }
            throw signInError;
          }
        }
        const target = profileRef(client, credential.user.uid);
        const existing = await request(client.databaseSDK.get(target));
        if (existing.exists()) throw failure('DUPLICATE_RE', 'Este RE já possui cadastro. Acesse sua conta ou procure o suporte interno.', 're');
        const profile = {
          nome: values.nome.trim().replace(/\s+/g, ' '),
          re,
          cargo: values.cargo,
          // Contexto de trabalho começa vazio. O RE não depende do setor atual.
          setorId: '',
          maquinaId: '',
          status: 'ativo',
          createdAt: client.databaseSDK.serverTimestamp()
        };
        await request(client.databaseSDK.set(target, profile));
        current = publicUser(credential.user, profile);
        return current;
      } catch (error) { if (client) await quietlySignOut(client); throw translated(error); }
      /* O cadastro já mantém a sessão para entrar imediatamente. */
    },
    async login({ re, senha, remember = false }) {
      validate({ re, senha }, 'login');
      let client;
      try {
        client = await MSA.firebase.ready();
        await client.auth.authStateReady();
        current = null;
        await client.authSDK.setPersistence(client.auth, remember ? client.authSDK.browserLocalPersistence : client.authSDK.browserSessionPersistence);
        const credential = await client.authSDK.signInWithEmailAndPassword(client.auth, emailForRE(re.trim()), senha);
        current = await readProfile(client, credential.user);
        try {
          if (remember) localStorage.setItem(REMEMBER, current.re);
          else localStorage.removeItem(REMEMBER);
        } catch { /* O SDK controla a sessão; lembrar o RE é opcional. */ }
        return current;
      } catch (error) {
        if (client) await quietlySignOut(client);
        throw translated(error);
      }
    },
    session() { return current; },
    async token() {
      try {
        const client = await MSA.firebase.ready();
        await client.auth.authStateReady();
        if (!client.auth.currentUser) throw failure('SESSION_REQUIRED', 'Sua sessão expirou. Entre novamente.');
        return await request(client.auth.currentUser.getIdToken());
      } catch (error) { throw translated(error); }
    },
    async logout() {
      try {
        const client = await MSA.firebase.ready();
        await client.authSDK.signOut(client.auth);
        current = null;
      } catch (error) { throw translated(error); }
    },
    async watch(listener, onError) {
      const client = await MSA.firebase.ready();
      let stopProfile = () => {};
      const stopAuth = client.authSDK.onAuthStateChanged(client.auth, firebaseUser => {
        stopProfile();
        current = null;
        if (!firebaseUser) { listener(null); return; }
        stopProfile = client.databaseSDK.onValue(profileRef(client, firebaseUser.uid), snapshot => {
          if (client.auth.currentUser?.uid !== firebaseUser.uid) return;
          try { current = publicUser(firebaseUser, snapshot.val()); listener(current); }
          catch (error) { current = null; onError(translated(error)); }
        }, error => { current = null; onError(translated(error)); });
      }, error => { current = null; onError(translated(error)); });
      return () => { stopAuth(); stopProfile(); };
    },
    rememberedRE() { try { return localStorage.getItem(REMEMBER) || ''; } catch { return ''; } },
    role(user = current) { return user?.status === 'ativo' ? MSA.config.roles.find(role => role.id === user.cargo) || null : null; },
    can(permission, user = current) { return MSA.rbac.can(permission, user); },
    home(user = current) {
      const role = this.role(user);
      return user ? (role ? `sistema.html#${encodeURIComponent(role.home)}` : 'acesso.html') : 'index.html';
    }
  };
})();
