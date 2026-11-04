/* Pure menu, settings and order normalization. No Firebase, DOM or global store. */
export function createDataNormalizers({
  DEFAULT_SETTINGS,
  DEFAULT_ALLERGENS,
  RESTAURANT_WEEKDAYS,
  ORDER_STATUSES,
  SCHEMA_VERSION,
  asArray,
  clone,
  uid,
  validClock,
  confirmationDeadline,
  buildIngredientRules,
  detectIngredientRules
}) {
  function normalizeSettings(raw) {
    const base = raw && typeof raw === 'object' ? raw : {};
    const settings = { ...DEFAULT_SETTINGS };
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      if (key === 'weeklyHours') continue;
      if (base[key] === undefined || base[key] === null) continue;
      const fallback = DEFAULT_SETTINGS[key];
      if (typeof fallback === 'number') {
        const num = Number(base[key]);
        settings[key] = Number.isFinite(num) ? num : fallback;
      } else if (typeof fallback === 'boolean') {
        settings[key] = base[key] === true || base[key] === 'true';
      } else {
        settings[key] = String(base[key]);
      }
    }
    // A saved settings object without this optional flag is NOT a manual closure.
    // DEFAULT_SETTINGS.manualClosed=true only protects startup before Firebase loads.
    if (raw && typeof raw === 'object' && raw.manualClosed == null) settings.manualClosed = false;
    // Normalize the seven-day schedule without reintroducing removed legacy fields.
    const rawWeek=base.weeklyHours;
    settings.weeklyHours=Array.isArray(rawWeek)&&rawWeek.length===7
      ? RESTAURANT_WEEKDAYS.map((day,i)=>({
          id:day.id,enabled:rawWeek[i]?.enabled!==false,
          open:validClock(rawWeek[i]?.open)||'14:00',
          close:validClock(rawWeek[i]?.close)||'22:00',
        })) : null;
    settings.manualClosedUntil=Number.isFinite(Number(base.manualClosedUntil))
      ? Math.max(0,Number(base.manualClosedUntil)):0;
    if (!['reference', 'lively', 'fresh', 'gourmet', 'emeraldGold', 'custom'].includes(settings.customerPalette)) settings.customerPalette = 'reference';
    settings.prepMinutes = Math.min(Math.max(settings.prepMinutes, 0), 240);
    settings.pickupLeadMinutes = Math.min(240,Math.max(15,Number(settings.pickupLeadMinutes)||30));
    settings.busyExtraMinutes = Math.min(90,Math.max(0,Math.round(Number(settings.busyExtraMinutes)||0)));
    settings.pickupCapacityMax = Math.min(30,Math.max(1,Math.round(Number(settings.pickupCapacityMax)||4)));
    settings.slotIntervalMinutes = Math.min(
      Math.max(settings.slotIntervalMinutes || 15, 5),
      60
    );
    // Shared customer/admin text sizes are bounded and integer-valued.
    // Old Firebase settings without uiFontXl get the new default automatically.
    for (const key of ['uiFontXs', 'uiFontSm', 'uiFontMd', 'uiFontLg', 'uiFontXl']) {
      const numeric = Number(settings[key]);
      settings[key] = Number.isFinite(numeric)
        ? Math.max(8, Math.min(36, Math.round(numeric))) : DEFAULT_SETTINGS[key];
    }
    for (const [field, low, high] of [
      ['printerQtySize', 28, 52],
      ['printerItemNameSize', 25, 45],
      ['printerSizeTextSize', 19, 38],
      ['printerExtraTextSize', 16, 33],
      ['printerPriceSize', 19, 34],
      ['printerSidePadding', 2, 18],
    ]) {
      settings[field] = Math.min(high, Math.max(low, Number(settings[field]) || DEFAULT_SETTINGS[field]));
    }
    return settings;
  }
  
  function normalizeAllergenCatalog(raw) {
    const list = asArray(raw)
      .map((entry) => {
        if (typeof entry === 'string') {
          return { id: entry.toLowerCase(), label: entry };
        }
        if (!entry || typeof entry !== 'object') return null;
        const id = String(entry.id || entry.label || '').toLowerCase();
        if (!id) return null;
        return { id, label: String(entry.label || entry.id) };
      })
      .filter(Boolean);
    return list.length ? list : clone(DEFAULT_ALLERGENS);
  }
  
  function normalizeOrders(raw) {
    return asArray(raw)
      .map((order) => {
        if (!order || typeof order !== 'object') return null;
        return {
          id: order.id || uid('ord'),
          createdAt: Number(order.createdAt) || 0,
          confirmationDeadline: confirmationDeadline(order),
          confirmationNoTimeout: order.confirmationNoTimeout === true,
          rejectionCode: String(order.rejectionCode || ''),
          customerName: String(order.customerName || ''),
          loyaltyReward: order.loyaltyReward || null,
          loyaltyConfirmedAt: Number(order.loyaltyConfirmedAt) || null,
          phone: String(order.phone || ''),
          orderPageUrl: String(order.orderPageUrl || ''),
          email: String(order.email || ''),
          // Only a MailApp success receipt saved by the email poller makes
          // admin show "E-post sendt". Missing receipts mean unverified.
          emailReceipts: order.emailReceipts && typeof order.emailReceipts === 'object'
            ? {
              accepted: order.emailReceipts.accepted || null,
              ready: order.emailReceipts.ready || null,
            } : null,
          // Preserve Traccar acknowledgements published by the SMS poller.
          smsReceipts: order.smsReceipts && typeof order.smsReceipts === 'object'
            ? {
              accepted: order.smsReceipts.accepted || null,
              ready: order.smsReceipts.ready || null,
              estimateUpdated: order.smsReceipts.estimateUpdated || null,
            } : null,
          pickup: String(order.pickup || ''),
          pickupMode: order.pickupMode === 'scheduled' || /^\d{1,2}:\d{2}$/.test(String(order.pickup || '')) ? 'scheduled' : 'asap',
          scheduledPickupAt: Number(order.scheduledPickupAt) || null,
          comment: String(order.comment || ''),
          type: String(order.type || 'henting'),
          status: order.status === 'fullfort' ||
            ORDER_STATUSES.some((s) => s.id === order.status)
            ? order.status
            : 'mottatt',
          statusUpdatedAt: Number(order.statusUpdatedAt) || 0,
          staffReadyAt: Number(order.staffReadyAt) || null,
          estimatedMinutes: Number(order.estimatedMinutes) > 0 ? Number(order.estimatedMinutes) : null,
          estimatedAt: Number(order.estimatedAt) || null,
          estimatedReadyAt: Number(order.estimatedReadyAt) || null,
          estimateUpdatedAt: Number(order.estimateUpdatedAt) || null,
          rejectionReason: String(order.rejectionReason || ''),
          rejectionMessage: String(order.rejectionMessage || ''),
          // A new order stores only total if subtotal is identical.
          // Read the missing subtotal as total for receipts and old UI.
          subtotal: order.subtotal == null ? Number(order.total) || 0 : Number(order.subtotal) || 0,
          total: Number(order.total) || 0,
          lines: asArray(order.lines).map((line) => ({
            itemId: String(line.itemId || ''),
            name: String(line.name || ''),
            loyaltyEligible: Boolean(line.loyaltyEligible),
            loyaltyFree: Boolean(line.loyaltyFree),
            size: String(line.size || ''),
            sizeId: String(line.sizeId || ''),
            optionIds: asArray(line.optionIds).filter(id => typeof id === 'string'),
            // These IDs are needed for an exact "Bestill samme igjen" action
            // after a refresh. Keep them in memory without adding DB fields.
            selections: line.selections && typeof line.selections === 'object'
              ? Object.fromEntries(Object.entries(line.selections)
                .filter(([, ids]) => Array.isArray(ids) && ids.length)
                .map(([group, ids]) => [group, ids.filter(id => typeof id === 'string')]))
              : {},
            unitPrice: line.unitPrice == null ? null : Number(line.unitPrice) || 0,
            comment: String(line.comment || ''),
            removedIngredients: asArray(line.removedIngredients)
              .map((name) => String(name || '').trim())
              .filter(Boolean),
            options: asArray(line.options).map((opt) =>
              typeof opt === 'string' ? opt : String(opt.label || '')
            ),
            // Preserve option prices for kitchen slips; line.price already includes extras.
            optionDetails: asArray(line.optionDetails).map((opt) => ({
              groupTitle: String(opt?.groupTitle || ''),
              label: String(opt?.label || ''),
              price: Number(opt?.price) || 0,
            })).filter((opt) => opt.label),
            quantity: Number(line.quantity) || 1,
            price: Number(line.price) || 0,
          })),
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.createdAt - a.createdAt);
  }
  
  function normalizeState(raw) {
    const base = raw && typeof raw === 'object' ? raw : {};
    const allergenCatalog = normalizeAllergenCatalog(base.allergenCatalog);
    const allergenIds = new Set(allergenCatalog.map((entry) => entry.id));
    const labelToId = new Map(
      allergenCatalog.map((entry) => [entry.label.toLowerCase(), entry.id])
    );
  
    const optionGroups = asArray(base.optionGroups).map((group) => ({
      id: group.id || uid('og'),
      title: typeof group.title === 'string' ? group.title : '',
      selectionMode: group.selectionMode === 'multiple' ? 'multiple' : 'single',
      required: Boolean(group.required),
      minSelections: group.required ? Math.max(1, Number(group.minSelections) || 1) : 0,
      allowQuantity: Boolean(group.allowQuantity),
      maxSelections: Number(group.maxSelections) > 0 ? Number(group.maxSelections) : 1,
      defaultOptionIds: asArray(group.defaultOptionIds).filter(
        (id) => typeof id === 'string'
      ),
      options: asArray(group.options).map((option) => ({
        id: option.id || uid('opt'),
        label: typeof option.label === 'string' ? option.label : '',
        price: Number(option.price) || 0,
        soldOut: Boolean(option.soldOut),
        // Per-choice allergen details are optional. Unknown is distinct from verified none.
        allergensReviewed: option.allergensReviewed === true,
        allergens: asArray(option.allergens)
          .map((entry) => {
            const value=String(entry||'').toLowerCase();
            return allergenIds.has(value) ? value : (labelToId.get(value) || '');
          })
          .filter(Boolean),
      })),
    }));
  
    const groupIds = new Set(optionGroups.map((group) => group.id));
  
    const sections = asArray(base.sections).map((section) => ({
      id: section.id || uid('sec'),
      title: typeof section.title === 'string' ? section.title : '',
      note: typeof section.note === 'string' ? section.note : '',
      imageUrl: typeof section.imageUrl === 'string' ? section.imageUrl : '',
      type: typeof section.type === 'string' ? section.type : '',
      items: asArray(section.items).map((item) => {
        const sizes = asArray(item.sizes).map((size) => ({
          id: size.id || uid('sz'),
          label: typeof size.label === 'string' ? size.label : '',
          price: Number(size.price) || 0,
          optionGroupIds: asArray(size.optionGroupIds).filter(id=>groupIds.has(id)),
        }));
        const maxIndex = Math.max(sizes.length - 1, 0);
        let ingredients =
          typeof item.ingredients === 'string' ? item.ingredients.trim() : '';
        const description =
          typeof item.description === 'string' ? item.description.trim() : '';
        const explicitRules = Array.isArray(item.ingredientRules) ? item.ingredientRules : [];
        if (!ingredients && explicitRules.length) ingredients = explicitRules.map(rule => typeof rule === 'string' ? rule : rule.name).filter(Boolean).join(', ');
        let ingredientRules = buildIngredientRules(ingredients, explicitRules);
        if (!ingredients && !item.ingredientDetectionInitialized) {
          ingredientRules = detectIngredientRules(description);
          ingredients = ingredientRules.map(rule => rule.name).join(', ');
        }
        const ingredientDefaults = Array.isArray(item.ingredientDefaults)
          ? buildIngredientRules(item.ingredientDefaults.map(rule => rule.name).join(', '), item.ingredientDefaults)
          : ingredientRules.map(rule => ({...rule}));
        return {
          id: item.id || uid('it'),
          name: typeof item.name === 'string' ? item.name.trim() : '',
          description: description || ingredients,
          ingredients,
          ingredientRules,
          ingredientDefaults,
          ingredientDetectionInitialized: true,
          ingredientRulesEdited: item.ingredientRulesEdited === true,
          imageUrl: typeof item.imageUrl === 'string' ? item.imageUrl : '',
          sizes,
          defaultSizeIndex: Math.min(
            Math.max(Number(item.defaultSizeIndex) || 0, 0),
            maxIndex
          ),
          allergens: asArray(item.allergens)
            .map((entry) => {
              const value = String(entry || '').toLowerCase();
              if (allergenIds.has(value)) return value;
              return labelToId.get(value) || '';
            })
            .filter(Boolean),
          optionGroupIds: asArray(item.optionGroupIds).filter((id) => groupIds.has(id)),
          optionGroupOrder: [...new Set(asArray(item.optionGroupOrder))].filter(id => groupIds.has(id) && [...asArray(item.optionGroupIds), ...sizes.flatMap(size => size.optionGroupIds)].includes(id)),
          hidden: Boolean(item.hidden),
          soldOut: Boolean(item.soldOut),
        };
      }),
    }));
  
    // Rydd defaults som ikke finnes blant alternativene.
    for (const group of optionGroups) {
      const optionIds = new Set(group.options.map((option) => option.id));
      group.defaultOptionIds = group.defaultOptionIds.filter((id) => optionIds.has(id));
      if (group.selectionMode === 'single') {
        group.maxSelections = 1;
        group.defaultOptionIds = group.defaultOptionIds.slice(0, 1);
      } else {
        // For repeatable add-ons, maxSelections is a cap on TOTAL servings,
        // not on distinct option labels. The customer may take e.g. 3 garlic
        // sauces even when the group contains only two kinds of sauce.
        group.maxSelections = Math.min(
          Math.max(group.maxSelections, 1),
          group.allowQuantity ? 30 : Math.max(group.options.length, 1)
        );
      }
    }
  
    const validItemIds = new Set(
      sections.flatMap((section) => section.items.map((item) => item.id))
    );
  
    return {
      schemaVersion: SCHEMA_VERSION,
      settings: normalizeSettings(base.settings),
      allergenCatalog,
      sections,
      optionGroups,
      popularItemIds: asArray(base.popularItemIds).filter((id) => validItemIds.has(id)),
      orders: normalizeOrders(base.orders),
      updatedAt: Number(base.updatedAt) || Date.now(),
    };
  }
  return { normalizeSettings, normalizeAllergenCatalog, normalizeOrders, normalizeState };
}


/** Conservative suggestions from Norwegian menu descriptions; never guesses allergens. */
export function detectIngredientRules(description) {
  const vocabulary = ['hvit pizzasaus','pizzasaus','tomatsaus','hvitløkssaus','béarnaisesaus','BBQ-saus','tacosaus','dressing','parmaskinke','pepperoni','skinke','bacon','biffkjøtt','biff','kyllingkjøtt','kylling','kyllingkebab','dönerkebab','kebabkjøtt','blåmuggost','parmesanost','cheddarost','gorgonzola','ost','pestoolje','ruccola','jalapeño','paprika','rødløk','løk','sopp','mais','ananas','soltørkede tomater','tomater','tomat','agurk','salatblanding','salat','nachos','hvitløk','pommes frites','remulade','smør','brød'];
  const text = String(description || '').toLocaleLowerCase('no').replace(/[^.!?]*\beller\b[^.!?]*/g, '');
  const matches = [];
  for (const name of vocabulary) {
    const re = new RegExp(`(?<![\\p{L}])${name}(?![\\p{L}])`, 'giu');
    for (const match of text.matchAll(re)) matches.push({ name, start: match.index, end: match.index + name.length });
  }
  // Prefer full names over overlapping words (e.g. rødløk over løk).
  const seen = new Set();
  return matches.filter(a => !matches.some(b => b !== a && b.start <= a.start && b.end >= a.end && b.end-b.start > a.end-a.start))
    .sort((a,b) => a.start-b.start).filter(a => { const key=a.name.toLocaleLowerCase('no'); if(seen.has(key))return false;seen.add(key);return true; })
    .map(({name}) => ({ name: name[0].toLocaleUpperCase('no')+name.slice(1), removable: true }));
}
