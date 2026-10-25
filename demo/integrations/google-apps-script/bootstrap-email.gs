/**
 * Permanent GitHub loader. Paste this bootstrap into Google Apps Script ONCE.
 *
 * Source pointer lives in Firebase:
 *   <CODE_FEED_DB_URL>/integrations/runtimeScripts.json
 * Each change is authenticated with HMAC-SHA256 using CODE_FEED_HMAC_KEY,
 * stored privately in the Google Apps Script project.
 *
 * The filename, repository, branch, path and customer domain can all change
 * without changing this script; only the signed pointer needs updating.
 */
function runtimeSource_(role, action) {
  // Read both Firebase pointer and GitHub source only on cache misses.
  // Cache is a performance optimization and may be evicted earlier by Google.
  const cache = CacheService.getScriptCache();
  const cacheKey = 'bestill-runtime-source-v2-' + role;
  let source = cache.get(cacheKey);
  if (!source) {
    source = loadRuntimeSource_(role);
    try { cache.put(cacheKey, source, 3600); }
    catch (error) { console.warn('Kildecache utilgjengelig: ' + error.message); }
  }
  // "action" is a hard-coded function name defined in this bootstrap only.
  // All referenced helper functions and constants share this local source.
  const program = new Function(source + '\nreturn typeof ' + action +
    ' === "function" ? ' + action + ' : null;')();
  if (typeof program !== 'function')
    throw new Error('Mangler funksjon i GitHub-koden: ' + action);
  return program();
}

function loadRuntimeSource_(role) {
  const props = PropertiesService.getScriptProperties();
  const database = String(props.getProperty('CODE_FEED_DB_URL') || '').replace(/\/+$/, '');
  const signingKey = String(props.getProperty('CODE_FEED_HMAC_KEY') || '');
  if (!/^https:\/\/[a-z0-9.-]+\.firebaseio\.com$/i.test(database) &&
      !/^https:\/\/[a-z0-9.-]+\.firebasedatabase\.app$/i.test(database))
    throw new Error('CODE_FEED_DB_URL mangler eller er ugyldig');
  if (signingKey.length < 32)
    throw new Error('CODE_FEED_HMAC_KEY må være en hemmelig nøkkel på minst 32 tegn');

  const feedResponse = UrlFetchApp.fetch(
    database + '/integrations/runtimeScripts.json',
    {muteHttpExceptions:true,followRedirects:false}
  );
  if (feedResponse.getResponseCode() !== 200) throw new Error('Kunne ikke lese kildeoversikt');
  const config = JSON.parse(feedResponse.getContentText());
  if (!config || config.version !== 1 || typeof config.sms !== 'string' ||
      typeof config.email !== 'string' || typeof config.signature !== 'string')
    throw new Error('Ugyldig oppsett av skriptkilder');

  const signedText = 'v1\n' + config.sms + '\n' + config.email;
  const signature = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(signedText, signingKey)
  ).replace(/=+$/, '');
  if (signature.length !== config.signature.length)
    throw new Error('Feil signatur i kildeoversikten');
  let difference = 0;
  for (let i = 0; i < signature.length; i++)
    difference |= signature.charCodeAt(i) ^ config.signature.charCodeAt(i);
  if (difference !== 0) throw new Error('Skriptkilden er ikke autorisert');

  const url = String(config[role] || '');
  if (url.length > 550 ||
      !/^https:\/\/raw\.githubusercontent\.com\/[a-zA-Z0-9-]+\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.%/-]+$/.test(url) ||
      url.indexOf('/../') !== -1 || url.indexOf('/./') !== -1)
    throw new Error('Kun GitHub-kilder med gyldig HTTPS URL er tillatt');

  const codeResponse = UrlFetchApp.fetch(url, {
    muteHttpExceptions:true, followRedirects:false
  });
  if (codeResponse.getResponseCode() !== 200) throw new Error('GitHub kildekode utilgjengelig');
  const source = codeResponse.getContentText();
  if (source.length < 200 || source.length > 120000)
    throw new Error('GitHub kildekode har uventet størrelse');

  return source;
}

/* Keep exact trigger/test names from the existing email project. */
function kontrollerEpostBestillinger(){ return runtimeSource_('email','kontrollerEpostBestillinger'); }
function installerEpostVarsler(){ return runtimeSource_('email','installerEpostVarsler'); }
function kontrollerEpostTestNaa(){ return runtimeSource_('email','kontrollerEpostTestNaa'); }
function stoppEpostVarsler(){ return runtimeSource_('email','stoppEpostVarsler'); }
