# TaskFlow — Plataformas e Serviços X-Ops

Protótipo de gestor de tarefas para demonstração do Sprint 1 (2026/27, UBI).

## Requisitos
- Node.js 22+ (sem dependências externas)

## Executar
```bash
npm start
```
Abrir **http://localhost:3000**.

## Verificar qualidade localmente
```bash
npm run check
npm test
```

## Funcionalidades
- Criar tarefas;
- Listar tarefas;
- Concluir ou reabrir tarefas;
- Endpoint de saúde `/api/health`.

## Arquitetura
Navegador (HTML/CSS/JS) → servidor Node.js (API HTTP) → dados em memória.

O desenho é uma **arquitetura cliente-servidor em camadas**: interface, API e armazenamento provisório. Permite desenvolver e testar cada parte separadamente. A memória não garante persistência; uma base de dados será considerada em sprint futuro.

## Pipeline
O workflow `.github/workflows/ci.yml` executa automaticamente validação sintática e testes em eventos `push` e `pull_request`.

**Limites atuais:** não há deploy, SAST/DAST integrados, gate autónomo de IA ou observabilidade. Estes são objetivos dos próximos sprints — não devem ser apresentados como implementados.

## IA no desenvolvimento
A ferramenta de IA utilizada para criar o protótipo foi o ChatGPT. A equipa deve rever o código e registar no Jira exemplos concretos da utilização, verificações feitas e limites encontrados.

## Scrum
Ver `docs/SPRINT1.md`, `docs/TEAM_CONTRACT.md` e `docs/APRESENTACAO.md`. Transferir as tarefas para o Jira, atribuir responsáveis e adicionar evidências reais.
