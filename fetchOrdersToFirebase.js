// filename: fetchOrdersToFirebase.js

import fetch from 'node-fetch';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, push, set } from 'firebase/database';

// Firebase config
const firebaseConfig = {
  databaseURL: 'https://bestill-pizza-default-rtdb.europe-west1.firebasedatabase.app'
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Fetch orders from external source
async function fetchOrders() {
  try {
    const response = await fetch('https://pizzano-github-io.onrender.com/orders');
    const data = await response.json();

    // Only keep latest 10 orders (first element in your array)
    const latestOrders = data[0]?.orders?.slice(0, 10) || [];

    for (const order of latestOrders) {
      const orderRef = push(ref(db, 'orders'));
      await set(orderRef, {
        name: `${order.client_first_name} ${order.client_last_name}`,
        phone: order.client_phone,
        total: order.total_price,
        time: order.updated_at,
        item: order.items?.[0]?.name || 'N/A',
        size: order.items?.[0]?.options?.find(opt => opt.group_name.includes('Størrelse'))?.name || 'N/A',
        topping: order.items?.[0]?.options?.find(opt => opt.group_name.includes('Alternativer'))?.name || 'N/A'
      });
    }

    console.log('✅ Orders sent to Firebase!');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run once immediately
fetchOrders();

// Optional: schedule to run every 60 seconds
setInterval(fetchOrders, 60000);
