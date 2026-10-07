window.MSA = window.MSA || {};
MSA.validation = {
  passwordRules(value) { return { length: value.length >= MSA.config.password.min && value.length <= MSA.config.password.max }; },
  field(name, value, values = {}, mode = 'cadastro') {
    if (!String(value || '').trim()) return 'Preencha este campo.';
    if (name === 'nome' && value.trim().length > 120) return 'Use um nome de até 120 caracteres.';
    if (name === 're' && !MSA.config.re.pattern.test(value.trim())) return 'Informe um RE com até 10 números.';
    if (name === 'cargo' && !MSA.config.roles.some(role => role.id === value)) return 'Selecione um cargo válido.';
    if (name === 'senha' && mode === 'cadastro' && !this.passwordRules(value).length) return 'Use uma senha com 6 a 64 caracteres.';
    return '';
  },
  form(values, mode) {
    const fields = mode === 'login' ? ['re', 'senha'] : ['nome', 're', 'cargo', 'senha'];
    return Object.fromEntries(fields.map(name => [name, this.field(name, values[name] || '', values, mode)]).filter(([, error]) => error));
  }
};
