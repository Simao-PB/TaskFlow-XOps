
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const {
    validarAnalise,
    decidirResultado,
    separarProblemas
} = require('./ai-gate');

const configuracaoIA = require('../config/ai-gate-config.json');

const modelo = configuracaoIA.modelo;
const raiz = path.resolve(__dirname, '..');
const ficheiro = process.argv[2] || 'src/app.js';

// maxLength limita o tamanho de cada texto. O Ollama obriga o modelo a
// respeitar o esquema, por isso a resposta maxima fica muito abaixo de
// num_predict: se o modelo entrar em repeticao, o texto e terminado em vez
// de a geracao esgotar os tokens e devolver JSON cortado ("length").
const limites = configuracaoIA.maxCaracteres;

const esquema = {
    type: 'object',
    properties: {
        resumo: { type: 'string', maxLength: limites.resumo },
        problemas: {
            type: 'array',
            maxItems: configuracaoIA.maxProblemas,
            items: {
                type: 'object',
                properties: {
                    linha: { type: 'integer' },
                    gravidade: {
                        type: 'string',
                        enum: ['BAIXA', 'MEDIA', 'ALTA']
                    },
                    descricao: { type: 'string', maxLength: limites.descricao },
                    sugestao: { type: 'string', maxLength: limites.sugestao }
                },
                required: [
                    'linha',
                    'gravidade',
                    'descricao',
                    'sugestao'
                ]
            }
        }
    },
    required: ['resumo', 'problemas']
};

async function analisarCodigo() {
    const caminho = path.resolve(raiz, ficheiro);
    const relativo = path.relative(raiz, caminho);

    if (
        relativo.startsWith('..') ||
        path.isAbsolute(relativo) ||
        path.extname(caminho) !== '.js'
    ) {
        throw new Error('Ficheiro fora do projeto ou nao permitido');
    }

    const codigo = await fs.readFile(caminho, 'utf8');

    if (codigo.length > 15000) {
        throw new Error('Ficheiro demasiado grande para esta analise');
    }

    const linhasNumeradas = codigo
        .split('\n')
        .map((linha, indice) => `${indice + 1}: ${linha}`)
        .join('\n');

    const hash = crypto
        .createHash('sha256')
        .update(codigo.replace(/\r\n/g, '\n'))
        .digest('hex');

    const prompt = await fs.readFile(
        path.join(raiz, 'config', 'ai-gate-prompt.txt'),
        'utf8'
    );

    const resposta = await fetch(
        'http://127.0.0.1:11434/api/generate',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: modelo,
                system: prompt,
                prompt: `Analisa o ficheiro ${relativo}:\n\n${linhasNumeradas}`,
                format: esquema,
                stream: false,
                options: configuracaoIA.opcoes
            }),
            signal: AbortSignal.timeout(configuracaoIA.timeoutMs)
        }
    );

    if (!resposta.ok) {
        throw new Error(`Erro Ollama: HTTP ${resposta.status}`);
    }

    const dados = await resposta.json();

    console.log('Motivo de conclusão:', dados.done_reason);

    let analise;

    try {
        analise = JSON.parse(dados.response);
    } catch {
        throw new Error(
            'A IA devolveu um JSON inválido ou incompleto. ' +
            'Motivo de conclusão: ' + dados.done_reason
        );
    }

    validarAnalise(analise);

    const resultadoIA = decidirResultado(
        analise.problemas,
        configuracaoIA.limiteRejeicao
    );

    const configuracao = JSON.parse(
        await fs.readFile(
            path.join(raiz, 'config', 'ai-gate-approvals.json'),
            'utf8'
        )
    );

    const aprovacao = configuracao.aprovacoes.find(
        item =>
            item.ficheiro === relativo.split(path.sep).join('/') &&
            item.sha256 === hash
    );

    const {
        problemasAprovados,
        problemasPendentes
    } = separarProblemas(analise.problemas, aprovacao);

    const resultado = decidirResultado(
        problemasPendentes,
        configuracaoIA.limiteRejeicao
    );

    const falhou = resultado === 'FAIL';

    const relatorio = {
        ficheiro: relativo,
        hash,
        modelo,
        configuracao: {
            ...configuracaoIA.opcoes,
            limiteRejeicao: configuracaoIA.limiteRejeicao,
            versaoPrompt: configuracaoIA.versaoPrompt
        },
        resultado,
        resultadoIA,
        revisaoManual: {
            aplicada: problemasAprovados.length > 0,
            motivo: problemasAprovados.length > 0
                ? aprovacao.motivo
                : null,
            quantidadeAprovada: problemasAprovados.length
        },
        resumo: analise.resumo,
        problemas: analise.problemas,
        problemasPendentes
    };

    const pasta = path.join(raiz, 'reports');

    await fs.mkdir(pasta, { recursive: true });

    await fs.writeFile(
        path.join(pasta, 'ai-review.json'),
        JSON.stringify(relatorio, null, 2)
    );

    console.log('\n=== TASKFLOW AI REVIEW ===');
    console.log('Modelo:', modelo);
    console.log('Ficheiro:', relativo);

    console.log('Resultado original da IA:', resultadoIA);
    console.log('Resultado final:', resultado);

    console.log('Problemas encontrados:', analise.problemas.length);
    console.log('Problemas aprovados:', problemasAprovados.length);
    console.log('Problemas pendentes:', problemasPendentes.length);

    console.log('\nResumo:', analise.resumo);

    for (const problema of analise.problemas) {
        console.log(
            `\n[${problema.gravidade}] Linha ${problema.linha}`
        );

        console.log(problema.descricao);
        console.log('Sugestao:', problema.sugestao);
    }

    console.log('\nRelatorio guardado em reports/ai-review.json');

    if (falhou) {
        process.exitCode = 1;
    }
}

analisarCodigo().catch(erro => {
    console.error('\nErro na analise:', erro.message);
    process.exitCode = 1;
});
