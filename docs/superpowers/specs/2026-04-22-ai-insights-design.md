# Design: Inteligência Estratégica com IA

**Data:** 2026-04-22
**Projeto:** corporate-dashboard
**Status:** Aprovado

## Objetivo

Adicionar uma página dedicada de insights gerados por IA que lê os dados de vendas do dashboard e produz diagnóstico, alertas e recomendações estratégicas priorizadas em linguagem natural.

---

## Arquitetura

```
Google Sheets
     ↓
APIs existentes (/api/overview, /api/sellers, /api/clients, /api/behavioral)
     ↓
/api/insights  ← nova route: agrega dados, monta prompt, chama Claude com streaming
     ↓
/dashboard/insights  ← nova página: botão "Gerar Análise" + renderização do stream
```

### Novos arquivos

| Arquivo | Responsabilidade |
|---|---|
| `app/api/insights/route.ts` | Agrega dados das APIs existentes, chama Anthropic SDK com streaming |
| `app/dashboard/insights/page.tsx` | Página com UI de geração e exibição dos insights |
| `app/lib/insights-prompt.ts` | Monta o prompt com os dados formatados |

### Variável de ambiente

```
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Dados enviados para Claude

A route `/api/insights` chama as APIs existentes em paralelo (`/api/overview`, `/api/sellers`, `/api/clients`, `/api/behavioral`) respeitando o mesmo filtro de `startDate`/`endDate` já usado no dashboard.

O prompt enviado ao modelo contém apenas métricas pré-calculadas (não registros brutos), mantendo o uso de tokens baixo (~1.500–1.800 tokens por análise, custo ~$0,015/chamada):

```
Período: DD/MM/AAAA – DD/MM/AAAA

VISÃO GERAL
- Total de vendas, faturamento, ticket médio, clientes únicos, produtos

TOP VENDEDORES (nome, faturamento, nº vendas)
TOP CLIENTES (nome, faturamento, nº compras)
TOP PRODUTOS (produto, faturamento, nº vendas)
TENDÊNCIA MENSAL (mês, faturamento, vendas)
COMPORTAMENTO (antecedência média, destinos mais vendidos, status das vendas)
```

### Modelo

`claude-sonnet-4-6` via `@anthropic-ai/sdk`

### Estrutura da resposta (streaming)

Claude retorna análise dividida em 3 blocos:

1. **Diagnóstico** — padrões, tendências, anomalias
2. **Alertas** — riscos e pontos de atenção
3. **Recomendações estratégicas priorizadas** — ações concretas com justificativa

---

## Interface (`/dashboard/insights`)

- Seletor de data (mesmo componente já existente no projeto)
- Botão "Gerar Análise" → chama `/api/insights` com streaming
- Texto aparece progressivamente em tempo real dividido nas 3 seções
- Após concluir: botão vira "Regenerar Análise"
- Em caso de erro (sem `ANTHROPIC_API_KEY` ou falha de rede): mensagem clara de configuração
- Link "Insights" adicionado ao menu lateral existente

---

## Fluxo de dados

```
1. Usuário seleciona período e clica "Gerar Análise"
2. Frontend faz GET /api/insights?startDate=...&endDate=...
3. Route chama em paralelo: overview + sellers + clients + behavioral APIs
4. insights-prompt.ts formata os dados em texto estruturado
5. Anthropic SDK inicia stream com claude-sonnet-4-6
6. Route retorna ReadableStream (text/plain; charset=utf-8)
7. Frontend lê o stream e renderiza progressivamente
```

---

## Fora do escopo

- Chat / follow-up interativo com Claude
- Múltiplos agentes paralelos por dimensão
- Cache automático dos insights
- Exportação PDF dos insights
