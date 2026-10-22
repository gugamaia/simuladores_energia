/* Tema claro/escuro. Ordem de decisão: escolha salva pelo usuário > preferência do sistema.
   Dentro do menu (iframe), o tema vem do menu por postMessage; fora dele, vale a escolha salva/sistema. */
(function(){
  var KEY = 'simuladores-tema', raiz = document.documentElement;
  function sistema(){ return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'escuro' : 'claro'; }
  function salvo(){ try{ var v = localStorage.getItem(KEY); return (v === 'claro' || v === 'escuro') ? v : null; }catch(e){ return null; } }
  function aplicar(t){ raiz.setAttribute('data-tema', t); }
  window.Tema = {
    atual: function(){ return raiz.getAttribute('data-tema') || 'claro'; },
    definir: function(t, guardar){
      if(t !== 'claro' && t !== 'escuro') return;
      aplicar(t);
      if(guardar){ try{ localStorage.setItem(KEY, t); }catch(e){} }
    },
    alternar: function(){ var n = window.Tema.atual() === 'escuro' ? 'claro' : 'escuro'; window.Tema.definir(n, true); return n; }
  };
  aplicar(salvo() || sistema());
  if(window.parent !== window){
    window.addEventListener('message', function(e){
      var d = e.data || {};
      if(d.tipo === 'tema' && (d.tema === 'claro' || d.tema === 'escuro')) aplicar(d.tema);
    });
    try{ window.parent.postMessage({tipo:'tema-pedir'}, '*'); }catch(e){}
  }
})();
