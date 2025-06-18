import nodemailer from 'nodemailer'

// Create email transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail', // You can change this to your preferred email service
    auth: {
      user: process.env.EMAIL_USER || 'official.jhapartment@gmail.com',
      pass: process.env.EMAIL_PASS || 'gcme okaj qiyf ubki' // Replace with your Gmail App Password
    }
  })
}

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

// Generate HTML bill template
const generateBillHTML = (bill) => {
  const electricReading = bill.electric_present_reading && bill.electric_previous_reading 
    ? `${bill.electric_previous_reading} → ${bill.electric_present_reading}` 
    : 'N/A';
  
  const electricConsumption = bill.electric_consumption || 0;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4; }
        .bill-container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; }
        .header p { margin: 5px 0 0 0; opacity: 0.9; }
        .content { padding: 30px; }
        .bill-info { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 25px; }
        .bill-info h3 { margin: 0 0 15px 0; color: #333; }
        .info-row { display: flex; justify-content: space-between; margin-bottom: 10px; }
        .info-label { font-weight: bold; color: #666; }
        .info-value { color: #333; }
        .charges-section { margin-bottom: 25px; }
        .charges-section h3 { border-bottom: 2px solid #667eea; padding-bottom: 10px; margin-bottom: 20px; color: #333; }
        .charge-item { display: flex; justify-content: space-between; padding: 15px; margin-bottom: 10px; border-radius: 6px; }
        .charge-rent { background: #e3f2fd; border-left: 4px solid #2196f3; }
        .charge-electric { background: #fff3e0; border-left: 4px solid #ff9800; }
        .charge-water { background: #e8f5e8; border-left: 4px solid #4caf50; }
        .total-section { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; }
        .total-amount { font-size: 32px; font-weight: bold; margin: 10px 0; }
        .footer { padding: 20px; text-align: center; color: #666; border-top: 1px solid #eee; }
        .payment-note { background: #f0f8ff; border: 1px solid #b3d9ff; padding: 15px; border-radius: 6px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="bill-container">
        <!-- Header -->
        <div class="header">
          <h1>${bill.branch_name || 'JH APARTMENT'}</h1>
          <p>${bill.branch_address || 'Patin-ay, Prosperidad, Agusan del Sur'}</p>
        </div>

        <!-- Content -->
        <div class="content">
          <!-- Bill Information -->
          <div class="bill-info">
            <h3>Bill Information</h3>
            <div class="info-row">
              <span class="info-label">Tenant Name:</span>
              <span class="info-value">${bill.tenant_name}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Room Number:</span>
              <span class="info-value">${bill.room_number}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Bill Period:</span>
              <span class="info-value">${formatDate(bill.rent_from)} - ${formatDate(bill.rent_to)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Bill Date:</span>
              <span class="info-value">${formatDate(bill.bill_date)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Due Date:</span>
              <span class="info-value">${formatDate(bill.rent_to)}</span>
            </div>
          </div>

          <!-- Charges Breakdown -->
          <div class="charges-section">
            <h3>Charges Breakdown</h3>
            
            <!-- Rent -->
            <div class="charge-item charge-rent">
              <div>
                <strong>Monthly Rent</strong>
                <br><small>Period: ${formatDate(bill.rent_from)} - ${formatDate(bill.rent_to)}</small>
              </div>
              <div style="text-align: right;">
                <strong>${formatCurrency(bill.rent_amount)}</strong>
              </div>
            </div>

            <!-- Electric -->
            <div class="charge-item charge-electric">
              <div>
                <strong>Electricity</strong>
                <br><small>Reading: ${electricReading} (${electricConsumption} kWh)</small>
                <br><small>Rate: ₱${bill.electric_rate_per_kwh}/kWh</small>
              </div>
              <div style="text-align: right;">
                <strong>${formatCurrency(bill.electric_amount || 0)}</strong>
              </div>
            </div>

            <!-- Water -->
            <div class="charge-item charge-water">
              <div>
                <strong>Water</strong>
                <br><small>Fixed monthly charge</small>
              </div>
              <div style="text-align: right;">
                <strong>${formatCurrency(bill.water_amount)}</strong>
              </div>
            </div>

            ${bill.extra_fee_amount > 0 ? `
            <!-- Extra Fees -->
            <div class="charge-item" style="background: #f3e5f5; border-left: 4px solid #9c27b0;">
              <div>
                <strong>Extra Fees</strong>
                <br><small>${bill.extra_fee_description || 'Additional charges'}</small>
              </div>
              <div style="text-align: right;">
                <strong>${formatCurrency(bill.extra_fee_amount)}</strong>
              </div>
            </div>
            ` : ''}
          </div>

          <!-- Total -->
          <div class="total-section">
            <div>Total Amount Due</div>
            <div class="total-amount">${formatCurrency(bill.total_amount)}</div>
            <div>Status: ${bill.status.toUpperCase()}</div>
          </div>

          <!-- Payment Note -->
          <div class="payment-note">
            <strong>Payment Instructions:</strong><br>
            Please pay your bill on or before the due date to avoid any late fees. 
            Contact the management office for payment methods and assistance.
          </div>
        </div>

        <!-- Footer -->
        <div class="footer">
          <p>This is an automatically generated bill. For questions or concerns, please contact the management office.</p>
          <p><strong>Generated on:</strong> ${formatDate(new Date())}</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Send bill to tenant via email
const sendBillToTenant = async (bill, recipientEmail, customMessage = '') => {
  try {
    const transporter = createTransporter();
    
    const subject = `Monthly Bill - Room ${bill.room_number} - ${formatDate(bill.bill_date)}`;
    const htmlContent = generateBillHTML(bill);
    
    let textMessage = `
Dear ${bill.tenant_name},

Your monthly bill for Room ${bill.room_number} is ready.

Bill Period: ${formatDate(bill.rent_from)} - ${formatDate(bill.rent_to)}
Total Amount: ${formatCurrency(bill.total_amount)}
Due Date: ${formatDate(bill.rent_to)}

Breakdown:
- Rent: ${formatCurrency(bill.rent_amount)}
- Electricity: ${formatCurrency(bill.electric_amount || 0)}
- Water: ${formatCurrency(bill.water_amount)}${bill.extra_fee_amount > 0 ? `
- Extra Fees: ${formatCurrency(bill.extra_fee_amount)} (${bill.extra_fee_description || 'Additional charges'})` : ''}

Please pay on or before the due date.

Thank you,
${bill.branch_name || 'JH Apartment'} Management
    `;

    if (customMessage) {
      textMessage = `${customMessage}\n\n${textMessage}`;
    }

    const mailOptions = {
      from: process.env.EMAIL_USER || 'noreply@jhapartment.com',
      to: recipientEmail,
      subject: subject,
      text: textMessage,
      html: htmlContent,
      attachments: [] // Could add PDF attachment in the future
    };

    const result = await transporter.sendMail(mailOptions);
    
    return {
      success: true,
      messageId: result.messageId,
      message: 'Email sent successfully'
    };
  } catch (error) {
    console.error('Email sending error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Test email configuration
const testEmailConfig = async () => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    return { success: true, message: 'Email configuration is valid' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Send receipt to tenant via email
const sendReceiptToTenant = async (bill, payments, recipientEmail, pdfBuffer, penaltyPercentage = 1.00) => {
  try {
    const transporter = createTransporter();
    
    const subject = `Payment Receipt - Room ${bill.room_number} - ${formatDate(new Date())}`;
    
    // Check if penalty fee was applied
    const hasPenaltyFee = bill.penalty_applied || bill.penalty_fee_amount > 0;
    const penaltyFeeAmount = parseFloat(bill.penalty_fee_amount || 0);
    
    let textMessage = `
Dear ${bill.tenant_name},

Thank you for your payment! Please find your official receipt attached.

Receipt Details:
- Bill Period: ${formatDate(bill.rent_from)} - ${formatDate(bill.rent_to)}
- Total Amount: ${formatCurrency(bill.total_amount)}
- Amount Paid: ${formatCurrency(payments.reduce((sum, p) => sum + parseFloat(p.amount), 0))}
- Payment Date: ${formatDate(payments[payments.length - 1].actual_payment_date || payments[payments.length - 1].payment_date)}
- Status: FULLY PAID
${hasPenaltyFee ? `- Late Payment Fee: ${formatCurrency(penaltyFeeAmount)} (${penaltyPercentage}% penalty applied)` : ''}

This receipt serves as official proof of payment.

Thank you for choosing ${bill.branch_name || 'J&H Apartment'}!

Best regards,
${bill.branch_name || 'J&H Apartment'} Management
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER || 'noreply@jhapartment.com',
      to: recipientEmail,
      subject: subject,
      text: textMessage,
      attachments: [
        {
          filename: `receipt-${bill.id}-${Date.now()}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    };

    const result = await transporter.sendMail(mailOptions);
    
    return {
      success: true,
      message: 'Receipt sent successfully via email',
      messageId: result.messageId
    };
  } catch (error) {
    console.error('Receipt email sending error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Send welcome email to new tenant
const sendWelcomeEmail = async (tenant, roomInfo) => {
  try {
    // Emails are now enabled - attempting to send welcome email
    
    const transporter = createTransporter();
    
    const subject = `Welcome to J&H Apartment! - Room ${roomInfo.room_number}`;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4; }
          .email-container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; }
          .content { padding: 30px; }
          .welcome-section { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .info-box { background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin: 15px 0; }
          .deposit-info { background: #fff3e0; border-left: 4px solid #ff9800; padding: 15px; margin: 15px 0; }
          .contract-info { background: #e8f5e8; border-left: 4px solid #4caf50; padding: 15px; margin: 15px 0; }
          .footer { padding: 20px; text-align: center; color: #666; border-top: 1px solid #eee; }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="header">
            <h1>🏠 Welcome to J&H Apartment!</h1>
            <p>Your new home awaits you</p>
          </div>
          
          <div class="content">
            <div class="welcome-section">
              <h2>Dear ${tenant.name},</h2>
              <p>We are thrilled to welcome you to J&H Apartment! Thank you for choosing us as your new home. We're committed to providing you with a comfortable and pleasant living experience.</p>
            </div>
            
            <div class="info-box">
              <h3>📋 Your Tenancy Details</h3>
              <p><strong>Room Number:</strong> ${roomInfo.room_number}</p>
              <p><strong>Monthly Rent:</strong> ${formatCurrency(roomInfo.monthly_rent)}</p>
              <p><strong>Contract Start:</strong> ${formatDate(tenant.contract_start_date)}</p>
              <p><strong>Contract End:</strong> ${formatDate(tenant.contract_end_date)}</p>
              <p><strong>Contract Duration:</strong> ${tenant.contract_duration_months} months</p>
            </div>
            
            <div class="deposit-info">
              <h3>💰 Deposit Information</h3>
              <p><strong>Advance Payment:</strong> ${formatCurrency(tenant.advance_payment)}</p>
              <p><strong>Security Deposit:</strong> ${formatCurrency(tenant.security_deposit)}</p>
              <p><strong>Total Required:</strong> ${formatCurrency(parseFloat(tenant.advance_payment) + parseFloat(tenant.security_deposit))}</p>
              <p><em>A separate deposit receipt will be sent to you once payment is confirmed.</em></p>
            </div>
            
            <div class="contract-info">
              <h3>📋 Important Information</h3>
              <ul>
                <li>Your rent is due monthly in advance</li>
                <li>Water and electricity bills will be calculated based on usage</li>
                <li>We'll notify you 1 month before your contract expires</li>
                <li>Please keep your deposit receipts for future reference</li>
                <li>Contact management for any maintenance requests</li>
              </ul>
            </div>
            
            <div class="welcome-section">
              <h3>📞 Contact Information</h3>
              <p><strong>Management Office:</strong> Available during business hours</p>
              <p><strong>Email:</strong> official.jhapartment@gmail.com</p>
              <p><strong>Address:</strong> Patin-ay, Prosperidad, Agusan Del Sur</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <p style="font-size: 18px; color: #667eea;"><strong>Welcome to your new home! 🏡</strong></p>
            </div>
          </div>
          
          <div class="footer">
            <p>This email was sent automatically by J&H Apartment Management System</p>
            <p>If you have any questions, please contact our management office</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const textContent = `
Dear ${tenant.name},

Welcome to J&H Apartment! 

Your Tenancy Details:
- Room Number: ${roomInfo.room_number}
- Monthly Rent: ${formatCurrency(roomInfo.monthly_rent)}
- Contract Period: ${formatDate(tenant.contract_start_date)} to ${formatDate(tenant.contract_end_date)}
- Duration: ${tenant.contract_duration_months} months

Deposit Information:
- Advance Payment: ${formatCurrency(tenant.advance_payment)}
- Security Deposit: ${formatCurrency(tenant.security_deposit)}
- Total Required: ${formatCurrency(parseFloat(tenant.advance_payment) + parseFloat(tenant.security_deposit))}

Important Notes:
- Monthly rent is due in advance
- We'll notify you 1 month before contract expiry
- Keep deposit receipts for reference
- Contact management for maintenance requests

Welcome to your new home!

Best regards,
J&H Apartment Management
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER || 'official.jhapartment@gmail.com',
      to: tenant.email,
      subject: subject,
      text: textContent,
      html: htmlContent
    };

    const result = await transporter.sendMail(mailOptions);
    
    return {
      success: true,
      messageId: result.messageId,
      message: 'Welcome email sent successfully'
    };
  } catch (error) {
    console.error('Welcome email sending error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Send deposit receipt email
const sendDepositReceiptEmail = async (tenant, roomInfo, depositReceiptBuffer) => {
  try {
    // Emails are now enabled - attempting to send deposit receipt email
    
    const transporter = createTransporter();
    
    const subject = `Deposit Receipt - Room ${roomInfo.room_number} - J&H Apartment`;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4; }
          .email-container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; }
          .receipt-info { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .amount-box { background: #e8f5e8; border: 2px solid #28a745; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; color: #666; border-top: 1px solid #eee; }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="header">
            <h1>💰 Deposit Receipt</h1>
            <p>Official Payment Confirmation</p>
          </div>
          
          <div class="content">
            <div class="receipt-info">
              <h3>Dear ${tenant.name},</h3>
              <p>Thank you for your payment! We have received your advance payment and security deposit for Room ${roomInfo.room_number}.</p>
            </div>
            
            <div class="amount-box">
              <h3>Payment Summary</h3>
              <p><strong>Advance Payment:</strong> ${formatCurrency(tenant.advance_payment)}</p>
              <p><strong>Security Deposit:</strong> ${formatCurrency(tenant.security_deposit)}</p>
              <hr style="margin: 15px 0;">
              <p style="font-size: 18px;"><strong>Total Paid: ${formatCurrency(parseFloat(tenant.advance_payment) + parseFloat(tenant.security_deposit))}</strong></p>
            </div>
            
            <div class="receipt-info">
              <h3>📋 Receipt Details</h3>
              <p><strong>Receipt Date:</strong> ${formatDate(new Date())}</p>
              <p><strong>Tenant:</strong> ${tenant.name}</p>
              <p><strong>Room:</strong> ${roomInfo.room_number}</p>
              <p><strong>Contract Period:</strong> ${formatDate(tenant.contract_start_date)} to ${formatDate(tenant.contract_end_date)}</p>
            </div>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <h4>📄 Official Receipt Attached</h4>
              <p>Please find your official deposit receipt attached to this email. Keep this receipt for your records as proof of payment.</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <p style="color: #28a745; font-weight: bold;">✅ Payment Confirmed - Welcome to J&H Apartment!</p>
            </div>
          </div>
          
          <div class="footer">
            <p>This receipt is automatically generated and serves as official proof of payment</p>
            <p>For any questions, please contact our management office</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const textContent = `
Dear ${tenant.name},

DEPOSIT RECEIPT - J&H APARTMENT

Thank you for your payment! We have received your deposits for Room ${roomInfo.room_number}.

Payment Summary:
- Advance Payment: ${formatCurrency(tenant.advance_payment)}
- Security Deposit: ${formatCurrency(tenant.security_deposit)}
- Total Paid: ${formatCurrency(parseFloat(tenant.advance_payment) + parseFloat(tenant.security_deposit))}

Receipt Details:
- Date: ${formatDate(new Date())}
- Tenant: ${tenant.name}
- Room: ${roomInfo.room_number}
- Contract: ${formatDate(tenant.contract_start_date)} to ${formatDate(tenant.contract_end_date)}

Your official receipt is attached to this email. Please keep it for your records.

Welcome to J&H Apartment!

Best regards,
J&H Apartment Management
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER || 'official.jhapartment@gmail.com',
      to: tenant.email,
      subject: subject,
      text: textContent,
      html: htmlContent,
      attachments: [
        {
          filename: `deposit-receipt-${tenant.id}-${Date.now()}.pdf`,
          content: depositReceiptBuffer,
          contentType: 'application/pdf'
        }
      ]
    };

    const result = await transporter.sendMail(mailOptions);
    
    return {
      success: true,
      messageId: result.messageId,
      message: 'Deposit receipt email sent successfully'
    };
  } catch (error) {
    console.error('Deposit receipt email sending error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Send contract expiry notification
const sendContractExpiryNotification = async (tenant, roomInfo) => {
  try {
    // Emails are now enabled - attempting to send contract expiry notification
    
    const transporter = createTransporter();
    
    const subject = `Contract Expiry Notice - Room ${roomInfo.room_number} - Action Required`;
    
    const daysUntilExpiry = Math.ceil((new Date(tenant.contract_end_date) - new Date()) / (1000 * 60 * 60 * 24));
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4; }
          .email-container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; }
          .notice-box { background: #fff3cd; border: 2px solid #ffc107; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .info-section { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .action-box { background: #e3f2fd; border-left: 4px solid #2196f3; padding: 20px; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; color: #666; border-top: 1px solid #eee; }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="header">
            <h1>⚠️ Contract Expiry Notice</h1>
            <p>Important: Action Required</p>
          </div>
          
          <div class="content">
            <div class="notice-box">
              <h3>Dear ${tenant.name},</h3>
              <p style="font-size: 16px;"><strong>Your tenancy contract will expire in ${daysUntilExpiry} days.</strong></p>
              <p>Contract End Date: <strong>${formatDate(tenant.contract_end_date)}</strong></p>
            </div>
            
            <div class="info-section">
              <h3>📋 Current Contract Details</h3>
              <p><strong>Room Number:</strong> ${roomInfo.room_number}</p>
              <p><strong>Contract Start:</strong> ${formatDate(tenant.contract_start_date)}</p>
              <p><strong>Contract End:</strong> ${formatDate(tenant.contract_end_date)}</p>
              <p><strong>Monthly Rent:</strong> ${formatCurrency(roomInfo.monthly_rent)}</p>
            </div>
            
            <div class="action-box">
              <h3>🔄 Renewal Options</h3>
              <p>If you wish to continue staying with us, please contact our management office to discuss renewal terms:</p>
              <ul>
                <li>Standard 6-month contract renewal</li>
                <li>Custom contract duration options available</li>
                <li>Current rent rates may apply</li>
                <li>New contract to be signed before expiry date</li>
              </ul>
            </div>
            
            <div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <h4>⏰ Important Deadlines</h4>
              <p><strong>Please notify us of your intentions by:</strong> ${formatDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))}</p>
              <p>This will allow us sufficient time to process your renewal or arrange for a smooth transition.</p>
            </div>
            
            <div class="info-section">
              <h3>📞 Contact Management</h3>
              <p><strong>Email:</strong> official.jhapartment@gmail.com</p>
              <p><strong>Visit:</strong> Management Office during business hours</p>
              <p><strong>Address:</strong> Patin-ay, Prosperidad, Agusan Del Sur</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <p style="color: #ff6b6b; font-weight: bold;">⚠️ Please respond within 7 days to avoid any complications</p>
            </div>
          </div>
          
          <div class="footer">
            <p>This is an automated reminder sent 30 days before contract expiry</p>
            <p>Thank you for being a valued tenant at J&H Apartment</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const textContent = `
Dear ${tenant.name},

CONTRACT EXPIRY NOTICE - J&H APARTMENT

Your tenancy contract will expire in ${daysUntilExpiry} days.

Contract Details:
- Room: ${roomInfo.room_number}
- Contract End: ${formatDate(tenant.contract_end_date)}
- Monthly Rent: ${formatCurrency(roomInfo.monthly_rent)}

Renewal Options:
- Standard 6-month renewal available
- Custom duration options
- Contact management office to discuss terms

Important:
Please notify us of your intentions by ${formatDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))}

Contact Information:
Email: official.jhapartment@gmail.com
Visit: Management Office during business hours

Please respond within 7 days to avoid complications.

Thank you for being a valued tenant.

Best regards,
J&H Apartment Management
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER || 'official.jhapartment@gmail.com',
      to: tenant.email,
      subject: subject,
      text: textContent,
      html: htmlContent
    };

    const result = await transporter.sendMail(mailOptions);
    
    return {
      success: true,
      messageId: result.messageId,
      message: 'Contract expiry notification sent successfully'
    };
  } catch (error) {
    console.error('Contract expiry email sending error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Send departure notification email
const sendDepartureEmail = async (recipientEmail, departureInfo) => {
  try {
    const transporter = createTransporter();
    
    const subject = `Departure Confirmation - Room ${departureInfo.room_number} - J&H Apartment`;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4; }
          .email-container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; }
          .info-section { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .summary-box { background: #e3f2fd; border-left: 4px solid #2196f3; padding: 20px; margin: 20px 0; }
          .refund-box { background: #e8f5e8; border-left: 4px solid #4caf50; padding: 20px; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; color: #666; border-top: 1px solid #eee; }
          .status-badge { display: inline-block; padding: 5px 15px; border-radius: 20px; font-size: 12px; font-weight: bold; }
          .completed { background: #d4edda; color: #155724; }
          .early { background: #fff3cd; color: #856404; }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="header">
            <h1>🏠 Departure Confirmation</h1>
            <p>J&H Apartment - Thank You for Staying With Us</p>
          </div>
          
          <div class="content">
            <h3>Dear ${departureInfo.tenant_name},</h3>
            <p>We confirm that your tenancy at J&H Apartment has been processed and your records have been updated.</p>
            
            <div class="info-section">
              <h3>📋 Tenancy Summary</h3>
              <p><strong>Room Number:</strong> ${departureInfo.room_number}</p>
              <p><strong>Branch:</strong> ${departureInfo.branch_name}</p>
              <p><strong>Tenancy Period:</strong> ${formatDate(departureInfo.rent_start)} - ${formatDate(departureInfo.rent_end)}</p>
              <p><strong>Contract Status:</strong> 
                <span class="status-badge ${departureInfo.contract_completed ? 'completed' : 'early'}">
                  ${departureInfo.contract_completed ? 'Contract Completed' : 'Early Departure'}
                </span>
              </p>
              <p><strong>Departure Reason:</strong> ${departureInfo.reason_for_leaving?.replace('_', ' ') || 'Not specified'}</p>
            </div>
            
            <div class="summary-box">
              <h3>💰 Financial Summary</h3>
              <p><strong>Total Bills Paid:</strong> ${formatCurrency(departureInfo.total_bills_paid || 0)}</p>
              ${departureInfo.total_bills_unpaid > 0 ? `
                <p><strong>Outstanding Amount:</strong> <span style="color: #dc3545;">${formatCurrency(departureInfo.total_bills_unpaid)}</span></p>
                <p><small style="color: #dc3545;">Please settle any outstanding amounts as soon as possible.</small></p>
              ` : `
                <p style="color: #28a745;"><strong>✅ All bills have been settled</strong></p>
              `}
            </div>
            
            ${departureInfo.security_deposit_refund > 0 ? `
            <div class="refund-box">
              <h3>💵 Security Deposit Refund</h3>
              <p><strong>Refund Amount:</strong> ${formatCurrency(departureInfo.security_deposit_refund)}</p>
              <p>Your security deposit refund will be processed according to our standard procedures. Please contact the management office for refund collection details.</p>
            </div>
            ` : ''}
            
            <div class="info-section">
              <h3>📞 Contact Information</h3>
              <p>If you have any questions or need assistance, please contact us:</p>
              <p><strong>Email:</strong> official.jhapartment@gmail.com</p>
              <p><strong>Address:</strong> Patin-ay, Prosperidad, Agusan Del Sur</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0; padding: 20px; background: #f0f8ff; border-radius: 8px;">
              <h3>🙏 Thank You!</h3>
              <p>Thank you for choosing J&H Apartment as your home. We appreciate your tenancy and wish you all the best in your future endeavors.</p>
              <p><em>You're always welcome back!</em></p>
            </div>
          </div>
          
          <div class="footer">
            <p>This is an automated confirmation email</p>
            <p>J&H Apartment Management Team</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const textContent = `
Dear ${departureInfo.tenant_name},

DEPARTURE CONFIRMATION - J&H APARTMENT

We confirm that your tenancy has been processed and your records have been updated.

Tenancy Summary:
- Room: ${departureInfo.room_number}
- Branch: ${departureInfo.branch_name}
- Period: ${formatDate(departureInfo.rent_start)} - ${formatDate(departureInfo.rent_end)}
- Status: ${departureInfo.contract_completed ? 'Contract Completed' : 'Early Departure'}
- Reason: ${departureInfo.reason_for_leaving?.replace('_', ' ') || 'Not specified'}

Financial Summary:
- Total Bills Paid: ${formatCurrency(departureInfo.total_bills_paid || 0)}
${departureInfo.total_bills_unpaid > 0 ? `- Outstanding Amount: ${formatCurrency(departureInfo.total_bills_unpaid)}` : '- All bills settled ✅'}

${departureInfo.security_deposit_refund > 0 ? `
Security Deposit Refund: ${formatCurrency(departureInfo.security_deposit_refund)}
Please contact the management office for refund collection details.
` : ''}

Contact Information:
Email: official.jhapartment@gmail.com
Address: Patin-ay, Prosperidad, Agusan Del Sur

Thank you for choosing J&H Apartment as your home. We appreciate your tenancy and wish you all the best!

You're always welcome back!

Best regards,
J&H Apartment Management Team
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER || 'official.jhapartment@gmail.com',
      to: recipientEmail,
      subject: subject,
      text: textContent,
      html: htmlContent
    };

    const result = await transporter.sendMail(mailOptions);
    
    return {
      success: true,
      messageId: result.messageId,
      message: 'Departure email sent successfully'
    };
  } catch (error) {
    console.error('Departure email sending error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Send monthly business report
const sendMonthlyReport = async (recipientEmail, reportData) => {
  try {
    const transporter = createTransporter();
    
    const monthName = reportData.report_period.month_name
    const totalRevenue = reportData.financial_summary.total_revenue.toLocaleString()
    const occupancyRate = reportData.occupancy_metrics.occupancy_rate
    const activeTenants = reportData.tenant_statistics.active_tenants
    const revenueGrowth = reportData.financial_summary.revenue_growth

    // Create branch performance table
    const branchTable = reportData.branch_performance.map(branch => `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">${branch.branch_name}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${branch.occupied_rooms}/${branch.total_rooms}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${branch.occupancy_rate}%</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">₱${branch.revenue.toLocaleString()}</td>
      </tr>
    `).join('')

    // Create payment methods table
    const paymentTable = reportData.payment_analysis.by_method.map(method => `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">${method.payment_method}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${method.transaction_count}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">₱${method.total_amount.toLocaleString()}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${method.percentage}%</td>
      </tr>
    `).join('')

    // Create top performers table
    const topPerformersTable = reportData.top_performers.map(tenant => `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">${tenant.tenant_name}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${tenant.room_number}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">₱${tenant.total_paid.toLocaleString()}</td>
      </tr>
    `).join('')

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Monthly Business Report - ${monthName}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 800px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px; margin-bottom: 30px; }
          .metric-card { background: #f8f9fa; border-left: 4px solid #007bff; padding: 20px; margin: 15px 0; border-radius: 5px; }
          .metric-value { font-size: 2em; font-weight: bold; color: #007bff; }
          .metric-label { color: #666; font-size: 0.9em; }
          .growth-positive { color: #28a745; }
          .growth-negative { color: #dc3545; }
          .section { margin: 30px 0; }
          .section-title { font-size: 1.5em; color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th { background: #007bff; color: white; padding: 12px; text-align: left; }
          .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
          .alert { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .footer { text-align: center; margin-top: 40px; padding: 20px; background: #f8f9fa; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📊 J&H Apartment Monthly Report</h1>
            <h2>${monthName}</h2>
            <p>Generated on ${new Date(reportData.report_period.generated_at).toLocaleDateString()}</p>
          </div>

          <!-- Executive Summary -->
          <div class="section">
            <h2 class="section-title">📈 Executive Summary</h2>
            <div class="summary-grid">
              <div class="metric-card">
                <div class="metric-value">₱${totalRevenue}</div>
                <div class="metric-label">Total Revenue</div>
                <div class="${revenueGrowth >= 0 ? 'growth-positive' : 'growth-negative'}">
                  ${revenueGrowth >= 0 ? '↗' : '↘'} ${Math.abs(revenueGrowth)}% vs last month
                </div>
              </div>
              <div class="metric-card">
                <div class="metric-value">${occupancyRate}%</div>
                <div class="metric-label">Occupancy Rate</div>
                <div class="metric-label">${reportData.occupancy_metrics.occupied_rooms}/${reportData.occupancy_metrics.total_rooms} rooms occupied</div>
              </div>
              <div class="metric-card">
                <div class="metric-value">${activeTenants}</div>
                <div class="metric-label">Active Tenants</div>
                <div class="metric-label">Net change: ${reportData.tenant_statistics.net_tenant_change >= 0 ? '+' : ''}${reportData.tenant_statistics.net_tenant_change}</div>
              </div>
              <div class="metric-card">
                <div class="metric-value">${reportData.financial_summary.collection_rate}%</div>
                <div class="metric-label">Collection Rate</div>
                <div class="metric-label">₱${reportData.financial_summary.total_billed.toLocaleString()} billed</div>
              </div>
            </div>
          </div>

          <!-- Financial Performance -->
          <div class="section">
            <h2 class="section-title">💰 Financial Performance</h2>
            <div class="summary-grid">
              <div class="metric-card">
                <div class="metric-value">${reportData.financial_summary.total_transactions}</div>
                <div class="metric-label">Total Transactions</div>
              </div>
              <div class="metric-card">
                <div class="metric-value">₱${reportData.outstanding_summary.total_outstanding.toLocaleString()}</div>
                <div class="metric-label">Outstanding Amount</div>
                <div class="metric-label">${reportData.outstanding_summary.unpaid_bills_count + reportData.outstanding_summary.partial_bills_count} bills pending</div>
              </div>
            </div>

            <h3>Payment Methods Breakdown</h3>
            <table>
              <thead>
                <tr>
                  <th>Payment Method</th>
                  <th>Transactions</th>
                  <th>Amount</th>
                  <th>Percentage</th>
                </tr>
              </thead>
              <tbody>
                ${paymentTable}
              </tbody>
            </table>
          </div>

          <!-- Branch Performance -->
          <div class="section">
            <h2 class="section-title">🏢 Branch Performance</h2>
            <table>
              <thead>
                <tr>
                  <th>Branch</th>
                  <th>Occupancy</th>
                  <th>Rate</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                ${branchTable}
              </tbody>
            </table>
          </div>

          <!-- Tenant Statistics -->
          <div class="section">
            <h2 class="section-title">👥 Tenant Statistics</h2>
            <div class="summary-grid">
              <div class="metric-card">
                <div class="metric-value">${reportData.tenant_statistics.new_tenants}</div>
                <div class="metric-label">New Tenants</div>
              </div>
              <div class="metric-card">
                <div class="metric-value">${reportData.tenant_statistics.departed_tenants}</div>
                <div class="metric-label">Departed Tenants</div>
              </div>
              <div class="metric-card">
                <div class="metric-value">${reportData.tenant_statistics.expiring_contracts}</div>
                <div class="metric-label">Expiring Contracts</div>
                <div class="metric-label">Next 30 days</div>
              </div>
            </div>
          </div>

          <!-- Top Performers -->
          ${reportData.top_performers.length > 0 ? `
          <div class="section">
            <h2 class="section-title">🌟 Top Paying Tenants</h2>
            <table>
              <thead>
                <tr>
                  <th>Tenant Name</th>
                  <th>Room</th>
                  <th>Amount Paid</th>
                </tr>
              </thead>
              <tbody>
                ${topPerformersTable}
              </tbody>
            </table>
          </div>
          ` : ''}

          <!-- Alerts & Recommendations -->
          ${reportData.outstanding_summary.total_outstanding > 0 ? `
          <div class="alert">
            <strong>⚠️ Action Required:</strong> There are ₱${reportData.outstanding_summary.total_outstanding.toLocaleString()} in outstanding payments that need attention.
          </div>
          ` : ''}

          ${reportData.tenant_statistics.expiring_contracts > 0 ? `
          <div class="alert">
            <strong>📅 Contract Renewals:</strong> ${reportData.tenant_statistics.expiring_contracts} contracts are expiring in the next 30 days.
          </div>
          ` : ''}

          ${occupancyRate < 80 ? `
          <div class="alert">
            <strong>🏠 Occupancy Alert:</strong> Current occupancy rate is ${occupancyRate}%. Consider marketing strategies to increase occupancy.
          </div>
          ` : ''}

          <div class="footer">
            <p><strong>J&H Apartment Management System</strong></p>
            <p>This report was automatically generated on ${new Date().toLocaleDateString()}</p>
            <p>For questions or support, please contact the management team.</p>
          </div>
        </div>
      </body>
      </html>
    `

    const textContent = `
J&H APARTMENT MONTHLY REPORT - ${monthName}
Generated: ${new Date(reportData.report_period.generated_at).toLocaleDateString()}

EXECUTIVE SUMMARY
=================
Total Revenue: ₱${totalRevenue} (${revenueGrowth >= 0 ? '+' : ''}${revenueGrowth}% vs last month)
Occupancy Rate: ${occupancyRate}% (${reportData.occupancy_metrics.occupied_rooms}/${reportData.occupancy_metrics.total_rooms} rooms)
Active Tenants: ${activeTenants} (Net change: ${reportData.tenant_statistics.net_tenant_change >= 0 ? '+' : ''}${reportData.tenant_statistics.net_tenant_change})
Collection Rate: ${reportData.financial_summary.collection_rate}%

FINANCIAL PERFORMANCE
=====================
Total Transactions: ${reportData.financial_summary.total_transactions}
Total Billed: ₱${reportData.financial_summary.total_billed.toLocaleString()}
Outstanding Amount: ₱${reportData.outstanding_summary.total_outstanding.toLocaleString()}

TENANT STATISTICS
=================
New Tenants: ${reportData.tenant_statistics.new_tenants}
Departed Tenants: ${reportData.tenant_statistics.departed_tenants}
Expiring Contracts (30 days): ${reportData.tenant_statistics.expiring_contracts}

BRANCH PERFORMANCE
==================
${reportData.branch_performance.map(branch => 
  `${branch.branch_name}: ${branch.occupancy_rate}% occupancy, ₱${branch.revenue.toLocaleString()} revenue`
).join('\n')}

This report was automatically generated by J&H Apartment Management System.
    `

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'official.jhapartment@gmail.com',
      to: recipientEmail,
      subject: `📊 Monthly Business Report - ${monthName} | J&H Apartment`,
      text: textContent,
      html: htmlContent
    }

    const result = await transporter.sendMail(mailOptions)
    console.log('Monthly report email sent successfully:', result.messageId)
    
    return {
      success: true,
      message: 'Monthly report email sent successfully',
      messageId: result.messageId
    }

  } catch (error) {
    console.error('Error sending monthly report email:', error)
    throw error
  }
}

// Send billing reminder to management office
const sendBillingReminderToManagement = async (tenants) => {
  try {
    const transporter = createTransporter();
    
    const subject = `Bill Creation Reminder - ${tenants.length} Tenant${tenants.length > 1 ? 's' : ''} Need${tenants.length === 1 ? 's' : ''} Billing`;
    
    // Group tenants by due date
    const tenantsByDueDate = tenants.reduce((acc, tenant) => {
      const dueDate = formatDate(tenant.next_bill_due_date);
      if (!acc[dueDate]) {
        acc[dueDate] = [];
      }
      acc[dueDate].push(tenant);
      return acc;
    }, {});
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4; }
          .email-container { max-width: 800px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; }
          .alert-box { background: #fff3cd; border: 2px solid #ffc107; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .bills-section { margin: 20px 0; }
          .due-date-group { margin-bottom: 30px; }
          .due-date-header { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px; }
          .bill-item { background: #ffffff; border: 1px solid #dee2e6; padding: 15px; margin-bottom: 10px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; }
          .bill-info { flex: 1; }
          .bill-amount { font-weight: bold; color: #dc3545; }
          .overdue { border-left: 4px solid #dc3545; }
          .due-today { border-left: 4px solid #fd7e14; }
          .due-soon { border-left: 4px solid #ffc107; }
          .footer { padding: 20px; text-align: center; color: #666; border-top: 1px solid #eee; }
          .summary-stats { display: flex; justify-content: space-around; background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .stat-item { text-align: center; }
          .stat-number { font-size: 24px; font-weight: bold; color: #dc3545; }
          .stat-label { font-size: 12px; color: #666; text-transform: uppercase; }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="header">
            <h1>📝 Bill Creation Reminder</h1>
            <p>Tenants requiring bill generation</p>
          </div>
          
          <div class="content">
            <div class="alert-box">
              <h3>⚠️ Action Required</h3>
              <p>The following tenants' billing cycles are ending within the next 3 days and need bills created:</p>
            </div>
            
            <div class="summary-stats">
              <div class="stat-item">
                <div class="stat-number">${tenants.length}</div>
                <div class="stat-label">Tenants Need Billing</div>
              </div>
              <div class="stat-item">
                <div class="stat-number">${formatCurrency(tenants.reduce((sum, tenant) => sum + parseFloat(tenant.monthly_rent || 0), 0))}</div>
                <div class="stat-label">Estimated Rent Amount</div>
              </div>
              <div class="stat-item">
                <div class="stat-number">${tenants.filter(tenant => tenant.days_until_due <= 0).length}</div>
                <div class="stat-label">Overdue for Billing</div>
              </div>
            </div>
            
            <div class="bills-section">
              ${Object.entries(tenantsByDueDate).map(([dueDate, dateTenants]) => {
                const daysUntilDue = dateTenants[0].days_until_due;
                let dueDateClass = 'due-soon';
                let dueDateLabel = `Bill due in ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''}`;
                
                if (daysUntilDue <= 0) {
                  dueDateClass = 'overdue';
                  dueDateLabel = `Overdue for billing by ${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) !== 1 ? 's' : ''}`;
                } else if (daysUntilDue === 0) {
                  dueDateClass = 'due-today';
                  dueDateLabel = 'Billing cycle ends today';
                }
                
                return `
                  <div class="due-date-group">
                    <div class="due-date-header ${dueDateClass}">
                      <h3>📅 ${dueDate} - ${dueDateLabel}</h3>
                      <p>${dateTenants.length} tenant${dateTenants.length > 1 ? 's' : ''} • Estimated Rent: ${formatCurrency(dateTenants.reduce((sum, tenant) => sum + parseFloat(tenant.monthly_rent || 0), 0))}</p>
                    </div>
                    ${dateTenants.map(tenant => `
                      <div class="bill-item ${dueDateClass}">
                        <div class="bill-info">
                          <strong>${tenant.tenant_name}</strong> - Room ${tenant.room_number}
                          <br>
                          <small>${tenant.branch_name} • Last Reading: ${tenant.last_electric_reading} kWh</small>
                          <br><small style="color: #2196f3;">📝 Need to create bill for billing period ending ${formatDate(tenant.next_bill_due_date)}</small>
                        </div>
                        <div class="bill-amount">
                          ${formatCurrency(tenant.monthly_rent)}<br><small>+ utilities</small>
                        </div>
                      </div>
                    `).join('')}
                  </div>
                `;
              }).join('')}
            </div>
            
            <div style="background: #e3f2fd; border-left: 4px solid #2196f3; padding: 20px; margin: 20px 0;">
              <h3>📋 Recommended Actions</h3>
              <ul>
                <li>Create bills for tenants whose billing cycle ends today</li>
                <li>Take electricity readings for overdue tenants and generate their bills immediately</li>
                <li>Prepare bills for tenants whose cycle ends in 1-3 days</li>
                <li>Check the "Generate Bill" button in the Billing page for each tenant</li>
                <li>Send created bills to tenants via email</li>
              </ul>
            </div>
          </div>
          
          <div class="footer">
            <p>This is an automated bill creation reminder sent daily at 9:00 AM</p>
            <p>Generated on: ${formatDate(new Date())} at ${new Date().toLocaleTimeString()}</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const textContent = `
BILL CREATION REMINDER - J&H APARTMENT MANAGEMENT

${tenants.length} Tenant${tenants.length > 1 ? 's' : ''} Need${tenants.length === 1 ? 's' : ''} Bill Creation

Summary:
- Tenants Needing Bills: ${tenants.length}
- Estimated Rent Amount: ${formatCurrency(tenants.reduce((sum, tenant) => sum + parseFloat(tenant.monthly_rent || 0), 0))}
- Overdue for Billing: ${tenants.filter(tenant => tenant.days_until_due <= 0).length}

Tenants by Billing Due Date:
${Object.entries(tenantsByDueDate).map(([dueDate, dateTenants]) => {
  const daysUntilDue = dateTenants[0].days_until_due;
  let dueDateLabel = `Bill due in ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''}`;
  
  if (daysUntilDue <= 0) {
    dueDateLabel = `Overdue for billing by ${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) !== 1 ? 's' : ''}`;
  } else if (daysUntilDue === 0) {
    dueDateLabel = 'Billing cycle ends today';
  }
  
  return `
${dueDate} - ${dueDateLabel}
${dateTenants.map(tenant => 
  `  • ${tenant.tenant_name} - Room ${tenant.room_number} (${tenant.branch_name})
    Rent: ${formatCurrency(tenant.monthly_rent)} + utilities
    Last Electric Reading: ${tenant.last_electric_reading} kWh
    Action: Create bill for billing period ending ${formatDate(tenant.next_bill_due_date)}`
).join('\n')}`;
}).join('\n')}

Recommended Actions:
- Create bills for tenants whose billing cycle ends today
- Take electricity readings for overdue tenants and generate their bills immediately
- Prepare bills for tenants whose cycle ends in 1-3 days
- Check the "Generate Bill" button in the Billing page for each tenant
- Send created bills to tenants via email

Generated on: ${formatDate(new Date())} at ${new Date().toLocaleTimeString()}
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER || 'noreply@jhapartment.com',
      to: 'official.jhapartment@gmail.com',
      subject: subject,
      text: textContent,
      html: htmlContent
    };

    const result = await transporter.sendMail(mailOptions);
    
    return {
      success: true,
      messageId: result.messageId,
      message: 'Bill creation reminder sent to management successfully',
      tenantsCount: tenants.length
    };
  } catch (error) {
    console.error('Billing reminder email sending error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Generate HTML for final bill template with deposit information
const generateFinalBillHTML = (bill) => {
  const electricReading = bill.electric_present_reading && bill.electric_previous_reading 
    ? `${bill.electric_previous_reading} → ${bill.electric_present_reading}` 
    : 'N/A';
  
  const electricConsumption = bill.electric_consumption || 0;
  
  // Get deposit information if available
  const depositApplied = parseFloat(bill.deposit_applied || 0);
  const originalBillAmount = parseFloat(bill.original_bill_amount || bill.total_amount);
  const hasDepositApplied = depositApplied > 0;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4; }
        .bill-container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #e53935 0%, #8e24aa 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; }
        .header p { margin: 5px 0 0 0; opacity: 0.9; }
        .final-bill-badge { background: #ff5252; color: white; padding: 5px 10px; border-radius: 4px; font-size: 14px; margin-top: 10px; display: inline-block; }
        .content { padding: 30px; }
        .bill-info { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 25px; }
        .bill-info h3 { margin: 0 0 15px 0; color: #333; }
        .info-row { display: flex; justify-content: space-between; margin-bottom: 10px; }
        .info-label { font-weight: bold; color: #666; }
        .info-value { color: #333; }
        .charges-section { margin-bottom: 25px; }
        .charges-section h3 { border-bottom: 2px solid #e53935; padding-bottom: 10px; margin-bottom: 20px; color: #333; }
        .charge-item { display: flex; justify-content: space-between; padding: 15px; margin-bottom: 10px; border-radius: 6px; }
        .charge-rent { background: #e3f2fd; border-left: 4px solid #2196f3; }
        .charge-electric { background: #fff3e0; border-left: 4px solid #ff9800; }
        .charge-water { background: #e8f5e8; border-left: 4px solid #4caf50; }
        .deposit-section { background: #e8eaf6; padding: 20px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #3f51b5; }
        .deposit-row { display: flex; justify-content: space-between; margin-bottom: 10px; }
        .total-section { background: linear-gradient(135deg, #e53935 0%, #8e24aa 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; }
        .total-amount { font-size: 32px; font-weight: bold; margin: 10px 0; }
        .footer { padding: 20px; text-align: center; color: #666; border-top: 1px solid #eee; }
        .payment-note { background: #ffebee; border: 1px solid #ffcdd2; padding: 15px; border-radius: 6px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="bill-container">
        <!-- Header -->
        <div class="header">
          <h1>${bill.branch_name || 'JH APARTMENT'}</h1>
          <p>${bill.branch_address || 'Patin-ay, Prosperidad, Agusan del Sur'}</p>
          <div class="final-bill-badge">FINAL BILL</div>
        </div>

        <!-- Content -->
        <div class="content">
          <!-- Bill Information -->
          <div class="bill-info">
            <h3>Final Bill Information</h3>
            <div class="info-row">
              <span class="info-label">Tenant Name:</span>
              <span class="info-value">${bill.tenant_name}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Room Number:</span>
              <span class="info-value">${bill.room_number}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Final Bill Period:</span>
              <span class="info-value">${formatDate(bill.rent_from)} - ${formatDate(bill.rent_to)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Bill Date:</span>
              <span class="info-value">${formatDate(bill.bill_date)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Due Date:</span>
              <span class="info-value">${formatDate(bill.rent_to)}</span>
            </div>
          </div>

          <!-- Charges Breakdown -->
          <div class="charges-section">
            <h3>Charges Breakdown</h3>
            
            <!-- Rent -->
            <div class="charge-item charge-rent">
              <div>
                <strong>Prorated Rent</strong>
                <br><small>Period: ${formatDate(bill.rent_from)} - ${formatDate(bill.rent_to)}</small>
              </div>
              <div style="text-align: right;">
                <strong>${formatCurrency(bill.rent_amount)}</strong>
              </div>
            </div>

            <!-- Electric -->
            <div class="charge-item charge-electric">
              <div>
                <strong>Electricity</strong>
                <br><small>Reading: ${electricReading} (${electricConsumption} kWh)</small>
                <br><small>Rate: ₱${bill.electric_rate_per_kwh}/kWh</small>
              </div>
              <div style="text-align: right;">
                <strong>${formatCurrency(bill.electric_amount || 0)}</strong>
              </div>
            </div>

            <!-- Water -->
            <div class="charge-item charge-water">
              <div>
                <strong>Water</strong>
                <br><small>Fixed charge</small>
              </div>
              <div style="text-align: right;">
                <strong>${formatCurrency(bill.water_amount)}</strong>
              </div>
            </div>

            ${bill.extra_fee_amount > 0 ? `
            <!-- Extra Fees -->
            <div class="charge-item" style="background: #f3e5f5; border-left: 4px solid #9c27b0;">
              <div>
                <strong>Extra Fees</strong>
                <br><small>${bill.extra_fee_description || 'Additional charges'}</small>
              </div>
              <div style="text-align: right;">
                <strong>${formatCurrency(bill.extra_fee_amount)}</strong>
              </div>
            </div>
            ` : ''}
          </div>

          ${hasDepositApplied ? `
          <!-- Deposit Applied Section -->
          <div class="deposit-section">
            <h3>Deposit Applied</h3>
            <div class="deposit-row">
              <span class="info-label">Original Bill Amount:</span>
              <span class="info-value">${formatCurrency(originalBillAmount)}</span>
            </div>
            <div class="deposit-row">
              <span class="info-label">Deposit Applied:</span>
              <span class="info-value">- ${formatCurrency(depositApplied)}</span>
            </div>
            <div class="deposit-row" style="border-top: 1px solid #ccc; padding-top: 10px; font-weight: bold;">
              <span class="info-label">Remaining Balance Due:</span>
              <span class="info-value">${formatCurrency(bill.total_amount)}</span>
            </div>
          </div>
          ` : ''}

          <!-- Total -->
          <div class="total-section">
            <div>Total Amount Due</div>
            <div class="total-amount">${formatCurrency(bill.total_amount)}</div>
            <div>Status: ${(bill.status || 'PENDING').toUpperCase()}</div>
          </div>

          <!-- Payment Note -->
          <div class="payment-note">
            <strong>IMPORTANT: Final Bill Payment</strong><br>
            This is your FINAL BILL for your tenancy. Please settle this amount to complete your move-out process.
            Your room will only be officially vacated and your contract terminated after this bill is paid in full.
            ${hasDepositApplied ? `Your security deposit of ${formatCurrency(depositApplied)} has been applied to reduce the original bill amount.` : ''}
          </div>
        </div>

        <!-- Footer -->
        <div class="footer">
          <p>This is an automatically generated final bill. For questions or concerns, please contact the management office.</p>
          <p><strong>Generated on:</strong> ${formatDate(new Date())}</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Send final bill to tenant via email
const sendFinalBillToTenant = async (bill, recipientEmail) => {
  try {
    const transporter = createTransporter();
    
    // Determine if deposit was applied
    const depositApplied = parseFloat(bill.deposit_applied || 0);
    const hasDepositApplied = depositApplied > 0;
    
    const subject = `FINAL BILL - Room ${bill.room_number} - Move Out`;
    const htmlContent = generateFinalBillHTML(bill);
    
    let textMessage = `
Dear ${bill.tenant_name},

This is your FINAL BILL for Room ${bill.room_number} at ${bill.branch_name || 'JH APARTMENT'}.

Final Bill Period: ${formatDate(bill.rent_from)} - ${formatDate(bill.rent_to)}
Bill Date: ${formatDate(bill.bill_date)}
Due Date: ${formatDate(bill.rent_to)}

CHARGES BREAKDOWN:
- Prorated Rent: ${formatCurrency(bill.rent_amount)}
- Electricity: ${formatCurrency(bill.electric_amount || 0)}
- Water: ${formatCurrency(bill.water_amount)}
${bill.extra_fee_amount > 0 ? `- Extra Fees (${bill.extra_fee_description || 'Additional charges'}): ${formatCurrency(bill.extra_fee_amount)}\n` : ''}

${hasDepositApplied ? `
DEPOSIT APPLIED:
- Original Bill Amount: ${formatCurrency(parseFloat(bill.original_bill_amount || bill.total_amount))}
- Deposit Applied: - ${formatCurrency(depositApplied)}
- Remaining Balance Due: ${formatCurrency(bill.total_amount)}
` : ''}

TOTAL AMOUNT DUE: ${formatCurrency(bill.total_amount)}

IMPORTANT: This is your FINAL BILL. Please settle this amount to complete your move-out process.
Your room will only be officially vacated and your contract terminated after this bill is paid in full.
${hasDepositApplied ? `Your security deposit of ${formatCurrency(depositApplied)} has been applied to reduce the original bill amount.` : ''}

For questions or concerns, please contact the management office.

Thank you for choosing ${bill.branch_name || 'JH APARTMENT'}.
`;

    const mailOptions = {
      from: process.env.EMAIL_USER || 'official.jhapartment@gmail.com',
      to: recipientEmail,
      subject: subject,
      text: textMessage,
      html: htmlContent
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Final bill email sent to ${recipientEmail}`);
    return true;
  } catch (error) {
    console.error('Error sending final bill email:', error);
    return false;
  }
};

// Send refund notification email to tenant
const sendRefundNotificationEmail = async (bill, recipientEmail, refundAmount) => {
  try {
    const transporter = createTransporter();
    
    const subject = `💰 Refund Due - Room ${bill.room_number} - Move Out`;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4; }
          .email-container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; }
          .refund-info { background: #e8f5e8; border-left: 4px solid #28a745; padding: 20px; margin: 20px 0; border-radius: 8px; }
          .bill-info { background: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 8px; }
          .amount-box { background: #d4edda; border: 2px solid #28a745; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; color: #666; border-top: 1px solid #eee; }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="header">
            <h1>💰 Great News! Refund Available</h1>
            <p>Your Move-Out Process - Refund Due</p>
          </div>
          
          <div class="content">
            <div class="refund-info">
              <h3>Dear ${bill.tenant_name},</h3>
              <p>Excellent news! After covering all your bills, you have a refund due from your deposits.</p>
            </div>
            
            <div class="amount-box">
              <h3>💰 Refund Amount</h3>
              <h2 style="color: #28a745; font-size: 32px; margin: 10px 0;">₱${refundAmount.toFixed(2)}</h2>
              <p>This amount will be processed and returned to you</p>
            </div>
            
            <div class="bill-info">
              <h3>📋 Bill Summary</h3>
              <p><strong>Room:</strong> ${bill.room_number}</p>
              <p><strong>Final Bill Period:</strong> ${formatDate(bill.rent_from)} - ${formatDate(bill.rent_to)}</p>
              <p><strong>Total Bills Covered:</strong> ₱${bill.total_amount.toFixed(2)}</p>
              <p><strong>Your Deposits Applied:</strong> ₱${(bill.total_amount + refundAmount).toFixed(2)}</p>
              <p><strong>Refund Due:</strong> <span style="color: #28a745; font-weight: bold;">₱${refundAmount.toFixed(2)}</span></p>
            </div>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <h4>📋 What Happens Next?</h4>
              <ol>
                <li>Your bills have been automatically covered by your deposits</li>
                <li>The admin will process your refund</li>
                <li>You will be contacted for refund collection details</li>
                <li>Your move-out will be completed once the refund is processed</li>
              </ol>
            </div>
            
            <div style="background: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <h4>💡 Important Information</h4>
              <p>• No action required from you at this time</p>
              <p>• Your room contract is being processed for termination</p>
              <p>• Please wait for admin contact regarding refund collection</p>
              <p>• Keep this email for your records</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <p style="font-size: 18px; color: #28a745;"><strong>Thank you for being a valued tenant! 🏡</strong></p>
            </div>
          </div>
          
          <div class="footer">
            <p>This is an automated refund notification</p>
            <p>For questions, please contact: official.jhapartment@gmail.com</p>
            <p>J&H Apartment Management Team</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const textContent = `
Dear ${bill.tenant_name},

REFUND NOTIFICATION - MOVE OUT

Great news! After covering all your bills, you have a refund due from your deposits.

REFUND AMOUNT: ₱${refundAmount.toFixed(2)}

Bill Summary:
- Room: ${bill.room_number}
- Final Bill Period: ${formatDate(bill.rent_from)} - ${formatDate(bill.rent_to)}
- Total Bills Covered: ₱${bill.total_amount.toFixed(2)}
- Your Deposits Applied: ₱${(bill.total_amount + refundAmount).toFixed(2)}
- Refund Due: ₱${refundAmount.toFixed(2)}

What Happens Next:
1. Your bills have been automatically covered by your deposits
2. The admin will process your refund
3. You will be contacted for refund collection details
4. Your move-out will be completed once the refund is processed

Important Information:
• No action required from you at this time
• Your room contract is being processed for termination
• Please wait for admin contact regarding refund collection
• Keep this email for your records

Thank you for being a valued tenant!

Best regards,
J&H Apartment Management Team
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER || 'official.jhapartment@gmail.com',
      to: recipientEmail,
      subject: subject,
      text: textContent,
      html: htmlContent
    };

    const result = await transporter.sendMail(mailOptions);
    
    return {
      success: true,
      messageId: result.messageId,
      message: 'Refund notification email sent successfully'
    };
  } catch (error) {
    console.error('Refund notification email sending error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export default {
  sendBillToTenant,
  sendReceiptToTenant,
  testEmailConfig,
  generateBillHTML,
  sendWelcomeEmail,
  sendDepositReceiptEmail,
  sendContractExpiryNotification,
  sendDepartureEmail,
  sendMonthlyReport,
  sendBillingReminderToManagement,
  sendFinalBillToTenant,
  sendRefundNotificationEmail
}; 