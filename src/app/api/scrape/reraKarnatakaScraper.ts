import { Page } from 'puppeteer';
import { ContentExtractor } from './contentExtractor';
import { PaginationHandler } from './paginationHandler';

export class ReraKarnatakaScraper {
  constructor(
    private page: Page,
    private contentExtractor: ContentExtractor,
    private paginationHandler: PaginationHandler
  ) {}

  async scrape(maxPages: number = 10): Promise<{
    success: boolean;
    tableData: any[];
    paginationInfo: { detected: boolean; totalPages: number; pagesScraped: number };
  }> {
    try {
      // Navigate to the form page
      console.log('Navigating to RERA Karnataka form page...');
      await this.page.goto('https://rera.karnataka.gov.in/viewAllProjects', {
        waitUntil: 'networkidle2',
        timeout: 90000,
      });

      // Take a screenshot for debugging
      await this.page.screenshot({ path: '/tmp/rera-initial-page.png' });
      console.log('Initial page screenshot saved to /tmp/rera-initial-page.png');

      // Check for CAPTCHA or anti-bot mechanisms
      const pageContent = await this.page.content();
      if (pageContent.toLowerCase().includes('captcha') || 
          pageContent.toLowerCase().includes('robot') ||
          pageContent.toLowerCase().includes('verification')) {
        console.log('Possible CAPTCHA detected, attempting workaround...');
        
        // Try with a different user agent
        await this.page.setUserAgent(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        );
        
        // Reload the page
        await this.page.reload({ waitUntil: 'networkidle2', timeout: 90000 });
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Take another screenshot
        await this.page.screenshot({ path: '/tmp/rera-after-reload.png' });
        console.log('After reload screenshot saved to /tmp/rera-after-reload.png');
      }

      // Check if the form is present
      console.log('Checking for form elements...');
      const formExists = await this.page.evaluate(() => {
        return !!document.querySelector('form') && 
               !!document.querySelector('#projectDist');
      });
      
      if (!formExists) {
        console.log('Form not found, trying alternative approach...');
        
        // Try direct navigation to the results page
        await this.page.goto('https://rera.karnataka.gov.in/projectViewDetails', {
          waitUntil: 'networkidle2',
          timeout: 90000,
        });
        
        // Take a screenshot
        await this.page.screenshot({ path: '/tmp/rera-direct-navigation.png' });
        console.log('Direct navigation screenshot saved to /tmp/rera-direct-navigation.png');
        
        // Check if we're on the results page
        const hasTable = await this.page.evaluate(() => {
          return !!document.querySelector('table');
        });
        
        if (hasTable) {
          console.log('Successfully navigated directly to results page');
          // Continue with scraping
        } else {
          throw new Error('Unable to access the project details page');
        }
      } else {
        // Wait for the form to load with a more generous timeout
        console.log('Waiting for district dropdown to be selectable...');
        try {
          await this.page.waitForSelector('#projectDist', { 
            timeout: 30000,
            visible: true 
          });
        } catch (error) {
          console.log('Timeout waiting for district dropdown, continuing anyway');
        }
        
        // Get all available districts
        const districts = await this.page.evaluate(() => {
          const options = Array.from(document.querySelectorAll('#projectDist option'));
          return options
            .map(option => ({
              value: option.getAttribute('value'),
              text: option.textContent?.trim()
            }))
            .filter(option => option.value !== '0'); // Filter out the "Select District" option
        });
        
        console.log(`Found ${districts.length} districts to scrape`);
        
        if (districts.length === 0) {
          console.log('No districts found, taking screenshot for debugging');
          await this.page.screenshot({ path: '/tmp/rera-no-districts.png' });
          throw new Error('No districts found in dropdown');
        }
        
        // We'll use Bengaluru Urban as default since it likely has the most projects
        const selectedDistrict = 'Bengaluru Urban';
        console.log(`Selecting district: ${selectedDistrict}`);
        
        // Try different methods to select the district
        try {
          // Method 1: Using page.select
          await this.page.select('#projectDist', selectedDistrict);
        } catch (error) {
          console.log('Error using page.select, trying alternative method');
          
          // Method 2: Using JavaScript directly
          await this.page.evaluate((district) => {
            const select = document.querySelector('#projectDist');
            if (select) {
              const options = Array.from(select.querySelectorAll('option'));
              const option = options.find(opt => opt.textContent?.trim() === district);
              if (option) {
                const value = option.getAttribute('value');
                (select as HTMLSelectElement).value = value || '';
                
                // Trigger change event
                const event = new Event('change', { bubbles: true });
                select.dispatchEvent(event);
              }
            }
          }, selectedDistrict);
        }
        
        // Wait a bit for any dependent dropdowns to update
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Take a screenshot before submitting
        await this.page.screenshot({ path: '/tmp/rera-before-submit.png' });
        console.log('Before submit screenshot saved to /tmp/rera-before-submit.png');
        
        // Submit the form
        console.log('Submitting search form...');
        try {
          // Method 1: Using Promise.all with click
          await Promise.all([
            this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }),
            this.page.click('input[name="btn1"][type="submit"]')
          ]);
        } catch (error) {
          console.log('Error submitting form with click, trying alternative method');
          
          // Method 2: Using JavaScript to submit the form
          await this.page.evaluate(() => {
            const form = document.querySelector('form');
            if (form) form.submit();
          });
          
          // Wait for navigation
          await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 })
            .catch(() => console.log('Navigation timeout, continuing anyway'));
        }
      }
      
      // Take a screenshot after form submission
      await this.page.screenshot({ path: '/tmp/rera-after-submit.png' });
      console.log('After submit screenshot saved to /tmp/rera-after-submit.png');
      
      // Verify we're on the results page
      const currentUrl = this.page.url();
      console.log(`Navigated to: ${currentUrl}`);
      
      // Wait for the table to load
      console.log('Waiting for results table to load...');
      await this.page.waitForSelector('table', { timeout: 30000 })
        .catch(() => console.log('Table selector not found, continuing anyway'));
      
      // Additional wait for dynamic content
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Now scrape the data using our existing pagination and content extraction logic
      console.log('Starting to scrape table data...');
      
      const hasPagination = await this.paginationHandler.detectPagination(this.page);
      console.log('Pagination detected:', hasPagination);
      
      let allData: any[] = [];
      let pagesScraped = 0;
      
      if (hasPagination) {
        let currentPage = 1;
        let hasMorePages = true;
        
        while (hasMorePages && currentPage <= maxPages) {
          console.log(`Scraping page ${currentPage}/${maxPages}...`);
          
          // Extract data from current page
          const pageData = await this.contentExtractor.extract(this.page);
          allData.push(...pageData.tableData);
          pagesScraped++;
          
          // Move to next page if available
          if (currentPage < maxPages) {
            hasMorePages = await this.paginationHandler.navigateToNext(this.page);
            if (hasMorePages) {
              // Wait for content to load after navigation
              await new Promise(resolve => setTimeout(resolve, 5000));
              currentPage++;
            } else {
              console.log('No more pages available');
              break;
            }
          } else {
            break;
          }
        }
      } else {
        // No pagination, just extract the current page
        const pageData = await this.contentExtractor.extract(this.page);
        allData = pageData.tableData;
        pagesScraped = 1;
      }
      
      const totalPages = hasPagination ? await this.paginationHandler.getTotalPages(this.page) : 1;
      
      return {
        success: true,
        tableData: allData,
        paginationInfo: { detected: hasPagination, totalPages, pagesScraped }
      };
    } catch (error) {
      console.error('Error in RERA Karnataka scraper:', error);
      return {
        success: false,
        tableData: [],
        paginationInfo: { detected: false, totalPages: 0, pagesScraped: 0 }
      };
    }
  }
}