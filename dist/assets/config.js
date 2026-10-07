/* Uma interface, três cargos e um catálogo inicial para a apresentação. */
window.MSA = window.MSA || {};
(() => {
  const common = ['visao-geral:ler', 'mapa-planta:ler', 'producao:ler', 'maquinas:ler', 'paradas:ler', 'qualidade:ler', 'ocorrencias:ler', 'chat:usar', 'notificacoes:ler', 'configuracoes:ler'];
  MSA.config = Object.freeze({
    re: { min: 1, max: 10, pattern: /^\d{1,10}$/ },
    password: { min: 6, max: 64 },
    roles: [
      { id: 'operador', label: 'Operador', home: 'visao-geral', permissions: [...common, 'apontamentos:ler', 'producao:registrar', 'leituras:registrar', 'paradas:registrar', 'perdas:registrar', 'ocorrencias:registrar'] },
      { id: 'supervisor', label: 'Supervisor', home: 'visao-geral', permissions: [...common, 'conferencia:ler', 'registros:verificar', 'maquinas:gerenciar', 'funcionarios:ler', 'funcionarios:atribuir', 'relatorios:ler', 'consolidacoes:registrar', 'paradas:gerenciar', 'ocorrencias:gerenciar'] },
      { id: 'chefe', label: 'Chefe', home: 'visao-geral', permissions: [...common, 'indicadores:ler', 'funcionarios:ler', 'relatorios:ler', 'setores:gerenciar', 'metas:gerenciar'] }
    ],
    areas: { 'visao-geral': 'Visão geral', 'mapa-planta': 'Mapa da Planta', producao: 'Produção', maquinas: 'Máquinas', apontamentos: 'Apontamentos', conferencia: 'Conferência', paradas: 'Paradas', qualidade: 'Qualidade', ocorrencias: 'Ocorrências', funcionarios: 'Funcionários', indicadores: 'Indicadores', relatorios: 'Relatórios', chat: 'Chat', notificacoes: 'Notificações', configuracoes: 'Configurações' },
    sectors: [ { id: 'selagem', nome: 'Selagem' }, { id: 'injecao', nome: 'Injeção' }, { id: 'montagem', nome: 'Montagem de abafadores' } ],
    machines: [
      { id: 'SEL-01', nome: 'Selagem 01', setorId: 'selagem', processo: 'Selagem', produto: 'Selo V-Gard HP', metaDiaria: 1200, parametros: { temperatura: { nome: 'Temperatura', unidade: '°C', min: 250, max: 260 }, pressao: { nome: 'Pressão', unidade: 'bar', min: 6.5, max: 7 }, vacuo: { nome: 'Vácuo', unidade: 'mmHg', min: -600, max: -300 } } },
      { id: 'INJ-01', nome: 'Injetora 01', setorId: 'injecao', processo: 'Injeção', produto: 'Capacete', metaDiaria: 1800, parametros: { temperatura: { nome: 'Temperatura', unidade: '°C', min: 230, max: 260 }, ciclo: { nome: 'Tempo de ciclo', unidade: 's', min: 20, max: 35 } } },
      { id: 'INJ-02', nome: 'Injetora 02', setorId: 'injecao', processo: 'Injeção', produto: 'Capacete', metaDiaria: 1800, parametros: {} },
      { id: 'ABF-01', nome: 'Montagem 01', setorId: 'montagem', processo: 'Montagem de abafadores', produto: 'Abafador', metaDiaria: 2000, parametros: {} },
      { id: 'ABF-02', nome: 'Montagem 02', setorId: 'montagem', processo: 'Montagem de abafadores', produto: 'Abafador', metaDiaria: 2000, parametros: {} }
    ]
  });
})();
