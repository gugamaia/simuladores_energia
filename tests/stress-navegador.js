/* Estresse em navegador real (Chromium): consistência da proposta, dados extremos, varredura de layout, acessibilidade (axe),
   desempenho, memória e teclado. Uso: CHROME_PATH=... AXE=/caminho/axe.min.js node stress-navegador.js
   Etapas (variável STRESS_ONLY): p1 consistência | p2 dados extremos | p3 layout | p4 axe | p5 desempenho | p6 rotas/memória | p7 teclado */
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { chromium } = require('playwright-core');
const ROOT = path.resolve(__dirname, '..'), TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' };
const ACHADOS = []; const achado = (sev, area, texto, ex) => ACHADOS.push({ sev, area, texto, ex });
const md5 = b => crypto.createHash('md5').update(b).digest('hex'), sleep = ms => new Promise(r => setTimeout(r, ms));
const so = (process.env.STRESS_ONLY || 'p1,p2,p3,p4,p5,p6,p7').split(',');
const servidor = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0].split('#')[0]).replace(/^\/$/, '/index.html'));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
});
const secao = n => console.log('\n== ' + n);
const dims = buf => { let i = 2; while (i < buf.length) { if (buf[i] !== 0xff) break; const m = buf[i + 1], len = buf.readUInt16BE(i + 2); if (m >= 0xc0 && m <= 0xc3) return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)]; i += 2 + len; } return [0, 0]; };
async function baixar(p, sel) { const [d] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.click(sel)]); const f = '/tmp/_dl_' + Math.random().toString(36).slice(2); await d.saveAs(f); const buf = fs.readFileSync(f); fs.unlinkSync(f); return { nome: d.suggestedFilename(), buf }; }
function infoPdf(buf) {
  const s = buf.toString('latin1'), mb = s.match(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/), paginas = (s.match(/\/Type\s*\/Page(?!s)/g) || []).length;
  const k = s.indexOf('/DCTDecode'), a = k < 0 ? -1 : s.indexOf('stream', k), z = a < 0 ? -1 : s.indexOf('endstream', a); let img = '';
  if (a >= 0 && z > a) { let ini = a + 6; if (s[ini] === '\r') ini++; if (s[ini] === '\n') ini++; img = md5(buf.slice(ini, z)); }
  return { paginas, media: mb ? [+mb[3], +mb[4]] : null, img, bytes: buf.length };
}
const BASE = { pConsultor: 'Maria Souza', pCliente: 'João da Silva Ltda', pUC: '1234567-8', pConsumo: '450', pMensalidade: '389.9', pEconomia: '1250', pData: '2026-10-08', pValidade: '23/10/2026' };
async function preencher(p, d) { for (const [id, v] of Object.entries(d)) await p.fill('#' + id, v); await p.waitForTimeout(150); }
const sobras = p => p.evaluate(() => { const o = []; document.querySelectorAll('#capture .px-value,#capture .px-card-value,#capture .px-obs,#capture .px-signature-name,#capture .px-benefit,#capture .px-card-title').forEach(e => { if (e.scrollWidth > e.clientWidth + 1) o.push((e.id || e.className) + ' ' + e.scrollWidth + '>' + e.clientWidth); }); return o; });

async function p1(b, base) {
  secao('P1) Proposta: consistência da geração (repetição, tema, aparelho, fuso, simultaneidade, memória)');
  const mk = async (opc = {}) => { const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true, colorScheme: 'light', ...opc }); const p = await ctx.newPage(); p.on('pageerror', e => achado('ALTA', 'Proposta', 'erro de script: ' + e.message)); return { ctx, p }; };
  let { ctx, p } = await mk(); await p.goto(base + 'proposta.html'); await p.waitForTimeout(1200); await p.click('summary:has-text("Textos")'); await preencher(p, BASE);
  const jpgs = [], pdfs = [], tempos = [];
  for (let i = 0; i < 10; i++) { let t = Date.now(); const j = await baixar(p, '#jpg'); tempos.push(Date.now() - t); jpgs.push(md5(j.buf)); await p.waitForTimeout(300); const d = await baixar(p, '#pdf'); pdfs.push(infoPdf(d.buf)); await p.waitForTimeout(300); }
  const base_jpg = jpgs[0], dim0 = dims((await baixar(p, '#jpg')).buf);
  console.log(`   10 JPG idênticos: ${new Set(jpgs).size === 1} (${dim0.join('x')}) | 10 PDF: páginas ${[...new Set(pdfs.map(x => x.paginas))]} mediabox ${JSON.stringify([...new Set(pdfs.map(x => JSON.stringify(x.media)))])} imagem idêntica: ${new Set(pdfs.map(x => x.img)).size === 1} tamanho ${Math.round(pdfs[0].bytes / 1024)} KB | tempo JPG médio ${Math.round(tempos.reduce((a, c) => a + c, 0) / tempos.length)} ms`);
  if (new Set(jpgs).size !== 1) achado('ALTA', 'Proposta', 'o mesmo JPG gerado 10 vezes sai diferente (não determinístico)');
  if (new Set(pdfs.map(x => x.img)).size !== 1) achado('ALTA', 'Proposta', 'a imagem dentro do PDF muda entre gerações iguais');
  if (pdfs.some(x => x.paginas !== 1)) achado('MÉDIA', 'Proposta', 'PDF com mais de uma página', JSON.stringify(pdfs.map(x => x.paginas)));
  const mediabox = pdfs[0].media; console.log('   PDF: página de ' + (mediabox ? (mediabox[0] / 72 * 25.4).toFixed(1) + ' x ' + (mediabox[1] / 72 * 25.4).toFixed(1) + ' mm' : '?') + ' (A4 tem 210 x 297 mm de largura x altura; a página aqui acompanha o conteúdo)');
  achado('INFO', 'Proposta', 'o PDF não é A4: a página tem 210 mm de largura e ' + (mediabox ? (mediabox[1] / 72 * 25.4).toFixed(0) : '?') + ' mm de altura (uma folha longa). Para imprimir em A4 seria preciso paginar.');
  await ctx.close();
  // tema escuro, aparelhos, DPR
  for (const [nome, opc] of [['tema escuro', { colorScheme: 'dark' }], ['iPhone 390x844 DPR 3', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }], ['monitor 1920x1080 DPR 1', { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 }], ['320x568 DPR 2', { viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
    ({ ctx, p } = await mk(opc)); await p.goto(base + 'proposta.html'); await p.waitForTimeout(1200); await preencher(p, BASE); const j = await baixar(p, '#jpg'); const ok = md5(j.buf) === base_jpg;
    console.log(`   ${nome.padEnd(26)} JPG ${dims(j.buf).join('x')} idêntico ao de referência: ${ok}`); if (!ok) achado(dims(j.buf).join() === dim0.join() ? 'MÉDIA' : 'ALTA', 'Proposta', `JPG gerado em "${nome}" difere do gerado no desktop claro` + (dims(j.buf).join() !== dim0.join() ? ' (tamanho diferente)' : ' (mesmo tamanho, pixels diferentes)')); await ctx.close();
  }
  // file://
  ({ ctx, p } = await mk()); await p.goto('file://' + ROOT + '/proposta.html'); await p.waitForTimeout(1500); await preencher(p, BASE);
  try { const j = await baixar(p, '#jpg'); const ok = md5(j.buf) === base_jpg; console.log(`   aberto direto do computador (file://): JPG ${dims(j.buf).join('x')} idêntico: ${ok}`); if (!ok) achado('BAIXA', 'Proposta', 'aberto via file:// o JPG sai diferente (fonte Montserrat pode não carregar)'); } catch (e) { achado('ALTA', 'Proposta', 'não gera JPG quando o arquivo é aberto direto do computador (file://)', e.message); }
  await ctx.close();
  // fusos e datas
  for (const tz of ['Pacific/Kiritimati', 'America/Sao_Paulo', 'Pacific/Pago_Pago', 'America/New_York']) {
    ({ ctx, p } = await mk({ timezoneId: tz })); await p.goto(base + 'proposta.html'); await p.waitForTimeout(600); const v = await p.inputValue('#pData'), esp = await p.evaluate(z => new Date().toLocaleDateString('en-CA', { timeZone: z }), tz);
    console.log(`   fuso ${tz.padEnd(20)} data padrão ${v} (esperado ${esp})`); if (v !== esp) achado('MÉDIA', 'Proposta', `data padrão errada no fuso ${tz}`, v + ' x ' + esp); await ctx.close();
  }
  ({ ctx, p } = await mk()); await p.goto(base + 'proposta.html'); await p.waitForTimeout(600);
  for (const [dt, dias, esp] of [['2028-02-22', '7', '29/02/2028'], ['2027-02-22', '7', '01/03/2027'], ['2026-12-25', '15', '09/01/2027'], ['2026-03-14', '30', '13/04/2026'], ['2026-11-02', '30', '02/12/2026']]) { await p.fill('#pData', dt); await p.selectOption('#pValidadeRapida', dias); const v = await p.inputValue('#pValidade'); if (v !== esp) achado('MÉDIA', 'Proposta', `validade rápida errada: ${dt} + ${dias} dias`, v + ' x ' + esp); }
  console.log('   validade rápida: 5 datas de borda (ano bissexto, virada de ano, mês) conferidas');
  // cliques simultâneos de verdade (no mesmo instante, sem a espera do Playwright por botão habilitado)
  await p.click('summary:has-text("Textos")'); await preencher(p, BASE); let baixas = 0; p.on('download', () => baixas++);
  await p.evaluate(() => { const j = document.getElementById('jpg'), d = document.getElementById('pdf'); j.click(); j.click(); d.click(); j.click(); }); await p.waitForTimeout(6000);
  console.log(`   4 cliques simultâneos (JPG, JPG, PDF, JPG): ${baixas} arquivo(s) gerado(s)`); if (baixas > 1) achado('BAIXA', 'Proposta', `cliques simultâneos geraram ${baixas} arquivos (esperado 1: os botões travam durante a geração)`); if (baixas === 0) achado('ALTA', 'Proposta', 'cliques simultâneos não geraram arquivo nenhum');
  await ctx.close();
  // memória após muitas gerações
  const bm = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox', '--enable-precise-memory-info', '--js-flags=--expose-gc'] });
  const cm = await bm.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true }); const pm = await cm.newPage(); await pm.goto(base + 'proposta.html'); await pm.waitForTimeout(1200); await preencher(pm, BASE);
  const cdp = await cm.newCDPSession(pm); const heap = async () => { await cdp.send('HeapProfiler.collectGarbage'); return Math.round((await cdp.send('Runtime.getHeapUsage')).usedSize / 1e6); }; const h0 = await heap();
  for (let i = 0; i < 30; i++) { await baixar(pm, i % 2 ? '#pdf' : '#jpg'); await pm.waitForTimeout(150); } const h1 = await heap(); const nodes = await pm.evaluate(() => document.getElementsByTagName('*').length), canv = await pm.evaluate(() => document.getElementsByTagName('canvas').length);
  console.log(`   memória JS: ${h0} MB -> ${h1} MB após 30 gerações | elementos no DOM: ${nodes} | canvas restantes: ${canv}`); if (h1 - h0 > 25) achado('MÉDIA', 'Proposta', `memória cresce ${h1 - h0} MB após 30 gerações (possível vazamento)`); if (canv > 0) achado('MÉDIA', 'Proposta', 'canvas temporários ficam no DOM após gerar');
  await bm.close();
}

async function p2(b, base) {
  secao('P2) Proposta: dados extremos (estouro de layout, tamanho do arquivo, tempo)');
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true }); const p = await ctx.newPage(); await p.goto(base + 'proposta.html'); await p.waitForTimeout(1200); await p.click('summary:has-text("Textos")');
  const L = (n, c = 'a') => c.repeat(n), cenarios = {
    'tudo em branco': { pConsultor: '', pCliente: '', pUC: '', pConsumo: '', pMensalidade: '', pEconomia: '', pValidade: '' },
    'cliente 200 caracteres com espaços': { pCliente: ('Empresa Exemplo de Energia Solar ').repeat(7).slice(0, 200) }, 'cliente 120 letras sem espaço': { pCliente: L(120) },
    'acentos, emoji e aspas': { pCliente: 'JOSÉ "ZÉ" D\'ÁVILA 🌞⚡ & Cia <Ltda>', pConsultor: 'Ana Çelik 👩‍💼' }, 'tentativa de HTML': { pCliente: '<img src=x onerror=alert(1)><b>negrito</b>', pConsultor: '<script>alert(1)</script>' },
    'valores gigantes (1e12)': { pConsumo: '1000000000000', pMensalidade: '1000000000000', pEconomia: '1000000000000' }, 'valores minúsculos (0,004)': { pConsumo: '0.004', pMensalidade: '0.004', pEconomia: '0.004' },
    'valores negativos': { pConsumo: '-10', pMensalidade: '-5', pEconomia: '-1' }, 'UC com 100 caracteres': { pUC: L(100, '9') }, 'consultor com 300 caracteres': { pConsultor: L(300, 'M') },
    'observação com 8.000 caracteres': { pObs: ('Texto longo da observação da proposta. ').repeat(220) }, 'benefício com 200 caracteres': { pB1: L(200, 'x'), pB2: ('Benefício muito longo ').repeat(10) },
  };
  for (const [nome, d] of Object.entries(cenarios)) {
    await p.evaluate(() => document.getElementById('limpar').click()); await preencher(p, { pConsultor: 'Maria Souza', ...d }); const so = await sobras(p), t = Date.now(); let tam = '?', dur = 0;
    try { const j = await baixar(p, '#jpg'); dur = Date.now() - t; const [w, h] = dims(j.buf); tam = `${w}x${h} (${Math.round(j.buf.length / 1024)} KB)`; } catch (e) { achado('ALTA', 'Proposta', `não gerou JPG no cenário "${nome}"`, e.message); }
    const xss = await p.evaluate(() => !!document.querySelector('#capture img[src="x"],#capture script,#capture b'));
    console.log(`   ${nome.padEnd(36)} JPG ${tam.padEnd(22)} ${String(dur).padStart(5)} ms | estouros: ${so.length ? so.join('; ') : 'nenhum'}${xss ? ' | HTML INJETADO' : ''}`);
    if (so.length) achado(/valores gigantes|minúsculos/.test(nome) ? 'MÉDIA' : 'MÉDIA', 'Proposta', `layout estoura no cenário "${nome}"`, so.join('; ')); if (xss) achado('ALTA', 'Segurança', `HTML injetado na proposta no cenário "${nome}"`); if (dur > 8000) achado('MÉDIA', 'Proposta', `geração lenta (${dur} ms) no cenário "${nome}"`);
  }
  // nomes de arquivo
  for (const c of ['', '日本語の会社', '🔥🔥🔥', 'CON', 'a'.repeat(300), '../../etc/passwd', 'Cliente: A/B\\C*?"<>|']) { await p.evaluate(() => document.getElementById('limpar').click()); await p.fill('#pCliente', c); const j = await baixar(p, '#jpg'); const n = j.nome; if (/[\\/:*?"<>|]/.test(n) || n.length > 80 || /^\./.test(n)) achado('MÉDIA', 'Proposta', `nome de arquivo ruim para o cliente "${c.slice(0, 20)}"`, n); }
  console.log('   nomes de arquivo: 7 clientes estranhos (CJK, emoji, caminhos, símbolos) conferidos'); await ctx.close();
}

async function varrer(b, base, tema) {
  const LARG = [280, 320, 360, 375, 390, 412, 430, 480, 540, 600, 720, 768, 820, 900, 1024, 1100, 1180, 1200, 1260, 1280, 1366, 1440, 1600, 1920, 2560]; const falhas = [];
  for (const rota of ['inicio', 'indicacao', 'consumo', 'proposta']) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: tema }); const p = await ctx.newPage(); await p.goto(base + 'index.html#' + rota); await p.waitForTimeout(1500); const f = () => p.frames().find(x => x !== p.mainFrame());
    if (rota === 'consumo') { const fr = p.frameLocator('#frame'); await fr.locator('#dist').selectOption('COPEL - PR'); await fr.locator('#tipo').selectOption('Trifásico'); for (let i = 1; i <= 12; i++) await fr.locator('#m' + i).fill(String(300 + i * 11)); await fr.locator('#oNome').evaluate(e => { e.closest('details').open = true; e.value = 'Chuveiro elétrico de 7500 W com nome bem comprido para testar'; }); await fr.locator('#oKwh').fill('90'); await fr.locator('#oAdd').click(); for (const d of await fr.locator('details').all()) await d.evaluate(e => { e.open = true; }); }
    if (rota === 'proposta') { const fr = p.frameLocator('#frame'); await fr.locator('#pCliente').fill('Empresa Exemplo de Energia Solar e Serviços Ltda'); await fr.locator('#pConsumo').fill('1250'); for (const d of await fr.locator('details').all()) await d.evaluate(e => { e.open = true; }); }
    for (const w of LARG) {
      await p.setViewportSize({ width: w, height: 900 }); await p.waitForTimeout(450);
      const medir = () => { const W = window.innerWidth, out = []; document.querySelectorAll('body *').forEach(e => { if (e.closest('.scroll,.prev-wrap,.palco-export,[hidden]') || e.tagName === 'SCRIPT' || e.tagName === 'STYLE') return; const r = e.getBoundingClientRect(); if (r.width === 0 || r.height === 0) return; const cs = getComputedStyle(e); if (cs.position === 'fixed' && r.bottom < 0) return; if (r.right > W + 1 || r.left < -1) out.push((e.tagName + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : '')) + ' [' + Math.round(r.left) + ',' + Math.round(r.right) + ']'); }); return { sw: document.documentElement.scrollWidth, W, off: out.slice(0, 4) }; };
      const hub = await p.evaluate(medir), fr = f() ? await f().evaluate(medir) : null;
      const problemas = []; if (hub.sw > hub.W + 1) problemas.push('menu rola na horizontal (' + hub.sw + ')'); if (fr && fr.sw > fr.W + 1) problemas.push('simulador rola na horizontal (' + fr.sw + '>' + fr.W + ')'); if (hub.off.length) problemas.push('menu: ' + hub.off.join(', ')); if (fr && fr.off.length) problemas.push('tela: ' + fr.off.join(', '));
      if (problemas.length) falhas.push({ rota, w, tema, problemas });
    }
    await ctx.close();
  }
  return falhas;
}
async function p3(b, base) {
  const tema = process.env.TEMA || 'light'; secao('P3) Layout: varredura de 22 larguras (280 a 2560 px) x 4 telas, tema ' + tema + ' (dados preenchidos e cartões abertos)');
  const falhas = await varrer(b, base, tema); const por = {}; falhas.forEach(f => { const k = f.rota + ' | ' + f.problemas.join(' / '); (por[k] = por[k] || []).push(f.w); });
  Object.entries(por).forEach(([k, ws]) => console.log(`   ${k}  -> larguras: ${ws.join(', ')}`)); if (!falhas.length) console.log('   nenhum problema em nenhuma largura');
  Object.entries(por).forEach(([k, ws]) => achado(/rola na horizontal/.test(k) ? 'ALTA' : 'MÉDIA', 'Layout', `${k} (larguras ${ws.join(', ')} px, tema ${tema})`));
  // texto grande (acessibilidade): fonte 200% em 390 px
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); const p = await ctx.newPage(); const res = [];
  for (const pg of ['indicacao.html', 'consumo.html', 'proposta.html']) { await p.goto(base + pg); await p.waitForTimeout(700); await p.addStyleTag({ content: 'html{font-size:200% !important}' }); await p.waitForTimeout(400); const sw = await p.evaluate(() => document.documentElement.scrollWidth); res.push(`${pg} ${sw}px`); if (sw > 392) achado('MÉDIA', 'Layout', `com texto ampliado em 200% (acessibilidade) ${pg} rola na horizontal em 390 px`, sw + 'px'); }
  console.log('   texto 200% em 390 px: ' + res.join(' | ')); await ctx.close();
}

async function p4(b, base) {
  secao('P4) Acessibilidade (axe-core, WCAG 2.1 AA) nas 4 telas, tema claro e escuro');
  const axe = process.env.AXE || '/tmp/ax/node_modules/axe-core/axe.min.js'; const vistos = {};
  for (const tema of ['light', 'dark']) for (const pg of ['index.html', 'indicacao.html', 'consumo.html', 'proposta.html']) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: tema }); const p = await ctx.newPage(); await p.goto(base + pg + (pg === 'index.html' ? '#inicio' : '')); await p.waitForTimeout(1200);
    if (pg === 'consumo.html') { await p.selectOption('#dist', 'ENERGISA - MT'); await p.selectOption('#tipo', 'Bifásico'); for (let i = 1; i <= 4; i++) await p.fill('#m' + i, '500'); for (const d of await p.locator('details').all()) await d.evaluate(e => { e.open = true; }); }
    if (pg === 'proposta.html') for (const d of await p.locator('details').all()) await d.evaluate(e => { e.open = true; });
    await p.addScriptTag({ path: axe }); const r = await p.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] }, rules: { 'region': { enabled: false } } }));
    r.violations.forEach(v => { const k = v.id + '|' + pg; const x = vistos[k] || (vistos[k] = { id: v.id, impacto: v.impact, ajuda: v.help, pg, temas: new Set(), nos: 0, alvo: '' }); x.temas.add(tema); x.nos = Math.max(x.nos, v.nodes.length); x.alvo = x.alvo || (v.nodes[0] && (v.nodes[0].target || []).join(' ')) + ' :: ' + ((v.nodes[0] && v.nodes[0].any[0] && v.nodes[0].any[0].message) || '').slice(0, 110); });
    await ctx.close();
  }
  const lista = Object.values(vistos); lista.forEach(x => console.log(`   [${x.impacto}] ${x.pg.padEnd(14)} ${x.id.padEnd(26)} ${x.nos} elemento(s), tema(s): ${[...x.temas].join('+')}\n        ${x.ajuda} | ${x.alvo}`)); if (!lista.length) console.log('   nenhuma violação encontrada');
  lista.forEach(x => achado({ critical: 'ALTA', serious: 'ALTA', moderate: 'MÉDIA', minor: 'BAIXA' }[x.impacto] || 'BAIXA', 'Acessibilidade', `${x.pg}: ${x.ajuda} [${x.id}] em ${x.nos} elemento(s) (${[...x.temas].join('+')})`, x.alvo));
}

async function p5(b, base) {
  secao('P5) Desempenho com rede 4G lenta e CPU 4x mais lenta (carga inicial a frio)');
  const zlib = require('zlib'); const gz = f => zlib.gzipSync(fs.readFileSync(path.join(ROOT, f))).length;
  for (const [nome, url] of [['menu', 'index.html#inicio'], ['consumo (no menu)', 'index.html#consumo'], ['proposta (no menu)', 'index.html#proposta'], ['indicação (no menu)', 'index.html#indicacao']]) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
    await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 }); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await p.addInitScript(() => { window.__m = { cls: 0, lcp: 0, fcp: 0, longas: 0, maxLonga: 0 }; new PerformanceObserver(l => l.getEntries().forEach(e => { if (!e.hadRecentInput) window.__m.cls += e.value; })).observe({ type: 'layout-shift', buffered: true }); new PerformanceObserver(l => l.getEntries().forEach(e => { window.__m.lcp = e.startTime; })).observe({ type: 'largest-contentful-paint', buffered: true }); new PerformanceObserver(l => l.getEntries().forEach(e => { if (e.name === 'first-contentful-paint') window.__m.fcp = e.startTime; })).observe({ type: 'paint', buffered: true }); new PerformanceObserver(l => l.getEntries().forEach(e => { window.__m.longas++; window.__m.maxLonga = Math.max(window.__m.maxLonga, e.duration); })).observe({ type: 'longtask', buffered: true }); });
    const t = Date.now(); await p.goto(base + url, { waitUntil: 'load', timeout: 90000 }); const carga = Date.now() - t; await p.waitForTimeout(2500);
    const frames = p.frames(); let bytes = 0, reqs = 0; for (const fr of frames) { const r = await fr.evaluate(() => performance.getEntriesByType('resource').map(e => e.encodedBodySize || e.transferSize || 0)); bytes += r.reduce((a, c) => a + c, 0); reqs += r.length; }
    const m = await p.evaluate(() => window.__m); console.log(`   ${nome.padEnd(20)} carga ${String(carga).padStart(6)} ms | FCP ${Math.round(m.fcp)} ms | LCP ${Math.round(m.lcp)} ms | CLS ${m.cls.toFixed(3)} | tarefas longas ${m.longas} (máx ${Math.round(m.maxLonga)} ms) | ~${Math.round(bytes / 1024)} KB em ${reqs} requisições`);
    if (m.cls > 0.1) achado('MÉDIA', 'Desempenho', `${nome}: deslocamento de layout (CLS ${m.cls.toFixed(2)}) acima de 0,1`); if (m.lcp > 4000) achado('MÉDIA', 'Desempenho', `${nome}: LCP de ${Math.round(m.lcp)} ms em 4G lento`); if (carga > 12000) achado('MÉDIA', 'Desempenho', `${nome}: carga de ${(carga / 1000).toFixed(1)} s em 4G lento`);
    await ctx.close();
  }
  const arq = { 'pdf.min.js (consumo)': 'js/vendor/pdf.min.js', 'html2canvas (proposta)': 'js/vendor/html2canvas.min.js', 'jspdf (proposta)': 'js/vendor/jspdf.umd.min.js', 'imagens da proposta': 'js/proposta-imagens.js', 'pdf.worker (só ao ler PDF)': 'js/vendor/pdf.worker.min.js', 'consumo.js': 'js/consumo.js', 'fonte Montserrat': 'fonts/montserrat-latin-wght-normal.woff2' };
  console.log('   tamanho em disco / com gzip (como o GitHub Pages entrega): ' + Object.entries(arq).map(([n, f]) => `${n} ${Math.round(fs.statSync(path.join(ROOT, f)).size / 1024)}/${Math.round(gz(f) / 1024)} KB`).join(' | '));
  achado('INFO', 'Desempenho', 'o consumo carrega o pdf.js (320 KB) mesmo sem enviar PDF, e a proposta carrega html2canvas + jsPDF (560 KB) mesmo sem exportar: carregar sob demanda (ao clicar) reduziria a carga inicial.');
}

async function p6(b, base) {
  secao('P6) Navegação e memória: 150 trocas de aba, 2.000 mensagens de contagem');
  const bm = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox', '--enable-precise-memory-info', '--js-flags=--expose-gc'] });
  const ctx = await bm.newContext({ viewport: { width: 1280, height: 800 } }); const p = await ctx.newPage(); const erros = []; p.on('pageerror', e => erros.push(e.message)); await p.goto(base + 'index.html'); await p.waitForTimeout(1200);
  const cdp = await ctx.newCDPSession(p); const heap = async () => { await cdp.send('HeapProfiler.collectGarbage'); return Math.round((await cdp.send('Runtime.getHeapUsage')).usedSize / 1e6 * 10) / 10; }; const marcas = [await heap()]; const rotas = ['indicacao', 'consumo', 'proposta', 'inicio']; let seed = 7;
  for (let i = 1; i <= 150; i++) { seed = (seed * 1103515245 + 12345) % 2147483648; await p.evaluate(h => { location.hash = h; }, rotas[seed % 4]); await p.waitForTimeout(70); if (i % 50 === 0) { await p.waitForTimeout(500); marcas.push(await heap()); } }
  const frames = await p.evaluate(() => document.querySelectorAll('iframe').length); console.log(`   memória do menu: ${marcas.join(' -> ')} MB | iframes: ${frames} | erros de script: ${erros.length}`); if (marcas[3] - marcas[0] > 15) achado('MÉDIA', 'Navegação', `memória do menu cresce ${(marcas[3] - marcas[0]).toFixed(1)} MB após 150 trocas de aba`); if (frames !== 1) achado('ALTA', 'Navegação', `${frames} iframes após trocar de aba (esperado 1)`); if (erros.length) achado('ALTA', 'Navegação', 'erros de script ao trocar de aba rapidamente', erros[0]);
  await p.evaluate(h => { location.hash = h; }, 'consumo'); await p.waitForTimeout(1500); const t = Date.now(); const n = await p.evaluate(() => { const f = document.getElementById('frame').contentWindow; for (let i = 0; i < 2000; i++) window.dispatchEvent(new MessageEvent('message', { data: { tipo: 'altura', px: 800 + (i % 7) }, source: f })); return 2000; }); console.log(`   ${n} mensagens de altura processadas em ${Date.now() - t} ms`);
  await bm.close();
}

async function p7(b, base) {
  secao('P7) Teclado: ordem do foco, foco visível, chave de tema e cartões recolhíveis');
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage(); await p.goto(base + 'index.html#consumo'); await p.waitForTimeout(1500);
  const seq = []; for (let i = 0; i < 9; i++) { await p.keyboard.press('Tab'); const d = await p.evaluate(() => { const e = document.activeElement; const cs = getComputedStyle(e); const vis = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== 'none'); const lbl = e.closest && e.closest('label.chave'); return { t: e.tagName + (e.id ? '#' + e.id : '') + ' ' + (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 28), vis, sw: !!lbl }; }); seq.push(d); }
  console.log('   ordem do foco: ' + seq.map(s => s.t + (s.vis ? '' : ' (sem foco visível)')).join(' > '));
  seq.filter(s => !s.vis && !/IFRAME/.test(s.t)).forEach(s => achado('MÉDIA', 'Teclado', `sem indicador de foco visível: ${s.t}`));
  const antes = await p.evaluate(() => document.documentElement.getAttribute('data-tema')); await p.focus('#tema'); await p.keyboard.press('Space'); await p.waitForTimeout(200); const depois = await p.evaluate(() => document.documentElement.getAttribute('data-tema'));
  console.log(`   chave de tema pelo teclado (Espaço): ${antes} -> ${depois}`); if (antes === depois) achado('ALTA', 'Teclado', 'a chave de tema não responde ao teclado');
  const fr = p.frameLocator('#frame'); const sm = fr.locator('summary').first(); await sm.focus(); const ab0 = await fr.locator('details').first().evaluate(e => e.open); await p.keyboard.press('Enter'); await p.waitForTimeout(200); const ab1 = await fr.locator('details').first().evaluate(e => e.open);
  console.log(`   cartão recolhível pelo teclado (Enter): ${ab0} -> ${ab1}`); if (ab0 === ab1) achado('MÉDIA', 'Teclado', 'cartões recolhíveis não abrem/fecham com Enter');
  await p.goto(base + 'index.html#inicio'); await p.waitForTimeout(500); const skip = await p.evaluate(() => !!document.querySelector('a[href="#conteudo"],.pular,[class*=skip]')); console.log('   link "pular para o conteúdo": ' + (skip ? 'existe' : 'não existe')); if (!skip) achado('BAIXA', 'Teclado', 'não há link "pular para o conteúdo" (quem usa teclado precisa atravessar toda a navegação)');
  await ctx.close();
}

(async () => {
  await new Promise(r => servidor.listen(0, r)); const base = 'http://localhost:' + servidor.address().port + '/';
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
  const mapa = { p1, p2, p3, p4, p5, p6, p7 }; for (const k of so) { try { await mapa[k](b, base); } catch (e) { console.log('   ERRO na etapa ' + k + ': ' + String(e.message).split('\n')[0]); achado('ALTA', 'Estresse', 'a etapa ' + k + ' do teste quebrou', String(e.message).split('\n')[0]); } }
  await b.close(); servidor.close();
  console.log('\n' + '='.repeat(70) + '\nACHADOS (' + ACHADOS.length + ')'); ACHADOS.forEach(a => console.log(` [${a.sev}] ${a.area}: ${a.texto}${a.ex ? '\n        ex.: ' + String(a.ex).slice(0, 200) : ''}`));
  fs.writeFileSync('/tmp/achados-nav-' + so.join('') + '.json', JSON.stringify(ACHADOS, null, 1)); process.exit(0);
})();
