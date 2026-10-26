import type { HassServiceTarget } from 'home-assistant-js-websocket'
import type { DropdownChoice } from '@companion-module/base'
import { EntityMultiplePicker } from '../choices.js'
import { invokeService } from '../hass/service.js'
import { defineDomain } from './types.js'

export type GenericActions = {
	call_service: { options: { entity_id: string[]; service: string; payload: string } }
}

export const genericDomain = defineDomain<GenericActions>({
	id: 'generic',
	alwaysRegister: true,
	actions: (ctx) => {
		const initialServices = ctx.getServices()

		const serviceChoices: DropdownChoice[] = []
		for (const [domain, services] of Object.entries(initialServices)) {
			for (const [service, props] of Object.entries(services)) {
				const id = `${domain}.${service}`
				serviceChoices.push({
					id: id,
					label: props.name ? `${domain}: ${props.name}` : id,
				})
			}
		}

		return {
			call_service: {
				name: 'Call Service',
				description: 'Please open a feature request, so that useful things are properly supported',
				options: [
					EntityMultiplePicker(ctx.getState(), undefined),
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
				],
				callback: async (evt, context) => {
					try {
						const payload = JSON.parse(evt.options.payload)

						// Split the domain off of the service name
						const [domain, service] = `${evt.options.service}`.split('.', 2)
						const serviceDefinition = initialServices[domain][service]

						const target: HassServiceTarget = {}

						const selectedEntities = evt.options.entity_id
						if (selectedEntities.length > 0) {
							if (serviceDefinition.fields.entity_id) {
								const entityIdSelector = serviceDefinition.fields.entity_id.selector as any | undefined
								const selectorSupportsMultipleEntities = entityIdSelector?.entity?.multiple

								if (selectedEntities.length > 1 && !selectorSupportsMultipleEntities) {
									throw new Error(`The service ${evt.options.service} only supports a single entity_id`)
								}

								payload.entity_id = selectorSupportsMultipleEntities ? selectedEntities : selectedEntities[0]
							}

							if (serviceDefinition.target) {
								target.entity_id = selectedEntities
							}
						}

						await invokeService(ctx.getClient(), { domain, service, data: payload, target, signal: context.signal })
					} catch (e) {
						console.debug(`Call service failed: ${e}`)
					}
				},
			},
		}
	},
})
