# Architectural Feedback Log

**Projeto:** TaskFlow-XOps · **Sprints:** 3 e 4 · **Tarefas:** SCRUM-24 e SCRUM-30

Registo das falhas e observações da pipeline que influenciaram decisões de
arquitetura. Só inclui situações que **aconteceram de facto**, com o run do
GitHub Actions ou o commit que as comprova. Cada entrada indica a observação,
a causa, a decisão tomada e o que ficou por resolver.

## Resumo

| ID | Data | Origem | Falha / observação | Decisão |
|---|---|---|---|---|
| AFL-01 | 18/11 | CI #6 | `npm ci` falhou: `package-lock.json` desatualizado | Lockfile sempre versionado com o `package.json` |
| AFL-02 | 18/11 | CI #8 | AI Gate FAIL com falso positivo ALTA | Prompt da IA melhorado e versionado |
| AFL-03 | 19/11 | CI #10 | AI Gate FAIL com 2 falsos positivos ALTA em `json()` | Aprovações manuais associadas ao SHA256 do ficheiro |
| AFL-04 | 19/11 | CI #15 | Aprovação deixou de corresponder a um aviso repetido com outra redação | Correspondência por assinatura (linhas + início da descrição) |
| AFL-05 | 19/11 | CI #17 | AI Gate com `length`: JSON cortado | `num_predict` 1200 → 2400, timeout 180 → 300 s |
| AFL-06 | 21/11 | CI #19–#21, #31–#34 | `length` voltou, sem alterações ao código | Versão do Ollama fixa (insuficiente) e depois `maxLength` no esquema |
| AFL-07 | 21/11 | CI #20 (DAST) | ZAP: 6 avisos de cabeçalhos de segurança | Módulo de cabeçalhos, CSP sem `'unsafe-inline'`, JS/CSS fora do HTML |
| AFL-08 | 21/11 | CI #20–#23 (DAST) | Spider do ZAP não chega ao dashboard nem à API | Limitação documentada; rotas cobertas por testes automáticos |
| AFL-09 | 21/11 | Testes de mutação | Testes antigos não detetavam erros de fronteira nos alertas | Testes nos limites exatos de cada regra |

## Classificação (padrão P1 do enunciado)

Cada entrada está registada no Jira como issue com a label
`Architectural-Feedback`. O tipo de decisão arquitetural exposta segue as
categorias do enunciado:

| ID | Origem | Decisão arquitetural exposta | Correção estrutural |
|---|---|---|---|
| AFL-01 | Falha de build | **Dependência** — o `package.json` e o `package-lock.json` podiam divergir | Lockfile versionado em conjunto; `npm ci` estrito |
| AFL-02 | Falha do AI Gate | **Acoplamento** — a pipeline depende de um componente não determinístico como gate bloqueante | Instruções e entrada do modelo estruturadas (linhas numeradas, máximo de problemas) |
| AFL-03 | Falha do AI Gate | **Contrato de interface** — não havia contrato para exceções revistas pela equipa | Aprovações versionadas, ligadas ao SHA256 do ficheiro |
| AFL-04 | Falha do AI Gate | **Contrato de interface** — assumia-se que a IA repete o mesmo texto | Correspondência por assinatura (gravidade, linhas, início da descrição) |
| AFL-05 | Falha do AI Gate | **Contrato de interface** — o esquema da resposta não limitava o tamanho | Mais tokens e tempo (correção de sintoma) |
| AFL-06 | Falha do AI Gate | **Dependência** (runtime sem versão) e **contrato de interface** (esquema sem `maxLength`) | Versão do Ollama fixa e `maxLength` no esquema JSON |
| AFL-07 | Gate DAST | **Acoplamento** — JavaScript e CSS embutidos no HTML impediam uma CSP restritiva | JS/CSS em ficheiros próprios; módulo único de cabeçalhos |
| AFL-08 | Gate DAST | **Acoplamento** — as rotas da API só são descobertas através do JavaScript do frontend | Limitação documentada; rotas cobertas por testes |
| AFL-09 | Gate de testes (mutação) | **Contrato de interface** — os limiares em `config/monitoring-alerts.json` não tinham testes nas fronteiras | Testes nos valores exatos de cada limite |

AFL-01 a AFL-06 correspondem a runs falhados. AFL-07 a AFL-09 são achados dos
gates (DAST ainda não bloqueante e testes de mutação) que expuseram decisões
de arquitetura, registados pelo mesmo processo.

## Insight arquitetural principal

**O componente não determinístico (AI Gate) foi a origem de quase todas as
falhas da pipeline.** Até 21/11 foram executados 39 runs na `main` e no branch
de trabalho. Dos 11 que falharam:

| Causa | Runs falhados |
|---|---|
| AI Gate — falsos positivos ALTA (AFL-02 a AFL-04) | 3 (#8, #10, #15) |
| AI Gate — resposta cortada `length` (AFL-05, AFL-06) | 7 (#17, #19, #20, #21, #31, #33, #34) |
| Dependências (AFL-01) | 1 (#6) |
| Testes automáticos, SAST ou DAST | **0** |

As verificações determinísticas (sintaxe, 87 testes, ESLint Security, ZAP)
nunca bloquearam a pipeline sem razão. O AI Gate bloqueou-a 10 vezes, e em
nenhuma delas por uma vulnerabilidade real confirmada.

**Consequência para a arquitetura:** um modelo de IA dentro de um gate
bloqueante precisa de limites estruturais à sua volta — esquema de resposta
com tamanhos máximos, validação da resposta, aprovações específicas e
versionadas, e versões fixas do *runtime*. Melhorar só as instruções do modelo
(prompt) não chegou. Sem esses limites, o gate trava a equipa mais vezes do
que protege o código.

## Entradas detalhadas

### AFL-01 — Dependências fora do lockfile

- **Observação:** run #6 (commit `bba14ee`) falhou em `npm ci`:
  `npm error Missing: deep-is@0.1.4 from lock file` (e outras dependências do
  ESLint).
- **Causa:** o `package.json` tinha novas dependências de desenvolvimento,
  mas o `package-lock.json` não foi atualizado no mesmo commit.
- **Decisão:** commit `8911fd1` regenera o lockfile; run #7 verde. O CI usa
  `npm ci`, que exige lockfile sincronizado — falha cedo em vez de instalar
  versões diferentes das testadas localmente.

### AFL-02 — Falso positivo ALTA bloqueia a integração do AI Gate

- **Observação:** run #8 (commit `d36cf92`, primeira integração do AI Gate)
  terminou com FAIL: aviso ALTA na linha 34 sobre o "caminho do ficheiro CSS
  não ser seguro" — o caminho era fixo, não controlado pelo utilizador — e um
  aviso MEDIA a pedir validação que já existia.
- **Decisão:** commit `33c87fa` reescreve as instruções do modelo, envia o
  código com as linhas numeradas (para as linhas reportadas serem
  verificáveis) e reduz o máximo de problemas de 3 para 2; run #9 verde. Mais
  tarde, as instruções passaram a estar versionadas em
  `config/ai-gate-prompt.txt` (commit `b9cb5eb`, SCRUM-22).

### AFL-03 — Falsos positivos recorrentes na função `json()`

- **Observação:** run #10 (commit `3bc9fb2`) com FAIL: dois avisos ALTA
  ("execução arbitrária de código") sobre validação que o código já fazia.
- **Decisão:** commit `eccf122` introduz aprovações manuais em
  `config/ai-gate-approvals.json`, **associadas ao SHA256 do ficheiro** e a
  problemas concretos; run #11 verde. Avisos novos ou noutra versão do
  ficheiro continuam a bloquear.

### AFL-04 — Aprovação não reconhece o mesmo aviso com outra redação

- **Observação:** run #15 (commit `ad2ff72`) com FAIL: o modelo voltou a
  reportar o falso positivo de `json()`, duas vezes na linha 10, com texto
  diferente do aprovado.
- **Causa:** a correspondência exigia texto exatamente igual, mas o modelo
  não repete as descrições (ver `docs/reprodutibilidade-ai-gate.md`).
- **Decisão:** commit `7bf054d` acrescenta correspondência por assinatura:
  mesma gravidade, linha numa lista permitida e descrição que começa pelos
  mesmos ≥ 60 caracteres. Run #16 verde.
- **Risco aceite:** a exceção fica mais larga do que uma correspondência
  exata; é limitada pelo hash do ficheiro, pelas linhas e pela gravidade.

### AFL-05 — Resposta da IA cortada (`length`)

- **Observação:** run #17 (commit `b3a2f05`):
  `Erro na analise: A IA devolveu um JSON inválido ou incompleto. Motivo de
  conclusão: length`.
- **Decisão:** commit `81f10e7` aumenta `num_predict` de 1200 para 2400 e o
  timeout de 180 000 para 300 000 ms; run #18 verde.
- **Avaliação posterior:** a correção tratou o sintoma — o problema voltou
  (AFL-06).

### AFL-06 — `length` volta sem alterações ao código

- **Observação:** runs #19, #20 e #21 (21/11) com `length`, com o mesmo
  `src/app.js` e configuração que tinham passado no run #18.
- **Hipótese 1 — versão do Ollama:** o workflow instalava sempre a versão mais
  recente e a v0.40.17 saiu a 20/11. Commit `08403a1` fixa a v0.40.16; runs
  #22 e #23 verdes.
- **Refutação:** nos runs #31 a #34 (mesmo `src/app.js`, mesma v0.40.16,
  temperatura 0, seed 42) o AI Gate passou **1 vez em 4**. A versão fixa
  ficou (boa prática), mas não era a causa principal.
- **Causa provável:** o esquema JSON não limitava o tamanho dos textos; quando
  o modelo entra em repetição, escreve até esgotar os tokens. A variação entre
  runs é atribuída a diferenças de hardware dos runners — **não comprovado**;
  o workflow passou a registar o processador para o confirmar.
- **Decisão:** commit `9534227` acrescenta `maxLength` ao esquema
  (400/400/300 caracteres). Resultado: **12 em 12** execuções sem `length`
  até 26/11 (#35 duas tentativas, #36, #37, #38, #39 na `main` e #40 a #45),
  contra 1 em 4 antes da correção.
- **Lição:** uma hipótese confirmada com 2 runs verdes foi refutada com mais
  repetições. Correções de componentes não determinísticos devem ser validadas
  com várias execuções sobre o mesmo código.

### AFL-07 — Cabeçalhos de segurança em falta (DAST)

- **Observação:** primeiro scan OWASP ZAP (run #20): 6 avisos — sem CSP, sem
  proteção contra *clickjacking*, sem Permissions-Policy, sem isolamento entre
  origens. Nenhum tinha sido detetado pelo SAST ou pelo AI Gate.
- **Decisão:** commit `7938872` cria `src/security-headers.js`, aplicado a
  todas as respostas. Para a CSP não precisar de `'unsafe-inline'`, o
  JavaScript e o CSS foram retirados do HTML para ficheiros próprios — uma
  alteração de estrutura do frontend motivada por uma ferramenta de segurança.
  Run #21: 6 → 2 avisos (ambos informativos). Commit `10600fe` torna o ZAP
  bloqueante para avisos novos.

### AFL-08 — Cobertura limitada do DAST

- **Observação:** o spider do ZAP só segue *links* HTML; não analisou
  `/dashboard` nem `/api/*` (chamados por JavaScript). Os URLs visitados
  também variaram entre runs (`/robots.txt` num, `/sitemap.xml` noutro).
- **Decisão:** limitação documentada em `docs/dast-zap.md`; os cabeçalhos
  dessas rotas são verificados por testes automáticos.
- **Em aberto:** dar ao ZAP a lista de rotas a visitar e testar o lado
  autenticado.

### AFL-09 — Testes que não testavam as fronteiras

- **Observação:** na SCRUM-29, quatro mutações de fronteira em
  `src/alerts.js` (`>` → `>=`, `<` → `<=`) **não eram detetadas** pelos 5
  testes de alertas existentes.
- **Decisão:** testes nos valores exatos de cada limite, lidos de
  `config/monitoring-alerts.json`; as 9 mutações testadas passaram a ser
  todas detetadas (`docs/testes-monitorizacao.md`).
- **Achado relacionado:** sem a verificação de `METRICS_TOKEN` configurado, o
  cabeçalho `Authorization: Bearer undefined` daria acesso às métricas. O
  código atual não tem o problema; um teste impede que seja introduzido.

## Decisões em aberto

1. Confirmar ou descartar a hipótese do hardware (AFL-06) com o registo do
   processador nos próximos runs.
2. Rever periodicamente as aprovações manuais e as regras `IGNORE` do ZAP
   sempre que o código mudar.
3. Alargar a cobertura do DAST ao dashboard e à API (AFL-08).
4. Persistência de dados, autenticação de utilizadores e deploy automático
   continuam fora do âmbito atual (ver `Documentaçaoarquitetura.pdf`).
