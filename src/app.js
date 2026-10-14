const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
let nextId = 1;
const tasks = [];
function json(res, status, data) {
  res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options':'nosniff'});
  res.end(JSON.stringify(data));
}
function createServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'GET' && url.pathname === '/api/health') return json(res, 200, { status: 'ok' });
    if (req.method === 'GET' && url.pathname === '/api/tasks') return json(res, 200, tasks);
    if (req.method === 'POST' && url.pathname === '/api/tasks') {
      let body = '';
      try {
        for await (const part of req) {
          body += part;
          if (body.length > 10000) return json(res, 413, { erro:'Pedido demasiado grande' });
        }
        const data = JSON.parse(body);
        if (typeof data.title !== 'string' || !data.title.trim() || data.title.length > 120)
          return json(res, 400, { erro:'Título obrigatório (até 120 caracteres)' });
        const task = { id: nextId++, title:data.title.trim(), done:false };
        tasks.push(task);
        return json(res, 201, task);
      } catch { return json(res, 400, { erro:'JSON inválido' }); }
    }
    const match = url.pathname.match(/^\/api\/tasks\/(\d+)\/toggle$/);
    if (req.method === 'PATCH' && match) {
      const task = tasks.find(t => t.id === Number(match[1]));
      if (!task) return json(res,404,{erro:'Tarefa não encontrada'});
      task.done = !task.done;
      return json(res,200,task);
    }
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      res.writeHead(200, {'Content-Type':'text/html; charset=utf-8', 'X-Content-Type-Options':'nosniff'});
      return fs.createReadStream(path.join(__dirname,'../public/index.html')).pipe(res);
    }
    return json(res,404,{erro:'Não encontrado'});
  });
}
module.exports = { createServer };
