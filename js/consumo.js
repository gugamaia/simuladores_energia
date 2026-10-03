/* Tabela de parâmetros: edite aqui para incluir/alterar distribuidoras e mínimos. */
const DEFAULTS = {
  "CEMIG - MG":       {"Monofásico":153,"Bifásico":173,"Trifásico":223},
  "COPEL - PR":       {"Monofásico":189,"Bifásico":209,"Trifásico":259},
  "CPFL Paulista - SP":{"Monofásico":250,"Bifásico":270,"Trifásico":320},
  "ELEKTRO - SP":     {"Monofásico":250,"Bifásico":270,"Trifásico":320},
  "ENERGISA - MT":    {"Monofásico":210,"Bifásico":230,"Trifásico":280},
  "EQUATORIAL - GO":  {"Monofásico":156,"Bifásico":176,"Trifásico":226}
};
const DESCONTO_SOCIAL = 200;
const TIPOS = ["Monofásico","Bifásico","Trifásico"];
const KEY = 'validador-lead-params-v1';
let PARAMS = JSON.parse(JSON.stringify(DEFAULTS));
try{ const sv = localStorage.getItem(KEY); if(sv) PARAMS = JSON.parse(sv); }catch(e){}
function salvar(){ try{ localStorage.setItem(KEY, JSON.stringify(PARAMS)); }catch(e){} }
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
  if(confirm('Restaurar os parâmetros originais? As alterações serão perdidas.')){ PARAMS=JSON.parse(JSON.stringify(DEFAULTS)); refresh(); }
});
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
  const minimo = (dist && tipo) ? PARAMS[dist][tipo] : null;

  $('qtd').textContent = qtd + (EXCL.size ? ` (${EXCL.size} desconsiderado${EXCL.size>1?'s':''})` : '');
  checarVariacao();
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
  // mostra no resultado apenas as linhas com informação aplicada
  // (média informada só aparece quando há ajustes; sem ajustes seria igual à média considerada)
  $('media').parentElement.hidden = !(extra>0 || outros>0 || ger>0 || social) && media!==null && minimo!==null;
  $('relogio').parentElement.hidden = !tipo;
  [['acExtra',extra>0],['outrosExtra',outros>0],['gerExtra',ger>0],['desc',!!social],['carteira',saldo!==null],['carteiraPrev',prev!=='–']]
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
const AC_DEFAULT = [{btu:9000,kwh:100},{btu:12000,kwh:150},{btu:18000,kwh:250},{btu:20000,kwh:300},{btu:24000,kwh:400}];
const ACKEY = 'validador-lead-ac-v1';
let AC = JSON.parse(JSON.stringify(AC_DEFAULT));
try{ const sa = localStorage.getItem(ACKEY); if(sa) AC = JSON.parse(sa); }catch(e){}
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
    if(!isNaN(v) && v>=0){ AC[i.dataset.i].kwh = v; try{ localStorage.setItem(ACKEY, JSON.stringify(AC)); }catch(err){} }
  }
  calc();
});
/* Alerta de meses fora do padrão (mínimo de 3 meses informados) */
function checarVariacao(){
  const lim = parseFloat($('lim').value), el = $('alerta');
  const itens = [...document.querySelectorAll('.mes')]
    .map((inp,i)=>({inp,i,v:inp.value.trim()===''?NaN:Number(inp.value)}))
    .filter(x=>!isNaN(x.v) && x.v>=0);
  itens.forEach(x=>x.inp.classList.remove('out'));
  el.innerHTML = '';
  if(itens.length<3 || !(lim>0)) return;
  const m = itens.reduce((a,x)=>a+x.v,0)/itens.length;
  if(!(m>0)) return;
  const fora = itens.filter(x=>Math.abs(x.v-m)/m*100 > lim);
  if(!fora.length) return;
  fora.forEach(x=>x.inp.classList.add('out'));
  const li = fora.map(x=>{
    const pct = Math.round(Math.abs(x.v-m)/m*100), dir = x.v>m ? 'acima' : 'abaixo';
    return `<li><b>Mês ${String(x.i+1).padStart(2,'0')}</b>: ${fmt(x.v)} kWh (${pct}% ${dir} da média de ${fmt(m)})</li>`;
  }).join('');
  el.innerHTML = `<div class="alerta"><b>Atenção: ${fora.length>1?'meses fora do padrão':'mês fora do padrão'}</b><ul>${li}</ul>Confirme com o lead se ${fora.length>1?'esses meses devem':'esse mês deve'} entrar na média. Se não, apague o valor para recalcular.</div>`;
}

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
    const i = T.indexOf(semAcento(d.split(' - ')[0]).toUpperCase());
    if(i>=0 && (!best || i<best.i)) best = {d,i};
  });
  r.dist = best ? best.d : null;
  // tipo de atendimento
  const mt = T.match(/(MONO|BI|TRI)FASIC[OA]\b/);
  r.tipo = mt ? {MONO:'Monofásico',BI:'Bifásico',TRI:'Trifásico'}[mt[1]] : null;
  // histórico de consumo: Mês 01 = mais recente, em ordem decrescente
  const hist = new Map();
  let estrito = false;
  const add = (a,m,v)=>{ if(estrito && /[.,]/.test(v)) return; if(a<100) a+=2000; const k=a*12+m; if(!hist.has(k)) hist.set(k,{rot:ROT[m-1]+'/'+String(a).slice(2),v:brNum(v)}); };
  const reA = /\b(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\s*[\/\-.]?\s*(\d{2,4})\s+(\d{1,5}(?:[.,]\d+)?)\b(?!\/)/g;
  const reB = /(?<![\/\d])(0[1-9]|1[0-2])\s*\/\s*(20\d{2})\s+(\d{1,5}(?:[.,]\d+)?)\b(?!\/)/g;
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
  // consumo atual = quantidade do item de consumo na fatura
  const ic = T.match(/(?:CONSUMO EM KWH|CONSUMO KWH|CONSUMO ATIVO|ENERGIA ELETRICA|ENERGIA ATIVA|CONSUMO)\s+(?:KWH\s+)?(\d{1,5}(?:[.,]\d+)?)\b(?!\/)/);
  r.atual = ic ? brNum(ic[1]) : null;
  if(r.atual!=null){
    if(!r.meses.length) r.meses = [{rot:'atual',v:r.atual}];
    else if(r.meses[0].v!==r.atual){
      r.aviso = 'O consumo do item da fatura ('+fmt(r.atual)+' kWh) difere do mês mais recente do histórico ('+fmt(r.meses[0].v)+' kWh). Usei o valor do item no Mês 01.';
      r.meses[0].v = r.atual;
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
  for(let i=1;i<=12;i++){
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
  return labels.map(l=>{
    const v = dono.get(l).sort((a,b)=>a.x-b.x)[0];   // 1ª coluna numérica = kWh (as seguintes: dias etc.)
    return v ? 'HISTORICO ' + l.t + ' ' + v.t : null;
  }).filter(Boolean);
}
async function lerPdf(file){
  if(!window.pdfjsLib) throw new Error('Biblioteca de leitura de PDF não carregada. Verifique a conexão com a internet.');
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const pdf = await pdfjsLib.getDocument({data: await file.arrayBuffer()}).promise;
  let txt = ''; const geo = [];
  for(let p=1;p<=pdf.numPages;p++){
    const c = await (await pdf.getPage(p)).getTextContent();
    geo.push(...historicoGeometrico(c.items));
    const rows = [];
    c.items.forEach(i=>{
      if(!i.str.trim()) return;
      const y = Math.round(i.transform[5]), x = i.transform[4];
      let row = rows.find(r=>Math.abs(r.y-y)<=2);
      if(!row){ row = {y, it:[]}; rows.push(row); }
      row.it.push({x, t:i.str});
    });
    rows.sort((a,b)=>b.y-a.y).forEach(r=>{ txt += r.it.sort((a,b)=>a.x-b.x).map(i=>i.t).join(' ') + '\n'; });
  }
  return (geo.length ? geo.join('\n') + '\n' : '') + txt;
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
document.querySelectorAll('input,select').forEach(e=>e.addEventListener('input',calc));
$('limpar').addEventListener('click',()=>{document.querySelectorAll('.mes,.acq').forEach(i=>i.value='');OUTROS=[];renderOutros();$('gPossui').checked=false;$('gCarteira').checked=false;$('gKwh').value='';$('gSaldo').value='';toggleGeracao();});
calc();
