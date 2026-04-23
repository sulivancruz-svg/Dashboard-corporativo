import { NextRequest, NextResponse } from 'next/server';
import { getGoogleSheetsData, parseSalesData, calculateMetrics, filterSalesByDateRange } from '@/lib/google-sheets';

// Skip validation during build
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_CORPORATE_ID;
    const sheetGid = process.env.GOOGLE_SHEETS_CORPORATE_GID;
    const apiKey = process.env.GOOGLE_SHEETS_CORPORATE_API_KEY;

    if (!spreadsheetId || !sheetGid || !apiKey) {
      return NextResponse.json(
        { error: 'Google Sheets configuration missing' },
        { status: 400 }
      );
    }

    // Fetch data from Google Sheets
    const { headers, data } = await getGoogleSheetsData(spreadsheetId, sheetGid, apiKey);

    if (data.length === 0) {
      return NextResponse.json(
        { error: 'No data found in Google Sheets' },
        { status: 400 }
      );
    }

    // Parse sales data
    const sales = filterSalesByDateRange(
      parseSalesData(data, headers),
      req.nextUrl.searchParams.get('startDate'),
      req.nextUrl.searchParams.get('endDate')
    );

    if (sales.length === 0) {
      return NextResponse.json(
        { error: 'No valid sales records found' },
        { status: 400 }
      );
    }

    const metrics = calculateMetrics(sales);

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Overview API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch overview data', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
