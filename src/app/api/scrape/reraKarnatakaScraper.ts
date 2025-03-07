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
    detailedProjectData: any[]; 
    paginationInfo: { detected: boolean; totalPages: number; pagesScraped: number };
  }> {
    try {
      console.log('Navigating to RERA Karnataka form page...');
      await this.page.goto('https://rera.karnataka.gov.in/viewAllProjects', {
        waitUntil: 'networkidle2',
        timeout: 90000,
      });

      await this.page.screenshot({ path: '/tmp/rera-initial-page.png' });
      console.log('Initial page screenshot saved to /tmp/rera-initial-page.png');

      const pageContent = await this.page.content();
      if (pageContent.toLowerCase().includes('captcha') || 
          pageContent.toLowerCase().includes('robot') ||
          pageContent.toLowerCase().includes('verification')) {
        console.log('Possible CAPTCHA detected, attempting workaround...');
        
        await this.page.setUserAgent(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        );
        
        await this.page.reload({ waitUntil: 'networkidle2', timeout: 90000 });
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        await this.page.screenshot({ path: '/tmp/rera-after-reload.png' });
        console.log('After reload screenshot saved to /tmp/rera-after-reload.png');
      }

      console.log('Checking for form elements...');
      const formExists = await this.page.evaluate(() => {
        return !!document.querySelector('form') && 
               !!document.querySelector('#projectDist');
      });
      
      if (!formExists) {
        console.log('Form not found, trying alternative approach...');
        
        await this.page.goto('https://rera.karnataka.gov.in/projectViewDetails', {
          waitUntil: 'networkidle2',
          timeout: 90000,
        });
        
        await this.page.screenshot({ path: '/tmp/rera-direct-navigation.png' });
        console.log('Direct navigation screenshot saved to /tmp/rera-direct-navigation.png');
        
        const hasTable = await this.page.evaluate(() => {
          return !!document.querySelector('table');
        });
        
        if (hasTable) {
          console.log('Successfully navigated directly to results page');
        } else {
          throw new Error('Unable to access the project details page');
        }
      } else {
        console.log('Waiting for district dropdown to be selectable...');
        try {
          await this.page.waitForSelector('#projectDist', { 
            timeout: 30000,
            visible: true 
          });
        } catch (error) {
          console.log('Timeout waiting for district dropdown, continuing anyway');
        }
        
        const districts = await this.page.evaluate(() => {
          const options = Array.from(document.querySelectorAll('#projectDist option'));
          return options
            .map(option => ({
              value: option.getAttribute('value'),
              text: option.textContent?.trim()
            }))
            .filter(option => option.value !== '0');
        });
        
        console.log(`Found ${districts.length} districts to scrape`);
        
        if (districts.length === 0) {
          console.log('No districts found, taking screenshot for debugging');
          await this.page.screenshot({ path: '/tmp/rera-no-districts.png' });
          throw new Error('No districts found in dropdown');
        }
        
        const selectedDistrict = 'Bengaluru Urban';
        console.log(`Selecting district: ${selectedDistrict}`);
        
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
                
                const event = new Event('change', { bubbles: true });
                select.dispatchEvent(event);
              }
            }
          }, selectedDistrict);
        }
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        await this.page.screenshot({ path: '/tmp/rera-before-submit.png' });
        console.log('Before submit screenshot saved to /tmp/rera-before-submit.png');
        
        console.log('Submitting search form...');
        try {
          // Method 1: Using Promise.all with click
          await Promise.all([
            this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }),
            this.page.click('input[name="btn1"][type="submit"]')
          ]);
        } catch (error) {
          console.log('Error submitting form with click, trying alternative method');
          
          await this.page.evaluate(() => {
            const form = document.querySelector('form');
            if (form) form.submit();
          });
          
          await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 })
            .catch(() => console.log('Navigation timeout, continuing anyway'));
        }
      }
      
      await this.page.screenshot({ path: '/tmp/rera-after-submit.png' });
      console.log('After submit screenshot saved to /tmp/rera-after-submit.png');
      
      const currentUrl = this.page.url();
      console.log(`Navigated to: ${currentUrl}`);
      
      console.log('Waiting for results table to load...');
      await this.page.waitForSelector('table', { timeout: 30000 })
        .catch(() => console.log('Table selector not found, continuing anyway'));
      
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      console.log('Starting to scrape table data...');
      
      const hasPagination = await this.paginationHandler.detectPagination(this.page);
      console.log('Pagination detected:', hasPagination);
      
      let allData: any[] = [];
      let allDetailedData: any[] = []; 
      let pagesScraped = 0;
      
      if (hasPagination) {
        let currentPage = 1;
        let hasMorePages = true;
        
        while (hasMorePages && currentPage <= maxPages) {
          console.log(`Scraping page ${currentPage}/${maxPages}...`);
          
          const pageData = await this.contentExtractor.extract(this.page);
          allData.push(...pageData.tableData);
          
          const detailedData = await this.extractDetailedProjectData();
          allDetailedData.push(...detailedData);
          
          pagesScraped++;
          
          if (currentPage < maxPages) {
            hasMorePages = await this.paginationHandler.navigateToNext(this.page);
            if (hasMorePages) {
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
        const pageData = await this.contentExtractor.extract(this.page);
        allData = pageData.tableData;
        
        const detailedData = await this.extractDetailedProjectData();
        allDetailedData = detailedData;
        
        pagesScraped = 1;
      }
      
      const totalPages = hasPagination ? await this.paginationHandler.getTotalPages(this.page) : 1;
      
      return {
        success: true,
        tableData: allData,
        detailedProjectData: allDetailedData,
        paginationInfo: { detected: hasPagination, totalPages, pagesScraped }
      };
    } catch (error) {
      console.error('Error in RERA Karnataka scraper:', error);
      return {
        success: false,
        tableData: [],
        detailedProjectData: [],
        paginationInfo: { detected: false, totalPages: 0, pagesScraped: 0 }
      };
    }
  }

  private async extractDetailedProjectData(): Promise<any[]> {
    console.log('Extracting detailed project data from table rows...');
    try {
      const viewButtonSelectors = await this.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('a.btn[onclick*="showFileApplicationPreview"]'));
        return buttons.map(button => {
          const id = button.getAttribute('id');
          return { id };
        });
      });
      
      const maxDetailsToExtract = 10;
      const buttonsToProcess = viewButtonSelectors.slice(0, maxDetailsToExtract);
      
      console.log(`Found ${viewButtonSelectors.length} detail buttons, will process ${buttonsToProcess.length}`);
      
      const detailedData: any[] = [];
      
      for (let i = 0; i < buttonsToProcess.length; i++) {
        const button = buttonsToProcess[i];
        console.log(`Processing detail button ${i + 1}/${buttonsToProcess.length} (ID: ${button.id})`);
        
        try {
          await this.page.evaluate((id) => {
            const button = document.querySelector(`a.btn[id="${id}"]`);
            if (button) {
              (button as HTMLElement).click();
            } else {
              console.log(`Button with ID ${id} not found`);
            }
          }, button.id);
          
          await this.page.waitForSelector('.inner_wrapper', { visible: true, timeout: 30000 })
            .catch(() => {
              console.log('Modal not found or not visible within timeout');
              return null;
            });
          
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          const modalData = await this.page.evaluate(() => {
            const projectData: any = {};
            
            const projectName = document.querySelector('.user_name b')?.textContent?.trim();
            if (projectName) {
              projectData.projectName = projectName;
            }
            
            const regNumberElement = Array.from(document.querySelectorAll('.user_name'))
              .find(el => el.textContent?.includes('Registration Number'));
            if (regNumberElement) {
              projectData.registrationNumber = regNumberElement.querySelector('b')?.textContent?.trim();
            }

            const ackNumberElement = Array.from(document.querySelectorAll('.user_name'))
              .find(el => el.textContent?.includes('Acknowledgement Number'));
            if (ackNumberElement) {
              projectData.acknowledgementNumber = ackNumberElement.querySelector('b')?.textContent?.trim();
            }
            
            const tabLinks = Array.from(document.querySelectorAll('.nav-tabs li a'));
            const tabNames = tabLinks.map(tab => tab.textContent?.trim() || '');
            
            projectData.tabs = {};
            
            tabLinks.forEach((tabLink, tabIndex) => {
              const tabName = tabLink.textContent?.trim() || `Tab ${tabIndex + 1}`;
              
              projectData.tabs[tabName] = {};
              
              (tabLink as HTMLElement).click();
              
              setTimeout(() => {}, 500);
              
              const tabId = tabLink.getAttribute('href')?.substring(1);  // Remove # prefix
              const tabContent = document.getElementById(tabId || '');
              
              if (!tabContent) {
                console.log(`Tab content not found for ${tabName}`);
                return;
              }
              
              const sections = Array.from(tabContent.querySelectorAll('.inner_wrapper'));
              
              sections.forEach((section, sectionIndex) => {
                const sectionHeading = section.querySelector('h1');
                const sectionTitle = sectionHeading?.textContent?.trim() || `Section ${sectionIndex + 1}`;
                
                let cleanSectionTitle = sectionTitle;
                ['Details', 'Detail', ' Work', ' Document', ' Documents'].forEach(suffix => {
                  if (cleanSectionTitle.endsWith(suffix)) {
                    cleanSectionTitle = cleanSectionTitle.substring(0, cleanSectionTitle.length - suffix.length).trim();
                  }
                });
                
                projectData.tabs[tabName][cleanSectionTitle] = {};
                const sectionData = projectData.tabs[tabName][cleanSectionTitle];
                
                const rows = Array.from(section.querySelectorAll('.row'));
                rows.forEach(row => {
                  const labelElements = Array.from(row.querySelectorAll('.text-right'));
                  const valueElements = Array.from(row.querySelectorAll('.col-md-3:not(.col-md-3:has(.text-right)), .col-md-9'));
                  
                  labelElements.forEach((labelElement, index) => {
                    const label = labelElement.textContent?.replace(':', '')?.trim();
                    const valueElement = valueElements[index];
                    if (!label || !valueElement) return;
                    
                    let value = valueElement.textContent?.trim() || '';
                    
                    // Check if there's a link
                    const link = valueElement.querySelector('a');
                    if (link) {
                      const linkText = link.textContent?.trim();
                      const linkHref = link.getAttribute('href');
                      if (linkText) {
                        value = linkText;
                        if (linkHref) {
                          sectionData[`${label} URL`] = linkHref;
                        }
                      }
                    }
                    
                    if (value) {
                      sectionData[label] = value;
                    }
                  });
                });
                
                const tables = Array.from(section.querySelectorAll('table'));
                
                if (tables.length > 0) {
                  sectionData.tables = [];
                  
                  tables.forEach(table => {
                    const tableData = [];
                    const headers = Array.from(table.querySelectorAll('thead th, thead td'))
                      .map(th => th.textContent?.trim() || '');
                    
                    const rows = Array.from(table.querySelectorAll('tbody tr'));
                    
                    rows.forEach(row => {
                      const cells = Array.from(row.querySelectorAll('td'));
                      const rowData = {};
                      
                      cells.forEach((cell, cellIndex) => {
                        const header = headers[cellIndex] || `Column ${cellIndex + 1}`;
                        rowData[header] = cell.textContent?.trim() || '';
                      });
                      
                      tableData.push(rowData);
                    });
                    
                    sectionData.tables.push(tableData);
                  });
                }
              });
            });
            
            return projectData;
          });
          
          if (modalData) {
            modalData.rowId = button.id;
            
            const summary = {
              id: button.id,
              name: modalData.projectName || 'Unknown Project',
              registrationNumber: modalData.registrationNumber || 'N/A',
              acknowledgementNumber: modalData.acknowledgementNumber || 'N/A',
              details: modalData.tabs || {}
            };
            
            detailedData.push(summary);
          }
          
          await this.page.evaluate(() => {
            const closeButton = document.querySelector('.modal-header .close, .close');
            if (closeButton) {
              (closeButton as HTMLElement).click();
            } else {
              const modalBackdrop = document.querySelector('.modal-backdrop');
              if (modalBackdrop) {
                (modalBackdrop as HTMLElement).click();
              }
            }
          });
          
          await this.page.waitForFunction(
            () => {
              const modal = document.querySelector('.modal-dialog');
              return !modal || getComputedStyle(modal).display === 'none';
            },
            { timeout: 10000 }
          ).catch(err => {
            console.log('Modal did not close within timeout, trying fallback method', err);
            
            return this.page.keyboard.press('Escape');
          });
          
          await new Promise(resolve => setTimeout(resolve, 3000));
        } catch (error) {
          console.error(`Error extracting details for button ${button.id}:`, error);
        }
      }
      
      return detailedData;
    } catch (error) {
      console.error('Error in extractDetailedProjectData:', error);
      return [];
    }
  }
}