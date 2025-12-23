# 🚀 Roho Rider System - Quick Reference

## TL;DR (Too Long; Didn't Read)

**What**: Riders claim orders from a queue, deliver them, and earn funds released after confirmation.

**How**: Orders auto-assigned to geographic groups → Riders view queue → Book → Update status → Confirm → Funds released

**Payment**: HELD when booked, RELEASED when delivery confirmed. Prevents fraud.

---

## 📊 Quick State Diagrams

### Customer Order Lifecycle
```
pending_booking → booked → pickup_ready → in_transit → delivered
     ↑                           ↓
     └─ Awaiting rider ───→ Rider books
```

### Rider Booking Lifecycle
```
booked → pickup_ready → in_transit → delivered → completed
  ↑                                                    ↓
  └──── Rider books order ──→ Updates status ─→ Confirms
```

### Payment Lifecycle
```
held (Order booked) → released (Delivery confirmed) → Accessible in wallet
```

---

## 🎯 The Six Booking States

| State | Who | What Happens | Duration |
|-------|-----|--------------|----------|
| **pending_booking** | Customer/Queue | Order created, waiting | Seconds |
| **booked** | Rider | Rider claimed order, funds held | ~5 mins |
| **pickup_ready** | Rider | Picked up from kitchen | ~5 mins |
| **in_transit** | Rider | On the way to customer | ~20 mins |
| **delivered** | Rider | Arrived at customer location | ~1 min |
| **completed** | Funds Released | Delivery confirmed, funds released | Instant |

---

## 💰 Payment States

```
HELD
├─ What: Funds locked, rider earns but can't access
├─ When: Order booked (bookOrder called)
├─ Duration: From booking to delivery confirmation
└─ If cancelled: Funds unlocked, rider gets nothing

RELEASED
├─ What: Funds transferred to rider's account
├─ When: Rider confirms delivery (confirmDeliveryAndReleaseFunds called)
├─ Duration: Immediate
└─ If dispute: Admin can refund (future feature)
```

---

## 🔗 Firestore Paths Cheat Sheet

```
/rider_groups/{groupId}
  └─ name, locationKeywords, maxConcurrentOrders

/orders/{orderId}
  └─ mealName, location, price, status, phone

/order_queue/{orderId}
  └─ groupId, status, bookedBy, bookedAt

/riders/{riderId}
  └─ name, phone, groupId, status, totalDeliveries

/bookings/{bookingId}
  └─ orderId, riderId, status, pickupAt, inTransitAt, deliveredAt

/payments/{bookingId}
  └─ amount, status (held/released), createdAt, releasedAt
```

---

## 🎮 Rider WhatsApp Commands

### Main Menu
```
1 = View Order Queue
2 = My Active Bookings
3 = Account
```

### When Viewing Queue
```
[Order Number] = Book order (e.g., "1" to book first order)
back = Return to menu
```

### When Order Booked
```
1 = Ready for pickup
2 = Cancel booking
```

### When On Delivery
```
1 = In transit now
2 = View booking details
3 = View all bookings
4 = Home
```

### When Delivery Complete
```
1 = Confirm delivery (release funds)
2 = Report issue
```

---

## 🛠️ Key API Calls

### Rider Service (Backend)

```javascript
// Setup & Groups
getRiderGroups()                    // Get all zones
assignGroupToOrder(location)        // Determine group for order

// Queue & Bookings
createOrderQueueEntry(orderId, groupId, orderData)
getGroupPendingOrders(groupId)      // Show to riders
bookOrder(orderId, riderId, riderName)

// Status Updates
updateBookingStatus(bookingId, "pickup_ready" | "in_transit" | "delivered")

// Completion
confirmDeliveryAndReleaseFunds(bookingId)

// Cancellation
cancelBooking(bookingId, reason)
```

### Rider Bot (WhatsApp Interface)

```javascript
handleRiderMessage(phone, message)
  ├─ handleRiderHome()           // Main menu
  ├─ handleViewingQueue()        // See orders
  ├─ handleBookingConfirmed()    // Order booked
  ├─ handleOnDelivery()          // Tracking
  └─ handleDeliveryComplete()    // Confirm
```

---

## 🌍 Group Assignment Logic

**Input**: Customer delivery location (e.g., "Westlands Tower")

**Process**:
1. Get all rider groups
2. Check each group's `locationKeywords`
3. Match against customer location (lowercase)
4. Return matching group ID

**Example**:
```
"Westlands Tower"
    ↓
Check "nairobi_cbd" keywords: ["cbd", "westlands", ...]
    ↓
Match found! "westlands" ⊆ "westlands tower"
    ↓
Return: "nairobi_cbd"
    ↓
Order → /order_queue/ORD-xyz with groupId: "nairobi_cbd"
```

**Fallback**: If no match, use group with `isDefault: true`

---

## 📈 Data Flow Summary

```
🛒 Customer Order
     ↓
  Engine creates /orders/{orderId}
     ↓
  Assign group based on location
     ↓
  Create /order_queue entry (status: pending_booking)
     ↓
👤 Rider views queue
     ↓
  Rider books → /bookings created, /payments held
     ↓
  Rider updates status → pickup → transit → delivered
     ↓
  Rider confirms → /payments released
     ↓
💰 Funds available in rider's wallet
```

---

## 🔒 Security Features

1. **Atomic Booking**: Only one rider can book each order (Firestore transaction)
2. **Fund Hold**: Payment locked until delivery confirmed
3. **State Validation**: Only valid status transitions allowed
4. **Audit Trail**: All timestamps recorded for disputes
5. **Group Isolation**: Riders only see orders for their group

---

## 🧪 Quick Test Flow

```
1. Run: npm start
2. Customer: "Hi"
3. Bot: Shows menu (Order, Account)
4. Customer: "1" (Order)
5. Bot: Shows meals
6. Customer: "1" (Select meal)
7. Bot: Ask location
8. Customer: "Westlands" or "Britam Tower"
9. Bot: Ask payment confirmation
10. Customer: "confirm"
11. ✅ Order created in /orders & /order_queue

--- Rider Side ---

12. Rider: "Hi"
13. Bot: Shows rider menu (Queue, Bookings, Account)
14. Rider: "1" (View Queue)
15. Bot: Shows pending orders
16. Rider: "1" (Book first order)
17. ✅ Booking created, funds held
18. Rider: "1" (Ready for pickup)
19. Rider: "1" (In transit)
20. Rider: "1" (Delivered)
21. Rider: "1" (Confirm)
22. ✅ Funds released!
```

---

## 📝 Implementation Checklist

- [x] Rider service (group assignment, booking, funds)
- [x] Rider WhatsApp bot (5 states, menu commands)
- [x] Integration with customer order flow
- [x] Firestore schemas (7 collections)
- [x] Initialization scripts (setup groups)
- [x] Comprehensive documentation
- [ ] Admin dashboard (separate website)
- [ ] Real-time GPS tracking
- [ ] Customer notifications
- [ ] Dispute resolution UI

---

## 🎓 Learn More

| Document | What It Covers |
|----------|----------------|
| `README_RIDER_SYSTEM.md` | Overview, flows, setup |
| `RIDER_BOOKING_DEEP_DIVE.md` | Technical deep-dive, state machine |
| `RIDER_IMPLEMENTATION_SUMMARY.md` | What was built, integration |
| `QUICK_REFERENCE.md` | This file! |

---

## 🚨 Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Order not appearing in queue | Check group assignment logic, verify location keywords |
| Rider can't book order | Order may already be booked, return to home & try another |
| Funds not released | Confirm delivery status = "delivered", try "Confirm" again |
| Rider can't see menu | Ensure rider registered in `/riders/{phone}` collection |
| Payment stuck on "held" | Check `/payments/{bookingId}.status`, manually release if needed |

---

## 📞 Support / Debugging

### Check Group Assignment
```javascript
// In console
const riderService = require('./src/services/riderService');
await riderService.assignGroupToOrder("Westlands Tower");
// Output: "nairobi_cbd"
```

### Check Pending Orders
```javascript
// See what's in rider queue
await riderService.getGroupPendingOrders("nairobi_cbd");
// Returns: [{ orderId, mealName, location, ... }]
```

### Check Rider Bookings
```javascript
// See rider's active bookings
await riderService.getRiderBookings("whatsapp:+254712345678");
// Returns: [{ bookingId, status, ... }]
```

### Check Payment Status
```javascript
// Verify funds held/released
const payment = await db.collection('payments').doc(bookingId).get();
console.log(payment.data().status); // "held" or "released"
```

---

## 🎯 MVP Success Criteria

✅ Riders can view pending orders in their geographic zone
✅ Riders can book orders, reserving delivery
✅ Funds are held during delivery process
✅ Riders can update delivery status in real-time
✅ Riders can confirm delivery, releasing funds
✅ Orders don't double-book (only one rider per order)
✅ Audit trail of all state changes
✅ Orders auto-routed to correct rider group

---

**Questions?** See full documentation files or check the code comments in:
- `src/services/riderService.js`
- `src/bot/riderEngine.js`
- `src/bot/engine.js`

**Built for Roho Nourish** 🌿 Fuel for your day.
