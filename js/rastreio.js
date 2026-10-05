/* Registro de simulacoes (usado pelo menu para contar quantas simulacoes foram feitas).
   So atua quando a pagina esta dentro do menu (index.html). Configuracao por data-* na tag <script>:
     data-ferramenta  nome da ferramenta (indicacao | consumo)
     data-alvo        seletor do elemento observado
     data-fechar-em   (opcional) sobe do alvo ate este ancestral
     data-valido      seletor que precisa existir para o resultado ser considerado valido
   Uma simulacao e contada quando o resultado valido fica estavel por 4 segundos e difere do ultimo contado. */
(function(){
  if(window.parent===window) return;
  var cfg=document.currentScript.dataset;
  var alvo=document.querySelector(cfg.alvo);
  if(alvo && cfg.fecharEm) alvo=alvo.closest(cfg.fecharEm);
  if(!alvo) return;
  var t=null, ultimo='';
  new MutationObserver(function(){
    clearTimeout(t);
    t=setTimeout(function(){
      if(!document.querySelector(cfg.valido)) return;
      var snap=alvo.textContent; if(snap===ultimo) return; ultimo=snap;
      window.parent.postMessage({tipo:'simulacao',ferramenta:cfg.ferramenta},'*');
    },4000);
  }).observe(alvo,{childList:true,subtree:true,characterData:true,attributes:true});
})();
