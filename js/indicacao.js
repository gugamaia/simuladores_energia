const $ = id => document.getElementById(id);
const brl = v => v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const r2 = v => Math.round(v*100 + 1e-6)/100;   // meio centavo sobe (evita erro de ponto flutuante: 8,745 virava 8,74)
const plural = (n,s,p) => n + ' ' + (n===1?s:p);

/* limites de entrada: evitam valores absurdos e resultados sem sentido */
const MIN_FATURA = 1, MAX_FATURA = 10000000, MAX_MESES = 120;

function calc(){
  const fInd = parseFloat($('fInd').value), fInv = parseFloat($('fInv').value);
  const pInv = parseFloat($('pInv').value), pInd = parseFloat($('pInd').value);
  const out = $('out');
  if(!(fInd>0) || !(fInv>0) || isNaN(pInv) || isNaN(pInd)){
    out.innerHTML = '<p class="empty">Preencha as duas faturas para simular.</p>'; return;
  }
  if(fInd < MIN_FATURA || fInd > MAX_FATURA || fInv < MIN_FATURA || fInv > MAX_FATURA){
    out.innerHTML = '<p class="empty">Informe faturas entre R$ 1,00 e R$ 10.000.000,00.</p>'; return;
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

  if(credito < fInd){
    const paga = r2(fInd - credito);
    html += `</section>
    <section class="card hl">
      <p class="big">Crédito não zera a fatura</p>
      <div class="row"><span>Meses isentos</span><b>0</b></div>
      <div class="row"><span>Paga no 1º mês</span><b>${brl(paga)}</b></div>
      <div class="row"><span>A partir do 2º mês</span><b>${brl(fInd)}</b></div>
    </section>`;
  } else {
    // contas em centavos inteiros: arredondar a razão (crédito / fatura) antes de truncar contava 1 mês a mais em ~0,2% dos casos
    const cC = Math.round(credito*100), iC = Math.round(fInd*100);
    const cheios = Math.floor(cC / iC), restoC = cC - cheios*iC;
    const resto = restoC/100;
    const paga = restoC>0 ? (iC - restoC)/100 : fInd;
    const voltaMes = cheios+1;
    html += `</section>
    <section class="card hl">
      <p class="big">Fatura isenta por ${plural(cheios,'mês','meses')}</p>
      ${cheios > MAX_MESES ? '<p class="aviso">⚠ Confira os valores: o crédito cobre ' + cheios.toLocaleString('pt-BR') + ' meses (mais de 10 anos).</p>' : ''}
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

/* Limpar campos: zera as faturas de quem indica e do indicado. Os percentuais (regra da campanha) são mantidos. */
$('limpar').addEventListener('click', ()=>{
  $('fInd').value = '';
  $('fInv').value = '';
  calc();             // volta para a mensagem "Preencha as duas faturas para simular."
  $('fInd').focus();  // cursor no primeiro campo
});
