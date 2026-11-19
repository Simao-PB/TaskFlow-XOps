const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../src/app');

let server, base;

// Iniciar o servidor antes dos testes
test.before(async () => {
  process.env.METRICS_TOKEN = 'token-apenas-para-testes';
  server = createServer();

  await new Promise(r => server.listen(0, r));

  base = `http://127.0.0.1:${server.address().port}`;
});

// Fechar o servidor depois dos testes
test.after(async () => {
  await new Promise(r => server.close(r));
});

// Teste 1 - Verificar se o servidor responde
test('health check responde com sucesso', async () => {
  const r = await fetch(base + '/api/health');

  assert.equal(r.status, 200);
  assert.equal((await r.json()).status, 'ok');
});

// Teste 2 - Criar uma tarefa
test('cria uma tarefa', async () => {
  const r = await fetch(base + '/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Preparar Sprint Review' })
  });

  assert.equal(r.status, 201);
  assert.equal((await r.json()).done, false);
});

// Teste 3 - Rejeitar uma tarefa sem título
test('rejeita tarefa sem título', async () => {
  const r = await fetch(base + '/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: '' })
  });

  assert.equal(r.status, 400);
});

// Teste 4 - Listar e concluir tarefas
test('lista e conclui tarefas', async () => {
  let r = await fetch(base + '/api/tasks');

  const tasks = await r.json();

  assert.ok(tasks.length >= 1);

  r = await fetch(base + '/api/tasks/' + tasks[0].id + '/toggle', {
    method: 'PATCH'
  });

  assert.equal(r.status, 200);
  assert.equal((await r.json()).done, true);
});

// Teste 5 - Verificar uma rota inexistente
test('devolve 404 em rotas desconhecidas', async () => {
  const r = await fetch(base + '/xyz');

  assert.equal(r.status, 404);
});

// Teste 6 - JSON inválido
test('rejeita JSON inválido', async () => {
  const r = await fetch(base + '/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{invalido'
  });

  assert.equal(r.status, 400);
});

// Teste 7 - Título demasiado longo
test('rejeita títulos com mais de 120 caracteres', async () => {
  const r = await fetch(base + '/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'A'.repeat(121) })
  });

  assert.equal(r.status, 400);
});

// Teste 8 - Tarefa inexistente
test('devolve 404 para tarefa inexistente', async () => {
  const r = await fetch(base + '/api/tasks/999999/toggle', {
    method: 'PATCH'
  });

  assert.equal(r.status, 404);
});

// Teste 9 - Concluir e reabrir tarefa
test('permite concluir e reabrir uma tarefa', async () => {
  let r = await fetch(base + '/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Teste de reabertura' })
  });

  const tarefa = await r.json();

  r = await fetch(base + '/api/tasks/' + tarefa.id + '/toggle', {
    method: 'PATCH'
  });

  assert.equal((await r.json()).done, true);

  r = await fetch(base + '/api/tasks/' + tarefa.id + '/toggle', {
    method: 'PATCH'
  });

  assert.equal((await r.json()).done, false);
});


test('regista pedidos e erros nas metricas', async () => {
    const headers = {
        Authorization: 'Bearer token-apenas-para-testes'
    };

    const respostaAntes = await fetch(base + '/api/metrics', {
        headers
    });
    const antes = await respostaAntes.json();

    const respostaHealth = await fetch(base + '/api/health');
    assert.equal(respostaHealth.status, 200);

    const respostaErro = await fetch(base + '/rota-inexistente');
    assert.equal(respostaErro.status, 404);

    const respostaDepois = await fetch(base + '/api/metrics', {
        headers
    });
    const depois = await respostaDepois.json();

    assert.equal(depois.totalPedidos, antes.totalPedidos + 2);
    assert.equal(depois.totalErros, antes.totalErros + 1);

    assert.ok(depois.tempoMedioMs >= 0);

    assert.equal(
        depois.rotas['/api/health'].pedidos,
        (antes.rotas['/api/health']?.pedidos || 0) + 1
    );

    assert.equal(
        depois.rotas['rota-desconhecida'].erros,
        (antes.rotas['rota-desconhecida']?.erros || 0) + 1
    );

    const respostaFinal = await fetch(base + '/api/metrics', {
        headers
    });
    const final = await respostaFinal.json();

    assert.equal(final.totalPedidos, depois.totalPedidos);
});

test('bloqueia acesso as metricas sem token', async () => {
    const resposta = await fetch(base + '/api/metrics');

    assert.equal(resposta.status, 401);
});
