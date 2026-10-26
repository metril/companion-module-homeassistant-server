import type { ClimateFeedbacks } from './domains/climate.js'
import type { CoverFeedbacks } from './domains/cover.js'
import type { FanFeedbacks } from './domains/fan.js'
import type { LockFeedbacks } from './domains/lock.js'
import type { MediaPlayerFeedbacks } from './domains/media_player.js'
import type { NumberFeedbacks } from './domains/number.js'
import type { ValveFeedbacks } from './domains/valve.js'
import type { CompanionFeedbackDefinitions } from '@companion-module/base'
import { activeDomains } from './domains/index.js'
import type { BinarySensorFeedbacks } from './domains/binary_sensor.js'
import type { GroupFeedbacks } from './domains/group.js'
import type { GenericFeedbacks } from './domains/generic.js'
import type { InputBooleanFeedbacks } from './domains/input_boolean.js'
import type { InputSelectFeedbacks } from './domains/input_select.js'
import type { LightFeedbacks } from './domains/light.js'
import type { SwitchFeedbacks } from './domains/switch.js'
import type { DomainContext } from './domains/types.js'

export type FeedbackId = keyof FeedbacksSchema

export type FeedbacksSchema = SwitchFeedbacks &
	InputBooleanFeedbacks &
	LightFeedbacks &
	BinarySensorFeedbacks &
	InputSelectFeedbacks &
	GroupFeedbacks &
	GenericFeedbacks &
	ClimateFeedbacks &
	CoverFeedbacks &
	FanFeedbacks &
	LockFeedbacks &
	MediaPlayerFeedbacks &
	NumberFeedbacks &
	ValveFeedbacks

export function GetFeedbacksList(
	ctx: DomainContext,
	presentDomains: Set<string> | undefined,
): CompanionFeedbackDefinitions<FeedbacksSchema> {
	const feedbacks: Record<string, unknown> = {}
	for (const domain of activeDomains(presentDomains)) {
		if (domain.feedbacks) Object.assign(feedbacks, domain.feedbacks(ctx))
	}
	return feedbacks as CompanionFeedbackDefinitions<FeedbacksSchema>
}
