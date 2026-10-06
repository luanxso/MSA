/* Catálogo de interface. Autorizações de dados devem ser aplicadas no Firebase. */
window.MSA = window.MSA || {};
MSA.config = Object.freeze({
  re: { min: 4, max: 10, pattern: /^\d{4,10}$/ },
  password: { min: 8, max: 64 },
  roles: [
    { id: 'operador', label: 'Operador', home: 'apontamentos', permissions: ['apontamentos:criar', 'maquinas:ler'] },
    { id: 'lider', label: 'Líder', home: 'producao', permissions: ['producao:ler', 'apontamentos:ler', 'funcionarios:ler', 'paradas:ler'] },
    { id: 'supervisor', label: 'Supervisor', home: 'producao', permissions: ['producao:ler', 'maquinas:ler', 'funcionarios:ler', 'paradas:ler', 'indicadores:ler', 'relatorios:ler'] },
    { id: 'manutencao', label: 'Manutenção', home: 'maquinas', permissions: ['maquinas:ler', 'paradas:gerenciar'] },
    { id: 'qualidade', label: 'Qualidade', home: 'indicadores', permissions: ['indicadores:ler', 'apontamentos:ler', 'relatorios:ler'] },
    { id: 'gestor', label: 'Gestor', home: 'indicadores', permissions: ['producao:ler', 'maquinas:ler', 'funcionarios:ler', 'paradas:ler', 'indicadores:ler', 'apontamentos:ler', 'relatorios:ler'] }
  ],
  areas: { producao: 'Produção', maquinas: 'Máquinas', funcionarios: 'Funcionários', paradas: 'Paradas', indicadores: 'Indicadores', apontamentos: 'Apontamentos', relatorios: 'Relatórios' }
});
