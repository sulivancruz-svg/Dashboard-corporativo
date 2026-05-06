import Anthropic from '@anthropic-ai/sdk';
import { NextRequest } from 'next/server';
import {
  calculateMetrics,
  filterSalesByDateRange,
  filterSalesByStatus,
  getGoogleSheetsData,
  parseSalesData,
} from '@/lib/google-sheets';
import { buildInitialInsightsPrompt, buildInsightsContext } from '@/lib/insights-prompt';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export async function GET(req: NextRequest) {
  return streamInsights(req, {
    message: buildInitialInsightsPrompt(),
    history: [],
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    startDate?: string;
    endDate?: string;
    message?: string;
    history?: ChatMessage[];
  };

  return streamInsights(req, {
    startDateOverride: body.startDate,
    endDateOverride: body.endDate,
    message: body.message || buildInitialInsightsPrompt(),
    history: Array.isArray(body.history) ? body.history : [],
  });
}

async function streamInsights(
  req: NextRequest,
  options: {
    message: string;
    history: ChatMessage[];
    startDateOverride?: string;
    endDateOverride?: string;
  }
) {
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

    const startDate = options.startDateOverride ?? req.nextUrl.searchParams.get('startDate');
    const endDate = options.endDateOverride ?? req.nextUrl.searchParams.get('endDate');

    const { headers, data } = await getGoogleSheetsData(spreadsheetId, sheetGid, sheetsApiKey);
    const sales = filterSalesByDateRange(parseSalesData(data, headers), startDate, endDate);

    if (sales.length === 0) {
      return new Response('Nenhuma venda encontrada no periodo selecionado', { status: 400 });
    }

    const closedSales = filterSalesByStatus(sales, 'fechada');
    const openSalesList = filterSalesByStatus(sales, 'aberta');
    const confirmedSales = closedSales.length > 0 ? closedSales : sales;
    const openSalesData = {
      revenue: openSalesList.reduce((sum, sale) => sum + sale.value, 0),
      count: openSalesList.length,
    };

    const metrics = calculateMetrics(confirmedSales, openSalesData);
    const avgAdvanceDays = Number(
      (confirmedSales.reduce((sum, sale) => sum + sale.advanceDays, 0) / confirmedSales.length).toFixed(1)
    );
    const shortNotice = confirmedSales.filter((sale) => sale.advanceDays >= 0 && sale.advanceDays <= 7).length;
    const longAdvance = confirmedSales.filter((sale) => sale.advanceDays > 30).length;

    const systemPrompt = buildInsightsContext({
      ...metrics,
      startDate: startDate ?? 'inicio dos registros',
      endDate: endDate ?? 'hoje',
      avgAdvanceDays,
      shortNotice,
      longAdvance,
    });

    const client = new Anthropic({ apiKey: anthropicApiKey });
    const anthropicStream = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      stream: true,
      messages: toAnthropicMessages(options.history, options.message),
    });

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of anthropicStream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              controller.enqueue(new TextEncoder().encode(event.delta.text));
            }
          }
          controller.close();
        } catch (error) {
          controller.error(error);
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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(`Erro ao gerar analise: ${message}`, { status: 500 });
  }
}

function toAnthropicMessages(history: ChatMessage[], message: string) {
  const sanitizedHistory = history
    .filter((item) => item && (item.role === 'user' || item.role === 'assistant') && item.content?.trim())
    .slice(-10)
    .map((item) => ({
      role: item.role,
      content: item.content,
    }));

  return [
    ...sanitizedHistory,
    {
      role: 'user' as const,
      content: message,
    },
  ];
}
