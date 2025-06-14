import PDFDocument from 'pdfkit'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Format currency for display
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP'
  }).format(amount);
};

// Format date for display
const formatDate = (date) => {
  if (!date) return 'N/A';
  
  try {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) return 'N/A';
    
    return new Intl.DateTimeFormat('en-PH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(dateObj);
  } catch (error) {
    return 'N/A';
  }
};

// Generate deposit receipt PDF
const generateDepositReceiptPDF = async (tenant, roomInfo) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const chunks = [];
      
      // Collect PDF data
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        resolve(pdfBuffer);
      });
      
      // Colors
      const primaryColor = '#2c5aa0';
      const secondaryColor = '#28a745';
      
      // Header
      doc.fontSize(24)
         .fillColor(primaryColor)
         .text('J&H APARTMENT', 50, 50, { align: 'center' });
      
      doc.fontSize(12)
         .fillColor('black')
         .text('Patin-ay, Prosperidad, Agusan Del Sur', 50, 80, { align: 'center' })
         .text('Contact: +63 XXX XXX XXXX | Email: official.jhapartment@gmail.com', 50, 95, { align: 'center' });
      
      // Title
      doc.rect(50, 120, 495, 40)
         .fillAndStroke(primaryColor, primaryColor);
      
      doc.fontSize(18)
         .fillColor('white')
         .text('DEPOSIT RECEIPT', 50, 135, { align: 'center' });
      
      // Receipt Info
      let yPos = 180;
      
      doc.fontSize(14)
         .fillColor(primaryColor)
         .text('Receipt Information', 50, yPos);
      
      yPos += 25;
      doc.fontSize(11)
         .fillColor('black')
         .text(`Receipt No: DEP-${tenant.id}-${Date.now()}`, 50, yPos)
         .text(`Date: ${formatDate(new Date())}`, 350, yPos);
      
      yPos += 20;
      doc.text(`Tenant: ${tenant.name}`, 50, yPos)
         .text(`Room: ${roomInfo.room_number}`, 350, yPos);
      
      yPos += 20;
      doc.text(`Contract: ${formatDate(tenant.contract_start_date)} to ${formatDate(tenant.contract_end_date)}`, 50, yPos);
      
      // Deposit Details
      yPos += 40;
      doc.fontSize(14)
         .fillColor(primaryColor)
         .text('Deposit Details', 50, yPos);
      
      yPos += 25;
      
      // Table header
      doc.rect(50, yPos, 495, 25)
         .fillAndStroke('#f8f9fa', '#ddd');
      
      doc.fontSize(11)
         .fillColor('black')
         .text('Description', 60, yPos + 8)
         .text('Amount', 450, yPos + 8);
      
      yPos += 25;
      
      // Advance Payment
      doc.rect(50, yPos, 495, 25)
         .fillAndStroke('white', '#ddd');
      
      doc.text('Advance Payment (1 Month)', 60, yPos + 8)
         .text(formatCurrency(tenant.advance_payment), 450, yPos + 8);
      
      yPos += 25;
      
      // Security Deposit
      doc.rect(50, yPos, 495, 25)
         .fillAndStroke('white', '#ddd');
      
      doc.text('Security Deposit', 60, yPos + 8)
         .text(formatCurrency(tenant.security_deposit), 450, yPos + 8);
      
      yPos += 25;
      
      // Total
      doc.rect(50, yPos, 495, 30)
         .fillAndStroke(secondaryColor, secondaryColor);
      
      doc.fontSize(12)
         .fillColor('white')
         .text('TOTAL PAID', 60, yPos + 10)
         .text(formatCurrency(parseFloat(tenant.advance_payment) + parseFloat(tenant.security_deposit)), 450, yPos + 10);
      
      // Payment Status
      yPos += 50;
      doc.rect(50, yPos, 495, 40)
         .fillAndStroke('#e8f5e8', '#28a745');
      
      doc.fontSize(16)
         .fillColor(secondaryColor)
         .text('✓ PAYMENT CONFIRMED', 50, yPos + 15, { align: 'center' });
      
      // Terms and Conditions
      yPos += 70;
      doc.fontSize(12)
         .fillColor(primaryColor)
         .text('Terms and Conditions:', 50, yPos);
      
      yPos += 20;
      doc.fontSize(10)
         .fillColor('black')
         .text('• This deposit receipt serves as official proof of advance payment and security deposit', 60, yPos)
         .text('• The advance payment will be applied to the first month\'s rent', 60, yPos + 15)
         .text('• Security deposit will be refunded upon contract completion, subject to damages assessment', 60, yPos + 30)
         .text('• Please keep this receipt for your records', 60, yPos + 45);
      
      // Signatures
      yPos += 90;
      doc.fontSize(11)
         .text('Tenant Signature', 80, yPos + 30, { align: 'center' })
         .text('Management Signature', 350, yPos + 30, { align: 'center' });
      
      // Signature lines
      doc.moveTo(80, yPos + 25)
         .lineTo(200, yPos + 25)
         .stroke();
      
      doc.moveTo(350, yPos + 25)
         .lineTo(470, yPos + 25)
         .stroke();
      
      // Footer
      yPos += 70;
      doc.fontSize(9)
         .fillColor('gray')
         .text('This is an official receipt generated by J&H Apartment Management System', 50, yPos, { align: 'center' })
         .text(`Generated on ${formatDate(new Date())} | Receipt is valid and serves as proof of payment`, 50, yPos + 12, { align: 'center' });
      
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

// Save deposit receipt to file system
const saveDepositReceiptToFile = async (tenant, roomInfo) => {
  try {
    const pdfBuffer = await generateDepositReceiptPDF(tenant, roomInfo);
    
    // Create receipts directory if it doesn't exist
    const receiptsDir = path.join(__dirname, '../public/receipts');
    try {
      await fs.promises.access(receiptsDir);
    } catch {
      await fs.promises.mkdir(receiptsDir, { recursive: true });
    }
    
    // Generate filename
    const filename = `deposit-receipt-${tenant.id}-${Date.now()}.pdf`;
    const filepath = path.join(receiptsDir, filename);
    
    // Save PDF to file
    await fs.promises.writeFile(filepath, pdfBuffer);
    
    return {
      success: true,
      filename,
      filepath,
      downloadUrl: `/receipts/${filename}`,
      pdfBuffer
    };
  } catch (error) {
    console.error('Save deposit receipt error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export default {
  generateDepositReceiptPDF,
  saveDepositReceiptToFile
}; 