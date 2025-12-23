# 🛠️ Roho Rider System - Implementation Guide

## Installation & Setup

### Prerequisites
- Node.js 18+
- Firebase project with Firestore & Realtime Database
- Twilio account with WhatsApp enabled
- `.env` file with credentials

### 1. Install Dependencies

```bash
cd /workspaces/raha
npm install
```

### 2. Environment Variables

Add to `.env`:

```env
# Twilio
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=whatsapp:+1234567890

# Firebase
FIREBASE_SERVICE_ACC_BASE64=<base64_encoded_service_account>
FIREBASE_RTDB_URL=https://your-project.firebaseio.com

# Server
PORT=3000
NODE_ENV=development
```

### 3. Initialize Rider Groups

```bash
node scripts/setup-rider-groups.js
```

Output:
```
🚀 Setting up default rider groups...
✅ Created group: Nairobi CBD (nairobi_cbd)
✅ Created group: South Nairobi (nairobi_south)
✅ Created group: North Nairobi (nairobi_north)
✅ Created group: East Nairobi (nairobi_east)

✓ Rider groups initialized successfully!
```

### 4. Start Server

```bash
npm start
```

Server runs on `http://localhost:3000`

---

## File Structure

```
/workspaces/raha/
├── index.js                              # Express server
├── src/
│   ├── config/
│   │   └── firebase.js                   # Firebase init (Base64 decoding)
│   ├── services/
│   │   ├── stateService.js              # RTDB session management
│   │   └── riderService.js              # Rider logic (NEW)
│   └── bot/
│       ├── templates.js                 # Message templates
│       ├── engine.js                    # Customer bot (updated)
│       └── riderEngine.js               # Rider bot (NEW)
├── scripts/
│   └── setup-rider-groups.js            # Initialize groups (NEW)
├── package.json
└── .env                                  # Config
```

---

## Testing the System

### Test 1: Customer Order Flow

**Terminal 1: Start Server**
```bash
npm start
```

**Terminal 2: Test Customer Order**
```bash
curl -X POST http://localhost:3000/webhook \
  -d "From=whatsapp:+254797354429" \
  -d "To=whatsapp:+1234567890" \
  -d "Body=hi" \
  -d "MessageSid=SMxxxxx"
```

**Expected Flow**:
1. Customer: "hi"
2. Bot: Welcome menu
3. Customer: "1" (Order)
4. Bot: Meal options
5. Customer: "1" (Select meal)
6. Bot: Enter location
7. Customer: "Westlands Tower"
8. Bot: Confirm payment
9. Customer: "confirm"
10. Bot: Order confirmation
11. ✅ Check Firestore:
    - `/orders/ORD-xxx` created
    - `/order_queue/ORD-xxx` created with groupId: "nairobi_cbd"

### Test 2: Rider Queue & Booking

**Terminal 2: Test Rider Queue**
```bash
curl -X POST http://localhost:3000/webhook \
  -d "From=whatsapp:+254712345678" \
  -d "To=whatsapp:+1234567890" \
  -d "Body=hi" \
  -d "MessageSid=SMxxxxx"
```

**Expected Flow**:
1. Rider: "hi"
2. Bot: Rider menu
3. Rider: "1" (View Queue)
4. Bot: Shows pending orders (from step 1)
5. Rider: "1" (Book first order)
6. Bot: Order booked confirmation
7. ✅ Check Firestore:
    - `/bookings/BK-xxx` created
    - `/payments/BK-xxx` created with status: "held"
    - `/order_queue/ORD-xxx` status: "booked"

### Test 3: Delivery Status Updates

**Terminal 2: Update Status**
```bash
# Pickup ready
curl -X POST http://localhost:3000/webhook \
  -d "From=whatsapp:+254712345678" \
  -d "Body=1"

# In transit
curl -X POST http://localhost:3000/webhook \
  -d "From=whatsapp:+254712345678" \
  -d "Body=1"

# Delivered
curl -X POST http://localhost:3000/webhook \
  -d "From=whatsapp:+254712345678" \
  -d "Body=1"
```

**Expected Flow**:
- Status updates in `/bookings/{bookingId}`
- Timestamps recorded (pickupAt, inTransitAt, deliveredAt)

### Test 4: Funds Release

**Terminal 2: Confirm Delivery**
```bash
curl -X POST http://localhost:3000/webhook \
  -d "From=whatsapp:+254712345678" \
  -d "Body=1"
```

**Expected Flow**:
1. Rider: "1" (Confirm)
2. Bot: "Funds released!"
3. ✅ Check Firestore:
    - `/payments/BK-xxx`.status: "held" → "released"
    - `/payments/BK-xxx`.releasedAt: timestamp
    - `/orders/ORD-xxx`.status: "delivered"

---

## Key API Endpoints

### POST /webhook
Receives incoming WhatsApp messages from Twilio.

**Request**:
```json
{
  "From": "whatsapp:+254712345678",
  "To": "whatsapp:+1234567890",
  "Body": "hi",
  "MessageSid": "SMxxxxx"
}
```

**Response**:
```
200 OK
```

---

## Firestore Initialization

### Collections Created by Setup Script

```javascript
/rider_groups
├─ nairobi_cbd
│  ├─ name: "Nairobi CBD"
│  ├─ locationKeywords: ["cbd", "westlands", "karen", ...]
│  ├─ isDefault: true
│  └─ maxConcurrentOrders: 10
├─ nairobi_south
│  └─ ...
├─ nairobi_north
│  └─ ...
└─ nairobi_east
   └─ ...
```

### Collections Used by App

#### /orders/{orderId}
Created by: `BotEngine.createOrder()`
```javascript
{
  orderId: "ORD-1734506400000",
  phone: "whatsapp:+254797354429",
  mealName: "Beef & Mukimo",
  location: "Westlands Tower",
  price: 320,
  status: "pending_booking",
  createdAt: "2025-12-17T10:00:00Z"
}
```

#### /order_queue/{orderId}
Created by: `RiderService.createOrderQueueEntry()`
```javascript
{
  orderId: "ORD-1734506400000",
  groupId: "nairobi_cbd",
  status: "pending_booking",
  bookedBy: null,
  bookedAt: null,
  createdAtTimestamp: 1734506400000
}
```

#### /bookings/{bookingId}
Created by: `RiderService.bookOrder()`
```javascript
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
```

#### /payments/{bookingId}
Created by: `RiderService.bookOrder()`
```javascript
{
  bookingId: "BK-1734506400000-xyz123",
  orderId: "ORD-1734506400000",
  riderId: "whatsapp:+254712345678",
  amount: 320,
  status: "held",
  createdAt: "2025-12-17T10:05:00Z",
  releasedAt: null
}
```

---

## Debugging

### Enable Logging

All services log to console. Check terminal output:

```bash
[BotEngine] Received message from whatsapp:+254797354429
[RiderService] Assigned order to group: nairobi_cbd
[RiderService] Rider +254712345678 booked order ORD-1734506400000
[RiderService] Updated booking status to pickup_ready
```

### Check Database Manually

#### List Pending Orders
```bash
firebase database:get /order_queue --token your_token
```

#### Check Payment Status
```bash
firebase firestore:get payments/BK-xyz --token your_token
```

#### List Rider Bookings
```bash
firebase firestore:query bookings --where="riderId==whatsapp:+254712345678"
```

---

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| "Order not in queue" | Group assignment failed | Check location keywords in rider_groups |
| "Rider can't see menu" | State not initialized | Call updateUserState() in handleMessage() |
| "Funds stuck on held" | confirmDeliveryAndReleaseFunds() not called | Verify rider sent "confirm" and status is "delivered" |
| "Double booking" | Race condition | Verify Firestore transaction in bookOrder() |
| "Webhook not receiving" | Twilio not configured | Update TWILIO_PHONE_NUMBER in .env |

---

## Production Checklist

- [ ] Enable Twilio request signature verification
- [ ] Set up error monitoring (Sentry, etc.)
- [ ] Configure database backup
- [ ] Set up logging aggregation
- [ ] Create admin dashboard for fund releases
- [ ] Implement rate limiting on webhook
- [ ] Add phone number validation
- [ ] Set up automated tests
- [ ] Configure alerts for payment failures
- [ ] Create rider onboarding flow
- [ ] Document SLA for fund releases
- [ ] Set up metrics dashboard

---

## Scaling Considerations

### For 100+ Riders

1. **Database Indexing**
   - Index `/order_queue` by groupId + status
   - Index `/bookings` by riderId + status
   - Index `/payments` by status

2. **Query Optimization**
   - Limit queue query results
   - Cache group assignments
   - Use batch operations

3. **Performance**
   - Add CDN for static assets
   - Implement message queuing for async tasks
   - Use connection pooling

4. **Cost Optimization**
   - Implement data retention policies
   - Archive old orders
   - Optimize Firestore read/write patterns

---

## Extending the System

### Add New Delivery Zone
```bash
# Method 1: Via Firebase Console
Create document: /rider_groups/zone_name
{
  "name": "Your Zone",
  "locationKeywords": ["keyword1", "keyword2"],
  "isDefault": false,
  "maxConcurrentOrders": 5
}

# Method 2: Via Script
Create new zone in setup-rider-groups.js and re-run
```

### Add Rider to Group
```bash
# Create rider profile
/riders/whatsapp:+254712345678
{
  "name": "Rider Name",
  "phone": "whatsapp:+254712345678",
  "groupId": "nairobi_cbd",
  "status": "active",
  "totalDeliveries": 0
}
```

### Add Custom Payment Logic
Edit `confirmDeliveryAndReleaseFunds()` in riderService.js to integrate with M-Pesa API or payment gateway.

---

## Monitoring & Metrics

### Key Metrics to Track

```javascript
// Orders
- Total orders placed
- Orders in queue (pending_booking)
- Orders booked (booked)
- Orders delivered (delivered)
- Average time pending_booking → booked

// Riders
- Active riders
- Riders on delivery
- Average deliveries per rider
- Cancellation rate

// Payments
- Total amount held
- Total amount released
- Average time held → released
- Payment failures
```

### Sample Dashboard Query

```javascript
// Orders by status
db.collection('orders')
  .where('createdAtTimestamp', '>', Date.now() - 86400000) // Last 24h
  .get()
  .then(snap => {
    const statuses = {};
    snap.forEach(doc => {
      const status = doc.data().status;
      statuses[status] = (statuses[status] || 0) + 1;
    });
    console.log(statuses);
  });
```

---

## Support & Resources

- **Documentation**: See `README_RIDER_SYSTEM.md`
- **Deep Dive**: See `RIDER_BOOKING_DEEP_DIVE.md`
- **Quick Ref**: See `QUICK_REFERENCE.md`
- **Architecture**: See `ARCHITECTURE_DIAGRAMS.md`

---

## Next Steps

1. ✅ Run initialization script
2. ✅ Register first test rider
3. ✅ Conduct end-to-end testing
4. ✅ Deploy to staging
5. ✅ Onboard production riders
6. ✅ Monitor metrics
7. ✅ Iterate based on feedback

---

**Built for Roho Nourish** 🌿 Fuel for your day.
