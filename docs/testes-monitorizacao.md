# Testes automáticos de monitorização e alertas (SCRUM-29)

## 1. Objetivo

Reforçar a validação automática da observabilidade criada nas SCRUM-25, 26 e 27
(métricas, alertas e análise de alertas com IA), com testes que:

- correm em todos os *push* e *pull requests* (o CI executa `npm test`);
- não dependem de tempos reais nem de respostas do Ollama;
- testam as fronteiras exatas das regras, e não apenas casos "óbvios".

## 2. Ficheiros de teste

| Ficheiro | Testes | O que cobre |
|---|---|---|
| `test/metrics.test.js` | 8 | Módulo `src/metrics.js`: estado inicial, fronteira 399/400 para erros, taxa e tempo médio com arredondamento, separação por rota, latência simulada, independência entre instâncias |
| `test/alerts.test.js` | 18 (5 anteriores + 13 novos) | Regras de `src/alerts.js`: mínimo de pedidos, taxa de erros, tempo médio, fator de lentidão (valores **iguais** e **acima** de cada limite), regra relativa, várias rotas, campos completos dos alertas |
| `test/monitoring-api.test.js` | 10 | Endpoints com o servidor em execução: 401 sem token e com 5 variantes de token inválido, 503 sem `METRICS_TOKEN`, ausência de dados nas respostas 401, cenário da demonstração (6 pedidos 404 → alerta ALTA), consultas de monitorização não alteram as métricas |
| `test/alerts-analysis.test.js` | 7 | `GET /api/alerts/analysis` com relatórios numa pasta temporária: 404 sem relatório, 200 válido, 500 com JSON corrompido (sem expor o conteúdo), 500 noutros erros de leitura, versão mais recente, 401 sem revelar o relatório |
| `test/ai-alerts.test.js` | 10 | Validação da resposta da IA em `scripts/ai-alerts.js`: campos em falta, vazios ou com tipo errado, respostas que não são objeto, JSON cortado (como no erro `length`), texto que não é JSON |

Total do projeto: **87 testes** (antes da SCRUM-29: 40). O contador do
`npm test` mostrava mais um, porque o Node.js também executava
`test/fixtures/codigo-inseguro.js` (exemplo usado nos testes do AI Gate, sem
testes próprios). *Corrigido no Sprint 5 (S5-7): o `npm test` corre só
`test/*.test.js`.*

## 3. Decisões

- **Latência simulada sem tempos reais.** `registarPedido(rota, status, duracao)`
  recebe a duração como parâmetro, por isso os testes usam valores fixos
  (por exemplo 10 ms e 190 ms). Testes baseados em `setTimeout` seriam lentos e
  instáveis no CI.
- **Limites lidos da configuração.** Os testes de fronteira usam os valores de
  `config/monitoring-alerts.json`; se os limites forem ajustados, os testes
  continuam corretos.
- **Um servidor por teste** nos testes de endpoints: as métricas estão em
  memória por instância, por isso um teste não influencia o seguinte.
- **Relatório de IA isolado.** `createServer()` aceita a opção
  `relatorioAlertasPath`, usada apenas pelos testes, para nunca lerem nem
  apagarem o relatório real em `reports/`. Sem a opção, o comportamento é o
  mesmo de antes.
- **Validação da IA testável sem Ollama.** `scripts/ai-alerts.js` passou a
  exportar `interpretarRespostaIA()` e `validarAnaliseIA()` e só executa a
  análise quando é corrido diretamente. O fluxo completo foi verificado
  localmente com um Ollama simulado.

## 4. Testes de mutação

Para confirmar que os testes detetam erros reais, foram introduzidos bugs
temporários no código (e depois repostos), verificando que pelo menos um teste
falha:

| Mutação | Detetada por |
|---|---|
| `status >= 400` → `status > 400` em `metrics.js` | fronteira 399/400 |
| `taxaErros >` → `>=` em `alerts.js` | taxa igual ao limite |
| `tempoMedioMs >` → `>=` em `alerts.js` | tempo igual ao limite |
| Fator de lentidão ligeiramente reduzido | tempo igual a 2× a média |
| `pedidos <` → `<=` em `alerts.js` | exatamente o mínimo de pedidos |
| `/api/alerts/analysis` deixa de ser excluído das métricas | consultas não alteram métricas |
| `/api/alerts` deixa de verificar o token | 401 sem token / token inválido |
| Sem verificação de `METRICS_TOKEN` configurado | 503 sem token configurado |
| Todos os erros de leitura do relatório passam a 404 | 500 noutros erros de leitura |

As quatro mutações de fronteira em `alerts.js` **não eram detetadas por nenhum
dos 5 testes que já existiam**: os testes antigos só usavam valores longe dos
limites.

Uma das mutações mostra um risco real: sem a verificação de token configurado,
o servidor compararia o cabeçalho com `` `Bearer ${undefined}` ``, e o cabeçalho
`Authorization: Bearer undefined` daria acesso às métricas. O código atual não
tem este problema e o teste impede que seja introduzido.

## 5. Limitações

- Os testes não verificam o JavaScript do dashboard no browser (gráficos,
  atualização a cada 5 segundos); a interface foi verificada manualmente e com
  Playwright durante a SCRUM-28, mas sem teste automático na pipeline.
- A qualidade da análise feita pela IA não é testada (seria dependente do
  modelo e não reprodutível); só a estrutura da resposta é validada.
- Os limiares dos alertas continuam a ser valores de demonstração; os testes
  garantem que as regras são aplicadas como definidas, não que os valores são
  os adequados para produção.

## 6. Problema encontrado durante a SCRUM-29

Os runs de CI desta tarefa expuseram que o AI Gate falhava de forma
intermitente com `length` mesmo com a versão do Ollama fixa. A análise e a
correção (`maxLength` no esquema JSON) estão em `docs/dast-zap.md`, secção 5.

## 7. Executar

```powershell
npm test
```

Só os testes desta tarefa:

```powershell
node --test test/metrics.test.js test/alerts.test.js test/monitoring-api.test.js test/alerts-analysis.test.js test/ai-alerts.test.js
```
