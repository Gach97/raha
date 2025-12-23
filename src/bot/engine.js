/**
 * Bot Engine
 * 
 * Main logic handler for Roho WhatsApp chatbot.
 * Implements a state machine with transitions between user journey steps.
 * 
 * State Flow:
 *   WELCOME
 *     ↓ [Order Lunch]
 *   SELECTING_FOOD (show menu list)
 *     ↓ [select meal]
 *   CONFIRM_ORDER (confirm meal + ask location)
 *     ↓ [enter location]
 *   PAYMENT (M-PESA prompt)
 *     ↓ [confirm]
 *   ORDER_COMPLETE (success)
 * 
 * Features:
 * - Free Delivery promo code (BRITAM_GRP)
 * - Kitchen notification logging
 * - Fallback for text-based input
 */

const { db } = require('../config/firebase');
const {
  getWelcomeButtons,
  getMenuListMessage,
  getConfirmOrderMessage,
  getPaymentPrompt,
  getOrderConfirmation,
  getTextMessage,
  getPromoAppliedMessage,
  getErrorMessage,
} = require('./templates');
const {
  getUserState,
  updateUserState,
  getSessionData,
  mergeSessionData,
} = require('../services/stateService');
const {
  addToRiderQueue,
} = require('../services/riderService');
const {
  assignGroupToOrder,
  createOrderQueueEntry,
} = require('../services/riderService');

/**
 * Process incoming WhatsApp message and route to appropriate handler
 * @param {string} from - Sender's WhatsApp number
 * @param {string} message - Message text or button ID
 * @param {object} incomingMessage - Full message object from Twilio
 * @returns {Promise<object>} - Message to send back to user
 */
async function handleMessage(from, message, incomingMessage = {}) {
  try {
    // Get user's current state
    const currentState = await getUserState(from);
    const userStep = currentState.step;

    console.log(`[BotEngine] ${from} at step: ${userStep}, input: ${message}`);

    // Check for promo codes (override state machine)
    if (isPromoCode(message)) {
      await applyPromo(from, message);
      return getPromoAppliedMessage(message);
    }

    // Route to appropriate handler based on current state
    switch (userStep) {
      case 'WELCOME':
        return await handleWelcome(from, message);

      case 'SELECTING_FOOD':
        return await handleFoodSelection(from, message);

      case 'CONFIRM_ORDER':
        return await handleConfirmOrder(from, message);

      case 'PAYMENT':
        return await handlePayment(from, message);

      case 'ORDER_COMPLETE':
        // Offer to order again or view account
        await updateUserState(from, 'WELCOME');
        return getWelcomeButtons();

      default:
        console.warn(`[BotEngine] Unknown state: ${userStep}`);
        await updateUserState(from, 'WELCOME');
        return getWelcomeButtons();
    }
  } catch (error) {
    console.error(`[BotEngine] Error processing message from ${from}:`, error);
    return getErrorMessage();
  }
}

/**
 * WELCOME state handler
 * User sees options: "1 = Order" or "2 = Account"
 */
async function handleWelcome(from, message) {
  const action = message.toLowerCase().trim();

  // Accept "1", "order", or button ID
  if (action === '1' || action.includes('order')) {
    // Transition to SELECTING_FOOD state
    await updateUserState(from, 'SELECTING_FOOD', { cart: {} });
    return getMenuListMessage();
  }

  // Accept "2", "account", or button ID
  if (action === '2' || action.includes('account')) {
    // TODO: Show subscription or order history
    return getTextMessage(
      'Your account info coming soon. For now, let\'s order lunch.\n\nReply: 1 to Order Lunch'
    );
  }

  // If user types something else, show welcome again
  return getWelcomeButtons();
}

/**
 * SELECTING_FOOD state handler
 * User picks a meal: 1, 2, or 3 (or meal_name)
 */
async function handleFoodSelection(from, message) {
  const input = message.toLowerCase().trim();

  const meals = {
    '1': { id: 'meal_beef_mukimo', name: 'Beef & Mukimo', price: 320 },
    '2': { id: 'meal_chicken', name: 'Kienyeji Chicken', price: 320 },
    '3': { id: 'meal_vegan', name: 'Vegan Bowl', price: 320 },
    'meal_beef_mukimo': { id: 'meal_beef_mukimo', name: 'Beef & Mukimo', price: 320 },
    'meal_chicken': { id: 'meal_chicken', name: 'Kienyeji Chicken', price: 320 },
    'meal_vegan': { id: 'meal_vegan', name: 'Vegan Bowl', price: 320 },
  };

  const selectedMeal = meals[input];
  
  if (!selectedMeal) {
    // Invalid selection, re-show menu
    return getMenuListMessage();
  }

  // Save meal selection to session
  await mergeSessionData(from, {
    selectedMeal: selectedMeal.id,
    mealName: selectedMeal.name,
    price: selectedMeal.price,
  });

  // Transition to CONFIRM_ORDER state
  await updateUserState(from, 'CONFIRM_ORDER');

  return getConfirmOrderMessage(selectedMeal.name, selectedMeal.price);
}

/**
 * CONFIRM_ORDER state handler
 * User enters delivery location
 */
async function handleConfirmOrder(from, message) {
  const location = message.trim();

  if (!location || location.length < 3) {
    return getTextMessage('Please enter a valid office building or location.');
  }

  // Save location to session
  await mergeSessionData(from, { location: location });

  // Transition to PAYMENT state
  await updateUserState(from, 'PAYMENT');

  // Get meal info for payment prompt
  const sessionData = await getSessionData(from);
  const mealName = sessionData.mealName || 'Your meal';
  const price = sessionData.price || 320;

  return getPaymentPrompt(mealName, price);
}

/**
 * PAYMENT state handler
 * User confirms M-PESA payment or cancels
 */
async function handlePayment(from, message) {
  const action = message.toLowerCase().trim();

  if (action === 'confirm' || action === '✅' || action.includes('confirm')) {
    // Create order in Firestore
    const orderId = await createOrder(from);

    // Transition to ORDER_COMPLETE
    await updateUserState(from, 'ORDER_COMPLETE');

    // Notify kitchen (mock)
    await notifyKitchen(orderId, from);

    // Get session data for confirmation
    const sessionData = await getSessionData(from);
    const mealName = sessionData.mealName || 'Your meal';
    const location = sessionData.location || 'Your location';
    const price = sessionData.price || 320;

    return getOrderConfirmation(orderId, mealName, location, price);
  }

  if (action === 'cancel' || action === '❌' || action.includes('cancel')) {
    // Reset to welcome
    await updateUserState(from, 'WELCOME');
    return getTextMessage('Order cancelled. Ready for lunch? Reply: 1 to Order Lunch');
  }

  // Unclear input, re-show payment prompt
  const sessionData = await getSessionData(from);
  const mealName = sessionData.mealName || 'Your meal';
  const price = sessionData.price || 320;
  return getPaymentPrompt(mealName, price);
}

/**
 * Check if user typed a valid promo code
 * Example: BRITAM_GRP → Free Delivery
 */
function isPromoCode(message) {
  const validPromos = ['britam_grp', 'roho_free', 'nairobitech'];
  return validPromos.includes(message.toLowerCase().trim());
}

/**
 * Apply promo code to user session
 */
async function applyPromo(phone, promoCode) {
  await mergeSessionData(phone, {
    promoCode: promoCode.toUpperCase(),
    freeDelivery: true,
  });
  console.log(`[BotEngine] Applied promo ${promoCode} to ${phone}`);
}

/**
 * Create order in Firestore and add to rider queue
 * Persists order for order history and rider assignment (simple landmark-based)
 */
async function createOrder(phone) {
  try {
    const sessionData = await getSessionData(phone);
    const orderId = `ORD-${Date.now()}`;

    const orderData = {
      orderId: orderId,
      phone: phone,
      mealName: sessionData.mealName,
      mealId: sessionData.selectedMeal,
      location: sessionData.location,
      price: sessionData.price,
      promoCode: sessionData.promoCode || null,
      freeDelivery: sessionData.freeDelivery || false,
      status: 'pending_booking', // pending_booking → booked → in_transit → delivered
      createdAt: new Date().toISOString(),
      createdAtTimestamp: Date.now(),
    };

    // Save to Firestore under /orders/{orderId}
    await db.collection('orders').doc(orderId).set(orderData);

    // Add to rider queue (simple: just location landmark)
    await addToRiderQueue(orderId, orderData);

    console.log(`[BotEngine] Created order ${orderId} for ${phone}, added to rider queue`);
    return orderId;
  } catch (error) {
    console.error(`[BotEngine] Error creating order for ${phone}:`, error);
    throw error;
  }
}

/**
 * Notify kitchen about new order (mock implementation)
 * In production, send to Kitchen Admin via WhatsApp or PubSub
 */
async function notifyKitchen(orderId, customerPhone) {
  try {
    const sessionData = await getSessionData(customerPhone);

    const notification = {
      orderId: orderId,
      customerPhone: customerPhone,
      mealName: sessionData.mealName,
      mealId: sessionData.selectedMeal,
      location: sessionData.location,
      timestamp: new Date().toISOString(),
      status: 'new',
    };

    // Log to Firestore under /kitchen_notifications/{timestamp}
    await db
      .collection('kitchen_notifications')
      .doc(orderId)
      .set(notification);

    // TODO: In production, call sendMessage() to Kitchen Admin WhatsApp number
    console.log(`[BotEngine] Kitchen notified about order ${orderId}`);
  } catch (error) {
    console.error(`[BotEngine] Error notifying kitchen:`, error);
  }
}

module.exports = {
  handleMessage,
};
