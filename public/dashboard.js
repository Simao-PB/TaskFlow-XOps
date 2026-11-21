let tokenAtual = '';

const mostrar = (id, valor) => {
    document.getElementById(id).textContent = valor;
};

async function atualizarDashboard() {
    if (!tokenAtual) return;

    try {
        const resposta = await fetch('/api/metrics', {
            headers: {
                Authorization: `Bearer ${tokenAtual}`
            },
            cache: 'no-store'
        });

        if (!resposta.ok) {
            throw new Error(`Acesso falhou (HTTP ${resposta.status})`);
        }

        const dados = await resposta.json();

        mostrar('pedidos', dados.totalPedidos);
        mostrar('erros', dados.totalErros);
        mostrar('taxa', dados.taxaErros + '%');
        mostrar('tempo', dados.tempoMedioMs + ' ms');

        const tabela = document.getElementById('tabela');
        tabela.replaceChildren();

        const rotas = Object.entries(dados.rotas);

        for (const [nome, valores] of rotas) {
            const linha = document.createElement('tr');

            const campos = [
                nome,
                valores.pedidos,
                valores.erros,
                valores.tempoMedioMs + ' ms'
            ];

            for (const valor of campos) {
                const celula = document.createElement('td');
                celula.textContent = valor;
                linha.appendChild(celula);
            }

            tabela.appendChild(linha);
        }


        const grafico = document.getElementById('grafico');
        grafico.replaceChildren();

        const maiorTempo = Math.max(
            0.001,
            ...rotas.map(([, valores]) => valores.tempoMedioMs)
        );

        for (const [nome, valores] of rotas) {
            const linha = document.createElement('div');
            linha.className = 'grafico-linha';

            const nomeRota = document.createElement('span');
            nomeRota.className = 'grafico-rota';
            nomeRota.textContent = nome;

            const fundo = document.createElement('div');
            fundo.className = 'grafico-fundo';

            const barra = document.createElement('div');
            barra.className = 'grafico-barra';

            const percentagem = valores.tempoMedioMs / maiorTempo * 100;
            barra.style.width = `${percentagem}%`;

            fundo.appendChild(barra);

            const valor = document.createElement('span');
            valor.className = 'grafico-valor';
            valor.textContent = `${valores.tempoMedioMs} ms`;

            linha.append(nomeRota, fundo, valor);
            grafico.appendChild(linha);
        }


        const rotasComAmostras = rotas.filter(
            ([, valores]) => valores.pedidos >= 5
        );

        if (rotasComAmostras.length === 0) {
            mostrar(
                'insight',
                'Dados insuficientes. São necessários pelo menos ' +
                '5 pedidos por rota para avaliar o desempenho.'
            );
        } else {
            const maisLenta = rotasComAmostras.reduce(
                (a, b) =>
                    a[1].tempoMedioMs > b[1].tempoMedioMs ? a : b
            );

            const nome = maisLenta[0];
            const valores = maisLenta[1];

            const possivelGargalo =
                valores.tempoMedioMs > 50 &&
                valores.tempoMedioMs > dados.tempoMedioMs * 2;

            if (possivelGargalo) {
                mostrar(
                    'insight',
                    `Possível gargalo na rota ${nome}. ` +
                    `Tempo médio: ${valores.tempoMedioMs} ms. ` +
                    `A rota está acima de 50 ms e do dobro ` +
                    `da média global. Recomenda-se investigação.`
                );
            } else {
                mostrar(
                    'insight',
                    `A rota ${nome} apresenta o maior tempo médio ` +
                    `entre as rotas com pelo menos 5 pedidos: ` +
                    `${valores.tempoMedioMs} ms. ` +
                    `Não foram identificados indícios de lentidão ` +
                    `acima dos limites definidos.`
                );
            }
        }



        const respostaAlertas = await fetch('/api/alerts', {
            headers: {
                Authorization: `Bearer ${tokenAtual}`
            },
            cache: 'no-store'
        });

        if (!respostaAlertas.ok) {
            throw new Error(
                `Erro ao consultar alertas: HTTP ${respostaAlertas.status}`
            );
        }

        const dadosAlertas = await respostaAlertas.json();
        const listaAlertas = document.getElementById('lista-alertas');

        listaAlertas.replaceChildren();

        if (dadosAlertas.alertas.length === 0) {
            const mensagem = document.createElement('p');
            mensagem.className = 'sem-alertas';
            mensagem.textContent = 'Nenhum alerta ativo.';

            listaAlertas.appendChild(mensagem);
        } else {
            for (const alerta of dadosAlertas.alertas) {
                const caixa = document.createElement('div');
                caixa.className = 'alerta ' + alerta.gravidade.toLowerCase();

                const titulo = document.createElement('strong');
                titulo.textContent =
                    `${alerta.gravidade} — ${alerta.tipo}`;

                const rota = document.createElement('p');
                rota.textContent = `Rota: ${alerta.rota}`;

                const descricao = document.createElement('p');
                descricao.textContent = alerta.mensagem;

                caixa.append(titulo, rota, descricao);
                listaAlertas.appendChild(caixa);
            }
        }


        const respostaIA = await fetch('/api/alerts/analysis', {
            headers: {
                Authorization: `Bearer ${tokenAtual}`
            },
            cache: 'no-store'
        });

        const resultadoIA = document.getElementById('resultado-ia');

        if (respostaIA.status === 404) {
            resultadoIA.hidden = true;

            mostrar(
                'estado-ia',
                'Ainda não existe uma análise guardada. Executa o analisador de IA.'
            );
        } else if (!respostaIA.ok) {
            throw new Error(
                `Erro ao consultar a IA: HTTP ${respostaIA.status}`
            );
        } else {
            const relatorio = await respostaIA.json();
            const analise = relatorio.analiseIA;

            mostrar('ia-resumo', analise.resumo);
            mostrar('ia-causa', analise.causaPossivel);
            mostrar('ia-recomendacao', analise.recomendacao);

            const dataAnalise = new Date(relatorio.data);

            mostrar(
                'ia-data',
                `Modelo: ${relatorio.modelo} | ` +
                `Análise realizada em: ${dataAnalise.toLocaleString('pt-PT')}`
            );

            mostrar(
                'estado-ia',
                'Última análise guardada — não é uma análise em tempo real.'
            );

            resultadoIA.hidden = false;
        }

        mostrar('estado', 'Monitorização ativa — atualização a cada 5 segundos.');

    } catch (erro) {
        mostrar('estado', erro.message);
    }
}

document.getElementById('acesso').addEventListener(
    'submit',
    evento => {
        evento.preventDefault();

        const campo = document.getElementById('token');
        tokenAtual = campo.value;
        campo.value = '';

        atualizarDashboard();
    }
);

setInterval(atualizarDashboard, 5000);
