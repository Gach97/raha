# 🚴 Roho Rider System - Simplified Implementation

## Overview

**Zero GPS. Landmark-based delivery. Simple text commands.**

The rider system is intentionally minimal:
- No geographic zones or complex routing
- No GPS tracking
- Just landmarks ("Britam Tower", "Safari Park", etc.)
- WhatsApp text commands for everything

---

## System Architecture

### Three Firestore Collections

#### 1. `/rider_queue/{orderId}` - Pending Orders
Holds orders waiting for rider booking.

```javascript
{
  orderId: "ORD-1734450000123",
  customerPhone: "whatsapp:+254797354429",
  mealName: "Beef & Mukimo",
  location: "Britam Tower",           // Simple text landmark
  price: 320,
  createdAt: "2025-12-17T10:30:00Z",
  status: "pending_booking"           // Waiting for rider
}
```

#### 2. `/rider_bookings/{bookingId}` - Active Bookings
When a rider books an order, it moves here.

```javascript
{
  bookingId: "BOOK-1734450123456",
  orderId: "ORD-1734450000123",
  riderId: "whatsapp:+254712345678", // Rider's phone
  customerPhone: "whatsapp:+254797354429",
  mealName: "Beef & Mukimo",
  location: "Britam Tower",
  price: 320,
  status: "booked",                   // States: booked → in_transit → delivered
  bookedAt: "2025-12-17T10:32:00Z",
  pickedUpAt: null,
  deliveredAt: null
}
```

#### 3. `/rider_payments/{bookingId}` - Fund Tracking
Manages payment holds and releases.

```javascript
{
  bookingId: "BOOK-1734450123456",
  orderId: "ORD-1734450000123",
  riderId: "whatsapp:+254712345678",
  amount: 320,
  status: "held",                    // held → released (after delivery)
  createdAt: "2025-12-17T10:32:00Z",
  releasedAt: null
}
```

---

## Rider Workflow

### Step 1: Customer Orders (Automatic)
1. Customer places order via Roho bot
2. Order saved to `/orders/{orderId}`
3. Order automatically added to `/rider_queue/{orderId}` with status `pending_booking`

```
✓ Order placed
✓ Added to rider queue
⏳ Waiting for rider
```

### Step 2: Rider Views Queue
**Command:** `orders`

```
Rider sends: "orders"
Bot responds:
  📋 3 Pending Orders:
  
  1. Beef & Mukimo
     📍 Britam Tower
     💵 KES 320
     ID: ORD-1734450000123
  
  2. Kienyeji Chicken
     📍 Safari Park
     💵 KES 320
     ID: ORD-1734450000124
  
  Reply: book ORD-12345 to claim an order
```

### Step 3: Rider Books Order
**Command:** `book ORD-1734450000123`

```
Rider sends: "book ORD-1734450000123"

Behind scenes:
  1. Check order exists & is pending_booking
  2. Create booking in /rider_bookings/{bookingId}
  3. Update /rider_queue/{orderId} status → "booked"
  4. Create payment hold in /rider_payments/{bookingId}

Bot responds:
  ✅ Order booked!
  
  Booking ID: BOOK-1734450123456
  
  Next:
  Reply "pickup BOOK-1734450123456" when ready
```

**Firestore Changes:**
```
rider_queue/{ORD-123}:
  status: "booked" ← was "pending_booking"
  bookingId: "BOOK-1734450123456"
  riderId: "whatsapp:+254712345678"

rider_bookings/{BOOK-123}:
  [NEW RECORD CREATED]

rider_payments/{BOOK-123}:
  status: "held" ← funds locked
```

### Step 4: Rider Confirms Pickup
**Command:** `pickup BOOK-1734450123456`

```
Rider sends: "pickup BOOK-1734450123456"

Behind scenes:
  1. Verify rider owns booking
  2. Update /rider_bookings/{bookingId}:
     - status → "in_transit"
     - pickedUpAt → now

Bot responds:
  🚚 Picked up!
  
  Delivering to: Britam Tower
  
  Reply "delivered BOOK-1734450123456" when customer receives
```

### Step 5: Rider Confirms Delivery (Funds Released)
**Command:** `delivered BOOK-1734450123456`

```
Rider sends: "delivered BOOK-1734450123456"

Behind scenes:
  1. Verify rider owns booking
  2. Update /rider_bookings/{bookingId}:
     - status → "delivered"
     - deliveredAt → now
  3. Update /rider_payments/{bookingId}:
     - status → "released" ✅
     - releasedAt → now

Bot responds:
  ✅ Delivery confirmed!
  
  💰 Funds Released: KES 320
  
  Thank you for the delivery!
```

**KEY:** Funds only released after delivery confirmation.

---

## Payment Flow

```
Order Placed (KES 320)
         ↓
    HELD in /rider_payments
         ↓
  Rider Books Order
         ↓
  Rider Picks Up
         ↓
  Rider Confirms Delivery
         ↓
    RELEASED ✅
(Rider can withdraw via website)
```

**States:**
- `held` - Funds locked, waiting for delivery
- `released` - Delivery confirmed, funds available
- `cancelled` - Rider cancelled booking, funds released back

---

## Rider Commands (Complete Reference)

| Command | Example | What It Does |
|---------|---------|-------------|
| `orders` | `orders` | List all pending orders in queue |
| `book` | `book ORD-123` | Book a pending order |
| `pickup` | `pickup BOOK-456` | Confirm pickup, mark in_transit |
| `delivered` | `delivered BOOK-456` | Confirm delivery, release funds |
| `myorders` | `myorders` | List your active bookings |
| `payment` | `payment BOOK-456` | Check payment status |
| (blank/help) | (just send anything) | Show all commands |

---

## Order Status Transitions

```
Customer-Side Order:
  pending_booking → (rider books) → booked → (rider delivers) → delivered

Rider Booking:
  [created when booked] → booked → in_transit → delivered

Payment:
  held [from booking] → (on delivery) → released
```

---

## How to Integrate with Website (Fund Withdrawal)

The website dashboard should:

1. **Query Firestore** for rider's `/rider_payments` where `status: "released"`
2. **Sum** the amounts
3. **Show available balance** (e.g., "KES 1,450 available to withdraw")
4. **Withdrawal flow:**
   - Rider requests withdrawal → Website marks as "processing"
   - Admin verifies + transfers to M-PESA
   - Website updates status → "withdrawn"

Example query from website:
```javascript
db.collection('rider_payments')
  .where('riderId', '==', riderId)
  .where('status', '==', 'released')
  .get()
  .then(snapshot => {
    let balance = 0;
    snapshot.forEach(doc => {
      balance += doc.data().amount;
    });
    displayBalance(balance);
  });
```

---

## Simple vs Complex (Why This Design)

### ❌ We Didn't Add
- GPS/location services
- Geohashing or zone routing
- Distance calculation
- Complex assignment algorithms
- Rider rating systems

### ✅ We Did Add
- Text-based landmark locations
- Simple sequential queue
- Text commands (no app)
- WhatsApp-native flow
- Immediate payment tracking
- Clear fund hold/release logic

**Result:** MVP works, scales easily, requires no SDK integrations beyond Twilio + Firebase.

---

## Testing the System

### 1. Place Customer Order
```
Customer (WhatsApp): "hi"
Bot: "Roho. Fuel for your day. 1️⃣ Order Lunch 2️⃣ My Account"
Customer: "1"
Bot: "Today's fuel options... 1️⃣ Beef & Mukimo 2️⃣ Kienyeji Chicken 3️⃣ Vegan Bowl"
Customer: "1"
Bot: "You chose Beef & Mukimo. KES 320. Where should we deliver?"
Customer: "Britam Tower"
Bot: "Final check... ✅ Confirm ❌ Cancel"
Customer: "confirm"
Bot: "✓ Order placed. ID: ORD-123..."

✅ Order in /orders/ORD-123
✅ Order in /rider_queue/ORD-123
```

### 2. Rider Books Order
```
Rider (WhatsApp): "orders"
Bot: [lists pending orders]
Rider: "book ORD-123"
Bot: "✅ Order booked! Booking ID: BOOK-456..."

✅ Booking in /rider_bookings/BOOK-456
✅ Payment held in /rider_payments/BOOK-456
```

### 3. Rider Delivers & Funds Release
```
Rider: "pickup BOOK-456"
Bot: "🚚 Picked up! Delivering to Britam Tower..."

Rider: "delivered BOOK-456"
Bot: "✅ Delivery confirmed! 💰 Funds Released: KES 320"

✅ rider_payments/BOOK-456 status → "released"
```

---

## Notes for Developers

- **No auth required for MVP** - Rider identified by WhatsApp number
- **No disputes/refunds** - Funds auto-release on delivery confirmation
- **No notifications** - Riders must check manually (future: push notifications)
- **Landmark only** - Store location as text string, no geocoding
- **Time tracking** - All timestamps in Firestore for analytics later

