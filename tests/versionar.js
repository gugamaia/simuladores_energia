/* Troca a versão em todo o site de uma vez: versao.js e o "?v=" dos arquivos css/js nos HTML.
   Uso:  cd tests && node versionar.js 1.2.1 2026-10-20
   Depois: acrescente a entrada no CHANGELOG.md e rode `npm test` (os testes conferem se tudo bate). */
const fs = require('fs'), path = require('path');
const [, , nova, data] = process.argv, ROOT = path.resolve(__dirname, '..');
if (!/^\d+\.\d+\.\d+$/.test(nova || '') || !/^\d{4}-\d{2}-\d{2}$/.test(data || '')) { console.error('Uso: node versionar.js MAIOR.MENOR.CORRECAO AAAA-MM-DD'); process.exit(1); }
const v = path.join(ROOT, 'versao.js'); fs.writeFileSync(v, fs.readFileSync(v, 'utf8').replace(/numero: '[^']*', data: '[^']*'/, `numero: '${nova}', data: '${data}'`));
for (const f of fs.readdirSync(ROOT).filter(n => n.endsWith('.html'))) { const p = path.join(ROOT, f); fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/\?v=\d+\.\d+\.\d+/g, '?v=' + nova)); }
console.log(`Versão ${nova} (${data}) aplicada em versao.js e nos HTML. Falta: CHANGELOG.md e npm test.`);
