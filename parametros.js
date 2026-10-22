/* Parâmetros de atendimento: FONTE ÚNICA, versionada no repositório.
   Para mudar um valor: edite aqui, atualize "versao" e "atualizadoEm" e publique (push).
   Quando a "versao" muda, os ajustes locais antigos feitos no navegador são descartados.
   "disponibilidade" = custo de disponibilidade (kWh/mês por tipo), descontado de cada mês na energia compartilhada estimada.
   "tarifasAXS" = "Tarifa AXS" (R$/kWh) por distribuidora e bandeira, conforme comunicado de 30/09/2026 (Copel tem Faixa I - 20% e Faixa II - 25%).
   Dica: no simulador, o botão "Exportar parametros.js" gera este arquivo já com os seus ajustes. */
window.PARAMETROS = {
  "versao": "2026-10-08",
  "atualizadoEm": "08/10/2026",
  "descontoSocial": 200,
  "disponibilidade": {
    "Monofásico": 30,
    "Bifásico": 50,
    "Trifásico": 100
  },
  "tarifasAXS": {
    "vigenteDesde": "01/10/2026",
    "bandeiraPadrao": "Verde",
    "bandeiraReferencia": "outubro/2026",
    "bandeiras": [
      "Verde",
      "Amarela",
      "Vermelha I",
      "Vermelha II"
    ],
    "valores": {
      "CEMIG - MG": {
        "Verde": 0.79629,
        "Amarela": 0.81359,
        "Vermelha I": 0.83726,
        "Vermelha II": 0.86859
      },
      "COPEL - PR": {
        "Faixa I": {
          "Verde": 0.61442,
          "Amarela": 0.6295,
          "Vermelha I": 0.65012,
          "Vermelha II": 0.67743
        },
        "Faixa II": {
          "Verde": 0.57602,
          "Amarela": 0.59015,
          "Vermelha I": 0.60949,
          "Vermelha II": 0.63509
        }
      },
      "CPFL Paulista - SP": {
        "Verde": 0.76541,
        "Amarela": 0.78732,
        "Vermelha I": 0.81728,
        "Vermelha II": 0.85695
      },
      "ELEKTRO - SP": {
        "Verde": 0.90278,
        "Amarela": 0.92433,
        "Vermelha I": 0.95379,
        "Vermelha II": 0.99281
      },
      "ENERGISA - MT": {
        "Verde": 0.53965,
        "Amarela": 0.55096,
        "Vermelha I": 0.56643,
        "Vermelha II": 0.58691
      },
      "EQUATORIAL - GO": {
        "Verde": 0.77215,
        "Amarela": 0.78854,
        "Vermelha I": 0.81095,
        "Vermelha II": 0.84063
      }
    }
  },
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
