'use strict';
/** Isolated BETA Firebase Cloud Functions v2 gateway; no Vercel in order requests. */
const {onRequest}=require('firebase-functions/v2/https');
const {defineSecret,defineString}=require('firebase-functions/params');
const handleOrders=require('./beta-handler.cjs');
const databaseUrl=defineString('BETA_FIREBASE_DATABASE_URL');
const adminEmail=defineString('BETA_ADMIN_EMAIL');
const emailFrom=defineString('BETA_EMAIL_FROM');
const sessionSecret=defineSecret('BETA_SESSION_SECRET');
const smsToken=defineSecret('BETA_SMS_GATEWAY_TOKEN');
const resendKey=defineSecret('BETA_RESEND_API_KEY');

exports.betaOrders=onRequest({
 region:'europe-west1',
 cors:false, // Strict CORS allowlist is implemented inside the handler.
 invoker:'public', // Customer checkout is public; admin mutations require OTP.
 memory:'512MiB',minInstances:0,maxInstances:3,concurrency:20,
 timeoutSeconds:240, // The bounded SSE listener closes after 210 seconds.
 secrets:[sessionSecret,smsToken,resendKey]
},(req,res)=>{
 // ADC uses Firebase-managed runtime identity, never a downloaded JSON key.
 process.env.BETA_FIREBASE_ADC='1';
 process.env.BETA_FIREBASE_DATABASE_URL=databaseUrl.value();
 process.env.BETA_ADMIN_EMAIL=adminEmail.value();
 process.env.BETA_EMAIL_FROM=emailFrom.value();
 process.env.BETA_SESSION_SECRET=sessionSecret.value();
 process.env.BETA_SMS_GATEWAY_TOKEN=smsToken.value();
 process.env.BETA_RESEND_API_KEY=resendKey.value();
 return handleOrders(req,res);
});
