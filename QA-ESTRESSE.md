# QA de estresse

Testes de estresse dos cálculos, da geração de propostas, do layout, da acessibilidade, do desempenho e do teclado.
Os scripts estão em `tests/` e podem ser repetidos a qualquer momento (veja "Como repetir" no final).

## Reteste na versão 1.5.1

As correções foram aplicadas e todo o estresse foi repetido. **Resultado: nenhum defeito alto restante, exceto a decisão pendente sobre o verde da marca (E-08).**

| ID | Situação na 1.5.1 | Como foi confirmado |
|---|---|---|
| E-01 | **Corrigido** | R$ 0,01 contra R$ 1 milhão e 1e308 agora respondem com aviso em milissegundos (antes: "heap out of memory"); faturas de R$ 1,00 a R$ 10.000.000,00; aviso quando o crédito cobre mais de 120 meses |
| E-02 | **Corrigido** (causa real diferente da suspeita) | O estouro vinha do cartão "Parâmetros de atendimento" aberto: as tabelas largas esticavam a coluna única do celular. Varredura em 25 larguras sem rolagem horizontal |
| E-03 | **Corrigido** | Barra com ícone e rótulo curto entre 721 e 1.260 px: 14 larguras testadas, 4 abas inteiras, chave e versão visíveis |
| E-04 | **Corrigido** | axe-core: 0 violações de rótulo (antes: 51 campos) |
| E-05 | **Corrigido** | 100.000 x "JAN26": de 88 s para 3 ms; "JAN" + 200.000 espaços: de 16 s para 19 ms; 8 textos hostis, todos abaixo de 1,5 s |
| E-06 | **Corrigido** | A aba Proposta aparece inteira em 768, 820 e 900 px |
| E-07 | **Corrigido** | Limites de tamanho nos campos e quebra de palavras longas: 12 cenários extremos da proposta sem nenhum estouro |
| E-08 | **Pendente (decisão)** | O verde da marca (#10b981) continua com contraste de 2,5:1. É a única violação restante no axe |
| E-09 | **Corrigido** | Região principal `main` no menu |
| E-10 | **Corrigido** | 280 px (Galaxy Z Fold fechado) sem rolagem horizontal |
| E-11 | **Corrigido** | Limites de entrada (consumo até 1.000.000 kWh, produtos, nomes); contas da indicação em centavos: 3.000 casos com 0 divergências |
| E-12 | **Mitigado** | Limite de 50 produtos por simulação |
| E-13 | **Corrigido** | Link "Pular para o conteúdo" e cabeçalho de tabela com texto |

**Defeitos novos que o reteste encontrou e que também foram corrigidos:**
1. **Indicação:** a razão crédito/fatura era arredondada antes de contar os meses e, em cerca de 0,2% dos casos, aparecia 1 mês de isenção a mais; meio centavo (R$ 8,745) caía para baixo. Agora é tudo em centavos inteiros.
2. **Consumo em 280 px:** o texto invisível da coluna "Remover" da tabela alargava a página em 9 px.
3. **Proposta em 280 px:** o campo de validade estourava a largura.

**Testes novos:** 49 verificações no DOM (seção "O") e 21 em navegador real cobrem cada correção, e o estresse (`stress.js` e `stress-navegador.js`) foi mantido no repositório. Total após a 1.5.1: **734 automáticas e 266 em Chromium real**.

---

# Resultado original (versão 1.5.0)

## Resumo

| Área | Resultado |
|---|---|
| Cálculos (indicação, energia compartilhada, mensalidade) | **Sólidos.** 1 divergência de 1 centavo em 3.000 casos, só com valores de bilhões de reais; 0 divergências em 1.200 casos de consumo contra cálculo exato |
| Geração de propostas (PDF e JPG) | **Consistente.** Arquivos idênticos byte a byte em 10 repetições e em 5 ambientes (tema escuro, iPhone, monitor, 320 px, arquivo aberto direto do computador) |
| Segurança (HTML injetado) | **Sem falhas** nos 8 textos hostis testados |
| Layout | **4 problemas** (1 deles estoura a página no celular) |
| Acessibilidade | **1 problema crítico** (51 campos sem rótulo) e 4 menores |
| Desempenho e memória | **Bons.** Sem vazamento de memória após 150 trocas de aba e 30 gerações de arquivo |
| Leitura de fatura | **1 risco alto:** texto muito grande pode travar a página por mais de um minuto |
| Indicação | **1 defeito alto:** valores extremos travam a aba do navegador |

**5 defeitos de severidade alta, 5 médios e 3 baixos.** Nenhum deles afeta o uso normal com valores do dia a dia, exceto E-02 e E-03 (layout), que aparecem em situações comuns (produto adicionado no celular, tablet na horizontal).

## O que foi testado e passou

- **Indicação:** 3.000 casos aleatórios e extremos (faturas de R$ 0,01 a R$ 10 bilhões, percentuais de 0 a 100% com 2 casas) contra um cálculo exato em centavos (BigInt). Divergência: 1 caso (fatura de R$ 4,1 milhões contra R$ 2,7 bilhões; erro de ponto flutuante).
- **Consumo:** 1.200 casos aleatórios (6 distribuidoras x 3 tipos x 4 bandeiras x Copel nas 2 faixas, 1 a 12 meses com 2 decimais até 100 mil kWh, ar-condicionado) comparando energia compartilhada e mensalidade em centavos com um cálculo exato. **0 divergências.**
- **Sequência aleatória de 3.000 operações** na tela de consumo (trocar distribuidora, tipo, bandeira, meses, produtos, geração, restaurar, limpar...) conferindo invariantes (sem NaN, sem valores negativos, linhas visíveis coerentes): **0 violações, 0 erros de script.**
- **Fixtures de fatura reais:** as 7 fixtures lidas 100 vezes cada: resultado idêntico em todas (determinístico e idempotente).
- **Proposta, consistência:**
  - 10 JPG gerados em sequência: **idênticos** (2000x3436 px, cerca de 0,5 s cada).
  - 10 PDF: 1 página, mesma imagem interna, 676 KB, 210 x 361 mm.
  - O mesmo arquivo foi gerado no **tema escuro, no iPhone 390x844 (DPR 3), no monitor 1920x1080 (DPR 1), em 320 px** e **abrindo o arquivo direto do computador (file://)**: **idêntico ao de referência** em todos.
  - Datas: fusos de Kiritimati (UTC+14), Pago Pago (UTC-11), Nova York e São Paulo com a data padrão correta; validade rápida em 5 datas de borda (ano bissexto, virada de ano, fim de mês) correta.
  - 4 cliques simultâneos nos botões geraram **1 arquivo** (os botões travam durante a geração).
  - Memória: 3 MB para 4 MB após 30 gerações, sem canvas restantes.
- **Proposta, dados extremos:** 12 cenários (tudo em branco, cliente com 200 caracteres, 120 letras sem espaço, emoji e aspas, HTML, valores de R$ 1 trilhão, R$ 0,004, negativos, UC de 100 dígitos, observação de 8.000 caracteres, benefícios longos): todos geraram o JPG em menos de 1 s, **sem HTML injetado** e com 1 estouro (E-07). Nomes de arquivo com texto chinês, emoji, `../../etc/passwd` e símbolos ficaram seguros.
- **Navegação e memória:** 150 trocas rápidas de aba: memória do menu de 1,1 para 1,2 MB, sempre 1 iframe, 0 erros; 2.000 mensagens de altura processadas em 13 ms.
- **Teclado:** ordem do foco lógica (4 abas, chave de tema, tela), chave de tema acionada pelo Espaço, cartões recolhíveis pelo Enter, foco visível.
- **Desempenho com 4G lento e CPU 4 vezes mais lenta:** menu em 1,7 s, indicação em 1,6 s, consumo em 3,7 s, proposta em 6,1 s; CLS (deslocamento de layout) 0,000 em todas.
- **Texto ampliado em 200% (acessibilidade):** sem rolagem horizontal em 390 px e 360 px.
- **Contraste de cores (axe):** nenhuma falha nos temas claro e escuro, exceto o verde da proposta (E-08).

## Defeitos e riscos encontrados

| ID | Sev. | Onde | O que acontece | Evidência | Correção sugerida | Esforço |
|---|---|---|---|---|---|---|
| E-01 | **Alta** | Indicação | Fatura de quem indica minúscula (R$ 0,01) com fatura do indicado grande, ou valores absurdos (1e305), **trava e derruba a aba** por falta de memória. Em R$ 1 contra R$ 1 milhão aparece "isenta por 500.000 meses" | `tests/demo-congela.js`: R$ 0,01 x R$ 1.000.000 e 1e308 x 1e308 terminam em "heap out of memory" | Remover o laço morto que monta o plano mês a mês (`plan` em `js/indicacao.js`, sobra da tabela que foi retirada), limitar as faturas (ex.: até R$ 10 milhões, mínimo R$ 1) e avisar quando a isenção passar de 120 meses | Pequeno |
| E-02 | **Alta** | Consumo, celular | Ao **adicionar um produto** em "Outros produtos", a coluna passa a 554 px e a página rola na horizontal em telas de 320 a 540 px | Varredura de layout com um produto cadastrado: `col-a` com 554 px em 320, 360, 375, 390, 412, 430, 480 e 540 px | Linhas da lista com `min-width:0` e campos em duas linhas abaixo de 480 px | Pequeno |
| E-03 | **Alta** | Menu, 1024 px | Em tablet na horizontal e notebooks pequenos (1024 px) a **barra superior estoura** (1.110 px) e a página rola para o lado | Varredura: `.nav-dir` termina em 1.110 px com a tela de 1.024 px | Entre 721 e 1.100 px usar rótulos curtos ou esconder o texto da chave | Pequeno |
| E-04 | **Alta** | Consumo, acessibilidade | **51 campos sem rótulo** para leitor de tela (quantidade e kWh do ar-condicionado, lista de produtos, tabelas de parâmetros e de tarifas) | axe-core, regra `label`, impacto crítico | `aria-label` em cada campo ("Quantidade de aparelhos de 9.000 BTUs", "Tarifa AXS Energisa, bandeira Verde"...) | Pequeno |
| E-05 | **Alta** | Leitura de fatura | Texto grande ou malformado **trava a página**: 100.000 vezes "JAN26" levam 88 s; "JAN" seguido de 200.000 espaços leva 16 s (busca com retrocesso) | `tests/stress.js`, etapa S4 | Limitar o texto lido (ex.: 300 mil caracteres, linhas de até 2.000), reescrever a busca de blocos sem retrocesso | Médio |
| E-06 | Média | Menu, tablets | Entre 768 e 900 px a barra de abas rola na horizontal e a aba **Proposta fica fora da tela** | Varredura: link da 4ª aba em 692 a 861 px | Mostrar a barra inferior (a do celular) também até 900 px | Pequeno |
| E-07 | Média | Proposta | Nome do consultor longo e sem espaços (300 letras) **estoura a assinatura** (5.152 px de texto em 914 px). Não há limite de tamanho nos campos | Etapa P2, cenário "consultor com 300 caracteres" | `maxlength` (cliente 80, consultor 60, UC 30, benefícios 40) e quebra de palavra na assinatura | Pequeno |
| E-08 | Média | Proposta | O verde da marca (#10b981) sobre branco tem contraste de **2,5:1** (o mínimo é 4,5:1 para texto normal e 3:1 para texto grande) | axe, regra `color-contrast` | Usar um verde mais escuro (ex.: #047857) só nos textos pequenos, ou decidir manter a identidade visual | Pequeno |
| E-09 | Média | Menu | Falta o marcador `main` (região principal) para leitores de tela | axe, regra `landmark-one-main` | Envolver o conteúdo do menu e o iframe em `<main>` | Pequeno |
| E-10 | Média | Menu, 280 px | No Galaxy Z Fold fechado (280 px) a barra superior estoura | Varredura: 280 px | Esconder a versão e o texto da chave abaixo de 320 px | Pequeno |
| E-11 | Baixa | Indicação e consumo | Aceita valores absurdos sem aviso (consumo de 1e15 kWh). Com R$ 4 milhões e R$ 2,7 bilhões houve 1 caso com erro de 1 centavo (ponto flutuante) | Etapas S1 e S3 | Limites de entrada (máximo e mínimo) e aviso | Pequeno |
| E-12 | Baixa | Consumo | Adicionar produto fica lento com centenas de itens (69 ms cada com 500; 34 s para 500). Irrelevante com poucos produtos | Etapa S3 | Atualizar só a linha nova em vez de redesenhar a lista | Pequeno |
| E-13 | Baixa | Menu e consumo | Falta um link "pular para o conteúdo" e há um cabeçalho de tabela vazio (coluna de remover) | axe e etapa P7 | Acrescentar o link e um texto oculto no cabeçalho | Pequeno |

### Observações (não são defeitos)

- **O PDF da proposta não é A4:** tem 210 mm de largura e 361 mm de altura (uma folha única e longa, que acompanha o conteúdo). Ao imprimir em A4, a folha é reduzida. Se a área comercial imprimir, vale oferecer a opção em A4 paginado.
- **Carga inicial:** o consumo baixa o leitor de PDF (313 KB) mesmo sem envio de fatura, e a proposta baixa html2canvas e jsPDF (550 KB) mesmo sem exportar. Com gzip (como o GitHub Pages entrega) são 87 KB e 160 KB. Carregar só ao clicar deixaria a abertura mais leve.
- **Safari do iPhone (WebKit):** todos os testes de navegador usam o Chromium. Falta conferir em um iPhone real.

## O que evoluir na próxima versão

**Versão 1.5.1 (correção, prioridade máxima):** E-01 a E-05 (travamento da indicação, produto no celular, barra em 1.024 px, rótulos dos campos e limite do texto lido), mais E-06, E-07, E-09 e E-10, que são ajustes pequenos e no mesmo ponto do código. Cada um tem teste automático proposto: reproduzir o caso do relatório e passar a exigir o resultado correto.

**Versão 1.6.0 (evolução):**
1. **Botão "Levar para a proposta"** no consumo: passa consumo previsto e mensalidade estimada para a aba de proposta, sem digitar duas vezes.
2. **Proposta em A4:** opção de PDF paginado, e botão de compartilhar no celular (WhatsApp) pelo menu nativo.
3. **Fatura escaneada ou foto (OCR):** hoje não é lida (a CPFL de exemplo é imagem).
4. **Fixtures de CEMIG e Elektro** para a leitura de fatura (ainda sem exemplo real).
5. **Carregar sob demanda** o leitor de PDF e as bibliotecas de exportação.
6. **Limites e validações de entrada** em todos os campos (E-07 e E-11).
7. **Uso offline no celular (instalar na tela inicial):** manifesto e cache do site.

**Regras de negócio ainda a confirmar com a área comercial:** quando vale a Faixa I ou II da Copel (hoje a escolha é manual); se o consumo extra (ar-condicionado, produtos, geração) deve entrar na mensalidade estimada; se o PDF da proposta deve sair em A4.

**Qualidade:** rodar o teste de navegador no GitHub (Actions) e conferir em um iPhone real antes de cada divulgação.

## Como repetir

```
cd tests
npm install
node stress.js                      # cálculos e leitura de fatura (cerca de 6 minutos; STRESS_ONLY=s1,s2... para escolher etapas)
node --max-old-space-size=300 demo-congela.js 0.01 1000000   # mostra o travamento E-01
CHROME_PATH=/caminho/chrome AXE=/caminho/axe.min.js node stress-navegador.js   # proposta, layout, acessibilidade, desempenho, teclado
```
No `stress-navegador.js` use `STRESS_ONLY=p1,p2,p3,p4,p5,p6,p7` para rodar etapas separadas e `TEMA=dark` para a varredura de layout no tema escuro.
