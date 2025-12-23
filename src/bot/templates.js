/**
 * Twilio WhatsApp Message Templates
 * 
 * Constructs JSON payloads for Twilio WhatsApp API via Node SDK.
 * For MVP, uses text-based messages with clear instructions.
 * 
 * Roho Persona: Stoic, minimalist, caring. Sells "Fuel," not just "Food."
 */

/**
 * Welcome message with action options
 * For MVP: text-based with numbered options
 */
function getWelcomeButtons() {
  return {
    type: 'text',
    text: 'Roho. Fuel for your day.\n\nReply:\n1️⃣ Order Lunch\n2️⃣ My Account',
  };
}

/**
 * Menu list message with 3 meal options
 * For MVP: numbered text response
 */
function getMenuListMessage() {
  return {
    type: 'text',
    text: "Today's fuel options:\n\n1️⃣ *Beef & Mukimo* - Nyama choma, soft maize. Protein + carbs. KES 320\n\n2️⃣ *Kienyeji Chicken* - Free-range chicken, kales, ugali. Pure fuel. KES 320\n\n3️⃣ *Vegan Bowl* - Beans, greens, avocado, whole grains. Balance. KES 320\n\nReply with 1, 2, or 3",
  };
}

/**
 * Confirmation message for selected meal
 * Asks for delivery location
 */
function getConfirmOrderMessage(mealName, price = 320) {
  return {
    type: 'text',
    text: `You chose: *${mealName}*\nPrice: KES ${price}\n\nWhere should we deliver? (Enter office building or location)`,
  };
}

/**
 * Payment/M-PESA prompt (simulated for MVP)
 * Shown in PAYMENT state
 */
function getPaymentPrompt(mealName, price = 320) {
  return {
    type: 'text',
    text: `Final check:\n\n*${mealName}*\nKES ${price}\n\nWe'll send an M-PESA prompt to your number.\n\nReply:\n✅ Confirm\n❌ Cancel`,
  };
}

/**
 * Success/Order confirmation message
 */
function getOrderConfirmation(orderId, mealName, location, price = 320) {
  return {
    type: 'text',
    text: `✓ Order placed.\n\nID: ${orderId}\n${mealName}\nDeliver to: ${location}\nKES ${price}\n\nLunch ready by 1 PM. Roho delivers.`,
  };
}

/**
 * Generic text message (Roho tone)
 */
function getTextMessage(text) {
  return {
    type: 'text',
    text: text,
  };
}

/**
 * Promo code applied message
 */
function getPromoAppliedMessage(promoCode) {
  return {
    type: 'text',
    text: `Promo *${promoCode}* applied.\nFree delivery on your order.`,
  };
}

/**
 * Error/fallback message
 */
function getErrorMessage() {
  return {
    type: 'text',
    text: 'Something went wrong. Try again or type "Hi" to restart.',
  };
}

module.exports = {
  getWelcomeButtons,
  getMenuListMessage,
  getConfirmOrderMessage,
  getPaymentPrompt,
  getOrderConfirmation,
  getTextMessage,
  getPromoAppliedMessage,
  getErrorMessage,
};
