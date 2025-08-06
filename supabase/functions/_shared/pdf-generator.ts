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
      USD: '$',
      EUR: '€',
      GBP: '£',
      INR: '₹',
      CAD: 'C$',
      AUD: 'A$',
      PKR: '₨'
    };
    return symbols[currency] || currency;
  };

  const currency = invoiceData.currency || 'USD';
  const currencySymbol = getCurrencySymbol(currency);

  // Create basic PDF content as HTML for simple conversion
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
        .invoice-header { background: linear-gradient(135deg, #2563eb, #9333ea, #a855f7); color: white; padding: 30px; margin-bottom: 30px; position: relative; }
        .invoice-header h1 { text-align: right; font-size: 32px; margin: 0; letter-spacing: 2px; }
        .invoice-details { display: flex; justify-content: space-between; margin-bottom: 30px; }
        .detail-section { flex: 1; margin-right: 20px; }
        .detail-section:last-child { margin-right: 0; text-align: right; }
        .detail-section h3 { color: #666; font-size: 12px; margin-bottom: 10px; text-transform: uppercase; }
        .student-name { font-size: 20px; font-weight: bold; margin-bottom: 5px; }
        .total-due { font-size: 24px; font-weight: bold; }
        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        .items-table th { background: linear-gradient(135deg, #2563eb, #9333ea, #a855f7); color: white; padding: 15px; text-align: left; }
        .items-table td { padding: 15px; border-bottom: 1px solid #eee; }
        .items-table tr:nth-child(even) { background-color: #f9f9f9; }
        .payment-methods { margin-bottom: 30px; }
        .payment-method { border-left: 2px solid #ccc; padding-left: 15px; margin-bottom: 15px; }
        .totals { text-align: right; margin-bottom: 30px; }
        .totals .total-row { display: flex; justify-content: space-between; margin-bottom: 10px; }
        .totals .final-total { background: linear-gradient(135deg, #2563eb, #9333ea); color: white; padding: 15px; border-radius: 5px; font-weight: bold; }
        .footer { text-align: center; color: #666; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px; margin-top: 40px; }
      </style>
    </head>
    <body>
      <div class="invoice-header">
        <h1>INVOICE</h1>
      </div>
      
      <div class="invoice-details">
        <div class="detail-section">
          <h3>Invoice To:</h3>
          <div class="student-name">${invoiceData.student_name}</div>
          ${invoiceData.student_email ? `<div style="color: #666; font-size: 14px;">${invoiceData.student_email}</div>` : ''}
        </div>
        
        <div class="detail-section">
          <div style="margin-bottom: 10px;"><strong>Date:</strong> ${invoiceData.date}</div>
          <div style="margin-bottom: 10px;"><strong>Due Date:</strong> ${invoiceData.due_date}</div>
          <div><strong>Invoice No:</strong> ${invoiceData.invoice_number}</div>
        </div>
        
        <div class="detail-section">
          <h3>Total Due:</h3>
          <div class="total-due">${currencySymbol}${invoiceData.total.toLocaleString()}</div>
          ${invoiceData.total_program_cost ? `<div style="color: #666; font-size: 14px;">of ${currencySymbol}${invoiceData.total_program_cost.toLocaleString()}</div>` : ''}
        </div>
      </div>
      
      <table class="items-table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Installment Number</th>
            <th>Price</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${invoiceData.items.map(item => `
            <tr>
              <td>${item.description}</td>
              <td>${invoiceData.total_installments ? `${item.installment_number}/${invoiceData.total_installments}` : item.installment_number}</td>
              <td>${currencySymbol}${item.price}</td>
              <td><strong>${currencySymbol}${item.total}</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div style="display: flex; justify-content: space-between;">
        <div class="payment-methods" style="flex: 1; margin-right: 40px;">
          <h3>Payment Methods</h3>
          ${invoiceData.payment_methods && invoiceData.payment_methods.filter(method => method.enabled).length > 0 ? 
            invoiceData.payment_methods.filter(method => method.enabled).map(method => `
              <div class="payment-method">
                <div style="font-weight: bold; margin-bottom: 5px;">${method.name}</div>
                ${Object.entries(method.details).map(([key, value]) => `
                  <div style="font-size: 14px; color: #666; margin-bottom: 3px;">
                    <strong>${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:</strong> ${value}
                  </div>
                `).join('')}
              </div>
            `).join('') : 
            '<div style="font-style: italic; color: #666;">No payment methods configured</div>'
          }
        </div>
        
        <div class="totals" style="flex: 1;">
          <div class="total-row">
            <span>Sub-total:</span>
            <span>${currencySymbol}${invoiceData.subtotal.toLocaleString()}</span>
          </div>
          <div class="total-row">
            <span>Tax:</span>
            <span>${currencySymbol}${invoiceData.tax}</span>
          </div>
          <div class="final-total">
            <div style="display: flex; justify-content: space-between;">
              <span>Total:</span>
              <span>${currencySymbol}${invoiceData.total.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
      
      <div style="display: flex; justify-content: space-between; margin-top: 40px;">
        <div style="flex: 1;">
          <h3>Notes</h3>
          <p style="font-style: italic; color: #666; line-height: 1.5;">
            ${invoiceData.terms || 'Please send payment within 30 days of receiving this invoice. There will be 10% interest charge per month on late invoice.'}
          </p>
        </div>
        
        <div style="text-align: right;">
          <div style="font-size: 18px; font-weight: bold; margin-bottom: 5px;">${companyDetails.company_name}</div>
          <div style="color: #666; font-size: 14px;">Administrator</div>
        </div>
      </div>
      
      <div class="footer">
        <div>${companyDetails.company_name}</div>
        <div>${companyDetails.address}</div>
        <div>${companyDetails.contact_email} | ${companyDetails.primary_phone}</div>
      </div>
    </body>
    </html>
  `;

  // Convert HTML to PDF (simplified approach - in a real implementation you'd use a proper PDF library)
  // For now, we'll create a simple text-based PDF representation
  const pdfContent = convertHtmlToPdf(htmlContent);
  return new TextEncoder().encode(pdfContent);
}

function convertHtmlToPdf(html: string): string {
  // This is a simplified PDF generation - in production you'd use a proper PDF library
  // For demonstration, we'll create a basic PDF structure
  const pdfHeader = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
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
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 <<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
>>
>>
>>
endobj

4 0 obj
<<
/Length 200
>>
stream
BT
/F1 12 Tf
50 750 Td
(Invoice Document - Generated from HTML) Tj
0 -20 Td
(This is a simplified PDF representation) Tj
0 -20 Td
(In production, use a proper PDF library) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000120 00000 n 
0000000350 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
600
%%EOF`;

  return pdfHeader;
}