const CFG = window.CONFIG || {};
const GC = String(CFG.goatcounter||'').trim();
const TOOLS = {
  indicacao:{titulo:'Desconto por indica\u00e7\u00e3o', src:'indicacao.html'},
  consumo:{titulo:'M\u00e9dia e necessidade de consumo', src:'consumo.html'},
  proposta:{titulo:'Proposta de oferta', src:'proposta.html'}
};
const $ = id => document.getElementById(id);

/* ---- Celular: o iframe ganha a altura do conteúdo (uma rolagem só). Fora do celular, preenche a tela. ---- */
const CELULAR = window.matchMedia ? window.matchMedia('(max-width:720px), (max-height:480px) and (pointer:coarse)') : {matches:false};
function ajustarAltura(px){
  const f = $('frame');
  if(CELULAR.matches && px > 0) f.style.height = Math.ceil(px) + 'px'; else f.style.height = '';
}
if(CELULAR.addEventListener) CELULAR.addEventListener('change', ()=>{ $('frame').style.height = ''; });

/* ---- Tema claro/escuro (js/tema.js) ---- */
function enviarTema(){ const f = $('frame').contentWindow; if(f) f.postMessage({tipo:'tema', tema:Tema.atual()}, '*'); }
function pintarTema(){ $('tema').checked = Tema.atual() === 'escuro'; }   // chave ligada = tema escuro
$('tema').addEventListener('change', ()=>{ Tema.definir($('tema').checked ? 'escuro' : 'claro', true); enviarTema(); });
$('frame').addEventListener('load', enviarTema);
pintarTema();

/* ---- Versão publicada (versao.js) ---- */
const VER = window.VERSAO || {numero:'?', data:''};
$('versaoNav').textContent = 'v' + VER.numero;
$('versao').textContent = 'Versão ' + VER.numero + (VER.data ? ' (' + VER.data.split('-').reverse().join('/') + ')' : '');

/* ---- GoatCounter (contagem de acessos e simula\u00e7\u00f5es) ---- */
/* Não contar as próprias visitas: abra o site uma vez com ?contar=nao (e ?contar=sim para voltar a contar) */
try{
  if(/[?&]contar=nao\b/.test(location.search)) localStorage.setItem('skipgc','t');
  if(/[?&]contar=sim\b/.test(location.search)) localStorage.removeItem('skipgc');
}catch(e){}
const NAO_CONTAR = (()=>{ try{ return localStorage.getItem('skipgc') === 't'; }catch(e){ return false; } })();
if(GC){
  const s = document.createElement('script');
  s.async = true; s.src = '//gc.zgo.at/count.js';
  s.setAttribute('data-goatcounter','https://'+GC+'.goatcounter.com/count');
  document.head.appendChild(s);
}
function contar(nome, titulo){
  if(!GC) return;
  let n = 0;
  (function tentar(){
    if(window.goatcounter && window.goatcounter.count){ window.goatcounter.count({path:'/'+nome, title:titulo, event:true}); }
    else if(n++ < 20){ setTimeout(tentar, 500); }
  })();
}
window.addEventListener('message', e=>{
  if(e.source !== $('frame').contentWindow) return;
  const d = e.data || {};
  if(d.tipo==='simulacao' && TOOLS[d.ferramenta]) contar('simulacao-'+d.ferramenta, 'Simula\u00e7\u00e3o - '+TOOLS[d.ferramenta].titulo);
  if(d.tipo==='proposta') contar('proposta-gerada', 'Proposta gerada');
  if(d.tipo==='tema-pedir') enviarTema();
  if(d.tipo==='altura') ajustarAltura(d.px);
});

/* ---- Painel de uso ---- */
const num = v => parseInt(String(v).replace(/\D/g,''),10) || 0;
const fmt = n => n.toLocaleString('pt-BR');
const jget = u => fetch(u).then(r=>{ if(!r.ok) throw new Error(r.status); return r.json(); });
async function painel(){
  if(!GC) return;
  $('stats').hidden = false;
  if(NAO_CONTAR) document.querySelector('#stats .priv').textContent += ' Suas visitas não estão sendo contadas neste navegador.';
  const base = 'https://'+GC+'.goatcounter.com/counter/';
  const get = p => jget(base+encodeURIComponent(p)+'.json').then(j=>num(j.count)).catch(()=>null);
  const [ac, si, sc, pr] = await Promise.all([get(location.pathname||'/'), get('/simulacao-indicacao'), get('/simulacao-consumo'), get('/proposta-gerada')]);
  $('kProps').textContent = pr===null ? '-' : fmt(pr);
  $('kAcessos').textContent = ac===null ? '-' : fmt(ac);
  if(si===null && sc===null){ $('kSims').textContent = '-'; }
  else { $('kSims').textContent = fmt((si||0)+(sc||0)); $('kSimsDet').textContent = 'Indica\u00e7\u00e3o: '+fmt(si||0)+' \u00b7 Consumo: '+fmt(sc||0); }
  const ul = $('top5');
  if(CFG.locationsUrl){
    try{
      const arr = await jget(CFG.locationsUrl);
      ul.innerHTML = arr.slice(0,5).map(x=>'<li><span>'+String(x.name).replace(/</g,'&lt;')+'</span><b>'+fmt(num(x.count))+'</b></li>').join('') || '<li class="mute">Sem dados ainda.</li>';
    }catch(e){ ul.innerHTML = '<li class="mute">N\u00e3o foi poss\u00edvel carregar as localidades.</li>'; }
  } else {
    ul.innerHTML = '<li class="mute">Veja o Top de localidades no <a href="https://'+GC+'.goatcounter.com" target="_blank" rel="noopener">painel do GoatCounter</a> (se\u00e7\u00e3o Locations).</li>';
  }
}
setTimeout(painel, 1500);

/* ---- Navegacao (barra superior + hash da URL) ---- */
function rota(){
  const k = location.hash.slice(1), t = TOOLS[k], emTool = !!t;
  if(emTool){
    if($('frame').getAttribute('src') !== t.src) $('frame').src = t.src;
    document.title = t.titulo + ' - Simuladores';
  } else {
    $('frame').removeAttribute('src');
    document.title = 'Simuladores';
  }
  $('menu').classList.toggle('oculto', emTool);
  $('tool').classList.toggle('ativo', emTool);
  document.querySelectorAll('#nav a').forEach(a=>{
    const ativo = a.dataset.k === (emTool ? k : 'inicio');
    a.classList.toggle('ativo', ativo);
    if(ativo) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current');
  });
  window.scrollTo(0,0);
}
document.querySelectorAll('.opt').forEach(b=>b.addEventListener('click',()=>{ location.hash = b.dataset.k; }));
window.addEventListener('hashchange', rota);
rota();
