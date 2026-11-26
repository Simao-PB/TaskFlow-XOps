const test = require('node:test');
const assert = require('node:assert/strict');

// Importar o script nao executa a analise (nem chama o servidor ou o Ollama).
const {
    interpretarRespostaIA,
    validarAnaliseIA
} = require('../scripts/ai-alerts');

const ANALISE_VALIDA = {
    resumo: 'Taxa de erros elevada na rota rota-desconhecida.',
    causaPossivel: 'Hipotese: pedidos a uma rota que nao existe.',
    recomendacao: 'Verificar a origem dos pedidos 404.'
};

test('aceita uma analise com os tres campos preenchidos', () => {
    assert.deepEqual(validarAnaliseIA(ANALISE_VALIDA), ANALISE_VALIDA);
});

test('aceita campos extra devolvidos pela IA', () => {
    const analise = { ...ANALISE_VALIDA, confianca: 'baixa' };

    assert.deepEqual(validarAnaliseIA(analise), analise);
});

test('rejeita analise sem algum dos campos obrigatorios', () => {
    for (const campo of ['resumo', 'causaPossivel', 'recomendacao']) {
        const analise = { ...ANALISE_VALIDA };
        delete analise[campo];

        assert.throws(
            () => validarAnaliseIA(analise),
            { message: 'Resposta da IA incompleta' },
            `sem ${campo}`
        );
    }
});

test('rejeita campos vazios ou so com espacos', () => {
    for (const valor of ['', '   ', '\n\t']) {
        assert.throws(
            () => validarAnaliseIA({ ...ANALISE_VALIDA, causaPossivel: valor }),
            { message: 'Resposta da IA incompleta' }
        );
    }
});

test('rejeita campos com tipo errado', () => {
    for (const valor of [null, 42, true, ['texto'], { texto: 'x' }]) {
        assert.throws(
            () => validarAnaliseIA({ ...ANALISE_VALIDA, recomendacao: valor }),
            { message: 'Resposta da IA incompleta' },
            JSON.stringify(valor)
        );
    }
});

test('rejeita respostas que nao sao um objeto', () => {
    for (const analise of [null, undefined, 'texto', 42, [], [ANALISE_VALIDA]]) {
        assert.throws(
            () => validarAnaliseIA(analise),
            { message: 'Resposta da IA incompleta' },
            JSON.stringify(analise)
        );
    }
});

test('interpreta texto JSON valido devolvido pela IA', () => {
    assert.deepEqual(
        interpretarRespostaIA(JSON.stringify(ANALISE_VALIDA)),
        ANALISE_VALIDA
    );
});

test('rejeita JSON incompleto, como numa resposta cortada por limite de geracao', () => {
    // Simula o problema "Motivo de conclusao: length" visto no AI Gate.
    const cortado = JSON.stringify(ANALISE_VALIDA).slice(0, 40);

    assert.throws(
        () => interpretarRespostaIA(cortado),
        { message: 'Resposta da IA nao e JSON valido' }
    );
});

test('rejeita texto vazio ou que nao e JSON', () => {
    for (const texto of ['', 'Aqui esta a analise:', undefined]) {
        assert.throws(
            () => interpretarRespostaIA(texto),
            { message: 'Resposta da IA nao e JSON valido' },
            String(texto)
        );
    }
});

test('JSON valido mas sem os campos esperados e rejeitado na validacao', () => {
    const analise = interpretarRespostaIA('{"resposta": "tudo bem"}');

    assert.throws(
        () => validarAnaliseIA(analise),
        { message: 'Resposta da IA incompleta' }
    );
});

// -----------------------------------------------------------------------
// Endereco do TaskFlow (TASKFLOW_URL) — S5-7, SCRUM-46.
// -----------------------------------------------------------------------

const { resolverEnderecoAlertas } = require('../scripts/ai-alerts');

test('sem TASKFLOW_URL usa a instancia local', () => {
    for (const valor of [undefined, '', '   ']) {
        assert.equal(resolverEnderecoAlertas(valor), 'http://127.0.0.1:3000/api/alerts');
    }
});

test('aceita outro endereco, com ou sem barra final e caminho base', () => {
    assert.equal(resolverEnderecoAlertas('http://localhost:8080'), 'http://localhost:8080/api/alerts');
    assert.equal(resolverEnderecoAlertas('https://exemplo.pt/'), 'https://exemplo.pt/api/alerts');
    assert.equal(resolverEnderecoAlertas('https://exemplo.pt/taskflow'), 'https://exemplo.pt/taskflow/api/alerts');
});

test('rejeita enderecos para onde o token nao deve ser enviado', () => {
    const casos = [
        ['nao e um url', /TASKFLOW_URL invalido/],
        ['ftp://exemplo.pt', /http ou https/],
        ['file:///etc/passwd', /http ou https/],
        ['http://utilizador:senha@exemplo.pt', /credenciais/],
        ['http://exemplo.pt/?destino=outro', /parametros/],
        ['http://exemplo.pt/#x', /fragmento/]
    ];

    for (const [valor, erro] of casos) {
        assert.throws(() => resolverEnderecoAlertas(valor), erro, valor);
    }
});
