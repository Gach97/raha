#!/bin/bash
# Test script for Roho Bot
# Usage: bash test-bot.sh

BASE_URL="http://localhost:3000"

echo "🤖 Roho Bot - Test Script"
echo "=========================="
echo ""

# Test 1: Health check
echo "1️⃣  Testing health endpoint..."
curl -s ${BASE_URL}/health | jq '.'
echo ""
echo ""

# Test 2: Register first rider
echo "2️⃣  Registering rider 1..."
RIDER1_RESPONSE=$(curl -s -X POST ${BASE_URL}/admin/register-rider \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "whatsapp:+254712345678",
    "name": "John Mwangi"
  }')
echo "$RIDER1_RESPONSE" | jq '.'
echo ""
echo ""

# Test 3: Register second rider
echo "3️⃣  Registering rider 2..."
RIDER2_RESPONSE=$(curl -s -X POST ${BASE_URL}/admin/register-rider \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "whatsapp:+254798765432",
    "name": "Jane Kipchoge"
  }')
echo "$RIDER2_RESPONSE" | jq '.'
echo ""
echo ""

# Test 4: List all riders
echo "4️⃣  Listing all registered riders..."
curl -s ${BASE_URL}/admin/riders | jq '.'
echo ""
echo ""

# Test 5: Test registration with missing field
echo "5️⃣  Testing registration with missing name (should fail)..."
curl -s -X POST ${BASE_URL}/admin/register-rider \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "whatsapp:+254700000000"
  }' | jq '.'
echo ""
echo ""

# Test 6: Test registration with invalid phone format
echo "6️⃣  Testing registration with invalid phone format (should fail)..."
curl -s -X POST ${BASE_URL}/admin/register-rider \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+254712345678",
    "name": "Invalid Phone"
  }' | jq '.'
echo ""
echo ""

echo "✅ Tests complete!"
echo ""
echo "📱 Next steps:"
echo "  1. Send WhatsApp messages to test the bot"
echo "  2. Customer message → Should get food menu"
echo "  3. Rider (+254712345678) sends 'orders' → Should see pending"
echo "  4. Rider sends 'book ORD-123' → Should book order"
echo "  5. Rider sends 'delivered BOOK-456' → Should release funds"
