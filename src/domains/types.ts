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

import type {
	CompanionActionDefinitions,
	CompanionFeedbackDefinitions,
	CompanionPresetDefinitions,
	CompanionPresetSection,
} from '@companion-module/base'
import type { Connection, HassEntities, HassEntity, HassServices } from 'home-assistant-js-websocket'
import type { Registries } from '../hass/registries.js'
import type { HassSchema } from '../schema.js'
import type { EntitySubscriptions } from '../state.js'

/** Shared, lazily-read state handed to every domain. All getters return the current value at call time. */
export interface DomainContext {
	getState: () => HassEntity[]
	getStateObj: () => HassEntities
	getServices: () => HassServices
	getClient: () => Connection | undefined
	getRegistries: () => Registries
	subs: EntitySubscriptions
}

/** Result of an action: what was called, and on which entities */
export type ActionResult = { service: string; entity_id: string[] }

/** Schema of an action which takes entity ids plus extra options */
export type EntityAction<X extends object = object> = { options: { entity_id: string[] } & X; result: ActionResult }

export type PresetsResult = [CompanionPresetSection[], CompanionPresetDefinitions<HassSchema>]

export interface DomainDefinition<
	A extends Record<string, any> = Record<string, never>,
	F extends Record<string, any> = Record<string, never>,
> {
	/** HA domain this definition belongs to. Registered only when at least one entity of that domain exists. */
	id: string
	/** Further HA domains whose entities this definition handles (eg input_number for number) */
	alsoDomains?: string[]
	/** Always register, regardless of which entities exist (eg the generic call_service action) */
	alwaysRegister?: boolean
	actions?: (ctx: DomainContext) => CompanionActionDefinitions<A>
	feedbacks?: (ctx: DomainContext) => CompanionFeedbackDefinitions<F>
	presets?: (ctx: DomainContext) => PresetsResult
}

/** Identity helper that keeps the action/feedback schema generics inferred */
export function defineDomain<
	A extends Record<string, any> = Record<string, never>,
	F extends Record<string, any> = Record<string, never>,
>(def: DomainDefinition<A, F>): DomainDefinition<A, F> {
	return def
}
