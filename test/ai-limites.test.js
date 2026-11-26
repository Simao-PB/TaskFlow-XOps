const test = require('node:test');
const assert = require('node:assert/strict');

const configuracao = require('../config/ai-gate-config.json');
const { esquema: esquemaSugestoes } = require('../scripts/ai-test-suggest');

// Teste de contrato (AFL-06 e AFL-10): a resposta máxima permitida pelo
// esquema JSON de cada componente de IA tem de caber em num_predict.
// Se não couber, o modelo pode ser cortado ("length") e devolver JSON
// inválido. Estimativa conservadora: 1 token por carácter, mais uma margem
// para chaves, aspas, vírgulas e números do JSON.
const MARGEM_BASE = 100;
const MARGEM_POR_ITEM = 80;
const ORCAMENTO = configuracao.opcoes.num_predict;

test('AI Gate: resposta maxima cabe em num_predict', () => {
    const limites = configuracao.maxCaracteres;
    const maximo =
        MARGEM_BASE +
        limites.resumo +
        configuracao.maxProblemas * (limites.descricao + limites.sugestao + MARGEM_POR_ITEM);

    assert.ok(maximo <= ORCAMENTO, `${maximo} caracteres > num_predict ${ORCAMENTO}`);
});

test('Sugestoes de testes: resposta maxima cabe em num_predict', () => {
    const testes = esquemaSugestoes.properties.testes;
    const campos = testes.items.properties;
    const porTeste = Object.values(campos).reduce((total, c) => total + c.maxLength, 0);
    const maximo = MARGEM_BASE + testes.maxItems * (porTeste + MARGEM_POR_ITEM);

    assert.ok(maximo <= ORCAMENTO, `${maximo} caracteres > num_predict ${ORCAMENTO}`);
});

test('todos os textos dos esquemas tem maxLength', () => {
    for (const [nome, campo] of Object.entries(esquemaSugestoes.properties.testes.items.properties)) {
        assert.ok(Number.isInteger(campo.maxLength), nome);
    }

    for (const nome of ['resumo', 'descricao', 'sugestao']) {
        assert.ok(Number.isInteger(configuracao.maxCaracteres[nome]), nome);
    }
});
