import type {
	CompanionActionCallbackContext,
	CompanionActionEvent,
	CompanionBooleanFeedbackDefinition,
	CompanionFeedbackBooleanEvent,
	CompanionFeedbackInfo,
	CompanionPresetSection,
} from '@companion-module/base'
import type { ActionsSchema } from '../actions.js'
import { EntityPicker, OnOffPicker } from '../choices.js'
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
		notes: `Template: creates one button per ${params.labelPrefix.toLowerCase()} entity (stored in the entity-id local variable). ${toggle ? 'Pressing toggles it, and the button lights up while it is on.' : 'Pressing runs it.'}`,
		style: {
			text: `$(homeassistant-server:entity.$(local:entity-id))`,
			size: 'auto',
			color: 0xffffff,
			bgcolor: 0x000000,
		},
		feedbacks: toggle
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
