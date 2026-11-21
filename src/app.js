const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { criarMetricas } = require('./metrics');
const { analisarMetricas } = require('./alerts');
const { CABECALHOS_SEGURANCA, CABECALHOS_API } = require('./security-headers');

let nextId = 1;
const tasks = [];

// Ficheiros publicos servidos pelo servidor: lista fixa, o caminho pedido
// nunca e usado diretamente para aceder ao disco.
const PASTA_PUBLICA = path.join(__dirname, '../public');

const HTML = 'text/html; charset=utf-8';
const CSS = 'text/css; charset=utf-8';
const JS = 'text/javascript; charset=utf-8';

const FICHEIROS_PUBLICOS = new Map([
    ['/', ['index.html', HTML]],
    ['/index.html', ['index.html', HTML]],
    ['/dashboard', ['dashboard.html', HTML]],
    ['/dashboard.html', ['dashboard.html', HTML]],
    ['/styles.css', ['styles.css', CSS]],
    ['/dashboard.css', ['dashboard.css', CSS]],
    ['/app.js', ['app.js', JS]],
    ['/dashboard.js', ['dashboard.js', JS]]
]);

// Função para enviar respostas JSON
function json(res, status, data) {
    res.writeHead(status, {
        ...CABECALHOS_SEGURANCA,
        ...CABECALHOS_API,
        'Content-Type': 'application/json; charset=utf-8'
    });

    res.end(JSON.stringify(data));
}

// Função para enviar um ficheiro publico da lista fixa
function enviarFicheiro(res, nome, tipo) {
    const caminho = path.join(PASTA_PUBLICA, nome);

    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Nome vem da lista fixa FICHEIROS_PUBLICOS.
    fs.readFile(caminho, (err, conteudo) => {
        if (err) {
            return json(res, 404, {
                erro: 'Ficheiro não encontrado'
            });
        }

        res.writeHead(200, {
            ...CABECALHOS_SEGURANCA,
            'Content-Type': tipo
        });

        res.end(conteudo);
    });
}

// Caminho por defeito do relatorio gerado por scripts/ai-alerts.js
const RELATORIO_ALERTAS_PADRAO = path.join(__dirname, '../reports/ai-alerts.json');

// Criar servidor
// opcoes.relatorioAlertasPath: usado apenas pelos testes, para lerem um
// ficheiro temporario em vez de tocarem no relatorio real em reports/.
function createServer(opcoes = {}) {
    const metricas = criarMetricas();
    const relatorioAlertasPath =
        opcoes.relatorioAlertasPath || RELATORIO_ALERTAS_PADRAO;
    return http.createServer(async (req, res) => {
        const url = new URL(req.url, 'http://localhost');

        const inicio = metricas.iniciarTempo();

        let rota = 'rota-desconhecida';

        if (/^\/api\/tasks\/\d+\/toggle$/.test(url.pathname)) {
            rota = '/api/tasks/:id/toggle';
            } else if (FICHEIROS_PUBLICOS.has(url.pathname) || [
                '/api/health',
                '/api/tasks',
                '/api/metrics',
                '/api/alerts',
                '/api/alerts/analysis'
            ].includes(url.pathname)) {
            rota = url.pathname;
        }

        res.once('finish', () => {
            if (![
                '/api/metrics',
                '/api/alerts',
                '/api/alerts/analysis'
            ].includes(rota)) {
                const duracao = metricas.calcularDuracao(inicio);

                metricas.registarPedido(
                    rota,
                    res.statusCode,
                    duracao
                );
            }
        });

        if (req.method === 'GET' && url.pathname === '/api/metrics') {
            const token = process.env.METRICS_TOKEN;

            if (!token) {
                return json(res, 503, {
                    erro: 'Metricas nao configuradas'
                });
            }

            if (req.headers.authorization !== `Bearer ${token}`) {
                return json(res, 401, {
                    erro: 'Acesso nao autorizado'
                });
            }

            return json(res, 200, metricas.obterMetricas());
        }


        // Consultar alertas de monitorizacao
        if (req.method === 'GET' && url.pathname === '/api/alerts') {
            const token = process.env.METRICS_TOKEN;

            if (!token) {
                return json(res, 503, {
                    erro: 'Monitorizacao nao configurada'
                });
            }

            if (req.headers.authorization !== `Bearer ${token}`) {
                return json(res, 401, {
                    erro: 'Acesso nao autorizado'
                });
            }

            const dados = metricas.obterMetricas();
            const alertas = analisarMetricas(dados);

            return json(res, 200, {
                totalAlertas: alertas.length,
                alertas
            });
        }


        // Consultar a ultima analise de alertas com IA
        if (
            req.method === 'GET' &&
            url.pathname === '/api/alerts/analysis'
        ) {
            const token = process.env.METRICS_TOKEN;

            if (!token) {
                return json(res, 503, {
                    erro: 'Monitorizacao nao configurada'
                });
            }

            if (req.headers.authorization !== `Bearer ${token}`) {
                return json(res, 401, {
                    erro: 'Acesso nao autorizado'
                });
            }

            // eslint-disable-next-line security/detect-non-literal-fs-filename -- Caminho definido no codigo (ou pelos testes), nunca pelo pedido HTTP.
            fs.readFile(relatorioAlertasPath, 'utf8', (err, conteudo) => {
                if (err) {
                    return json(res, err.code === 'ENOENT' ? 404 : 500, {
                        erro: err.code === 'ENOENT'
                            ? 'Analise de IA ainda nao disponivel'
                            : 'Erro ao ler a analise'
                    });
                }

                try {
                    const relatorio = JSON.parse(conteudo);
                    return json(res, 200, relatorio);
                } catch {
                    return json(res, 500, {
                        erro: 'Relatorio de IA invalido'
                    });
                }
            });

            return;
        }

        // Verificar estado da API
        if (req.method === 'GET' && url.pathname === '/api/health') {
            return json(res, 200, { status: 'ok' });
        }

        // Listar tarefas
        if (req.method === 'GET' && url.pathname === '/api/tasks') {
            return json(res, 200, tasks);
        }

        // Adicionar tarefa
        if (req.method === 'POST' && url.pathname === '/api/tasks') {
            let body = '';

            try {
                for await (const part of req) {
                    body += part;

                    if (body.length > 10000) {
                        return json(res, 413, {
                            erro: 'Pedido demasiado grande'
                        });
                    }
                }

                const data = JSON.parse(body);

                if (
                    typeof data.title !== 'string' ||
                    !data.title.trim() ||
                    data.title.length > 120
                ) {
                    return json(res, 400, {
                        erro: 'Título obrigatório (até 120 caracteres)'
                    });
                }

                const task = {
                    id: nextId++,
                    title: data.title.trim(),
                    done: false
                };

                tasks.push(task);

                return json(res, 201, task);

            } catch {
                return json(res, 400, {
                    erro: 'JSON inválido'
                });
            }
        }

        // Concluir ou reabrir tarefa
        const match = url.pathname.match(/^\/api\/tasks\/(\d+)\/toggle$/);

        if (req.method === 'PATCH' && match) {
            const task = tasks.find(
                t => t.id === Number(match[1])
            );

            if (!task) {
                return json(res, 404, {
                    erro: 'Tarefa não encontrada'
                });
            }

            task.done = !task.done;

            return json(res, 200, task);
        }


        // Carregar ficheiros publicos (HTML, CSS e JavaScript)
        const ficheiro = FICHEIROS_PUBLICOS.get(url.pathname);

        if (req.method === 'GET' && ficheiro) {
            return enviarFicheiro(res, ficheiro[0], ficheiro[1]);
        }

        // Rota não encontrada
        return json(res, 404, {
            erro: 'Não encontrado'
        });
    });
}

module.exports = { createServer };