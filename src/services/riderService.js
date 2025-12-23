/**
 * Rider Service - Simple Landmark-Based Delivery
 * 
 * Manages rider bookings, status tracking, and payment release.
 * No GPS/complex routing. Just landmarks (text).
 * 
 * Collections:
 * - /rider_queue/{orderId} - Pending rider bookings
 * - /rider_bookings/{bookingId} - Active bookings with status
 * - /rider_payments/{bookingId} - Payment tracking (held → released)
 */

const { db } = require('../config/firebase');

/**
 * Add order to rider queue waiting for booking
 * @param {string} orderId - Order ID
 * @param {object} orderData - Order details (mealName, location, price, etc.)
 * @returns {Promise<string>} - Queue entry ID
 */
async function addToRiderQueue(orderId, orderData) {
  try {
    const queueEntry = {
      orderId: orderId,
      customerPhone: orderData.phone,
      mealName: orderData.mealName,
      location: orderData.location, // Simple text: "Britam Tower", "Safari Park", etc.
      price: orderData.price,
      createdAt: new Date().toISOString(),
      status: 'pending_booking', // waiting for rider
    };

    await db.collection('rider_queue').doc(orderId).set(queueEntry);
    console.log(`[RiderService] Order ${orderId} added to queue for ${orderData.location}`);
    return orderId;
  } catch (error) {
    console.error(`[RiderService] Error adding to queue:`, error);
    throw error;
  }
}

/**
 * Get all pending orders in queue
 * @returns {Promise<array>} - Array of pending orders
 */
async function getPendingOrders() {
  try {
    const snapshot = await db
      .collection('rider_queue')
      .where('status', '==', 'pending_booking')
      .get();

    const orders = [];
    snapshot.forEach((doc) => {
      orders.push({
        orderId: doc.id,
        ...doc.data(),
      });
    });

    return orders;
  } catch (error) {
    console.error(`[RiderService] Error fetching pending orders:`, error);
    return [];
  }
}

/**
 * Rider books an order
 * @param {string} riderId - Rider's phone number
 * @param {string} orderId - Order ID to book
 * @returns {Promise<string>} - Booking ID
 */
async function bookOrder(riderId, orderId) {
  try {
    // Check if order exists and is still pending
    const orderDoc = await db.collection('rider_queue').doc(orderId).get();
    if (!orderDoc.exists || orderDoc.data().status !== 'pending_booking') {
      throw new Error('Order not available for booking');
    }

    const orderData = orderDoc.data();
    const bookingId = `BOOK-${Date.now()}`;

    // Create booking record
    const booking = {
      bookingId: bookingId,
      orderId: orderId,
      riderId: riderId,
      customerPhone: orderData.customerPhone,
      mealName: orderData.mealName,
      location: orderData.location,
      price: orderData.price,
      status: 'booked', // rider has claimed it
      bookedAt: new Date().toISOString(),
      pickedUpAt: null,
      deliveredAt: null,
    };

    await db.collection('rider_bookings').doc(bookingId).set(booking);

    // Update queue status to booked
    await db.collection('rider_queue').doc(orderId).update({
      status: 'booked',
      bookingId: bookingId,
      riderId: riderId,
    });

    // Create payment hold record
    await db.collection('rider_payments').doc(bookingId).set({
      bookingId: bookingId,
      orderId: orderId,
      riderId: riderId,
      amount: orderData.price,
      status: 'held', // funds held until delivery confirmed
      createdAt: new Date().toISOString(),
      releasedAt: null,
    });

    console.log(`[RiderService] Rider ${riderId} booked order ${orderId} as ${bookingId}`);
    return bookingId;
  } catch (error) {
    console.error(`[RiderService] Error booking order:`, error);
    throw error;
  }
}

/**
 * Confirm rider picked up order
 * @param {string} bookingId - Booking ID
 * @returns {Promise<void>}
 */
async function confirmPickup(bookingId) {
  try {
    const now = new Date().toISOString();

    await db.collection('rider_bookings').doc(bookingId).update({
      status: 'in_transit',
      pickedUpAt: now,
    });

    console.log(`[RiderService] Order ${bookingId} picked up, in transit`);
  } catch (error) {
    console.error(`[RiderService] Error confirming pickup:`, error);
    throw error;
  }
}

/**
 * Confirm delivery complete & release funds
 * @param {string} bookingId - Booking ID
 * @returns {Promise<void>}
 */
async function confirmDelivery(bookingId) {
  try {
    const now = new Date().toISOString();

    // Update booking status
    await db.collection('rider_bookings').doc(bookingId).update({
      status: 'delivered',
      deliveredAt: now,
    });

    // Release payment to rider
    await db.collection('rider_payments').doc(bookingId).update({
      status: 'released',
      releasedAt: now,
    });

    console.log(`[RiderService] Delivery confirmed for ${bookingId}, funds released`);
  } catch (error) {
    console.error(`[RiderService] Error confirming delivery:`, error);
    throw error;
  }
}

/**
 * Get rider's active bookings
 * @param {string} riderId - Rider's phone number
 * @returns {Promise<array>} - Array of active bookings
 */
async function getRiderBookings(riderId) {
  try {
    const snapshot = await db
      .collection('rider_bookings')
      .where('riderId', '==', riderId)
      .where('status', 'in', ['booked', 'in_transit'])
      .get();

    const bookings = [];
    snapshot.forEach((doc) => {
      bookings.push({
        bookingId: doc.id,
        ...doc.data(),
      });
    });

    return bookings;
  } catch (error) {
    console.error(`[RiderService] Error fetching rider bookings:`, error);
    return [];
  }
}

/**
 * Get payment status for a booking
 * @param {string} bookingId - Booking ID
 * @returns {Promise<object>} - Payment record
 */
async function getPaymentStatus(bookingId) {
  try {
    const doc = await db.collection('rider_payments').doc(bookingId).get();
    if (!doc.exists) {
      throw new Error('Payment record not found');
    }
    return doc.data();
  } catch (error) {
    console.error(`[RiderService] Error fetching payment:`, error);
    throw error;
  }
}

/**
 * Check if a phone number is a registered rider
 * @param {string} phone - Phone number (format: "whatsapp:+254...")
 * @returns {Promise<boolean>} - True if registered rider
 */
async function isRegisteredRider(phone) {
  try {
    const riderDoc = await db.collection('riders').doc(phone).get();
    return riderDoc.exists;
  } catch (error) {
    console.error(`[RiderService] Error checking rider status:`, error);
    return false;
  }
}

module.exports = {
  addToRiderQueue,
  getPendingOrders,
  bookOrder,
  confirmPickup,
  confirmDelivery,
  getRiderBookings,
  getPaymentStatus,
  isRegisteredRider,
};
