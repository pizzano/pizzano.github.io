'use strict';

// Independent email channel: never imports or changes the SMS transport.
const crypto = require('node:crypto');
const {initializeApp, getApps} = require('firebase-admin/app');
const {getDatabase} = require('firebase-admin/database');
const {onValueUpdated} = require('firebase-functions/v2/database');
const {defineSecret} = require('firebase-functions/params');
const {logger} = require('firebase-functions');
const {notificationKind, pickupLabel} = require('./sms-core.cjs');

const webhookSecret = defineSecret('EMAIL_WEBHOOK_SECRET');
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxJ3zodPAhByPaEC7Z-_FPDjifsCT2-_ydcOTkr02bCnxqIMIDxNd6DhurHgF03SG4/exec';
if (!getApps().length) initializeApp({databaseURL:'https://kol-grill-pizza-default-rtdb.firebaseio.com'});

exports.emailOnOrderStatus = onValueUpdated({
  ref:'/orders/{orderId}',
  instance: 'kol-grill-pizza-default-rtdb',
  region:'europe-west1',
  secrets:[webhookSecret],
  maxInstances:3,
  memory:'256MiB',
  retry:false
},async (event)=>{
  if (process.env.EMAIL_NOTIFICATIONS_ENABLED !== 'true') return;
  const before = event.data.before.val(), after = event.data.after.val();
  const kind = notificationKind(before, after);
  if (!kind) return;
  const email = String(after?.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return;
  const secret = webhookSecret.value();
  if (!secret || secret.length < 32) {logger.error('Email secret missing');return;}
  const orderId = String(event.params.orderId || '');
  const db = getDatabase();
  const destination = db.ref('emailNotifications').child(orderId).child(kind);
  const reserved = await destination.transaction(current => current !== null ? undefined : {state:'sending',createdAt:Date.now(),eventId:event.id},undefined,false);
  if (!reserved.committed) return;
  try {
    const latest=(await db.ref('orders').child(orderId).get()).val();
    if (!latest || latest.status !== after.status || Number(latest.statusUpdatedAt || 0) !== Number(after.statusUpdatedAt || 0)) {
      await destination.update({state:'skipped',reason:'status_changed',updatedAt:Date.now()});
      return;
    }
    const payload = JSON.stringify({
      kind,orderId,
      email,
      customerName:String(latest.customerName || ''),
      pickupText:pickupLabel(latest)
    });
    const signature=crypto.createHmac('sha256',secret).update(payload,'utf8').digest('hex');
    const response=await fetch(WEB_APP_URL+'?sig='+signature,{method:'POST',headers:{'Content-Type':'application/json'},body:payload,signal:AbortSignal.timeout(20000)});
    const result=await response.json().catch(()=>null);
    if (!response.ok || !result?.ok) throw new Error('Email gateway returned failure');
    await destination.update({state:'sent',updatedAt:Date.now()});
    logger.info('Email gateway accepted notification',{kind,orderId});
  } catch (error) {
    await destination.update({state:'failed',updatedAt:Date.now()});
    logger.error('Email gateway failed',{kind,orderId,error:error.message});
  }
});
