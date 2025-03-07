import { Page } from "puppeteer";
import { PaginationHandler } from "./paginationHandler";
import { ContentExtractor } from "./contentExtractor";

export class Scraper {
    constructor(
      private page: Page,
      private contentExtractor: ContentExtractor,
      private paginationHandler: PaginationHandler
    ) {}
  
    async scrape(url: string, paginationOptions: { maxPages: number; autoPaginate: boolean }) {
      // Handle CAPTCHA detection and workaround
      if (await this.detectCaptcha()) {
        console.log('Possible CAPTCHA detected, attempting workaround...');
        await this.page.setUserAgent(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        );
        await this.page.reload({ waitUntil: 'networkidle2', timeout: 90000 });
        await new Promise((resolve) => setTimeout(resolve, 12000));
      }
  
      const hasPagination = paginationOptions.autoPaginate && (await this.paginationHandler.detectPagination(this.page));
      console.log('Pagination detected:', hasPagination);
  
      let allData: any[] = [];
      let combinedHtml = '';
      let combinedMarkdown = '';
      let pagesScraped = 0;
  
      if (hasPagination) {
        for await (const pageData of this.paginate(paginationOptions.maxPages)) {
          allData.push(...pageData.tableData);
          combinedHtml += pageData.html;
          combinedMarkdown += `\n\n--- Page ${pagesScraped + 1} ---\n\n${pageData.markdown}`;
          pagesScraped++;
        }
      } else {
        const pageData = await this.contentExtractor.extract(this.page);
        allData = pageData.tableData;
        combinedHtml = pageData.html;
        combinedMarkdown = pageData.markdown;
        pagesScraped = 1;
      }
  
      const metadata = await this.getMetadata();
      const totalPages = hasPagination ? await this.paginationHandler.getTotalPages(this.page) : 1;
  
      return {
        success: true,
        url,
        html: combinedHtml,
        markdown: combinedMarkdown,
        tableData: allData,
        metadata,
        paginationInfo: { detected: hasPagination, totalPages, pagesScraped },
      };
    }
  
    private async *paginate(maxPages: number) {
      let pagesScraped = 0;
      while (pagesScraped < maxPages) {
        console.log(`Extracting content for page ${pagesScraped + 1}`);
        yield await this.contentExtractor.extract(this.page);
        pagesScraped++;
  
        const nextPageAvailable = await this.paginationHandler.navigateToNext(this.page);
        if (!nextPageAvailable) break;
        await new Promise((resolve) => setTimeout(resolve, 3000)); // Wait for content to load
      }
    }
  
    private async detectCaptcha(): Promise<boolean> {
      return this.page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();
        const html = document.body.innerHTML.toLowerCase();
        return (
          text.includes('captcha') ||
          html.includes('captcha') ||
          text.includes('robot') ||
          text.includes('human verification') ||
          text.includes('security check')
        );
      });
    }
  
    private async getMetadata() {
      return this.page.evaluate(() => {
        const meta: { [key: string]: string } = { title: document.title };
        document.querySelectorAll('meta').forEach((tag) => {
          const name = tag.getAttribute('name') || tag.getAttribute('property');
          const content = tag.getAttribute('content');
          if (name && content) meta[name] = content;
        });
        return meta;
      });
    }
  }