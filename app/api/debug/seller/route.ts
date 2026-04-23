import { NextRequest, NextResponse } from 'next/server';
import { filterSalesByDateRange, getGoogleSheetsData, parseSalesData } from '@/lib/google-sheets';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const spreadsheetId = process.env.GOOGLE_SHEETS_CORPORATE_ID;
  const sheetGid = process.env.GOOGLE_SHEETS_CORPORATE_GID;
  const apiKey = process.env.GOOGLE_SHEETS_CORPORATE_API_KEY;

  if (!spreadsheetId || !sheetGid || !apiKey) {
    return NextResponse.json({ error: 'Google Sheets configuration missing' }, { status: 400 });
  }

  const sellerFilter = (req.nextUrl.searchParams.get('seller') || '').toLowerCase().trim();
  const startDate = req.nextUrl.searchParams.get('startDate');
  const endDate = req.nextUrl.searchParams.get('endDate');

  if (!sellerFilter) {
    return NextResponse.json({ error: 'Informe o parâmetro ?seller=nome' }, { status: 400 });
  }

  const { headers, data } = await getGoogleSheetsData(spreadsheetId, sheetGid, apiKey);
  const allSales = filterSalesByDateRange(parseSalesData(data, headers), startDate, endDate);

  const sellerSales = allSales.filter((s) =>
    s.seller.toLowerCase().includes(sellerFilter)
  );

  // Check for duplicate saleNumbers
  const saleNumberCount: Record<string, number> = {};
  for (const s of sellerSales) {
    if (s.saleNumber) {
      saleNumberCount[s.saleNumber] = (saleNumberCount[s.saleNumber] || 0) + 1;
    }
  }
  const duplicates = Object.entries(saleNumberCount)
    .filter(([, count]) => count > 1)
    .map(([num, count]) => ({ saleNumber: num, count }));

  // Unique seller name variations found
  const nameVariations = [...new Set(sellerSales.map((s) => s.seller))];

  const totalValue = sellerSales.reduce((sum, s) => sum + s.value, 0);
  const totalRevenue = sellerSales.reduce((sum, s) => sum + s.revenue, 0);

  return NextResponse.json({
    sellerFilter,
    nameVariations,
    totalRows: sellerSales.length,
    totalValue: Number(totalValue.toFixed(2)),
    totalRevenue: Number(totalRevenue.toFixed(2)),
    duplicateSaleNumbers: duplicates,
    sales: sellerSales.map((s, i) => ({
      row: i + 1,
      saleNumber: s.saleNumber,
      date: s.date,
      seller: s.seller,
      client: s.client,
      product: s.product,
      status: s.status,
      value: s.value,
      revenue: s.revenue,
    })),
  });
}
