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

export const UpgradeScripts: CompanionStaticUpgradeScript<DeviceConfig, DeviceSecrets>[] = [
	CreateConvertToBooleanFeedbackUpgradeScript(BooleanFeedbackUpgradeMap),
	MoveAccessTokenToSecrets,
	AddFilterDefaults,
	EnableVariablesDefault,
]
