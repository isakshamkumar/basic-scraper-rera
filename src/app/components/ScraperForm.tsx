'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function ScraperForm() {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('markdown');
  const [scrapeMethod, setScrapeMethod] = useState('puppeteer');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) {
      setError('Please enter a URL');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, paginationOptions: { maxPages: 10, autoPaginate: true } }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Scraping failed');
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Website Scraper</h1>

      <form onSubmit={handleSubmit} className="mb-8">
        <div className="flex flex-col gap-4">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter website URL (e.g., https://example.com)"
            className="flex-1 p-3 border rounded-md dark:bg-gray-800 dark:border-gray-700"
            required
          />
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex items-center">
              <label className="mr-4">Scraping Method:</label>
              <select
                value={scrapeMethod}
                onChange={(e) => setScrapeMethod(e.target.value)}
                className="p-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
              >
                <option value="puppeteer">Advanced Scraper</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Scraping...' : 'Scrape Website'}
            </button>
          </div>
        </div>
      </form>

      {error && (
        <div className="p-4 mb-6 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-800 rounded-md text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {result && (
        <div className="border rounded-md dark:border-gray-700">
          <div className="flex border-b dark:border-gray-700">
            <button
              onClick={() => setActiveTab('markdown')}
              className={`px-4 py-2 ${activeTab === 'markdown' ? 'bg-gray-100 dark:bg-gray-800 font-medium' : ''}`}
            >
              Markdown
            </button>
            <button
              onClick={() => setActiveTab('metadata')}
              className={`px-4 py-2 ${activeTab === 'metadata' ? 'bg-gray-100 dark:bg-gray-800 font-medium' : ''}`}
            >
              Metadata
            </button>
            <button
              onClick={() => setActiveTab('html')}
              className={`px-4 py-2 ${activeTab === 'html' ? 'bg-gray-100 dark:bg-gray-800 font-medium' : ''}`}
            >
              HTML
            </button>
            {result.tableData?.length > 0 && (
              <button
                onClick={() => setActiveTab('tableData')}
                className={`px-4 py-2 ${activeTab === 'tableData' ? 'bg-gray-100 dark:bg-gray-800 font-medium' : ''}`}
              >
                Table Data
              </button>
            )}
          </div>

          <div className="p-4 overflow-auto max-h-[70vh]">
            {activeTab === 'markdown' && (
              <div className="prose dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.markdown}</ReactMarkdown>
              </div>
            )}
            {activeTab === 'metadata' && (
              <pre className="bg-gray-50 dark:bg-gray-900 p-4 rounded whitespace-pre-wrap font-mono text-sm">
                {JSON.stringify(result.metadata, null, 2)}
              </pre>
            )}
            {activeTab === 'html' && (
              <iframe
                srcDoc={result.html}
                title="HTML Preview"
                className="w-full border-0 min-h-[500px]"
                sandbox="allow-same-origin"
              />
            )}
            {activeTab === 'tableData' && result.tableData?.length > 0 && (
              <div>
                <h3>Table Data</h3>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      {Object.keys(result.tableData[0]).map((header) => (
                        <th
                          key={header}
                          className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {result.tableData.map((row: any, i: number) => (
                      <tr key={i}>
                        {Object.values(row).map((cell: any, j: number) => (
                          <td key={j} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {String(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {result.paginationInfo && (
                  <div className="mt-4 text-sm text-gray-500">
                    Scraped {result.paginationInfo.pagesScraped} of {result.paginationInfo.totalPages} total pages
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}