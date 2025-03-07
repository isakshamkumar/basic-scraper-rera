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
  const [selectedProject, setSelectedProject] = useState<any>(null);

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

  const isReraKarnataka = result?.metadata?.title === 'RERA Karnataka Projects';

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
                onClick={() => { setActiveTab('tableData'); setSelectedProject(null); }}
                className={`px-4 py-2 ${activeTab === 'tableData' ? 'bg-gray-100 dark:bg-gray-800 font-medium' : ''}`}
              >
                Table Data
              </button>
            )}
            {isReraKarnataka && result.detailedProjectData?.length > 0 && (
              <button
                onClick={() => setActiveTab('detailedProjectData')}
                className={`px-4 py-2 ${activeTab === 'detailedProjectData' ? 'bg-gray-100 dark:bg-gray-800 font-medium' : ''}`}
              >
                Project Details
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
            
            {activeTab === 'detailedProjectData' && result.detailedProjectData?.length > 0 && (
              <div>
                <h3 className="text-lg font-medium mb-4">Project Details ({result.detailedProjectData.length} projects)</h3>
                
                {!selectedProject ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {result.detailedProjectData.map((project: any, index: number) => (
                      <div 
                        key={index} 
                        className="border dark:border-gray-700 rounded-md p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                        onClick={() => {
                          // Add activeTab property to track which tab is active in the detail view
                          const tabNames = Object.keys(project.details || {});
                          setSelectedProject({
                            ...project,
                            activeTab: tabNames.length > 0 ? tabNames[0] : null
                          });
                        }}
                      >
                        <h4 className="font-medium mb-2">{project.name || `Project ${index + 1}`}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          Registration: {project.registrationNumber || 'N/A'}
                        </p>
                        <p className="text-sm text-gray-500">
                          Acknowledgement: {project.acknowledgementNumber || 'N/A'}
                        </p>
                        <p className="text-xs text-gray-400 mt-2">Click to view details</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div>
                    <button 
                      onClick={() => setSelectedProject(null)}
                      className="mb-4 px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                    >
                      ← Back to list
                    </button>
                    
                    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-md">
                      <h4 className="text-lg font-medium mb-3">
                        {selectedProject.name || 'Project Details'} 
                        <span className="text-sm font-normal text-gray-500 ml-2">
                          (ID: {selectedProject.id})
                        </span>
                      </h4>
                      
                      <div className="mb-4">
                        <p className="text-sm"><strong>Registration Number:</strong> {selectedProject.registrationNumber}</p>
                        <p className="text-sm"><strong>Acknowledgement Number:</strong> {selectedProject.acknowledgementNumber}</p>
                      </div>
                      
                      {selectedProject.details && (
                        <div>
                          <ul className="flex flex-wrap border-b mb-4">
                            {Object.keys(selectedProject.details).map((tabName, idx) => (
                              <li key={idx} className="mr-2">
                                <button 
                                  className={`px-3 py-2 ${
                                    selectedProject.activeTab === tabName 
                                      ? 'bg-blue-100 dark:bg-blue-900 font-medium' 
                                      : 'bg-gray-100 dark:bg-gray-700'
                                  } rounded-t-md`}
                                  onClick={() => {
                                    setSelectedProject({
                                      ...selectedProject,
                                      activeTab: tabName
                                    });
                                  }}
                                >
                                  {tabName}
                                </button>
                              </li>
                            ))}
                          </ul>
                          
                          {selectedProject.activeTab ? (
                            <div className="p-4 border rounded dark:border-gray-700">
                              {Object.entries(selectedProject.details[selectedProject.activeTab] || {}).map(([sectionKey, sectionValue]: [string, any], idx) => (
                                <div key={idx} className="mb-6">
                                  <h5 className="text-md font-medium mb-2 bg-gray-100 dark:bg-gray-700 p-2 rounded">
                                    {sectionKey}
                                  </h5>
                                  
                                  {typeof sectionValue === 'object' ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      {Object.entries(sectionValue).map(([fieldKey, fieldValue]: [string, any], fieldIdx) => {
                                        // Skip showing tables in the key-value display
                                        if (fieldKey === 'tables') return null;
                                        
                                        return (
                                          <div key={fieldIdx} className="border-b pb-2 dark:border-gray-700">
                                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">{fieldKey}</div>
                                            <div className="mt-1">
                                              {typeof fieldValue === 'string' ? fieldValue : JSON.stringify(fieldValue)}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <div className="text-sm">{String(sectionValue)}</div>
                                  )}
                                  
                                  {/* Show tables if any */}
                                  {sectionValue?.tables && sectionValue.tables.length > 0 && (
                                    <div className="mt-4">
                                      <h6 className="text-md font-medium mb-2">Tables</h6>
                                      {sectionValue.tables.map((table: any[], tableIdx: number) => (
                                        <div key={tableIdx} className="overflow-x-auto mb-4">
                                          <table className="min-w-full divide-y divide-gray-200 border dark:border-gray-700">
                                            <thead>
                                              {table.length > 0 && (
                                                <tr>
                                                  {Object.keys(table[0]).map((header, headerIdx) => (
                                                    <th key={headerIdx} className="px-3 py-2 bg-gray-50 dark:bg-gray-700 text-left text-xs font-medium uppercase">
                                                      {header}
                                                    </th>
                                                  ))}
                                                </tr>
                                              )}
                                            </thead>
                                            <tbody>
                                              {table.map((row, rowIdx) => (
                                                <tr key={rowIdx} className="bg-white dark:bg-gray-800">
                                                  {Object.values(row).map((cell: any, cellIdx) => (
                                                    <td key={cellIdx} className="px-3 py-2 text-sm">
                                                      {typeof cell === 'string' ? cell : JSON.stringify(cell)}
                                                    </td>
                                                  ))}
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center p-4 text-gray-500">
                              Select a tab to view project details
                            </div>
                          )}
                        </div>
                      )}
                    </div>
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