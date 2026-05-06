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

export function buildInsightsContext(data: InsightsData): string {
  const top5Sellers = data.topSellers.slice(0, 5);
  const top5Clients = data.topClients.slice(0, 5);
  const top5Products = data.topProducts.slice(0, 5);

  const topSellerRevenue = top5Sellers[0]?.revenue ?? 0;
  const topClientRevenue = top5Clients[0]?.revenue ?? 0;
  const top3SellersRevenue = top5Sellers.slice(0, 3).reduce((sum, item) => sum + item.revenue, 0);
  const top3ClientsRevenue = top5Clients.slice(0, 3).reduce((sum, item) => sum + item.revenue, 0);

  const revenuePerSeller = data.topSellers.length > 0 ? data.totalRevenue / data.topSellers.length : 0;
  const trend = data.salesTrend.slice(-12);
  const midpoint = Math.floor(trend.length / 2);
  const firstHalfRevenue = trend.slice(0, midpoint).reduce((sum, item) => sum + item.revenue, 0);
  const secondHalfRevenue = trend.slice(midpoint).reduce((sum, item) => sum + item.revenue, 0);
  const trendDirection =
    firstHalfRevenue === 0
      ? 'sem dados suficientes'
      : secondHalfRevenue > firstHalfRevenue * 1.05
        ? 'crescendo'
        : secondHalfRevenue < firstHalfRevenue * 0.95
          ? 'caindo'
          : 'estavel';

  const topSellersText = top5Sellers
    .map(
      (seller, index) =>
        `${index + 1}. ${seller.name}: faturamento R$ ${fmt(seller.revenue)}, receita R$ ${fmt(seller.income)}, ${seller.sales} vendas, ${pct(seller.revenue, data.totalRevenue)} do faturamento total`
    )
    .join('\n');

  const topClientsText = top5Clients
    .map(
      (client, index) =>
        `${index + 1}. ${client.name}: faturamento R$ ${fmt(client.revenue)}, receita R$ ${fmt(client.income)}, ${client.sales} compras, ticket medio R$ ${fmt(client.revenue / Math.max(client.sales, 1))}`
    )
    .join('\n');

  const topProductsText = top5Products
    .map(
      (product, index) =>
        `${index + 1}. ${product.name}: faturamento R$ ${fmt(product.revenue)}, receita R$ ${fmt(product.income)}, ${product.sales} vendas, ${pct(product.revenue, data.totalRevenue)} do faturamento total`
    )
    .join('\n');

  const trendText = trend
    .map((item) => `${item.date}: ${item.sales} vendas, faturamento R$ ${fmt(item.revenue)}, receita R$ ${fmt(item.income)}`)
    .join('\n');

  return `Voce e um consultor de negocios experiente falando com o dono de uma empresa de viagens e turismo.
Seja direto, pratico e orientado a dinheiro, risco e crescimento.
Responda sempre em portugues brasileiro.
Use os dados abaixo como verdade para toda a conversa.

Periodo analisado: ${data.startDate} a ${data.endDate}

Numeros gerais
- Faturamento: R$ ${fmt(data.totalRevenue)}
- Receita: R$ ${fmt(data.totalIncome)}
- Vendas: ${data.totalSales}
- Ticket medio: R$ ${fmt(data.avgTicket)}
- Clientes ativos: ${data.totalClients}
- Produtos vendidos: ${data.totalProducts}
- Faturamento medio por vendedor: R$ ${fmt(revenuePerSeller)}
- Tendencia do faturamento na segunda metade do periodo: ${trendDirection}

Concentracao de risco em vendedores
- Top vendedor representa ${pct(topSellerRevenue, data.totalRevenue)} do faturamento
- Top 3 vendedores representam ${pct(top3SellersRevenue, data.totalRevenue)} do faturamento
${topSellersText}

Concentracao de risco em clientes
- Top cliente representa ${pct(topClientRevenue, data.totalRevenue)} do faturamento
- Top 3 clientes representam ${pct(top3ClientsRevenue, data.totalRevenue)} do faturamento
${topClientsText}

Produtos mais vendidos
${topProductsText}

Evolucao cronologica
${trendText}

Comportamento de compra
- Antecedencia media: ${data.avgAdvanceDays} dias
- Compras de ultima hora (0 a 7 dias): ${data.shortNotice} vendas, ${pct(data.shortNotice, data.totalSales)} do total
- Compras com 30+ dias: ${data.longAdvance} vendas, ${pct(data.longAdvance, data.totalSales)} do total

Instrucao de conversa
- Responda como um analista senior de negocio.
- Seja objetivo e use bullets quando ajudar.
- Sempre que fizer afirmacoes relevantes, cite os numeros.
- Se o usuario pedir analise, recomendacao, comparacao, risco, oportunidade, vendedor, cliente ou produto, use estes dados.
- Se faltar dado para uma resposta, diga claramente o que falta.`;
}

export function buildInitialInsightsPrompt() {
  return `Faca uma leitura executiva do periodo. Estruture em:
1. situacao atual
2. riscos imediatos
3. oportunidades
4. acoes praticas para as proximas 2 semanas`;
}
