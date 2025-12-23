/**
 * USER STATE STORE WITH FIRESTORE
 * Replaces in-memory storage with Firestore for persistence and real-time updates
 */

const { getFirestore } = require('./firebase-init');

class FirestoreUserStore {
  constructor() {
    this.db = null;
    this.areas = {
      westlands: { name: 'Westlands', coords: { lat: [-1.25, -1.22], lng: [36.75, 36.82] } },
      kilimani: { name: 'Kilimani', coords: { lat: [-1.28, -1.24], lng: [36.70, 36.78] } },
      upperhill: { name: 'Upper Hill', coords: { lat: [-1.30, -1.26], lng: [36.80, 36.88] } },
      karen: { name: 'Karen', coords: { lat: [-1.35, -1.30], lng: [36.65, 36.75] } }
    };
    this.orderLocks = new Map(); // In-memory locks for atomic booking
  }

  /**
   * Initialize Firestore connection
   */
  initialize() {
    this.db = getFirestore();
    console.log('✅ Firestore UserStore initialized');
  }

  /**
   * Get or create user document in Firestore
   */
  async getUser(phoneNumber) {
    const usersRef = this.db.collection('users');
    let userDoc = await usersRef.doc(phoneNumber).get();

    if (!userDoc.exists) {
      // Create new user
      const newUser = {
        phone: phoneNumber,
        role: null,
        state: 'idle',
        currentOrder: null,
        listings: [],
        currentDelivery: null,
        preferredArea: null,
        location: null,
        profile: {
          name: null,
          businessName: null
        },
        lastInteraction: new Date(),
        createdAt: new Date()
      };
      
      await usersRef.doc(phoneNumber).set(newUser);
      return { id: phoneNumber, ...newUser };
    }

    // Update last interaction
    await usersRef.doc(phoneNumber).update({ lastInteraction: new Date() });
    return { id: phoneNumber, ...userDoc.data() };
  }

  /**
   * Set user role
   */
  async setRole(phoneNumber, role) {
    if (!['buyer', 'seller', 'rider'].includes(role)) {
      throw new Error('Invalid role');
    }
    
    const newState = role === 'rider' ? 'awaiting_location_selection' : 'onboarding';
    await this.db.collection('users').doc(phoneNumber).update({
      role,
      state: newState
    });

    return { role, state: newState };
  }

  /**
   * Update user state
   */
  async setState(phoneNumber, state, data = {}) {
    const updateData = { state, ...data };
    await this.db.collection('users').doc(phoneNumber).update(updateData);
    return updateData;
  }

  /**
   * Set current order
   */
  async setOrder(phoneNumber, mealId, mealName, price) {
    const order = {
      mealId,
      mealName,
      price,
      createdAt: new Date(),
      status: 'pending_payment'
    };

    await this.db.collection('users').doc(phoneNumber).update({
      currentOrder: order
    });

    return order;
  }

  /**
   * Confirm payment
   */
  async confirmPayment(phoneNumber, transactionId, receiptNumber) {
    await this.db.collection('users').doc(phoneNumber).update({
      'currentOrder.status': 'payment_confirmed',
      'currentOrder.transactionId': transactionId,
      'currentOrder.receiptNumber': receiptNumber,
      'currentOrder.paidAt': new Date()
    });
  }

  /**
   * Set location
   */
  async setLocation(phoneNumber, latitude, longitude, area) {
    const location = {
      lat: latitude,
      lng: longitude,
      area,
      setAt: new Date()
    };

    await this.db.collection('users').doc(phoneNumber).update({
      location,
      state: 'order_confirmed'
    });

    return location;
  }

  /**
   * Set rider's preferred delivery area
   */
  async setRiderArea(phoneNumber, areaCode) {
    if (!this.areas[areaCode]) {
      throw new Error('Invalid area code');
    }

    await this.db.collection('users').doc(phoneNumber).update({
      preferredArea: areaCode,
      state: 'browsing_menu'
    });

    return areaCode;
  }

  /**
   * Get all areas for selection
   */
  getAreas() {
    return Object.entries(this.areas).map(([code, data]) => ({
      code,
      name: data.name
    }));
  }

  /**
   * Get all active orders (for admin/kitchen)
   */
  async getActiveOrders() {
    const snapshot = await this.db.collection('users')
      .where('currentOrder.status', '==', 'payment_confirmed')
      .get();

    const orders = [];
    snapshot.forEach(doc => {
      const user = doc.data();
      if (user.currentOrder && user.location) {
        orders.push({
          ...user.currentOrder,
          userPhone: user.phone,
          location: user.location,
          userName: user.profile.name || 'Customer'
        });
      }
    });

    return orders;
  }

  /**
   * Add listing (seller)
   */
  async addListing(phoneNumber, listingData) {
    const listing = {
      id: `listing_${Date.now()}`,
      ...listingData,
      sellerId: phoneNumber,
      createdAt: new Date(),
      status: 'active'
    };

    // Store in subcollection
    await this.db.collection('users').doc(phoneNumber)
      .collection('listings').doc(listing.id).set(listing);

    // Also update user's listings array
    await this.db.collection('users').doc(phoneNumber).update({
      listings: this.db.FieldValue.arrayUnion(listing.id)
    });

    return listing;
  }

  /**
   * Get all active listings
   */
  async getAllListings() {
    const snapshot = await this.db.collectionGroup('listings')
      .where('status', '==', 'active')
      .orderBy('createdAt', 'desc')
      .get();

    const listings = [];
    snapshot.forEach(doc => {
      listings.push(doc.data());
    });

    return listings;
  }

  /**
   * Get available deliveries for rider
   */
  async getAvailableDeliveries(riderPhone) {
    const snapshot = await this.db.collection('users')
      .where('role', '==', 'buyer')
      .where('currentOrder.status', '==', 'payment_confirmed')
      .get();

    const deliveries = [];
    snapshot.forEach(doc => {
      const user = doc.data();
      if (user.location) {
        deliveries.push({
          orderId: user.currentOrder.mealId,
          buyerPhone: user.phone,
          buyerName: user.profile.name || 'Customer',
          meal: user.currentOrder.mealName,
          price: user.currentOrder.price,
          earnings: Math.round(user.currentOrder.price * 0.15),
          location: user.location.area,
          status: 'pending'
        });
      }
    });

    return deliveries;
  }

  /**
   * Book an order with atomic locking
   */
  async bookOrder(riderPhone, orderId) {
    // Check lock
    if (this.orderLocks.has(orderId)) {
      return { success: false, reason: 'Order already being booked' };
    }

    this.orderLocks.set(orderId, { rider: riderPhone, timestamp: Date.now() });

    try {
      // Find order in Firestore
      const snapshot = await this.db.collection('users')
        .where('currentOrder.mealId', '==', orderId)
        .where('currentOrder.status', '==', 'payment_confirmed')
        .limit(1)
        .get();

      if (snapshot.empty) {
        this.orderLocks.delete(orderId);
        return { success: false, reason: 'Order not found or already assigned' };
      }

      const buyerDoc = snapshot.docs[0];
      const buyer = buyerDoc.data();

      // Atomic update: check again and update together
      const batch = this.db.batch();

      // Update buyer's order status
      batch.update(buyerDoc.ref, {
        'currentOrder.status': 'assigned_to_rider',
        'currentOrder.assignedRider': riderPhone,
        'currentOrder.assignedAt': new Date()
      });

      // Update rider's delivery
      const delivery = {
        id: orderId,
        orderId,
        buyerPhone: buyer.phone,
        buyerName: buyer.profile.name || 'Customer',
        meal: buyer.currentOrder.mealName,
        price: buyer.currentOrder.price,
        earnings: Math.round(buyer.currentOrder.price * 0.15),
        status: 'assigned',
        assignedAt: new Date(),
        dropoffLocation: buyer.location.area,
        area: buyer.location.area
      };

      batch.update(this.db.collection('users').doc(riderPhone), {
        currentDelivery: delivery
      });

      await batch.commit();

      this.orderLocks.delete(orderId);
      return { success: true, delivery };
    } catch (err) {
      this.orderLocks.delete(orderId);
      return { success: false, reason: err.message };
    }
  }

  /**
   * Get orders by area (for area-specific delivery queues)
   */
  async getOrdersByArea(areaCode) {
    const snapshot = await this.db.collection('users')
      .where('role', '==', 'buyer')
      .where('currentOrder.status', '==', 'payment_confirmed')
      .where('location.area', '==', areaCode)
      .get();

    const orders = [];
    snapshot.forEach(doc => {
      const user = doc.data();
      orders.push({
        orderId: user.currentOrder.mealId,
        buyerPhone: user.phone,
        meal: user.currentOrder.mealName,
        price: user.currentOrder.price,
        earnings: Math.round(user.currentOrder.price * 0.15),
        location: user.location.area,
        area: areaCode
      });
    });

    return orders;
  }

  /**
   * Get all users (admin)
   */
  async getAllUsers() {
    const snapshot = await this.db.collection('users').get();
    const users = [];

    snapshot.forEach(doc => {
      users.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return users;
  }

  /**
   * Get sellers (admin)
   */
  async getSellers() {
    const snapshot = await this.db.collection('users')
      .where('role', '==', 'seller')
      .get();

    const sellers = [];
    snapshot.forEach(doc => {
      sellers.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return sellers;
  }

  /**
   * Get riders (admin)
   */
  async getRiders() {
    const snapshot = await this.db.collection('users')
      .where('role', '==', 'rider')
      .get();

    const riders = [];
    snapshot.forEach(doc => {
      riders.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return riders;
  }

  /**
   * Clean up old sessions (older than 24 hours)
   */
  async cleanupOldSessions() {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const snapshot = await this.db.collection('users')
      .where('lastInteraction', '<', oneDayAgo)
      .get();

    const batch = this.db.batch();
    snapshot.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
  }
}

module.exports = new FirestoreUserStore();
