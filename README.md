# TaskFlow-XOps

Gestor de tarefas desenvolvido para a unidade curricular **Plataformas e
Serviços X-Ops** (Universidade da Beira Interior, 3.º ano, 2026/27), usado como
caso de estudo para práticas de Engenharia de Software e X-Ops: integração
contínua, testes automáticos, análise de segurança estática e dinâmica, análise
de código com IA e observabilidade.

**Equipa:** Simão Pereira e Tiago Bolota ·
**Jira:** [projeto SCRUM](https://simaopt89-1791988686291.atlassian.net)

## Funcionalidades

- Criar, listar, concluir e reabrir tarefas.
- Estado do servidor em `/api/health`.
- **Observabilidade:** métricas HTTP (pedidos, erros, taxa de erros, tempo
  médio, estatísticas por rota) e dashboard em `/dashboard`.
- **Alertas de anomalias:** taxa de erros elevada (ALTA) e lentidão (MEDIA).
- **Análise de alertas com IA** (Ollama): resumo, causa possível e
  recomendação, apresentados no dashboard.
- **Cabeçalhos de segurança** em todas as respostas (CSP, anti-clickjacking,
  Permissions-Policy, entre outros).

## Requisitos

- [Node.js](https://nodejs.org) 22 ou superior. A aplicação não tem
  dependências de execução; o ESLint é usado apenas em desenvolvimento.
- [Ollama](https://ollama.com/download) com o modelo `qwen2.5-coder:1.5b`,
  apenas para as funcionalidades de IA.

## Executar (Windows, PowerShell)

Instalar as dependências de desenvolvimento (uma vez):

```powershell
npm install
```

Definir o token de monitorização e arrancar o servidor:

```powershell
$env:METRICS_TOKEN = "escolhe-um-token-teu"
```

```powershell
npm start
```

| Página | Endereço |
|---|---|
| Gestor de tarefas | http://localhost:3000 |
| Dashboard de monitorização | http://localhost:3000/dashboard (pede o `METRICS_TOKEN`) |

O token não tem valor predefinido nem é guardado no repositório: é o valor
definido em `METRICS_TOKEN` na janela onde o servidor arrancou. Sem ele, os
dados de monitorização respondem `503`.

### Demonstração de alertas e análise com IA

Noutra janela, gerar 6 pedidos a uma rota inexistente (alerta ALTA de 100% de
erros):

```powershell
1..6 | ForEach-Object { try { Invoke-WebRequest http://localhost:3000/rota-que-nao-existe } catch {} }
```

Com o Ollama a correr, pedir a análise dos alertas (mesmo token):

```powershell
$env:METRICS_TOKEN = "escolhe-um-token-teu"
```

```powershell
node scripts/ai-alerts.js
```

A análise fica em `reports/ai-alerts.json` e aparece no dashboard.

## Verificar a qualidade localmente

| Comando | O que faz |
|---|---|
| `npm run check` | Verificação de sintaxe |
| `npm test` | 114 testes automáticos |
| `npm run security` | SAST com ESLint + `eslint-plugin-security` |
| `npm run ai-review` | AI Gate sobre `src/app.js` (requer Ollama) |
| `node scripts/ai-review.js <ficheiro.js>` | AI Gate sobre outro ficheiro do projeto |

## Pipeline CI/CD

O workflow `.github/workflows/ci.yml` corre em cada *push* e *pull request*,
com três jobs em paralelo e um de entrega:

- **`quality`** — sintaxe → testes → SAST → instalação do Ollama (versão fixa)
  → AI Gate → relatório da IA como artefacto.
- **`dast`** — arranca uma instância temporária do TaskFlow → OWASP ZAP
  Baseline (passivo) → relatórios como artefacto. Falha com qualquer aviso
  novo não listado em `config/zap-rules.tsv`.
- **`docker`** — constrói a imagem Docker, arranca o contentor e verifica o
  health check, a autenticação (401/200) e o estado `healthy`.
- **`publish`** — só em *push* para a `main` e só se os três jobs anteriores
  passarem: publica a imagem no GitHub Container Registry
  (`ghcr.io/simao-pb/taskflow-xops`, tags `<sha>` e `latest`).

A entrega termina na publicação da imagem: não há um servidor público onde a
aplicação seja instalada automaticamente.

### Executar com Docker

```powershell
docker build -t taskflow-xops .
```

```powershell
docker run --rm -p 3000:3000 -e METRICS_TOKEN="escolhe-um-token-teu" taskflow-xops
```

Ou, depois da primeira publicação na `main`, com a imagem do registo
(pode exigir `docker login ghcr.io` enquanto o pacote for privado):

```powershell
docker run --rm -p 3000:3000 -e METRICS_TOKEN="escolhe-um-token-teu" ghcr.io/simao-pb/taskflow-xops:latest
```

## Endpoints

| Método | Rota | Autenticação |
|---|---|---|
| GET | `/api/health` | — |
| GET | `/api/tasks` | — |
| POST | `/api/tasks` | — |
| PATCH | `/api/tasks/:id/toggle` | — |
| GET | `/api/metrics` | `Authorization: Bearer <METRICS_TOKEN>` |
| GET | `/api/alerts` | `Authorization: Bearer <METRICS_TOKEN>` |
| GET | `/api/alerts/analysis` | `Authorization: Bearer <METRICS_TOKEN>` |

## Estrutura

```
src/        servidor HTTP (sem Express), métricas, alertas, cabeçalhos de segurança
public/     interface: HTML, CSS e JavaScript (sem código inline, por causa da CSP)
scripts/    AI Gate (ai-review.js, ai-gate.js) e análise de alertas (ai-alerts.js)
config/     configuração versionada da IA, alertas e regras do ZAP
test/       testes automáticos (node:test)
docs/       documentação técnica e evidências
```

## Documentação

| Documento | Conteúdo |
|---|---|
| [`docs/arquitetura.md`](docs/arquitetura.md) | Arquitetura atual, fluxos, decisões e configuração |
| [`docs/testes-assistidos-ia.md`](docs/testes-assistidos-ia.md) | Testes assistidos por IA: processo, taxa de aproveitamento e reflexão crítica |
| [`docs/scrum.md`](docs/scrum.md) | Team Contract, rotação do Product Owner, planning, dailies, review e retrospetiva |
| [`docs/resultados-sprints-3-4.md`](docs/resultados-sprints-3-4.md) | Resultados de testes, SAST, DAST e AI Gate, lições e evidências Scrum |
| [`docs/architectural-feedback-log.md`](docs/architectural-feedback-log.md) | Falhas da pipeline, causas, decisões e insight arquitetural |
| [`docs/dast-zap.md`](docs/dast-zap.md) | Testes DAST com OWASP ZAP (SCRUM-28) |
| [`docs/testes-monitorizacao.md`](docs/testes-monitorizacao.md) | Testes de monitorização e alertas (SCRUM-29) |
| [`docs/reprodutibilidade-ai-gate.md`](docs/reprodutibilidade-ai-gate.md) | Reprodutibilidade do AI Gate (SCRUM-23) |
| `ArquiteturaTaskflow.pdf`, `Documentaçaoarquitetura.pdf` | Arquitetura inicial (Sprints 1 e 2) |

## Limitações conhecidas

- Tarefas e métricas ficam **em memória** e perdem-se quando o servidor
  reinicia; não há base de dados.
- Não há autenticação de utilizadores; apenas os endpoints de monitorização
  exigem token. A página do dashboard abre sem token, mas não mostra dados.
- Os limiares dos alertas são **valores de demonstração**, não valores
  validados para produção.
- A análise de alertas com IA é executada manualmente, não de forma contínua.
- O AI Gate usa um modelo local pequeno: produz **falsos positivos** e as
  respostas variam entre execuções. Um resultado PASS não garante ausência de
  vulnerabilidades.
- O ZAP Baseline é apenas passivo e não analisa o dashboard nem a API.

## IA no desenvolvimento

O protótipo inicial foi criado com apoio do ChatGPT. Nas tarefas SCRUM-28 a
SCRUM-30 foi usado o Claude Code como assistente de desenvolvimento. O código
foi revisto pela equipa, e as decisões e limitações encontradas estão
registadas na documentação e no Jira.
