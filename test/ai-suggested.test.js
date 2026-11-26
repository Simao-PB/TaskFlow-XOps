const test = require('node:test');
const assert = require('node:assert/strict');

const { separarProblemas } = require('../scripts/ai-gate');

// Testes de separarProblemas (scripts/ai-gate.js) — S5-4, SCRUM-43.
// A função decide que avisos da IA ficam "aprovados" (não bloqueiam a
// pipeline) e não tinha nenhum teste. Ver docs/testes-assistidos-ia.md.

const PROBLEMA = Object.freeze({
    linha: 10,
    gravidade: 'ALTA',
    descricao: 'A função json() de resposta não verifica se o dado é um objeto JSON válido antes de serializá-lo.',
    sugestao: 'Adicione uma validação antes de serializar o dado.'
});

// -----------------------------------------------------------------------
// Parte 1 — sugeridos pela IA (qwen2.5-coder:1.5b, instruções v2,
// workflow "Sugestões de testes com IA", run #3) e corrigidos na revisão.
// -----------------------------------------------------------------------

// IA sugeriu: separarProblemas([], {}) devolve listas vazias.
// Correção: {} sem lista de problemas lança erro (comportamento esperado);
// "sem aprovação" é undefined.
test('[IA, corrigido] sem problemas e sem aprovacao devolve listas vazias', () => {
    assert.deepEqual(separarProblemas([], undefined), {
        problemasAprovados: [],
        problemasPendentes: []
    });
});

// IA sugeriu: assert.throws com aprovação {} e sem verificar a mensagem.
// Problema: {} já lança erro sozinho, por isso o teste passava mesmo sem a
// validação da gravidade (confirmado por mutação). Correção: sem aprovação
// e com a mensagem esperada.
test('[IA, corrigido] gravidade invalida lanca erro de formato', () => {
    assert.throws(
        () => separarProblemas([{ ...PROBLEMA, gravidade: 'INVALIDO' }], undefined),
        /Problema com formato invalido/
    );
});

// IA sugeriu o mesmo padrão para a descrição vazia; mesma correção.
test('[IA, corrigido] descricao vazia lanca erro de formato', () => {
    assert.throws(
        () => separarProblemas([{ ...PROBLEMA, descricao: '' }], undefined),
        /Problema com formato invalido/
    );
});

// -----------------------------------------------------------------------
// Parte 2 — escritos pela equipa: a lógica de aprovação, que a IA não
// cobriu em nenhuma das duas iterações.
// -----------------------------------------------------------------------

test('aprovacao sem lista de problemas lanca erro', () => {
    assert.throws(
        () => separarProblemas([PROBLEMA], {}),
        /Aprovacao manual sem lista de problemas/
    );
});

test('sem aprovacao todos os problemas ficam pendentes', () => {
    const { problemasAprovados, problemasPendentes } = separarProblemas([PROBLEMA], undefined);

    assert.deepEqual(problemasAprovados, []);
    assert.deepEqual(problemasPendentes, [PROBLEMA]);
});

test('aprovacao com lista vazia nao aprova nada', () => {
    const { problemasPendentes } = separarProblemas([PROBLEMA], { problemas: [] });

    assert.deepEqual(problemasPendentes, [PROBLEMA]);
});

test('correspondencia exata aprova o problema', () => {
    const { problemasAprovados, problemasPendentes } =
        separarProblemas([PROBLEMA], { problemas: [{ ...PROBLEMA }] });

    assert.deepEqual(problemasAprovados, [PROBLEMA]);
    assert.deepEqual(problemasPendentes, []);
});

test('correspondencia exata exige a mesma gravidade, linha, descricao e sugestao', () => {
    const variantes = [
        { gravidade: 'MEDIA' },
        { linha: 11 },
        { descricao: PROBLEMA.descricao + ' ' },
        { sugestao: 'Outra sugestão.' }
    ];

    for (const diferenca of variantes) {
        const aprovacao = { problemas: [{ ...PROBLEMA, ...diferenca }] };
        const { problemasPendentes } = separarProblemas([PROBLEMA], aprovacao);

        assert.deepEqual(problemasPendentes, [PROBLEMA], JSON.stringify(diferenca));
    }
});

// Assinatura: mesma gravidade, linha numa lista permitida e descrição que
// começa pelo mesmo texto (com pelo menos 60 caracteres).
const ASSINATURA = Object.freeze({
    gravidade: 'ALTA',
    linhasPermitidas: [10, 12, 15],
    descricaoInicio: PROBLEMA.descricao.slice(0, 60)
});

test('assinatura aprova o mesmo aviso escrito de outra forma noutra linha permitida', () => {
    const reescrito = {
        ...PROBLEMA,
        linha: 15,
        descricao: PROBLEMA.descricao.slice(0, 60) + ' Isto pode tornar o código inválido.',
        sugestao: 'Valide o dado.'
    };

    const { problemasAprovados } = separarProblemas([reescrito], { problemas: [ASSINATURA] });

    assert.deepEqual(problemasAprovados, [reescrito]);
});

test('assinatura com menos de 60 caracteres nao aprova (fronteira 59/60)', () => {
    const curta = { ...ASSINATURA, descricaoInicio: PROBLEMA.descricao.slice(0, 59) };
    const exata = { ...ASSINATURA, descricaoInicio: PROBLEMA.descricao.slice(0, 60) };

    assert.equal(separarProblemas([PROBLEMA], { problemas: [curta] }).problemasPendentes.length, 1);
    assert.equal(separarProblemas([PROBLEMA], { problemas: [exata] }).problemasAprovados.length, 1);
});

test('assinatura nao aprova uma linha fora da lista permitida', () => {
    const { problemasPendentes } =
        separarProblemas([{ ...PROBLEMA, linha: 11 }], { problemas: [ASSINATURA] });

    assert.equal(problemasPendentes.length, 1);
});

test('assinatura nao aprova outra gravidade', () => {
    const { problemasPendentes } =
        separarProblemas([{ ...PROBLEMA, gravidade: 'MEDIA' }], { problemas: [ASSINATURA] });

    assert.equal(problemasPendentes.length, 1);
});

test('assinatura nao aprova uma descricao diferente no inicio', () => {
    const outro = { ...PROBLEMA, descricao: 'X' + PROBLEMA.descricao };
    const { problemasPendentes } = separarProblemas([outro], { problemas: [ASSINATURA] });

    assert.equal(problemasPendentes.length, 1);
});

test('aprova so os problemas abrangidos e mantem a ordem dos restantes', () => {
    const novo = {
        linha: 40,
        gravidade: 'ALTA',
        descricao: 'Uma vulnerabilidade nova que não foi revista pela equipa.',
        sugestao: 'Corrigir.'
    };

    const { problemasAprovados, problemasPendentes } =
        separarProblemas([PROBLEMA, novo], { problemas: [ASSINATURA] });

    assert.deepEqual(problemasAprovados, [PROBLEMA]);
    assert.deepEqual(problemasPendentes, [novo]);
});
