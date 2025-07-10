import { promises as fs } from 'fs';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Only POST allowed');

  const filePath = path.join(process.cwd(), 'orders.json');

  let orders = [];
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    orders = JSON.parse(data);
  } catch {
    orders = [];
  }

  orders.unshift(req.body);

  if (orders.length > 10) orders = orders.slice(0, 10);

  await fs.writeFile(filePath, JSON.stringify(orders, null, 2));
  console.log("✅ Sipariş alındı!");
  res.status(200).end('OK');
}
