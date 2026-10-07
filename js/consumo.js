/* Tabela de parâmetros: edite aqui para incluir/alterar distribuidoras e mínimos. */
/* Parâmetros vêm de parametros.js (fonte única). */
const P = window.PARAMETROS || {versao:'indisponivel', atualizadoEm:'', descontoSocial:200, acs:[], distribuidoras:{}};
const DEFAULTS = P.distribuidoras;
const DESCONTO_SOCIAL = Number.isFinite(P.descontoSocial) ? P.descontoSocial : 200;
const TIPOS = ["Monofásico","Bifásico","Trifásico"];
/* Valida o que veio do armazenamento do navegador: formato inválido volta aos padrões */
function sanear(p){
  if(!p || typeof p !== 'object' || Array.isArray(p)) return null;
  const out = {};
  Object.keys(p).forEach(d=>{
    const t = p[d];
    if(t && typeof t === 'object' && TIPOS.every(k=>Number.isFinite(t[k]) && t[k] >= 0))
      out[d] = {"Monofásico":t["Monofásico"],"Bifásico":t["Bifásico"],"Trifásico":t["Trifásico"]};
  });
  return Object.keys(out).length ? out : null;
}
const KEY = 'validador-lead-params-v2', ACKEY = 'validador-lead-ac-v2';
/* Custo de disponibilidade (kWh/mês por tipo): descontado de cada mês na energia compartilhada estimada */
function saneDisp(d){ return d && typeof d === 'object' && TIPOS.every(k=>Number.isFinite(d[k]) && d[k] >= 0) ? {"Monofásico":d["Monofásico"],"Bifásico":d["Bifásico"],"Trifásico":d["Trifásico"]} : null; }
const DISP_PADRAO = saneDisp(P.disponibilidade) || {"Monofásico":30,"Bifásico":50,"Trifásico":100};
let DISP = JSON.parse(JSON.stringify(DISP_PADRAO));
let PARAMS = JSON.parse(JSON.stringify(DEFAULTS));
let RASCUNHO_DESCARTADO = false;   // ajustes locais de uma versão antiga da tabela
try{
  const sv = localStorage.getItem(KEY);
  if(sv){
    const o = JSON.parse(sv), p = (o && o.versao === P.versao) ? sanear(o.params) : null;
    if(p){ PARAMS = p; const dd = saneDisp(o.disp); if(dd) DISP = dd; } else { RASCUNHO_DESCARTADO = true; localStorage.removeItem(KEY); }
  } else if(localStorage.getItem('validador-lead-params-v1')){ RASCUNHO_DESCARTADO = true; localStorage.removeItem('validador-lead-params-v1'); }
}catch(e){}
function salvar(){ try{ localStorage.setItem(KEY, JSON.stringify({versao:P.versao, params:PARAMS, disp:DISP})); }catch(e){} }
const esc = t => String(t).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');

const $ = id => document.getElementById(id);
const fmt = v => v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});

// montar selects, meses e tabela
let mh = '';
for(let i=1;i<=12;i++){const n=String(i).padStart(2,'0'); mh += `<div><label for="m${i}">Mês ${n}</label><input type="number" id="m${i}" class="mes" min="0" step="1" inputmode="decimal"></div>`;}
$('months').innerHTML = mh;

function renderDist(){
  const sel = $('dist'), atual = sel.value;
  sel.innerHTML = '<option value="">Selecione...</option>' + Object.keys(PARAMS).map(d=>`<option>${esc(d)}</option>`).join('');
  sel.value = PARAMS[atual] ? atual : '';
}
function renderParams(){
  $('params').innerHTML = Object.entries(PARAMS).map(([d,t])=>
    `<tr data-d="${esc(d)}"><td>${esc(d)}</td>` +
    TIPOS.map(k=>`<td><input type="number" min="0" step="1" data-k="${k}" value="${t[k]}"></td>`).join('') +
    `<td><button type="button" class="x" title="Remover" data-del="1">×</button></td></tr>`).join('');
}
function refresh(){ salvar(); renderDist(); renderParams(); calc(); }
$('params').addEventListener('input',e=>{
  const i=e.target, tr=i.closest('tr'); if(!tr||!i.dataset.k) return;
  const v=parseFloat(i.value);
  if(!isNaN(v)&&v>=0){ PARAMS[tr.dataset.d][i.dataset.k]=v; salvar(); calc(); }
});
$('params').addEventListener('click',e=>{
  if(!e.target.dataset.del) return;
  const d=e.target.closest('tr').dataset.d;
  if(confirm('Remover '+d+'?')){ delete PARAMS[d]; refresh(); }
});
$('add').addEventListener('click',()=>{
  const nome=$('nNome').value.trim(), v=['nMono','nBi','nTri'].map(id=>parseFloat($(id).value));
  if(!nome || v.some(x=>isNaN(x)||x<0)){ alert('Informe o nome e os três mínimos.'); return; }
  PARAMS[nome]={"Monofásico":v[0],"Bifásico":v[1],"Trifásico":v[2]};
  ['nNome','nMono','nBi','nTri'].forEach(id=>$(id).value='');
  refresh();
});
$('restaurar').addEventListener('click',()=>{
  if(confirm('Restaurar os parâmetros da tabela vigente? Os ajustes locais serão perdidos.')){
    PARAMS = JSON.parse(JSON.stringify(DEFAULTS));
    AC = JSON.parse(JSON.stringify(AC_DEFAULT));
    try{ localStorage.removeItem(ACKEY); }catch(e){}
    document.querySelectorAll('.ack').forEach((k,i)=>{ if(AC[i]) k.value = AC[i].kwh; });
    DISP = JSON.parse(JSON.stringify(DISP_PADRAO)); pintarDisp();
    RASCUNHO_DESCARTADO = false; refresh();
  }
});
/* Exporta a tabela atual como parametros.js (já com nova versão) para publicar no repositório */
$('exportar').addEventListener('click',()=>{
  const agora = new Date();
  const dados = {
    versao: agora.toISOString().slice(0,16).replace(/[-:T]/g,''),
    atualizadoEm: agora.toLocaleDateString('pt-BR'),
    descontoSocial: DESCONTO_SOCIAL, disponibilidade: DISP, acs: AC, distribuidoras: PARAMS
  };
  const conteudo = '/* Gerado pelo simulador em ' + agora.toLocaleString('pt-BR') + '. Substitua o parametros.js do repositório por este arquivo. */\nwindow.PARAMETROS = ' + JSON.stringify(dados,null,2) + ';\n';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([conteudo],{type:'text/javascript'}));
  a.download = 'parametros.js'; document.body.appendChild(a); a.click(); a.remove();
});
const DISP_IDS = {dispMono:'Monofásico', dispBi:'Bifásico', dispTri:'Trifásico'};
function pintarDisp(){ Object.entries(DISP_IDS).forEach(([id,t])=>{ $(id).value = DISP[t]; }); }
Object.entries(DISP_IDS).forEach(([id,t])=>{
  $(id).addEventListener('input',()=>{ const v = parseFloat($(id).value); if(Number.isFinite(v) && v >= 0){ DISP[t] = v; salvar(); calc(); } });
});
pintarDisp();
function infoParametros(){
  const mudou = JSON.stringify(PARAMS) !== JSON.stringify(DEFAULTS) || JSON.stringify(AC) !== JSON.stringify(AC_DEFAULT) || JSON.stringify(DISP) !== JSON.stringify(DISP_PADRAO);
  $('paramInfo').textContent = 'Tabela vigente: versão ' + P.versao + (P.atualizadoEm ? ' (atualizada em ' + P.atualizadoEm + ')' : '') + '.'
    + (!Object.keys(DEFAULTS).length ? ' ATENÇÃO: o arquivo parametros.js não foi carregado.' : '')
    + (mudou ? ' Há ajustes locais ainda não publicados: use "Exportar parametros.js".' : '')
    + (RASCUNHO_DESCARTADO ? ' Seus ajustes locais antigos foram descartados porque a tabela foi atualizada.' : '');
  const sm = document.querySelector('#social').closest('label').querySelector('small');
  if(sm) sm.textContent = 'Desconta ' + DESCONTO_SOCIAL + ' kWh da média antes de comparar com o mínimo.';
}
renderDist(); renderParams();

function calc(){
  const meses = [...document.querySelectorAll('.mes')].map((inp,idx)=>({idx,raw:inp.value.trim()}))
    .filter(m=>m.raw!=='' && !isNaN(m.raw) && Number(m.raw)>=0).map(m=>({idx:m.idx,v:Number(m.raw)}));
  const mediaTodos = meses.length ? meses.reduce((a,m)=>a+m.v,0)/meses.length : null;
  const limite = (parseFloat($('limiar').value) || 30)/100;
  const outliers = (meses.length>=3 && mediaTodos>0) ? meses.filter(m=>Math.abs(m.v-mediaTodos)/mediaTodos > limite) : [];
  EXCL = new Set([...EXCL].filter(i=>outliers.some(m=>m.idx===i)));
  renderAlertas(outliers, mediaTodos);
  const vals = meses.filter(m=>!EXCL.has(m.idx)).map(m=>m.v);
  const qtd = vals.length;
  const media = qtd ? vals.reduce((a,b)=>a+b,0)/qtd : null;
  const social = $('social').checked;
  const dist = $('dist').value, tipo = $('tipo').value;
  const minimo = (dist && tipo && PARAMS[dist] && Number.isFinite(PARAMS[dist][tipo])) ? PARAMS[dist][tipo] : null;

  $('qtd').textContent = qtd + (EXCL.size ? ` (${EXCL.size} desconsiderado${EXCL.size>1?'s':''})` : '');
  infoParametros();
  $('total').textContent = qtd ? fmt(vals.reduce((a,b)=>a+b,0)) : '–';
  $('relogio').textContent = tipo || '–';
  $('media').textContent = media===null ? '–' : fmt(media);
  const extra = acExtra();
  $('acExtra').textContent = extra>0 ? '+ ' + fmt(extra) : fmt(0);
  $('acBadge').textContent = extra>0 ? '(+' + fmt(extra) + ' kWh)' : '';
  const outros = outrosExtra();
  $('outrosExtra').textContent = outros>0 ? '+ ' + fmt(outros) : fmt(0);
  $('oBadge').textContent = outros>0 ? '(+' + fmt(outros) + ' kWh)' : '';
  const ger = geracaoExtra();
  $('gerExtra').textContent = ger>0 ? '+ ' + fmt(ger) : fmt(0);
  $('gBadge').textContent = ger>0 ? '(+' + fmt(ger) + ' kWh)' : '';
  const saldo = saldoCarteira();
  $('carteira').textContent = saldo===null ? '–' : fmt(saldo);
  const prev = previsaoCarteira(saldo, media===null ? null : media + extra + outros);
  $('carteiraPrev').textContent = prev;
  $('gPrev').textContent = prev==='–' ? '' : 'Com a média de consumo atual, o saldo dura ' + prev + '.';
  $('desc').textContent = social ? '− ' + fmt(DESCONTO_SOCIAL) : 'Não se aplica';
  $('minimo').textContent = minimo===null ? '–' : minimo;
  // consumo anual estimado (média SEM subtrações) e energia compartilhada estimada no ano:
  // cada mês informado (+ consumo extra esperado: AC, outros produtos, geração) menos a disponibilidade do tipo, mínimo 0
  const adic = extra + outros + ger, disp = tipo ? DISP[tipo] : null;
  const consAno = qtd ? (media + adic) * 12 : null;
  let comp = null;
  if(disp != null && qtd) comp = vals.map(v=>Math.max(0, v + adic - disp)).reduce((a,b)=>a+b,0) / qtd * 12;
  $('consAno').textContent = consAno === null ? '–' : fmt(consAno);
  $('dispVal').textContent = disp != null ? fmt(disp) : '–';
  $('compAno').textContent = comp === null ? '–' : fmt(comp);
  $('compNota').hidden = comp === null;
  $('compNota').textContent = comp === null ? '' : (qtd < 12 ? 'Projeção para 12 meses a partir de ' + qtd + (qtd === 1 ? ' mês informado. ' : ' meses informados. ') : '')
    + 'Cada mês: consumo' + (adic > 0 ? ' + consumo extra' : '') + ' − ' + fmt(disp) + ' kWh de disponibilidade (mínimo 0). A média estimada não tem essa subtração.';
  // mostra no resultado apenas as linhas com informação aplicada
  // (média informada só aparece quando há ajustes; sem ajustes seria igual à média considerada)
  $('media').parentElement.hidden = !(extra>0 || outros>0 || ger>0 || social) && media!==null && minimo!==null;
  $('relogio').parentElement.hidden = !tipo;
  [['acExtra',extra>0],['outrosExtra',outros>0],['gerExtra',ger>0],['desc',!!social],['carteira',saldo!==null],['carteiraPrev',prev!=='–'],['consAno',consAno!==null],['dispVal',comp!==null],['compAno',comp!==null]]
    .forEach(([id,on])=>{ $(id).parentElement.hidden = !on; });

  const st = $('status');
  if(media===null || minimo===null){
    $('considerada').textContent = '–'; $('dif').textContent = '–';
    st.className = 'status warn';
    st.innerHTML = 'FALTA CONFIGURAR<small>Selecione a distribuidora, o tipo e informe ao menos um mês.</small>';
    return;
  }
  const considerada = Math.max(0, media + extra + outros + ger - (social ? DESCONTO_SOCIAL : 0));
  const dif = considerada - minimo;
  $('considerada').textContent = fmt(considerada);
  $('dif').textContent = (dif>=0?'+ ':'− ') + fmt(Math.abs(dif));
  if(dif>=0){
    st.className = 'status ok';
    st.innerHTML = 'ATENDEMOS<small>Média considerada dentro da faixa mínima.</small>';
  } else {
    st.className = 'status no';
    st.innerHTML = 'NÃO ATENDEMOS<small>Faltam ' + fmt(Math.abs(dif)) + ' kWh de média para atingir o mínimo.</small>';
  }
}
/* Ar-condicionado: consumo extra por aparelho (kWh/mês), editável */
const AC_DEFAULT = Array.isArray(P.acs) ? P.acs : [];
let AC = JSON.parse(JSON.stringify(AC_DEFAULT));
try{
  const sa = localStorage.getItem(ACKEY), o = sa ? JSON.parse(sa) : null, a = o && o.versao === P.versao ? o.acs : null;
  if(Array.isArray(a) && a.length === AC_DEFAULT.length && a.every((x,i)=>x && x.btu === AC_DEFAULT[i].btu && Number.isFinite(x.kwh) && x.kwh >= 0)) AC = a;
  else if(sa){ RASCUNHO_DESCARTADO = true; localStorage.removeItem(ACKEY); }
}catch(e){}
function renderAC(){
  $('acs').innerHTML = AC.map((a,i)=>
    `<div class="acrow"><span>${a.btu.toLocaleString('pt-BR')} BTUs</span>` +
    `<input type="number" class="ack" data-i="${i}" min="0" step="1" value="${a.kwh}">` +
    `<input type="number" class="acq" data-i="${i}" min="0" step="1" placeholder="0"></div>`).join('');
}
function acExtra(){
  let t = 0;
  document.querySelectorAll('.acq').forEach(inp=>{
    const q = parseInt(inp.value,10); const a = AC[inp.dataset.i];
    if(q>0 && a) t += q * a.kwh;
  });
  return t;
}
renderAC();
$('acs').addEventListener('input',e=>{
  const i = e.target;
  if(i.classList.contains('ack')){
    const v = parseFloat(i.value);
    if(!isNaN(v) && v>=0){ AC[i.dataset.i].kwh = v; try{ localStorage.setItem(ACKEY, JSON.stringify({versao:P.versao, acs:AC})); }catch(err){} }
  }
  calc();
});
/* Alerta de meses fora do padrão (mínimo de 3 meses informados) */
/* Alerta de meses fora do padrão */
let EXCL = new Set();
function renderAlertas(outliers, mediaTodos){
  $('alertBox').hidden = outliers.length===0;
  $('alertList').innerHTML = outliers.map(m=>{
    const pct = (m.v-mediaTodos)/mediaTodos*100;
    return `<label><input type="checkbox" data-i="${m.idx}" ${EXCL.has(m.idx)?'checked':''}><span><b>Mês ${String(m.idx+1).padStart(2,'0')}</b>: ${fmt(m.v)} kWh (${pct>0?'+':''}${pct.toFixed(0)}% da média de ${fmt(mediaTodos)}) · desconsiderar da média</span></label>`;
  }).join('');
  document.querySelectorAll('.mes').forEach((inp,idx)=>inp.classList.toggle('out', outliers.some(m=>m.idx===idx)));
}
$('alertList').addEventListener('change',e=>{
  const i = parseInt(e.target.dataset.i,10); if(isNaN(i)) return;
  if(e.target.checked) EXCL.add(i); else EXCL.delete(i);
  calc();
});
/* Outros produtos (por lead; não ficam salvos) */
let OUTROS = [];
function renderOutros(){
  $('outros').innerHTML = OUTROS.length
    ? '<div class="orow ohead"><span>Produto</span><span>kWh/mês</span><span>Qtd</span><span>Total</span><span></span></div>' +
      OUTROS.map((o,i)=>`<div class="orow"><span>${esc(o.nome)}</span><span>${fmt(o.kwh)}</span><input type="number" class="oq" data-i="${i}" min="1" step="1" value="${o.qtd}"><b>${fmt(o.kwh*o.qtd)}</b><button type="button" class="x" data-del="${i}" title="Remover">×</button></div>`).join('')
    : '<p class="legend">Nenhum produto adicionado.</p>';
}
function outrosExtra(){ return OUTROS.reduce((t,o)=>t+o.kwh*o.qtd,0); }
$('outros').addEventListener('input',e=>{
  const i=e.target; if(!i.classList.contains('oq')) return;
  const q=parseInt(i.value,10);
  if(q>0){ const o=OUTROS[i.dataset.i]; o.qtd=q; i.parentElement.querySelector('b').textContent=fmt(o.kwh*q); calc(); }
});
$('outros').addEventListener('click',e=>{
  if(e.target.dataset.del===undefined) return;
  OUTROS.splice(parseInt(e.target.dataset.del,10),1); renderOutros(); calc();
});
$('oAdd').addEventListener('click',()=>{
  const nome=$('oNome').value.trim(), kwh=parseFloat($('oKwh').value), qtd=parseInt($('oQtd').value,10)||1;
  if(!nome || isNaN(kwh) || kwh<0 || qtd<1){ alert('Informe o produto e o consumo mensal (kWh).'); return; }
  OUTROS.push({nome,kwh,qtd});
  ['oNome','oKwh','oQtd'].forEach(id=>$(id).value='');
  renderOutros(); calc();
});
renderOutros();
/* Geração/injeção e carteira de energia */
function geracaoExtra(){
  if(!$('gPossui').checked) return 0;
  const v = parseFloat($('gKwh').value); return v>0 ? v : 0;
}
function saldoCarteira(){
  if(!$('gPossui').checked || !$('gCarteira').checked) return null;
  const v = parseFloat($('gSaldo').value); return v>=0 ? v : null;
}
/* Duração da carteira = saldo ÷ média de consumo (informada + AC + outros produtos), 1 mês = 30 dias */
function previsaoCarteira(saldo, base){
  if(saldo===null || !(saldo>0) || base===null || !(base>0)) return '–';
  const meses = saldo/base; let m = Math.floor(meses), d = Math.round((meses-m)*30);
  if(d>=30){ m++; d=0; }
  const p = [];
  if(m>0) p.push(m + (m===1?' mês':' meses'));
  if(d>0) p.push(d + (d===1?' dia':' dias'));
  return (p.join(' e ') || 'menos de 1 dia') + ' (≈ ' + fmt(meses) + ' meses)';
}
function toggleGeracao(){
  $('gCampos').hidden = !$('gPossui').checked;
  $('gCart').hidden = !($('gPossui').checked && $('gCarteira').checked);
  calc();
}
$('gPossui').addEventListener('change',toggleGeracao);
$('gCarteira').addEventListener('change',toggleGeracao);
/* Importação da fatura (PDF com texto) – leitura heurística, sempre revisar */
const MESES = {JAN:1,FEV:2,MAR:3,ABR:4,MAI:5,JUN:6,JUL:7,AGO:8,SET:9,OUT:10,NOV:11,DEZ:12};
const ROT = Object.keys(MESES);
const brNum = t => parseFloat(String(t).replace(/\./g,'').replace(',','.'));
const semAcento = t => t.normalize('NFD').replace(/[\u0300-\u036f]/g,'');

function analisarFatura(txt){
  const T = semAcento(txt).toUpperCase().replace(/\s+/g,' ');
  const r = {};
  // distribuidora: a que aparece primeiro no texto
  let best = null;
  Object.keys(PARAMS).forEach(d=>{
    const nome = semAcento(d.split(' - ')[0]).toUpperCase();
    let i = T.indexOf(nome);
    if(i<0) i = T.indexOf(nome.split(' ')[0]);   // ex.: "CPFL" quando a fatura não traz "CPFL PAULISTA"
    if(i>=0 && (!best || i<best.i)) best = {d,i};
  });
  r.dist = best ? best.d : null;
  // tipo de atendimento
  const mt = T.match(/(MONO|BI|TRI)FASIC[OA]\b/) || T.match(/\bB[1-4]\s*\/\s*(MONO|BIF|TRI)\b/);   // ex.: "B1 / MONO" (Equatorial)
  r.tipo = mt ? {MONO:'Monofásico',BI:'Bifásico',BIF:'Bifásico',TRI:'Trifásico'}[mt[1]] : null;
  // histórico de consumo: Mês 01 = mais recente, em ordem decrescente
  const hist = new Map();
  let estrito = false;
  const add = (a,m,v)=>{ if(estrito && /[.,]/.test(v)) return; if(a<100) a+=2000; const k=a*12+m; if(!hist.has(k)) hist.set(k,{rot:ROT[m-1]+'/'+String(a).slice(2),v:brNum(v)}); };
  const reA = /\b(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\s*[\/\-.]?\s*(\d{2,4})\s+(\d{1,5}(?:[.,]\d+)?)\b(?!\/)/g;
  const reB = /(?<![A-Z\/\d])(0[1-9]|1[0-2])\s*\/\s*(20\d{2})\s+(\d{1,5}(?:[.,]\d+)?)\b(?!\/)/g;
  const scan = t=>{ for(const m of t.matchAll(reA)) add(+m[2],MESES[m[1]],m[3]); for(const m of t.matchAll(reB)) add(+m[2],+m[1],m[3]); };
  semAcento(txt).toUpperCase().split('\n').forEach(scan);
  if(hist.size<3){
    // rótulos em bloco seguidos dos valores na mesma ordem (ex.: JAN26 DEZ25 ... 161 223 ...)
    const n0 = hist.size;
    const mm = T.match(/((?:(?:JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\s*[\/\-.]?\s*\d{2,4}\s+){5,})((?:\d{1,5}(?:[.,]\d+)?\s+){5,})/);
    if(mm){
      const rot = [...mm[1].matchAll(/(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\s*[\/\-.]?\s*(\d{2,4})/g)];
      const nums = mm[2].trim().split(/\s+/);
      if(nums.length>=rot.length) rot.forEach((m,i)=>add(+m[2],MESES[m[1]],nums[i]));
    }
    if(hist.size===n0){ estrito = true; scan(T); estrito = false; }
  }
  r.meses = [...hist.entries()].sort((a,b)=>b[0]-a[0]).slice(0,12).map(e=>e[1]);
  // fatura de alta tensão (grupo A: consumo ponta / fora de ponta): o histórico mensal total não é preenchido
  r.grupoA = /CONSUMO PONTA|CONSUMO FORA DE PONTA|TARIFA (?:VERDE|AZUL)/.test(T);
  if(r.grupoA){
    r.meses = []; r.atual = null;
    r.aviso = 'Fatura de alta tensão (grupo A, ponta/fora de ponta): o histórico não é preenchido automaticamente. Informe o consumo mensal total.';
  } else {
    // consumo atual = quantidade do item de consumo (soma as faixas, ex.: tarifa social "até 80 kWh" + "acima")
    const reI = /(?:CONSUMO EM KWH|CONSUMO KWH|CONSUMO ATIVO|ENERGIA ELETRICA|ENERGIA ATIVA|CONSUMO)\s+(?:KWH\s+)?(\d{1,5}(?:[.,]\d+)?)\b(?!\/)/g;
    const itens = [...T.matchAll(reI)].map(m=>brNum(m[1])), soma = itens.reduce((a,b)=>a+b,0);
    r.atual = !itens.length ? null : (itens.length>1 && (!r.meses.length || soma===r.meses[0].v)) ? soma : itens[0];
    if(r.atual!=null){
      if(!r.meses.length){
        r.meses = [{rot:'atual',v:r.atual}];
        if(itens.length>1) r.aviso = 'Somei as faixas do item de consumo ('+itens.join(' + ')+'). Confira o valor.';
      } else if(r.meses[0].v!==r.atual){
        r.aviso = 'O consumo do item da fatura ('+fmt(r.atual)+' kWh) difere do mês mais recente do histórico ('+fmt(r.meses[0].v)+' kWh). Mantive o histórico; confira o Mês 01.';
      }
    }
  }
  // geração/injeção e carteira
  const mi = T.match(/ENERGIA (?:ATIVA )?INJETADA[^0-9]{0,80}(\d[\d.]*,?\d*)/);
  const ms = T.match(/SALDO[^0-9]{0,60}(\d[\d.]*,?\d*)\s*KWH/);
  r.inj = mi ? brNum(mi[1]) : null;
  r.saldo = ms ? brNum(ms[1]) : null;
  r.social = /BAIXA RENDA|TARIFA SOCIAL/.test(T);
  return r;
}

function aplicarFatura(txt){
  const r = analisarFatura(txt), msg = [];
  if(r.dist){ $('dist').value = r.dist; msg.push('Distribuidora: <b>'+esc(r.dist)+'</b>'); } else msg.push('Distribuidora: não identificada');
  if(r.tipo){ $('tipo').value = r.tipo; msg.push('Tipo de atendimento: <b>'+r.tipo+'</b>'); } else msg.push('Tipo de atendimento: não identificado');
  if(r.meses.length) for(let i=1;i<=12;i++){   // sem histórico na fatura, não apaga os meses já digitados
    const h = r.meses[i-1];
    $('m'+i).value = h ? h.v : '';
    document.querySelector('label[for=m'+i+']').textContent = 'Mês '+String(i).padStart(2,'0') + (h ? ' ('+h.rot+')' : '');
  }
  msg.push(r.meses.length ? 'Consumo: <b>'+r.meses.length+' meses</b> · Mês 01 = <b>'+r.meses[0].rot+'</b> ('+fmt(r.meses[0].v)+' kWh), até '+r.meses[r.meses.length-1].rot : 'Consumo: histórico não encontrado');
  if(r.aviso) msg.push('⚠ '+r.aviso);
  if(r.inj>0 || r.saldo>0){
    $('gPossui').checked = true;
    $('gKwh').value = r.inj>0 ? r.inj : '';
    $('gCarteira').checked = r.saldo>0;
    $('gSaldo').value = r.saldo>0 ? r.saldo : '';
    msg.push('Geração/injeção: ' + (r.inj>0 ? '<b>'+fmt(r.inj)+' kWh</b> recebidos' : 'sem energia injetada') + (r.saldo>0 ? ' · saldo da carteira <b>'+fmt(r.saldo)+' kWh</b>' : ''));
  }
  if(r.social) msg.push('⚠ A fatura cita tarifa social/baixa renda. Confirme se o cliente tem o benefício (não marquei automaticamente).');
  const st = $('impStatus'); st.className='note'; st.hidden=false;
  st.innerHTML = msg.join('<br>') + '<br><i>Revise os campos antes de usar o resultado.</i>';
  toggleGeracao();
}

/* Histórico por posição na página: associa cada mês (rótulo) ao número da mesma linha,
   mesmo quando o valor está levemente deslocado na vertical (gráfico de barras, tabelas). */
function historicoGeometrico(items){
  const NUM = /^\d{1,5}(?:[.,]\d+)?$/;
  const ehMes = t => /^(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\s*[\/\-.]?\s*\d{2,4}$/.test(semAcento(t).toUpperCase()) || /^(0[1-9]|1[0-2])\s*\/\s*20\d{2}$/.test(t);
  const it = items.filter(i=>i.str.trim()).map(i=>({t:i.str.trim(), x:i.transform[4], y:i.transform[5]}));
  let labels = it.filter(i=>ehMes(i.t));
  if(labels.length<3) return [];
  // mantém só a coluna de rótulos com mais itens (mesmo x)
  const col = labels.map(l=>({l, n:labels.filter(o=>Math.abs(o.x-l.x)<=3).length})).sort((a,b)=>b.n-a.n)[0].l;
  labels = labels.filter(l=>Math.abs(l.x-col.x)<=3);
  if(labels.length<3) return [];
  const ys = labels.map(l=>l.y).sort((a,b)=>b-a);
  const dif = ys.slice(1).map((y,i)=>ys[i]-y).filter(v=>v>0).sort((a,b)=>a-b);
  const win = Math.max(3, (dif.length ? dif[Math.floor(dif.length/2)] : 10) * 0.55);
  // cada número pertence ao rótulo mais próximo na vertical (à sua esquerda)
  const dono = new Map(labels.map(l=>[l,[]]));
  it.filter(n=>NUM.test(n.t)).forEach(n=>{
    const c = labels.filter(l=>l.x < n.x-5).map(l=>({l, d:Math.abs(l.y-n.y)})).sort((a,b)=>a.d-b.d)[0];
    if(c && c.d<=win) dono.get(c.l).push(n);
  });
  // descarta a coluna de "dias de faturamento" (cabeçalho "Nº DIAS" acima da coluna, ou valores todos entre 26 e 35)
  const cab = items.filter(i=>i.str.trim().length<=16 && /\bDIAS\b/.test(semAcento(i.str).toUpperCase()) && i.transform[5] > ys[0] && i.transform[5] - ys[0] < 60).map(i=>({x:i.transform[4], w:i.width||40}));   // cabeçalho curto, logo acima da lista
  const cols = [];
  [...dono.values()].flat().sort((a,b)=>a.x-b.x).forEach(n=>{ const c = cols.find(c=>Math.abs(c.x-n.x)<=12); if(c) c.v.push(n); else cols.push({x:n.x, v:[n]}); });
  const dias = new Set();
  cols.forEach(c=>{
    const doCab = cab.some(h=>c.x >= h.x-15 && c.x <= h.x+h.w+15);
    const faixa = c.v.length>=4 && c.v.every(n=>{ const v = parseFloat(n.t.replace(',','.')); return Number.isInteger(v) && v>=26 && v<=35; });
    if(doCab || faixa) c.v.forEach(n=>dias.add(n));
  });
  return labels.map(l=>{
    const v = dono.get(l).filter(n=>!dias.has(n)).sort((a,b)=>a.x-b.x)[0];   // 1ª coluna numérica restante = kWh
    return v ? 'HISTORICO ' + l.t + ' ' + v.t : null;
  }).filter(Boolean);
}
/* Monta o texto da fatura a partir dos itens de texto do PDF (uma lista por página). Separado de lerPdf para ser testável. */
function textoDeItens(paginas){
  let txt = ''; const geo = [];
  paginas.forEach(items=>{
    geo.push(...historicoGeometrico(items));
    const rows = [];
    items.forEach(i=>{
      if(!i.str.trim()) return;
      const y = Math.round(i.transform[5]), x = i.transform[4];
      let row = rows.find(r=>Math.abs(r.y-y)<=2);
      if(!row){ row = {y, it:[]}; rows.push(row); }
      row.it.push({x, t:i.str});
    });
    rows.sort((a,b)=>b.y-a.y).forEach(r=>{ txt += r.it.sort((a,b)=>a.x-b.x).map(i=>i.t).join(' ') + '\n'; });
  });
  return (geo.length ? geo.join('\n') + '\n' : '') + txt;
}
async function lerPdf(file){
  if(!window.pdfjsLib) throw new Error('Biblioteca de leitura de PDF não carregada. Verifique a conexão com a internet.');
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/vendor/pdf.worker.min.js';
  const pdf = await pdfjsLib.getDocument({data: await file.arrayBuffer()}).promise;
  const paginas = [];
  for(let p=1;p<=pdf.numPages;p++) paginas.push((await (await pdf.getPage(p)).getTextContent()).items);
  return textoDeItens(paginas);
}
$('fatura').addEventListener('change', async e=>{
  const f = e.target.files[0]; if(!f) return;
  const st = $('impStatus'); st.className='note'; st.hidden=false; st.textContent='Lendo a fatura...';
  try{
    const txt = await lerPdf(f);
    $('impTexto').value = txt;
    if(txt.trim().length < 50){ st.className='note err'; st.textContent='Não encontrei texto no PDF (pode ser imagem/escaneado). Cole o texto manualmente abaixo ou preencha os campos.'; return; }
    aplicarFatura(txt);
  }catch(err){ st.className='note err'; st.textContent='Não consegui ler a fatura: ' + err.message; }
});
$('reanalisar').addEventListener('click',()=>{ if($('impTexto').value.trim()) aplicarFatura($('impTexto').value); });
/* os dois campos de limite (resultado e configuração) andam juntos */
document.querySelectorAll('input,select').forEach(e=>e.addEventListener('input',calc));
$('limpar').addEventListener('click',()=>{document.querySelectorAll('.mes,.acq').forEach(i=>i.value='');OUTROS=[];renderOutros();$('gPossui').checked=false;$('gCarteira').checked=false;$('gKwh').value='';$('gSaldo').value='';toggleGeracao();});
calc();
