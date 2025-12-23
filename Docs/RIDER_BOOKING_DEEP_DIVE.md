# 🎯 Roho Rider Booking & Payment System - Deep Dive

## Booking State Machine

### Complete Flow: Order → Booking → Delivery → Funds Release

```
                    CUSTOMER JOURNEY                                    RIDER JOURNEY
                         │                                                  │
                         ↓                                                  ↓
         ┌─ Customer Orders Food                              Rider Views Queue
         │  [createOrder() called]                            [VIEWING_QUEUE state]
         │  - /orders/{orderId} created                       - Gets pending orders
         │  - status: pending_booking                         - From /order_queue
         │                                                      │
         │  - groupId determined                               │
         │  - /order_queue/{orderId} created ←─────────────── Rider selects order
         │                                                      [BOOKING_CONFIRMED state]
         │                                                      │
         ↓                                                      ↓
    [Awaiting Booking]                                    [bookOrder() called]
    status: pending_booking                               - /bookings/{bookingId} created
                                                         - status: booked
                                                         - /payments/{bookingId}.status: held
                                                         - /order_queue status: booked
                                                         │
                                                         ↓
                                                   [ON_DELIVERY state]
                                                   Rider updates status:
                                                   1. pickup_ready
                                                   2. in_transit
                                                   3. delivered
                                                         │
                                                         ↓
                                                   [DELIVERY_COMPLETE state]
                                                   Rider confirms delivery
                                                   [confirmDeliveryAndReleaseFunds()]
                                                         │
                                                         ↓
    [Order Completed]                               [Payment Released]
    - status: delivered                             - payments.status: held → released
    - Order history recorded                        - Rider's earnings processed
    - Customer can rate delivery                    - Can view earnings in wallet
```

---

## 🎫 Booking States Explained

### 1. **pending_booking** (Initial State)
- **When**: Order created, added to /order_queue
- **Who Can See**: Riders in that geographic group
- **Actions Available**: 
  - Rider can book the order
  - Order auto-expires after X minutes (config)
- **Firestore Path**: `/order_queue/{orderId}`
- **Firestore Path**: `/orders/{orderId}`

```javascript
{
  orderId: "ORD-1734506400000",
  status: "pending_booking",
  groupId: "nairobi_cbd",
  bookedBy: null,
  createdAt: "2025-12-17T10:00:00Z"
}
```

### 2. **booked** (Rider Claimed Order)
- **When**: Rider taps order number and system confirms booking
- **Rider State**: `BOOKING_CONFIRMED`
- **Changes**:
  - `/order_queue` status changes to `booked`
  - `/order_queue.bookedBy` = rider phone
  - `/bookings/{bookingId}` created (new record)
  - `/payments/{bookingId}` created with status `held`
- **Other Riders**: Can no longer see this order in their queue

```javascript
// /bookings/{bookingId}
{
  bookingId: "BK-1734506400000-xyz123",
  orderId: "ORD-1734506400000",
  riderId: "whatsapp:+254712345678",
  riderName: "John Mwangi",
  status: "booked",
  bookingConfirmedAt: "2025-12-17T10:05:00Z",
  pickupAt: null,
  inTransitAt: null,
  deliveredAt: null
}

// /payments/{bookingId}
{
  bookingId: "BK-1734506400000-xyz123",
  orderId: "ORD-1734506400000",
  riderId: "whatsapp:+254712345678",
  amount: 320,
  status: "held",  // ← Funds locked, not yet released
  createdAt: "2025-12-17T10:05:00Z",
  releasedAt: null
}
```

### 3. **pickup_ready** (Rider Ready to Deliver)
- **When**: Rider confirms pickup (taps "Ready for pickup")
- **Rider State**: `ON_DELIVERY`
- **Changes**:
  - `/bookings/{bookingId}.status` = `pickup_ready`
  - `/bookings/{bookingId}.pickupAt` = timestamp
  - Meal picked up from kitchen

```javascript
// /bookings/{bookingId}
{
  status: "pickup_ready",
  pickupAt: "2025-12-17T10:10:00Z"
  // Other fields unchanged
}
```

### 4. **in_transit** (Rider On The Way)
- **When**: Rider confirms order picked up, now traveling to customer
- **Rider State**: `ON_DELIVERY`
- **Changes**:
  - `/bookings/{bookingId}.status` = `in_transit`
  - `/bookings/{bookingId}.inTransitAt` = timestamp

```javascript
// /bookings/{bookingId}
{
  status: "in_transit",
  inTransitAt: "2025-12-17T10:15:00Z"
  // Other fields unchanged
}
```

### 5. **delivered** (Order Reached Customer)
- **When**: Rider confirms arrival at customer location
- **Rider State**: `DELIVERY_COMPLETE`
- **Changes**:
  - `/bookings/{bookingId}.status` = `delivered`
  - `/bookings/{bookingId}.deliveredAt` = timestamp
  - Rider gets confirmation prompt

```javascript
// /bookings/{bookingId}
{
  status: "delivered",
  deliveredAt: "2025-12-17T10:45:00Z"
  // Other fields unchanged
}
```

### 6. **completed** (Confirmed + Funds Released)
- **When**: Rider taps "Confirm delivery" button
- **What Happens**:
  - `confirmDeliveryAndReleaseFunds(bookingId)` called
  - `/bookings/{bookingId}.status` = `completed`
  - `/payments/{bookingId}.status` = `held` → `released`
  - `/orders/{orderId}.status` = `delivered`
  - Funds transferred to rider's wallet

```javascript
// /bookings/{bookingId}
{
  status: "completed",
  proofOfDelivery: "https://...",
  completedAt: "2025-12-17T10:50:00Z"
}

// /payments/{bookingId}
{
  status: "released",  // ← Funds now available
  releasedAt: "2025-12-17T10:50:00Z"
}

// /orders/{orderId}
{
  status: "delivered"
}
```

---

## 💳 Payment Holding Mechanism

### Why Hold Funds?

**Scenario**: Customer disputes delivery, or rider never delivers.

**Solution**: Funds held until delivery confirmed.

### Fund States

```
┌─────────────────────────────────────────────────────────────────┐
│ STATUS: held                                                    │
├─────────────────────────────────────────────────────────────────┤
│ • Amount: 320 KES                                               │
│ • Where: /payments/{bookingId}.status = "held"                │
│ • Duration: From booking confirmation to delivery confirmation │
│ • Risk: If rider cancels, order returns to queue, funds locked│
│ • Action: Rider must confirm delivery                          │
└─────────────────────────────────────────────────────────────────┘
                            ↓
                    [Delivery Confirmed]
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ STATUS: released                                                │
├─────────────────────────────────────────────────────────────────┤
│ • Amount: 320 KES                                               │
│ • Where: Rider's wallet / M-Pesa account                       │
│ • Timestamp: releasedAt = "2025-12-17T10:50:00Z"              │
│ • Accessible: Yes, rider can withdraw                          │
│ • Admin View: Dashboard shows payment released                 │
└─────────────────────────────────────────────────────────────────┘
```

### Failure Scenarios

#### Scenario 1: Rider Cancels Before Pickup

```javascript
// Before cancellation
/bookings/{bookingId}.status = "booked"
/payments/{bookingId}.status = "held"

// Call: cancelBooking(bookingId, "rider_cancelled")
// After cancellation
/bookings/{bookingId}.status = "cancelled"
/order_queue/{orderId}.status = "pending_booking" // ← Back in queue!
/payments/{bookingId}.status = "cancelled"

// Customer Impact: Order goes to next rider
// Rider Impact: Can no longer complete, funds never held
```

#### Scenario 2: Rider Confirms Delivery, Then Disputes

```javascript
// This is handled by admin support (MVP out of scope)
// Admin can:
// 1. Keep payment released (rider legitimate)
// 2. Refund rider (if delivery unconfirmed)
// 3. Escalate to customer support

// DB Record for audit:
/payments/{bookingId} {
  status: "released",
  releasedAt: "2025-12-17T10:50:00Z",
  dispute: null // or dispute object if raised
}
```

---

## 📊 Firestore Query Examples

### Get All Pending Orders for CBD Group

```javascript
db.collection('order_queue')
  .where('groupId', '==', 'nairobi_cbd')
  .where('status', '==', 'pending_booking')
  .orderBy('createdAtTimestamp', 'asc')
  .get()
```

### Get Rider's Active Deliveries

```javascript
db.collection('bookings')
  .where('riderId', '==', 'whatsapp:+254712345678')
  .where('status', 'in', ['booked', 'pickup_ready', 'in_transit', 'delivered'])
  .get()
```

### Check if Funds Released for Booking

```javascript
db.collection('payments')
  .doc(bookingId)
  .get()
  .then(doc => {
    if (doc.data().status === 'released') {
      console.log('✅ Funds released');
    }
  })
```

### Audit Trail: All Transitions for an Order

```javascript
// Bookings collection (one per order)
/bookings/BK-xyz

// Payment collection (one per booking)
/payments/BK-xyz

// Both have timestamps for every state change:
- bookingConfirmedAt
- pickupAt
- inTransitAt
- deliveredAt
- completedAt

// Payment has:
- createdAt (funds held)
- releasedAt (funds released)
```

---

## 🔐 Booking Confirmation Logic

### Atomicity: Preventing Race Conditions

**Problem**: Two riders book the same order simultaneously.

**Solution** (implemented via Firestore transaction):

```javascript
// Pseudo-code for bookOrder()
db.runTransaction(async (transaction) => {
  // 1. Read current state
  const orderSnap = transaction.get(orderRef);
  if (orderSnap.data().status !== 'pending_booking') {
    throw new Error('Already booked');
  }

  // 2. All writes atomic (either all succeed or all fail)
  transaction.set(bookingRef, bookingData);
  transaction.update(orderQueueRef, { status: 'booked', bookedBy: riderId });
  transaction.set(paymentRef, paymentData);

  // 3. Commit or rollback as one unit
});
```

**Result**: Only the first rider's booking succeeds; others get "Already booked" error.

---

## 🛠️ API Methods Reference

### RiderService Functions

```javascript
// 1. Group Management
getRiderGroups()                    // Get all delivery zones
getRiderGroup(groupId)              // Get specific group
assignGroupToOrder(location)        // Determine group for order

// 2. Queue Management
createOrderQueueEntry(orderId, groupId, orderData)
getGroupPendingOrders(groupId)      // Get pending orders for group
getRiderBookings(riderId)           // Get rider's active bookings

// 3. Booking Lifecycle
bookOrder(orderId, riderId, riderName)
getBooking(bookingId)
updateBookingStatus(bookingId, newStatus)

// 4. Completion & Payment
confirmDeliveryAndReleaseFunds(bookingId, proofOfDelivery)
cancelBooking(bookingId, reason)
```

### RiderBot Functions

```javascript
// WhatsApp message handler
handleRiderMessage(phone, message)

// Internal handlers
handleRiderHome(phone, message)
handleViewingQueue(phone, message)
handleBookingConfirmed(phone, message)
handleOnDelivery(phone, message)
handleDeliveryComplete(phone, message)
```

---

## ✅ Testing Checklist

- [ ] Rider can view pending orders in their group
- [ ] Rider can book an order → booking created, funds held
- [ ] Booked order removed from other riders' queues
- [ ] Rider can update status → pickup → transit → delivered
- [ ] Confirm delivery → funds released to rider wallet
- [ ] Cancel booking → order back in queue, funds cancelled
- [ ] Multiple riders can't book same order (race condition handled)
- [ ] Order history shows all state transitions
- [ ] Payment audit trail is complete

---

## 🚀 Admin Dashboard Integration (Future)

The separate admin website should provide:

1. **Rider Analytics**
   - Total deliveries
   - Earnings (released funds)
   - Average delivery time
   - Rating/reviews

2. **Payment Management**
   - View all payments (held vs. released)
   - Manual fund release/refund
   - Dispute resolution

3. **Group Management**
   - Add/edit delivery zones
   - Adjust max concurrent orders
   - View queue status

4. **Customer Support**
   - Search orders by ID
   - View booking history
   - Issue refunds

---

**Built for Roho Nourish** 🌿 Fuel for your day.
