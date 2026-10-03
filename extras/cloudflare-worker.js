// Cloudflare Worker (opcional): devolve o Top 5 de localidades do GoatCounter para o index.html.
// Variaveis do Worker: GC_CODE (codigo do site), GC_TOKEN (chave de API do GoatCounter, somente leitura), ALLOWED_ORIGIN (ex.: https://SEU-USUARIO.github.io)
// Importante: a chave de API NUNCA vai no site; fica so aqui, como segredo do Worker.
// Observacao: nao testado com uma conta real; confira os parametros em https://www.goatcounter.com/api.html
export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300'
    };
    const url = `https://${env.GC_CODE}.goatcounter.com/api/v0/stats/locations?start=2020-01-01T00:00:00Z&limit=5`;
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + env.GC_TOKEN } });
    if (!r.ok) return new Response('[]', { status: 502, headers: cors });
    const j = await r.json();
    const top = (j.stats || []).slice(0, 5).map(s => ({ name: s.name || s.id, count: s.count }));
    return new Response(JSON.stringify(top), { headers: cors });
  }
};
