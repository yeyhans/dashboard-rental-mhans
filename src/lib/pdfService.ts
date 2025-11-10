import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

export interface PdfGenerationOptions {
  htmlContent: string;
  format?: 'A4' | 'Letter';
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  printBackground?: boolean;
}

export async function generatePdfFromHtml(options: PdfGenerationOptions): Promise<Buffer> {
  const {
    htmlContent,
    format = 'A4',
    margin = { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' },
    printBackground = true
  } = options;

  console.log('🚀 Starting PDF generation with Puppeteer...');
  
  // Configure Puppeteer for different environments
  const isVercel = process.env.VERCEL === '1';
  
  let browser;
  
  try {
    if (isVercel) {
      // Vercel configuration - use @sparticuz/chromium with optimized args for faster startup
      console.log('🌐 Using Vercel/serverless configuration with @sparticuz/chromium');
      browser = await puppeteer.launch({
        args: [
          ...chromium.args,
          '--disable-blink-features=AutomationControlled', // Prevents email anonymization
          '--disable-web-security',
          '--allow-running-insecure-content', // Allow loading external images
        ],
        executablePath: await chromium.executablePath(),
        headless: true,
      });
    } else {
      // Local development configuration - use system Chrome
      console.log('💻 Using local development configuration');
      const puppeteerFull = await import('puppeteer');
      browser = await puppeteerFull.default.launch({
        headless: true,
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled', // Prevents email anonymization
          '--disable-features=VizDisplayCompositor',
          '--disable-web-security',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection',
          '--allow-running-insecure-content', // Allow loading external images
          '--disable-site-isolation-trials'
        ]
      });
    }

    const page = await browser.newPage();
    
    // Set viewport for consistent rendering
    await page.setViewport({ width: 1200, height: 800 });
    
    // Set content with optimized wait strategy for Vercel free tier (8s timeout)
    // Using 'load' instead of 'networkidle2' for faster completion
    await page.setContent(htmlContent, { 
      waitUntil: 'load', // Faster - waits only for page load, not all network requests
      timeout: 8000 // Reduced to 8s to stay within Vercel's 10s limit
    });
    
    console.log('📄 Generating PDF...');
    
    // Generate PDF
    const pdfBuffer = await page.pdf({
      format,
      margin,
      printBackground,
      preferCSSPageSize: false,
      displayHeaderFooter: false
    });
    
    console.log('✅ PDF generated successfully, size:', pdfBuffer.byteLength);
    
    return Buffer.from(pdfBuffer);
    
  } catch (error) {
    console.error('❌ Error generating PDF:', error);
    throw new Error(`PDF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    if (browser) {
      await browser.close();
      console.log('🔒 Browser closed');
    }
  }
}

export async function generatePdfFromUrl(url: string, headers?: Record<string, string>): Promise<Buffer> {
  console.log('🚀 Starting PDF generation from URL:', url);
  
  const isVercel = process.env.VERCEL === '1';
  let browser;
  
  try {
    if (isVercel) {
      // Vercel configuration - use @sparticuz/chromium with optimized args
      console.log('🌐 Using Vercel/serverless configuration with @sparticuz/chromium');
      browser = await puppeteer.launch({
        args: [
          ...chromium.args,
          '--disable-blink-features=AutomationControlled',
          '--disable-web-security',
          '--allow-running-insecure-content',
        ],
        executablePath: await chromium.executablePath(),
        headless: true,
      });
    } else {
      // Local development configuration - use system Chrome
      console.log('💻 Using local development configuration');
      const puppeteerFull = await import('puppeteer');
      browser = await puppeteerFull.default.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }

    const page = await browser.newPage();
    
    // Set headers if provided
    if (headers) {
      await page.setExtraHTTPHeaders(headers);
    }
    
    // Set viewport
    await page.setViewport({ width: 1200, height: 800 });
    
    // Navigate to URL with optimized wait strategy for Vercel free tier
    await page.goto(url, { 
      waitUntil: 'load', // Faster - waits only for page load
      timeout: 8000 // Reduced to 8s to stay within Vercel's 10s limit
    });
    
    console.log('📄 Generating PDF from URL...');
    
    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' },
      printBackground: true,
      preferCSSPageSize: false,
      displayHeaderFooter: false
    });
    
    console.log('✅ PDF generated successfully, size:', pdfBuffer.byteLength);
    
    return Buffer.from(pdfBuffer);
    
  } catch (error) {
    console.error('❌ Error generating PDF from URL:', error);
    throw new Error(`PDF generation from URL failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    if (browser) {
      await browser.close();
      console.log('🔒 Browser closed');
    }
  }
}
