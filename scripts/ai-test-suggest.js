'use strict';

// S5-4 (SCRUM-43) — Testes assistidos por IA.
//
// Pede ao modelo local (Ollama) sugestões de testes unitários para uma
// função de um módulo. As sugestões NÃO entram automaticamente no projeto:
// são revistas por uma pessoa antes de serem copiadas para test/.
//
// Uso:
//   node scripts/ai-test-suggest.js <ficheiro.js> <funcao>            (só sugere)
//   node scripts/ai-test-suggest.js <ficheiro.js> <funcao> --executar (sugere e executa)
//
// --executar corre o código gerado pela IA. Use-o apenas num ambiente
// descartável (o runner do GitHub Actions), nunca no computador pessoal.

const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');

const configuracaoIA = require('../config/ai-gate-config.json');

const raiz = path.resolve(__dirname, '..');

// Limites versionados em config/ai-gate-config.json. O total máximo
// (maxTestes x soma dos maxCaracteres) tem de caber em num_predict, senão
// a resposta pode ser cortada ("length"); ver test/ai-limites.test.js.
const { maxTestes: MAX_TESTES, maxCaracteres: LIMITES } = configuracaoIA.sugestoesTestes;

const esquema = {
    type: 'object',
    properties: {
        testes: {
            type: 'array',
            maxItems: MAX_TESTES,
            items: {
                type: 'object',
                properties: {
                    nome: { type: 'string', maxLength: LIMITES.nome },
                    objetivo: { type: 'string', maxLength: LIMITES.objetivo },
                    codigo: { type: 'string', maxLength: LIMITES.codigo }
                },
                required: ['nome', 'objetivo', 'codigo']
            }
        }
    },
    required: ['testes']
};

// Só aceita ficheiros .js dentro do projeto.
function resolverFicheiro(ficheiro) {
    const caminho = path.resolve(raiz, ficheiro);
    const relativo = path.relative(raiz, caminho);

    if (
        relativo.startsWith('..') ||
        path.isAbsolute(relativo) ||
        path.extname(caminho) !== '.js'
    ) {
        throw new Error('Ficheiro fora do projeto ou nao permitido');
    }

    // Sempre com "/" (no Windows path.relative devolve "\\"), para o
    // relatorio e as instrucoes da IA serem iguais em qualquer sistema.
    return { caminho, relativo: relativo.split(path.sep).join('/') };
}

// Extrai o código de uma função declarada com "function nome(" para o
// enviar em destaque ao modelo (o módulo completo segue como contexto).
function extrairFuncao(codigo, funcao) {
    const linhas = codigo.split('\n');
    const inicio = linhas.findIndex(l => l.startsWith(`function ${funcao}(`));

    if (inicio === -1) {
        return null;
    }

    let fim = inicio + 1;

    while (fim < linhas.length && !linhas[fim - 1].startsWith('}')) {
        fim++;
    }

    return linhas.slice(inicio, fim).join('\n');
}

// Valida a estrutura da resposta do modelo.
function validarSugestoes(resposta) {
    if (!resposta || typeof resposta !== 'object' || !Array.isArray(resposta.testes)) {
        throw new Error('Resposta da IA sem lista de testes');
    }

    if (resposta.testes.length > MAX_TESTES) {
        throw new Error('Resposta da IA com demasiados testes');
    }

    for (const teste of resposta.testes) {
        for (const campo of ['nome', 'objetivo', 'codigo']) {
            // eslint-disable-next-line security/detect-object-injection -- campo vem de uma lista fixa.
            const valor = teste && teste[campo];

            if (typeof valor !== 'string' || !valor.trim()) {
                throw new Error('Teste sugerido incompleto');
            }
        }
    }

    return resposta.testes;
}

// Gera um ficheiro de teste autónomo para uma sugestão.
function construirFicheiroTeste(sugestao, caminhoModulo, nomesExportados) {
    const importacao = nomesExportados.length
        ? `const { ${nomesExportados.join(', ')} } = require(${JSON.stringify(caminhoModulo)});`
        : '';

    return [
        "'use strict';",
        "const test = require('node:test');",
        "const assert = require('node:assert/strict');",
        importacao,
        '',
        `test(${JSON.stringify(sugestao.nome)}, () => {`,
        sugestao.codigo,
        '});',
        ''
    ].join('\n');
}

// Classifica o resultado de "node --test" para uma sugestão.
function classificarResultado(codigoSaida, saida) {
    if (/SyntaxError/.test(saida)) {
        return 'nao compila';
    }

    if (/ReferenceError|TypeError: .* is not a function/.test(saida)) {
        return 'erro de execucao';
    }

    return codigoSaida === 0 ? 'passa' : 'falha';
}

function executarTeste(ficheiro) {
    return new Promise(resolve => {
        execFile(
            process.execPath,
            ['--test', ficheiro],
            { timeout: 10000, env: { PATH: process.env.PATH } },
            (erro, stdout, stderr) => {
                const codigo = erro ? (erro.code ?? 1) : 0;
                resolve({ codigo, saida: `${stdout}\n${stderr}` });
            }
        );
    });
}

async function pedirSugestoes(codigo, relativo, funcao) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- caminho fixo dentro do projeto.
    const instrucoes = await fs.readFile(
        path.join(raiz, 'config', 'ai-test-prompt.txt'),
        'utf8'
    );

    const linhasNumeradas = codigo
        .split('\n')
        .map((linha, indice) => `${indice + 1}: ${linha}`)
        .join('\n');

    const resposta = await fetch('http://127.0.0.1:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: configuracaoIA.modelo,
            system: instrucoes,
            prompt:
                `Funcao a testar: ${funcao}\n\n` +
                `Codigo da funcao ${funcao}:\n${extrairFuncao(codigo, funcao) || '(nao encontrado)'}\n\n` +
                `Modulo completo (${relativo}), apenas como contexto:\n` +
                linhasNumeradas,
            format: esquema,
            stream: false,
            options: configuracaoIA.opcoes
        }),
        signal: AbortSignal.timeout(configuracaoIA.timeoutMs)
    });

    if (!resposta.ok) {
        throw new Error(`Erro Ollama: HTTP ${resposta.status}`);
    }

    const dados = await resposta.json();

    console.log('Motivo de conclusão:', dados.done_reason);

    let analise;

    try {
        analise = JSON.parse(dados.response);
    } catch {
        console.log('Inicio da resposta:', String(dados.response).slice(0, 300));
        throw new Error('Resposta da IA nao e JSON valido');
    }

    return validarSugestoes(analise);
}

async function principal() {
    const [ficheiro, funcao] = process.argv.slice(2).filter(a => !a.startsWith('--'));
    const executar = process.argv.includes('--executar');

    if (!ficheiro || !funcao) {
        throw new Error('Uso: node scripts/ai-test-suggest.js <ficheiro.js> <funcao> [--executar]');
    }

    const { caminho, relativo } = resolverFicheiro(ficheiro);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- caminho validado por resolverFicheiro.
    const codigo = await fs.readFile(caminho, 'utf8');
    // eslint-disable-next-line security/detect-non-literal-require -- caminho validado por resolverFicheiro.
    const nomesExportados = Object.keys(require(caminho));

    if (!nomesExportados.includes(funcao)) {
        throw new Error(`A funcao ${funcao} nao e exportada por ${relativo}`);
    }

    const sugestoes = await pedirSugestoes(codigo, relativo, funcao);

    const pastaTemporaria = executar
        ? await fs.mkdtemp(path.join(os.tmpdir(), 'taskflow-ai-tests-'))
        : null;

    const resultados = [];

    for (const [indice, sugestao] of sugestoes.entries()) {
        let resultado = 'nao executado';

        if (executar) {
            const ficheiroTeste = path.join(pastaTemporaria, `sugestao-${indice + 1}.test.js`);
            // eslint-disable-next-line security/detect-non-literal-fs-filename -- ficheiro numa pasta temporaria criada pelo script.
            await fs.writeFile(
                ficheiroTeste,
                construirFicheiroTeste(sugestao, caminho, nomesExportados)
            );
            const { codigo: saidaCodigo, saida } = await executarTeste(ficheiroTeste);
            resultado = classificarResultado(saidaCodigo, saida);
        }

        resultados.push({ ...sugestao, resultado });

        console.log(`\n=== Sugestão ${indice + 1}: ${sugestao.nome}`);
        console.log(`Objetivo: ${sugestao.objetivo}`);
        console.log(`Resultado automático: ${resultado}`);
        console.log('Código:');
        console.log(sugestao.codigo);
    }

    const relatorio = {
        modelo: configuracaoIA.modelo,
        data: new Date().toISOString(),
        ficheiro: relativo,
        funcao,
        executado: executar,
        sugestoes: resultados
    };

    const pastaRelatorios = path.join(raiz, 'reports');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- pasta fixa reports/ do projeto.
    await fs.mkdir(pastaRelatorios, { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- ficheiro fixo em reports/.
    await fs.writeFile(
        path.join(pastaRelatorios, 'ai-test-suggestions.json'),
        JSON.stringify(relatorio, null, 2)
    );

    const contagem = resultados.reduce((total, r) => {
        total[r.resultado] = (total[r.resultado] || 0) + 1;
        return total;
    }, {});

    console.log('\n=== Resumo:', JSON.stringify(contagem));
    console.log('Relatorio guardado em reports/ai-test-suggestions.json');
    console.log('As sugestoes devem ser revistas antes de entrarem em test/.');
}

if (require.main === module) {
    principal().catch(erro => {
        console.error('Erro:', erro.message);
        process.exitCode = 1;
    });
}

module.exports = {
    esquema,
    extrairFuncao,
    resolverFicheiro,
    validarSugestoes,
    construirFicheiroTeste,
    classificarResultado
};
