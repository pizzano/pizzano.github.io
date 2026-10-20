/**
 * BETA multi-restaurant configuration.
 * Replace only these public branding/settings fields for a new restaurant.
 * No secrets, SMS tokens, or privileged Firebase credentials belong here.
 *
 * preview: local test orders ONLY; never sends a real restaurant order.
 * api: requires a separately deployed authenticated/validated backend.
 */
export const config = {
  tenantId: 'example-grill',
  mode: 'preview',
  apiBase: '',
  currency: 'NOK',
  locale: 'nb-NO',
  restaurant: {
    name: 'Din Restaurant',
    shortName: 'Din Restaurant',
    logo: '🍕',
    subtitle: 'Bestill takeaway',
    phone: '',
    address: 'Restaurantens adresse',
    postcode: '',
    city: '',
    pickupMinutes: 25,
    pickupIntervalMinutes: 15,
    openTimes: [
      {day: 'Mandag', from: '13:00', to: '22:00'},
      {day: 'Tirsdag', from: '13:00', to: '22:00'},
      {day: 'Onsdag', from: '13:00', to: '22:00'},
      {day: 'Torsdag', from: '13:00', to: '22:00'},
      {day: 'Fredag', from: '13:00', to: '23:00'},
      {day: 'Lørdag', from: '13:00', to: '23:00'},
      {day: 'Søndag', from: '13:00', to: '22:00'}
    ],
    themes: {primary:'#3e6649', dark:'#24332a', page:'#f5f7f1'},
    loyalty: {enabled:true, buy:10, free:1, eligibleCategory:'pizza'},
    showAllergensByDefault: true
  }
};
