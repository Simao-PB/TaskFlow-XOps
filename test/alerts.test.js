
const test = require('node:test');
const assert = require('node:assert/strict');

const { analisarMetricas } = require('../src/alerts');

function criarMetricas(pedidos, erros, tempoMedio, mediaGlobal = 20) {
    return {
        tempoMedioMs: mediaGlobal,
        rotas: {
            '/api/teste': {
                pedidos,
                erros,
                tempoMedioMs: tempoMedio
            }
        }
    };
}

test('Nao gera alertas quando existem poucos pedidos', () => {
    const metricas = criarMetricas(3, 3, 200);

    const alertas = analisarMetricas(metricas);

    assert.equal(alertas.length, 0);
});

test('Nao gera alertas quando o funcionamento e normal', () => {
    const metricas = criarMetricas(10, 0, 15);

    const alertas = analisarMetricas(metricas);

    assert.equal(alertas.length, 0);
});

test('Gera alerta ALTA quando existem muitos erros', () => {
    const metricas = criarMetricas(10, 4, 20);

    const alertas = analisarMetricas(metricas);

    assert.equal(alertas.length, 1);
    assert.equal(alertas[0].tipo, 'ERROS');
    assert.equal(alertas[0].gravidade, 'ALTA');
    assert.equal(alertas[0].valor, 40);
});

test('Gera alerta MEDIA quando uma rota e lenta', () => {
    const metricas = criarMetricas(10, 0, 120);

    const alertas = analisarMetricas(metricas);

    assert.equal(alertas.length, 1);
    assert.equal(alertas[0].tipo, 'LENTIDAO');
    assert.equal(alertas[0].gravidade, 'MEDIA');
});

test('Gera dois alertas quando existem erros e lentidao', () => {
    const metricas = criarMetricas(10, 4, 120);

    const alertas = analisarMetricas(metricas);

    assert.equal(alertas.length, 2);
    assert.equal(alertas[0].tipo, 'ERROS');
    assert.equal(alertas[1].tipo, 'LENTIDAO');
});
