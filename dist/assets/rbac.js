window.MSA = window.MSA || {};
(() => {
  'use strict';
  const role = user => user?.status === 'ativo' ? MSA.config.roles.find(item => item.id === user.cargo) || null : null;
  function inScope(user, record) {
    if (!role(user) || !record) return false;
    if (['chefe','qualidade'].includes(user.cargo)) return true;
    if (record.setorId !== user.setorId) return false;
    return user.cargo === 'supervisor' || (record.maquinaId || record.id) === user.maquinaId;
  }
  function can(permission, user, record) {
    if (!role(user)?.permissions.includes(permission)) return false;
    if (!record) return true;
    if (!inScope(user, record)) return false;
    return user.cargo !== 'operador' || !record.usuarioId || record.usuarioId === user.id;
  }
  MSA.rbac = Object.freeze({
    role, inScope, can,
    route(page, user) { return can(page === 'chat' ? 'chat:usar' : page + ':ler', user); },
    require(permission, user, record) {
      if (!can(permission, user, record)) throw Object.assign(new Error('Você não possui acesso a esta ação ou máquina.'), { code: 'ACCESS_DENIED' });
    }
  });
})();
