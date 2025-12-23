/**
 * ROHO MESSAGE TEMPLATES
 * All WhatsApp message payloads
 */

// ===== ONBOARDING: Role Selection =====

const createRoleSelectionMessage = (userPhone) => ({
  from: 'whatsapp:+14155238886',
  to: userPhone,
  body: 'Welcome to Roho. 🖤\n\nWhat are you here to do?\n\n1️⃣ BUY food (Customer)\n2️⃣ SELL food (Seller)\n3️⃣ DELIVER orders (Rider)'
});

// ===== BUYER ONBOARDING =====

const createBuyerWelcomeMessage = (userPhone) => ({
  from: 'whatsapp:+14155238886',
  to: userPhone,
  body: 'Great! Welcome to Roho as a buyer. 🍲\n\nWhat can I help you with?\n\n1️⃣ FOOD - Browse & order\n2️⃣ MIND - Wellness moment\n3️⃣ SUB - Weekly plan'
});

// ===== SELLER ONBOARDING =====

const createSellerWelcomeMessage = (userPhone) => ({
  from: 'whatsapp:+14155238886',
  to: userPhone,
  body: 'Welcome to Roho Sellers! 👨‍🍳\n\nShare your meals with the community.\n\nReply with your business name to get started.'
});

const createSellerMenuMessage = (userPhone) => ({
  from: 'whatsapp:+14155238886',
  to: userPhone,
  body: 'Seller Menu:\n\n1️⃣ POST a meal\n2️⃣ VIEW my listings\n3️⃣ EARNINGS\n4️⃣ HELP'
});

// ===== RIDER ONBOARDING =====

const createRiderWelcomeMessage = (userPhone) => ({
  from: 'whatsapp:+14155238886',
  to: userPhone,
  body: 'Welcome to Roho Riders! 🏍️\n\nEarn by delivering meals to corporates in Nairobi.\n\nReply with your name to activate.'
});

const createRiderMenuMessage = (userPhone) => ({
  from: 'whatsapp:+14155238886',
  to: userPhone,
  body: 'Rider Dashboard:\n\n1️⃣ AVAILABLE deliveries\n2️⃣ MY earnings\n3️⃣ ACTIVE delivery\n4️⃣ HELP'
});

const createRiderAreaSelectionMessage = (userPhone) => ({
  from: 'whatsapp:+14155238886',
  to: userPhone,
  body: 'Choose your delivery area:\n\n1️⃣ Westlands\n2️⃣ Kilimani\n3️⃣ Karen\n4️⃣ Upper Hill\n\nReply with the number of your preferred area.'
});

const createAreaConfirmMessage = (userPhone, areaName, groupLink) => ({
  from: 'whatsapp:+14155238886',
  to: userPhone,
  body: `Perfect! You're now set to deliver in ${areaName}. 📍\n\nJoin your delivery network:\n${groupLink}\n\nOrders in ${areaName} will be posted there. Reply "Book" to accept any order.`
});

// ===== SHARED MESSAGES =====

// Welcome Menu (Using Twilio Content Template with Buttons)
const createWelcomeMessage = (userPhone) => ({
  from: 'whatsapp:+14155238886',
  to: userPhone,
  contentSid: 'HX43d9c93ee1a134a0351c3585646f2326',
  contentVariables: JSON.stringify({
    "1": "🍲 Food",
    "2": "🧠 Mind",
    "3": "📅 Subscribe"
  })
});

// Food Menu (Text list)
const createFoodMenuMessage = (userPhone) => ({
  from: 'whatsapp:+14155238886',
  to: userPhone,
  body: 'Our kitchen is open. 🖤\n\n1️⃣ The Grounding Bowl - KES 550\n2️⃣ The Clarity Kit - KES 450\n3️⃣ The Detox (Vegan) - KES 400\n\nReply with number to order.'
});

// Mind Moment Reply
const createMindMomentMessage = (userPhone) => ({
  from: 'whatsapp:+14155238886',
  to: userPhone,
  body: 'Take a deep breath. Inhale for 4 seconds. Hold for 4. Exhale for 4.\n\nThe work will be there when you are done. 🖤'
});

// Subscription Info
const createSubscriptionMessage = (userPhone) => ({
  from: 'whatsapp:+14155238886',
  to: userPhone,
  body: 'Your Subscription Plan:\n\n📅 Weekly Plan (5 Days) - KES 2,250\nNext delivery: Tomorrow, 8:00 AM\nStatus: Active ✓\n\nReply "Cancel" to stop or "Help" to chat.'
});

// Order Confirmation with M-PESA prompt
const createOrderConfirmMessage = (userPhone, mealName, price) => ({
  from: 'whatsapp:+14155238886',
  to: userPhone,
  body: `Excellent choice. ${mealName} (KES ${price}).\n\nI have sent an M-PESA prompt to your phone.\n\nOnce paid, please share your location (tap the attachment icon, then "Location").\n\nDelivery to Westlands/Kilimani: 45 mins.`
});

// Payment Confirmation
const createPaymentConfirmMessage = (userPhone, transactionId, mealName) => ({
  from: 'whatsapp:+14155238886',
  to: userPhone,
  body: `Payment confirmed! ✓\n\nTransaction ID: ${transactionId}\nMeal: ${mealName}\n\nYour order is being prepared. You'll get a delivery update soon.`
});

// Payment Failed
const createPaymentFailedMessage = (userPhone) => ({
  from: 'whatsapp:+14155238886',
  to: userPhone,
  body: 'Payment could not be processed.\n\nPlease check your M-PESA balance and try again. Reply "Retry" when ready.'
});

// Location Received
const createLocationConfirmMessage = (userPhone, area) => ({
  from: 'whatsapp:+14155238886',
  to: userPhone,
  body: `Got it. I see you in ${area}.\n\nDelivery window: 12:00 PM - 12:45 PM\n\nI'll send a driver update 15 minutes before arrival.`
});

module.exports = {
  // Onboarding
  createRoleSelectionMessage,
  createBuyerWelcomeMessage,
  createSellerWelcomeMessage,
  createSellerMenuMessage,
  createRiderWelcomeMessage,
  createRiderMenuMessage,
  createRiderAreaSelectionMessage,
  createAreaConfirmMessage,
  // Shared
  createWelcomeMessage,
  createFoodMenuMessage,
  createMindMomentMessage,
  createSubscriptionMessage,
  createOrderConfirmMessage,
  createPaymentConfirmMessage,
  createPaymentFailedMessage,
  createLocationConfirmMessage
};
