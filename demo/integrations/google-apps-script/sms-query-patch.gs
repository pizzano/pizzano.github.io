/**
 * Optimized reader for the existing LIVE "KOL SMS Gateway" Apps Script.
 *
 * REPLACE ONLY function kolFetchRecentOrders_() in its existing Kode.gs
 * with the function below. Do NOT paste a second copy of the function.
 * All other Traccar / TEST-LIVE / manual-ready / duplicate / time SMS code
 * remains exactly as-is. Do not run setupLiveSms() again.
 *
 * Database query requirement: RTDB /orders .indexOn must contain
 * ["statusUpdatedAt", "estimateUpdatedAt"].
 *
 * Status query: order confirmed / manually ready.
 * Estimate query: "Endre tid" saved by staff, status is unchanged.
 */
function kolFetchRecentOrders_() {
  const now = Date.now();
  const windowMs = Math.min(
    KOL_SMS.orderAgeLimitMs,
    Math.max(KOL_SMS.eventAgeLimitMs + 5 * 60 * 1000, 20 * 60 * 1000)
  );
  const since = now - windowMs;
  const orders = {};

  function fetchChangesBy_(field) {
    const url = KOL_SMS.databaseUrl + '/orders.json?orderBy=' +
      encodeURIComponent(JSON.stringify(field)) +
      '&startAt=' + encodeURIComponent(String(since));
    const response = UrlFetchApp.fetch(url, {
      method: 'get', muteHttpExceptions: true
    });
    if (response.getResponseCode() !== 200) {
      throw new Error('Firebase order index / ' + field + ': HTTP ' +
        response.getResponseCode());
    }
    const data = JSON.parse(response.getContentText() || 'null');
    if (data && typeof data === 'object') {
      Object.keys(data).forEach(function(id) { orders[id] = data[id]; });
    }
  }

  try {
    fetchChangesBy_('statusUpdatedAt');
    fetchChangesBy_('estimateUpdatedAt');
    return orders;
  } catch (error) {
    // Keeps the original limited-key behavior if the index is not installed.
    // Do not fall back to an UNBOUNDED /orders.json read.
    console.warn('KOL SMS: indeksert lesing feilet. Reservegrense ' +
      KOL_SMS.recentOrders + '. ' + error.message);
    const fallbackUrl = KOL_SMS.databaseUrl + '/orders.json?orderBy=' +
      encodeURIComponent(JSON.stringify('$key')) +
      '&limitToLast=' + KOL_SMS.recentOrders;
    const response = UrlFetchApp.fetch(fallbackUrl, {
      method: 'get', muteHttpExceptions: true
    });
    if (response.getResponseCode() !== 200) {
      throw new Error('Firebase SMS reservelesing feilet: HTTP ' +
        response.getResponseCode());
    }
    const data = JSON.parse(response.getContentText() || 'null');
    return data && typeof data === 'object' ? data : {};
  }
}
