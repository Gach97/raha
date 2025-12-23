# 📱 Roho Bot - Access Guide

## Two Bot Modes

The Roho WhatsApp bot automatically detects if a user is a **customer** or a **rider** and routes them accordingly.

---

## 👥 CUSTOMER MODE

**Who:** Anyone not registered as a rider  
**Access:** Just send a WhatsApp message to the bot phone number  
**No registration needed**

### Customer Flow

```
Customer WhatsApp: "hi"
Bot: "Roho. Fuel for your day. 1️⃣ Order Lunch 2️⃣ My Account"

Customer: "1"
Bot: "Today's fuel options: 1️⃣ Beef & Mukimo..."

Customer: "1"
Bot: "You chose: Beef & Mukimo. Where should we deliver?"

Customer: "Britam Tower"
Bot: "Final check: ✅ Confirm ❌ Cancel"

Customer: "confirm"
Bot: "✓ Order placed. ID: ORD-..."
```

### Customer Commands
- Just reply with numbers (1, 2, 3)
- Type location as text
- Simple & straightforward

---

## 🚴 RIDER MODE

**Who:** Registered delivery riders  
**Access:** Must be registered first, then send WhatsApp messages  
**Registration:** Via admin endpoint

### Step 1: Register Rider (Admin Only)

**Via Terminal/Curl:**
```bash
curl -X POST http://localhost:3000/admin/register-rider \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "whatsapp:+254712345678",
    "name": "John Mwangi"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Rider \"John Mwangi\" registered successfully",
  "phone": "whatsapp:+254712345678"
}
```

### Step 2: Rider Sends Commands

Once registered, the rider can send commands via WhatsApp:

```
Rider WhatsApp: "orders"
Bot: "📋 3 Pending Orders:
  1. Beef & Mukimo
     📍 Britam Tower
     💵 KES 320
     ID: ORD-123..."

Rider: "book ORD-123"
Bot: "✅ Order booked!
  Booking ID: BOOK-456
  Next: Reply 'pickup BOOK-456' when ready"

Rider: "pickup BOOK-456"
Bot: "🚚 Picked up!
  Delivering to: Britam Tower
  Reply 'delivered BOOK-456' when done"

Rider: "delivered BOOK-456"
Bot: "✅ Delivery confirmed!
  💰 Funds Released: KES 320"
```

### Rider Commands

| Command | Example | What It Does |
|---------|---------|-------------|
| `orders` | `orders` | List all pending orders in queue |
| `book` | `book ORD-123` | Book an order |
| `pickup` | `pickup BOOK-456` | Confirm pickup, mark in transit |
| `delivered` | `delivered BOOK-456` | Confirm delivery, release funds |
| `myorders` | `myorders` | View your active bookings |
| `payment` | `payment BOOK-456` | Check payment status |
| (blank) | (any text) | Show available commands |

---

## 🔧 Admin Endpoints

### Register a Rider
```bash
POST /admin/register-rider
Content-Type: application/json

{
  "phone": "whatsapp:+254712345678",
  "name": "John Mwangi"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Rider \"John Mwangi\" registered successfully",
  "phone": "whatsapp:+254712345678"
}
```

---

### List All Registered Riders
```bash
GET /admin/riders
```

**Response:**
```json
{
  "count": 2,
  "riders": [
    {
      "phone": "whatsapp:+254712345678",
      "name": "John Mwangi",
      "status": "active",
      "createdAt": "2025-12-18T10:30:00.000Z",
      "totalDeliveries": 0,
      "earnings": 0
    },
    {
      "phone": "whatsapp:+254798765432",
      "name": "Jane Kipchoge",
      "status": "active",
      "createdAt": "2025-12-18T10:35:00.000Z",
      "totalDeliveries": 0,
      "earnings": 0
    }
  ]
}
```

---

## 🔍 How It Works (Behind the Scenes)

1. **Message Arrives** → `/webhook` receives from Twilio
2. **Check Phone** → `isRegisteredRider(phone)` queries Firestore
3. **Route Decision:**
   - If rider → Send to `handleRiderMessage()` (rider engine)
   - If customer → Send to `handleMessage()` (customer engine)
4. **Process** → Bot executes appropriate logic
5. **Response** → Send reply back via Twilio

---

## 📊 Firestore Collections

### `/riders/{phone}` - Registered Riders
```javascript
{
  phone: "whatsapp:+254712345678",
  name: "John Mwangi",
  status: "active",  // or "inactive"
  createdAt: "2025-12-18T10:30:00Z",
  totalDeliveries: 5,
  earnings: 1600,    // KES
}
```

### `/rider_queue/{orderId}` - Pending Orders
```javascript
{
  orderId: "ORD-1734450000123",
  customerPhone: "whatsapp:+254797354429",
  mealName: "Beef & Mukimo",
  location: "Britam Tower",
  price: 320,
  createdAt: "2025-12-18T10:30:00Z",
  status: "pending_booking",  // waiting for rider
}
```

### `/rider_bookings/{bookingId}` - Active Bookings
```javascript
{
  bookingId: "BOOK-1734450123456",
  orderId: "ORD-1734450000123",
  riderId: "whatsapp:+254712345678",
  customerPhone: "whatsapp:+254797354429",
  mealName: "Beef & Mukimo",
  location: "Britam Tower",
  price: 320,
  status: "booked",  // or "in_transit", "delivered"
  bookedAt: "2025-12-18T10:32:00Z",
  pickedUpAt: null,
  deliveredAt: null,
}
```

### `/rider_payments/{bookingId}` - Fund Tracking
```javascript
{
  bookingId: "BOOK-1734450123456",
  orderId: "ORD-1734450000123",
  riderId: "whatsapp:+254712345678",
  amount: 320,
  status: "held",  // or "released"
  createdAt: "2025-12-18T10:32:00Z",
  releasedAt: null,
}
```

---

## 🧪 Testing

### Test as Customer
1. Open WhatsApp
2. Send message to bot phone
3. Follow the menu

### Test as Rider
1. **Register rider via terminal:**
   ```bash
   curl -X POST http://localhost:3000/admin/register-rider \
     -H "Content-Type: application/json" \
     -d '{"phone": "whatsapp:+254712345678", "name": "Test Rider"}'
   ```

2. **Open WhatsApp from rider phone**
3. **Send commands:**
   - `orders` → See pending
   - `book ORD-123` → Book
   - `delivered BOOK-456` → Confirm

---

## 🔐 Security Notes

- **No authentication for MVP** - Anyone can become a customer
- **Admin endpoints** - No auth protection (add JWT/token in production)
- **Rider registration** - Only admin can register new riders
- **Phone-based identity** - WhatsApp phone number = unique ID

---

## 🚀 What's Next?

1. **Production Admin Dashboard** - UI for registering riders
2. **Rider Withdrawal** - Website to claim released funds
3. **Analytics** - Track orders, rider performance, earnings
4. **Notifications** - Push alerts when new orders available
5. **Rating System** - Customers rate riders

