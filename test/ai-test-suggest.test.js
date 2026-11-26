const test = require('node:test');
const assert = require('node:assert/strict');

// Importar o script não chama o Ollama nem executa código gerado.
const {
    resolverFicheiro,
    validarSugestoes,
    construirFicheiroTeste,
    classificarResultado
} = require('../scripts/ai-test-suggest');

const SUGESTAO = {
    nome: 'PASS sem problemas',
    objetivo: 'Sem problemas o resultado e PASS',
    codigo: "assert.equal(decidirResultado([]), 'PASS');"
};

test('aceita apenas ficheiros .js dentro do projeto', () => {
    assert.equal(resolverFicheiro('scripts/ai-gate.js').relativo, 'scripts/ai-gate.js');

    for (const ficheiro of ['../fora.js', '/etc/passwd', 'package.json', 'config/ai-gate-config.json']) {
        assert.throws(() => resolverFicheiro(ficheiro), /nao permitido/, ficheiro);
    }
});

test('aceita uma resposta com testes completos', () => {
    assert.deepEqual(validarSugestoes({ testes: [SUGESTAO] }), [SUGESTAO]);
    assert.deepEqual(validarSugestoes({ testes: [] }), []);
});

test('rejeita respostas sem lista de testes', () => {
    for (const resposta of [null, {}, { testes: 'texto' }, []]) {
        assert.throws(() => validarSugestoes(resposta), /sem lista de testes/);
    }
});

test('rejeita mais testes do que o limite configurado', () => {
    const { maxTestes } = require('../config/ai-gate-config.json').sugestoesTestes;
    const testes = Array.from({ length: maxTestes + 1 }, () => SUGESTAO);

    assert.throws(() => validarSugestoes({ testes }), /demasiados testes/);
});

test('rejeita testes com campos em falta ou vazios', () => {
    for (const campo of ['nome', 'objetivo', 'codigo']) {
        assert.throws(
            () => validarSugestoes({ testes: [{ ...SUGESTAO, [campo]: '  ' }] }),
            /incompleto/,
            campo
        );
    }
});

test('constroi um ficheiro de teste com as funcoes exportadas', () => {
    const conteudo = construirFicheiroTeste(
        SUGESTAO,
        '/projeto/scripts/ai-gate.js',
        ['decidirResultado', 'separarProblemas']
    );

    assert.ok(conteudo.includes("require('node:test')"));
    assert.ok(conteudo.includes("require('node:assert/strict')"));
    assert.ok(conteudo.includes('const { decidirResultado, separarProblemas } = require("/projeto/scripts/ai-gate.js");'));
    assert.ok(conteudo.includes('test("PASS sem problemas", () => {'));
    assert.ok(conteudo.includes(SUGESTAO.codigo));
});

test('o nome do teste nao consegue fechar a string nem injetar codigo', () => {
    const conteudo = construirFicheiroTeste(
        { ...SUGESTAO, nome: 'x", () => {}); process.exit(0); test("y' },
        '/projeto/m.js',
        []
    );

    assert.ok(conteudo.includes('test("x\\", () => {}); process.exit(0); test(\\"y", () => {'));
});

test('classifica o resultado da execucao do teste', () => {
    assert.equal(classificarResultado(0, 'ok 1'), 'passa');
    assert.equal(classificarResultado(1, 'AssertionError'), 'falha');
    assert.equal(classificarResultado(1, 'SyntaxError: Unexpected token'), 'nao compila');
    assert.equal(classificarResultado(1, 'ReferenceError: x is not defined'), 'erro de execucao');
});

test('extrai o codigo de uma funcao declarada no modulo', () => {
    const { extrairFuncao } = require('../scripts/ai-test-suggest');
    const codigo = [
        'function a() {',
        '    return 1;',
        '}',
        '',
        'function b(x) {',
        '    if (x) {',
        '        return 2;',
        '    }',
        '}',
        'module.exports = { a, b };'
    ].join('\n');

    assert.equal(extrairFuncao(codigo, 'b'), 'function b(x) {\n    if (x) {\n        return 2;\n    }\n}');
    assert.equal(extrairFuncao(codigo, 'a'), 'function a() {\n    return 1;\n}');
    assert.equal(extrairFuncao(codigo, 'c'), null);
});
