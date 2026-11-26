# Registo Scrum — TaskFlow-XOps

**Equipa:** Simão Pereira e Tiago Bolota ·
**Jira:** [projeto SCRUM](https://simaopt89-1791988686291.atlassian.net)

## 1. Team Contract

O Team Contract foi criado e assinado pelos dois membros no Sprint 1:
anexo `Team Contract — TaskFlow.pdf` na issue **SCRUM-13** ("Criar Team
Contract e registos Scrum"), juntamente com `Scrum_Sprint1_TaskFlow.pdf`.

## 2. Rotação do Product Owner

O enunciado exige que o papel de Product Owner rode entre os membros, com cada
membro a desempenhá-lo pelo menos uma vez.

| Sprint | Product Owner | Objetivo (do Jira) |
|---|---|---|
| Sprint 1 — Protótipo inicial | **Simão Pereira** | Protótipo funcional (criar, listar, concluir tarefas), repositório GitHub, testes e CI inicial |
| Sprint 2 | **Tiago Bolota** | Consolidar o protótipo, testes no GitHub Actions e documentação da arquitetura |
| Sprint 3 | **Simão Pereira** | Análise de código com IA na pipeline, configuração versionada e reprodutibilidade |
| Sprint 4 | **Tiago Bolota** | Observabilidade (métricas, dashboard, alertas com IA), DAST e documentação |
| Sprint 5 | **Simão Pereira** | Ver secção 3 |

Cada membro foi Product Owner pelo menos uma vez: Simão Pereira nos Sprints 1,
3 e 5 e Tiago Bolota nos Sprints 2 e 4, alternando em todos os sprints.

## 3. Sprint 5 — Planning

**Product Owner:** Simão Pereira
**Sprint no Jira:** "Sprint 5", de 26/11 a 07/12/2026 (entrega final do projeto)

**Objetivo do sprint:** completar o ciclo CI/CD com entrega contínua,
melhorar a experiência de utilização para a demonstração final e consolidar
as evidências exigidas pelo enunciado (Architectural Feedback no Jira, Scrum,
relatório IEEE).

### Sprint Backlog

| ID | Jira | Item | Prioridade | Critério de conclusão |
|---|---|---|---|---|
| S5-1 | SCRUM-40 | Melhorar a interface principal | Alta | Redesign responsivo e acessível, sem código inline (CSP), testes a passar e validado num browser |
| S5-2 | SCRUM-41 | Containerizar e fazer deploy contínuo | Alta | Imagem Docker construída e testada no CI; publicação automática após a pipeline passar na `main` |
| S5-3 | SCRUM-42 | Architectural Feedback no Jira com label | Alta | Uma issue por entrada AFL, com causa raiz, decisão exposta e correção estrutural |
| S5-4 | SCRUM-43 | Testes assistidos por IA | Média | Testes sugeridos pelo modelo, revistos pela equipa, com taxa de aproveitamento documentada |
| S5-5 | SCRUM-44 | Evidências Scrum do Sprint 5 | Alta | Planning, dailies, review e retrospetiva registados; rotação de PO documentada |
| S5-6 | SCRUM-45 | Relatório final IEEE e preparação da demo | Alta | Relatório até 10 páginas no template IEEE; guião da demonstração |
| S5-7 | SCRUM-46 | Pequenas correções técnicas | Baixa | Endereço configurável em `scripts/ai-alerts.js`; contagem do `npm test`; decisão sobre o AI Gate ser bloqueante |

### Definition of Done (Sprint 5)

- Pipeline verde (testes, SAST, AI Gate e DAST) no commit final da tarefa.
- Sem desativar verificações nem aprovar avisos automaticamente.
- Documentação atualizada quando a tarefa muda a arquitetura ou o
  comportamento.
- Evidência registada no Jira (commit, run ou documento).

## 4. Sprint 5 — Daily Scrum

Registo das reuniões diárias: o que foi feito, o que se segue e impedimentos.

| Data | Feito | A seguir | Impedimentos |
|---|---|---|---|
| 26/11 | PR #2 (documentação SCRUM-30) integrado na `main`. **S5-1:** interface principal redesenhada (commits `2625d80`, `c91c404`). **S5-3:** 9 issues Architectural Feedback criadas no Jira (SCRUM-31 a 39) e classificação no log (commit `0396fbf`). **S5-5:** este registo; Sprint 4 registado no Jira (retroativamente, com as SCRUM-25 a 30) e Sprint 5 criado e iniciado com as SCRUM-40 a 46 | S5-2 (Docker e deploy), S5-4 | POs dos Sprints 1–3 por confirmar |
| | | | |

## 5. Sprint 5 — Review

*A preencher no fim do sprint:* itens concluídos e não concluídos,
demonstração feita, feedback recebido.

## 6. Sprint 5 — Retrospetiva

*A preencher no fim do sprint:*

| O que correu bem | O que correu mal | O que mudar |
|---|---|---|
| | | |
