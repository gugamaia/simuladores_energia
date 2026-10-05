const $ = id => document.getElementById(id);
const brl = v => v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const r2 = v => Math.round(v*100)/100;
const plural = (n,s,p) => n + ' ' + (n===1?s:p);

function calc(){
  const fInd = parseFloat($('fInd').value), fInv = parseFloat($('fInv').value);
  const pInv = parseFloat($('pInv').value), pInd = parseFloat($('pInd').value);
  const out = $('out');
  if(!(fInd>0) || !(fInv>0) || isNaN(pInv) || isNaN(pInd)){
    out.innerHTML = '<p class="empty">Preencha as duas faturas para simular.</p>'; return;
  }
  if(pInv<0 || pInv>100 || pInd<0 || pInd>100){
    out.innerHTML = '<p class="empty">Informe percentuais entre 0 e 100.</p>'; return;
  }
  const descInv = r2(fInv * pInv/100);
  const pagaInv = r2(fInv - descInv);
  const credito = r2(descInv * pInd/100);

  let html = `
  <section class="card">
    <h2>Indicado</h2>
    <div class="row"><span>Fatura</span><b>${brl(fInv)}</b></div>
    <div class="row"><span>Desconto no 1º mês (${pInv}%)</span><b>− ${brl(descInv)}</b></div>
    <div class="row"><span>Paga no 1º mês</span><b>${brl(pagaInv)}</b></div>
  </section>
  <section class="card">
    <h2>Quem indicou</h2>
    <div class="row"><span>Fatura mensal</span><b>${brl(fInd)}</b></div>
    <div class="row"><span>Crédito recebido</span><b>${brl(credito)}</b></div>`;

  let plan = [];
  if(credito < fInd){
    const paga = r2(fInd - credito);
    plan.push({m:1,desc:credito,paga});
    html += `</section>
    <section class="card hl">
      <p class="big">Crédito não zera a fatura</p>
      <div class="row"><span>Meses isentos</span><b>0</b></div>
      <div class="row"><span>Paga no 1º mês</span><b>${brl(paga)}</b></div>
      <div class="row"><span>A partir do 2º mês</span><b>${brl(fInd)}</b></div>
    </section>`;
  } else {
    const cheios = Math.floor(r2(credito / fInd) + 1e-9);
    const resto = r2(credito - cheios*fInd);
    const paga = resto>0 ? r2(fInd - resto) : fInd;
    for(let i=1;i<=cheios;i++) plan.push({m:i,desc:fInd,paga:0});
    const voltaMes = cheios+1;
    plan.push({m:voltaMes,desc:resto,paga});
    html += `</section>
    <section class="card hl">
      <p class="big">Fatura isenta por ${plural(cheios,'mês','meses')}</p>
      <div class="row"><span>Meses 1 a ${cheios} (isentos)</span><b>${brl(0)}</b></div>
      <div class="row"><span>Volta a pagar no mês ${voltaMes}</span><b>${brl(paga)}</b></div>
      <div class="row"><span>${resto>0?'Saldo de crédito usado nesse mês':'Sem saldo de crédito restante'}</span><b>${resto>0?'− '+brl(resto):brl(0)}</b></div>
      <div class="row"><span>A partir do mês ${voltaMes+1}</span><b>${brl(fInd)}</b></div>
    </section>`;
  }

  html += `<p class="note">Cálculo: crédito = desconto do indicado × % de crédito. O crédito abate a fatura de quem indica mês a mês; meses cobertos por inteiro ficam isentos e o saldo restante abate o mês em que volta a pagar. Ajuste os percentuais se a regra da campanha for outra.</p>`;
  out.innerHTML = html;
}
['fInd','fInv','pInv','pInd'].forEach(id=>$(id).addEventListener('input',calc));
