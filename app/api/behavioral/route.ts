import { NextRequest, NextResponse } from 'next/server';
import { filterSalesByDateRange, filterSalesByStatus, getGoogleSheetsData, parseSalesData } from '@/lib/google-sheets';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_CORPORATE_ID;
    const sheetGid = process.env.GOOGLE_SHEETS_CORPORATE_GID;
    const apiKey = process.env.GOOGLE_SHEETS_CORPORATE_API_KEY;

    if (!spreadsheetId || !sheetGid || !apiKey) {
      return NextResponse.json({ error: 'Google Sheets configuration missing' }, { status: 400 });
    }

    const { headers, data } = await getGoogleSheetsData(spreadsheetId, sheetGid, apiKey);
    const allSales = filterSalesByDateRange(
      parseSalesData(data, headers),
      req.nextUrl.searchParams.get('startDate'),
      req.nextUrl.searchParams.get('endDate')
    );
    const closedSales = filterSalesByStatus(allSales, 'fechada');
    const sales = closedSales.length > 0 ? closedSales : allSales;

    const customerProfiles = sales.reduce<Record<string, number>>((acc, sale) => {
      acc[sale.client] = (acc[sale.client] || 0) + 1;
      return acc;
    }, {});

    const salesByDateMap = sales.reduce<Record<string, { sales: number; revenue: number }>>((acc, sale) => {
      const dateKey = sale.date.split('T')[0];
      if (!acc[dateKey]) {
        acc[dateKey] = { sales: 0, revenue: 0 };
      }
      acc[dateKey].sales++;
      acc[dateKey].revenue += sale.value;
      return acc;
    }, {});

    return NextResponse.json({
      totalSales: sales.length,
      avgAdvanceDays:
        sales.length > 0 ? Number((sales.reduce((sum, sale) => sum + sale.advanceDays, 0) / sales.length).toFixed(1)) : 0,
      bookingPatterns: [
        { name: '0-7 dias', sales: sales.filter((sale) => sale.advanceDays >= 0 && sale.advanceDays <= 7).length },
        { name: '8-14 dias', sales: sales.filter((sale) => sale.advanceDays >= 8 && sale.advanceDays <= 14).length },
        { name: '15-30 dias', sales: sales.filter((sale) => sale.advanceDays >= 15 && sale.advanceDays <= 30).length },
        { name: '30+ dias', sales: sales.filter((sale) => sale.advanceDays > 30).length },
      ],
      customerProfiles: [
        { name: 'Alta recorrência (10+)', clients: Object.values(customerProfiles).filter((count) => count >= 10).length },
        { name: 'Média (5-9)', clients: Object.values(customerProfiles).filter((count) => count >= 5 && count < 10).length },
        { name: 'Baixa (1-4)', clients: Object.values(customerProfiles).filter((count) => count < 5).length },
      ],
      salesByDate: Object.entries(salesByDateMap)
        .map(([date, value]) => ({
          date,
          sales: value.sales,
          revenue: Number(value.revenue.toFixed(2)),
        }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    });
  } catch (error) {
    console.error('Behavioral API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch behavioral data', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
