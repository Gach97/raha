/**
 * Rider Groups Setup
 * 
 * This script initializes default rider groups (delivery zones) in Firestore.
 * Run once during deployment or when adding new delivery zones.
 * 
 * Usage:
 * node scripts/setup-rider-groups.js
 */

const { db } = require('../src/config/firebase');

const DEFAULT_RIDER_GROUPS = [
  {
    id: 'nairobi_cbd',
    name: 'Nairobi CBD',
    description: 'Central Business District: Westlands, Upper Hill, Karen, Kilimani',
    locationKeywords: ['cbd', 'westlands', 'upper hill', 'karen', 'kilimani', 'parklands'],
    isDefault: true,
    maxConcurrentOrders: 10,
    avgDeliveryTime: 30, // minutes
    createdAt: new Date().toISOString(),
  },
  {
    id: 'nairobi_south',
    name: 'South Nairobi',
    description: 'Langata, Otiende, Riverside, Lavington',
    locationKeywords: ['langata', 'otiende', 'riverside', 'lavington', 'south c'],
    isDefault: false,
    maxConcurrentOrders: 8,
    avgDeliveryTime: 35,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'nairobi_north',
    name: 'North Nairobi',
    description: 'Runda, Gigiri, Muthaiga, Brookside',
    locationKeywords: ['runda', 'gigiri', 'muthaiga', 'brookside', 'north'],
    isDefault: false,
    maxConcurrentOrders: 6,
    avgDeliveryTime: 40,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'nairobi_east',
    name: 'East Nairobi',
    description: 'Industrial Area, Embakasi, Eastleigh',
    locationKeywords: ['industrial', 'embakasi', 'eastleigh', 'east'],
    isDefault: false,
    maxConcurrentOrders: 7,
    avgDeliveryTime: 35,
    createdAt: new Date().toISOString(),
  },
];

async function setupRiderGroups() {
  try {
    console.log('🚀 Setting up default rider groups...\n');

    for (const group of DEFAULT_RIDER_GROUPS) {
      await db.collection('rider_groups').doc(group.id).set(group);
      console.log(`✅ Created group: ${group.name} (${group.id})`);
    }

    console.log('\n✓ Rider groups initialized successfully!');
  } catch (error) {
    console.error('❌ Error setting up rider groups:', error);
    process.exit(1);
  }
}

// Run setup
setupRiderGroups().then(() => process.exit(0));
