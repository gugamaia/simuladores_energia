/* Parâmetros de atendimento: FONTE ÚNICA, versionada no repositório.
   Para mudar um valor: edite aqui, atualize "versao" e "atualizadoEm" e publique (push).
   Quando a "versao" muda, os ajustes locais antigos feitos no navegador são descartados.
   "disponibilidade" = custo de disponibilidade (kWh/mês por tipo), descontado de cada mês na energia compartilhada estimada.
   Dica: no simulador, o botão "Exportar parametros.js" gera este arquivo já com os seus ajustes. */
window.PARAMETROS = {
  "versao": "2026-10-07",
  "atualizadoEm": "07/10/2026",
  "descontoSocial": 200,
  "disponibilidade": { "Monofásico": 30, "Bifásico": 50, "Trifásico": 100 },
  "acs": [
    {
      "btu": 9000,
      "kwh": 100
    },
    {
      "btu": 12000,
      "kwh": 150
    },
    {
      "btu": 18000,
      "kwh": 250
    },
    {
      "btu": 20000,
      "kwh": 300
    },
    {
      "btu": 24000,
      "kwh": 400
    }
  ],
  "distribuidoras": {
    "CEMIG - MG": {
      "Monofásico": 153,
      "Bifásico": 173,
      "Trifásico": 223
    },
    "COPEL - PR": {
      "Monofásico": 189,
      "Bifásico": 209,
      "Trifásico": 259
    },
    "CPFL Paulista - SP": {
      "Monofásico": 250,
      "Bifásico": 270,
      "Trifásico": 320
    },
    "ELEKTRO - SP": {
      "Monofásico": 250,
      "Bifásico": 270,
      "Trifásico": 320
    },
    "ENERGISA - MT": {
      "Monofásico": 210,
      "Bifásico": 230,
      "Trifásico": 280
    },
    "EQUATORIAL - GO": {
      "Monofásico": 156,
      "Bifásico": 176,
      "Trifásico": 226
    }
  }
};
