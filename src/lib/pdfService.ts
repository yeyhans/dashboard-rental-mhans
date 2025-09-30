import puppeteer from 'puppeteer';

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
      // Vercel configuration - use chrome-aws-lambda if available
      console.log('🌐 Using Vercel/serverless configuration');
      browser = await puppeteer.launch({
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ],
        headless: true
      });
    } else {
      // Local development configuration
      console.log('💻 Using local development configuration');
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }

    const page = await browser.newPage();
    
    // Set viewport for consistent rendering
    await page.setViewport({ width: 1200, height: 800 });
    
    // Set content and wait for network to be idle
    await page.setContent(htmlContent, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
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
      browser = await puppeteer.launch({
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ],
        headless: true
      });
    } else {
      browser = await puppeteer.launch({
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
    
    // Navigate to URL
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
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
