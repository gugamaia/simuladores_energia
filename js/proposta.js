/* Proposta de oferta AXS: formulário -> prévia -> PDF / JPG */
const $ = id => document.getElementById(id);
const OBS_PADRAO = 'Sim, você receberá duas faturas: uma da distribuidora local (que inclui taxas obrigatórias) e outra da AXS referente à sua assinatura de energia solar. O valor total das duas faturas será menor do que você paga atualmente, gerando economia real todo mês.\n\nOs valores apresentados são baseados em estimativas e podem apresentar variações ao longo do contrato, dúvidas fale conosco.';
const PADRAO = { cargo:'Consultora AXS Energia', b1:'🌱 Energia Sustentável', b2:'✅ Sem taxa de adesão', b3:'🔒 Sem fidelidade' };
const KEY = 'simuladores-proposta-consultor';
const LARGURA = 1000;   // largura fixa da folha (igual na prévia e no arquivo gerado)

/* ---------- formatação ---------- */
const hoje = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); };
const dataBR = iso => /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : '';
const numero = id => { const v = parseFloat($(id).value); return Number.isFinite(v) && v >= 0 ? v : null; };
const moeda = v => v === null ? '' : v.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
const kwh = v => v === null ? '' : v.toLocaleString('pt-BR', {maximumFractionDigits:2}) + ' kWh/mês';
function somarDias(iso, dias){
  const [a, m, d] = iso.split('-').map(Number), x = new Date(a, m-1, d + dias);
  return String(x.getDate()).padStart(2,'0') + '/' + String(x.getMonth()+1).padStart(2,'0') + '/' + x.getFullYear();
}
const slug = t => t.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40);

/* ---------- prévia ---------- */
function atualizar(){
  $('vConsultor').textContent = $('pConsultor').value.trim();
  $('vCliente').textContent = $('pCliente').value.trim();
  $('vData').textContent = dataBR($('pData').value);
  $('vValidade').textContent = $('pValidade').value.trim();
  $('vUC').textContent = $('pUC').value.trim();
  $('vConsumo').textContent = kwh(numero('pConsumo'));
  $('vMensalidade').textContent = moeda(numero('pMensalidade'));
  $('vEconomia').textContent = moeda(numero('pEconomia'));
  $('vObs').textContent = $('pObs').value;
  $('vAssinatura').textContent = $('pConsultor').value.trim();
  $('vCargo').textContent = $('pCargo').value.trim();
  ['1','2','3'].forEach(n => { $('vB'+n).textContent = $('pB'+n).value.trim(); });
  ajustarEscala();
}
function ajustarEscala(){
  const wrap = $('prevWrap'), folha = $('capture'), esc = Math.min(1, wrap.clientWidth / LARGURA) || 1;
  folha.style.transform = 'scale(' + esc + ')';
  wrap.style.height = Math.ceil(folha.offsetHeight * esc) + 'px';
}
function valoresPadrao(){
  $('pObs').value = OBS_PADRAO; $('pCargo').value = PADRAO.cargo;
  $('pB1').value = PADRAO.b1; $('pB2').value = PADRAO.b2; $('pB3').value = PADRAO.b3;
}
function limpar(){
  ['pCliente','pValidade','pUC','pConsumo','pMensalidade','pEconomia'].forEach(id => { $(id).value = ''; });
  $('pValidadeRapida').value = ''; $('pData').value = hoje(); valoresPadrao(); atualizar();
  $('msg').textContent = 'Campos limpos. Consultor(a) e cargo foram mantidos.';
}

/* ---------- consultor lembrado neste navegador ---------- */
function carregarConsultor(){ try{ const o = JSON.parse(localStorage.getItem(KEY) || 'null'); if(o){ $('pConsultor').value = o.nome || ''; if(o.cargo) $('pCargo').value = o.cargo; } }catch(e){} }
function salvarConsultor(){ try{ localStorage.setItem(KEY, JSON.stringify({nome:$('pConsultor').value.trim(), cargo:$('pCargo').value.trim()})); }catch(e){} }

/* ---------- exportação ---------- */
async function renderizar(){
  if(!window.html2canvas) throw new Error('Biblioteca de exportação não carregada.');
  if(document.fonts && document.fonts.ready) await document.fonts.ready;
  const clone = $('capture').cloneNode(true);
  clone.querySelectorAll('[id]').forEach(e => e.removeAttribute('id')); clone.removeAttribute('id');
  clone.style.transform = 'none'; clone.style.width = LARGURA + 'px';
  const palco = document.createElement('div'); palco.className = 'palco-export'; palco.appendChild(clone); document.body.appendChild(palco);
  try{ return await html2canvas(clone, {scale:2, backgroundColor:'#ffffff', useCORS:true}); }
  finally{ palco.remove(); }
}
const nomeBase = () => { const c = slug($('pCliente').value); return 'proposta_axs' + (c ? '_' + c : ''); };
function avisarMenu(formato){ if(window.parent !== window) try{ window.parent.postMessage({tipo:'proposta', formato}, '*'); }catch(e){} }
async function exportar(formato){
  const botoes = [$('pdf'), $('jpg')]; botoes.forEach(b => { b.disabled = true; }); $('msg').textContent = 'Gerando ' + formato.toUpperCase() + '...';
  try{
    const canvas = await renderizar();
    if(formato === 'pdf'){
      const { jsPDF } = window.jspdf, largura = 210, altura = canvas.height * largura / canvas.width;
      const pdf = new jsPDF({orientation:'p', unit:'mm', format:[largura, altura]});   // página do tamanho do conteúdo (sem sobra em branco)
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, largura, altura, undefined, 'FAST');   // JPEG: arquivo bem menor que PNG
      pdf.save(nomeBase() + '.pdf');
    } else {
      const a = document.createElement('a'); a.download = nomeBase() + '.jpg'; a.href = canvas.toDataURL('image/jpeg', 0.95);
      document.body.appendChild(a); a.click(); a.remove();
    }
    $('msg').textContent = 'Arquivo ' + formato.toUpperCase() + ' gerado.'; avisarMenu(formato);
  }catch(e){ $('msg').textContent = 'Não foi possível gerar o arquivo: ' + e.message; }
  finally{ botoes.forEach(b => { b.disabled = false; }); }
}

/* ---------- inicialização ---------- */
$('imgLogo').src = (window.IMAGENS_AXS || {}).logo || '';
$('imgBanner').src = (window.IMAGENS_AXS || {}).banner || '';
valoresPadrao(); $('pData').value = hoje(); carregarConsultor();
document.querySelectorAll('input,textarea,select').forEach(e => e.addEventListener('input', atualizar));
['pConsultor','pCargo'].forEach(id => $(id).addEventListener('input', salvarConsultor));
$('pValidadeRapida').addEventListener('change', () => {
  const d = parseInt($('pValidadeRapida').value, 10);
  if(d > 0 && $('pData').value){ $('pValidade').value = somarDias($('pData').value, d); atualizar(); }
});
$('pdf').addEventListener('click', () => exportar('pdf'));
$('jpg').addEventListener('click', () => exportar('jpg'));
$('limpar').addEventListener('click', limpar);
window.addEventListener('resize', ajustarEscala);
if(window.ResizeObserver) new ResizeObserver(ajustarEscala).observe($('prevWrap'));   // acompanha o tamanho real da coluna (celular, girar a tela)
$('imgBanner').addEventListener('load', ajustarEscala);
atualizar();
