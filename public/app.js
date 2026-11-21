const list = document.getElementById('list');
const input = document.getElementById('title');

async function refresh() {
    const tasks = await (await fetch('/api/tasks')).json();

    list.replaceChildren();

    for (const t of tasks) {
        const li = document.createElement('li');

        if (t.done) {
            li.className = 'done';
        }

        const span = document.createElement('span');
        span.textContent = t.title;

        const b = document.createElement('button');
        b.textContent = t.done ? 'Reabrir' : 'Concluir';

        b.onclick = async () => {
            await fetch('/api/tasks/' + t.id + '/toggle', {
                method: 'PATCH'
            });

            refresh();
        };

        li.append(span, b);
        list.append(li);
    }
}

document.getElementById('f').onsubmit = async (e) => {
    e.preventDefault();

    const r = await fetch('/api/tasks', {
        method: 'POST',

        headers: {
            'Content-Type': 'application/json'
        },

        body: JSON.stringify({
            title: input.value
        })
    });

    if (r.ok) {
        input.value = '';
        refresh();
    } else {
        alert('Não foi possível adicionar a tarefa');
    }
};

input.addEventListener('invalid', function () {
    this.setCustomValidity('Por favor, escreve uma tarefa antes de adicionar.');
});

input.addEventListener('input', function () {
    this.setCustomValidity('');
});

refresh();
