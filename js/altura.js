/* Dentro do menu: informa a altura do conteúdo para o iframe ficar do tamanho da página no celular
   (uma única rolagem, sem "rolagem dentro da rolagem"). Fora do menu não faz nada. */
(function(){
  if(window.parent === window) return;
  var ultimo = 0;
  function medir(){
    var b = document.body, cs = getComputedStyle(b);
    var h = Math.ceil(b.getBoundingClientRect().height + (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0));
    if(h > 0 && h !== ultimo){ ultimo = h; try{ window.parent.postMessage({tipo:'altura', px:h}, '*'); }catch(e){} }
  }
  if(window.ResizeObserver) new ResizeObserver(medir).observe(document.body);
  window.addEventListener('load', medir);
  window.addEventListener('resize', medir);
  medir();
})();
