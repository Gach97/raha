# 🚚 Roho Rider Delivery System

## Overview

The Roho Rider system connects customers' food orders with delivery riders. After a customer places an order, it enters a **rider queue** where available riders in their geographic zone can claim and deliver it.

### Key Concepts

- **Rider Groups**: Geographic delivery zones (e.g., "Nairobi CBD", "South Nairobi")
- **Order Queue**: Pending orders waiting for a rider to book them
- **Bookings**: A rider's claim on an order, with status tracking
- **Payments**: Funds held during delivery, released after successful completion

---

## 🏗️ System Architecture

### Firestore Collections

```
/rider_groups/{groupId}
├── name: "Nairobi CBD"
├── locationKeywords: ["cbd", "westlands", "karen"]
├── isDefault: true
└── maxConcurrentOrders: 10

/riders/{riderId}
├── name: "John Mwangi"
├── phone: "whatsapp:+254712345678"
├── groupId: "nairobi_cbd"
├── status: "active" | "offline" | "on_delivery"
└── totalDeliveries: 42

/orders/{orderId}
├── orderId: "ORD-1734506400000"
├── mealName: "Beef & Mukimo"
├── location: "Westlands Tower 3"
├── price: 320
├── status: "pending_booking" → "booked" → "pickup_ready" → "in_transit" → "delivered"
└── createdAt: "2025-12-17T10:00:00Z"

/order_queue/{orderId}
├── orderId: "ORD-1734506400000"
├── groupId: "nairobi_cbd"
├── status: "pending_booking"
├── bookedBy: null → "whatsapp:+254712345678"
└── bookedAt: null → "2025-12-17T10:05:00Z"

/bookings/{bookingId}
├── bookingId: "BK-1734506400000-abc123xyz"
├── orderId: "ORD-1734506400000"
├── riderId: "whatsapp:+254712345678"
├── riderName: "John Mwangi"
├── status: "booked" → "pickup_ready" → "in_transit" → "delivered" → "completed"
├── pickupAt: "2025-12-17T10:10:00Z"
├── inTransitAt: "2025-12-17T10:15:00Z"
└── deliveredAt: "2025-12-17T10:45:00Z"

/payments/{bookingId}
├── bookingId: "BK-1734506400000-abc123xyz"
├── amount: 320
├── status: "held" → "released"
├── createdAt: "2025-12-17T10:05:00Z"
└── releasedAt: "2025-12-17T10:50:00Z"
```

---

## 📱 Rider WhatsApp Bot Flows

### 1️⃣ **Rider Home Menu**

```
Rider: "Hi"
Bot: "🏠 Roho Rider\n\n1️⃣ View Order Queue\n2️⃣ My Active Bookings\n3️⃣ Account"

Rider: "1"
Bot: "📦 Pending Orders (3):\n\n1️⃣ Beef & Mukimo\n   📍 Westlands Tower\n   KES 320\n\n2️⃣ Kienyeji Chicken\n..."
```

### 2️⃣ **View Order Queue**

**State**: `VIEWING_QUEUE`

Riders see pending orders in their delivery group, sorted by creation time (oldest first → closest to deadline).

```
Bot: "📦 Pending Orders (5):\n
1️⃣ Beef & Mukimo | Westlands Tower | KES 320
2️⃣ Vegan Bowl | Karen | KES 320
3️⃣ Kienyeji Chicken | Kilimani | KES 320
4️⃣ Nyama & Rice | Upper Hill | KES 320
5️⃣ Fish & Ugali | Parklands | KES 330

Reply with order number (1-5) to book"

Rider: "1"
```

### 3️⃣ **Book Order**

**State**: `BOOKING_CONFIRMED`

When a rider books an order:
- ✅ Order locked to this rider (status: `pending_booking` → `booked`)
- 💰 Funds held in `/payments/{bookingId}` (status: `held`)
- 📨 Booking record created in `/bookings/{bookingId}`
- ⏰ Booking timestamp recorded

```
Bot: "✅ Order booked!\n
Order: Beef & Mukimo
Location: Westlands Tower 3
KES 320

Reply:\n
1️⃣ Ready for pickup
2️⃣ Cancel booking"

Rider: "1"
```

### 4️⃣ **Delivery Status Updates**

**State**: `ON_DELIVERY`

Rider progresses through stages:

```
1. Pickup Ready
   Rider: "1"
   Bot: "✅ Marked as ready for delivery!\nReply:\n1️⃣ In transit now\n2️⃣ View details"
   [Status: booked → pickup_ready]

2. In Transit
   Rider: "1"
   Bot: "🚚 In transit!\nReply:\n1️⃣ Arrived at location\n2️⃣ View details"
   [Status: pickup_ready → in_transit]

3. Delivered
   Rider: "1"
   Bot: "📍 Delivered!\nReply:\n1️⃣ Confirm delivery\n2️⃣ Report issue"
   [Status: in_transit → delivered]
```

### 5️⃣ **Confirm Delivery & Release Funds**

**State**: `DELIVERY_COMPLETE`

```
Bot: "Complete delivery?\n\nReply:\n1️⃣ Confirm (release funds)\n2️⃣ Report issue"

Rider: "1"
Bot: "💰 Funds released!\n\nYour earnings have been processed.\nReady for next order? Reply '1'"

[Firestore Changes]
- payments/{bookingId}.status: "held" → "released"
- payments/{bookingId}.releasedAt: "2025-12-17T10:50:00Z"
- bookings/{bookingId}.status: "delivered" → "completed"
- orders/{orderId}.status: "pending_booking" → "delivered"
```

---

## 💾 Data Flow Diagram

```
Customer Places Order
        ↓
[Bot Engine: handleMessage()]
        ↓
Order saved to /orders/{orderId}
        ↓
[Rider Service: createOrder()]
        ↓
Assign Group → /order_queue/{orderId} (status: pending_booking)
        ↓
Riders View Queue (VIEWING_QUEUE state)
        ↓
Rider Books Order
        ↓
[RiderService: bookOrder()]
        ├─ Create /bookings/{bookingId}
        ├─ Create /payments/{bookingId} (status: held)
        └─ Update /order_queue/{orderId} (status: booked)
        ↓
Rider Updates Status (ON_DELIVERY state)
        ├─ pickup_ready (Order picked up)
        ├─ in_transit (On the way)
        └─ delivered (Arrived)
        ↓
Confirm Delivery (DELIVERY_COMPLETE state)
        ↓
[RiderService: confirmDeliveryAndReleaseFunds()]
        ├─ payments/{bookingId}.status: held → released
        ├─ bookings/{bookingId}.status: completed
        └─ orders/{orderId}.status: delivered
        ↓
Funds appear in Rider's Wallet (via external payment processor)
```

---

## 🔄 Order Status Lifecycle

```
Customer Order:
pending_booking → booked → pickup_ready → in_transit → delivered

Rider Booking:
booked → pickup_ready → in_transit → delivered → completed

Payment:
held → released (only after delivery confirmed)
```

---

## ⚙️ How Group Assignment Works

When a customer enters their delivery location, the system:

1. Gets all rider groups from `/rider_groups`
2. Compares location against each group's `locationKeywords`
3. Returns the matching group (e.g., "nairobi_cbd")
4. If no match, uses the `isDefault: true` group
5. Order added to that group's queue in `/order_queue`

**Example**:
```
Customer: "Britam Tower, Westlands"
         ↓
         Matches keywords: ["westlands", "cbd"]
         ↓
         Group: nairobi_cbd
         ↓
         Order added to CBD riders' queue
```

---

## 💰 Payment Flow

### Fund Holding Logic

```
1. Order Placed
   ↓
   /payments/{bookingId}.status = "held"
   Amount locked: KES 320

2. Rider Books Order
   ↓
   Funds still held
   Rider commits to delivery

3. Delivery Complete
   ↓
   /payments/{bookingId}.status = "released"
   Funds transferred to rider's account
   (via external payment processor like M-Pesa)
```

### Fund Release Conditions

- ✅ Order status: `delivered`
- ✅ Booking status: `completed`
- ✅ Payment status: `held` → `released`
- ✅ Rider confirmed delivery via `confirmDeliveryAndReleaseFunds()`

**Note**: Fund transfer to rider's M-Pesa/bank account is handled by a **separate admin dashboard** (out of scope for MVP).

---

## 🚀 Setup Instructions

### 1. Initialize Rider Groups

```bash
node scripts/setup-rider-groups.js
```

This creates default groups in Firestore:
- Nairobi CBD (Westlands, Karen, Upper Hill)
- South Nairobi (Langata, Otiende)
- North Nairobi (Runda, Gigiri)
- East Nairobi (Industrial Area)

### 2. Register a Rider

```javascript
// Manual entry via Firebase Console or script:
/riders/{phone}
{
  "name": "John Mwangi",
  "phone": "whatsapp:+254712345678",
  "groupId": "nairobi_cbd",
  "status": "active",
  "totalDeliveries": 0,
  "createdAt": "2025-12-17T10:00:00Z"
}
```

### 3. Test End-to-End

```
1. Customer sends "hi" → gets order menu
2. Customer places order → order added to queue
3. Rider sends "hi" → sees order queue
4. Rider books order → booking confirmed
5. Rider updates status → pickup → transit → delivered
6. Rider confirms → funds released
```

---

## 🔮 Future Enhancements

- [ ] GPS tracking for real-time rider location
- [ ] Customer notifications when rider picks up/delivers
- [ ] Rider ratings system
- [ ] Dynamic pricing based on distance
- [ ] Batched deliveries (one rider, multiple orders)
- [ ] Rider earnings dashboard
- [ ] Admin panel for group management
- [ ] Geohashing for precise location matching
- [ ] Rider availability/online status
- [ ] Order cancellation policies

---

## 📚 Related Files

- `src/services/riderService.js` - Core rider logic
- `src/bot/riderEngine.js` - Rider WhatsApp interface
- `src/bot/engine.js` - Customer order creation with rider integration
- `scripts/setup-rider-groups.js` - Initialize delivery zones
- `README_RIDER_SYSTEM.md` - This file

---

**Built for Roho Nourish** 🌿 Fuel for your day.
