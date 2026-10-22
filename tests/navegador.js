/* Teste em navegador real (opcional): layout, tema e geração de PDF/JPG da proposta.
   Requer um Chromium: instale com `npx playwright-core install chromium` ou aponte CHROME_PATH para o executável.
   Uso: cd tests && npm run test:navegador */
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright-core');
const ROOT = path.resolve(__dirname, '..'), TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json' };
let pass = 0, fail = 0; const falhas = [];
const ok = (c, nome, det) => { if (c) pass++; else { fail++; falhas.push(nome + (det !== undefined ? ' -> ' + det : '')); } };
const servidor = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0].split('#')[0]).replace(/^\/$/, '/index.html'));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
});

/* Perfis de aparelho: iPhone, Samsung e um Android "médio" (mais o iPhone SE e um Android compacto, para os extremos) */
const PERFIS = [
  { nome: 'iPhone 14/15 (390x844)', w: 390, h: 844, dpr: 3, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' },
  { nome: 'Samsung Galaxy S23 (360x780)', w: 360, h: 780, dpr: 3, ua: 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36' },
  { nome: 'Android padrão, Pixel 7 (412x915)', w: 412, h: 915, dpr: 2.625, ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36' },
  { nome: 'iPhone SE (375x667)', w: 375, h: 667, dpr: 2, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1' },
  { nome: 'Android compacto (320x568)', w: 320, h: 568, dpr: 2, ua: 'Mozilla/5.0 (Linux; Android 9; Compact) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Mobile Safari/537.36' },
];
async function celulares(b, base, ok, erros) {
  for (const pf of PERFIS) {
    const ctx = await b.newContext({ viewport: { width: pf.w, height: pf.h }, deviceScaleFactor: pf.dpr, isMobile: true, hasTouch: true, userAgent: pf.ua, colorScheme: 'light' });
    const p = await ctx.newPage(); p.on('pageerror', e => erros.push(pf.nome + ': ' + e.message));
    const box = l => l.boundingBox(), tag = t => pf.nome + ': ' + t;
    await p.goto(base + 'index.html#inicio'); await p.waitForTimeout(900);
    const estouro = async () => p.evaluate(() => document.documentElement.scrollWidth);
    ok(await estouro() <= pf.w + 1, tag('menu sem rolagem horizontal'), String(await estouro()));
    const nav = await box(p.locator('.nav-links')); ok(nav && nav.y + nav.height >= pf.h - 2 && nav.height >= 48 && nav.height <= 90, tag('barra de abas fixa na base da tela'), JSON.stringify(nav && [Math.round(nav.y), Math.round(nav.height)]));
    const abas = await p.locator('.nav-links a').all(); const medidas = []; for (const a of abas) medidas.push(await box(a));
    ok(abas.length === 4 && medidas.every(m => m.width >= 60 && m.height >= 44), tag('4 abas com toque de pelo menos 44 px'), medidas.map(m => Math.round(m.width) + 'x' + Math.round(m.height)).join(' '));
    const sw = await box(p.locator('.chave')); ok(sw.height >= 40, tag('interruptor de tema com área de toque de 40 px ou mais'), String(Math.round(sw.height)));
    for (const [k, rotulo] of [['indicacao', 'indicação'], ['consumo', 'consumo'], ['proposta', 'proposta'], ['inicio', 'início']]) { await p.tap('.nav-links a[data-k=' + k + ']'); await p.waitForTimeout(500); ok((await p.locator('.nav-links a.ativo').getAttribute('data-k')) === k, tag('tocar na aba ' + rotulo + ' navega')); }
    // cada tela dentro do menu
    for (const rota of ['indicacao', 'consumo', 'proposta']) {
      await p.goto(base + 'index.html#' + rota); await p.waitForTimeout(1500); const f = p.frameLocator('#frame');
      const fb = await box(p.locator('#frame')), cb = await f.locator('body').evaluate(e => e.getBoundingClientRect().height), cw = await f.locator('html').evaluate(e => e.scrollWidth);
      ok(Math.abs(fb.height - cb) <= 2, tag(rota + ': iframe do tamanho do conteúdo (uma só rolagem)'), Math.round(fb.height) + ' x ' + Math.round(cb));
      ok(cw <= fb.width + 1 && await estouro() <= pf.w + 1, tag(rota + ': sem rolagem horizontal'), cw + ' / ' + fb.width);
      await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await p.waitForTimeout(200);
      const fim = await box(p.locator('#frame')), barra = await box(p.locator('.nav-links')); ok(fim.y + fim.height <= barra.y + 1, tag(rota + ': o fim da página não fica escondido atrás da barra'), Math.round(fim.y + fim.height) + ' x ' + Math.round(barra.y));
      await p.evaluate(() => window.scrollTo(0, 0));
      const campos = { indicacao: ['#fInd', '#fInv'], consumo: ['#dist', '#tipo', '#bandeira', '#m1'], proposta: ['#pCliente', '#pConsultor'] }[rota];
      for (const c of campos) { const fonte = await f.locator(c).evaluate(e => parseFloat(getComputedStyle(e).fontSize)); const alt = (await f.locator(rota === 'indicacao' ? '.in' : c).first().boundingBox()).height; ok(fonte >= 16, tag(rota + ' ' + c + ': fonte de ' + fonte + ' px (o iPhone não dá zoom)')); ok(alt >= 43.5, tag(rota + ' ' + c + ': altura de toque ' + Math.round(alt) + ' px')); }
      const botoes = { indicacao: ['#limpar'], consumo: ['#limpar'], proposta: ['#pdf', '#jpg', '#limpar'] }[rota];
      for (const c of botoes) { const bb = await box(f.locator(c)); ok(bb.height >= 43.5, tag(rota + ' ' + c + ': botão com ' + Math.round(bb.height) + ' px de altura')); }
      if (rota === 'consumo') { const m1 = await box(f.locator('#m1')), m2 = await box(f.locator('#m2')), a = await box(f.locator('.col-a')), bcol = await box(f.locator('.col-b')); ok(Math.abs(m1.y - m2.y) < 2 && m2.x > m1.x, tag('consumo: meses em 2 colunas')); ok(bcol.y < a.y, tag('consumo: dados do lead aparecem antes dos demais cartões')); }
      if (rota === 'proposta') { const wv = await box(f.locator('#prevWrap')), esc = await f.locator('#capture').evaluate(e => e.style.transform); ok(wv.width <= pf.w && /scale\(0\.\d+/.test(esc), tag('proposta: prévia reduzida para caber na tela (' + esc + ')')); }
    }
    await ctx.close();
  }
  // celular deitado (iPhone 14/15)
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, colorScheme: 'light' });
  const p = await ctx.newPage(); await p.goto(base + 'index.html#consumo'); await p.waitForTimeout(1300);
  const nav = await p.locator('.nav-links').boundingBox(); ok(nav.height <= 56 && nav.y + nav.height >= 388, 'iPhone deitado: barra de abas compacta (só ícones)', String(Math.round(nav.height)));
  ok(await p.evaluate(() => document.documentElement.scrollWidth) <= 845, 'iPhone deitado: sem rolagem horizontal');
  await ctx.close();
}

async function correcoesNavegador(b, base, ok, erros) {
  const caixa = l => l.boundingBox();
  // E-02: produto adicionado no consumo, em várias larguras de celular
  let ctx = await b.newContext({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true }); let p = await ctx.newPage(); p.on('pageerror', e => erros.push(e.message));
  await p.goto(base + 'index.html#consumo'); await p.waitForTimeout(1300); let f = p.frameLocator('#frame');
  for (const dt of await f.locator('details').all()) await dt.evaluate(e => { e.open = true; });   // todos os cartões abertos (o de Parâmetros era o que estourava)
  await f.locator('#oNome').fill('Chuveiro elétrico de 7500 W com nome bem comprido para testar'); await f.locator('#oKwh').fill('90'); await f.locator('#oAdd').click();
  for (const w of [280, 300, 320, 360, 390, 412, 540]) { await p.setViewportSize({ width: w, height: 800 }); await p.waitForTimeout(450); const sw = await f.locator('html').evaluate(e => e.scrollWidth), hub = await p.evaluate(() => document.documentElement.scrollWidth); ok(sw <= w + 1 && hub <= w + 1, `consumo com todos os cartões abertos e um produto em ${w} px: sem rolagem horizontal`, sw + ' / ' + hub); }
  await ctx.close();
  // E-03, E-06, E-10: barra do menu em várias larguras
  ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); p = await ctx.newPage(); await p.goto(base + 'index.html#inicio'); await p.waitForTimeout(1000);
  for (const w of [280, 320, 600, 720, 768, 820, 900, 1024, 1100, 1200, 1260, 1280, 1366, 1920]) {
    await p.setViewportSize({ width: w, height: 800 }); await p.waitForTimeout(350); const hub = await p.evaluate(() => document.documentElement.scrollWidth); const ls = await p.locator('.nav-links a').all(); let dentro = true, det = ''; for (const a of ls) { const bb = await caixa(a); if (!bb || bb.x < -1 || bb.x + bb.width > w + 1) { dentro = false; det += ' ' + Math.round(bb ? bb.x : -9) + '+' + Math.round(bb ? bb.width : 0); } }
    const ver = await caixa(p.locator('#versaoNav')), sw = await caixa(p.locator('.chave')); const dir = ver.x + ver.width <= w + 1 && sw.x >= -1;
    ok(hub <= w + 1 && dentro && dir, `menu em ${w} px: sem rolagem horizontal, 4 abas inteiras na tela, chave e versão visíveis`, `rolagem ${hub}, abas fora:${det || ' nenhuma'}`);
  }
  await ctx.close();
  // proposta em telas estreitas, com os cartões abertos
  ctx = await b.newContext({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true }); p = await ctx.newPage(); await p.goto(base + 'index.html#proposta'); await p.waitForTimeout(1300); f = p.frameLocator('#frame');
  for (const dt of await f.locator('details').all()) await dt.evaluate(e => { e.open = true; });
  for (const w of [280, 300, 320, 360, 390, 412]) { await p.setViewportSize({ width: w, height: 800 }); await p.waitForTimeout(450); const sw = await f.locator('html').evaluate(e => e.scrollWidth), hub = await p.evaluate(() => document.documentElement.scrollWidth); ok(sw <= w + 1 && hub <= w + 1, `proposta com os cartões abertos em ${w} px: sem rolagem horizontal`, sw + ' / ' + hub); }
  await ctx.close();
  // E-07: proposta com textos enormes
  ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); p = await ctx.newPage(); await p.goto(base + 'proposta.html'); await p.waitForTimeout(1200);
  await p.evaluate(() => { for (const [id, v] of [['pConsultor', 'M'.repeat(300)], ['pCliente', 'C'.repeat(120)], ['pUC', '9'.repeat(100)]]) { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); } }); await p.waitForTimeout(200);   // valor colocado por programa/colagem, ignorando o maxlength
  const sobras = await p.evaluate(() => { const o = []; document.querySelectorAll('#capture .px-value,#capture .px-card-value,#capture .px-obs,#capture .px-signature-name,#capture .px-benefit,#capture .px-card-title,#capture .px-signature').forEach(e => { if (e.scrollWidth > e.clientWidth + 1) o.push((e.id || e.className) + ' ' + e.scrollWidth + '>' + e.clientWidth); }); return o; });
  ok(sobras.length === 0, 'proposta: consultor de 300 letras, cliente de 120 e UC de 100 não estouram a folha', sobras.join('; '));
  await p.fill('#pConsultor', ''); await p.type('#pConsultor', 'N'.repeat(100)); ok((await p.inputValue('#pConsultor')).length === 60 && (await p.getAttribute('#pConsultor', 'maxlength')) === '60', 'proposta: digitando 100 letras no consultor, o campo para em 60 (limite no navegador)');
  await ctx.close();
  // E-13: link de pular para o conteúdo
  ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); p = await ctx.newPage(); await p.goto(base + 'index.html#consumo'); await p.waitForTimeout(1200); await p.keyboard.press('Tab');
  const foc = await p.evaluate(() => { const e = document.activeElement; const r = e.getBoundingClientRect(); return { pular: e.classList.contains('pular'), y: r.y, w: r.width }; });
  ok(foc.pular && foc.y >= 0 && foc.w > 80, 'menu: o primeiro Tab mostra o link "Pular para o conteúdo" dentro da tela');
  await p.keyboard.press('Enter'); await p.waitForTimeout(200); ok(await p.evaluate(() => location.hash === '#consumo' && document.activeElement.tagName === 'IFRAME'), 'menu: Enter no link leva o foco à tela aberta e mantém o endereço');
  await ctx.close();
  // E-01 e E-05 no navegador real: respondem rápido
  ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); p = await ctx.newPage(); await p.goto(base + 'indicacao.html'); await p.waitForTimeout(800);
  let t = Date.now(); await p.fill('#fInd', '0.01'); await p.fill('#fInv', '1000000'); const msg = await p.textContent('#out'); ok(/entre R\$ 1,00/.test(msg) && Date.now() - t < 3000, 'indicação no navegador: R$ 0,01 contra R$ 1 milhão responde com aviso em ' + (Date.now() - t) + ' ms (antes: aba travava)');
  t = Date.now(); await p.fill('#fInd', '1e308'); await p.fill('#fInv', '1e308'); ok(/entre R\$ 1,00/.test(await p.textContent('#out')) && Date.now() - t < 3000, 'indicação no navegador: 1e308 responde com aviso');
  await p.goto(base + 'consumo.html'); await p.waitForTimeout(800); const dur = await p.evaluate(() => { const t0 = performance.now(); analisarFatura('JAN26 '.repeat(100000)); analisarFatura('JAN' + ' '.repeat(200000) + 'x'); return performance.now() - t0; }); ok(dur < 1500, 'leitura de fatura no navegador: dois textos hostis em ' + Math.round(dur) + ' ms (antes: 100 s)');
  await ctx.close();
}

(async () => {
  await new Promise(r => servidor.listen(0, r)); const base = 'http://localhost:' + servidor.address().port + '/';
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
  const erros = [];
  const novaPagina = async (w, h, esquema) => { const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: esquema || 'dark', acceptDownloads: true }); const p = await ctx.newPage(); p.on('pageerror', e => erros.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) erros.push(m.text()); }); return p; };
  const caixa = async (loc) => loc.boundingBox();

  // 1) layout em 3 colunas (1600 px) e barra centralizada
  let p = await novaPagina(1600, 1043); await p.goto(base + 'index.html#consumo'); await p.waitForTimeout(1200);
  let f = p.frameLocator('#frame'); const A = await caixa(f.locator('.col-a')), B = await caixa(f.locator('.col-b')), C = await caixa(f.locator('.col-c'));
  ok(A.x < B.x - 300 && B.x < C.x - 300, 'consumo: três colunas lado a lado', [A.x, B.x, C.x].map(Math.round).join('/'));
  ok(A.width <= 372 && B.width <= 372 && C.width <= 372, 'consumo: colunas de até 370 px', [A.width, B.width, C.width].map(Math.round).join('/'));
  const nav = await caixa(p.locator('.nav-links')); ok(Math.abs(nav.x + nav.width / 2 - 800) < 25, 'barra: links centralizados', String(Math.round(nav.x + nav.width / 2)));
  const ver = await caixa(p.locator('#versaoNav')); ok(ver.x > 1450, 'barra: versão à direita', String(Math.round(ver.x)));
  // 1b) energia compartilhada: linhas novas no resultado
  await f.locator('#tipo').selectOption('Bifásico'); for (const [i, v] of [[1, 150], [2, 150], [3, 150]]) await f.locator('#m' + i).fill(String(v)); await p.waitForTimeout(300);
  ok(await f.locator('#compAno').isVisible() && (await f.locator('#compAno').textContent()).trim() === '1.200,00' && (await f.locator('#dispVal').textContent()).trim() === '50,00', 'consumo: energia compartilhada anual (150 - 50) x 12 = 1.200 aparece no resultado');
  ok((await f.locator('#consAno').textContent()).trim() === '1.800,00' && (await f.locator('#media').textContent()).trim() !== '', 'consumo: consumo anual estimado (1.800) sem subtração');
  // 1c) mensalidade AXS estimada (exemplo: 4 meses de 500 kWh, bifásico, Energisa MT, bandeira Verde)
  await f.locator('#dist').selectOption('ENERGISA - MT'); for (const i of [1, 2, 3, 4]) await f.locator('#m' + i).fill('500'); await p.waitForTimeout(300);
  ok((await f.locator('#presMes').textContent()).trim() === '450,00' && (await f.locator('#tarifaVal').textContent()).trim() === '0,53965' && /242,84/.test(await f.locator('#mensal').textContent()), 'consumo: mensalidade estimada (500 - 50) x 0,53965 = R$ 242,84', await f.locator('#mensal').textContent());
  await f.locator('#bandeira').selectOption('Vermelha II'); await p.waitForTimeout(200); ok(/264,11/.test(await f.locator('#mensal').textContent()), 'consumo: trocar a bandeira para Vermelha II recalcula (R$ 264,11)');
  await f.locator('#dist').selectOption('COPEL - PR'); await p.waitForTimeout(200); ok(await f.locator('#faixa').isVisible(), 'consumo: a Faixa I/II aparece para a Copel');
  await f.locator('#dist').selectOption('ENERGISA - MT'); await f.locator('#bandeira').selectOption('Verde');
  // 2) tema
  const fundo = async () => f.locator('body').evaluate(e => getComputedStyle(e).backgroundColor);
  const escuro = await fundo(); const k0 = (await caixa(p.locator('.chave-bolinha'))).x; await p.click('.chave'); await p.waitForTimeout(400); const claro = await fundo(); const k1 = (await caixa(p.locator('.chave-bolinha'))).x;
  ok(k0 - k1 > 15, 'chave de tema: a bolinha se move ao alternar', k0 + ' -> ' + k1);
  ok(escuro === 'rgb(15, 22, 28)' && claro === 'rgb(243, 245, 247)', 'tema: escuro e claro aplicados dentro do simulador', escuro + ' / ' + claro);
  ok(await p.locator('html').getAttribute('data-tema') === 'claro', 'tema: menu em modo claro');
  await p.context().close();
  // 3) celular: uma coluna, dados do lead primeiro
  p = await novaPagina(390, 800); await p.goto(base + 'consumo.html'); await p.waitForTimeout(600);
  const yb = (await caixa(p.locator('.col-b'))).y, ya = (await caixa(p.locator('.col-a'))).y, yc = (await caixa(p.locator('.col-c'))).y;
  ok(yb < yc && yc < ya, 'celular: ordem dados do lead, resultado, demais cartões', [yb, yc, ya].map(Math.round).join('/'));
  const largura = await p.evaluate(() => document.documentElement.scrollWidth); ok(largura <= 392, 'celular: sem rolagem horizontal', String(largura));
  await p.context().close();
  // 3b) indicação: botão Limpar campos
  p = await novaPagina(1600, 900); await p.goto(base + 'index.html#indicacao'); await p.waitForTimeout(1200); f = p.frameLocator('#frame');
  await f.locator('#fInd').fill('100'); await f.locator('#fInv').fill('300'); await p.waitForTimeout(300);
  ok(await f.locator('#out .hl').count() === 1, 'indicação: resultado aparece ao preencher');
  const bt = await caixa(f.locator('#limpar')), gr = await caixa(f.locator('.grid')); ok(!!bt && bt.y >= gr.y + gr.height, 'indicação: botão Limpar abaixo dos campos', JSON.stringify([bt && Math.round(bt.y), gr && Math.round(gr.y + gr.height)]));
  await f.locator('#limpar').click(); await p.waitForTimeout(200);
  ok(await f.locator('#fInd').inputValue() === '' && await f.locator('#fInv').inputValue() === '' && /Preencha/.test(await f.locator('#out').textContent()), 'indicação: Limpar zera as faturas e o resultado');
  ok(await f.locator('#fInd').evaluate(e => e === document.activeElement), 'indicação: foco volta ao primeiro campo');
  await p.click('.chave'); await p.waitForTimeout(300); ok((await caixa(f.locator('#limpar'))).width > 80, 'indicação: botão visível também no tema claro');
  await p.context().close();
  // 4) proposta: PDF e JPG reais
  p = await novaPagina(1600, 1043); await p.goto(base + 'index.html#proposta'); await p.waitForTimeout(1500); f = p.frameLocator('#frame');
  await f.locator('#pConsultor').fill('Maria Souza'); await f.locator('#pCliente').fill('João da Silva Ltda'); await f.locator('#pConsumo').fill('450'); await f.locator('#pMensalidade').fill('389.9'); await f.locator('#pEconomia').fill('1250');
  const [d1] = await Promise.all([p.waitForEvent('download'), f.locator('#pdf').click()]); const pdf = '/tmp/_proposta.pdf'; await d1.saveAs(pdf);
  ok(d1.suggestedFilename() === 'proposta_axs_joao-da-silva-ltda.pdf', 'proposta: nome do PDF', d1.suggestedFilename());
  ok(fs.readFileSync(pdf).slice(0, 4).toString() === '%PDF' && fs.statSync(pdf).size < 4e6, 'proposta: PDF válido e leve (< 4 MB)', String(fs.statSync(pdf).size));
  await p.waitForTimeout(500); const [d2] = await Promise.all([p.waitForEvent('download'), f.locator('#jpg').click()]); const jpg = '/tmp/_proposta.jpg'; await d2.saveAs(jpg);
  const buf = fs.readFileSync(jpg); ok(buf[0] === 0xff && buf[1] === 0xd8 && d2.suggestedFilename().endsWith('.jpg'), 'proposta: JPG válido');
  let i = 2, w = 0, h = 0; while (i < buf.length) { if (buf[i] !== 0xff) break; const m = buf[i + 1], len = buf.readUInt16BE(i + 2); if (m >= 0xc0 && m <= 0xc3) { h = buf.readUInt16BE(i + 5); w = buf.readUInt16BE(i + 7); break; } i += 2 + len; }
  ok(w === 2000 && h > 3000, 'proposta: JPG com 2000 px de largura (folha de 1000 px, escala 2)', w + 'x' + h);
  // assinatura: com o nome em branco continua havendo espaço entre "Atenciosamente," e o cargo
  await f.locator('summary', { hasText: 'Textos e benef' }).click(); await f.locator('#pConsultor').fill(''); await f.locator('#pCargo').fill('Consultor AXS Energia'); await p.waitForTimeout(300);
  const tAt = await caixa(f.locator('.px-signature > div').first()), tCargo = await caixa(f.locator('#vCargo'));
  ok(tCargo.y - (tAt.y + tAt.height) >= 55, 'proposta: espaço livre para o nome entre "Atenciosamente," e o cargo', String(Math.round(tCargo.y - (tAt.y + tAt.height))));
  await f.locator('.px-signature').scrollIntoViewIfNeeded(); await p.screenshot({ path: '/tmp/_assinatura.png' });
  await p.context().close();
  await correcoesNavegador(b, base, ok, erros);
  await celulares(b, base, ok, erros);
  ok(!erros.length, 'nenhum erro de script no navegador', erros.join(' | '));
  await b.close(); servidor.close();
  console.log(`Aprovados: ${pass}   Reprovados: ${fail}`); falhas.forEach(x => console.log(' x ' + x)); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
