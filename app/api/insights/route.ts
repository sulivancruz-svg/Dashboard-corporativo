import Anthropic from '@anthropic-ai/sdk';
import { NextRequest } from 'next/server';
import {
  calculateMetrics,
  filterSalesByDateRange,
  filterSalesByStatus,
  getGoogleSheetsData,
  parseSalesData,
} from '@/lib/google-sheets';
import { buildInsightsPrompt } from '@/lib/insights-prompt';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
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

    const { headers, data } = await getGoogleSheetsData(spreadsheetId, sheetGid, sheetsApiKey);
    const sales = filterSalesByDateRange(parseSalesData(data, headers), startDate, endDate);

    if (sales.length === 0) {
      return new Response('Nenhuma venda encontrada no período selecionado', { status: 400 });
    }

    const closedSales = filterSalesByStatus(sales, 'fechada');
    const openSalesList = filterSalesByStatus(sales, 'aberta');
    const confirmedSales = closedSales.length > 0 ? closedSales : sales;
    const openSalesData = {
      revenue: openSalesList.reduce((sum, s) => sum + s.value, 0),
      count: openSalesList.length,
    };

    const metrics = calculateMetrics(confirmedSales, openSalesData);
    const avgAdvanceDays = Number(
      (confirmedSales.reduce((sum, s) => sum + s.advanceDays, 0) / confirmedSales.length).toFixed(1)
    );
    const shortNotice = confirmedSales.filter((s) => s.advanceDays >= 0 && s.advanceDays <= 7).length;
    const longAdvance = confirmedSales.filter((s) => s.advanceDays > 30).length;

    const prompt = buildInsightsPrompt({
      ...metrics,
      startDate: startDate ?? 'início dos registros',
      endDate: endDate ?? 'hoje',
      avgAdvanceDays,
      shortNotice,
      longAdvance,
    });

    const client = new Anthropic({ apiKey: anthropicApiKey });

    const anthropicStream = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      stream: true,
      messages: [{ role: 'user', content: prompt }],
    });

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of anthropicStream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              controller.enqueue(new TextEncoder().encode(event.delta.text));
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
        'X-Accel-Buffering': 'no',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(`Erro ao gerar análise: ${message}`, { status: 500 });
  }
}
