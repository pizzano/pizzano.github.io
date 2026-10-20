/** BETA configuration. The menu is read from Firebase, never stored in source files.
 * Each future restaurant can use a separate Firebase instance or a scoped public path.
 * Never put private credentials or customer-data database paths in this config.
 */
export const config={
  tenantId:'kol-grill-pizza',
  mode:'api',     // Live mode requires a configured backend. No direct browser writes to Firebase.
  apiBase:'',      // Enter an authenticated server endpoint only when ready for live orders.
  locale:'nb-NO',
  currency:'NOK',
  menu:{
    databaseUrl:'https://kol-grill-pizza-default-rtdb.firebaseio.com',
    basePath:'',                  // Legacy DEMO public menu fields in database root.
    revisionField:'updatedAt',
    revalidateMs:5*60*1000
  },
  restaurant:{
    name:'Restauranten', logo:'🍕',logoUrl:'',phone:'',email:'skarnes.restaurant@gmail.com',address:'',city:'',postcode:'',paymentInfo:'Kort og kontant',
    pickupMinutes:25,pickupIntervalMinutes:15,timezone:'Europe/Oslo',
    manualClosed:false,manualClosedUntil:0,
    openTimes: Array.from({length:7},()=>({enabled:true,from:'14:00',to:'22:00'})),
    palette:'reference', // reference | lively | fresh | gourmet (also settable via Firebase customerPalette).
    loyalty:{enabled:true,buy:10,free:1,eligibleCategory:'pizza'},
    showAllergensByDefault:true,
    ingredientCustomizationEnabled:true
  }
};
