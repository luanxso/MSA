# Modo claro e escuro

O botão de lua/sol no cabeçalho alterna o tema de todas as páginas do sistema, incluindo login, cadastro, situação do acesso, demonstração, mapa e supervisórios.

O padrão inicial é claro. A escolha é salva na preferência local `msa-theme`; recarregar, navegar, sair e entrar não altera essa preferência. Abas da mesma origem também acompanham alterações do tema. Se o navegador bloquear o armazenamento, o botão continua funcionando na página aberta.

O tema é aplicado antes da montagem da página para evitar um clarão ao abrir uma página em modo escuro. Ícone, descrição acessível e indicação de estado acompanham a escolha. A preferência não modifica perfil, sessão, formulários, registros ou cores semânticas dos estados operacionais.

Implementação compartilhada em assets/theme.js e assets/theme.css, sem dependências externas.
