/* Teste de estresse dos cálculos e da leitura de fatura (Node + jsdom).
   Compara milhares de casos aleatórios/extremos com um cálculo exato (BigInt) e procura travamentos, NaN/Infinity e erros.
   Uso: cd tests && node stress.js   (leva alguns minutos) */
const fs = require('fs'), path = require('path');
const { JSDOM, ResourceLoader, VirtualConsole } = require('jsdom');
const ROOT = path.resolve(__dirname, '..');
const ACHADOS = []; const achado = (sev, area, texto, ex) => ACHADOS.push({ sev, area, texto, ex });
let seed = 987654321; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1)); const pick = a => a[ri(0, a.length - 1)];
const sleep = ms => new Promise(r => setTimeout(r, ms));
class Loader extends ResourceLoader { fetch(u) { if (u.startsWith('http://localhost/')) { const rel = u.slice(17).split(/[?#]/)[0]; if (rel.startsWith('js/vendor/')) return Promise.resolve(Buffer.from('')); const p = path.join(ROOT, rel); return fs.existsSync(p) ? Promise.resolve(fs.readFileSync(p)) : Promise.reject(new Error('404')); } return null; } }
async function open(page) {
  const erros = []; const vc = new VirtualConsole(); vc.on('jsdomError', e => erros.push(String(e.message).split('\n')[0]));
  const dom = new JSDOM(fs.readFileSync(path.join(ROOT, page), 'utf8'), { url: 'http://localhost/' + page, runScripts: 'dangerously', resources: new Loader(), pretendToBeVisual: true, virtualConsole: vc, beforeParse(w) { w.confirm = () => true; w.alert = () => {}; w.scrollTo = () => {}; } });
  await new Promise(r => dom.window.addEventListener('load', r)); await sleep(30); dom.window.__erros = erros; return dom.window;
}
const $ = (w, id) => w.document.getElementById(id), txt = (w, id) => $(w, id).textContent.trim();
const evt = (w, el, t = 'input') => el.dispatchEvent(new w.Event(t, { bubbles: true }));
const setv = (w, id, v) => { $(w, id).value = String(v); evt(w, $(w, id)); };
const num = s => parseFloat(String(s).replace(/\u2212/g, '-').replace(/[^\d,\-]/g, '').replace(',', '.'));
const rh = (n, d) => (2n * n + d) / (2n * d);          // arredonda meio para cima (n, d >= 0)
const t0 = () => process.hrtime.bigint(), ms = t => Number(process.hrtime.bigint() - t) / 1e6;
const secao = n => console.log('\n== ' + n);

async function indicacao(N) {
  secao('S1) Indicação: ' + N + ' casos aleatórios/extremos contra cálculo exato em centavos');
  let w = await open('indicacao.html'); let div = 0, nan = 0, ex = '', tmax = 0, puladas = 0;
  for (let i = 0; i < N; i++) {
    if (i && i % 300 === 0) { w.close(); w = await open('indicacao.html'); }
    const cI = BigInt(pick([ri(100, 1000), ri(100, 100000), ri(100, 10 ** 8), ri(100, 10 ** 9)])), cV = BigInt(pick([ri(100, 1000), ri(100, 100000), ri(100, 10 ** 8), ri(100, 10 ** 9)]));   // R$ 1,00 a R$ 10.000.000,00 (limites da 1.5.1)
    const bpI = BigInt(ri(0, 10000)), bpV = BigInt(ri(0, 10000));   // percentuais em centésimos de % (0 a 100,00)
    if ((cV * bpV * bpI) / (cI * 100000000n) > 20000n) { puladas++; continue; }   // razão extrema (meses de isenção > 20.000): ver achado de travamento
    const f = c => (Number(c) / 100).toFixed(2), p = b => (Number(b) / 100).toString();
    $(w, 'fInd').value = f(cI); $(w, 'fInv').value = f(cV); $(w, 'pInv').value = p(bpV); $(w, 'pInd').value = p(bpI);   // todos os campos de uma vez (evita estados intermediários extremos)
    const t = t0(); evt(w, $(w, 'pInd')); tmax = Math.max(tmax, ms(t));
    const desc = rh(cV * bpV, 10000n), cred = rh(desc * bpI, 10000n); const out = w.document.getElementById('out').textContent;
    if (/NaN|Infinity|undefined/.test(out)) { nan++; ex = ex || `NaN: ind=${f(cI)} inv=${f(cV)}`; continue; }
    const hl = w.document.querySelector('#out .hl'); if (!hl) { div++; ex = ex || `sem resultado: ind=${f(cI)} inv=${f(cV)} ${p(bpV)}/${p(bpI)}`; continue; }
    const rows = [...hl.querySelectorAll('.row')].map(r => [r.children[0].textContent, num(r.children[1].textContent)]);
    let esp;
    if (cred < cI) esp = Number(cI - cred) / 100; else { const m = cred / cI, resto = cred - m * cI; esp = Number(resto > 0n ? cI - resto : cI) / 100; }
    const got = rows.find(r => /^(Paga no 1º mês|Volta a pagar)/.test(r[0]));
    if (!got || Math.abs(got[1] - esp) > 0.0051) { div++; ex = ex || `ind=${f(cI)} inv=${f(cV)} ${p(bpV)}%/${p(bpI)}% esperado ${esp} obtido ${got && got[1]}`; }
  }
  console.log(`   divergências: ${div} | NaN/Infinity: ${nan} | pior tempo de um cálculo: ${tmax.toFixed(2)} ms | casos com razão extrema pulados: ${puladas}`);
  if (div) achado('ALTA', 'Indicação', `${div} de ${N} casos divergem do cálculo exato em centavos`, ex);
  if (nan) achado('ALTA', 'Indicação', `${nan} casos geram NaN/Infinity`, ex);
  // (a sonda com fatura de quem indica < R$ 0,01 foi feita à parte, em processo isolado: tests/demo-congela.js)
  w.close();
}

async function consumo(N) {
  secao('S2) Consumo: ' + N + ' casos contra cálculo exato (BigInt): média, energia compartilhada e mensalidade');
  let w = await open('consumo.html'); const P = JSON.parse(JSON.stringify(w.eval('P')));
  const D = P.disponibilidade, TIPOS = ['Monofásico', 'Bifásico', 'Trifásico'], DIST = Object.keys(P.distribuidoras), BAND = P.tarifasAXS.bandeiras;
  let divC = 0, divM = 0, nan = 0, exC = '', exM = '', meio = 0, tmax = 0;
  for (let i = 0; i < N; i++) {
    if (i && i % 200 === 0) { w.close(); w = await open('consumo.html'); }
    const d = pick(DIST), t = pick(TIPOS), b = pick(BAND), cop = d === 'COPEL - PR', fx = cop ? pick(['Faixa I', 'Faixa II']) : null;
    $(w, 'limpar').click(); setv(w, 'dist', d); setv(w, 'tipo', t); setv(w, 'bandeira', b); if (cop) setv(w, 'faixa', fx);
    const n = ri(1, 12), v100 = Array.from({ length: n }, () => BigInt(pick([ri(0, 2000), ri(0, 90000), ri(0, 10 ** 7)])));
    for (let k = 0; k < 12; k++) $(w, 'm' + (k + 1)).value = k < n ? (Number(v100[k]) / 100).toFixed(2) : '';
    const qAc = pick([0, 0, ri(1, 6)]), acKwh = Number(w.eval('AC[0].kwh'));   // quantidade inteira de aparelhos de 9.000 BTUs
    if (qAc > 0) { const e = w.document.querySelectorAll('.acq')[0]; e.value = String(qAc); }
    const tm = t0(); evt(w, $(w, 'm1')); tmax = Math.max(tmax, ms(tm));
    const adic = BigInt(qAc * acKwh * 100);   // em centésimos de kWh
    const disp100 = BigInt(D[t]) * 100n; let soma = 0n; for (const v of v100) { const x = v + adic - disp100; soma += x > 0n ? x : 0n; }
    const tar5 = BigInt(Math.round(w.eval(`tarifaAXS(${JSON.stringify(d)}, ${JSON.stringify(b)}, ${JSON.stringify(fx)})`) * 1e5));
    const mensEsp = rh(soma * tar5, BigInt(n) * 100000n);                            // centavos de R$ (exato)
    const compEsp = Number(soma) / 100 / n * 12;
    const saida = ['compAno', 'mensal', 'presMes', 'consAno', 'media'].map(id => txt(w, id)).join(' ');
    if (/NaN|Infinity|undefined/.test(saida)) { nan++; continue; }
    const gotC = num(txt(w, 'compAno')), gotM = Math.round(num(txt(w, 'mensal')) * 100);
    if (Math.abs(gotC - compEsp) > 0.011 + compEsp * 1e-12) { divC++; exC = exC || `${d} ${t} n=${n} esperado ${compEsp.toFixed(2)} obtido ${gotC}`; }
    if (BigInt(gotM) !== mensEsp) { divM++; if (Math.abs(gotM - Number(mensEsp)) > 1) meio += 1000; exM = exM || `${d} ${t} ${b} n=${n} soma=${Number(soma) / 100} tar=${tar5} esperado ${mensEsp} centavos, obtido ${gotM}`; }
  }
  console.log(`   energia compartilhada: ${divC} divergências | mensalidade: ${divM} divergências (centavos) | NaN: ${nan} | pior tempo: ${tmax.toFixed(2)} ms`);
  if (divC) achado('ALTA', 'Consumo', `energia compartilhada diverge do cálculo exato em ${divC}/${N} casos`, exC);
  if (divM) achado(meio ? 'ALTA' : 'BAIXA', 'Consumo', `mensalidade difere em 1 centavo do cálculo exato em ${divM}/${N} casos (arredondamento de ponto flutuante)`, exM);
  if (nan) achado('ALTA', 'Consumo', `${nan} casos geram NaN/Infinity/undefined`);
  w.close();
}

async function extremos() {
  secao('S3) Consumo: valores extremos, volume e textos gigantes');
  const w = await open('consumo.html'); const base = (d, t) => { $(w, 'limpar').click(); setv(w, 'dist', d); setv(w, 'tipo', t); };
  const meses = a => { for (let i = 1; i <= 12; i++) $(w, 'm' + i).value = a[i - 1] === undefined ? '' : String(a[i - 1]); evt(w, $(w, 'm1')); };
  for (const [nome, arr] of [['1e15', [1e15]], ['1e300', [1e300, 1e300]], ['1e309 (Infinity)', ['1e309']], ['0,0001', [0.0001, 0.0002]], ['-0', ['-0']], ['9007199254740993', [9007199254740993]], ['notação 1e3', ['1e3', '2e3']]]) {
    base('ENERGISA - MT', 'Bifásico'); meses(arr); const s = ['media', 'compAno', 'mensal', 'considerada', 'qtd'].map(i => txt(w, i)).join(' | ');
    if (/NaN|Infinity|∞|undefined/.test(s)) achado('MÉDIA', 'Consumo', `consumo mensal ${nome} mostra "${s.match(/NaN|Infinity|∞|undefined/)[0]}" no resultado`, s);
    else if (arr.some(x => Number(x) >= 1e15) && txt(w, 'qtd') !== '0') achado('BAIXA', 'Consumo', `aceita consumo mensal absurdo (${nome}) sem aviso`, s);
  }
  // volume: 500 produtos
  base('ENERGISA - MT', 'Bifásico'); meses([300, 300]); let t = t0();
  for (let i = 0; i < 60; i++) { $(w, 'oNome').value = 'Produto ' + i; $(w, 'oKwh').value = '10'; $(w, 'oQtd').value = '1'; $(w, 'oAdd').click(); }   // o limite é 50 produtos
  const tAdd = ms(t); t = t0(); evt(w, $(w, 'm1')); const tCalc = ms(t);
  console.log(`   60 tentativas de adicionar produto (limite 50): ${tAdd.toFixed(0)} ms | recalcular ${tCalc.toFixed(1)} ms | consumo extra = ${txt(w, 'outrosExtra')} | itens na lista: ${w.document.querySelectorAll('.orow:not(.ohead)').length}`);
  if (num(txt(w, 'outrosExtra')) !== 500 || w.document.querySelectorAll('.orow:not(.ohead)').length !== 50) achado('ALTA', 'Consumo', 'o limite de 50 produtos não funcionou', txt(w, 'outrosExtra'));
  t = t0(); for (let i = 0; i < 60; i++) { const x = w.document.querySelector('[data-del="0"]'); if (x) x.click(); } console.log(`   remover os produtos: ${ms(t).toFixed(0)} ms | sobrou: ${w.document.querySelectorAll('.orow:not(.ohead)').length}`);
  // volume: 100 distribuidoras
  t = t0(); for (let i = 0; i < 100; i++) { setv(w, 'nNome', 'DIST ' + i); setv(w, 'nMono', 100 + i); setv(w, 'nBi', 120); setv(w, 'nTri', 160); $(w, 'add').click(); }
  console.log(`   +100 distribuidoras: ${ms(t).toFixed(0)} ms | opções na lista: ${$(w, 'dist').options.length} | linhas na tabela: ${w.document.querySelectorAll('#params tr').length}`);
  // textos gigantes e caracteres especiais
  const gigante = 'A'.repeat(200000); t = t0(); $(w, 'oNome').value = gigante; $(w, 'oKwh').value = '5'; $(w, 'oQtd').value = '1'; $(w, 'oAdd').click(); const tg = ms(t);
  setv(w, 'nNome', gigante); setv(w, 'nMono', 1); setv(w, 'nBi', 1); setv(w, 'nTri', 1); $(w, 'add').click();
  console.log(`   nome de produto/distribuidora com 200.000 caracteres: ${tg.toFixed(0)} ms | erros de script: ${w.__erros.length}`);
  if (w.__erros.length) achado('MÉDIA', 'Consumo', 'texto gigante em nome de produto/distribuidora gera erro de script', w.__erros[0]);
  { const nomes = [...w.document.querySelectorAll('.orow:not(.ohead) > span:first-child')].map(x => x.textContent.length), maxNome = Math.max(0, ...nomes), maxDist = Math.max(...[...$(w, 'dist').options].map(o => o.value.length)); console.log(`   maior nome de produto na lista: ${maxNome} | maior nome de distribuidora: ${maxDist}`); if (maxNome > 60 || maxDist > 40) achado('MÉDIA', 'Consumo', 'nomes gigantes ainda são aceitos', maxNome + ' / ' + maxDist); }
  for (const nome of ['"><img src=x onerror=1>', "'; DROP TABLE--", '<script>1</script>', '\u202Eabc', '🔥'.repeat(50), '__proto__', 'constructor', 'toString']) {
    setv(w, 'nNome', nome); setv(w, 'nMono', 1); setv(w, 'nBi', 1); setv(w, 'nTri', 1); $(w, 'add').click();

  }
  if (w.document.querySelector('img') || w.document.querySelector('script:not([src])')) achado('ALTA', 'Segurança', 'nome digitado virou HTML (XSS)');
  w.close();
}

async function parser() {
  secao('S4) Leitura de fatura: entradas hostis e tempo de resposta (risco de travar o navegador)');
  const w = await open('consumo.html'); const casos = {
    'JAN + 200.000 espaços': 'JAN' + ' '.repeat(200000) + 'x', '"JAN26 " x 100.000 (sem números)': 'JAN26 '.repeat(100000), '"1 " x 300.000': '1 '.repeat(300000),
    '"JAN/26 345 " x 50.000 (histórico válido repetido)': 'JAN/26 345 '.repeat(50000), 'ENERGIA INJETADA + 100.000 dígitos': 'ENERGIA INJETADA ' + '9'.repeat(100000), 'SALDO + 100.000 espaços': 'SALDO' + ' '.repeat(100000),
    '"JAN26\\n" x 50.000 + números': 'JAN26\n'.repeat(50000) + '1\n'.repeat(50000), '"CONSUMO " x 100.000': 'CONSUMO '.repeat(100000), 'linhas "01/2026 5" x 100.000': '01/2026 5\n'.repeat(100000),
    'texto de 5 MB aleatório': Array.from({ length: 5e6 / 8 }, () => Math.random().toString(36).slice(2, 10)).join(''), '"MONOFASICO " x 200.000': 'MONOFASICO '.repeat(200000),
    'ruído de 2.000.000 de "/-." ': '/-. '.repeat(500000),
  };
  for (const [nome, txt0] of Object.entries(casos)) {
    const t = t0(); let erro = ''; try { w.analisarFatura(txt0); } catch (e) { erro = e.message; } const tempo = ms(t);
    console.log(`   ${tempo >= 1000 ? '!!' : '  '} ${nome.padEnd(52)} ${tempo.toFixed(0).padStart(7)} ms ${erro ? '(erro: ' + erro + ')' : ''}`);
    if (tempo >= 3000) achado('ALTA', 'Leitura de fatura', `entrada "${nome}" trava a página por ${(tempo / 1000).toFixed(1)} s (regex com backtracking)`);
    else if (tempo >= 1000) achado('MÉDIA', 'Leitura de fatura', `entrada "${nome}" demora ${(tempo / 1000).toFixed(1)} s`);
    if (erro) achado('MÉDIA', 'Leitura de fatura', `entrada "${nome}" gera exceção`, erro);
  }
  w.close();
}

async function fixtures() {
  secao('S5) Leitura de fatura: determinismo e idempotência com as 7 fixtures (x100)');
  const w = await open('consumo.html'), dir = path.join(__dirname, 'fixtures'); let inst = 0;
  for (const f of fs.readdirSync(dir).filter(n => n.endsWith('.json'))) {
    const fx = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')), it = (fx.paginas || []).map(p => p.map(([s, x, y, wd]) => ({ str: s, transform: [1, 0, 0, 1, x, y], width: wd })));
    const texto = fx.paginas ? w.textoDeItens(it) : fx.texto; const ref = JSON.stringify(w.analisarFatura(texto)); let ok = true;
    for (let i = 0; i < 100; i++) { if (JSON.stringify(w.analisarFatura(fx.paginas ? w.textoDeItens(it) : fx.texto)) !== ref) ok = false; }
    $(w, 'limpar').click(); w.aplicarFatura(texto); const a = $(w, 'm1').value + '|' + txt(w, 'media'); w.aplicarFatura(texto); const b = $(w, 'm1').value + '|' + txt(w, 'media');
    if (!ok || a !== b) { inst++; achado('ALTA', 'Leitura de fatura', `fixture ${f} não é determinística/idempotente`, a + ' vs ' + b); }
  }
  console.log(`   instáveis: ${inst}`); w.close();
}

async function fuzz(PASSOS) {
  secao('S6) Consumo: ' + PASSOS + ' operações aleatórias seguidas (distribuidora, tipo, meses, AC, produtos, geração, limpar, restaurar...) conferindo invariantes');
  let w = await open('consumo.html'); const P = w.eval('P'), DIST = Object.keys(P.distribuidoras), TIPOS = ['Monofásico', 'Bifásico', 'Trifásico', ''], BAND = P.tarifasAXS.bandeiras; let viol = 0, ex = '';
  const ops = [
    () => setv(w, 'dist', pick(['', ...DIST])), () => setv(w, 'tipo', pick(TIPOS)), () => setv(w, 'bandeira', pick(BAND)), () => { if (!$(w, 'faixaBox').hidden) setv(w, 'faixa', pick(['Faixa I', 'Faixa II'])); },
    () => setv(w, 'm' + ri(1, 12), pick(['', ri(0, 2000), (rnd() * 900).toFixed(2), -5, 'abc', 0])), () => { const c = $(w, 'social'); c.checked = !c.checked; evt(w, c, 'change'); evt(w, c); },
    () => { const e = w.document.querySelectorAll('.acq')[ri(0, 4)]; e.value = pick(['', 1, 2, 3, 0, -1]); evt(w, e); }, () => { $(w, 'oNome').value = 'P'; $(w, 'oKwh').value = ri(0, 300); $(w, 'oQtd').value = ri(1, 4); $(w, 'oAdd').click(); },
    () => { const x = w.document.querySelector('[data-del]'); if (x && x.closest('#outros')) x.click(); }, () => { const c = $(w, 'gPossui'); c.checked = !c.checked; evt(w, c, 'change'); evt(w, c); }, () => setv(w, 'gKwh', pick(['', ri(0, 400)])),
    () => { const c = $(w, 'gCarteira'); c.checked = !c.checked; evt(w, c, 'change'); evt(w, c); }, () => setv(w, 'gSaldo', pick(['', ri(0, 5000)])), () => $(w, 'limpar').click(), () => $(w, 'restaurar').click(),
    () => setv(w, ['dispMono', 'dispBi', 'dispTri'][ri(0, 2)], pick(['', ri(0, 200), -1])), () => setv(w, 'limiar', pick([0, 10, 30, 500, ''])),
    () => { const c = w.document.querySelector('#alertList input'); if (c) { c.checked = !c.checked; evt(w, c, 'change'); } },
  ];
  const t = t0();
  for (let i = 0; i < PASSOS; i++) {
    if (i && i % 500 === 0) { w.close(); w = await open('consumo.html'); }
    try { pick(ops)(); } catch (e) { viol++; ex = ex || 'exceção: ' + e.message; }
    const ids = ['qtd', 'total', 'media', 'considerada', 'minimo', 'dif', 'consAno', 'dispVal', 'compAno', 'presMes', 'tarifaVal', 'mensal', 'carteira', 'carteiraPrev', 'status'];
    const s = ids.map(id => txt(w, id)).join(' | ');
    const mens = num(txt(w, 'mensal')), comp = num(txt(w, 'compAno'));
    if (/NaN|Infinity|∞|undefined|null/.test(s) || mens < 0 || comp < 0) { viol++; ex = ex || `passo ${i}: ${s}`; }
    const vis = id => !$(w, id).parentElement.hidden; if (vis('mensal') && !vis('tarifaVal')) { viol++; ex = ex || `passo ${i}: mensalidade visível sem tarifa`; }
    if (vis('compAno') && !vis('dispVal')) { viol++; ex = ex || `passo ${i}: energia compartilhada sem disponibilidade`; }
  }
  console.log(`   ${PASSOS} operações em ${(ms(t) / 1000).toFixed(1)} s | violações: ${viol} | erros de script: ${w.__erros.length}`);
  if (viol) achado('ALTA', 'Consumo', `${viol} violações de invariantes na sequência aleatória`, ex);
  if (w.__erros.length) achado('ALTA', 'Consumo', 'erros de script durante a sequência aleatória', w.__erros[0]);
  w.close();
}

(async () => {
  const T = process.argv[2] ? +process.argv[2] : 1;
  const so = (process.env.STRESS_ONLY || 's1,s2,s3,s4,s5,s6').split(',');
  if (so.includes('s1')) await indicacao(3000 * T); if (so.includes('s2')) await consumo(1200 * T); if (so.includes('s3')) await extremos(); if (so.includes('s4')) await parser(); if (so.includes('s5')) await fixtures(); if (so.includes('s6')) await fuzz(3000 * T);
  console.log('\n' + '='.repeat(70) + '\nACHADOS (' + ACHADOS.length + ')');
  ACHADOS.forEach(a => console.log(` [${a.sev}] ${a.area}: ${a.texto}${a.ex ? '\n        ex.: ' + String(a.ex).slice(0, 220) : ''}`));
  fs.writeFileSync('/tmp/achados-stress.json', JSON.stringify(ACHADOS, null, 1)); process.exit(0);
})().catch(e => { console.error('ERRO', e); process.exit(1); });
