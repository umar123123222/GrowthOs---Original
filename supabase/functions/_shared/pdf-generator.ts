// PDF generation utility for invoices
export interface InvoiceItem {
  description: string;
  installment_number: number;
  price: number;
  total: number;
}

export interface InvoiceData {
  invoice_number: string;
  date: string;
  due_date: string;
  student_name: string;
  student_email?: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  total_program_cost?: number;
  total_installments?: number;
  currency?: string;
  payment_methods?: PaymentMethod[];
  terms?: string;
}

export interface PaymentMethod {
  type: 'bank_transfer' | 'cod' | 'stripe' | 'custom';
  name: string;
  enabled: boolean;
  details: {
    [key: string]: string;
  };
}

export interface CompanyDetails {
  company_name: string;
  address: string;
  contact_email: string;
  primary_phone: string;
  company_logo?: string;
}

export function generateInvoicePDF(invoiceData: InvoiceData, companyDetails: CompanyDetails): Uint8Array {
  // Get currency symbol
  const getCurrencySymbol = (currency: string = 'USD') => {
    const symbols: { [key: string]: string } = {
      USD: '$', EUR: '€', GBP: '£', INR: '₹', CAD: 'C$', AUD: 'A$', PKR: '₨'
    };
    return symbols[currency] || currency;
  };

  const currency = invoiceData.currency || 'USD';
  const currencySymbol = getCurrencySymbol(currency);

  // Create professional PDF content using proper PDF structure
  const pdfContent = createProfessionalPDF(invoiceData, companyDetails, currencySymbol);
  return new TextEncoder().encode(pdfContent);
}

function createProfessionalPDF(invoiceData: InvoiceData, companyDetails: CompanyDetails, currencySymbol: string): string {
  // Enhanced PDF with proper structure matching the reference design
  const pdfData = `%PDF-1.7
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
/PageLayout /OneColumn
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 595 842]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
/F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>
/F3 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>
>>
/ColorSpace <<
/CS1 [/DeviceRGB]
>>
>>
>>
endobj

4 0 obj
<<
/Length ${calculateContentLength(invoiceData, companyDetails, currencySymbol)}
>>
stream
BT

% Header Section with Gradient Background (Blue to Purple)
0.15 0.39 0.92 rg
50 750 495 70 re f

% Logo circles (simplified representation)
0.8 0.8 1 rg
70 780 15 15 re f
90 780 15 15 re f
110 780 15 15 re f

% INVOICE Title
/F2 32 Tf
1 1 1 rg
420 785 Td
(INVOICE) Tj

% Reset to black text
0 0 0 rg

% Invoice Details Section
/F2 12 Tf
50 700 Td
(INVOICE TO:) Tj

/F2 18 Tf
50 680 Td
(${invoiceData.student_name}) Tj

/F1 10 Tf
50 665 Td
(${invoiceData.student_email || ''}) Tj

% Date and Invoice Details
/F1 11 Tf
280 700 Td
(Date: ${invoiceData.date}) Tj
280 685 Td
(Due Date: ${invoiceData.due_date}) Tj
280 670 Td
(Invoice No: ${invoiceData.invoice_number}) Tj

% Total Due Section
/F2 12 Tf
450 700 Td
(TOTAL DUE:) Tj

/F2 20 Tf
450 680 Td
(${currencySymbol}${invoiceData.total.toLocaleString()}) Tj

% Table Header with Background
0.15 0.39 0.92 rg
50 630 495 25 re f

% Table Headers
/F2 11 Tf
1 1 1 rg
60 640 Td
(Description) Tj
200 640 Td
(Installment Number) Tj
340 640 Td
(Price) Tj
450 640 Td
(Total) Tj

% Table Content
0 0 0 rg
0.9 0.9 0.9 rg
50 605 495 25 re f

/F1 10 Tf
0 0 0 rg
60 615 Td
(${invoiceData.items[0]?.description || 'Course Fee - Installment'}) Tj
200 615 Td
(${invoiceData.items[0]?.installment_number || '1'}/${invoiceData.total_installments || '1'}) Tj
340 615 Td
(${currencySymbol}${invoiceData.items[0]?.price || invoiceData.total}) Tj
450 615 Td
(${currencySymbol}${invoiceData.items[0]?.total || invoiceData.total}) Tj

% Payment Methods Section
/F2 14 Tf
50 560 Td
(Payment Methods) Tj

${generatePaymentMethodsText(invoiceData.payment_methods || [], currencySymbol)}

% Totals Section
/F1 11 Tf
350 420 Td
(Sub-total:) Tj
450 420 Td
(${currencySymbol}${invoiceData.subtotal.toLocaleString()}) Tj

350 405 Td
(Tax:) Tj
450 405 Td
(${currencySymbol}${invoiceData.tax}) Tj

% Final Total with Background
0.15 0.39 0.92 rg
350 380 195 25 re f

/F2 12 Tf
1 1 1 rg
360 390 Td
(Total:) Tj
450 390 Td
(${currencySymbol}${invoiceData.total.toLocaleString()}) Tj

% Notes Section
0 0 0 rg
/F2 14 Tf
50 340 Td
(Notes) Tj

/F3 10 Tf
50 320 Td
(${invoiceData.terms || 'Please send payment within 30 days of receiving this invoice.'}) Tj

% Company Signature
/F2 16 Tf
350 200 Td
(${companyDetails.company_name}) Tj

/F1 10 Tf
350 185 Td
(Administrator) Tj

% Footer
/F1 8 Tf
150 80 Td
(${companyDetails.company_name}) Tj
150 70 Td
(${companyDetails.address}) Tj
150 60 Td
(${companyDetails.contact_email} | ${companyDetails.primary_phone}) Tj

ET
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000010 00000 n 
0000000080 00000 n 
0000000130 00000 n 
0000000450 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
${2000 + calculateContentLength(invoiceData, companyDetails, currencySymbol)}
%%EOF`;

  return pdfData;
}

function generatePaymentMethodsText(paymentMethods: PaymentMethod[], currencySymbol: string): string {
  if (!paymentMethods || paymentMethods.filter(pm => pm.enabled).length === 0) {
    return `/F3 10 Tf
50 540 Td
(No payment methods configured) Tj`;
  }

  let text = '';
  let yPos = 540;
  
  paymentMethods.filter(pm => pm.enabled).forEach((method, index) => {
    text += `/F2 11 Tf
50 ${yPos} Td
(${method.name}) Tj
`;
    yPos -= 15;
    
    Object.entries(method.details).forEach(([key, value]) => {
      const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      text += `/F1 9 Tf
50 ${yPos} Td
(${formattedKey}: ${value}) Tj
`;
      yPos -= 12;
    });
    yPos -= 5; // Extra space between payment methods
  });
  
  return text;
}

function calculateContentLength(invoiceData: InvoiceData, companyDetails: CompanyDetails, currencySymbol: string): number {
  // Estimate content length for PDF structure
  const baseLength = 2000;
  const variableContent = JSON.stringify({
    student: invoiceData.student_name,
    company: companyDetails.company_name,
    items: invoiceData.items,
    methods: invoiceData.payment_methods
  }).length;
  
  return baseLength + variableContent;
}