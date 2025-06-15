import puppeteer from 'puppeteer'
import path from 'path'
import os from 'os'
import fs from 'fs'

// Format currency for display
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP'
  }).format(amount);
};

// Format date for display
const formatDate = (date) => {
  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(new Date(date));
};

// Generate receipt HTML template
const generateReceiptHTML = (bill, payments) => {
  const totalPaid = payments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
  const electricReading = bill.electric_present_reading && bill.electric_previous_reading 
    ? `${bill.electric_previous_reading} → ${bill.electric_present_reading}` 
    : 'N/A';
  
  const electricConsumption = bill.electric_consumption || 0;
  const rentAndFees = parseFloat(bill.rent_amount) + parseFloat(bill.extra_fee_amount || 0);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        @page { 
          size: A4; 
          margin: 20mm; 
        }
        body { 
          font-family: 'Arial', sans-serif; 
          margin: 0; 
          padding: 0; 
          color: #333;
          font-size: 12px;
          line-height: 1.4;
        }
        .receipt-container { 
          max-width: 100%; 
          margin: 0 auto; 
          background: white; 
        }
        .header { 
          text-align: center; 
          margin-bottom: 30px; 
          border-bottom: 3px solid #2c5aa0;
          padding-bottom: 20px;
        }
        .header h1 { 
          margin: 0; 
          font-size: 24px; 
          color: #2c5aa0;
          font-weight: bold;
        }
        .header p { 
          margin: 5px 0; 
          color: #666; 
        }
        .receipt-title {
          background: #2c5aa0;
          color: white;
          text-align: center;
          padding: 15px;
          margin: 20px 0;
          font-size: 18px;
          font-weight: bold;
        }
        .info-section { 
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 30px;
          margin-bottom: 25px; 
        }
        .info-box {
          border: 1px solid #ddd;
          padding: 15px;
          border-radius: 5px;
        }
        .info-box h3 { 
          margin: 0 0 10px 0; 
          color: #2c5aa0; 
          font-size: 14px;
        }
        .info-row { 
          display: flex; 
          justify-content: space-between; 
          margin-bottom: 8px; 
        }
        .info-label { 
          font-weight: bold; 
          color: #666; 
        }
        .info-value { 
          color: #333; 
        }
        .charges-table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }
        .charges-table th,
        .charges-table td {
          border: 1px solid #ddd;
          padding: 12px;
          text-align: left;
        }
        .charges-table th {
          background: #f8f9fa;
          font-weight: bold;
          color: #2c5aa0;
        }
        .charges-table .amount {
          text-align: right;
          font-weight: bold;
        }
        .payment-section {
          margin: 25px 0;
        }
        .payment-table {
          width: 100%;
          border-collapse: collapse;
          margin: 15px 0;
        }
        .payment-table th,
        .payment-table td {
          border: 1px solid #ddd;
          padding: 10px;
          text-align: left;
        }
        .payment-table th {
          background: #e8f4f8;
          font-weight: bold;
        }
        .payment-table .amount {
          text-align: right;
        }
        .total-section { 
          background: #2c5aa0; 
          color: white; 
          padding: 20px; 
          border-radius: 5px; 
          text-align: center;
          margin: 25px 0;
        }
        .total-amount { 
          font-size: 24px; 
          font-weight: bold; 
          margin: 10px 0; 
        }
        .paid-stamp {
          background: #28a745;
          color: white;
          padding: 10px 20px;
          border-radius: 5px;
          font-weight: bold;
          font-size: 16px;
          display: inline-block;
          margin: 10px 0;
        }
        .footer { 
          margin-top: 30px;
          text-align: center; 
          color: #666; 
          border-top: 1px solid #eee; 
          padding-top: 15px;
          font-size: 11px;
        }
        .signature-section {
          margin-top: 40px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 50px;
        }
        .signature-box {
          text-align: center;
          border-top: 1px solid #333;
          padding-top: 10px;
          margin-top: 40px;
        }
      </style>
    </head>
    <body>
      <div class="receipt-container">
        <!-- Header -->
        <div class="header">
          <h1>${bill.branch_name || 'J&H APARTMENT'}</h1>
          <p>${bill.branch_address || 'P3, Patin-ay, Prosperidad, Agusan Del Sur'}</p>
          <p>Contact: +63 XXX XXX XXXX | Email: official.jhapartment@gmail.com</p>
        </div>

        <div class="receipt-title">
          OFFICIAL PAYMENT RECEIPT
        </div>

        <!-- Receipt Information -->
        <div class="info-section">
          <div class="info-box">
            <h3>Bill Information</h3>
            <div class="info-row">
              <span class="info-label">Receipt No:</span>
              <span class="info-value">RCP-${bill.id}-${Date.now()}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Bill No:</span>
              <span class="info-value">BILL-${bill.id}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Bill Date:</span>
              <span class="info-value">${formatDate(bill.bill_date)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Billing Period:</span>
              <span class="info-value">${formatDate(bill.rent_from)} - ${formatDate(bill.rent_to)}</span>
            </div>
          </div>

          <div class="info-box">
            <h3>Tenant Information</h3>
            <div class="info-row">
              <span class="info-label">Name:</span>
              <span class="info-value">${bill.tenant_name}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Room:</span>
              <span class="info-value">${bill.room_number}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Payment Date:</span>
              <span class="info-value">${formatDate(payments[payments.length - 1].actual_payment_date || payments[payments.length - 1].payment_date)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Status:</span>
              <span class="info-value paid-stamp">FULLY PAID</span>
            </div>
          </div>
        </div>

        <!-- Charges Breakdown -->
        <h3 style="color: #2c5aa0; margin-bottom: 10px;">Charges Breakdown</h3>
        <table class="charges-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Details</th>
              <th class="amount">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Monthly Rent</strong></td>
              <td>Period: ${formatDate(bill.rent_from)} - ${formatDate(bill.rent_to)}</td>
              <td class="amount">${formatCurrency(bill.rent_amount)}</td>
            </tr>
            <tr>
              <td><strong>Electricity</strong></td>
              <td>Reading: ${electricReading} (${electricConsumption} kWh) @ ₱${bill.electric_rate_per_kwh}/kWh</td>
              <td class="amount">${formatCurrency(bill.electric_amount || 0)}</td>
            </tr>
            <tr>
              <td><strong>Water</strong></td>
              <td>Fixed monthly charge</td>
              <td class="amount">${formatCurrency(bill.water_amount)}</td>
            </tr>
            ${bill.extra_fee_amount > 0 ? `
            <tr>
              <td><strong>Extra Fees</strong></td>
              <td>${bill.extra_fee_description || 'Additional charges'}</td>
              <td class="amount">${formatCurrency(bill.extra_fee_amount)}</td>
            </tr>
            ` : ''}
            <tr style="background: #f8f9fa; font-weight: bold;">
              <td colspan="2"><strong>TOTAL AMOUNT</strong></td>
              <td class="amount">${formatCurrency(bill.total_amount)}</td>
            </tr>
          </tbody>
        </table>

        <!-- Payment Details -->
        <div class="payment-section">
          <h3 style="color: #2c5aa0; margin-bottom: 10px;">Payment Details</h3>
          <table class="payment-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Method</th>
                <th>Notes</th>
                <th class="amount">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${payments.map(payment => `
                <tr>
                  <td>${formatDate(payment.actual_payment_date || payment.payment_date)}</td>
                  <td>${payment.payment_method.toUpperCase()}</td>
                  <td>${payment.notes || '-'}</td>
                  <td class="amount">${formatCurrency(payment.amount)}</td>
                </tr>
              `).join('')}
              <tr style="background: #e8f4f8; font-weight: bold;">
                <td colspan="3"><strong>TOTAL PAID</strong></td>
                <td class="amount">${formatCurrency(totalPaid)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Total Section -->
        <div class="total-section">
          <div>PAYMENT CONFIRMED</div>
          <div class="total-amount">${formatCurrency(totalPaid)}</div>
          <div>Thank you for your payment!</div>
        </div>

        <!-- Signature Section -->
        <div class="signature-section">
          <div>
            <div class="signature-box">
              <strong>Tenant Signature</strong>
            </div>
          </div>
          <div>
            <div class="signature-box">
              <strong>Management Signature</strong>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="footer">
          <p><strong>This is an official receipt generated by J&H Apartment Management System</strong></p>
          <p>Generated on: ${formatDate(new Date())} | Receipt is valid and serves as proof of payment</p>
          <p>For inquiries, please contact the management office</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Generate PDF receipt
const generateReceiptPDF = async (bill, payments) => {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    const html = generateReceiptHTML(bill, payments);
    
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm'
      }
    });
    
    return pdfBuffer;
  } catch (error) {
    console.error('PDF generation error:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

// Save receipt to file system
const saveReceiptToFile = async (bill, payments) => {
  try {
    const pdfBuffer = await generateReceiptPDF(bill, payments);
    
    // Create receipts directory if it doesn't exist
    const receiptsDir = path.join(__dirname, '../public/receipts');
    try {
      await fs.promises.access(receiptsDir);
    } catch {
      await fs.promises.mkdir(receiptsDir, { recursive: true });
    }
    
    // Generate filename
    const filename = `receipt-${bill.id}-${Date.now()}.pdf`;
    const filepath = path.join(receiptsDir, filename);
    
    // Save PDF to file
    await fs.promises.writeFile(filepath, pdfBuffer);
    
    return {
      success: true,
      filename,
      filepath,
      downloadUrl: `/receipts/${filename}`
    };
  } catch (error) {
    console.error('Save receipt error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export default {
  generateReceiptPDF,
  saveReceiptToFile
}; 