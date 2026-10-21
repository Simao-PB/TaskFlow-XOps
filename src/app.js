const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

let nextId = 1;
const tasks = [];

// Função para enviar respostas JSON
function json(res, status, data) {
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Content-Type-Options': 'nosniff'
    });

    res.end(JSON.stringify(data));
}

// Criar servidor
function createServer() {
    return http.createServer(async (req, res) => {
        const url = new URL(req.url, 'http://localhost');

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

        // Carregar página HTML
        if (
            req.method === 'GET' &&
            (url.pathname === '/' || url.pathname === '/index.html')
        ) {
            const htmlPath = path.join(
                __dirname,
                '../public/index.html'
            );

            // Caminho fixo, não controlado pelo utilizador.
            // eslint-disable-next-line security/detect-non-literal-fs-filename -- Ficheiro HTML permitido explicitamente.
            fs.readFile(htmlPath, (err, html) => {
                if (err) {
                    return json(res, 404, {
                        erro: 'Ficheiro HTML não encontrado'
                    });
                }

                res.writeHead(200, {
                    'Content-Type': 'text/html; charset=utf-8',
                    'X-Content-Type-Options': 'nosniff'
                });

                res.end(html);
            });

            return;
        }

        // Carregar ficheiro CSS
        if (req.method === 'GET' && url.pathname === '/styles.css') {
            const cssPath = path.join(
                __dirname,
                '../public/styles.css'
            );

            // Caminho fixo, não controlado pelo utilizador.
            // eslint-disable-next-line security/detect-non-literal-fs-filename -- Ficheiro CSS permitido explicitamente.
            fs.readFile(cssPath, (err, css) => {
                if (err) {
                    return json(res, 404, {
                        erro: 'Ficheiro CSS não encontrado'
                    });
                }

                res.writeHead(200, {
                    'Content-Type': 'text/css; charset=utf-8',
                    'X-Content-Type-Options': 'nosniff'
                });

                res.end(css);
            });

            return;
        }

        // Rota não encontrada
        return json(res, 404, {
            erro: 'Não encontrado'
        });
    });
}

module.exports = { createServer };