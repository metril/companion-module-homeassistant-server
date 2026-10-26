/*
 * Confirmed @companion-module/base 2.2.1 API (module-api/{action,feedback,preset/definition}.d.ts):
 *
 * Action results:   schema `{ options, result: TResult }` + definition `hasResult: true`;
 *                   callback returns `TResult | Promise<TResult>` (JsonValue). Without `result`, callback returns void.
 * Abort signal:     `context.signal: AbortSignal` on CompanionActionCallbackContext (2nd callback arg) and on
 *                   CompanionFeedbackCallbackContext. Optional to honour; throw to stop.
 * Value feedback:   schema `{ type: 'value', options, result: TResult }`; definition `type: 'value'`,
 *                   callback returns `TResult | Promise<TResult>`. No defaultStyle / showInvert.
 * Advanced fb:      definition `type: 'advanced'`, REQUIRED `affectedProperties: Array<'text'|'size'|'color'|'bgcolor'|
 *                   'alignment'|'pngalignment'|'png64'|'imageBuffer'> | undefined`; callback returns CompanionAdvancedFeedbackResult.
 * Boolean fb:       `type: 'boolean'`, `defaultStyle`, optional `showInvert`.
 * Preset notes:     `notes?: string` on CompanionPresetDefinitionBase (copied onto the button).
 * Feedback `learn`/`unsubscribe`, action `learn`/`subscribe` unchanged from 2.0.
 *
 * home-assistant-js-websocket 9.7.1: getCollection(conn, key, fetch, subscribeUpdates, options?) exists;
 * the built-in subscribeEntities does NOT accept entity_ids (sends bare `subscribe_entities`), hence the
 * module-local implementation in hass/entities.ts which adds `entity_ids`.
 */
export {}
