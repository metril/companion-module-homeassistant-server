import type { JsonValue } from '@companion-module/base'
import { atLeastHaVersion } from 'home-assistant-js-websocket/dist/util.js'
import { AttributePicker, ComparisonPicker, EntityPicker, TargetPicker, type Comparison } from '../choices.js'
import { compareValues, readValue } from '../hass/compare.js'
import { invokeService } from '../hass/service.js'
import { buildTarget, resolveReturnResponse } from '../hass/targets.js'
import { subscribeEntityPicker, unsubscribeEntityPicker } from './helpers.js'
import { defineDomain } from './types.js'

export type GenericActions = {
	call_service: {
		options: {
			entity_id: string[]
			target_type: string
			target_area: string[]
			target_device: string[]
			target_floor: string[]
			target_label: string[]
			service: string
			payload: string
			return_response: boolean
		}
		result: JsonValue
	}
}

export type GenericFeedbacks = {
	entity_state_value: { type: 'value'; options: { entity_id: string; attribute: string }; result: JsonValue }
	entity_compare: {
		type: 'value'
		options: { entity_id: string; attribute: string; comparison: Comparison; value: string }
		result: boolean
	}
}

export const genericDomain = defineDomain<GenericActions, GenericFeedbacks>({
	id: 'generic',
	alwaysRegister: true,
	actions: (ctx) => {
		const services = ctx.getServices()
		const registries = ctx.getRegistries()

		const serviceChoices = Object.entries(services).flatMap(([domain, domainServices]) =>
			Object.entries(domainServices).map(([service, props]) => ({
				id: `${domain}.${service}`,
				label: props.name ? `${domain}: ${props.name}` : `${domain}.${service}`,
			})),
		)

		return {
			call_service: {
				name: 'Call Service',
				description: 'Call any Home Assistant service on entities, areas, floors, labels or devices',
				hasResult: true,
				options: [
					// The entity field keeps the id `entity_id` of the original option
					...TargetPicker(ctx.getState(), registries, undefined, registries.supportsFloorsAndLabels()),
					{
						id: 'service',
						label: 'Service',
						type: 'dropdown',
						default: serviceChoices[0]?.id,
						choices: serviceChoices,
						allowCustom: true,
					},
					{
						type: 'textinput',
						id: 'payload',
						tooltip: 'Must be valid JSON!',
						default: '{ "option": "value" }',
						label: 'Payload',
						useVariables: true,
					},
					{
						type: 'checkbox',
						id: 'return_response',
						label: 'Return response',
						default: false,
						tooltip:
							'Return the service response as the action result. Only used by services which can return a response',
						// Needs HA 2023.7+
						...(atLeastHaVersion(ctx.getClient()?.haVersion ?? '0.0.0', 2023, 7, 0)
							? {}
							: { isVisibleExpression: 'false' }),
					},
				],
				callback: async (evt, context) => {
					const options = evt.options
					const payload = JSON.parse(options.payload)

					// Split the domain off of the service name
					const [domain, service] = `${options.service}`.split('.', 2)
					const serviceDefinition = ctx.getServices()[domain]?.[service]
					if (!serviceDefinition) throw new Error(`Unknown service ${options.service}`)

					const target = buildTarget(options)
					const selectedEntities = target.entity_id as string[] | undefined
					if (selectedEntities && serviceDefinition.fields.entity_id) {
						const entityIdSelector = serviceDefinition.fields.entity_id.selector as any | undefined
						const selectorSupportsMultipleEntities = entityIdSelector?.entity?.multiple

						if (selectedEntities.length > 1 && !selectorSupportsMultipleEntities) {
							throw new Error(`The service ${options.service} only supports a single entity_id`)
						}

						payload.entity_id = selectorSupportsMultipleEntities ? selectedEntities : selectedEntities[0]
					}

					const returnResponse = resolveReturnResponse(
						serviceDefinition.response,
						!!options.return_response,
						ctx.getClient()?.haVersion,
					)

					const result = await invokeService(ctx.getClient(), {
						domain,
						service,
						data: payload,
						target: serviceDefinition.target ? target : undefined,
						returnResponse,
						signal: context.signal,
					})
					return (
						returnResponse ? ((result as { response?: unknown } | undefined)?.response ?? null) : null
					) as JsonValue
				},
			},
		}
	},
	feedbacks: (ctx) => ({
		entity_state_value: {
			type: 'value',
			name: 'Entity state or attribute value',
			description: 'The state (or an attribute) of an entity, for use in expressions and text',
			options: [EntityPicker(ctx.getState(), undefined), AttributePicker()],
			callback: (feedback): JsonValue => {
				subscribeEntityPicker(ctx, feedback)
				const value = readValue(ctx.getStateObj()[feedback.options.entity_id], feedback.options.attribute)
				return (value ?? null) as JsonValue
			},
			unsubscribe: (feedback) => unsubscribeEntityPicker(ctx, feedback),
		},
		entity_compare: {
			type: 'value',
			name: 'Compare entity state or attribute',
			description: 'True when the entity value matches the comparison',
			options: [
				EntityPicker(ctx.getState(), undefined),
				AttributePicker(),
				ComparisonPicker(),
				{ type: 'textinput', id: 'value', label: 'Value', default: '', useVariables: true },
			],
			callback: (feedback): boolean => {
				subscribeEntityPicker(ctx, feedback)
				const actual = readValue(ctx.getStateObj()[feedback.options.entity_id], feedback.options.attribute)
				return compareValues(actual, feedback.options.comparison, feedback.options.value)
			},
			unsubscribe: (feedback) => unsubscribeEntityPicker(ctx, feedback),
		},
	}),
})
