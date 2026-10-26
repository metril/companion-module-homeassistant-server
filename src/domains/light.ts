import { atLeastHaVersion } from 'home-assistant-js-websocket/dist/util.js'
import { EntityMultiplePicker, EntityPicker, OnOffTogglePicker } from '../choices.js'
import { LIGHT_MAX_BRIGHTNESS } from '../choices.js'
import { lightColorNumber, numberToRgb, rgbToNumber, validateColorMode, type ColorMode } from '../hass/color.js'
import { invokeService } from '../hass/service.js'
import { entityOnOff } from '../hass/service.js'
import type { OnOffToggle } from '../util.js'
import {
	callEntityService,
	entityTemplatePreset,
	onOffStateFeedback,
	subscribeEntityPicker,
	toIds,
	unsubscribeEntityPicker,
} from './helpers.js'
import { defineDomain, type ActionResult } from './types.js'

export type LightActions = {
	set_light_on: { options: { entity_id: string[]; state: OnOffToggle }; result: ActionResult }
	set_light_pct: { options: { entity_id: string[]; pct: number }; result: ActionResult }
	set_light_color: {
		options: {
			entity_id: string[]
			mode: ColorMode
			kelvin: number
			color: number
			hue: number
			saturation: number
		}
		result: ActionResult
	}
	adj_light_pct: { options: { entity_id: string[]; pct: number }; result: ActionResult }
}
export type LightFeedbacks = {
	light_on_state: { type: 'boolean'; options: { entity_id: string; state: boolean } }
	light_brightness: { type: 'value'; options: { entity_id: string }; result: number }
	light_kelvin: { type: 'value'; options: { entity_id: string }; result: number }
	light_color: { type: 'value'; options: { entity_id: string }; result: number }
	light_color_bg: { type: 'advanced'; options: { entity_id: string } }
}

export const lightDomain = defineDomain<LightActions, LightFeedbacks>({
	id: 'light',
	actions: (ctx) => {
		const pickerLights = EntityMultiplePicker(ctx.getState(), 'light')
		return {
			set_light_on: {
				name: 'Set light on/off state',
				hasResult: true,
				options: [pickerLights, OnOffTogglePicker()],
				callback: async (evt, context) => entityOnOff(ctx.getClient(), evt.options, context.signal),
			},
			set_light_pct: {
				name: 'Set light brightness (percentage)',
				hasResult: true,
				options: [
					pickerLights,
					{
						type: 'number',
						label: 'Brightness',
						id: 'pct',
						default: 50,
						min: 0,
						max: 100,
						step: 1,
						range: true,
					},
				],
				callback: async (evt, context) =>
					callEntityService(ctx, evt, context, 'light', 'turn_on', { brightness_pct: Number(evt.options.pct) }),
			},
			set_light_color: {
				name: 'Set light colour',
				description: 'Set the colour temperature (kelvin), RGB or hue/saturation of a light',
				hasResult: true,
				options: [
					pickerLights,
					{
						type: 'dropdown',
						label: 'Mode',
						id: 'mode',
						default: 'kelvin',
						choices: [
							{ id: 'kelvin', label: 'Colour temperature (kelvin)' },
							{ id: 'rgb', label: 'RGB colour' },
							{ id: 'hs', label: 'Hue / saturation' },
						],
						disableAutoExpression: true,
					},
					{
						type: 'number',
						label: 'Kelvin',
						id: 'kelvin',
						default: 4000,
						min: 1000,
						max: 12000,
						step: 100,
						isVisibleExpression: '$(options:mode) == "kelvin"',
					},
					{
						type: 'colorpicker',
						label: 'Colour',
						id: 'color',
						default: 0xffffff,
						returnType: 'number',
						isVisibleExpression: '$(options:mode) == "rgb"',
					},
					{
						type: 'number',
						label: 'Hue',
						id: 'hue',
						default: 0,
						min: 0,
						max: 360,
						step: 1,
						isVisibleExpression: '$(options:mode) == "hs"',
					},
					{
						type: 'number',
						label: 'Saturation',
						id: 'saturation',
						default: 100,
						min: 0,
						max: 100,
						step: 1,
						isVisibleExpression: '$(options:mode) == "hs"',
					},
				],
				callback: async (evt, context) => {
					const { mode } = evt.options
					const ids = toIds(evt.options.entity_id)
					for (const id of ids) {
						validateColorMode(mode, ctx.getStateObj()[id]?.attributes.supported_color_modes, id)
					}

					const data: Record<string, unknown> = { entity_id: ids }
					if (mode === 'kelvin') {
						const kelvin = Number(evt.options.kelvin)
						// color_temp_kelvin replaced the kelvin parameter in HA 2022.11
						const modern = atLeastHaVersion(ctx.getClient()?.haVersion ?? '0.0.0', 2022, 11, 0)
						data[modern ? 'color_temp_kelvin' : 'kelvin'] = kelvin
					} else if (mode === 'rgb') {
						data.rgb_color = numberToRgb(Number(evt.options.color))
					} else {
						data.hs_color = [Number(evt.options.hue), Number(evt.options.saturation)]
					}

					await invokeService(ctx.getClient(), { domain: 'light', service: 'turn_on', data, signal: context.signal })
					return { service: 'light.turn_on', entity_id: ids }
				},
				learn: (evt) => {
					const attrs = ctx.getStateObj()[toIds(evt.options.entity_id)[0]]?.attributes
					if (!attrs) return undefined
					if (Array.isArray(attrs.rgb_color) && attrs.color_mode !== 'color_temp') {
						const [r, g, b] = attrs.rgb_color.map(Number)
						return { mode: 'rgb', color: rgbToNumber([r, g, b]) }
					}
					if (typeof attrs.color_temp_kelvin === 'number') return { mode: 'kelvin', kelvin: attrs.color_temp_kelvin }
					return undefined
				},
			},
			adj_light_pct: {
				name: 'Adjust light brightness (percentage)',
				hasResult: true,
				options: [
					pickerLights,
					{
						type: 'number',
						label: 'Adjustment',
						id: 'pct',
						default: 1,
						min: -100,
						max: 100,
						step: 1,
					},
				],
				callback: async (evt, context) =>
					callEntityService(ctx, evt, context, 'light', 'turn_on', {
						brightness_step_pct: Number(evt.options.pct),
					}),
			},
		}
	},
	feedbacks: (ctx) => {
		const lightPicker = (): ReturnType<typeof EntityPicker> => EntityPicker(ctx.getState(), 'light')
		const attrNumber = (entityId: string, attr: string): number | undefined => {
			const v = ctx.getStateObj()[entityId]?.attributes[attr]
			return typeof v === 'number' ? v : undefined
		}

		return {
			light_on_state: onOffStateFeedback(
				ctx,
				'light',
				'Change from light on state',
				'If the light state matches the rule, change style of the bank',
			),
			light_brightness: {
				type: 'value',
				name: 'Light brightness (percentage)',
				description: '0-100, or 0 when the light is off',
				options: [lightPicker()],
				callback: (feedback): number => {
					subscribeEntityPicker(ctx, feedback)
					const id = feedback.options.entity_id
					if (ctx.getStateObj()[id]?.state !== 'on') return 0
					return Math.round(((attrNumber(id, 'brightness') ?? 0) / LIGHT_MAX_BRIGHTNESS) * 100)
				},
				unsubscribe: (feedback) => unsubscribeEntityPicker(ctx, feedback),
			},
			light_kelvin: {
				type: 'value',
				name: 'Light colour temperature (kelvin)',
				description: '0 when the light is off or has no colour temperature',
				options: [lightPicker()],
				callback: (feedback): number => {
					subscribeEntityPicker(ctx, feedback)
					return attrNumber(feedback.options.entity_id, 'color_temp_kelvin') ?? 0
				},
				unsubscribe: (feedback) => unsubscribeEntityPicker(ctx, feedback),
			},
			light_color: {
				type: 'value',
				name: 'Light colour (RGB number)',
				description: 'The colour as a 0xRRGGBB number, or -1 when the light is off or has no colour',
				options: [lightPicker()],
				callback: (feedback): number => {
					subscribeEntityPicker(ctx, feedback)
					return lightColorNumber(ctx.getStateObj()[feedback.options.entity_id]) ?? -1
				},
				unsubscribe: (feedback) => unsubscribeEntityPicker(ctx, feedback),
			},
			light_color_bg: {
				type: 'advanced',
				name: 'Button background from light colour',
				description: 'Sets the button background to the current colour of the light',
				affectedProperties: ['bgcolor'],
				options: [lightPicker()],
				callback: (feedback) => {
					subscribeEntityPicker(ctx, feedback)
					const color = lightColorNumber(ctx.getStateObj()[feedback.options.entity_id])
					return color === undefined ? {} : { bgcolor: color }
				},
				unsubscribe: (feedback) => unsubscribeEntityPicker(ctx, feedback),
			},
		}
	},
	presets: (ctx) =>
		entityTemplatePreset(ctx, {
			domain: 'light',
			presetId: 'light_set',
			name: 'Light X',
			sectionId: 'light',
			sectionName: 'Light',
			labelPrefix: 'Light',
			actionId: 'set_light_on',
			toggleFeedbackId: 'light_on_state',
		}),
})
