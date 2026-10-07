# Histórico de versões

Formato: [versionamento semântico](https://semver.org/lang/pt-BR/) (MAIOR.MENOR.CORREÇÃO). A versão em uso aparece no rodapé do menu e na barra superior.

## [Não lançado]
Ideias já mapeadas para as próximas versões:
- Leitura de fatura escaneada ou foto (OCR).
- Fixtures e testes com faturas reais de CEMIG e Elektro.
- Resumo copiável do resultado (WhatsApp/CRM).
- Pedir confirmação quando a distribuidora for identificada só pela primeira palavra do nome (ex.: CPFL Piratininga).
- Considerar os dias de faturamento de cada mês na média (a confirmar com o negócio).

## [1.1.0] - 2026-10-06
Nova aba de proposta, tema claro/escuro e layout em 3 colunas conforme a imagem de referência. Validada por 529 testes automatizados e 13 testes em Chromium real (layout, tema e geração de PDF/JPG).

### Adicionado
- **Aba "Proposta de oferta":** formulário manual (consultor, cliente, data, validade com atalho de 7/15/30 dias, UC, consumo médio previsto, mensalidade AXS, economia anual, observação, cargo e benefícios) com prévia fiel ao modelo da AXS Energia e download em **PDF** ou **JPG**. Arquivo nomeado com o cliente (`proposta_axs_nome-do-cliente.pdf`); consultor lembrado neste navegador; botão para limpar campos.
- **Tema claro/escuro:** botão na barra superior; segue a preferência do sistema na primeira visita, guarda a escolha e vale também dentro dos simuladores. Cores centralizadas em `css/tema.css`.
- **Propostas geradas** no painel de uso (evento `/proposta-gerada` no GoatCounter).
- Teste em navegador real (`tests/navegador.js`, opcional) que confere o layout, o tema e a geração de PDF/JPG.

### Alterado
- **Simulador de consumo em 3 colunas**, como na imagem de referência: (1) importar fatura, ar-condicionado, outros produtos e geração/injeção; (2) dados do lead; (3) resultado e parâmetros. Abre com importar fatura e geração expandidos e ar-condicionado, outros produtos e parâmetros recolhidos. Em telas médias vira 2 colunas e no celular 1 coluna (dados do lead primeiro).
- **Barra superior:** links centralizados, com o botão de tema e a versão à direita, e quarta aba "Proposta de oferta". Ela agora acompanha a rolagem do menu.
- Tela de indicação com a mesma faixa de título das demais.
- Menu inicial com três cartões (indicação, consumo e proposta).
- Bibliotecas de exportação (html2canvas e jsPDF) e a fonte Montserrat hospedadas no próprio site; imagens da proposta embutidas, então o PDF/JPG funciona também com o arquivo aberto direto do computador.

### Corrigido
- PDF da proposta gerado com imagem JPEG: cerca de 0,7 MB em vez de ~27 MB do modelo original (PNG).
- Barra superior não acompanhava a rolagem do menu inicial.

## [1.0.0] - 2026-10-05
Primeira versão oficial, validada por 409 testes automatizados (incluindo faturas reais anonimizadas).

### Adicionado
- **Menu com barra de navegação superior:** Página principal, Simulação de indicação e Simulação de consumo de energia, com link direto por simulador.
- **Simulador de desconto por indicação:** desconto do indicado no 1º mês, crédito proporcional a quem indicou, meses de isenção e valor do mês em que volta a pagar.
- **Simulador de média e necessidade de consumo:**
  - média pelos meses informados e comparação com o mínimo por distribuidora e tipo (mono, bi, trifásico);
  - tarifa social, ar-condicionado (5 modelos), outros produtos, geração/injeção e carteira de energia com previsão de duração;
  - resultado enxuto (só linhas com informação aplicada), total consumido e tipo de relógio;
  - alerta de meses fora do padrão, com opção de desconsiderar o mês.
- **Leitura de fatura em PDF:** identifica distribuidora, tipo, histórico (Mês 01 = mais recente, até 12 meses), injeção e carteira; avisa sobre tarifa social, fatura de alta tensão e PDF escaneado. Biblioteca pdf.js hospedada no próprio site.
- **Parâmetros em arquivo versionado (`parametros.js`):** mínimos, consumo extra de AC e desconto da tarifa social; ajustes locais como rascunho, botão "Exportar parametros.js" e descarte automático de rascunhos antigos.
- **Estatísticas de uso (GoatCounter):** acessos, simulações realizadas e Top 5 de localidades (opcional via Worker), com opção de não contar as próprias visitas (`?contar=nao`).
- **Qualidade:** suíte de 409 testes automatizados, workflow do GitHub Actions, fixtures de faturas reais anonimizadas e ferramenta para criar novas (`tests/extrair-fixture.js`), `.gitignore` e relatório `QA-RELATORIO.md`.

### Corrigido durante a validação (encontrado pelos testes)
- Indicação aceitava percentuais inválidos (150%, -10%).
- Dado salvo com formato errado no navegador derrubava a página de consumo ou gerava "NaN".
- Dois campos de limite de variação ficavam dessincronizados; o alerta foi unificado.
- CPFL não era identificada quando a fatura trazia só "CPFL".
- Reanalisar um texto sem histórico apagava os meses já digitados.
- Tipo trifásico não era reconhecido quando colado em outra palavra (Copel: "AdmTrifasico") nem no formato "B1 / MONO" (Equatorial).
- Datas de vencimento ("27/01/2026") e textos como "JUROS DE MORA04/2026" podiam virar mês de consumo.
- Histórico em blocos (rótulos seguidos dos valores, formato Copel) e valores decimais na leitura de texto corrido.
- **Copel baixa renda:** o consumo vem em faixas (80 + 140 + 112) e o Mês 01 saía como 80 em vez de 332.
- **Energisa MT:** os dias de faturamento do gráfico eram lidos como consumo.
- Fatura de alta tensão (ponta/fora de ponta) gerava histórico parcial; agora o consumo não é preenchido e a tela avisa.
- A contagem de simulações comparava o texto de forma instável.
- Campos sem rótulo acessível (`aria-label`).

### Limitações conhecidas
- Fatura escaneada ou em foto não é lida (sem OCR).
- Sem fixtures reais de CEMIG e Elektro.
- Leitura de PDF validada com pdf.js em Node, não em navegador real.
