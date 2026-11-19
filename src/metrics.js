
const { performance } = require('node:perf_hooks');

function criarMetricas() {
    let totalPedidos = 0;
    let totalErros = 0;
    let tempoTotal = 0;

    const rotas = new Map();

    function registarPedido(rota, status, duracao) {
        totalPedidos++;
        tempoTotal += duracao;

        if (status >= 400) {
            totalErros++;
        }

        if (!rotas.has(rota)) {
            rotas.set(rota, {
                pedidos: 0,
                erros: 0,
                tempoTotal: 0
            });
        }

        const dados = rotas.get(rota);

        dados.pedidos++;
        dados.tempoTotal += duracao;

        if (status >= 400) {
            dados.erros++;
        }
    }

    function obterMetricas() {
        const detalhesRotas = Object.fromEntries(
            Array.from(rotas, ([rota, dados]) => [
                rota,
                {
                    pedidos: dados.pedidos,
                    erros: dados.erros,
                    tempoMedioMs: Number(
                        (dados.tempoTotal / dados.pedidos).toFixed(2)
                    )
                }
            ])
        );

        return {
            totalPedidos,
            totalErros,
            taxaErros: totalPedidos
                ? Number((totalErros / totalPedidos * 100).toFixed(2))
                : 0,
            tempoMedioMs: totalPedidos
                ? Number((tempoTotal / totalPedidos).toFixed(2))
                : 0,
            rotas: detalhesRotas
        };
    }

    return {
        registarPedido,
        obterMetricas,
        iniciarTempo: () => performance.now(),
        calcularDuracao: inicio => performance.now() - inicio
    };
}

module.exports = { criarMetricas };