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

function pct(part: number, total: number) {
  if (total === 0) return '0%';
  return `${((part / total) * 100).toFixed(1)}%`;
}

export function buildInsightsPrompt(data: InsightsData): string {
  const top5Sellers = data.topSellers.slice(0, 5);
  const top5Clients = data.topClients.slice(0, 5);
  const top5Products = data.topProducts.slice(0, 5);

  const topSellerRevenue = top5Sellers[0]?.revenue ?? 0;
  const topClientRevenue = top5Clients[0]?.revenue ?? 0;
  const top3SellersRevenue = top5Sellers.slice(0, 3).reduce((s, x) => s + x.revenue, 0);
  const top3ClientsRevenue = top5Clients.slice(0, 3).reduce((s, x) => s + x.revenue, 0);

  const revenuePerSeller =
    data.topSellers.length > 0 ? data.totalRevenue / data.topSellers.length : 0;

  const trend = data.salesTrend.slice(-12);
  const midpoint = Math.floor(trend.length / 2);
  const firstHalfRevenue = trend.slice(0, midpoint).reduce((s, t) => s + t.revenue, 0);
  const secondHalfRevenue = trend.slice(midpoint).reduce((s, t) => s + t.revenue, 0);
  const trendDirection =
    firstHalfRevenue === 0
      ? 'sem dados suficientes'
      : secondHalfRevenue > firstHalfRevenue * 1.05
      ? 'CRESCENDO'
      : secondHalfRevenue < firstHalfRevenue * 0.95
      ? 'CAINDO'
      : 'ESTÁVEL';

  const topSellersText = top5Sellers
    .map(
      (s, i) =>
        `  ${i + 1}. ${s.name}: R$ ${fmt(s.revenue)} (${s.sales} vendas) — ${pct(s.revenue, data.totalRevenue)} do total`
    )
    .join('\n');

  const topClientsText = top5Clients
    .map(
      (c, i) =>
        `  ${i + 1}. ${c.name}: R$ ${fmt(c.revenue)} (${c.sales} compras) — ticket médio R$ ${fmt(c.revenue / Math.max(c.sales, 1))}`
    )
    .join('\n');

  const topProductsText = top5Products
    .map(
      (p, i) =>
        `  ${i + 1}. ${p.name}: R$ ${fmt(p.revenue)} (${p.sales} vendas) — ${pct(p.revenue, data.totalRevenue)} do total`
    )
    .join('\n');

  const trendText = trend
    .map((t) => `  ${t.date}: ${t.sales} vendas / R$ ${fmt(t.revenue)}`)
    .join('\n');

  return `Você é um consultor de negócios experiente falando diretamente com o DONO de uma empresa de viagens e turismo. Sua linguagem é direta, sem rodeios. Você fala o que precisa ser feito, não o que o dono quer ouvir. Você pensa em DINHEIRO, RISCO e CRESCIMENTO.

=== DADOS DO PERÍODO: ${data.startDate} a ${data.endDate} ===

NÚMEROS GERAIS
- Faturamento: R$ ${fmt(data.totalRevenue)}
- Vendas: ${data.totalSales} | Ticket médio: R$ ${fmt(data.avgTicket)}
- Clientes ativos: ${data.totalClients} | Produtos vendidos: ${data.totalProducts}
- Faturamento médio por vendedor: R$ ${fmt(revenuePerSeller)}
- Tendência de receita (vs. primeira metade do período): ${trendDirection}

CONCENTRAÇÃO DE RISCO — VENDEDORES
- Top vendedor sozinho representa ${pct(topSellerRevenue, data.totalRevenue)} do faturamento
- Top 3 vendedores juntos: ${pct(top3SellersRevenue, data.totalRevenue)} do total
${topSellersText}

CONCENTRAÇÃO DE RISCO — CLIENTES
- Top cliente sozinho representa ${pct(topClientRevenue, data.totalRevenue)} do faturamento
- Top 3 clientes juntos: ${pct(top3ClientsRevenue, data.totalRevenue)} do total
${topClientsText}

PRODUTOS MAIS VENDIDOS
${topProductsText}

EVOLUÇÃO DO FATURAMENTO (cronológico)
${trendText}

COMPORTAMENTO DE COMPRA
- Antecedência média de compra: ${data.avgAdvanceDays} dias antes da viagem
- Compras de última hora (0-7 dias): ${data.shortNotice} vendas (${pct(data.shortNotice, data.totalSales)} do total)
- Planejamento antecipado (30+ dias): ${data.longAdvance} vendas (${pct(data.longAdvance, data.totalSales)} do total)

===

Agora me dê uma análise como consultor que conhece esse negócio. Use os NÚMEROS acima em cada ponto. Estruture EXATAMENTE assim:

## 💰 SITUAÇÃO ATUAL
Em 3-5 frases, diga como está o negócio: está crescendo ou encolhendo, onde está o dinheiro, e qual é o maior problema/oportunidade visível nos dados agora.

## 🚨 RISCOS QUE PRECISAM DE ATENÇÃO IMEDIATA
Liste 3 a 4 riscos concretos e quantificados. Pense como dono: dependência de vendedor, cliente ou produto, tendência negativa, margens, etc. Seja específico com nomes e números.

## 🎯 O QUE FAZER NAS PRÓXIMAS 2 SEMANAS
Liste 5 ações com prioridade, do mais urgente ao menos urgente. Para cada uma:
- O QUE fazer (ação concreta, não vaga)
- POR QUÊ (número que justifica)
- RESULTADO ESPERADO (em R$ ou % quando possível)

## 📈 ONDE ESTÁ O MAIOR POTENCIAL DE CRESCIMENTO
Aponte 2 ou 3 oportunidades reais baseadas nos dados: produto subestimado, cliente com potencial de comprar mais, sazonalidade a explorar, etc.

Seja direto. Sem enrolação. O dono não tem tempo para parágrafo longo. Use bullets quando possível. Responda em português brasileiro.`;
}
