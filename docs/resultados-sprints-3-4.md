# Resultados dos Sprints 3 e 4

**Projeto:** TaskFlow-XOps · **Equipa:** Simão Pereira e Tiago Bolota ·
**Tarefa:** SCRUM-30

Resumo dos resultados técnicos, das limitações e das evidências dos Sprints 3
(análise de código com IA) e 4 (observabilidade e segurança), como base para o
relatório final. Os números referem-se ao estado do repositório a 21/11/2026.
Detalhes em `docs/arquitetura.md` e `docs/architectural-feedback-log.md`.

## 1. Resultados por mecanismo

### 1.1 Testes automáticos

| Momento | Testes |
|---|---|
| Fim do Sprint 2 | 9 |
| Início da SCRUM-28 | 32 |
| Fim da SCRUM-28 (cabeçalhos de segurança) | 39 |
| Fim da SCRUM-29 (monitorização e alertas) | **87** |

- 9 mutações introduzidas de propósito no código foram todas detetadas pelos
  testes; 4 delas (erros de fronteira nos alertas) **não eram detetadas** pelos
  testes que existiam antes (AFL-09).
- Os testes não dependem de tempos reais nem de respostas do Ollama.
- Nota: o contador do `npm test` mostra mais um teste do que existem, porque o
  Node.js também executa `test/fixtures/codigo-inseguro.js`.

### 1.2 SAST — ESLint + `eslint-plugin-security`

- Analisa `src/` e falha com qualquer aviso (`--max-warnings=0`).
- **Resultado atual: 0 avisos**, com 2 exceções revistas e justificadas no
  código (`security/detect-non-literal-fs-filename` em leituras de ficheiros
  cujo caminho é fixo, nunca vindo do pedido HTTP).
- Deteta o `eval()` do exemplo inseguro (`security/detect-eval-with-expression`)
  de forma determinística — o mesmo resultado em todas as execuções.
- Não causou nenhuma falha indevida da pipeline.

### 1.3 DAST — OWASP ZAP Baseline (SCRUM-28)

| Momento | FAIL | WARN | IGNORE | PASS |
|---|---|---|---|---|
| Primeiro scan (run #20) | 0 | 6 | 0 | 62 |
| Depois das correções (run #21) | 0 | 2 | 0 | 66 |
| Com regras revistas e critério ativo (run #23) | 0 | **0** | 2 | 66 |

- **4 problemas reais corrigidos:** falta de CSP, de proteção contra
  *clickjacking*, de Permissions-Policy e de isolamento entre origens.
- **2 avisos informativos aceites**, com justificação em
  `config/zap-rules.tsv` e `docs/dast-zap.md`.
- Nenhum destes problemas tinha sido detetado pelo SAST nem pelo AI Gate.
- Limitação: o spider não chega ao dashboard nem à API (AFL-08).

### 1.4 AI Gate — Ollama `qwen2.5-coder:1.5b`

- Funciona como etapa bloqueante: FAIL com qualquer problema pendente de
  gravidade ALTA ou com resposta inválida da IA.
- **Problemas reais encontrados no código do TaskFlow: nenhum confirmado.**
  Todos os avisos ALTA analisados pela equipa foram falsos positivos
  (secção 3).
- Deteta o `eval()` do exemplo inseguro, tal como o SAST.
- **Fiabilidade:** causou 10 dos 11 runs falhados até 21/11 (3 por falsos
  positivos, 7 por respostas cortadas). Depois da correção com `maxLength` no
  esquema JSON: 12 em 12 execuções sem respostas cortadas até 26/11, contra
  1 em 4 antes
  (AFL-06).

## 2. Comparação SAST × DAST × AI Gate

| | SAST | DAST | AI Gate |
|---|---|---|---|
| O que analisa | Código-fonte | Respostas HTTP da aplicação em execução | Código-fonte, interpretado por um modelo |
| Determinístico | Sim | Quase (o spider variou os URLs visitados) | **Não** |
| Problemas reais encontrados | `eval()` no exemplo; caminhos de ficheiros revistos | **4 cabeçalhos de segurança em falta** | `eval()` no exemplo |
| Falsos positivos | Poucos, resolvidos com exceções no código | 2 avisos informativos | Frequentes (ALTA sem fundamento) |
| Falhas indevidas da pipeline | 0 | 0 | 10 |
| Custo de execução no CI | Segundos | ~1 minuto | 1–5 minutos (instalação + modelo) |

**Conclusão:** os três mecanismos são complementares e não intermutáveis. O DAST
foi o único que encontrou problemas reais na aplicação, porque eram problemas
de comportamento em execução e não de padrões no código. O SAST é rápido e
estável. O AI Gate é o mais flexível — descreve problemas em linguagem natural
e não depende de regras escritas à mão — mas, com um modelo local pequeno, foi o
menos fiável e o que mais trabalho deu à equipa.

## 3. Limitações da IA e falsos positivos

Exemplos reais retirados dos logs do GitHub Actions:

| Run | Gravidade | Aviso da IA | Avaliação |
|---|---|---|---|
| #8 | ALTA | "O código não verifica se o caminho do ficheiro CSS é seguro… pode permitir a execução de código malicioso" | Falso positivo: o caminho é fixo |
| #10 | ALTA | "A função json() não verifica se o corpo da requisição é um JSON válido… pode permitir execução arbitrária de código" | Falso positivo: o corpo é validado e o `JSON.parse` está protegido |
| #15 | ALTA (2×, mesma linha) | "A função json() de resposta não verifica se o dado é um objeto JSON válido antes de serializá-lo" | Falso positivo e aviso duplicado |
| #22–#38 | MEDIA | "O código não verifica se a requisição é uma solicitação GET ou POST…" (o mesmo texto em duas linhas) | Falso positivo: métodos não previstos terminam em 404 |

Padrões observados:

- **Gravidade exagerada:** frases como "execução arbitrária de código" sem um
  caminho de exploração concreto.
- **Avisos duplicados** e **linhas sem relação** com o problema descrito
  (por exemplo, a linha de um `require`).
- **Respostas diferentes para o mesmo código**, mesmo com temperatura 0 e seed
  fixa (`docs/reprodutibilidade-ai-gate.md`, AFL-06).
- **Respostas cortadas** quando o modelo entra em repetição, até ao limite de
  tokens (AFL-05, AFL-06).

Medidas adotadas: aprovações manuais específicas e associadas ao SHA256 do
ficheiro, configuração e instruções versionadas, esquema JSON com tamanhos
máximos, validação da resposta e versão fixa do Ollama. **Nenhum aviso foi
aprovado automaticamente**; os avisos MEDIA atuais ficam pendentes (visíveis no
relatório) sem bloquear a pipeline.

## 4. Monitorização e demonstração de alertas

- Métricas HTTP com recolha automática no fim de cada resposta, excluindo as
  consultas de monitorização.
- Endpoints de monitorização protegidos por token; testados com 401 (sem token
  e com 5 variantes de token inválido) e 503 (token não configurado).
- **Demonstração:** 6 pedidos a uma rota inexistente geram um alerta ALTA de
  100% de erros na rota `rota-desconhecida`, visível em `/api/alerts` e no
  dashboard. O cenário está automatizado em `test/monitoring-api.test.js`.
- **Análise com IA dos alertas:** no teste da equipa (SCRUM-27), a IA
  identificou corretamente a taxa de erros elevada, mas sugeriu como causa uma
  falha da aplicação — os erros tinham sido provocados de propósito. A IA só
  conhece os números, não o contexto. Por isso o dashboard apresenta o campo
  como **"causa possível"** e as instruções do modelo pedem que distinga
  observações de hipóteses.

## 5. Insight arquitetural

> Dos 11 runs falhados até 21/11, 10 foram causados pelo AI Gate e nenhum
> pelos testes, SAST ou DAST. Um componente não determinístico num gate
> bloqueante precisa de limites estruturais (esquema com tamanhos máximos,
> validação, aprovações específicas, versões fixas). Melhorar apenas as
> instruções do modelo não foi suficiente.

Evidência completa em `docs/architectural-feedback-log.md`.

## 6. Lições aprendidas

1. **Uma ferramenta "verde" não prova ausência de problemas.** O AI Gate PASS
   não garante código seguro; o ZAP verde não cobre rotas que o spider não
   visitou.
2. **Confirmar hipóteses com repetições.** A versão fixa do Ollama pareceu
   resolver o problema com 2 runs verdes e foi refutada com mais 4 (AFL-06).
3. **Testar as fronteiras.** Testes só com valores "óbvios" deixaram passar
   erros de `>` versus `>=` (AFL-09).
4. **Ferramentas de segurança mudam a arquitetura.** A CSP obrigou a retirar o
   JavaScript do HTML (AFL-07).
5. **Exceções devem ser estreitas e rastreáveis.** Aprovações da IA por hash e
   regras do ZAP com justificação, em vez de desativar verificações.

## 7. Trabalho futuro

- Persistência (base de dados) e autenticação de utilizadores.
- Deploy automático após a pipeline.
- DAST com a lista de rotas da API e com o lado autenticado; avaliar um scan
  ativo contra a instância temporária.
- Confirmar a hipótese do hardware na variabilidade do AI Gate e avaliar se o
  AI Gate deve ser bloqueante ou apenas informativo.
- Configurar o endereço do servidor em `scripts/ai-alerts.js` (hoje fixo em
  `127.0.0.1:3000`).

## 8. Evidências Scrum

Links para os runs: `https://github.com/Simao-PB/TaskFlow-XOps/actions/runs/<id>`
(o número do run aparece na lista do GitHub Actions).

| Tarefa | Estado no Jira (21/11) | Commits | Runs | Documento |
|---|---|---|---|---|
| SCRUM-19 Análise de código com IA | Concluído | `bba14ee`, `33c87fa` | #6 ❌, #9 ✅ | — |
| SCRUM-20 AI Gate no GitHub Actions | Concluído | `d36cf92`, `8911fd1` | #7 ✅, #8 ❌ | — |
| SCRUM-21 Testes do AI Gate | Concluído | `3bc9fb2`, `eccf122` | #10 ❌, #11 ✅ | — |
| SCRUM-22 Configurações versionadas | Em andamento | `b9cb5eb`, `9534227` | #12 ✅, #35 ✅ | `config/ai-gate-config.json` |
| SCRUM-23 Reprodutibilidade | Em andamento | `97863db` | #13 ✅ | `docs/reprodutibilidade-ai-gate.md` |
| SCRUM-24 Architectural Feedback Log | Em andamento | `33bf526` | — | `docs/architectural-feedback-log.md` |
| SCRUM-25 Métricas HTTP | Concluído | `c3d8ad5` | #14 ✅ | — |
| SCRUM-26 Dashboard | Concluído | `ad2ff72`, `7bf054d` | #15 ❌, #16 ✅ | — |
| SCRUM-27 Alertas e análise com IA | Concluído | `b3a2f05`, `81f10e7` | #17 ❌, #18 ✅ | — |
| SCRUM-28 DAST na pipeline | A fazer | `082d49e`, `0adab59`, `7938872`, `08403a1`, `10600fe` | #20 (6 WARN), #21 (2 WARN), #23 ✅ | `docs/dast-zap.md` |
| SCRUM-29 Testes de monitorização | A fazer | `9117c79`, `636a29f`, `1601f34`, `227d489`, `c95d005`, `a33539a` | #25–#38 (✅ testes; AI Gate ver AFL-06) | `docs/testes-monitorizacao.md` |
| SCRUM-30 Documentação | A fazer | `33bf526`, `4e9c50c`, `912d600`, `9d9717f` e este documento | — | `README.md`, `docs/` |

Os estados das SCRUM-22 a 30 devem ser atualizados no Jira pela equipa, com
base nestas evidências. A associação dos commits dos Sprints 3 e início do 4 às
tarefas foi feita a partir das mensagens dos commits (que não indicam o número
SCRUM) e deve ser confirmada pela equipa.
