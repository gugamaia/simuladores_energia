/* Gera uma fixture de teste (itens de texto + posição) a partir de uma fatura em PDF, ocultando dados pessoais.
   Uso:  node extrair-fixture.js fatura.pdf fixtures/nome.json --ocultar "NOME DO CLIENTE,RUA TAL,CIDADE,CEP"
   - Todo item de texto que contenha um dos termos de --ocultar (sem diferenciar maiúsculas) vira "[OCULTO]".
   - Sequências de 8+ dígitos, chaves de acesso, linhas digitáveis e CPF mascarado também são ocultados.
   - REVISE o arquivo gerado antes de enviar ao repositório (o script lista o que foi ocultado e avisa sobre sobras). */
const fs = require('fs');
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
const [, , pdf, saida, ...resto] = process.argv;
if (!pdf || !saida) { console.error('Uso: node extrair-fixture.js fatura.pdf saida.json [--ocultar "termo1,termo2"]'); process.exit(1); }
const i = resto.indexOf('--ocultar'); const termos = i >= 0 ? resto[i + 1].split(',').map(t => t.trim().toUpperCase()).filter(Boolean) : [];
const zera = s => s.replace(/\d/g, '0');
function limpar(str) {
  const up = str.toUpperCase();
  if (termos.some(t => up.includes(t))) return '[OCULTO]';
  if (/\*\*\*|\b00X\.XXX|XX\d-\d{2}/.test(str)) return '[OCULTO]';                      // CPF mascarado
  if (/\d{5}\.\d{5,6}\s+\d{5}\.\d{5,6}/.test(str)) return '[OCULTO]';                   // linha digitável
  return str.replace(/(\d{4} ){4,}\d{2,4}/g, zera).replace(/\d{3}\.\d{3}\.\d{3}-\d{2}/g, zera).replace(/\d{8,}/g, zera);
}
(async () => {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(pdf)), useSystemFonts: true, verbosity: 0 }).promise;
  const paginas = []; let ocultos = 0;
  for (let p = 1; p <= doc.numPages; p++) {
    const c = await (await doc.getPage(p)).getTextContent();
    paginas.push(c.items.map(it => { const s = limpar(it.str); if (s !== it.str) ocultos++; return [s, +it.transform[4].toFixed(1), +it.transform[5].toFixed(1), +(it.width || 0).toFixed(1)]; }));
  }
  const total = paginas.flat().length;
  fs.writeFileSync(saida, JSON.stringify({ origem: 'PDF (itens de texto com posição; dados pessoais ocultados)', paginas, esperado: {} }));
  const dump = JSON.stringify(paginas);
  const sobras = termos.filter(t => dump.toUpperCase().includes(t));
  console.log(`${saida}: ${doc.numPages} página(s), ${total} itens, ${ocultos} alterados/ocultados.`);
  if (!total) console.log('ATENÇÃO: PDF sem texto (imagem/escaneado). Este leitor não consegue lê-lo.');
  if (sobras.length) console.log('ATENÇÃO: termos ainda presentes:', sobras.join(', '));
  console.log('Preencha o campo "esperado" (distribuidora, tipo, meses...) conferindo com a fatura e REVISE o arquivo antes de publicar.');
})();
