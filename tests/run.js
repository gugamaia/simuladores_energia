/* Suite de testes dos simuladores (Node + jsdom). Uso: cd tests && npm install && npm test */
const fs = require('fs'), path = require('path');
const { JSDOM, ResourceLoader, VirtualConsole } = require('jsdom');
const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0; const fails = [], warns = [];
const ok = (c, name, det) => { if (c) pass++; else { fail++; fails.push(name + (det !== undefined ? '  ->  ' + det : '')); } };
const warn = (c, name) => { if (!c) warns.push(name); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const num = s => { if (s == null) return NaN; return parseFloat(String(s).replace(/\u2212/g, '-').replace(/[^\d,\-]/g, '').replace(',', '.')); };
let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const section = n => console.log('\n== ' + n);
const PARAM = (() => { const o = {}; new Function('window', fs.readFileSync(path.join(__dirname, '..', 'parametros.js'), 'utf8'))(o); return o.PARAMETROS; })();
const KP = 'validador-lead-params-v2', KA = 'validador-lead-ac-v2';

class Loader extends ResourceLoader {
  constructor(over) { super(); this.over = over || {}; }
  fetch(url) {
    if (url.startsWith('http://localhost/')) {
      const rel = url.slice(17).split(/[?#]/)[0] || 'index.html';
      if (this.over[rel] !== undefined) return Promise.resolve(Buffer.from(this.over[rel]));
      if (rel.startsWith('js/vendor/')) return Promise.resolve(Buffer.from('/* biblioteca omitida nos testes */'));
      const p = path.join(ROOT, rel);
      return fs.existsSync(p) ? Promise.resolve(fs.readFileSync(p)) : Promise.reject(new Error('404 ' + rel));
    }
    return null; // sem internet nos testes
  }
}
async function open(page, o = {}) {
  const errors = []; const vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push(String(e.message).split('\n')[0]));
  const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
  const dom = new JSDOM(html, { url: 'http://localhost/' + page + (o.query || '') + (o.hash || ''), runScripts: 'dangerously', resources: new Loader(o.over), pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) { w.confirm = () => true; w.alert = () => { w.__alerts = (w.__alerts || 0) + 1; }; w.scrollTo = () => {}; if (o.beforeParse) o.beforeParse(w); } });
  await new Promise(r => dom.window.addEventListener('load', r)); await sleep(40);
  dom.window.__errors = errors; return dom.window;
}
const $ = (w, id) => w.document.getElementById(id);
const setv = (w, id, v) => { const e = $(w, id); e.value = String(v); e.dispatchEvent(new w.Event('input', { bubbles: true })); };
const chk = (w, id, on) => { const e = $(w, id); e.checked = on; e.dispatchEvent(new w.Event('change', { bubbles: true })); e.dispatchEvent(new w.Event('input', { bubbles: true })); };
const txt = (w, id) => $(w, id).textContent.trim();
const vis = (w, id) => !$(w, id).parentElement.hidden;
const rows = (el) => [...el.querySelectorAll('.row')].map(r => [r.children[0].textContent.trim(), r.children[1].textContent.trim()]);

/* ======================= A) ESTÁTICO ======================= */
async function estatico() {
  section('A) Estrutura, arquivos e boas práticas');
  const files = ['index.html', 'indicacao.html', 'consumo.html', 'config.js', 'README.md', '.gitignore', 'css/index.css', 'css/indicacao.css', 'css/consumo.css', 'js/index.js', 'js/indicacao.js', 'js/consumo.js', 'js/rastreio.js', 'extras/cloudflare-worker.js', 'parametros.js', '.github/workflows/testes.yml', 'js/vendor/pdf.min.js', 'js/vendor/pdf.worker.min.js', 'js/vendor/LICENSE-pdfjs.txt', 'tests/package-lock.json', 'tests/extrair-fixture.js', 'versao.js', 'CHANGELOG.md', 'proposta.html', 'css/proposta.css', 'css/tema.css', 'js/proposta.js', 'js/tema.js', 'js/proposta-imagens.js', 'js/vendor/html2canvas.min.js', 'js/vendor/jspdf.umd.min.js', 'fonts/montserrat-latin-wght-normal.woff2'];
  files.forEach(f => ok(fs.existsSync(path.join(ROOT, f)), 'arquivo existe: ' + f));
  for (const f of ['config.js', 'versao.js', 'parametros.js', 'js/index.js', 'js/indicacao.js', 'js/consumo.js', 'js/rastreio.js', 'js/tema.js', 'js/proposta.js']) {
    try { new Function(fs.readFileSync(path.join(ROOT, f), 'utf8')); ok(true, ''); } catch (e) { ok(false, 'sintaxe JS ' + f, e.message); }
  }
  for (const f of ['index.html', 'indicacao.html', 'consumo.html', 'proposta.html']) {
    const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const d = new JSDOM(html).window.document;
    ok(d.documentElement.lang === 'pt-BR', f + ': lang="pt-BR"');
    ok(!!d.querySelector('meta[name=viewport]'), f + ': meta viewport');
    ok(!!d.title.trim(), f + ': <title>');
    ok(!d.querySelector('style'), f + ': sem <style> embutido');
    ok(![...d.querySelectorAll('[style]')].length, f + ': sem style="" inline');
    ok(![...d.querySelectorAll('script:not([src])')].length, f + ': sem <script> inline');
    ok(![...d.querySelectorAll('[onclick],[oninput],[onchange],[onload]')].length, f + ': sem handlers inline (onclick...)');
    const ids = [...d.querySelectorAll('[id]')].map(e => e.id); const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
    ok(!dup.length, f + ': ids únicos', dup.join(','));
    [...d.querySelectorAll('link[href],script[src]')].forEach(e => {
      const u = e.getAttribute('href') || e.getAttribute('src');
      if (/^(https?:)?\/\//.test(u)) return;
      ok(!u.startsWith('/'), f + ': caminho relativo (GitHub Pages) ' + u);
      ok(fs.existsSync(path.join(ROOT, u)), f + ': recurso existe ' + u);
    });
    [...d.querySelectorAll('input:not([type=hidden]),select,textarea')].forEach(e => {
      const rotulado = e.id && d.querySelector('label[for="' + e.id + '"]') || e.closest('label') || e.getAttribute('aria-label') || e.getAttribute('placeholder') || e.getAttribute('title');
      warn(rotulado, f + ': campo sem rótulo acessível (#' + (e.id || e.type) + ')');
    });
  }
  const todos = []; (function walk(p) { for (const n of fs.readdirSync(p)) { if (n === 'node_modules' || n === 'package-lock.json') continue; const f = path.join(p, n); fs.statSync(f).isDirectory() ? walk(f) : todos.push(f); } })(ROOT);
  const seg = /(api[_-]?key|token|secret|senha|password)\s*[:=]\s*['"][A-Za-z0-9_\-]{16,}['"]/i;
  todos.filter(f => /\.(js|html|md|css)$/.test(f)).forEach(f => ok(!seg.test(fs.readFileSync(f, 'utf8')), 'sem segredo literal em ' + path.relative(ROOT, f)));
  const gi = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
  ['.env', '.dev.vars', 'node_modules/', '*.pdf', '*.zip'].forEach(p => ok(gi.split('\n').includes(p), '.gitignore contém ' + p));
  ok(!gi.split('\n').includes('config.js') && !gi.split('\n').includes('css/') && !gi.split('\n').includes('js/'), '.gitignore não exclui arquivos do site');
  ok(fs.statSync(path.join(ROOT, 'js/vendor/pdf.min.js')).size > 100000 && fs.statSync(path.join(ROOT, 'js/vendor/pdf.worker.min.js')).size > 500000, 'pdf.js local tem tamanho esperado');
  ok(!/cdnjs\.cloudflare/.test(fs.readFileSync(path.join(ROOT, 'consumo.html'), 'utf8') + fs.readFileSync(path.join(ROOT, 'js/consumo.js'), 'utf8')), 'leitor de PDF não depende de CDN');
  ok(!/cdnjs|googleapis|gstatic|unpkg|jsdelivr/.test(['proposta.html', 'css/proposta.css', 'js/proposta.js'].map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('')), 'proposta não depende de CDN nem de fontes externas');
  ok(/runs-on|npm ci/.test(fs.readFileSync(path.join(ROOT, '.github/workflows/testes.yml'), 'utf8')), 'workflow de testes presente');
  ok(typeof PARAM.versao === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(PARAM.atualizadoEm) && PARAM.descontoSocial === 200 && PARAM.acs.length === 5, 'parametros.js: versão, data, desconto social e 5 modelos de AC');
  ok(JSON.stringify(Object.keys(PARAM.distribuidoras)) === JSON.stringify(Object.keys(TAB)) && Object.entries(PARAM.distribuidoras).every(([d, t]) => TIPOS.every((k, i) => t[k] === TAB[d][i])), 'parametros.js confere com a tabela do negócio (6 distribuidoras x 3 tipos)');
  const VER = {}; new Function('window', fs.readFileSync(path.join(ROOT, 'versao.js'), 'utf8'))(VER);
  const cl = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8'), mv = cl.match(/^## \[(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})/m);
  ok(/^\d+\.\d+\.\d+$/.test(VER.VERSAO.numero) && /^\d{4}-\d{2}-\d{2}$/.test(VER.VERSAO.data), 'versao.js: número (MAIOR.MENOR.CORREÇÃO) e data válidos');
  ok(!!mv && mv[1] === VER.VERSAO.numero && mv[2] === VER.VERSAO.data, 'CHANGELOG: versão mais recente confere com versao.js', mv ? mv[1] + ' ' + mv[2] : 'sem entrada');
  ok(/\[Não lançado\]/.test(cl), 'CHANGELOG: seção "Não lançado" presente');
  const FX = path.join(ROOT, 'tests/fixtures'); const fxs = fs.readdirSync(FX).filter(n => n.endsWith('.json'));
  ok(fxs.length >= 7, 'fixtures de faturas reais presentes (' + fxs.length + ')');
  fxs.forEach(f => { const t = fs.readFileSync(path.join(FX, f), 'utf8'); ok(!/[1-9]\d{7,}/.test(t) && !/\*\*\*/.test(t), 'fixture sem números longos nem CPF mascarado: ' + f); });
  const w = await open('index.html'); ok(typeof w.CONFIG === 'object' && 'goatcounter' in w.CONFIG && 'locationsUrl' in w.CONFIG, 'config.js define CONFIG'); w.close();
}

/* ======================= B) INDICAÇÃO ======================= */
const rowsInd = w => { const c = [...w.document.querySelectorAll('#out section.card')]; return c.map(x => Object.fromEntries(rows(x))); };
async function indicacao() {
  section('B) Simulador de indicação');
  const w = await open('indicacao.html'); ok(!w.__errors.length, 'carrega sem erros de script', w.__errors.join('|'));
  const run = (fInd, fInv, pInv = 50, pInd = 100) => { setv(w, 'fInd', fInd); setv(w, 'fInv', fInv); setv(w, 'pInv', pInv); setv(w, 'pInd', pInd); return rowsInd(w); };
  ok(/Preencha/.test(txt(w, 'out')), 'estado inicial pede preenchimento');
  let r = run(100, 300); let hl = r[2];
  ok(txt(w, 'out').includes('isenta por 1 mês'), 'caso base: 1 mês isento'); ok(num(hl['Volta a pagar no mês 2']) === 50, 'caso base: volta a pagar R$ 50 no mês 2', JSON.stringify(hl));
  ok(num(r[0]['Desconto no 1º mês (50%)']) === -150, 'indicado: desconto de 150'); ok(num(r[0]['Paga no 1º mês']) === 150, 'indicado: paga 150');
  r = run(200, 100); ok(/Crédito não zera/.test(txt(w, 'out')), 'crédito menor que a fatura'); ok(num(r[2]['Paga no 1º mês']) === 150, 'paga 150 no 1º mês'); ok(num(r[2]['A partir do 2º mês']) === 200, 'depois paga a fatura cheia');
  r = run(75, 300); ok(txt(w, 'out').includes('isenta por 2 meses'), 'múltiplo exato: 2 meses'); ok(num(r[2]['Volta a pagar no mês 3']) === 75, 'múltiplo exato: volta a pagar fatura cheia'); ok(/Sem saldo/.test(txt(w, 'out')), 'múltiplo exato: sem saldo restante');
  r = run(100, 300, 100, 100); ok(num(r[0]['Paga no 1º mês']) === 0, 'desconto 100%: indicado paga 0');
  r = run(100, 300, 0, 100); ok(/Crédito não zera/.test(txt(w, 'out')) && num(r[2]['Paga no 1º mês']) === 100, 'desconto 0%: sem crédito');
  r = run(100, 300, 50, 0); ok(num(r[2]['Paga no 1º mês']) === 100, 'crédito 0%: indicador paga cheio');
  r = run(100, 300, 50, 50); ok(num(r[2]['Paga no 1º mês']) === 25, 'crédito 50% do desconto (75): paga 25', JSON.stringify(r[2]));
  r = run(0.01, 1000); ok(txt(w, 'out').includes('isenta por'), 'fatura mínima 0,01 não quebra');
  r = run(33.33, 99.99); ok(!/NaN|Infinity/.test(txt(w, 'out')), 'centavos sem NaN/Infinity');
  ['', '0', '-5', 'abc'].forEach(v => { run(100, v); ok(/Preencha/.test(txt(w, 'out')), 'fatura inválida "' + v + '" não calcula'); });
  setv(w, 'fInd', 100); setv(w, 'fInv', 300); setv(w, 'pInv', ''); ok(/Preencha|Informe/.test(txt(w, 'out')), 'percentual vazio não calcula');
  setv(w, 'pInv', 150); ok(!/isenta|Crédito/.test(txt(w, 'out')) || /entre 0 e 100|Informe/.test(txt(w, 'out')), 'percentual > 100 é recusado', txt(w, 'out').slice(0, 80));
  setv(w, 'pInv', -10); ok(!/\(-10%\)/.test(txt(w, 'out')), 'percentual negativo é recusado');
  setv(w, 'pInv', 50); setv(w, 'pInd', 200); ok(!/isenta|Crédito/.test(txt(w, 'out')) || /entre 0 e 100|Informe/.test(txt(w, 'out')), 'crédito > 100% é recusado');
  // propriedade: 400 casos aleatórios (aritmética em centavos como referência)
  let erros = 0, amostra = '';
  for (let i = 0; i < 400; i++) {
    const fInd = ri(100, 90000) / 100, fInv = ri(100, 90000) / 100, pInv = ri(0, 100), pInd = ri(0, 100);
    const r = run(fInd, fInv, pInv, pInd);
    const c = Math.round(Math.round(fInv * 100) * pInv / 100) * pInd / 100;           // desconto em centavos x % crédito
    const credC = Math.round(c), indC = Math.round(fInd * 100);
    const meses = Math.floor(credC / indC), resto = credC - meses * indC;
    const esperaPaga = (meses === 0 ? indC - credC : (resto > 0 ? indC - resto : indC)) / 100;
    const hl = r[2]; const valores = Object.entries(hl);
    const paga = meses === 0 ? num(hl['Paga no 1º mês']) : num(hl['Volta a pagar no mês ' + (meses + 1)]);
    const mesesTxt = meses === 0 ? 0 : parseInt((txt(w, 'out').match(/isenta por (\d+)/) || [])[1], 10);
    if (!(Math.abs(paga - esperaPaga) < 0.011 && mesesTxt === meses)) { erros++; if (!amostra) amostra = `fInd=${fInd} fInv=${fInv} ${pInv}%/${pInd}% esperado ${meses}m paga ${esperaPaga} obtido ${mesesTxt}m paga ${paga}`; }
  }
  ok(erros === 0, 'propriedade (400 casos aleatórios): meses de isenção e valor do mês de retorno', erros + ' divergências. ' + amostra);
  w.close();
}

/* ======================= C) CONSUMO ======================= */
const TAB = { 'CEMIG - MG': [153, 173, 223], 'COPEL - PR': [189, 209, 259], 'CPFL Paulista - SP': [250, 270, 320], 'ELEKTRO - SP': [250, 270, 320], 'ENERGISA - MT': [210, 230, 280], 'EQUATORIAL - GO': [156, 176, 226] };
const TIPOS = ['Monofásico', 'Bifásico', 'Trifásico'];
const meses = (w, arr) => { for (let i = 1; i <= 12; i++) setv(w, 'm' + i, arr[i - 1] === undefined ? '' : arr[i - 1]); };
const base = (w, d = 'ENERGISA - MT', t = 'Bifásico') => { $(w, 'limpar').click(); chk(w, 'social', false); setv(w, 'dist', d); setv(w, 'tipo', t); };
const status = w => $(w, 'status').className.replace('status', '').trim();
async function consumo() {
  section('C) Simulador de consumo (cálculo)');
  const w = await open('consumo.html'); ok(!w.__errors.length, 'carrega sem erros de script', w.__errors.join('|'));
  ok(status(w) === 'warn' && /FALTA CONFIGURAR/.test(txt(w, 'status')), 'estado inicial: falta configurar');
  // limites por distribuidora x tipo (18 combinações): exatamente o mínimo atende, 1 kWh abaixo não
  for (const [d, mins] of Object.entries(TAB)) TIPOS.forEach((t, i) => {
    base(w, d, t); meses(w, [mins[i], mins[i], mins[i]]); ok(status(w) === 'ok' && num(txt(w, 'dif')) === 0, `${d}/${t}: média = mínimo (${mins[i]}) atende`, txt(w, 'dif') + status(w));
    meses(w, [mins[i] - 1, mins[i] - 1, mins[i] - 1]); ok(status(w) === 'no' && /Faltam 1,00/.test(txt(w, 'status')), `${d}/${t}: ${mins[i] - 1} não atende`);
    ok(num(txt(w, 'minimo')) === mins[i], `${d}/${t}: mínimo exibido ${mins[i]}`);
  });
  base(w); meses(w, [100, 200]); ok(num(txt(w, 'media')) === 150 && txt(w, 'qtd') === '2', 'média usa só os meses informados (2 meses)');
  meses(w, [300]); ok(num(txt(w, 'media')) === 300 && txt(w, 'qtd') === '1', '1 mês informado');
  meses(w, [100, '', 300, '', 200]); ok(num(txt(w, 'media')) === 200 && txt(w, 'qtd') === '3', 'meses em branco no meio são ignorados');
  meses(w, [0, 0, 300]); ok(num(txt(w, 'media')) === 100 && txt(w, 'qtd') === '3', 'mês com consumo 0 conta na média');
  meses(w, [-50, 200, 200]); ok(txt(w, 'qtd') === '2', 'valor negativo é ignorado');
  meses(w, [472, 514, 313, 329, 366, 495, 347, 437, 435, 414, 483, 431]); ok(num(txt(w, 'media')) === 419.67 && num(txt(w, 'total')) === 5036 && status(w) === 'ok', '12 meses da fatura real: média 419,67 e total 5.036');
  base(w); meses(w, [300, 300, 300]); chk(w, 'social', true); ok(num(txt(w, 'considerada')) === 100 && status(w) === 'no', 'tarifa social: 300 - 200 = 100'); ok(vis(w, 'desc'), 'linha de desconto social aparece quando marcada');
  meses(w, [100, 100, 100]); ok(num(txt(w, 'considerada')) === 0, 'tarifa social: média considerada nunca fica negativa');
  chk(w, 'social', false); ok(!vis(w, 'desc'), 'linha de desconto social oculta quando desmarcada');
  // AC
  const qac = (i, q) => { const e = w.document.querySelectorAll('.acq')[i]; e.value = q; e.dispatchEvent(new w.Event('input', { bubbles: true })); };
  base(w); meses(w, [100, 100, 100]); [100, 150, 250, 300, 400].forEach((kwh, i) => { qac(0, ''); qac(1, ''); qac(2, ''); qac(3, ''); qac(4, ''); qac(i, 1); ok(num(txt(w, 'considerada')) === 100 + kwh, `AC modelo ${i + 1}: +${kwh} kWh`, txt(w, 'considerada')); });
  [0, 1, 2, 3, 4].forEach(i => qac(i, '')); qac(0, 2); qac(1, 1); qac(4, 1); ok(num(txt(w, 'acExtra')) === 750 && num(txt(w, 'considerada')) === 850, 'AC combinado (2x9k + 1x12k + 1x24k = 750)');
  qac(0, 0); qac(1, -2); qac(2, 'x'); ok(num(txt(w, 'acExtra')) === 400, 'AC: quantidade 0, negativa ou texto é ignorada', txt(w, 'acExtra'));
  ok(vis(w, 'acExtra') && vis(w, 'media'), 'com AC: linhas "extra" e "média informada" visíveis');
  const k = w.document.querySelector('.ack'); k.value = 120; k.dispatchEvent(new w.Event('input', { bubbles: true })); qac(4, ''); qac(0, 1); ok(num(txt(w, 'acExtra')) === 120, 'consumo extra do AC é editável');
  k.value = 100; k.dispatchEvent(new w.Event('input', { bubbles: true }));
  // outros produtos
  base(w); meses(w, [100, 100, 100]); setv(w, 'oNome', 'Chuveiro'); setv(w, 'oKwh', 80); setv(w, 'oQtd', 2); $(w, 'oAdd').click();
  ok(num(txt(w, 'outrosExtra')) === 160 && num(txt(w, 'considerada')) === 260, 'outros produtos: 80 x 2 = 160');
  const oq = w.document.querySelector('.oq'); oq.value = 3; oq.dispatchEvent(new w.Event('input', { bubbles: true })); ok(num(txt(w, 'outrosExtra')) === 240, 'alterar quantidade recalcula');
  setv(w, 'oNome', 'Forno'); setv(w, 'oKwh', 50); $(w, 'oAdd').click(); ok(num(txt(w, 'outrosExtra')) === 290, 'segundo produto soma (quantidade padrão 1)');
  w.document.querySelector('[data-del="0"]').click(); ok(num(txt(w, 'outrosExtra')) === 50, 'remover produto');
  const a0 = w.__alerts || 0; setv(w, 'oNome', ''); setv(w, 'oKwh', 10); $(w, 'oAdd').click(); ok((w.__alerts || 0) === a0 + 1, 'produto sem nome é recusado com aviso');
  w.document.querySelector('[data-del="0"]').click(); ok(!vis(w, 'outrosExtra'), 'sem produtos: linha oculta');
  // geração e carteira
  base(w); meses(w, [400, 400, 400]); chk(w, 'gPossui', true); setv(w, 'gKwh', 100); ok(num(txt(w, 'considerada')) === 500, 'geração/injeção soma na média');
  chk(w, 'gCarteira', true); setv(w, 'gSaldo', 800); ok(/2 meses/.test(txt(w, 'carteiraPrev')) && vis(w, 'carteiraPrev'), 'carteira: 800 / 400 = 2 meses', txt(w, 'carteiraPrev'));
  setv(w, 'gSaldo', 1000); ok(/2 meses e 15 dias/.test(txt(w, 'carteiraPrev')), 'carteira: 1000 / 400 = 2 meses e 15 dias', txt(w, 'carteiraPrev'));
  setv(w, 'gSaldo', 100); ok(/8 dias/.test(txt(w, 'carteiraPrev')), 'carteira: menos de 1 mês em dias (7,5 dias arredonda para 8)', txt(w, 'carteiraPrev'));
  setv(w, 'gSaldo', 0); ok(!vis(w, 'carteiraPrev'), 'saldo 0: sem previsão');
  setv(w, 'gSaldo', 799.9); setv(w, 'gSaldo', 1195); ok(!/NaN|undefined/.test(txt(w, 'carteiraPrev')), 'previsão sem NaN');
  chk(w, 'gPossui', false); ok(num(txt(w, 'considerada')) === 400 && !vis(w, 'carteira'), 'desmarcar geração remove efeito e oculta campos', txt(w, 'considerada'));
  // visibilidade do resultado
  base(w); meses(w, [300, 300, 300]); ok(!vis(w, 'media') && !vis(w, 'acExtra') && !vis(w, 'outrosExtra') && !vis(w, 'gerExtra') && !vis(w, 'desc') && !vis(w, 'carteira') && !vis(w, 'carteiraPrev'), 'resultado enxuto: só linhas com informação aplicada');
  ok(vis(w, 'relogio') && txt(w, 'relogio') === 'Bifásico' && vis(w, 'total'), 'tipo de relógio e total consumido visíveis');
  // limpar
  qac(1, 2); chk(w, 'gPossui', true); setv(w, 'gKwh', 10); $(w, 'limpar').click(); ok(txt(w, 'qtd') === '0' && !$(w, 'gPossui').checked && num(txt(w, 'acExtra')) === 0 && !$(w, 'm1').value, 'limpar zera consumos, AC, produtos e geração');
  // propriedade: 150 casos aleatórios contra um modelo de referência
  let erros = 0, amostra = '';
  for (let i = 0; i < 150; i++) {
    const d = Object.keys(TAB)[ri(0, 5)], ti = ri(0, 2); base(w, d, TIPOS[ti]);
    const arr = Array.from({ length: ri(1, 12) }, () => ri(0, 900)); meses(w, arr);
    const acq = [0, 0, 0, 0, 0].map(() => (rnd() < 0.4 ? ri(1, 3) : 0)); acq.forEach((q, j) => qac(j, q || ''));
    const ac = acq.reduce((s, q, j) => s + q * [100, 150, 250, 300, 400][j], 0);
    let outros = 0; if (rnd() < 0.4) { const kw = ri(10, 200), q = ri(1, 3); setv(w, 'oNome', 'P'); setv(w, 'oKwh', kw); setv(w, 'oQtd', q); $(w, 'oAdd').click(); outros = kw * q; }
    let ger = 0; if (rnd() < 0.4) { ger = ri(10, 300); chk(w, 'gPossui', true); setv(w, 'gKwh', ger); }
    const soc = rnd() < 0.4; chk(w, 'social', soc);
    const m = arr.reduce((a, b) => a + b, 0) / arr.length, c = Math.max(0, m + ac + outros + ger - (soc ? 200 : 0)), min = TAB[d][ti];
    const got = num(txt(w, 'considerada')), st = status(w);
    if (!(Math.abs(got - c) < 0.011 && st === (c >= min ? 'ok' : 'no'))) { erros++; if (!amostra) amostra = `${d}/${TIPOS[ti]} meses=${arr} ac=${ac} outros=${outros} ger=${ger} social=${soc} esperado ${c.toFixed(2)} obtido ${got} ${st}`; }
  }
  ok(erros === 0, 'propriedade (150 casos aleatórios): média considerada e veredito', erros + ' divergências. ' + amostra);
  w.close();
}

/* ======================= D) ALERTAS, PARÂMETROS, SEGURANÇA ======================= */
async function consumo2() {
  section('D) Consumo: alertas, parâmetros (arquivo + ajustes locais), persistência e segurança');
  let w = await open('consumo.html');
  ok(!$(w, 'lim') && !$(w, 'alerta') && !!$(w, 'alertBox') && w.document.querySelectorAll('[id^=alert],#limiar').length === 3, 'alerta de variação unificado (uma caixa e um campo de limite)');
  base(w); meses(w, [100, 100, 100, 100, 300]);
  ok(!$(w, 'alertBox').hidden && $(w, 'alertList').querySelectorAll('input').length === 1, 'alerta: 1 mês fora do padrão (300 vs média 140)');
  ok(w.document.querySelectorAll('.mes')[4].classList.contains('out'), 'mês fora do padrão destacado');
  const caixa = w.document.querySelector('#alertList input'); caixa.checked = true; caixa.dispatchEvent(new w.Event('change', { bubbles: true }));
  ok(num(txt(w, 'media')) === 100 && /1 desconsiderado/.test(txt(w, 'qtd')), 'desconsiderar mês recalcula a média (100) e informa', txt(w, 'qtd') + ' / ' + txt(w, 'media'));
  meses(w, [100, 100, 100, 100, 110]); ok($(w, 'alertBox').hidden, 'ao corrigir o valor o alerta some e a exclusão é limpa'); ok(num(txt(w, 'media')) === 102 && txt(w, 'qtd') === '5', 'exclusão não persiste quando o mês deixa de ser outlier', txt(w, 'media'));
  meses(w, [100, 100]); ok($(w, 'alertBox').hidden, 'alerta exige ao menos 3 meses');
  meses(w, [0, 0, 0, 0]); ok($(w, 'alertBox').hidden && !/NaN/.test(txt(w, 'media')), 'média 0 não gera alerta nem NaN');
  meses(w, [100, 100, 100, 100, 300]); setv(w, 'limiar', 200); ok($(w, 'alertBox').hidden, 'limite de 200% não alerta'); setv(w, 'limiar', 30);
  // parâmetros vindos do arquivo
  ok(/versão 2026-10-05/.test(txt(w, 'paramInfo')) && !/ajustes locais/.test(txt(w, 'paramInfo')), 'mostra a versão vigente da tabela, sem ajustes locais');
  ok(w.document.querySelectorAll('#params tr').length === 6 && $(w, 'dist').options.length === 7, 'tabela carregada de parametros.js (6 distribuidoras)');
  ok(/Desconta 200 kWh/.test($(w, 'social').closest('label').querySelector('small').textContent), 'texto do desconto social vem do arquivo');
  // edição local
  base(w, 'CEMIG - MG', 'Monofásico'); meses(w, [150, 150, 150]); ok(status(w) === 'no', 'CEMIG mono 150 < 153: não atende');
  const inp = w.document.querySelector('#params tr[data-d="CEMIG - MG"] input[data-k="Monofásico"]'); inp.value = 140; inp.dispatchEvent(new w.Event('input', { bubbles: true }));
  ok(status(w) === 'ok' && num(txt(w, 'minimo')) === 140, 'editar mínimo muda o veredito na hora');
  ok(/ajustes locais ainda não publicados/.test(txt(w, 'paramInfo')), 'aviso de ajustes locais não publicados');
  inp.value = ''; inp.dispatchEvent(new w.Event('input', { bubbles: true })); ok(num(txt(w, 'minimo')) === 140, 'valor vazio na tabela não corrompe o mínimo');
  const salvo = JSON.parse(w.localStorage.getItem(KP)); ok(salvo.versao === PARAM.versao && salvo.params['CEMIG - MG']['Monofásico'] === 140, 'ajuste salvo no navegador junto com a versão da tabela');
  const k0 = w.document.querySelector('.ack'); k0.value = 120; k0.dispatchEvent(new w.Event('input', { bubbles: true })); ok(JSON.parse(w.localStorage.getItem(KA)).acs[0].kwh === 120, 'consumo extra do AC salvo com a versão');
  // exportar
  w.URL.createObjectURL = b => { w.__blob = b; return 'blob:teste'; }; w.HTMLAnchorElement.prototype.click = function () { w.__baixou = this.download; };
  $(w, 'exportar').click(); const conteudo = await new Promise(r => { const fr = new w.FileReader(); fr.onload = () => r(fr.result); fr.readAsText(w.__blob); });
  const o = {}; new Function('window', conteudo)(o); const E = o.PARAMETROS;
  ok(w.__baixou === 'parametros.js' && E.distribuidoras['CEMIG - MG']['Monofásico'] === 140 && E.acs[0].kwh === 120 && E.descontoSocial === 200, 'exportar gera parametros.js válido com os ajustes');
  ok(E.versao !== PARAM.versao && /^\d{2}\/\d{2}\/\d{4}$/.test(E.atualizadoEm), 'exportar gera nova versão e data', E.versao);
  // cadastro e remoção
  setv(w, 'nNome', 'CELESC - SC'); setv(w, 'nMono', 100); setv(w, 'nBi', 120); setv(w, 'nTri', 160); $(w, 'add').click();
  ok([...$(w, 'dist').options].some(o => o.value === 'CELESC - SC'), 'nova distribuidora aparece na lista'); setv(w, 'dist', 'CELESC - SC'); setv(w, 'tipo', 'Trifásico'); ok(num(txt(w, 'minimo')) === 160, 'nova distribuidora funciona (mínimo 160)');
  const a = w.__alerts || 0; setv(w, 'nNome', ''); $(w, 'add').click(); ok((w.__alerts || 0) === a + 1, 'cadastro sem nome é recusado');
  w.document.querySelector('#params tr[data-d="CELESC - SC"] [data-del]').click(); ok(![...$(w, 'dist').options].some(o => o.value === 'CELESC - SC') && $(w, 'dist').value === '', 'remover distribuidora selecionada limpa a seleção'); ok(/FALTA CONFIGURAR/.test(txt(w, 'status')), 'sem distribuidora volta a "falta configurar"');
  $(w, 'restaurar').click(); ok(w.eval('PARAMS["CEMIG - MG"]["Monofásico"]') === 153 && w.document.querySelector('.ack').value === '100', 'restaurar volta à tabela vigente (parâmetros e consumo dos AC)');
  ok(!/ajustes locais/.test(txt(w, 'paramInfo')) && !w.localStorage.getItem(KA), 'após restaurar não há ajustes locais'); w.close();
  // persistência entre aberturas
  w = await open('consumo.html', { beforeParse(x) { x.localStorage.setItem(KP, JSON.stringify({ versao: PARAM.versao, params: { 'XPTO - ZZ': { 'Monofásico': 111, 'Bifásico': 222, 'Trifásico': 333 } } })); } });
  ok([...$(w, 'dist').options].some(o => o.value === 'XPTO - ZZ') && /ajustes locais/.test(txt(w, 'paramInfo')), 'ajustes locais da mesma versão são carregados'); w.close();
  // tabela atualizada no repositório: rascunho antigo é descartado com aviso
  w = await open('consumo.html', { beforeParse(x) { x.localStorage.setItem(KP, JSON.stringify({ versao: 'antiga', params: { 'XPTO - ZZ': { 'Monofásico': 1, 'Bifásico': 2, 'Trifásico': 3 } } })); x.localStorage.setItem(KA, JSON.stringify({ versao: 'antiga', acs: PARAM.acs })); } });
  ok(![...$(w, 'dist').options].some(o => o.value === 'XPTO - ZZ') && /descartados/.test(txt(w, 'paramInfo')) && !w.localStorage.getItem(KP), 'versão nova da tabela descarta ajustes locais antigos e avisa'); w.close();
  w = await open('consumo.html', { beforeParse(x) { x.localStorage.setItem('validador-lead-params-v1', JSON.stringify({ 'XPTO - ZZ': { 'Monofásico': 1, 'Bifásico': 2, 'Trifásico': 3 } })); } });
  ok(!w.__errors.length && /descartados/.test(txt(w, 'paramInfo')) && $(w, 'dist').options.length === 7, 'formato legado (v1) é descartado com aviso'); w.close();
  // tabela publicada diferente (simula uma nova versão no repositório)
  const novo = "window.PARAMETROS=" + JSON.stringify({ ...PARAM, versao: '2099-01-01', atualizadoEm: '01/01/2099', descontoSocial: 300, acs: PARAM.acs.map((x, i) => i === 0 ? { ...x, kwh: 111 } : x), distribuidoras: { ...PARAM.distribuidoras, 'COPEL - PR': { 'Monofásico': 1, 'Bifásico': 2, 'Trifásico': 3 } } }) + ";";
  w = await open('consumo.html', { over: { 'parametros.js': novo } });
  ok(/versão 2099-01-01/.test(txt(w, 'paramInfo')) && w.eval('PARAMS["COPEL - PR"]["Bifásico"]') === 2, 'nova versão do arquivo é usada pelo simulador');
  ok(w.document.querySelector('.ack').value === '111', 'consumo extra do AC vem do arquivo'); ok(/Desconta 300 kWh/.test($(w, 'social').closest('label').querySelector('small').textContent), 'desconto social configurável pelo arquivo (texto)');
  base(w); meses(w, [500, 500, 500]); chk(w, 'social', true); ok(num(txt(w, 'considerada')) === 200, 'desconto social configurável pelo arquivo (cálculo: 500 - 300)', txt(w, 'considerada')); w.close();
  // arquivo de parâmetros ausente
  w = await open('consumo.html', { over: { 'parametros.js': '' } });
  ok(!w.__errors.length && /não foi carregado/.test(txt(w, 'paramInfo')), 'sem parametros.js: avisa e não quebra', w.__errors.join('|')); w.close();
  // dados corrompidos
  w = await open('consumo.html', { beforeParse(x) { x.localStorage.setItem(KP, '{quebrado'); x.localStorage.setItem(KA, '{quebrado'); } });
  ok(!w.__errors.length && $(w, 'dist').options.length === 7, 'JSON inválido no armazenamento: usa os padrões e não quebra', w.__errors.join('|')); w.close();
  w = await open('consumo.html', { beforeParse(x) { x.localStorage.setItem(KA, JSON.stringify({ versao: PARAM.versao, acs: [1, null] })); } });
  ok(!w.__errors.length && w.document.querySelectorAll('.acq').length === 5, 'AC salvo com formato errado não derruba a página', w.__errors.join('|')); w.close();
  w = await open('consumo.html', { beforeParse(x) { x.localStorage.setItem(KP, JSON.stringify({ versao: PARAM.versao, params: { 'A - B': {} } })); } });
  base(w, 'A - B', 'Bifásico'); meses(w, [300, 300, 300]); ok(!/NaN|undefined/.test(txt(w, 'considerada') + txt(w, 'minimo') + txt(w, 'dif')), 'parâmetro incompleto no armazenamento não gera NaN'); w.close();
  w = await open('consumo.html', { beforeParse(x) { Object.defineProperty(x, 'localStorage', { get() { throw new Error('SecurityError'); } }); } });
  ok(!w.__errors.length, 'sem acesso ao localStorage a página funciona', w.__errors.join('|')); w.close();
  // XSS
  w = await open('consumo.html');
  setv(w, 'oNome', '<img src=x onerror="window.__xss=1">'); setv(w, 'oKwh', 5); $(w, 'oAdd').click();
  setv(w, 'nNome', '"><img src=x onerror="window.__xss=2">'); setv(w, 'nMono', 1); setv(w, 'nBi', 1); setv(w, 'nTri', 1); $(w, 'add').click();
  await sleep(50); ok(!w.__xss && !w.document.querySelector('img'), 'nomes digitados não executam HTML (XSS)'); ok([...$(w, 'dist').options].some(o => o.value === '"><img src=x onerror="window.__xss=2">'), 'nome com aspas/HTML é tratado como texto');
  w.close();
}

/* ======================= E) LEITURA DE FATURA ======================= */
async function fatura() {
  section('E) Leitura de fatura (texto e posição no PDF)');
  const w = await open('consumo.html'); const an = t => w.analisarFatura(t);
  const lista = r => r.meses.map(x => x.rot + ':' + x.v).join(' ');
  let r = an('ENERGISA MATO GROSSO\nLIGAÇÃO: BIFASICO\nConsumo em kWh kWh 345,00 0,95 327,75\nHISTÓRICO DE CONSUMO\nAGO/26 345 30\nJUL/26 320 31\nJUN/26 300 30\nMAI/26 280 31');
  ok(r.dist === 'ENERGISA - MT' && r.tipo === 'Bifásico', 'Energisa: distribuidora e tipo'); ok(lista(r) === 'AGO/26:345 JUL/26:320 JUN/26:300 MAI/26:280' && r.atual === 345, 'Energisa: histórico em ordem decrescente e consumo atual', lista(r));
  const copel = 'Copel Distribuição S.A.\nB3 Comercial Serv Combinados AdmTrifasico /50A\n09/12/2025 09/01/2026 31 07/02/2026\n01/2026 27/01/2026 R$161,22\n12/2025 27/12/2025 R$240,97\nHISTÓRICO DE CONSUMO / kWh\nCONSUMO FATURADO Nº DIAS FAT.\nJAN26\n\nDEZ25\n\nNOV25\n\nOUT25\n\nSET25\n\nAGO25\n\nJUL25\n\nJUN25\n\nMAI25\n\nABR25\n\nMAR25\n\nFEV25\n\nJAN25\n\n161\n\n223\n\n115\n\n145\n\n70\n\n53\n\n53\n\n66\n\n81\n\n275\n\n342\n\n229\n\n104\n\n31\n\n32\n\n30\n\n30\n\n32\n\n30\n\n27\n\n30\n\n31\n\n31\n\n31\n\n31\n\n30\n';
  r = an(copel); ok(r.dist === 'COPEL - PR' && r.tipo === 'Trifásico', 'Copel: "AdmTrifasico" reconhecido como trifásico', r.tipo);
  ok(lista(r) === 'JAN/26:161 DEZ/25:223 NOV/25:115 OUT/25:145 SET/25:70 AGO/25:53 JUL/25:53 JUN/25:66 MAI/25:81 ABR/25:275 MAR/25:342 FEV/25:229', 'Copel: histórico em blocos (rótulos + valores) com 12 meses', lista(r));
  ok(!r.meses.some(m => m.v === 27), 'datas de vencimento não viram consumo');
  r = an('LIGAÇÃO: MONOFASICO\nSET/26 1.234 30\nAGO/26 999,5 31'); ok(r.tipo === 'Monofásico' && r.meses[0].v === 1234, 'milhar com ponto (1.234 = 1234)', lista(r));
  r = an('texto sem nada de energia'); ok(r.dist === null && r.tipo === null && r.meses.length === 0, 'texto irrelevante: nada identificado');
  const mm = Array.from({ length: 14 }, (_, i) => ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'][i % 12] + '/' + (25 + Math.floor(i / 12)) + ' ' + (100 + i)).join('\n');
  r = an('CEMIG\n' + mm); ok(r.meses.length === 12 && r.meses[0].rot === 'FEV/26', 'mais de 12 meses: usa os 12 mais recentes', lista(r));
  r = an('CPFL\nHistórico\n08/2026 345 30\n07/2026 320 31\n06/2026 300 30'); ok(r.dist === 'CPFL Paulista - SP' && lista(r) === 'AGO/26:345 JUL/26:320 JUN/26:300', 'formato MM/AAAA', lista(r));
  r = an('ELEKTRO ENERGIA INJETADA kWh 250,5 SALDO ATUAL DE CREDITOS 800 kWh TARIFA SOCIAL'); ok(r.inj === 250.5 && r.saldo === 800 && r.social, 'injeção, saldo e tarifa social detectados', JSON.stringify([r.inj, r.saldo, r.social]));
  r = an('EQUATORIAL GOIAS Energia elétrica kWh 0,5 x'); ok(r.dist === 'EQUATORIAL - GO', 'Equatorial identificada');
  // aplicar na tela
  base(w); w.aplicarFatura('ENERGISA\nBIFASICO\nAGO/26 345 30\nJUL/26 320 31\nJUN/26 300 30\nENERGIA INJETADA 100 kWh\nSALDO 800 kWh\nTARIFA SOCIAL');
  ok($(w, 'dist').value === 'ENERGISA - MT' && $(w, 'tipo').value === 'Bifásico' && $(w, 'm1').value === '345' && $(w, 'm3').value === '300' && $(w, 'm4').value === '', 'aplicar: campos preenchidos e restantes limpos');
  ok(w.document.querySelector('label[for=m1]').textContent === 'Mês 01 (AGO/26)', 'aplicar: rótulo mostra o mês de referência');
  ok($(w, 'gPossui').checked && $(w, 'gKwh').value === '100' && $(w, 'gSaldo').value === '800', 'aplicar: geração e carteira preenchidas');
  ok(!$(w, 'social').checked && /tarifa social/i.test(txt(w, 'impStatus')), 'aplicar: tarifa social só avisa, não marca');
  setv(w, 'impTexto', 'ENERGISA\nAGO/26 500 30\nJUL/26 400 31\nJUN/26 300 30'); $(w, 'reanalisar').click(); ok($(w, 'm1').value === '500', 'botão Reanalisar aplica o texto colado');
  const antes = $(w, 'm1').value; setv(w, 'impTexto', 'ENERGISA sem histórico'); $(w, 'reanalisar').click(); warn(antes === '' || $(w, 'm1').value === antes, 'Reanalisar com texto sem histórico apaga os meses já digitados');
  // geometria
  const it = (s, x, y) => ({ str: s, transform: [1, 0, 0, 1, x, y] });
  const MS = ['SET/25', 'OUT/25', 'NOV/25', 'DEZ/25', 'JAN/26', 'FEV/26', 'MAR/26', 'ABR/26', 'MAI/26', 'JUN/26', 'JUL/26', 'AGO/26', 'SET/26'], V = [434, 431, 483, 414, 435, 437, 347, 495, 366, 329, 313, 514, 472], DD = [29, 30, 33, 28, 31, 32, 29, 30, 31, 30, 30, 32, 30];
  const items = [it('SET/26', 100, 700), it('12', 300, 700)]; MS.forEach((m, i) => { const y = 400 - i * 17; items.push(it(m, 620, y), it(String(V[i]), 855, y + [4, -3, 0, 3, -4][i % 5]), it(String(DD[i]), 945, y + (i % 2 ? 2 : -2))); }); items.push(it('Média', 620, 170), it('421', 855, 172));
  r = an(w.historicoGeometrico(items).join('\n') + '\nENERGISA'); ok(r.meses.length === 12 && lista(r) === 'SET/26:472 AGO/26:514 JUL/26:313 JUN/26:329 MAI/26:366 ABR/26:495 MAR/26:347 FEV/26:437 JAN/26:435 DEZ/25:414 NOV/25:483 OUT/25:431', 'posição no PDF: gráfico com valores deslocados (13 meses -> 12)', lista(r));
  const it2 = []; ['JAN26', 'DEZ25', 'NOV25', 'OUT25'].forEach((m, i) => it2.push(it(m, 50, 500 - i * 20), it(String([161, 223, 115, 145][i]), 200, 500 - i * 20 + 2), it('31', 260, 500 - i * 20)));
  ok(w.historicoGeometrico(it2).join('|') === 'HISTORICO JAN26 161|HISTORICO DEZ25 223|HISTORICO NOV25 115|HISTORICO OUT25 145', 'posição no PDF: rótulos sem barra (JAN26)');
  ok(w.historicoGeometrico([it('JAN26', 1, 1), it('10', 100, 1)]).length === 0, 'posição no PDF: poucos rótulos não geram falso positivo');
  w.close();
}

/* ======================= H) FATURAS REAIS (fixtures anonimizadas) ======================= */
async function faturasReais() {
  section('H) Faturas reais (fixtures anonimizadas: PDFs com texto, escaneado e transcrições de fotos)');
  const dir = path.join(__dirname, 'fixtures'); const w = await open('consumo.html');
  const itensDe = pgs => pgs.map(a => a.map(([str, x, y, wd]) => ({ str, transform: [1, 0, 0, 1, x, y], width: wd })));
  const par = r => JSON.stringify(r.meses.map(m => [m.rot, m.v]));
  for (const f of fs.readdirSync(dir).filter(n => n.endsWith('.json')).sort()) {
    const fx = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')), e = fx.esperado, id = f.replace('.json', '');
    const texto = fx.paginas ? w.textoDeItens(itensDe(fx.paginas)) : fx.texto, r = w.analisarFatura(texto);
    ok(r.dist === e.distribuidora, id + ': distribuidora ' + e.distribuidora, r.dist);
    ok((r.tipo || null) === e.tipo, id + ': tipo ' + e.tipo, r.tipo);
    ok(!!r.social === !!e.social, id + ': tarifa social ' + (e.social ? 'detectada' : 'não detectada'));
    ok((r.atual == null ? null : r.atual) === e.atual, id + ': consumo atual ' + e.atual, r.atual);
    ok(par(r) === JSON.stringify(e.meses), id + ': histórico (' + e.meses.length + ' meses, Mês 01 = mais recente)', par(r));
    ok(!!r.grupoA === !!e.grupoA, id + ': grupo A (alta tensão) ' + (e.grupoA ? 'detectado' : 'não'));
    if (e.avisoContem) ok(new RegExp(e.avisoContem, 'i').test(r.aviso || ''), id + ': aviso "' + e.avisoContem + '"', r.aviso);
    // aplicação na tela e resultado final
    base(w); w.aplicarFatura(texto);
    ok(!$(w, 'social').checked, id + ': tarifa social só avisa (não marca sozinha)');
    if (e.meses.length) {
      ok($(w, 'm1').value === String(e.meses[0][1]) && w.document.querySelector('label[for=m1]').textContent === 'Mês 01 (' + e.meses[0][0] + ')', id + ': Mês 01 e rótulo na tela');
      ok(e.meses.every((m, i) => $(w, 'm' + (i + 1)).value === String(m[1])) && (e.meses.length >= 12 || $(w, 'm' + (e.meses.length + 1)).value === ''), id + ': todos os meses preenchidos e o restante vazio');
      const media = e.meses.reduce((a, m) => a + m[1], 0) / e.meses.length; ok(Math.abs(num(txt(w, 'considerada')) - media) < 0.011, id + ': média considerada ' + media.toFixed(2), txt(w, 'considerada'));
      if (e.distribuidora && e.tipo) { const min = TAB[e.distribuidora][TIPOS.indexOf(e.tipo)]; ok(status(w) === (media >= min ? 'ok' : 'no') && num(txt(w, 'minimo')) === min, id + ': veredito contra o mínimo ' + min); }
    } else ok($(w, 'm1').value === '' && /histórico não encontrado/.test(txt(w, 'impStatus')), id + ': sem histórico: campos vazios e aviso na tela');
  }
  // fluxo completo do botão de PDF (pdf.js simulado com os itens reais anonimizados)
  const stub = (x, pgs) => { x.pdfjsLib = { GlobalWorkerOptions: {}, getDocument: () => ({ promise: Promise.resolve({ numPages: pgs.length, getPage: async n => ({ getTextContent: async () => ({ items: pgs[n - 1] }) }) }) }) }; };
  const enviar = async x => { const i = $(x, 'fatura'); Object.defineProperty(i, 'files', { value: [{ arrayBuffer: async () => new ArrayBuffer(1) }], configurable: true }); i.dispatchEvent(new x.Event('change', { bubbles: true })); await sleep(200); };
  const fxPdf = JSON.parse(fs.readFileSync(path.join(dir, 'copel-baixa-renda-mono.json'), 'utf8'));
  base(w); stub(w, itensDe(fxPdf.paginas)); await enviar(w);
  ok($(w, 'dist').value === 'COPEL - PR' && $(w, 'tipo').value === 'Monofásico' && $(w, 'm1').value === '332' && $(w, 'm12').value === '343', 'botão de PDF: lê a Copel baixa renda de ponta a ponta');
  ok(/tarifa social/i.test(txt(w, 'impStatus')) && !$(w, 'social').checked, 'botão de PDF: avisa da tarifa social sem marcar');
  base(w); stub(w, [[], []]); await enviar(w); ok(/Não encontrei texto no PDF/.test(txt(w, 'impStatus')) && $(w, 'm1').value === '', 'PDF escaneado (CPFL): mensagem clara e nada é preenchido');
  base(w); delete w.pdfjsLib; await enviar(w); ok(/Não consegui ler a fatura/.test(txt(w, 'impStatus')), 'biblioteca de PDF indisponível: mensagem de erro');
  w.close();
}
/* ======================= I) TEMA CLARO/ESCURO ======================= */
async function tema() {
  section('I) Tema claro/escuro');
  const T = w => w.document.documentElement.getAttribute('data-tema');
  const mm = escuro => x => { x.matchMedia = q => ({ matches: escuro && /dark/.test(q), media: q, addEventListener() {}, removeEventListener() {} }); };
  let w = await open('index.html'); ok(T(w) === 'claro', 'sem preferência do sistema: tema claro'); w.close();
  w = await open('index.html', { beforeParse: mm(true) }); ok(T(w) === 'escuro' && $(w, 'tema').checked, 'sistema em modo escuro: tema escuro e chave ligada'); w.close();
  w = await open('index.html', { beforeParse(x) { mm(true)(x); x.localStorage.setItem('simuladores-tema', 'claro'); } }); ok(T(w) === 'claro', 'escolha salva vence a preferência do sistema'); w.close();
  w = await open('index.html', { beforeParse(x) { mm(true)(x); x.localStorage.setItem('simuladores-tema', 'xyz'); } }); ok(T(w) === 'escuro', 'valor salvo inválido é ignorado'); w.close();
  w = await open('index.html', { beforeParse(x) { Object.defineProperty(x, 'localStorage', { get() { throw new Error('SecurityError'); } }); } }); ok(!w.__errors.length && T(w) === 'claro', 'sem localStorage o tema funciona', w.__errors.join('|')); w.close();
  w = await open('index.html', { beforeParse: mm(false) });
  const b = $(w, 'tema');
  ok(b.type === 'checkbox' && b.getAttribute('role') === 'switch' && !b.checked && /tema escuro/i.test(b.getAttribute('aria-label')), 'tema é uma chave (switch) acessível, desligada no tema claro');
  ok(/Claro/.test(w.document.querySelector('.lado-claro').textContent) && /Escuro/.test(w.document.querySelector('.lado-escuro').textContent), 'chave mostra as opções Claro e Escuro');
  b.click(); ok(T(w) === 'escuro' && b.checked, 'ligar a chave muda para o tema escuro');
  ok(w.localStorage.getItem('simuladores-tema') === 'escuro', 'a escolha é salva no navegador');
  b.click(); ok(T(w) === 'claro', 'desligar a chave volta ao tema claro'); b.click();
  w.document.querySelector('#nav a[data-k=consumo]').click(); await sleep(900); const f = $(w, 'frame').contentWindow;
  ok(T(f) === 'escuro', 'simulador aberto recebe o tema escuro do menu', T(f));
  b.click(); await sleep(250); ok(T(f) === 'claro', 'alternar no menu muda o tema do simulador aberto');
  w.document.querySelector('#nav a[data-k=proposta]').click(); await sleep(900); ok(T($(w, 'frame').contentWindow) === 'claro', 'a aba de proposta também segue o tema'); w.close();
  for (const pg of ['index', 'indicacao', 'consumo', 'proposta']) {
    const h = fs.readFileSync(path.join(ROOT, pg + '.html'), 'utf8'), c = fs.readFileSync(path.join(ROOT, 'css', pg + '.css'), 'utf8');
    ok(/css\/tema\.css/.test(h) && /js\/tema\.js/.test(h), pg + ': usa tema.css e tema.js'); ok(!/--bg\s*:/.test(c), pg + ': o css da página não redefine a paleta (vem de tema.css)');
  }
  const tc = fs.readFileSync(path.join(ROOT, 'css/tema.css'), 'utf8'), vars = t => [...t.matchAll(/(--[a-z]+):/g)].map(m => m[1]).sort().join(',');
  const partes = tc.split(':root[data-tema="escuro"]'); ok(partes.length === 2 && vars(partes[0]) === vars(partes[1]) && vars(partes[0]).split(',').length >= 14, 'tema.css: claro e escuro definem exatamente as mesmas variáveis (' + vars(partes[0]).split(',').length + ')');
}

/* ======================= J) PROPOSTA DE OFERTA ======================= */
async function proposta() {
  section('J) Proposta de oferta (formulário, prévia, PDF e JPG)');
  const w = await open('proposta.html'); ok(!w.__errors.length, 'carrega sem erros', w.__errors.join('|'));
  const v = id => txt(w, id), d0 = new Date(), hojeISO = d0.getFullYear() + '-' + String(d0.getMonth() + 1).padStart(2, '0') + '-' + String(d0.getDate()).padStart(2, '0');
  ok($(w, 'pData').value === hojeISO, 'data da proposta começa com a data de hoje');
  ok($(w, 'pObs').value.startsWith('Sim, você receberá duas faturas') && $(w, 'pCargo').value === 'Consultora AXS Energia' && v('vB1') === '🌱 Energia Sustentável' && v('vB3') === '🔒 Sem fidelidade', 'textos padrão do modelo AXS');
  ok(v('vCliente') === '' && v('vConsumo') === '' && v('vMensalidade') === '' && v('vEconomia') === '', 'valores em branco ficam vazios na prévia');
  ok($(w, 'imgLogo').src.startsWith('data:image/png') && $(w, 'imgBanner').src.startsWith('data:image/jpeg'), 'logo e banner da AXS embutidos');
  setv(w, 'pConsultor', '  Maria Souza '); setv(w, 'pCliente', 'João Silva'); setv(w, 'pUC', '123-4'); setv(w, 'pConsumo', 450); setv(w, 'pMensalidade', 389.9); setv(w, 'pEconomia', 1250); setv(w, 'pData', '2026-10-05');
  ok(v('vConsultor') === 'Maria Souza' && v('vAssinatura') === 'Maria Souza', 'consultor na prévia e na assinatura (sem espaços sobrando)');
  ok(v('vCliente') === 'João Silva' && v('vUC') === '123-4' && v('vData') === '05/10/2026', 'cliente, UC e data (dd/mm/aaaa)');
  ok(v('vConsumo') === '450 kWh/mês' && /R\$\s?389,90/.test(v('vMensalidade')) && /R\$\s?1\.250,00/.test(v('vEconomia')), 'formatação de kWh e reais', v('vMensalidade') + ' | ' + v('vEconomia'));
  setv(w, 'pConsumo', -5); setv(w, 'pMensalidade', 'abc'); ok(v('vConsumo') === '' && v('vMensalidade') === '', 'valor negativo ou inválido não aparece');
  setv(w, 'pConsumo', 1234.5); ok(v('vConsumo') === '1.234,5 kWh/mês', 'consumo com milhar e decimal', v('vConsumo'));
  setv(w, 'pObs', 'Linha 1\n\nLinha 2'); ok($(w, 'vObs').textContent === 'Linha 1\n\nLinha 2', 'observação mantém as quebras de linha');
  setv(w, 'pB2', ''); ok(v('vB2') === '' && v('vB1') !== '', 'benefício em branco fica vazio (e é ocultado pelo css)');
  const rapida = n => { $(w, 'pValidadeRapida').value = n; $(w, 'pValidadeRapida').dispatchEvent(new w.Event('change', { bubbles: true })); };
  rapida('15'); ok($(w, 'pValidade').value === '20/10/2026' && v('vValidade') === '20/10/2026', 'validade rápida: 15 dias após 05/10/2026');
  setv(w, 'pData', '2026-12-25'); rapida('7'); ok($(w, 'pValidade').value === '01/01/2027', 'validade rápida atravessa o fim do ano');
  $(w, 'limpar').click();
  ok($(w, 'pCliente').value === '' && $(w, 'pConsumo').value === '' && $(w, 'pValidade').value === '' && $(w, 'pUC').value === '' && v('vCliente') === '', 'limpar zera cliente, UC, validade e valores');
  ok($(w, 'pConsultor').value.trim() === 'Maria Souza' && $(w, 'pObs').value.startsWith('Sim, você') && $(w, 'pData').value === hojeISO && v('vB2') === '✅ Sem taxa de adesão', 'limpar mantém o consultor e restaura textos, benefícios e data de hoje');
  ok(JSON.parse(w.localStorage.getItem('simuladores-proposta-consultor')).nome === 'Maria Souza', 'consultor fica salvo neste navegador');
  const capt = []; w.html2canvas = async (el, o) => { capt.push({ o, largura: el.style.width, id: el.id }); return { width: 2000, height: 3000, toDataURL: (t, q) => 'data:' + t + ';base64,AAA' + (q || '') }; };
  const pdfs = []; w.jspdf = { jsPDF: class { constructor(o) { this.o = o; this.calls = []; pdfs.push(this); } addImage(...a) { this.calls.push(a); } save(n) { this.nome = n; } } };
  const baixados = []; w.HTMLAnchorElement.prototype.click = function () { baixados.push({ nome: this.download, href: this.href }); };
  setv(w, 'pCliente', 'João da Silva & Cia Ltda.'); setv(w, 'pConsumo', 300);
  $(w, 'pdf').click(); await sleep(150);
  ok(pdfs.length === 1 && pdfs[0].nome === 'proposta_axs_joao-da-silva-cia-ltda.pdf', 'PDF: nome do arquivo com o cliente (sem acentos/símbolos)', pdfs[0] && pdfs[0].nome);
  ok(pdfs[0].o.format[0] === 210 && Math.abs(pdfs[0].o.format[1] - 315) < 0.01 && pdfs[0].calls[0][1] === 'JPEG', 'PDF: largura A4 (210 mm), altura proporcional ao conteúdo e imagem JPEG (arquivo leve)');
  ok(capt[0].largura === '1000px' && capt[0].id === '' && capt[0].o.scale === 2, 'exportação usa cópia da folha com 1000px, sem ids repetidos, escala 2');
  ok(!w.document.querySelector('.palco-export') && !$(w, 'pdf').disabled, 'cópia temporária removida e botões liberados');
  $(w, 'jpg').click(); await sleep(150);
  ok(baixados.length === 1 && baixados[0].nome === 'proposta_axs_joao-da-silva-cia-ltda.jpg' && /^data:image\/jpeg/.test(baixados[0].href), 'JPG: nome do arquivo e dados da imagem'); ok(/JPG gerado/.test(txt(w, 'msg')), 'mensagem de sucesso');
  setv(w, 'pCliente', ''); $(w, 'jpg').click(); await sleep(150); ok(baixados[1].nome === 'proposta_axs.jpg', 'sem cliente: nome padrão proposta_axs');
  w.html2canvas = async () => { throw new Error('falhou'); }; $(w, 'pdf').click(); await sleep(150); ok(/Não foi possível gerar/.test(txt(w, 'msg')) && !$(w, 'pdf').disabled, 'falha na geração: mensagem e botões liberados');
  delete w.html2canvas; $(w, 'jpg').click(); await sleep(150); ok(/não carregada/.test(txt(w, 'msg')), 'biblioteca ausente: mensagem clara');
  w.close();
  // aviso ao menu (contagem de propostas)
  const h = await open('index.html', { hash: '#proposta' }); const msgs = []; h.postMessage = m => msgs.push(m); await sleep(800);
  const c = $(h, 'frame').contentWindow; c.html2canvas = async () => ({ width: 10, height: 10, toDataURL: () => 'data:image/png;base64,AA' }); c.jspdf = { jsPDF: class { addImage() {} save() {} } };
  c.document.getElementById('pdf').click(); await sleep(250); ok(msgs.some(m => m.tipo === 'proposta' && m.formato === 'pdf'), 'proposta gerada dentro do menu avisa o menu'); h.close();
  const solo = await open('proposta.html'); const m2 = []; solo.postMessage = m => m2.push(m); solo.html2canvas = async () => ({ width: 10, height: 10, toDataURL: () => 'data:image/png;base64,AA' }); solo.jspdf = { jsPDF: class { addImage() {} save() {} } };
  solo.document.getElementById('pdf').click(); await sleep(250); ok(!m2.length, 'fora do menu nenhuma mensagem é enviada'); solo.close();
  const css = fs.readFileSync(path.join(ROOT, 'css/proposta.css'), 'utf8'), ms = css.match(/\.px-signature-name\{[^}]*min-height:(\d+)px/);
  ok(!!ms && +ms[1] >= 48, 'assinatura: espaço reservado de pelo menos 48 px para o nome do consultor', ms ? ms[1] + 'px' : 'sem regra');
  const sg = (await open('proposta.html')); const ass = sg.document.querySelector('.px-signature'); ok([...ass.children].map(e => e.id || 'texto').join() === 'texto,vAssinatura,vCargo' && sg.document.getElementById('vAssinatura').textContent === '', 'assinatura: "Atenciosamente", espaço do nome (vazio) e cargo, nessa ordem'); sg.close();
  const base = path.join(ROOT, 'js/proposta-imagens.js'), im = fs.readFileSync(base, 'utf8'); ok(/logo: "data:image\/png;base64,/.test(im) && /banner: "data:image\/jpeg;base64,/.test(im) && fs.statSync(base).size < 600000, 'imagens embutidas e leves (banner em JPEG)');
}

/* ======================= K) LAYOUT (imagem de referência) ======================= */
async function layoutConsumo() {
  section('K) Layout: 3 colunas do simulador de consumo e padrão das demais telas');
  const w = await open('consumo.html'), d = w.document;
  ok([...d.querySelectorAll('.layout > section')].map(x => x.className).join() === 'col-a,col-b,col-c', 'três colunas: col-a, col-b e col-c');
  const tit = c => [...d.querySelectorAll('.' + c + ' > .card')].map(x => x.querySelector('summary,h2').textContent.replace(/\s+/g, ' ').trim());
  ok(tit('col-a').map(t => t.slice(0, 12)).join('|') === 'Importar fat|Ar-condicion|Outros produ|Cliente poss', 'coluna 1: importar fatura, ar-condicionado, outros produtos e geração/injeção', tit('col-a').join('|'));
  ok(tit('col-b')[0] === 'Dados do lead' && !!d.querySelector('.col-b #months') && !!d.querySelector('.col-b #limpar') && !!d.querySelector('.col-b #dist'), 'coluna 2: dados do lead (distribuidora, tipo, meses e botão limpar)');
  ok(tit('col-c')[0] === 'Resultado' && /Parâmetros de atendimento/.test(tit('col-c')[1]) && !!d.querySelector('.col-c #status') && !!d.querySelector('.col-c #limiar'), 'coluna 3: resultado (com o limite de alerta) e parâmetros');
  const aberto = c => [...d.querySelectorAll('.' + c + ' > .card > details')].map(x => x.open ? 1 : 0).join('');
  ok(aberto('col-a') === '1001' && aberto('col-c') === '0', 'abertura inicial como na imagem: importar e geração abertos; AC, produtos e parâmetros recolhidos', aberto('col-a') + '/' + aberto('col-c'));
  ok(!!d.querySelector('header h1') && /Validador de lead/.test(d.querySelector('header h1').textContent) && !!d.querySelector('.hint'), 'faixa de título e texto de apoio no topo');
  const css = fs.readFileSync(path.join(ROOT, 'css/consumo.css'), 'utf8');
  ok(/repeat\(3,minmax\(0,370px\)\)/.test(css) && /max-width:1400px/.test(css) && /justify-content:space-between/.test(css), 'css: grade de 3 colunas de 370px em container de até 1400px');
  ok(/@media\(max-width:1180px\)/.test(css) && /@media\(max-width:720px\)/.test(css), 'css: 2 colunas em telas médias e 1 coluna no celular');
  const ci = fs.readFileSync(path.join(ROOT, 'css/index.css'), 'utf8'); ok(/grid-template-columns:1fr auto 1fr/.test(ci) && /\.nav-links\{display:flex;gap:4px;justify-content:center\}/.test(ci), 'menu: links centralizados, tema e versão à direita');
  for (const pg of ['indicacao', 'proposta']) { const x = await open(pg + '.html'); ok(!!x.document.querySelector('header h1') && !!x.document.querySelector('.hint'), pg + ': faixa de título e texto de apoio como nas demais telas'); x.close(); }
  w.close();
}

/* ======================= F) MENU/HUB, ESTATÍSTICAS E RASTREIO ======================= */
async function hub() {
  section('F) Menu, navegação, estatísticas e contagem');
  let w = await open('index.html'); ok(!w.__errors.length, 'menu carrega sem erros', w.__errors.join('|'));
  const est = () => [...w.document.querySelectorAll('#nav a')].map(a => a.dataset.k + (a.classList.contains('ativo') ? '*' : '')).join(' ');
  const clica = async k => { w.document.querySelector('#nav a[data-k=' + k + ']').click(); await sleep(60); };
  ok(est() === 'inicio* indicacao consumo proposta' && !$(w, 'menu').classList.contains('oculto'), 'início: página principal ativa');
  ok([...w.document.querySelectorAll('#nav a')].map(a => a.textContent).join('|') === 'Página principal|Simulação de indicação|Simulação de consumo de energia|Proposta de oferta', 'barra: os 4 itens (início, indicação, consumo e proposta)');
  const VV = {}; new Function('window', fs.readFileSync(path.join(ROOT, 'versao.js'), 'utf8'))(VV);
  ok(txt(w, 'versaoNav') === 'v' + VV.VERSAO.numero && txt(w, 'versao').includes('Versão ' + VV.VERSAO.numero), 'versão exibida na barra e no rodapé do menu', txt(w, 'versaoNav') + ' / ' + txt(w, 'versao'));
  await clica('indicacao'); ok(est() === 'inicio indicacao* consumo proposta' && $(w, 'frame').getAttribute('src') === 'indicacao.html' && $(w, 'menu').classList.contains('oculto'), 'ir para indicação');
  await clica('consumo'); ok(est() === 'inicio indicacao consumo* proposta' && $(w, 'frame').getAttribute('src') === 'consumo.html', 'ir para consumo');
  await clica('inicio'); ok(est() === 'inicio* indicacao consumo proposta' && !$(w, 'frame').hasAttribute('src'), 'voltar à página principal libera o iframe');
  w.document.querySelector('.opt[data-k=consumo]').click(); await sleep(60); ok(est() === 'inicio indicacao consumo* proposta', 'cartão do menu abre o simulador');
  w.history.back(); await sleep(120); ok(est() === 'inicio* indicacao consumo proposta', 'botão voltar do navegador funciona', est());
  ok(w.document.querySelector('#nav a.ativo').getAttribute('aria-current') === 'page', 'item ativo tem aria-current'); w.close();
  w = await open('index.html', { hash: '#consumo' }); ok(est() === 'inicio indicacao consumo* proposta', 'link direto #consumo abre o simulador'); w.close();
  w = await open('index.html', { hash: '#qualquercoisa' }); ok(est() === 'inicio* indicacao consumo proposta', 'hash inválido cai na página principal'); w.close();
  w = await open('index.html'); ok($(w, 'stats').hidden, 'sem código GoatCounter o painel de uso fica oculto'); ok(!w.document.querySelector('script[src*="goatcounter"]'), 'sem código GoatCounter nenhum script externo é carregado'); w.close();
  // com GoatCounter configurado (rede simulada)
  const calls = [];
  const mock = u => Promise.resolve({ ok: !String(u).includes('falha'), json: () => Promise.resolve(String(u).includes('worker.test') ? [{ name: 'Brasil', count: 50 }, { name: '<b>X</b>', count: 7 }, { name: 'C', count: 6 }, { name: 'D', count: 5 }, { name: 'E', count: 4 }, { name: 'F', count: 3 }] : String(u).includes('proposta-gerada') ? { count: '12' } : String(u).includes('simulacao-indicacao') ? { count: '1,234' } : String(u).includes('simulacao-consumo') ? { count: '66' } : { count: '9,999' }) });
  w = await open('index.html', { over: { 'config.js': "window.CONFIG={goatcounter:'teste',locationsUrl:'https://worker.test/top'};" }, beforeParse(x) { x.fetch = mock; } });
  ok(!!w.document.querySelector('script[src*="gc.zgo.at"]') && w.document.querySelector('script[src*="gc.zgo.at"]').getAttribute('data-goatcounter') === 'https://teste.goatcounter.com/count', 'script do GoatCounter com a URL correta');
  await sleep(1900); ok(!$(w, 'stats').hidden, 'painel de uso visível'); ok(num(txt(w, 'kAcessos')) === 9999, 'acessos exibidos (9.999)', txt(w, 'kAcessos')); ok(num(txt(w, 'kSims')) === 1300 && /1\.234/.test(txt(w, 'kSimsDet')), 'simulações = indicação + consumo (1.234 + 66)', txt(w, 'kSims') + ' ' + txt(w, 'kSimsDet'));
  ok(num(txt(w, 'kProps')) === 12, 'propostas geradas exibidas (12)', txt(w, 'kProps'));
  const li = [...w.document.querySelectorAll('#top5 li')]; ok(li.length === 5 && /Brasil/.test(li[0].textContent), 'Top 5 localidades limitado a 5 itens'); ok(!w.document.querySelector('#top5 b b') && !/<b>/.test(li[1] ? li[1].innerHTML.replace(/<span>.*?<\/span>|<b>[^<]*<\/b>/g, '') : ''), 'nome de localidade é escapado (sem HTML injetado)');
  w.goatcounter = { count: o => calls.push(o) }; const fr = $(w, 'frame').contentWindow || w;
  w.dispatchEvent(new w.MessageEvent('message', { data: { tipo: 'simulacao', ferramenta: 'indicacao' }, source: w })); await sleep(30); ok(calls.length === 0, 'mensagem que não vem do iframe é ignorada');
  w.document.querySelector('.opt[data-k=indicacao]').click(); await sleep(400); const src = $(w, 'frame').contentWindow;
  w.dispatchEvent(new w.MessageEvent('message', { data: { tipo: 'simulacao', ferramenta: 'indicacao' }, source: src })); await sleep(700);
  ok(calls.length === 1 && calls[0].path === '/simulacao-indicacao' && calls[0].event === true, 'mensagem do iframe registra evento /simulacao-indicacao', JSON.stringify(calls));
  w.dispatchEvent(new w.MessageEvent('message', { data: { tipo: 'simulacao', ferramenta: 'inexistente' }, source: src })); await sleep(700); ok(calls.length === 1, 'ferramenta desconhecida é ignorada');
  w.dispatchEvent(new w.MessageEvent('message', { data: { tipo: 'proposta', formato: 'pdf' }, source: src })); await sleep(700); ok(calls.length === 2 && calls[1].path === '/proposta-gerada' && calls[1].event === true, 'proposta gerada registra evento /proposta-gerada', JSON.stringify(calls[1]));
  w.close();
  // não contar as próprias visitas
  w = await open('index.html', { query: '?contar=nao', over: { 'config.js': "window.CONFIG={goatcounter:'teste'};" }, beforeParse(x) { x.fetch = mock; } });
  ok(w.localStorage.getItem('skipgc') === 't', '?contar=nao liga a opção de não contar visitas'); await sleep(1900); ok(/não estão sendo contadas/.test(txt(w, 'stats')), 'painel avisa que as visitas deste navegador não são contadas'); w.close();
  w = await open('index.html', { query: '?contar=sim', beforeParse(x) { x.localStorage.setItem('skipgc', 't'); } }); ok(w.localStorage.getItem('skipgc') === null, '?contar=sim volta a contar'); w.close();
  // falha do contador não quebra o menu
  w = await open('index.html', { over: { 'config.js': "window.CONFIG={goatcounter:'falha',locationsUrl:'https://worker.test/falha'};" }, beforeParse(x) { x.fetch = mock; } });
  await sleep(1900); ok(!w.__errors.length && txt(w, 'kAcessos') === '-', 'falha na rede: mostra "-" sem erro de script', w.__errors.join('|') + txt(w, 'kAcessos')); ok(/Não foi possível/.test(txt(w, 'top5')), 'falha no Top 5: mensagem amigável'); w.close();
}

async function rastreio() {
  section('G) Contagem de simulações (rastreio.js dentro do menu)');
  const w = await open('index.html'); const msgs = []; w.postMessage = (m) => { if (m && m.tipo === 'simulacao') msgs.push(m); };   // ignora os pedidos de tema que o simulador também envia
  w.document.querySelector('.opt[data-k=indicacao]').click(); await sleep(500); let c = $(w, 'frame').contentWindow;
  const sv = (id, v) => { const e = c.document.getElementById(id); e.value = v; e.dispatchEvent(new c.Event('input', { bubbles: true })); };
  sv('fInd', 100); sv('fInv', 300); await sleep(4400); ok(msgs.length === 1 && msgs[0].ferramenta === 'indicacao' && msgs[0].tipo === 'simulacao', 'indicação: resultado estável por 4s conta 1 simulação', JSON.stringify(msgs));
  await sleep(4400); ok(msgs.length === 1, 'indicação: mesmo resultado não conta de novo');
  sv('fInv', 301); sv('fInv', 305); await sleep(4400); ok(msgs.length === 2, 'indicação: digitar várias vezes seguidas conta 1 só quando estabiliza', String(msgs.length));
  sv('fInv', ''); await sleep(4400); ok(msgs.length === 2, 'indicação: resultado inválido não conta');
  w.document.querySelector('#nav a[data-k=consumo]').click(); await sleep(600); c = $(w, 'frame').contentWindow;
  const ch = (id, v) => { const e = c.document.getElementById(id); e.value = v; e.dispatchEvent(new c.Event('input', { bubbles: true })); };
  ch('m1', 300); await sleep(4400); ok(msgs.length === 2, 'consumo: "falta configurar" não conta');
  ch('dist', 'ENERGISA - MT'); ch('tipo', 'Bifásico'); await sleep(4400); ok(msgs.length === 3 && msgs[2].ferramenta === 'consumo', 'consumo: veredito válido conta 1 simulação', JSON.stringify(msgs.slice(2)));
  w.close();
  const solo = await open('indicacao.html'); solo.postMessage = () => { solo.__enviou = true; }; solo.document.getElementById('fInd').value = 100; solo.document.getElementById('fInd').dispatchEvent(new solo.Event('input', { bubbles: true })); await sleep(300); ok(!solo.__enviou, 'página aberta sozinha (fora do menu) não envia mensagens'); solo.close();
}

(async () => {
  const t0 = Date.now();
  for (const f of [estatico, indicacao, consumo, consumo2, fatura, faturasReais, tema, proposta, layoutConsumo, hub, rastreio]) { try { await f(); } catch (e) { fail++; fails.push('ERRO NA SUÍTE ' + f.name + ': ' + (e.stack || e).toString().split('\n').slice(0, 3).join(' | ')); } }
  console.log('\n' + '='.repeat(60) + `\nAprovados: ${pass}   Reprovados: ${fail}   Avisos: ${warns.length}   (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  if (fails.length) { console.log('\nFALHAS:'); fails.forEach(f => console.log(' x ' + f)); }
  if (warns.length) { console.log('\nAVISOS:'); [...new Set(warns)].forEach(f => console.log(' ! ' + f)); }
  process.exit(fail ? 1 : 0);
})();
