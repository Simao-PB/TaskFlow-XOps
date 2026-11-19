
const configuracao = require('../config/monitoring-alerts.json');

function analisarMetricas(metricas) {
    const alertas = [];
    const mediaGlobal = metricas.tempoMedioMs;

    for (const [rota, dados] of Object.entries(metricas.rotas)) {
        if (dados.pedidos < configuracao.minimoPedidos) {
            continue;
        }

        const taxaErros = dados.erros / dados.pedidos * 100;

        if (taxaErros > configuracao.limiteTaxaErros) {
            alertas.push({
                tipo: 'ERROS',
                gravidade: configuracao.gravidade.erros,
                rota,
                valor: Number(taxaErros.toFixed(2)),
                limite: configuracao.limiteTaxaErros,
                mensagem:
                    `A rota ${rota} apresenta uma taxa de erros ` +
                    `de ${taxaErros.toFixed(2)}%.`
            });
        }

        const tempoElevado =
            dados.tempoMedioMs > configuracao.limiteTempoMedioMs &&
            dados.tempoMedioMs > mediaGlobal * configuracao.fatorLentidao;

        if (tempoElevado) {
            alertas.push({
                tipo: 'LENTIDAO',
                gravidade: configuracao.gravidade.lentidao,
                rota,
                valor: dados.tempoMedioMs,
                limite: configuracao.limiteTempoMedioMs,
                mensagem:
                    `Possível lentidão na rota ${rota}. ` +
                    `Tempo médio: ${dados.tempoMedioMs} ms.`
            });
        }
    }

    return alertas;
}

module.exports = { analisarMetricas };
