import {
	CreateConvertToBooleanFeedbackUpgradeScript,
	type CompanionStaticUpgradeResult,
	type CompanionStaticUpgradeScript,
} from '@companion-module/base'
import type { DeviceConfig, DeviceSecrets } from './config.js'
import { FeedbackId } from './feedback.js'

const BooleanFeedbackUpgradeMap: {
	[id in FeedbackId]?: true
} = {
	switch_state: true,
	input_boolean_state: true,
	light_on_state: true,
	binary_sensor_state: true,
}

const MoveAccessTokenToSecrets: CompanionStaticUpgradeScript<DeviceConfig, DeviceSecrets> = (_context, props) => {
	const result: CompanionStaticUpgradeResult<DeviceConfig, DeviceSecrets> = {
		updatedConfig: null,
		updatedSecrets: null,
		updatedActions: [],
		updatedFeedbacks: [],
	}

	if (props.config) {
		const oldConfig = props.config as DeviceConfig & { access_token?: string }
		if (oldConfig.access_token) {
			// Ensure secrets object exists
			result.updatedSecrets = props.secrets || {}
			result.updatedConfig = oldConfig

			// If there is not already an access token in secrets, copy it to secrets
			if (!result.updatedSecrets.access_token) {
				result.updatedSecrets.access_token = oldConfig.access_token
			}

			// Remove the access token from the config
			delete oldConfig.access_token
		}
	}

	return result
}

const AddFilterDefaults: CompanionStaticUpgradeScript<DeviceConfig, DeviceSecrets> = (_context, props) => {
	const result: CompanionStaticUpgradeResult<DeviceConfig, DeviceSecrets> = {
		updatedConfig: null,
		updatedSecrets: null,
		updatedActions: [],
		updatedFeedbacks: [],
	}

	if (props.config && props.config.include_domains === undefined) {
		// Preserve legacy behavior for existing installs: empty domains = all,
		// no name filter, attributes still exposed. New installs use schema defaults.
		result.updatedConfig = {
			...props.config,
			include_domains: [],
			include_patterns: '',
			exclude_patterns: '',
			expose_attributes: true,
		}
	}

	return result
}

const EnableVariablesDefault: CompanionStaticUpgradeScript<DeviceConfig, DeviceSecrets> = (_context, props) => {
	const result: CompanionStaticUpgradeResult<DeviceConfig, DeviceSecrets> = {
		updatedConfig: null,
		updatedSecrets: null,
		updatedActions: [],
		updatedFeedbacks: [],
	}

	if (props.config && props.config.enable_variables === undefined) {
		result.updatedConfig = {
			...props.config,
			enable_variables: true,
		}
	}

	return result
}

const AddRegistryFilterDefaults: CompanionStaticUpgradeScript<DeviceConfig, DeviceSecrets> = (_context, props) => {
	const result: CompanionStaticUpgradeResult<DeviceConfig, DeviceSecrets> = {
		updatedConfig: null,
		updatedSecrets: null,
		updatedActions: [],
		updatedFeedbacks: [],
	}

	if (props.config && props.config.include_labels === undefined) {
		// Empty lists = no label/area/floor filtering, so existing configs behave as before
		result.updatedConfig = {
			...props.config,
			include_labels: [],
			include_areas: [],
			include_floors: [],
			exclude_labels: [],
			exclude_areas: [],
			exclude_floors: [],
		}
	}

	return result
}

type MigrationAction = CompanionStaticUpgradeResult<DeviceConfig, DeviceSecrets>['updatedActions'][number]

/** Convert mireds in a literal call_service payload (`color_temp`) to kelvin (`color_temp_kelvin`) */
export function convertMiredsPayload(payload: string): string | undefined {
	let parsed: unknown
	try {
		parsed = JSON.parse(payload)
	} catch {
		return undefined
	}
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined
	const obj = parsed as Record<string, unknown>
	if (typeof obj.color_temp !== 'number' || obj.color_temp <= 0 || 'color_temp_kelvin' in obj) return undefined

	const { color_temp: mireds, ...rest } = obj
	return JSON.stringify({ ...rest, color_temp_kelvin: Math.round(1e6 / mireds) })
}

/**
 * v3: call_service gets a target type and return_response option (existing buttons target entities, and
 * don't ask for a response), and mireds payloads move to kelvin as HA is dropping mireds.
 * Options keep the `{isExpression, value}` wrapper, so expressions are left intact.
 */
export const CallServiceTargetsAndKelvin: CompanionStaticUpgradeScript<DeviceConfig, DeviceSecrets> = (
	_context,
	props,
) => {
	const updatedActions: MigrationAction[] = []

	for (const action of props.actions) {
		if (action.actionId !== 'call_service') continue

		let changed = false
		if (action.options.target_type === undefined) {
			action.options.target_type = { isExpression: false, value: 'entity' }
			changed = true
		}
		if (action.options.return_response === undefined) {
			action.options.return_response = { isExpression: false, value: false }
			changed = true
		}

		const payload = action.options.payload
		if (payload && !payload.isExpression && typeof payload.value === 'string') {
			const converted = convertMiredsPayload(payload.value)
			if (converted !== undefined) {
				action.options.payload = { isExpression: false, value: converted }
				changed = true
			}
		}

		if (changed) updatedActions.push(action)
	}

	return { updatedConfig: null, updatedSecrets: null, updatedActions, updatedFeedbacks: [] }
}

export const UpgradeScripts: CompanionStaticUpgradeScript<DeviceConfig, DeviceSecrets>[] = [
	CreateConvertToBooleanFeedbackUpgradeScript(BooleanFeedbackUpgradeMap),
	MoveAccessTokenToSecrets,
	AddFilterDefaults,
	EnableVariablesDefault,
	AddRegistryFilterDefaults,
	CallServiceTargetsAndKelvin,
]
