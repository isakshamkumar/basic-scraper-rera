
import FirecrawlApp, { CrawlParams, CrawlStatusResponse } from '@mendable/firecrawl-js';

export class ScraperService {
  private static instance: ScraperService;
  private app: FirecrawlApp;

  private constructor() {
    this.app = new FirecrawlApp({apiKey: "fc-620ce4a49cd6454b9ca11de18c824184"});
  }

  public static getInstance(): ScraperService {
    if (!ScraperService.instance) {
      ScraperService.instance = new ScraperService();
    }
    return ScraperService.instance;
  }

  public async scrapeUrl(url: string, formats: string[] = ['markdown', 'html']) {
    try {
        const scrapeResponse = await this.app.scrapeUrl(url, {
            formats,
            waitFor: 15000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.5',
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache',
            },
            timeout: 120000,
            actions: [
              { type: 'wait', milliseconds: 5000 },
              { type: 'scroll', position: 'bottom' },
              { type: 'wait', milliseconds: 3000 }
            ],
            skipTlsVerification: true,
            mobile: false,
            blockAds: true,
            removeBase64Images: true 
          });
          
      if (!scrapeResponse.success) {
        throw new Error(`Failed to scrape: ${scrapeResponse.error}`);
      }

      return scrapeResponse;
    } catch (error) {
      console.error('Error scraping URL:', error);
      throw error;
    }
  }

  public async crawlUrl(url: string, limit: number = 100, formats: string[] = ['markdown', 'html']) {
    try {
      const crawlResponse = await this.app.crawlUrl(url, {
        limit,
        maxDepth: 1,
        scrapeOptions: {
          formats,
          waitFor: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
          },
          timeout: 60000,
          actions: [
            { type: 'wait', selector: '.content-wrapper' },
            { type: 'scroll', position: 'bottom' }
          ],
          skipTlsVerification: true,
          mobile: false
        }
      });

      if (!crawlResponse.success) {
        throw new Error(`Failed to crawl: ${crawlResponse.error}`);
      }

      return crawlResponse;
    } catch (error) {
      console.error('Error crawling URL:', error);
      throw error;
    }
  }
  public async scrapeGovernmentSite(url: string, formats: string[] = ['markdown', 'html']) {
    try {
      const crawlResponse = await this.app.crawlUrl(url, {
        limit: 1, 
        maxDepth: 0, 
        ignoreQueryParameters: true,
        scrapeOptions: {
          formats,
          waitFor: 20000, 
          timeout: 180000, 
          skipTlsVerification: true,
          mobile: false,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
          }
        }
      });
      console.log('Crawl response: ', crawlResponse);

      if (crawlResponse.success) {
        return crawlResponse;
      }

      const scrapeResponse = await this.app.scrapeUrl(url, {
        formats,
        waitFor: 30000,
        timeout: 180000,
        skipTlsVerification: true,
        mobile: true, 
        blockAds: true,
        removeBase64Images: true
      });

      console.log('Scrape response: ', scrapeResponse);
      
      if (scrapeResponse.success) {
        return scrapeResponse;
      }
      
      console.log('Firecrawl methods failed, trying Puppeteer...');
      // return await this.scrapePuppeteer(url);
      
    } catch (error) {
      console.error('Error scraping government site:', error);
      
      try {
        // return await this.scrapePuppeteer(url);
      } catch (puppeteerError) {
        console.error('Puppeteer fallback also failed:', puppeteerError);
        throw error; 
      }
    }
  }
  

}

export default ScraperService.getInstance();