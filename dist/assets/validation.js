window.MSA = window.MSA || {};
MSA.validation = {
  passwordRules(value) {
    return { length: value.length >= MSA.config.password.min && value.length <= MSA.config.password.max, upper: /[A-Z]/.test(value), lower: /[a-z]/.test(value), number: /\d/.test(value) };
  },
  field(name, value, values = {}, mode = 'cadastro') {
    if (!value || !value.trim()) return 'Preencha este campo.';
    if (name === 'nome' && (value.trim().split(/\s+/).length < 2 || value.trim().length > 120)) return 'Informe seu nome completo (até 120 caracteres).';
    if (name === 're' && !MSA.config.re.pattern.test(value.trim())) return `Informe um RE com ${MSA.config.re.min} a ${MSA.config.re.max} dígitos, sem letras ou símbolos.`;
    if (name === 'cargo' && !MSA.config.roles.some(role => role.id === value)) return 'Selecione um cargo válido.';
    if (name === 'senha' && mode === 'cadastro' && !Object.values(this.passwordRules(value)).every(Boolean)) return 'Use de 8 a 64 caracteres, com maiúscula, minúscula e número.';
    if (name === 'confirmacao' && value !== values.senha) return 'As senhas não coincidem.';
    return '';
  },
  form(values, mode) {
    const fields = mode === 'login' ? ['re', 'senha'] : ['nome', 're', 'cargo', 'senha', 'confirmacao'];
    return Object.fromEntries(fields.map(name => [name, this.field(name, String(values[name] ?? ''), values, mode)]).filter(([, error]) => error));
  }
};
