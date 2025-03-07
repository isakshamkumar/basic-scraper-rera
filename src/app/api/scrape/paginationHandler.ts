import { Page } from 'puppeteer';

export class PaginationHandler {
  async detectPagination(page: Page): Promise<boolean> {
    return page.evaluate(() => {
      const selectors = [
        '.pagination',
        '.pager',
        '.paginate',
        '.dataTables_paginate',
        'nav[aria-label*="pagination"]',
        'ul.page-numbers',
        '.wp-pagenavi',
        '[data-testid="pagination"]',
      ];
      if (selectors.some((selector) => document.querySelector(selector))) return true;

      const links = document.querySelectorAll('a');
      for (const link of links) {
        const href = link.getAttribute('href') || '';
        const text = link.textContent!.trim().toLowerCase();
        if (
          href.match(/[?&]page=\d+/) ||
          href.match(/\/page\/\d+/) ||
          text === 'next' ||
          text === 'previous' ||
          text.includes('page')
        )
          return true;
      }
      return false;
    });
  }

  async getTotalPages(page: Page): Promise<number> {
    return page.evaluate(() => {
      // DataTables (RERA-specific)
      const infoText = document.querySelector('.dataTables_info')?.textContent;
      if (infoText) {
        const match = infoText.match(/Showing \d+ to \d+ of ([\d,]+) entries/i);
        if (match) return Math.ceil(parseInt(match[1].replace(/,/g, '')) / 10);
      }

      // General pagination
      const pageLinks = document.querySelectorAll('.pagination a, .pager a, nav a');
      let maxPage = 1;
      pageLinks.forEach((link) => {
        const num = parseInt(link.textContent!.trim());
        if (!isNaN(num) && num > maxPage) maxPage = num;
      });
      return maxPage;
    });
  }

  async navigateToNext(page: Page): Promise<boolean> {
    const isDataTables = await page.evaluate(() => !!document.querySelector('.dataTables_paginate'));
    if (isDataTables) {
      console.log('Navigating DataTables pagination');
      const nextButton = await page.$('.paginate_button.next:not(.disabled)');
      if (nextButton) {
        await nextButton.click();
        await page.waitForFunction(
          () =>
            !document.querySelector('.dataTables_processing') ||
            window.getComputedStyle(document.querySelector('.dataTables_processing')!).display === 'none',
          { timeout: 10000 }
        ).catch(() => console.log('Processing wait timeout, continuing'));
        return true;
      }
      return false;
    }
  
    console.log('Navigating general pagination');
    // Replace $x with a more compatible approach using evaluate
    const nextButtonExists = await page.evaluate(() => {
      // Look for next buttons using various selectors
      const nextSelectors = [
        'a:not([disabled])', 
        'button:not([disabled])', 
        '[role="button"]:not([disabled])',
        '[aria-label*="next"]:not([disabled])'
      ];
      
      for (const selector of nextSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          const text = el.textContent?.toLowerCase().trim() || '';
          if (text === 'next' || text === '>' || text === 'next page' || text === '»' || text.includes('next')) {
            // Click the button
            (el as HTMLElement).click();
            return true;
          }
        }
      }
      return false;
    });
    
    if (nextButtonExists) {
      // Wait for navigation to complete
      try {
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {
          console.log('Navigation timeout, continuing anyway');
        });
      } catch (error) {
        console.log('Navigation error, but continuing:', error);
      }
      return true;
    }
    
    return false;
  }
}