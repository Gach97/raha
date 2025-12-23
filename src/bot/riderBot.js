/**
 * Rider Bot Interface
 * 
 * Handles rider WhatsApp interactions:
 * - View pending orders in queue
 * - Book an order
 * - Confirm pickup
 * - Confirm delivery (releases funds)
 * 
 * Simple flow: Rider sends commands like:
 * "orders" → Lists pending orders
 * "book ORD-123" → Books order
 * "pickup BOOK-456" → Confirms pickup
 * "delivered BOOK-456" → Confirms delivery
 */

const {
  getPendingOrders,
  bookOrder,
  confirmPickup,
  confirmDelivery,
  getRiderBookings,
  getPaymentStatus,
} = require('../services/riderService');
const { getTextMessage } = require('./templates');
const { db } = require('../config/firebase');

/**
 * Handle rider commands
 * @param {string} riderId - Rider's phone number
 * @param {string} command - Command text (e.g., "orders", "book ORD-123", etc.)
 * @returns {Promise<object>} - Response message
 */
async function handleRiderCommand(riderId, command) {
  try {
    const input = command.toLowerCase().trim();
    const parts = input.split(' ');
    const action = parts[0];

    console.log(`[RiderBot] ${riderId} issued command: ${command}`);

    switch (action) {
      case 'orders':
        return await listPendingOrders();

      case 'book':
        if (parts.length < 2) {
          return getTextMessage('Usage: book ORD-12345');
        }
        return await handleBookOrder(riderId, parts[1]);

      case 'pickup':
        if (parts.length < 2) {
          return getTextMessage('Usage: pickup BOOK-12345');
        }
        return await handlePickup(riderId, parts[1]);

      case 'delivered':
        if (parts.length < 2) {
          return getTextMessage('Usage: delivered BOOK-12345');
        }
        return await handleDeliveryConfirm(riderId, parts[1]);

      case 'myorders':
        return await listRiderActiveOrders(riderId);

      case 'payment':
        if (parts.length < 2) {
          return getTextMessage('Usage: payment BOOK-12345');
        }
        return await checkPaymentStatus(parts[1]);

      default:
        return getTextMessage(
          'Rider commands:\n\n📋 orders - View pending orders\n📦 book ORD-123 - Book an order\n🚚 pickup BOOK-123 - Confirm pickup\n✅ delivered BOOK-123 - Confirm delivery & release funds\n💰 payment BOOK-123 - Check payment status\n📊 myorders - Your active orders'
        );
    }
  } catch (error) {
    console.error(`[RiderBot] Error processing command:`, error);
    return getTextMessage('Error processing command. Try again.');
  }
}

/**
 * List all pending orders in queue
 */
async function listPendingOrders() {
  try {
    const orders = await getPendingOrders();

    if (orders.length === 0) {
      return getTextMessage('No pending orders at the moment.');
    }

    let response = `📋 *${orders.length} Pending Orders*:\n\n`;

    orders.forEach((order, idx) => {
      response += `${idx + 1}. *${order.mealName}*\n   📍 ${order.location}\n   💵 KES ${order.price}\n   ID: ${order.orderId}\n\n`;
    });

    response += 'Reply: book ORD-12345 to claim an order';
    return getTextMessage(response);
  } catch (error) {
    console.error(`[RiderBot] Error listing orders:`, error);
    return getTextMessage('Error fetching orders.');
  }
}

/**
 * Rider books an order
 */
async function handleBookOrder(riderId, orderId) {
  try {
    const bookingId = await bookOrder(riderId, orderId);

    return getTextMessage(
      `✅ Order booked!\n\nBooking ID: ${bookingId}\n\nNext:\nReply "pickup ${bookingId}" when ready for pickup`
    );
  } catch (error) {
    console.error(`[RiderBot] Error booking order:`, error);
    return getTextMessage(`Error: ${error.message}`);
  }
}

/**
 * Rider confirms pickup
 */
async function handlePickup(riderId, bookingId) {
  try {
    // Verify rider owns this booking
    const booking = await db.collection('rider_bookings').doc(bookingId).get();
    if (!booking.exists || booking.data().riderId !== riderId) {
      return getTextMessage('Booking not found or not yours.');
    }

    await confirmPickup(bookingId);

    return getTextMessage(
      `🚚 Picked up!\n\nDelivering to: ${booking.data().location}\n\nReply "delivered ${bookingId}" when customer receives order`
    );
  } catch (error) {
    console.error(`[RiderBot] Error confirming pickup:`, error);
    return getTextMessage(`Error: ${error.message}`);
  }
}

/**
 * Rider confirms delivery (funds released)
 */
async function handleDeliveryConfirm(riderId, bookingId) {
  try {
    // Verify rider owns this booking
    const booking = await db.collection('rider_bookings').doc(bookingId).get();
    if (!booking.exists || booking.data().riderId !== riderId) {
      return getTextMessage('Booking not found or not yours.');
    }

    await confirmDelivery(bookingId);

    const amount = booking.data().price;
    return getTextMessage(
      `✅ Delivery confirmed!\n\n💰 Funds Released: KES ${amount}\n\nThank you for the delivery!`
    );
  } catch (error) {
    console.error(`[RiderBot] Error confirming delivery:`, error);
    return getTextMessage(`Error: ${error.message}`);
  }
}

/**
 * List rider's active orders
 */
async function listRiderActiveOrders(riderId) {
  try {
    const bookings = await getRiderBookings(riderId);

    if (bookings.length === 0) {
      return getTextMessage('No active bookings. Reply "orders" to see pending.');
    }

    let response = `📊 *Your Active Bookings*:\n\n`;

    bookings.forEach((booking, idx) => {
      response += `${idx + 1}. *${booking.mealName}*\n   📍 ${booking.location}\n   💵 KES ${booking.price}\n   Status: ${booking.status}\n   ID: ${booking.bookingId}\n\n`;
    });

    return getTextMessage(response);
  } catch (error) {
    console.error(`[RiderBot] Error listing active orders:`, error);
    return getTextMessage('Error fetching your orders.');
  }
}

/**
 * Check payment status for a booking
 */
async function checkPaymentStatus(bookingId) {
  try {
    const payment = await getPaymentStatus(bookingId);

    return getTextMessage(
      `💰 *Payment Status*\n\nBooking: ${bookingId}\nAmount: KES ${payment.amount}\nStatus: ${payment.status}\n\nStatus: held = waiting for delivery | released = available to withdraw`
    );
  } catch (error) {
    console.error(`[RiderBot] Error checking payment:`, error);
    return getTextMessage(`Error: ${error.message}`);
  }
}

module.exports = {
  handleRiderCommand,
};
