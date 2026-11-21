
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


// ---------------------------------------------------------------
// SCRUM-29 - Limites exatos das regras (valores lidos da configuracao)
// ---------------------------------------------------------------

const configuracao = require('../config/monitoring-alerts.json');

const MINIMO = configuracao.minimoPedidos;
const LIMITE_ERROS = configuracao.limiteTaxaErros;
const LIMITE_TEMPO = configuracao.limiteTempoMedioMs;
const FATOR = configuracao.fatorLentidao;

test('Limite de pedidos: um pedido abaixo do minimo nao gera alertas', () => {
    const metricas = criarMetricas(MINIMO - 1, MINIMO - 1, LIMITE_TEMPO * 10, 1);

    assert.equal(analisarMetricas(metricas).length, 0);
});

test('Limite de pedidos: exatamente o minimo ja permite gerar alertas', () => {
    const metricas = criarMetricas(MINIMO, MINIMO, 1, 1);

    const alertas = analisarMetricas(metricas);

    assert.equal(alertas.length, 1);
    assert.equal(alertas[0].tipo, 'ERROS');
});

test('Limite de erros: taxa exatamente igual ao limite nao gera alerta', () => {
    // 100 pedidos para a taxa ser exatamente o limite (sem arredondamentos).
    const metricas = criarMetricas(100, LIMITE_ERROS, 1, 1);

    assert.equal(analisarMetricas(metricas).length, 0);
});

test('Limite de erros: taxa um ponto acima do limite gera alerta', () => {
    const metricas = criarMetricas(100, LIMITE_ERROS + 1, 1, 1);

    const alertas = analisarMetricas(metricas);

    assert.equal(alertas.length, 1);
    assert.equal(alertas[0].valor, LIMITE_ERROS + 1);
});

test('Limite de tempo: tempo medio exatamente igual ao limite nao gera alerta', () => {
    const metricas = criarMetricas(10, 0, LIMITE_TEMPO, 1);

    assert.equal(analisarMetricas(metricas).length, 0);
});

test('Limite de tempo: tempo medio acima do limite e da media gera alerta', () => {
    const metricas = criarMetricas(10, 0, LIMITE_TEMPO + 1, 1);

    const alertas = analisarMetricas(metricas);

    assert.equal(alertas.length, 1);
    assert.equal(alertas[0].tipo, 'LENTIDAO');
});

test('Fator de lentidao: exatamente o fator vezes a media global nao gera alerta', () => {
    const mediaGlobal = LIMITE_TEMPO * 2;
    const metricas = criarMetricas(10, 0, mediaGlobal * FATOR, mediaGlobal);

    assert.equal(analisarMetricas(metricas).length, 0);
});

test('Fator de lentidao: acima do fator vezes a media global gera alerta', () => {
    const mediaGlobal = LIMITE_TEMPO * 2;
    const metricas = criarMetricas(10, 0, mediaGlobal * FATOR + 1, mediaGlobal);

    assert.equal(analisarMetricas(metricas).length, 1);
});

test('Rota acima do limite absoluto mas proxima da media global nao e lenta', () => {
    // Todas as rotas lentas por igual: nao ha uma rota anomala.
    const metricas = criarMetricas(10, 0, LIMITE_TEMPO * 4, LIMITE_TEMPO * 3);

    assert.equal(analisarMetricas(metricas).length, 0);
});

test('Com varias rotas, so a rota com problema gera alerta', () => {
    const metricas = {
        tempoMedioMs: 10,
        rotas: {
            '/api/health': { pedidos: 20, erros: 0, tempoMedioMs: 5 },
            '/api/tasks': { pedidos: 10, erros: 1, tempoMedioMs: 12 },
            'rota-desconhecida': { pedidos: 6, erros: 6, tempoMedioMs: 3 }
        }
    };

    const alertas = analisarMetricas(metricas);

    assert.equal(alertas.length, 1);
    assert.equal(alertas[0].rota, 'rota-desconhecida');
    assert.equal(alertas[0].valor, 100);
});

test('Alerta de erros tem todos os campos esperados', () => {
    // 2 erros em 6 pedidos = 33,33% (verifica o arredondamento).
    const metricas = criarMetricas(6, 2, 1, 1);

    assert.deepEqual(analisarMetricas(metricas), [{
        tipo: 'ERROS',
        gravidade: configuracao.gravidade.erros,
        rota: '/api/teste',
        valor: 33.33,
        limite: LIMITE_ERROS,
        mensagem: 'A rota /api/teste apresenta uma taxa de erros de 33.33%.'
    }]);
});

test('Alerta de lentidao tem todos os campos esperados', () => {
    const metricas = criarMetricas(10, 0, 120.5, 20);

    assert.deepEqual(analisarMetricas(metricas), [{
        tipo: 'LENTIDAO',
        gravidade: configuracao.gravidade.lentidao,
        rota: '/api/teste',
        valor: 120.5,
        limite: LIMITE_TEMPO,
        mensagem: 'Possível lentidão na rota /api/teste. Tempo médio: 120.5 ms.'
    }]);
});

test('Sem rotas registadas nao gera alertas', () => {
    assert.deepEqual(analisarMetricas({ tempoMedioMs: 0, rotas: {} }), []);
});
