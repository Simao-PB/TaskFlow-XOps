'use strict';

const GRAVIDADES = new Set(['BAIXA', 'MEDIA', 'ALTA']);

function validarProblemas(problemas) {
    if (!Array.isArray(problemas) || problemas.length > 2) {
        throw new Error('Lista de problemas invalida');
    }

    for (const problema of problemas) {
        if (
            problema === null ||
            typeof problema !== 'object' ||
            !Number.isInteger(problema.linha) ||
            problema.linha < 1 ||
            !GRAVIDADES.has(problema.gravidade) ||
            typeof problema.descricao !== 'string' ||
            !problema.descricao.trim() ||
            typeof problema.sugestao !== 'string' ||
            !problema.sugestao.trim()
        ) {
            throw new Error('Problema com formato invalido');
        }
    }
}

function validarAnalise(analise) {
    if (
        analise === null ||
        typeof analise !== 'object' ||
        Array.isArray(analise) ||
        typeof analise.resumo !== 'string' ||
        !analise.resumo.trim()
    ) {
        throw new Error('Resposta da IA com formato invalido');
    }

    validarProblemas(analise.problemas);
    return analise;
}

function decidirResultado(problemas) {
    validarProblemas(problemas);
    return problemas.some(p => p.gravidade === 'ALTA') ? 'FAIL' : 'PASS';
}

module.exports = { validarAnalise, decidirResultado };
