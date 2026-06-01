// ============ EMAILJS SERVICE ============
// Email yuborish uchun service

// Initialize EmailJS
emailjs.init("fp-X7abpJln5GCQQ9");

// ============ EMAIL SENDING FUNCTION ============
function sendEmail(data) {
  return emailjs.send(
    "service_18jc58k",
    "template_dymtbr8",
    data
  );
}

// ============ PROMOTION EMAIL FUNCTION ============
function sendPromotionEmail(customerEmail, title, message, imageUrl) {
  const emailData = {
    to_email: customerEmail,
    title: title,
    message: message,
    image: imageUrl
  };
  
  return sendEmail(emailData);
}

// ============ BULK EMAIL SENDING ============
async function sendBulkPromotion(title, message, imageUrl) {
  const customers = JSON.parse(localStorage.getItem("customers") || "[]");
  
  if (customers.length === 0) {
    console.log('❌ No customers found');
    return { success: false, message: 'Mijozlar topilmadi' };
  }
  
  let sentCount = 0;
  let errorCount = 0;
  const results = [];
  
  for (const customer of customers) {
    if (!customer.email) {
      console.log('⚠️ Customer without email:', customer);
      continue;
    }
    
    try {
      await sendPromotionEmail(customer.email, title, message, imageUrl);
      sentCount++;
      results.push({ email: customer.email, status: 'success' });
      console.log(`✅ Email sent to: ${customer.email}`);
    } catch (error) {
      errorCount++;
      results.push({ email: customer.email, status: 'error', error: error.message });
      console.error(`❌ Error sending to ${customer.email}:`, error);
    }
    
    // Small delay between emails to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return {
    success: true,
    total: customers.length,
    sent: sentCount,
    errors: errorCount,
    results: results
  };
}

// ============ GLOBAL EXPORT ============
window.EmailService = {
  sendEmail,
  sendPromotionEmail,
  sendBulkPromotion
};

console.log('📧 EmailJS Service Loaded');
