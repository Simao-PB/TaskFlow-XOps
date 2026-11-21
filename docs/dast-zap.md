# Testes DAST com OWASP ZAP (SCRUM-28)

## 1. Objetivo

Testar a segurança do TaskFlow **enquanto está em execução** (DAST — *Dynamic
Application Security Testing*), como complemento das verificações que já
existiam na pipeline.

| Mecanismo | O que analisa | Exemplos do que deteta | Ferramenta |
|---|---|---|---|
| **SAST** | Código-fonte, sem executar | Uso de `eval()`, caminhos de ficheiros não literais, expressões regulares perigosas | ESLint + `eslint-plugin-security` (`npm run security`) |
| **AI Gate** | Código-fonte, interpretado por um modelo de IA | Problemas lógicos ou de segurança descritos em linguagem natural (com falsos positivos) | Ollama + `qwen2.5-coder:1.5b` (`npm run ai-review`) |
| **DAST** | Respostas HTTP reais da aplicação | Cabeçalhos de segurança em falta, divulgação de informação, cookies inseguros | OWASP ZAP Baseline |

Os três são complementares: nenhum dos avisos de cabeçalhos HTTP encontrados
pelo ZAP tinha sido identificado pelo SAST ou pelo AI Gate, porque dependem do
comportamento da aplicação em execução e não de um padrão no código.

## 2. Funcionamento na pipeline

Job `dast` em `.github/workflows/ci.yml`, em paralelo com o job `quality`:

1. Gera um `METRICS_TOKEN` aleatório para esta execução (mascarado nos logs;
   não fica no repositório nem é necessário nenhum *secret*).
2. Arranca uma **instância temporária** do TaskFlow em `http://localhost:3000`.
3. Aguarda que `/api/health` responda e verifica que `/api/metrics` sem token
   devolve 401.
4. Executa o **ZAP Baseline Scan** (`zaproxy/action-baseline@v0.15.0`):
   - **apenas passivo**: o *spider* visita as páginas e o ZAP analisa as
     respostas; não há ataques ativos nem alteração de dados;
   - aplica as regras de `config/zap-rules.tsv`;
   - não cria *issues* automáticas no GitHub.
5. Publica os relatórios HTML, JSON e Markdown no artefacto
   `taskflow-zap-report` e para o servidor.

O scan é feito **exclusivamente** contra a instância temporária criada no
próprio job.

### Critério de aprovação/rejeição

- Qualquer aviso (WARN) ou falha (FAIL) **não listado** como `IGNORE` em
  `config/zap-rules.tsv` faz **falhar** a pipeline (`fail_action: true`).
- Só entram no ficheiro de regras avisos revistos manualmente, com
  justificação neste documento.

## 3. Resultados

### 3.1 Primeiro scan (antes das correções) — run #20, commit `0adab59`

`FAIL: 0 · WARN: 6 · PASS: 62`

| ID | Aviso | Avaliação |
|---|---|---|
| 10020 | Missing Anti-clickjacking Header | **Real** (risco baixo): a página podia ser embebida num `<iframe>` de outro site |
| 10038 | Content Security Policy (CSP) Header Not Set | **Real**: ausência da principal defesa contra XSS |
| 10063 | Permissions Policy Header Not Set | **Real** (endurecimento) |
| 90004 | Cross-Origin-Embedder-Policy Header Missing or Invalid | Endurecimento de baixo valor, mas de correção simples |
| 10049 | Storable and Cacheable Content | Informativo |
| 10109 | Modern Web Application | Informativo |

### 3.2 Correções aplicadas — commit `7938872`

- Novo módulo `src/security-headers.js`, aplicado a **todas** as respostas:
  `Content-Security-Policy`, `X-Frame-Options: DENY`, `Permissions-Policy`,
  `Referrer-Policy`, `Cross-Origin-Opener-Policy`,
  `Cross-Origin-Embedder-Policy` e `Cross-Origin-Resource-Policy`.
- Respostas da API com `Cache-Control: no-store` (tarefas, métricas e alertas
  não devem ficar em cache).
- **Decisão:** a CSP não usa `'unsafe-inline'`. Para isso, o JavaScript e o CSS
  que estavam dentro do HTML foram movidos, sem alterações, para
  `public/app.js`, `public/dashboard.js` e `public/dashboard.css`. A
  alternativa (`'unsafe-inline'`) teria tirado quase todo o valor da CSP contra
  XSS e o ZAP voltaria a avisar.
- Os ficheiros públicos passaram a ser servidos a partir de uma **lista fixa**
  em `src/app.js`, substituindo três blocos de código repetidos. Caminhos fora
  da lista (por exemplo `/package.json` ou `/src/app.js`) devolvem 404.
- 7 testes novos em `test/security-headers.test.js` (40 testes no total),
  incluindo um teste que garante que as páginas não têm código inline — se
  alguém voltar a pôr um `<script>` no HTML, o teste falha antes de a CSP
  partir a página.
- Validação adicional num browser real (Chromium/Playwright): criar e concluir
  tarefas e usar o dashboard com token funcionam sem violações de CSP.

### 3.3 Scan depois das correções — run #21, commit `7938872`

`FAIL: 0 · WARN: 2 · PASS: 66`

Os avisos 10020, 10038, 10063 e 90004 desapareceram. Restaram dois avisos,
ambos informativos, aceites em `config/zap-rules.tsv`:

| ID | Aviso | Justificação para `IGNORE` |
|---|---|---|
| 10049 | Non-Storable Content | O ZAP usa este ID para **descrever** o estado de cache de cada resposta. Antes das correções dizia "Storable and Cacheable"; depois passou a "Non-Storable Content" — o aviso existe sempre, seja qual for a configuração. O que interessa (API com `no-store`) está garantido por testes automáticos. |
| 10109 | Modern Web Application | Indica apenas que a página usa JavaScript, para sugerir o *AJAX spider*. Não descreve nenhuma vulnerabilidade. |

## 4. Limitações

- **Cobertura do spider.** O spider tradicional só segue *links* do HTML.
  Analisou `/`, `/styles.css`, `/app.js`, `/robots.txt` e `/sitemap.xml`, mas
  **não** `/dashboard` nem os endpoints `/api/*`, que são chamados por
  JavaScript (`fetch`). Um resultado verde do ZAP Baseline não significa que
  toda a aplicação foi analisada. Os cabeçalhos dessas rotas estão cobertos
  pelos testes automáticos, mas não pelo ZAP.
- **Apenas análise passiva.** Não são testadas injeções (SQL, XSS refletido,
  etc.). Um *active scan* seria o passo seguinte, sempre contra a instância
  temporária.
- **Sem autenticação.** Os endpoints protegidos por token foram vistos pelo ZAP
  apenas do lado não autenticado (401).
- As regras `IGNORE` aplicam-se a todas as URLs; devem ser revistas se a
  aplicação mudar.

## 5. Falha relacionada na pipeline: versão do Ollama

Durante a SCRUM-28, o job `quality` falhou no AI Gate (runs #19, #20 e #21)
com `Motivo de conclusão: length`, sem alterações à configuração da IA e, nos
runs #19 e #20, sem alterações ao `src/app.js` — que tinha passado no run #18.

- **Causa provável:** o workflow instalava sempre a versão mais recente do
  Ollama; a v0.40.17 foi publicada a 20/11/2026, entre o run #18 (verde) e os
  runs que falharam.
- **Decisão:** fixar a versão (`OLLAMA_VERSION: '0.40.16'`), escrever a versão
  no log e falhar o passo se a versão instalada for diferente.
- **Resultado:** no run #22, com o mesmo `src/app.js` do run #21, o AI Gate
  terminou com `stop` em cerca de 1 minuto e deu PASS (no run #21, com a versão
  mais recente, tinha terminado com `length` ao fim de cerca de 4 minutos).
- **Lição:** a reprodutibilidade de um gate com IA depende de toda a cadeia de
  execução, incluindo a versão do *runtime*, e não só do modelo, da
  temperatura e da *seed*. Candidato a entrada no Architectural Feedback Log
  (SCRUM-24).

## 6. Executar o ZAP localmente (Windows, PowerShell)

Requer Docker Desktop. Numa janela:

```powershell
$env:METRICS_TOKEN = "token-local-de-teste"
npm start
```

Noutra janela, na pasta do projeto:

```powershell
docker run --rm -v "${PWD}:/zap/wrk/:rw" -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t http://host.docker.internal:3000 -c config/zap-rules.tsv -r zap-report.html
```

O relatório fica em `zap-report.html`, na pasta do projeto (não o adiciones ao
repositório).
