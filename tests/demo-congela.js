/* Demonstra, em um processo com pouca memória, o travamento da indicação quando a fatura de quem indica é minúscula
   e a do indicado é grande (meses de isenção gigantes). Uso: node --max-old-space-size=300 demo-congela.js 0.01 1000000 */
const fs = require('fs'), path = require('path'); const { JSDOM } = require('jsdom'); const ROOT = path.resolve(__dirname, '..');
const [, , ind, inv] = process.argv; const html = fs.readFileSync(path.join(ROOT, 'indicacao.html'), 'utf8').replace(/<script[^>]*>\s*<\/script>/g, '');
const dom = new JSDOM(html, { runScripts: 'outside-only' }); const w = dom.window;
w.eval(fs.readFileSync(path.join(ROOT, 'js/indicacao.js'), 'utf8'));
w.document.getElementById('fInd').value = ind; w.document.getElementById('fInv').value = inv;
const t = Date.now(); w.document.getElementById('fInv').dispatchEvent(new w.Event('input', { bubbles: true }));
console.log('ok em', Date.now() - t, 'ms:', (w.document.querySelector('#out .big') || w.document.getElementById('out')).textContent.trim().slice(0, 80));
