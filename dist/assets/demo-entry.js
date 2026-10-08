/* Entrada compatível com links antigos; usa a mesma interface do sistema atual. */
(() => {
  const params = new URLSearchParams(location.search);
  params.delete('dados');
  params.set('demonstracao', '1');
  location.replace('sistema.html?' + params.toString() + location.hash);
})();
