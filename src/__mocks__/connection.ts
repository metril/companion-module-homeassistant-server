import type { Connection } from 'home-assistant-js-websocket'
import { vi } from 'vitest'
import type { DomainContext } from '../domains/types.js'
import { EntitySubscriptions } from '../state.js'

/** A fake connection recording every message sent through sendMessagePromise */
export function mockConnection(haVersion = '2024.6.0'): { conn: Connection; sent: Record<string, unknown>[] } {
	const sent: Record<string, unknown>[] = []
	const conn = {
		haVersion,
		sendMessagePromise: vi.fn(async (msg: Record<string, unknown>) => {
			sent.push(msg)
			return {}
		}),
	} as unknown as Connection
	return { conn, sent }
}

export function mockContext(
	conn: Connection | undefined,
	entities: Record<string, { state: string; attributes?: Record<string, unknown> }> = {},
): DomainContext {
	const stateObj = Object.fromEntries(
		Object.entries(entities).map(([entity_id, e]) => [
			entity_id,
			{ entity_id, state: e.state, attributes: e.attributes ?? {} },
		]),
	)
	return {
		getState: () => Object.values(stateObj),
		getStateObj: () => stateObj,
		getServices: () => ({}),
		getClient: () => conn,
		getRegistries: () => ({
			supportsFloorsAndLabels: () => true,
			getAreas: () => [],
			getDevices: () => [],
			getFloors: () => [],
			getLabels: () => [],
		}),
		subs: new EntitySubscriptions(),
	} as unknown as DomainContext
}
