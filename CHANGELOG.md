# Histórico de versões

Formato: [versionamento semântico](https://semver.org/lang/pt-BR/) (MAIOR.MENOR.CORREÇÃO). A versão em uso aparece no rodapé do menu e na barra superior.

## [Não lançado]
Ideias já mapeadas para as próximas versões:
- Leitura de fatura escaneada ou foto (OCR).
- Fixtures e testes com faturas reais de CEMIG e Elektro.
- Resumo copiável do resultado (WhatsApp/CRM).
- Pedir confirmação quando a distribuidora for identificada só pela primeira palavra do nome (ex.: CPFL Piratininga).
- Considerar os dias de faturamento de cada mês na média (a confirmar com o negócio).

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
