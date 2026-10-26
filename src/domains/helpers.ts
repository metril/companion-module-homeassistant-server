import type { HassEntity } from 'home-assistant-js-websocket'
import type {
	SomeCompanionActionInputField,
	CompanionActionCallbackContext,
	CompanionActionEvent,
	CompanionBooleanFeedbackDefinition,
	CompanionFeedbackBooleanEvent,
	CompanionFeedbackInfo,
	CompanionPresetSection,
} from '@companion-module/base'
import type { ActionsSchema } from '../actions.js'
import { EntityMultiplePicker, EntityPicker, OnOffPicker } from '../choices.js'
import type { FeedbackId } from '../feedback.js'
import { invokeService } from '../hass/service.js'
import { OnOffToggle } from '../util.js'
import type { ActionResult, DomainContext, PresetsResult } from './types.js'

export const toIds = (v: unknown): string[] =>
	Array.isArray(v) ? v.map(String) : typeof v === 'string' && v ? [v] : []

/** Call `domain.service` for the entities selected in an action, with any extra service data */
export async function callEntityService(
	ctx: DomainContext,
	evt: CompanionActionEvent,
	context: CompanionActionCallbackContext,
	domain: string,
	service: string,
	extra?: object,
): Promise<ActionResult> {
	await invokeService(ctx.getClient(), {
		domain,
		service,
		data: { entity_id: evt.options.entity_id, ...extra },
		signal: context.signal,
	})
	return { service: `${domain}.${service}`, entity_id: toIds(evt.options.entity_id) }
}

export function checkEntityOnOffState(
	ctx: DomainContext,
	feedback: CompanionFeedbackBooleanEvent<{ entity_id: string; state: boolean }>,
): boolean {
	const entity = ctx.getStateObj()[feedback.options.entity_id]
	if (entity) {
		const isOn = entity.state === 'on'
		const targetOn = !!feedback.options.state
		return isOn === targetOn
	}
	return false
}

export function subscribeEntityPicker(
	ctx: DomainContext,
	feedback: CompanionFeedbackInfo<{ entity_id: string }>,
): void {
	ctx.subs.subscribe(feedback.options.entity_id, feedback.id, feedback.feedbackId)
}
export function unsubscribeEntityPicker(
	ctx: DomainContext,
	feedback: CompanionFeedbackInfo<{ entity_id: string }>,
): void {
	ctx.subs.unsubscribe(feedback.options.entity_id, feedback.id)
}

/** Boolean feedback which matches when an entity is on/off */
export function onOffStateFeedback(
	ctx: DomainContext,
	domain: string,
	name: string,
	description: string,
): CompanionBooleanFeedbackDefinition<{ entity_id: string; state: boolean }> {
	return {
		type: 'boolean',
		name,
		description,
		options: [EntityPicker(ctx.getState(), domain), OnOffPicker()],
		defaultStyle: {
			color: 0x000000,
			bgcolor: 0x00ff00,
		},
		callback: (feedback): boolean => {
			subscribeEntityPicker(ctx, feedback)
			return checkEntityOnOffState(ctx, feedback)
		},
		unsubscribe: (feedback) => unsubscribeEntityPicker(ctx, feedback),
	}
}

export interface EntityTemplatePresetParams {
	domain: string
	presetId: string
	/** Name of the preset, eg `Switch X` */
	name: string
	sectionId: string
	sectionName: string
	/** Prefix of each template value label, eg `Switch` */
	labelPrefix: string
	actionId: keyof ActionsSchema
	/** Toggle the entity on press, and show it as on with a feedback */
	toggleFeedbackId?: FeedbackId
	/** Extra options for the action, eg the fixed value to send */
	actionOptions?: Record<string, unknown>
	/** A feedback (other than the toggle on/off one) to put on the button */
	feedback?: { feedbackId: FeedbackId; options: Record<string, unknown> }
	notes?: string
}

/** The standard single-step "template over every entity of a domain" preset */
export function entityTemplatePreset(ctx: DomainContext, params: EntityTemplatePresetParams): PresetsResult {
	const sections: CompanionPresetSection[] = []
	const presets: PresetsResult[1] = {}

	const choices = EntityPicker(ctx.getState(), params.domain).choices
	if (choices.length === 0) return [sections, presets]

	const toggle = params.toggleFeedbackId !== undefined
	// The union of action/feedback ids is checked per domain, so the generic entries are cast
	const preset = {
		type: 'simple',
		name: params.name,
		notes:
			params.notes ??
			`Template: creates one button per ${params.labelPrefix.toLowerCase()} entity (stored in the entity-id local variable). ${toggle ? 'Pressing toggles it, and the button lights up while it is on.' : 'Pressing runs it.'}`,
		style: {
			text: `$(homeassistant-server:entity.$(local:entity-id))`,
			size: 'auto',
			color: 0xffffff,
			bgcolor: 0x000000,
		},
		feedbacks: params.feedback
			? [
					{
						feedbackId: params.feedback.feedbackId,
						options: { entity_id: { isExpression: true, value: '$(local:entity-id)' }, ...params.feedback.options },
						style: { bgcolor: 0x00ff00, color: 0x000000 },
					},
				]
			: toggle
				? [
						{
							feedbackId: params.toggleFeedbackId!,
							options: {
								entity_id: { isExpression: true, value: '$(local:entity-id)' },
								state: true,
							},
							style: {
								bgcolor: 0x00ff00,
								color: 0x000000,
							},
						},
					]
				: [],
		steps: [
			{
				down: [
					{
						actionId: params.actionId,
						options: {
							entity_id: { isExpression: true, value: '[$(local:entity-id)]' },
							...(toggle ? { state: OnOffToggle.Toggle } : {}),
							...params.actionOptions,
						},
					},
				],
				up: [],
			},
		],
		localVariables: [
			{
				variableType: 'simple',
				variableName: 'entity-id',
				startupValue: '',
			},
		],
	} as PresetsResult[1][string]
	presets[params.presetId] = preset

	sections.push({
		id: params.sectionId,
		name: params.sectionName,
		definitions: [
			{
				id: params.presetId,
				name: '',
				type: 'template',
				presetId: params.presetId,
				templateVariableName: 'entity-id',
				templateValues: choices.map((ent) => ({
					label: `${params.labelPrefix} ${ent.label}`,
					value: ent.id,
				})),
			},
		],
	})

	return [sections, presets]
}

export interface EntityActionSpec {
	name: string
	description?: string
	/** HA service domain, defaults to the domain of the picker */
	serviceDomain?: string
	service: string
	/** Extra input fields */
	fields?: SomeCompanionActionInputField[]
	/** Service data derived from the options */
	data?: (options: Record<string, any>) => object
	/**
	 * Call the service once per entity with data derived from that entity's state (eg for relative steps).
	 * Return undefined to skip the entity.
	 */
	perEntity?: (options: Record<string, any>, entity: HassEntity) => { service?: string; data: object } | undefined
}

/** Build simple "call a service on the selected entities" actions, each returning what was called */

export function entityActions(ctx: DomainContext, domain: string, specs: Record<string, EntityActionSpec>): any {
	const out: Record<string, unknown> = {}
	for (const [id, spec] of Object.entries(specs)) {
		out[id] = {
			name: spec.name,
			description: spec.description,
			hasResult: true,
			options: [EntityMultiplePicker(ctx.getState(), domain), ...(spec.fields ?? [])],
			callback: async (evt: CompanionActionEvent, context: CompanionActionCallbackContext): Promise<ActionResult> => {
				const serviceDomain = spec.serviceDomain ?? domain
				if (!spec.perEntity) {
					return callEntityService(ctx, evt, context, serviceDomain, spec.service, spec.data?.(evt.options))
				}
				const ids = toIds(evt.options.entity_id)
				for (const entityId of ids) {
					const entity = ctx.getStateObj()[entityId]
					if (!entity) throw new Error(`${entityId} is not available`)
					const call = spec.perEntity(evt.options, entity)
					if (!call) continue
					await invokeService(ctx.getClient(), {
						domain: serviceDomain,
						service: call.service ?? spec.service,
						data: { entity_id: entityId, ...call.data },
						signal: context.signal,
					})
				}
				return { service: `${serviceDomain}.${spec.service}`, entity_id: ids }
			},
		}
	}
	return out
}

/** Value feedback returning a numeric attribute of an entity (or `fallback` when missing) */
export function numberAttributeFeedback(
	ctx: DomainContext,
	domain: string,
	name: string,
	attribute: string,
	fallback: number,
	description?: string,
): any {
	return {
		type: 'value',
		name,
		description: description ?? `${attribute} of the entity, or ${fallback} if unavailable`,
		options: [EntityPicker(ctx.getState(), domain)],
		callback: (feedback: CompanionFeedbackInfo<{ entity_id: string }>): number => {
			subscribeEntityPicker(ctx, feedback)
			const v = Number(ctx.getStateObj()[feedback.options.entity_id]?.attributes[attribute])
			return Number.isFinite(v) ? v : fallback
		},
		unsubscribe: (feedback: CompanionFeedbackInfo<{ entity_id: string }>) => unsubscribeEntityPicker(ctx, feedback),
	}
}

/** Value feedback returning the state string, or a string attribute, of an entity */
export function textFeedback(ctx: DomainContext, domain: string, name: string, attribute?: string): any {
	return {
		type: 'value',
		name,
		options: [EntityPicker(ctx.getState(), domain)],
		callback: (feedback: CompanionFeedbackInfo<{ entity_id: string }>): string => {
			subscribeEntityPicker(ctx, feedback)
			const entity = ctx.getStateObj()[feedback.options.entity_id]
			if (!entity) return ''
			return attribute ? String(entity.attributes[attribute] ?? '') : entity.state
		},
		unsubscribe: (feedback: CompanionFeedbackInfo<{ entity_id: string }>) => unsubscribeEntityPicker(ctx, feedback),
	}
}
