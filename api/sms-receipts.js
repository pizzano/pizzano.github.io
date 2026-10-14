'use strict';
/** Read-only, token-free SMS receipt query via the private Apps Script health URL. */
module.exports = async function handler(req,res) {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET, OPTIONS');
  res.setHeader('Cache-Control','no-store, max-age=0');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({error:'Method not allowed'});
  const raw = typeof req.query.ids === 'string' ? req.query.ids : '';
  if (!raw || raw.length > 2600) return res.status(400).json({receipts:{}});
  const ids = [...new Set(raw.split(',').filter(id=>/^ord_[a-z0-9]{7,40}$/i.test(id)))].slice(0,40);
  if (!ids.length) return res.status(200).json({receipts:{}});
  const address = String(process.env.KOL_SMS_HEALTH_URL || '').trim();
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[a-zA-Z0-9_-]+\/exec$/.test(address)) return res.status(200).json({receipts:{}});
  const controller = new AbortController();
  const timeout = setTimeout(()=>controller.abort(), 6500);
  try {
    const u = new URL(address);
    u.searchParams.set('receiptIds',ids.join(','));
    const result = await fetch(u.href,{headers:{Accept:'application/json'},redirect:'follow',cache:'no-store',signal:controller.signal});
    if (!result.ok) return res.status(200).json({receipts:{}});
    const json = await result.json();
    const receiptObject = json && typeof json.receipts === 'object' && !Array.isArray(json.receipts) ? json.receipts : {};
    const clean = {};
    for (const id of ids) {
      if (!Object.prototype.hasOwnProperty.call(receiptObject,id)) continue;
      const record = receiptObject[id];
      if (!record || typeof record !== 'object') continue;
      const at = kind => {
        const num = Number(record[kind]);
        return Number.isSafeInteger(num) && num > 1500000000000 && num < Date.now()+300000 ? num : null;
      };
      clean[id] = {acceptedAt:at('acceptedAt'),readyAt:at('readyAt'),estimateUpdatedAt:at('estimateUpdatedAt')};
    }
    return res.status(200).json({receipts:clean});
  } catch (_) {
    return res.status(200).json({receipts:{}});
  } finally { clearTimeout(timeout); }
};
