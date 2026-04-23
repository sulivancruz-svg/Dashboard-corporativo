# AI Insights — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar uma página `/dashboard/insights` com botão "Gerar Análise" que lê os dados de vendas, chama Claude via streaming e exibe diagnóstico + alertas + recomendações estratégicas priorizadas.

**Architecture:** A route `GET /api/insights` agrega dados diretamente via funções existentes (`calculateMetrics`, `getSellersData`), monta um prompt com `insights-prompt.ts`, e retorna um `ReadableStream` do Anthropic SDK. A página é um Client Component que lê o stream progressivamente.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, `@anthropic-ai/sdk`, Tailwind CSS v4. Alias `@/*` → `./app/*`.

---

## Mapa de arquivos

| Ação | Arquivo |
|---|---|
| Criar | `app/lib/insights-prompt.ts` |
| Criar | `app/api/insights/route.ts` |
| Criar | `app/dashboard/insights/page.tsx` |
| Modificar | `app/components/Navigation.tsx` |

---

## Task 1: Instalar dependência do Anthropic SDK

**Files:**
- Modify: `package.json` (via npm install)

- [ ] **Step 1: Instalar o SDK**

```bash
cd C:/corporate-dashboard && npm install @anthropic-ai/sdk
```

Saída esperada: `added 1 package` (ou similar, sem erros)

- [ ] **Step 2: Verificar que a dependência aparece no package.json**

```bash
grep anthropic C:/corporate-dashboard/package.json
```

Saída esperada: `"@anthropic-ai/sdk": "^x.x.x"`

- [ ] **Step 3: Adicionar ANTHROPIC_API_KEY ao .env**

Abra `C:/corporate-dashboard/.env` e adicione:
```
ANTHROPIC_API_KEY=sk-ant-...
```
(use a chave real da conta Anthropic)

- [ ] **Step 4: Commit**

```bash
cd C:/corporate-dashboard && git add package.json package-lock.json && git commit -m "chore: add @anthropic-ai/sdk dependency"
```

---

## Task 2: Criar `app/lib/insights-prompt.ts`

**Files:**
- Create: `app/lib/insights-prompt.ts`

- [ ] **Step 1: Criar o arquivo**

Criar `C:/corporate-dashboard/app/lib/insights-prompt.ts` com o conteúdo:

```typescript
import type { OverviewData } from '@/lib/google-sheets';

interface InsightsData extends OverviewData {
  startDate: string;
  endDate: string;
  avgAdvanceDays: number;
  shortNotice: number;
  longAdvance: number;
}

function fmt(value: number) {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function buildInsightsPrompt(data: InsightsData): string {
  const topSellersText = data.topSellers
    .slice(0, 5)
    .map((s, i) => `${i + 1}. ${s.name}: R$ ${fmt(s.revenue)} (${s.sales} vendas)`)
    .join('\n');

  const topClientsText = data.topClients
    .slice(0, 5)
    .map((c, i) => `${i + 1}. ${c.name}: R$ ${fmt(c.revenue)} (${c.sales} compras)`)
    .join('\n');

  const topProductsText = data.topProducts
    .slice(0, 5)
    .map((p, i) => `${i + 1}. ${p.name}: R$ ${fmt(p.revenue)} (${p.sales} vendas)`)
    .join('\n');

  const trendText = data.salesTrend
    .slice(-12)
    .map((t) => `${t.date}: ${t.sales} vendas / R$ ${fmt(t.revenue)}`)
    .join('\n');

  return `Você é um analista estratégico de negócios. Analise os dados de vendas abaixo e gere insights em português brasileiro.

PERÍODO ANALISADO: ${data.startDate} a ${data.endDate}

VISÃO GERAL
- Total de vendas: ${data.totalSales}
- Faturamento total: R$ ${fmt(data.totalRevenue)}
- Ticket médio: R$ ${fmt(data.avgTicket)}
- Clientes únicos: ${data.totalClients}
- Produtos distintos vendidos: ${data.totalProducts}

TOP 5 VENDEDORES (por faturamento)
${topSellersText}

TOP 5 CLIENTES (por faturamento)
${topClientsText}

TOP 5 PRODUTOS (por faturamento)
${topProductsText}

TENDÊNCIA (últimos 12 períodos)
${trendText}

COMPORTAMENTO DE COMPRA
- Antecedência média: ${data.avgAdvanceDays} dias
- Vendas de última hora (0-7 dias): ${data.shortNotice}
- Vendas com 30+ dias de antecedência: ${data.longAdvance}

---

Gere uma análise estratégica estruturada EXATAMENTE nestas 3 seções:

## 🔍 DIAGNÓSTICO
Explique o que está acontecendo: tendências de faturamento, concentração de vendas por vendedor/cliente/produto, sazonalidade visível na tendência, e qualquer padrão relevante nos dados.

## ⚠️ ALERTAS
Liste de 3 a 5 pontos de atenção concretos. Cada alerta deve citar números específicos dos dados fornecidos.

## 🎯 RECOMENDAÇÕES ESTRATÉGICAS
Liste exatamente 5 ações priorizadas. Para cada uma: qual a ação, por que (baseada nos dados), e qual o impacto esperado.

Seja direto, objetivo e use sempre os números fornecidos para embasar cada ponto. Responda em português brasileiro.`;
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd C:/corporate-dashboard && npx tsc --noEmit 2>&1 | head -20
```

Saída esperada: sem erros relacionados ao arquivo novo.

- [ ] **Step 3: Commit**

```bash
cd C:/corporate-dashboard && git add app/lib/insights-prompt.ts && git commit -m "feat: add insights prompt builder"
```

---

## Task 3: Criar `app/api/insights/route.ts`

**Files:**
- Create: `app/api/insights/route.ts`

- [ ] **Step 1: Criar a pasta e o arquivo**

Criar `C:/corporate-dashboard/app/api/insights/route.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { NextRequest } from 'next/server';
import {
  calculateMetrics,
  filterSalesByDateRange,
  getGoogleSheetsData,
  parseSalesData,
} from '@/lib/google-sheets';
import { buildInsightsPrompt } from '@/lib/insights-prompt';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const spreadsheetId = process.env.GOOGLE_SHEETS_CORPORATE_ID;
  const sheetGid = process.env.GOOGLE_SHEETS_CORPORATE_GID;
  const sheetsApiKey = process.env.GOOGLE_SHEETS_CORPORATE_API_KEY;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  if (!spreadsheetId || !sheetGid || !sheetsApiKey) {
    return new Response('Google Sheets configuration missing', { status: 400 });
  }

  if (!anthropicApiKey) {
    return new Response('ANTHROPIC_API_KEY not configured', { status: 400 });
  }

  const startDate = req.nextUrl.searchParams.get('startDate');
  const endDate = req.nextUrl.searchParams.get('endDate');

  let sales;
  try {
    const { headers, data } = await getGoogleSheetsData(spreadsheetId, sheetGid, sheetsApiKey);
    sales = filterSalesByDateRange(parseSalesData(data, headers), startDate, endDate);
  } catch (err) {
    return new Response(
      `Falha ao buscar dados: ${err instanceof Error ? err.message : String(err)}`,
      { status: 500 }
    );
  }

  if (sales.length === 0) {
    return new Response('Nenhuma venda encontrada no período selecionado', { status: 400 });
  }

  const metrics = calculateMetrics(sales);
  const avgAdvanceDays =
    Number((sales.reduce((sum, s) => sum + s.advanceDays, 0) / sales.length).toFixed(1));
  const shortNotice = sales.filter((s) => s.advanceDays >= 0 && s.advanceDays <= 7).length;
  const longAdvance = sales.filter((s) => s.advanceDays > 30).length;

  const prompt = buildInsightsPrompt({
    ...metrics,
    startDate: startDate ?? 'início dos registros',
    endDate: endDate ?? 'hoje',
    avgAdvanceDays,
    shortNotice,
    longAdvance,
  });

  const client = new Anthropic({ apiKey: anthropicApiKey });

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = client.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 1500,
          messages: [{ role: 'user', content: prompt }],
        });

        for await (const chunk of stream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            controller.enqueue(new TextEncoder().encode(chunk.delta.text));
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'X-Accel-Buffering': 'no',
      'Cache-Control': 'no-cache',
    },
  });
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd C:/corporate-dashboard && npx tsc --noEmit 2>&1 | head -30
```

Saída esperada: sem erros.

- [ ] **Step 3: Testar a route com o servidor rodando**

Iniciar o servidor: `npm run dev`

Acessar no browser ou via curl (substituir datas):
```
http://localhost:3000/api/insights?startDate=2025-01-01&endDate=2025-12-31
```

Resultado esperado: texto de análise aparecendo progressivamente no browser.

Se retornar `ANTHROPIC_API_KEY not configured`: confirme que `.env` tem a chave e reinicie o servidor.

- [ ] **Step 4: Commit**

```bash
cd C:/corporate-dashboard && git add app/api/insights/route.ts && git commit -m "feat: add insights API route with Claude streaming"
```

---

## Task 4: Criar `app/dashboard/insights/page.tsx`

**Files:**
- Create: `app/dashboard/insights/page.tsx`

- [ ] **Step 1: Criar a pasta e o arquivo**

Criar `C:/corporate-dashboard/app/dashboard/insights/page.tsx`:

```typescript
'use client';

import { useState } from 'react';

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function defaultDateRange() {
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setMonth(startDate.getMonth() - 1);
  return {
    startDate: toDateInputValue(startDate),
    endDate: toDateInputValue(endDate),
  };
}

export default function InsightsPage() {
  const defaults = defaultDateRange();
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleGenerate() {
    setIsLoading(true);
    setContent('');
    setError('');

    try {
      const res = await fetch(`/api/insights?startDate=${startDate}&endDate=${endDate}`);

      if (!res.ok || !res.body) {
        const text = await res.text();
        throw new Error(text || `Erro ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setContent((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">
          IA Estratégica
        </p>
        <h1 className="mt-1 text-3xl font-bold text-white">Inteligência de Negócios</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 rounded border border-cyan-400/15 bg-[#0B2440] p-4 shadow-[0_14px_35px_rgba(0,0,0,0.24)] md:grid-cols-[1fr_1fr_auto]">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-cyan-100/80">Data inicial</span>
          <input
            className="w-full rounded border border-cyan-300/20 bg-[#07182D] px-3 py-2 text-cyan-50 outline-none focus:border-emerald-300"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-cyan-100/80">Data final</span>
          <input
            className="w-full rounded border border-cyan-300/20 bg-[#07182D] px-3 py-2 text-cyan-50 outline-none focus:border-emerald-300"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </label>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isLoading}
          className="self-end rounded bg-emerald-400 px-4 py-2 font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? 'Analisando...' : content ? 'Regenerar Análise' : 'Gerar Análise'}
        </button>
      </div>

      {error && (
        <div className="rounded border border-rose-400/30 bg-rose-500/10 p-4 text-rose-100">
          {error.includes('ANTHROPIC_API_KEY')
            ? 'Configure a variável ANTHROPIC_API_KEY no arquivo .env para usar esta funcionalidade.'
            : `Falha ao gerar análise: ${error}`}
        </div>
      )}

      {isLoading && !content && (
        <div className="rounded border border-cyan-400/15 bg-[#0B2440] p-6 shadow-[0_14px_35px_rgba(0,0,0,0.24)]">
          <div className="flex items-center gap-3 text-cyan-100/60">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
            <span>Analisando dados e gerando insights estratégicos...</span>
          </div>
        </div>
      )}

      {content && (
        <div className="rounded border border-cyan-400/15 bg-[#0B2440] p-6 shadow-[0_14px_35px_rgba(0,0,0,0.24)]">
          {isLoading && (
            <div className="mb-4 flex items-center gap-2 text-sm text-emerald-300">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
              <span>Gerando análise...</span>
            </div>
          )}
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-cyan-50">
            {content}
          </pre>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd C:/corporate-dashboard && npx tsc --noEmit 2>&1 | head -30
```

Saída esperada: sem erros.

- [ ] **Step 3: Commit**

```bash
cd C:/corporate-dashboard && git add app/dashboard/insights/page.tsx && git commit -m "feat: add insights page with streaming UI"
```

---

## Task 5: Adicionar "Inteligência" ao menu de navegação

**Files:**
- Modify: `app/components/Navigation.tsx:26-35`

- [ ] **Step 1: Editar o array `navItems` em `Navigation.tsx`**

Localizar este bloco (linha ~26):
```typescript
  const navItems = [
    { href: '/dashboard', label: 'Visão Geral' },
    { href: '/dashboard/sellers', label: 'Vendedores' },
    { href: '/dashboard/clients', label: 'Clientes' },
    { href: '/dashboard/products', label: 'Produtos' },
    { href: '/dashboard/behavioral', label: 'Comportamento' },
    { href: '/dashboard/comparison', label: 'Comparação' },
    { href: '/dashboard/raw', label: 'Dados Brutos' },
    { href: '/dashboard/settings', label: 'Configurações' },
  ];
```

Substituir por:
```typescript
  const navItems = [
    { href: '/dashboard', label: 'Visão Geral' },
    { href: '/dashboard/sellers', label: 'Vendedores' },
    { href: '/dashboard/clients', label: 'Clientes' },
    { href: '/dashboard/products', label: 'Produtos' },
    { href: '/dashboard/behavioral', label: 'Comportamento' },
    { href: '/dashboard/comparison', label: 'Comparação' },
    { href: '/dashboard/raw', label: 'Dados Brutos' },
    { href: '/dashboard/insights', label: 'Inteligência' },
    { href: '/dashboard/settings', label: 'Configurações' },
  ];
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd C:/corporate-dashboard && npx tsc --noEmit 2>&1 | head -20
```

Saída esperada: sem erros.

- [ ] **Step 3: Commit**

```bash
cd C:/corporate-dashboard && git add app/components/Navigation.tsx && git commit -m "feat: add Inteligência link to navigation"
```

---

## Task 6: Teste de integração manual

- [ ] **Step 1: Garantir que o .env está configurado**

O arquivo `.env` deve conter:
```
GOOGLE_SHEETS_CORPORATE_ID=...
GOOGLE_SHEETS_CORPORATE_GID=...
GOOGLE_SHEETS_CORPORATE_API_KEY=...
ANTHROPIC_API_KEY=sk-ant-...
```

- [ ] **Step 2: Iniciar o servidor**

```bash
cd C:/corporate-dashboard && npm run dev
```

- [ ] **Step 3: Acessar a página**

Abrir `http://localhost:3000/dashboard/insights`

Verificar:
- [ ] Página carrega sem erros
- [ ] Link "Inteligência" aparece no menu de navegação
- [ ] Campos de data mostram o último mês por padrão
- [ ] Clicar "Gerar Análise" mostra o spinner
- [ ] Texto começa a aparecer progressivamente (streaming visível)
- [ ] Ao terminar, botão muda para "Regenerar Análise"
- [ ] A análise contém as 3 seções: 🔍 DIAGNÓSTICO, ⚠️ ALERTAS, 🎯 RECOMENDAÇÕES ESTRATÉGICAS
- [ ] Mudar datas e regenerar produz análise diferente

- [ ] **Step 4: Testar erro de configuração**

Temporariamente remover `ANTHROPIC_API_KEY` do `.env`, reiniciar servidor, clicar "Gerar Análise".

Resultado esperado: mensagem "Configure a variável ANTHROPIC_API_KEY..."

Restaurar a chave ao final.
