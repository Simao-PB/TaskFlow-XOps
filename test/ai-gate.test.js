'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validarAnalise, decidirResultado } = require('../scripts/ai-gate');

const aviso = gravidade => ({
    linha: 2,
    gravidade,
    descricao: 'Problema de teste',
    sugestao: 'Corrigir o problema'
});

test('PASS quando nao existem problemas', () => {
    assert.equal(decidirResultado([]), 'PASS');
});

test('PASS para avisos BAIXA e MEDIA', () => {
    assert.equal(decidirResultado([aviso('BAIXA'), aviso('MEDIA')]), 'PASS');
});

test('FAIL para um aviso ALTA', () => {
    assert.equal(decidirResultado([aviso('ALTA')]), 'FAIL');
});

test('FAIL quando ALTA aparece misturada com MEDIA', () => {
    assert.equal(decidirResultado([aviso('MEDIA'), aviso('ALTA')]), 'FAIL');
});

test('Rejeita uma lista inexistente', () => {
    assert.throws(() => decidirResultado(null));
});

test('Rejeita gravidade desconhecida', () => {
    assert.throws(() => decidirResultado([aviso('CRITICA')]));
});

test('Rejeita linha invalida', () => {
    assert.throws(() => decidirResultado([{ ...aviso('ALTA'), linha: 0 }]));
});

test('Rejeita mais problemas do que o limite configurado', () => {
    assert.throws(() => decidirResultado([aviso('BAIXA'), aviso('MEDIA'), aviso('ALTA')]));
});

test('Aceita resposta JSON estruturada valida', () => {
    const resposta = { resumo: 'Analise concluida', problemas: [aviso('MEDIA')] };
    assert.equal(validarAnalise(resposta), resposta);
});

test('Rejeita resposta da IA sem resumo', () => {
    assert.throws(() => validarAnalise({ problemas: [] }));
});

test('Rejeita resposta da IA com problema incompleto', () => {
    assert.throws(() => validarAnalise({ resumo: 'Analise', problemas: [{ gravidade: 'ALTA' }] }));
});
