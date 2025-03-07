import { NextRequest, NextResponse } from 'next/server';
import puppeteer, { Browser, Page } from 'puppeteer';
import { ContentExtractor } from './contentExtractor';
import { PaginationHandler } from './paginationHandler';
import { Scraper } from './ScraperRepositery';
import { ReraKarnatakaScraper } from './reraKarnatakaScraper';

export async function POST(request: NextRequest) {
  const { url, paginationOptions = { maxPages: 10, autoPaginate: true } } = await request.json();
  console.log('Received request for URL:', url);

  if (!url) {
    return NextResponse.json({ success: false, error: 'URL is required' }, { status: 400 });
  }

  let browser: Browser | null = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    await setupPage(page);

    // Check if this is a RERA Karnataka URL
    const isReraKarnataka = url.includes('rera.karnataka.gov.in');
    
    if (isReraKarnataka) {
      console.log('Detected RERA Karnataka website, using specialized scraper');
      const reraScraper = new ReraKarnatakaScraper(
        page, 
        new ContentExtractor(), 
        new PaginationHandler()
      );
      
      const result = await reraScraper.scrape(paginationOptions.maxPages);
      
      // Add additional metadata for the response
      return NextResponse.json({
        ...result,
        url,
        html: '', // We don't need the full HTML for this specialized case
        markdown: '', // We don't need markdown for this specialized case
        metadata: { title: 'RERA Karnataka Projects', source: 'Specialized Scraper' }
      });
    } else {
      // For all other websites, use the general scraper
      console.log('Navigating to URL:', url);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });

      const scraper = new Scraper(page, new ContentExtractor(), new PaginationHandler());
      const result = await scraper.scrape(url, paginationOptions);

      return NextResponse.json(result);
    }
  } catch (error) {
    console.error('Scraping error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  } finally {
    if (browser) await browser.close();
  }
}

async function setupPage(page: Page) {
  await page.setViewport({ width: 1280, height: 800 });
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  );
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
  });
}

