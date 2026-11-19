
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { validarAnalise, decidirResultado } = require('./ai-gate');

const configuracaoIA = require('../config/ai-gate-config.json');
const modelo = configuracaoIA.modelo;
const raiz = path.resolve(__dirname, '..');
const ficheiro = process.argv[2] || 'src/app.js';

const esquema = {
    type: 'object',
    properties: {
        resumo: { type: 'string' },
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
                    descricao: { type: 'string' },
                    sugestao: { type: 'string' }
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
    
    const linhasNumeradas = codigo
    .split('\n')
    .map((linha, indice) => `${indice + 1}: ${linha}`)
    .join('\n');

    if (codigo.length > 15000) {
        throw new Error('Ficheiro demasiado grande para esta analise');
    }

    const hash = crypto
        .createHash('sha256')
        .update(codigo.replace(/\r\n/g, '\n'))
        .digest('hex');

    const resposta = await fetch(
        'http://127.0.0.1:11434/api/generate',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: modelo,

                system: await fs.readFile(
                    path.join(raiz, 'config', 'ai-gate-prompt.txt'),
                    'utf8'
                ),

                prompt:
                    `Analisa o ficheiro ${relativo}:\n\n${linhasNumeradas}`,

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
            path.join(raiz, 'config/ai-gate-approvals.json'),
            'utf8'
        )
    );

    const aprovacao = configuracao.aprovacoes.find(
        item =>
            item.ficheiro === relativo.split(path.sep).join('/') &&
            item.sha256 === hash
    );

    const resultado =
        resultadoIA === 'FAIL' && aprovacao
            ? 'PASS'
            : resultadoIA;

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
        revisaoManual: aprovacao
            ? { aplicada: true, motivo: aprovacao.motivo }
            : { aplicada: false },
        resumo: analise.resumo,
        problemas: analise.problemas
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
    console.log('Resultado:', relatorio.resultado);
    console.log('Problemas:', relatorio.problemas.length);
    console.log('\nResumo:', relatorio.resumo);

    for (const problema of relatorio.problemas) {
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
