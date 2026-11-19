# Relatório de Reprodutibilidade do AI Gate

**Projeto:** TaskFlow-XOps  
**Sprint:** 3  
**Tarefa:** SCRUM-23 — Verificar reprodutibilidade do AI Gate  
**Data:** 19/11/2026

## 1. Objetivo

Avaliar a reprodutibilidade do sistema de análise de código com Inteligência Artificial, executando duas vezes a mesma análise com o mesmo código e as mesmas configurações.

## 2. Configuração utilizada

- Modelo: `qwen2.5-coder:1.5b`
- Ficheiro analisado: `src/app.js`
- Temperatura: `0`
- Seed: `42`
- Máximo de tokens gerados: `1200`
- Janela de contexto: `8192`
- Limite de rejeição: `ALTA`
- Número máximo de problemas: `2`

O hash SHA-256 do código foi igual nas duas execuções:

`b04c7a2060dccfc4b102881ebc3abe4bfeba7783014de928838e9afce5ce82f1`

## 3. Resultados

| Critério | Execução 1 | Execução 2 |
|---|---|---|
| Resultado original da IA | FAIL | FAIL |
| Resultado final do AI Gate | PASS | PASS |
| Problemas identificados | 2 | 2 |
| Gravidade dos problemas | ALTA | ALTA |
| Linhas reportadas | 10 e 10 | 10 e 15 |
| Aprovação manual aplicada | Sim | Sim |

Os relatórios completos não foram idênticos.

## 4. Análise das diferenças

Embora ambas as execuções tenham produzido a mesma decisão, verificaram-se diferenças nas descrições e nas linhas identificadas.

Na primeira execução, o modelo apresentou dois avisos praticamente duplicados na linha 10.

Na segunda execução, apresentou avisos semelhantes nas linhas 10 e 15.

Os problemas reportados relacionavam-se com a função `json()` e a validação dos dados antes da serialização. A análise manual não confirmou as vulnerabilidades graves descritas.

O resultado final manteve-se como PASS devido ao mecanismo de aprovação manual associado ao hash do ficheiro.

## 5. Possíveis causas

As diferenças podem resultar da natureza probabilística dos modelos de linguagem e de variações na sua execução.

Os parâmetros de temperatura e seed ajudam a controlar a geração, mas não garantem resultados integralmente idênticos em todas as execuções e ambientes.

## 6. Melhorias propostas

1. Manter o modelo, as instruções e os parâmetros de execução versionados.
2. Comparar separadamente o resultado original da IA e a decisão final do AI Gate.
3. Registar automaticamente as diferenças entre execuções.
4. Melhorar as instruções do modelo para reduzir falsos positivos e avisos duplicados.
5. Substituir gradualmente as aprovações de ficheiros inteiros por exceções específicas para vulnerabilidades verificadas, evitando que avisos graves não relacionados sejam ignorados.

## 7. Conclusão

O AI Gate apresentou decisões consistentes nas duas execuções, mas as respostas produzidas pelo modelo não foram integralmente reproduzíveis.

A experiência demonstrou que a estabilidade da decisão final não garante a estabilidade das análises da IA, especialmente quando existem aprovações manuais.

O teste permitiu identificar limitações do modelo e propor melhorias para aumentar a fiabilidade e a rastreabilidade da pipeline.