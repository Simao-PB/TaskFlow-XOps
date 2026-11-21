const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../src/app');

// Testes dos endpoints de monitorizacao com o servidor em execucao.
// Cada teste arranca o seu proprio servidor: as metricas ficam em memoria
// por instancia, por isso um teste nao influencia o seguinte.

const TOKEN = 'token-apenas-para-testes';
const AUTORIZADO = { Authorization: `Bearer ${TOKEN}` };

const ENDPOINTS = ['/api/metrics', '/api/alerts', '/api/alerts/analysis'];

async function iniciarServidor(t) {
    const server = createServer();

    await new Promise(r => server.listen(0, r));
    t.after(() => new Promise(r => server.close(r)));

    return `http://127.0.0.1:${server.address().port}`;
}

async function obterMetricas(base) {
    const resposta = await fetch(base + '/api/metrics', { headers: AUTORIZADO });

    assert.equal(resposta.status, 200);

    return resposta.json();
}

test.beforeEach(() => {
    process.env.METRICS_TOKEN = TOKEN;
});

// ---------------------------------------------------------------
// Autenticacao
// ---------------------------------------------------------------

test('endpoints de monitorizacao devolvem 401 sem token', async t => {
    const base = await iniciarServidor(t);

    for (const endpoint of ENDPOINTS) {
        const resposta = await fetch(base + endpoint);

        assert.equal(resposta.status, 401, endpoint);
        assert.equal((await resposta.json()).erro, 'Acesso nao autorizado', endpoint);
    }
});

test('endpoints de monitorizacao devolvem 401 com token invalido', async t => {
    const base = await iniciarServidor(t);

    const tentativas = [
        'Bearer token-errado',
        `Bearer ${TOKEN}x`,
        `bearer ${TOKEN}`,
        TOKEN,
        'Bearer '
    ];

    for (const endpoint of ENDPOINTS) {
        for (const authorization of tentativas) {
            const resposta = await fetch(base + endpoint, {
                headers: { Authorization: authorization }
            });

            assert.equal(resposta.status, 401, `${endpoint} com "${authorization}"`);
        }
    }
});

test('endpoints de monitorizacao devolvem 503 se METRICS_TOKEN nao estiver configurado', async t => {
    const base = await iniciarServidor(t);

    delete process.env.METRICS_TOKEN;

    for (const endpoint of ENDPOINTS) {
        // Mesmo com um cabecalho que pareca valido, sem token configurado
        // o servidor nao pode autenticar ninguem.
        const resposta = await fetch(base + endpoint, {
            headers: { Authorization: 'Bearer undefined' }
        });

        assert.equal(resposta.status, 503, endpoint);
    }
});

test('respostas 401 dos endpoints de monitorizacao nao revelam dados', async t => {
    const base = await iniciarServidor(t);

    await fetch(base + '/api/health');

    const texto = await (await fetch(base + '/api/metrics')).text();

    assert.ok(!texto.includes('totalPedidos'));
    assert.ok(!texto.includes('/api/health'));
});

// ---------------------------------------------------------------
// /api/alerts
// ---------------------------------------------------------------

test('/api/alerts com token devolve a estrutura esperada e nenhum alerta no arranque', async t => {
    const base = await iniciarServidor(t);

    const resposta = await fetch(base + '/api/alerts', { headers: AUTORIZADO });

    assert.equal(resposta.status, 200);
    assert.ok(resposta.headers.get('content-type').startsWith('application/json'));
    assert.deepEqual(await resposta.json(), { totalAlertas: 0, alertas: [] });
});

test('cenario da demonstracao: 6 pedidos a uma rota inexistente geram alerta ALTA', async t => {
    const base = await iniciarServidor(t);

    for (let i = 0; i < 6; i++) {
        const resposta = await fetch(base + '/rota-que-nao-existe');

        assert.equal(resposta.status, 404);
    }

    const dados = await (await fetch(base + '/api/alerts', { headers: AUTORIZADO })).json();

    assert.equal(dados.totalAlertas, 1);
    assert.equal(dados.alertas.length, 1);

    const [alerta] = dados.alertas;

    assert.equal(alerta.tipo, 'ERROS');
    assert.equal(alerta.gravidade, 'ALTA');
    assert.equal(alerta.rota, 'rota-desconhecida');
    assert.equal(alerta.valor, 100);
});

test('poucos pedidos com erro ainda nao geram alerta', async t => {
    const base = await iniciarServidor(t);

    for (let i = 0; i < 4; i++) {
        await fetch(base + '/rota-que-nao-existe');
    }

    const dados = await (await fetch(base + '/api/alerts', { headers: AUTORIZADO })).json();

    assert.equal(dados.totalAlertas, 0);
});

test('pedidos com sucesso nao geram alertas de erro', async t => {
    const base = await iniciarServidor(t);

    for (let i = 0; i < 10; i++) {
        assert.equal((await fetch(base + '/api/health')).status, 200);
    }

    const dados = await (await fetch(base + '/api/alerts', { headers: AUTORIZADO })).json();

    assert.equal(dados.alertas.filter(a => a.tipo === 'ERROS').length, 0);
});

// ---------------------------------------------------------------
// A monitorizacao nao altera as metricas
// ---------------------------------------------------------------

test('consultar os endpoints de monitorizacao nao altera as metricas', async t => {
    const base = await iniciarServidor(t);

    await fetch(base + '/api/health');
    await fetch(base + '/rota-que-nao-existe');

    const antes = await obterMetricas(base);

    for (let i = 0; i < 3; i++) {
        for (const endpoint of ENDPOINTS) {
            // Com token, sem token e com token invalido.
            await fetch(base + endpoint, { headers: AUTORIZADO });
            await fetch(base + endpoint);
            await fetch(base + endpoint, { headers: { Authorization: 'Bearer x' } });
        }
    }

    const depois = await obterMetricas(base);

    assert.equal(depois.totalPedidos, antes.totalPedidos);
    assert.equal(depois.totalErros, antes.totalErros);
    assert.deepEqual(Object.keys(depois.rotas).sort(), Object.keys(antes.rotas).sort());

    for (const endpoint of ENDPOINTS) {
        assert.equal(depois.rotas[endpoint], undefined, endpoint);
    }
});

test('as metricas refletem os pedidos da aplicacao feitos entre consultas', async t => {
    const base = await iniciarServidor(t);

    await fetch(base + '/api/tasks');
    await fetch(base + '/api/tasks');
    await fetch(base + '/rota-que-nao-existe');

    const dados = await obterMetricas(base);

    assert.equal(dados.totalPedidos, 3);
    assert.equal(dados.totalErros, 1);
    assert.equal(dados.rotas['/api/tasks'].pedidos, 2);
    assert.equal(dados.rotas['rota-desconhecida'].erros, 1);
});
