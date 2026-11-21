const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../src/app');
const { CABECALHOS_SEGURANCA } = require('../src/security-headers');

let server, base;

test.before(async () => {
    process.env.METRICS_TOKEN = 'token-apenas-para-testes';
    server = createServer();

    await new Promise(r => server.listen(0, r));

    base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
    await new Promise(r => server.close(r));
});

function verificarCabecalhosSeguranca(resposta) {
    for (const [nome, valor] of Object.entries(CABECALHOS_SEGURANCA)) {
        assert.equal(resposta.headers.get(nome), valor, `Cabecalho ${nome}`);
    }
}

// Avisos ZAP 10020, 10038, 10063 e 90004 na pagina inicial
test('pagina inicial envia os cabecalhos de seguranca', async () => {
    const resposta = await fetch(base + '/');

    assert.equal(resposta.status, 200);
    verificarCabecalhosSeguranca(resposta);
});

test('dashboard envia os cabecalhos de seguranca', async () => {
    const resposta = await fetch(base + '/dashboard');

    assert.equal(resposta.status, 200);
    verificarCabecalhosSeguranca(resposta);
});

test('respostas da API enviam cabecalhos de seguranca e nao ficam em cache', async () => {
    for (const rota of ['/api/health', '/api/tasks', '/api/metrics', '/rota-inexistente']) {
        const resposta = await fetch(base + rota);

        verificarCabecalhosSeguranca(resposta);
        assert.equal(resposta.headers.get('cache-control'), 'no-store', rota);
    }
});

test('CSP nao permite scripts ou estilos inline', () => {
    const csp = CABECALHOS_SEGURANCA['Content-Security-Policy'];

    assert.ok(csp.includes("script-src 'self'"));
    assert.ok(csp.includes("style-src 'self'"));
    assert.ok(csp.includes("frame-ancestors 'none'"));
    assert.ok(!csp.includes('unsafe-inline'));
    assert.ok(!csp.includes('unsafe-eval'));
});

// Garante que a CSP nao parte as paginas: nao pode haver codigo inline.
test('paginas HTML nao tem scripts, estilos ou eventos inline', async () => {
    for (const rota of ['/', '/dashboard']) {
        const html = await (await fetch(base + rota)).text();

        assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(html), `script inline em ${rota}`);
        assert.ok(!/<style\b/i.test(html), `style inline em ${rota}`);
        assert.ok(!/\son[a-z]+\s*=/i.test(html), `evento inline em ${rota}`);
    }
});

test('ficheiros JavaScript e CSS das paginas sao servidos com o tipo correto', async () => {
    const esperados = {
        '/app.js': 'text/javascript',
        '/dashboard.js': 'text/javascript',
        '/dashboard.css': 'text/css',
        '/styles.css': 'text/css'
    };

    for (const [rota, tipo] of Object.entries(esperados)) {
        const resposta = await fetch(base + rota);

        assert.equal(resposta.status, 200, rota);
        assert.ok(resposta.headers.get('content-type').startsWith(tipo), rota);
        verificarCabecalhosSeguranca(resposta);
    }
});

test('caminhos fora da lista de ficheiros publicos devolvem 404', async () => {
    for (const rota of ['/package.json', '/src/app.js', '/../package.json', '/public/app.js']) {
        const resposta = await fetch(base + rota);

        assert.equal(resposta.status, 404, rota);
    }
});
