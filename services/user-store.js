/**
 * USER STATE STORE
 * Simple in-memory store for user sessions (use Redis/DB in production)
 */

class UserStore {
  constructor() {
    this.users = new Map();
    this.orders = new Map(); // Track all orders for booking
    this.orderLocks = new Map(); // Prevent race conditions on booking
    
    // Define service areas
    this.areas = {
      westlands: { name: 'Westlands', coords: { lat: [-1.25, -1.22], lng: [36.75, 36.82] } },
      kilimani: { name: 'Kilimani', coords: { lat: [-1.28, -1.24], lng: [36.70, 36.78] } },
      upperhill: { name: 'Upper Hill', coords: { lat: [-1.30, -1.26], lng: [36.80, 36.88] } },
      karen: { name: 'Karen', coords: { lat: [-1.35, -1.30], lng: [36.65, 36.75] } }
    };
  }

  // Get or create user session
  getUser(phoneNumber) {
    if (!this.users.has(phoneNumber)) {
      this.users.set(phoneNumber, {
        phone: phoneNumber,
        role: null, // 'buyer', 'seller', 'rider'
        state: 'idle', // idle, onboarding, awaiting_location_selection, browsing_menu, etc.
        currentOrder: null,
        listings: [], // For sellers: their posted listings
        currentDelivery: null, // For riders: active delivery
        preferredArea: null, // For riders: which area they deliver in
        location: null, // { lat, lng, address, area }
        profile: {
          name: null,
          businessName: null // For sellers
        },
        lastInteraction: new Date(),
        createdAt: new Date()
      });
    }
    
    const user = this.users.get(phoneNumber);
    user.lastInteraction = new Date();
    return user;
  }

  // Set user role
  setRole(phoneNumber, role) {
    // role must be 'buyer', 'seller', or 'rider'
    if (!['buyer', 'seller', 'rider'].includes(role)) {
      throw new Error('Invalid role');
    }
    const user = this.getUser(phoneNumber);
    user.role = role;
    user.state = role === 'rider' ? 'awaiting_location_selection' : 'onboarding'; // Riders choose location
    return user;
  }

  // ===== RIDER-SPECIFIC METHODS =====

  // Set rider's preferred delivery area
  setRiderArea(phoneNumber, areaCode) {
    const user = this.getUser(phoneNumber);
    if (!this.areas[areaCode]) {
      throw new Error('Invalid area code');
    }
    user.preferredArea = areaCode;
    user.state = 'browsing_menu';
    return user;
  }

  // Get all areas for selection
  getAreas() {
    return Object.entries(this.areas).map(([code, data]) => ({
      code,
      name: data.name
    }));
  }

  // Update user state
  setState(phoneNumber, state, data = {}) {
    const user = this.getUser(phoneNumber);
    user.state = state;
    Object.assign(user, data);
    return user;
  }

  // Set current order
  setOrder(phoneNumber, mealId, mealName, price) {
    const user = this.getUser(phoneNumber);
    user.currentOrder = {
      mealId,
      mealName,
      price,
      createdAt: new Date(),
      status: 'pending_payment'
    };
    return user;
  }

  // Confirm payment
  confirmPayment(phoneNumber, transactionId, receiptNumber) {
    const user = this.getUser(phoneNumber);
    if (user.currentOrder) {
      user.currentOrder.status = 'payment_confirmed';
      user.currentOrder.transactionId = transactionId;
      user.currentOrder.receiptNumber = receiptNumber;
      user.currentOrder.paidAt = new Date();
    }
    return user;
  }

  // Set location
  setLocation(phoneNumber, latitude, longitude, address) {
    const user = this.getUser(phoneNumber);
    user.location = {
      lat: latitude,
      lng: longitude,
      address: address,
      setAt: new Date()
    };
    user.state = 'order_confirmed';
    return user;
  }

  // Get all active orders (for admin/kitchen)
  getActiveOrders() {
    const orders = [];
    this.users.forEach(user => {
      if (user.currentOrder && user.currentOrder.status === 'payment_confirmed') {
        orders.push({
          ...user.currentOrder,
          userPhone: user.phone,
          location: user.location
        });
      }
    });
    return orders;
  }

  // ===== SELLER METHODS =====

  // Add food listing (seller)
  addListing(phoneNumber, listingData) {
    const user = this.getUser(phoneNumber);
    const listing = {
      id: `listing_${Date.now()}`,
      ...listingData,
      sellerId: phoneNumber,
      createdAt: new Date(),
      status: 'active' // active, paused, sold
    };
    user.listings.push(listing);
    return listing;
  }

  // Get all active listings from all sellers
  getAllListings() {
    const listings = [];
    this.users.forEach(user => {
      if (user.role === 'seller' && user.listings.length > 0) {
        const activeListings = user.listings.filter(l => l.status === 'active');
        listings.push(...activeListings);
      }
    });
    return listings;
  }

  // ===== RIDER METHODS =====

  // Assign delivery to rider
  assignDelivery(riderPhone, deliveryData) {
    const rider = this.getUser(riderPhone);
    if (rider.role !== 'rider') {
      throw new Error('User is not a rider');
    }
    rider.currentDelivery = {
      id: `delivery_${Date.now()}`,
      ...deliveryData,
      riderId: riderPhone,
      status: 'assigned', // assigned, picked_up, in_transit, delivered
      assignedAt: new Date()
    };
    return rider.currentDelivery;
  }

  // Get available deliveries for rider (based on location)
  getAvailableDeliveries(riderPhone) {
    const rider = this.getUser(riderPhone);
    const deliveries = [];
    
    // Get all pending orders with locations
    this.users.forEach(user => {
      if (user.role === 'buyer' && user.currentOrder && user.currentOrder.status === 'payment_confirmed' && user.location) {
        // Simple distance check (in production, use proper geo library)
        deliveries.push({
          orderId: user.currentOrder.mealId,
          buyerPhone: user.phone,
          buyerName: user.profile.name || 'Customer',
          pickupLocation: 'Roho Kitchen', // or seller location
          dropoffLocation: user.location.address,
          area: user.location.area,
          meal: user.currentOrder.mealName,
          price: user.currentOrder.price,
          earnings: Math.round(user.currentOrder.price * 0.15), // 15% for rider
          status: 'pending'
        });
      }
    });
    
    return deliveries;
  }

  // ===== ORDER BOOKING WITH ATOMIC LOCKING =====

  // Book an order for a rider (prevents race conditions)
  async bookOrder(riderPhone, orderId) {
    // Use a lock to ensure only one rider can book simultaneously
    if (this.orderLocks.has(orderId)) {
      return { success: false, reason: 'Order already being booked' };
    }

    // Acquire lock
    this.orderLocks.set(orderId, { rider: riderPhone, timestamp: Date.now() });

    try {
      // Find the order
      let targetOrder = null;
      let targetBuyer = null;

      this.users.forEach(user => {
        if (user.role === 'buyer' && user.currentOrder && user.currentOrder.mealId === orderId && user.currentOrder.status === 'payment_confirmed') {
          targetOrder = user.currentOrder;
          targetBuyer = user;
        }
      });

      if (!targetOrder) {
        this.orderLocks.delete(orderId);
        return { success: false, reason: 'Order not found or already assigned' };
      }

      // Assign delivery to rider
      const rider = this.getUser(riderPhone);
      const delivery = {
        id: orderId,
        orderId,
        buyerPhone: targetBuyer.phone,
        buyerName: targetBuyer.profile.name || 'Customer',
        meal: targetOrder.mealName,
        price: targetOrder.price,
        earnings: Math.round(targetOrder.price * 0.15),
        status: 'assigned',
        assignedAt: new Date(),
        dropoffLocation: targetBuyer.location.address,
        area: targetBuyer.location.area
      };

      rider.currentDelivery = delivery;
      targetOrder.status = 'assigned_to_rider';
      targetOrder.assignedRider = riderPhone;

      // Release lock
      this.orderLocks.delete(orderId);

      return { success: true, delivery };
    } catch (err) {
      this.orderLocks.delete(orderId);
      return { success: false, reason: err.message };
    }
  }

  // Get orders in rider's preferred area
  getOrdersByArea(areaCode) {
    const orders = [];
    this.users.forEach(user => {
      if (user.role === 'buyer' && user.currentOrder && user.currentOrder.status === 'payment_confirmed' && user.location && user.location.area === areaCode) {
        orders.push({
          orderId: user.currentOrder.mealId,
          buyerPhone: user.phone,
          meal: user.currentOrder.mealName,
          price: user.currentOrder.price,
          earnings: Math.round(user.currentOrder.price * 0.15),
          location: user.location.address,
          area: areaCode
        });
      }
    });
    return orders;
  }

  // Clear old sessions (older than 24 hours)
  cleanupOldSessions() {
    const now = new Date();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    
    for (const [phone, user] of this.users) {
      if (user.lastInteraction < oneDayAgo) {
        this.users.delete(phone);
      }
    }
  }
}

module.exports = new UserStore();
