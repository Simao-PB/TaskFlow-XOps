const test = require('node:test');
const assert = require('node:assert/strict');

const { criarMetricas } = require('../src/metrics');

// As duracoes sao passadas diretamente a registarPedido(): os testes
// simulam latencia sem depender de tempos reais (resultados estaveis).

test('estado inicial nao tem pedidos, erros nem rotas', () => {
    const metricas = criarMetricas();

    assert.deepEqual(metricas.obterMetricas(), {
        totalPedidos: 0,
        totalErros: 0,
        taxaErros: 0,
        tempoMedioMs: 0,
        rotas: {}
    });
});

test('codigos abaixo de 400 nao contam como erro e 400 ou mais contam', () => {
    const metricas = criarMetricas();

    metricas.registarPedido('/a', 200, 10);
    metricas.registarPedido('/a', 304, 10);
    metricas.registarPedido('/a', 399, 10);
    metricas.registarPedido('/a', 400, 10);
    metricas.registarPedido('/a', 404, 10);
    metricas.registarPedido('/a', 500, 10);

    const dados = metricas.obterMetricas();

    assert.equal(dados.totalPedidos, 6);
    assert.equal(dados.totalErros, 3);
    assert.equal(dados.rotas['/a'].erros, 3);
});

test('calcula taxa de erros e tempo medio globais com duas casas decimais', () => {
    const metricas = criarMetricas();

    metricas.registarPedido('/a', 200, 10);
    metricas.registarPedido('/a', 200, 20);
    metricas.registarPedido('/b', 500, 15.555);

    const dados = metricas.obterMetricas();

    assert.equal(dados.taxaErros, 33.33);
    assert.equal(dados.tempoMedioMs, 15.19);
});

test('separa pedidos, erros e tempo medio por rota', () => {
    const metricas = criarMetricas();

    metricas.registarPedido('/api/tasks', 200, 10);
    metricas.registarPedido('/api/tasks', 201, 30);
    metricas.registarPedido('rota-desconhecida', 404, 5);

    assert.deepEqual(metricas.obterMetricas().rotas, {
        '/api/tasks': { pedidos: 2, erros: 0, tempoMedioMs: 20 },
        'rota-desconhecida': { pedidos: 1, erros: 1, tempoMedioMs: 5 }
    });
});

test('latencia simulada numa rota afeta a media dessa rota e a global', () => {
    const metricas = criarMetricas();

    for (let i = 0; i < 5; i++) {
        metricas.registarPedido('/rapida', 200, 10);
        metricas.registarPedido('/lenta', 200, 190);
    }

    const dados = metricas.obterMetricas();

    assert.equal(dados.rotas['/rapida'].tempoMedioMs, 10);
    assert.equal(dados.rotas['/lenta'].tempoMedioMs, 190);
    assert.equal(dados.tempoMedioMs, 100);
});

test('instancias de metricas sao independentes', () => {
    const primeira = criarMetricas();
    const segunda = criarMetricas();

    primeira.registarPedido('/a', 500, 10);

    assert.equal(primeira.obterMetricas().totalPedidos, 1);
    assert.equal(segunda.obterMetricas().totalPedidos, 0);
});

test('obterMetricas nao altera os contadores', () => {
    const metricas = criarMetricas();

    metricas.registarPedido('/a', 200, 10);
    metricas.obterMetricas();
    metricas.obterMetricas();

    assert.equal(metricas.obterMetricas().totalPedidos, 1);
});

test('calcularDuracao devolve um valor nao negativo', () => {
    const metricas = criarMetricas();
    const inicio = metricas.iniciarTempo();

    assert.ok(metricas.calcularDuracao(inicio) >= 0);
});
