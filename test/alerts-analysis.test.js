const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('../src/app');

// Testes de GET /api/alerts/analysis. Cada teste usa um relatorio numa
// pasta temporaria: o relatorio real em reports/ nunca e lido nem alterado.
// Nao ha chamadas ao Ollama: o conteudo do relatorio e fixo.

const TOKEN = 'token-apenas-para-testes';
const AUTORIZADO = { Authorization: `Bearer ${TOKEN}` };

const RELATORIO_EXEMPLO = {
    modelo: 'qwen2.5-coder:1.5b',
    data: '2026-11-21T10:00:00.000Z',
    totalAlertas: 1,
    alertas: [{
        tipo: 'ERROS',
        gravidade: 'ALTA',
        rota: 'rota-desconhecida',
        valor: 100,
        limite: 20,
        mensagem: 'A rota rota-desconhecida apresenta uma taxa de erros de 100.00%.'
    }],
    analiseIA: {
        resumo: 'Taxa de erros elevada numa rota.',
        causaPossivel: 'Hipotese: pedidos a uma rota inexistente.',
        recomendacao: 'Verificar a origem dos pedidos.'
    }
};

async function iniciarServidor(t) {
    process.env.METRICS_TOKEN = TOKEN;

    const pasta = await fs.mkdtemp(path.join(os.tmpdir(), 'taskflow-analise-'));
    const relatorioAlertasPath = path.join(pasta, 'ai-alerts.json');

    const server = createServer({ relatorioAlertasPath });

    await new Promise(r => server.listen(0, r));

    t.after(async () => {
        await new Promise(r => server.close(r));
        await fs.rm(pasta, { recursive: true, force: true });
    });

    return {
        base: `http://127.0.0.1:${server.address().port}`,
        relatorioAlertasPath
    };
}

function pedirAnalise(base, headers = AUTORIZADO) {
    return fetch(base + '/api/alerts/analysis', { headers });
}

test('sem relatorio de IA devolve 404 com mensagem clara', async t => {
    const { base } = await iniciarServidor(t);

    const resposta = await pedirAnalise(base);

    assert.equal(resposta.status, 404);
    assert.deepEqual(await resposta.json(), {
        erro: 'Analise de IA ainda nao disponivel'
    });
});

test('com relatorio valido devolve 200 e o conteudo guardado', async t => {
    const { base, relatorioAlertasPath } = await iniciarServidor(t);

    await fs.writeFile(relatorioAlertasPath, JSON.stringify(RELATORIO_EXEMPLO));

    const resposta = await pedirAnalise(base);

    assert.equal(resposta.status, 200);
    assert.equal(resposta.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await resposta.json(), RELATORIO_EXEMPLO);
});

test('com relatorio corrompido devolve 500 sem expor o conteudo', async t => {
    const { base, relatorioAlertasPath } = await iniciarServidor(t);

    await fs.writeFile(relatorioAlertasPath, '{"resumo": "incompleto"');

    const resposta = await pedirAnalise(base);
    const texto = await resposta.text();

    assert.equal(resposta.status, 500);
    assert.deepEqual(JSON.parse(texto), { erro: 'Relatorio de IA invalido' });
    assert.ok(!texto.includes('incompleto'));
});

test('erro de leitura diferente de ficheiro inexistente devolve 500', async t => {
    const { base, relatorioAlertasPath } = await iniciarServidor(t);

    // Uma pasta no lugar do ficheiro provoca um erro de leitura (EISDIR).
    await fs.mkdir(relatorioAlertasPath);

    const resposta = await pedirAnalise(base);

    assert.equal(resposta.status, 500);
    assert.deepEqual(await resposta.json(), { erro: 'Erro ao ler a analise' });
});

test('devolve sempre a versao mais recente do relatorio', async t => {
    const { base, relatorioAlertasPath } = await iniciarServidor(t);

    await fs.writeFile(relatorioAlertasPath, JSON.stringify(RELATORIO_EXEMPLO));
    assert.equal((await (await pedirAnalise(base)).json()).totalAlertas, 1);

    const novo = { ...RELATORIO_EXEMPLO, totalAlertas: 0, alertas: [] };
    await fs.writeFile(relatorioAlertasPath, JSON.stringify(novo));

    assert.equal((await (await pedirAnalise(base)).json()).totalAlertas, 0);
});

test('sem token ou com token invalido nao revela o relatorio existente', async t => {
    const { base, relatorioAlertasPath } = await iniciarServidor(t);

    await fs.writeFile(relatorioAlertasPath, JSON.stringify(RELATORIO_EXEMPLO));

    for (const headers of [{}, { Authorization: 'Bearer token-errado' }]) {
        const resposta = await pedirAnalise(base, headers);
        const texto = await resposta.text();

        assert.equal(resposta.status, 401);
        assert.ok(!texto.includes('analiseIA'));
        assert.ok(!texto.includes(RELATORIO_EXEMPLO.analiseIA.resumo));
    }
});

test('sem a opcao, createServer continua a funcionar com o caminho por defeito', async t => {
    process.env.METRICS_TOKEN = TOKEN;

    const server = createServer();

    await new Promise(r => server.listen(0, r));
    t.after(() => new Promise(r => server.close(r)));

    const resposta = await pedirAnalise(`http://127.0.0.1:${server.address().port}`);

    // 404 se ainda nao foi gerado nenhum relatorio local, 200 se ja existir.
    assert.ok([200, 404].includes(resposta.status), `HTTP ${resposta.status}`);
});
