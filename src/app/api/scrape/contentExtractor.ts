import { Page } from 'puppeteer';
import TurndownService from 'turndown';

const turndownService = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
});

export class ContentExtractor {
  async extract(page: Page): Promise<{ html: string; markdown: string; tableData: any[] }> {
    // Wait for dynamic content to load (3 seconds)
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Remove non-content elements
    await page.evaluate(() => {
      const elements = document.querySelectorAll('script, style, header, footer, nav, aside');
      elements.forEach(el => el.remove());
    });

    // Extract cleaned HTML and convert to Markdown
    const html = await page.content();
    const markdown = turndownService.turndown(html);
    const tableData = await this.extractTableData(page);

    console.log('Content extracted:', { htmlLength: html.length, tableDataLength: tableData.length });
    return { html, markdown, tableData };
  }

  private async extractTableData(page: Page): Promise<any[]> {
    return page.evaluate(() => {
      // RERA Karnataka DataTables special case
      if (document.querySelector('#unregprojList_wrapper')) {
        console.log('Detected DataTables table');
        const table = document.querySelector('#unregprojList');
        if (!table) return [];

        const headers = Array.from(table.querySelectorAll('thead th')).map((cell) => cell.textContent!.trim());
        const rows = table.querySelectorAll('tbody tr');
        const data: { [key: string]: string }[] = [];

        for (const row of rows) {
          const rowData: { [key: string]: string } = {};
          const cells = row.querySelectorAll('td');
          cells.forEach((cell, i) => {
            rowData[headers[i] || `column${i + 1}`] = cell.textContent!.trim();
          });
          data.push(rowData);
        }
        return data;
      }

      // General table extraction
      const tables = document.querySelectorAll('table');
      if (tables.length === 0) return [];

      let mainTable = tables[0];
      let maxRows = 0;
      tables.forEach((table) => {
        const rowCount = table.querySelectorAll('tr').length;
        if (rowCount > maxRows) {
          maxRows = rowCount;
          mainTable = table;
        }
      });

      const rows = mainTable.querySelectorAll('tr');
      const data: { [key: string]: string }[] = [];
      const headers = Array.from(rows[0]?.querySelectorAll('th') || []).map((cell) => cell.textContent!.trim()) || [];

      const startRow = headers.length ? 1 : 0;
      for (let i = startRow; i < rows.length; i++) {
        const rowData: { [key: string]: string } = {};
        const cells = rows[i].querySelectorAll('td');
        cells.forEach((cell, j) => {
          rowData[headers[j] || `column${j + 1}`] = cell.textContent!.trim();
        });
        data.push(rowData);
      }
      return data;
    });
  }
}