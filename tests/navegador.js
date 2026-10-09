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
  ok(!erros.length, 'nenhum erro de script no navegador', erros.join(' | '));
  await b.close(); servidor.close();
  console.log(`Aprovados: ${pass}   Reprovados: ${fail}`); falhas.forEach(x => console.log(' x ' + x)); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
