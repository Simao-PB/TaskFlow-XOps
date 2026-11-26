// Interface principal do TaskFlow.
// Regras: sem código inline (CSP) e texto sempre inserido com textContent.

const MAX_TITULO = 120;

const lista = document.getElementById('list');
const formulario = document.getElementById('f');
const campo = document.getElementById('title');
const botaoAdicionar = document.getElementById('adicionar');
const contadorCaracteres = document.getElementById('caracteres');
const mensagem = document.getElementById('mensagem');
const vazio = document.getElementById('vazio');
const botoesFiltro = document.querySelectorAll('.filtro');

let tarefas = [];
let filtroAtual = 'todas';
let temporizadorMensagem;

function mostrarMensagem(texto, tipo) {
    clearTimeout(temporizadorMensagem);

    mensagem.textContent = texto;
    mensagem.className = `mensagem ${tipo}`;
    mensagem.hidden = false;

    if (tipo === 'sucesso') {
        temporizadorMensagem = setTimeout(() => {
            mensagem.hidden = true;
        }, 3000);
    }
}

function esconderMensagem() {
    clearTimeout(temporizadorMensagem);
    mensagem.hidden = true;
}

function atualizarResumo() {
    const total = tarefas.length;
    const concluidas = tarefas.filter(t => t.done).length;

    document.getElementById('total').textContent = total;
    document.getElementById('pendentes').textContent = total - concluidas;
    document.getElementById('concluidas').textContent = concluidas;

    const progresso = total ? concluidas / total : 0;

    document.getElementById('barra-progresso').value = progresso;
    document.getElementById('percentagem').textContent =
        `${Math.round(progresso * 100)}%`;
}

function tarefasFiltradas() {
    if (filtroAtual === 'pendentes') {
        return tarefas.filter(t => !t.done);
    }

    if (filtroAtual === 'concluidas') {
        return tarefas.filter(t => t.done);
    }

    return tarefas;
}

function criarItem(tarefa) {
    const item = document.createElement('li');
    item.className = tarefa.done ? 'tarefa done' : 'tarefa';

    const titulo = document.createElement('span');
    titulo.className = 'tarefa-titulo';
    titulo.textContent = tarefa.title;

    const estado = document.createElement('span');
    estado.className = 'tarefa-estado';
    estado.textContent = tarefa.done ? 'Concluída' : 'Por fazer';

    const botao = document.createElement('button');
    botao.type = 'button';
    botao.textContent = tarefa.done ? 'Reabrir' : 'Concluir';
    botao.setAttribute(
        'aria-label',
        `${botao.textContent} a tarefa "${tarefa.title}"`
    );
    botao.addEventListener('click', () => alternarTarefa(tarefa.id, botao));

    item.append(titulo, estado, botao);

    return item;
}

function desenharLista() {
    const visiveis = tarefasFiltradas();

    lista.replaceChildren(...visiveis.map(criarItem));
    atualizarResumo();

    if (visiveis.length === 0) {
        vazio.textContent = tarefas.length === 0
            ? 'Ainda não tens tarefas. Adiciona a primeira acima.'
            : 'Não há tarefas neste filtro.';
        vazio.hidden = false;
    } else {
        vazio.hidden = true;
    }
}

async function carregarTarefas() {
    try {
        const resposta = await fetch('/api/tasks');

        if (!resposta.ok) {
            throw new Error(`HTTP ${resposta.status}`);
        }

        tarefas = await resposta.json();
        desenharLista();
    } catch {
        mostrarMensagem(
            'Não foi possível carregar as tarefas. Verifica se o servidor está a correr.',
            'erro'
        );
    }
}

async function alternarTarefa(id, botao) {
    botao.disabled = true;

    try {
        const resposta = await fetch(`/api/tasks/${id}/toggle`, {
            method: 'PATCH'
        });

        if (!resposta.ok) {
            throw new Error(`HTTP ${resposta.status}`);
        }

        const atualizada = await resposta.json();
        tarefas = tarefas.map(t => (t.id === atualizada.id ? atualizada : t));
        esconderMensagem();
        desenharLista();
    } catch {
        botao.disabled = false;
        mostrarMensagem('Não foi possível atualizar a tarefa.', 'erro');
    }
}

function atualizarContadorCaracteres() {
    contadorCaracteres.textContent = `${campo.value.length}/${MAX_TITULO}`;
}

formulario.addEventListener('submit', async evento => {
    evento.preventDefault();

    const titulo = campo.value.trim();

    if (!titulo) {
        campo.setAttribute('aria-invalid', 'true');
        mostrarMensagem('Escreve uma tarefa antes de adicionar.', 'erro');
        campo.focus();
        return;
    }

    botaoAdicionar.disabled = true;

    try {
        const resposta = await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: titulo })
        });

        if (!resposta.ok) {
            const dados = await resposta.json().catch(() => ({}));
            throw new Error(dados.erro || `HTTP ${resposta.status}`);
        }

        tarefas.push(await resposta.json());
        campo.value = '';
        atualizarContadorCaracteres();
        desenharLista();
        mostrarMensagem('Tarefa adicionada.', 'sucesso');
    } catch (erro) {
        mostrarMensagem(`Não foi possível adicionar a tarefa: ${erro.message}`, 'erro');
    } finally {
        botaoAdicionar.disabled = false;
        campo.focus();
    }
});

campo.addEventListener('input', () => {
    campo.removeAttribute('aria-invalid');
    atualizarContadorCaracteres();
});

for (const botao of botoesFiltro) {
    botao.addEventListener('click', () => {
        filtroAtual = botao.dataset.filtro;

        for (const outro of botoesFiltro) {
            outro.setAttribute('aria-pressed', String(outro === botao));
        }

        desenharLista();
    });
}

carregarTarefas();
