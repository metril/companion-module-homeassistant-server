import { getCollection, type Collection, type Connection } from 'home-assistant-js-websocket'
import { Store } from 'home-assistant-js-websocket/dist/store.js'

/** Compact entry of `config/entity_registry/list_for_display` (no state, no attributes) */
export interface EntityIndexEntry {
	/** entity_id */
	ei: string
	/** device_id */
	di?: string | null
	/** area_id (the entity's own area, the device area is not inherited here) */
	ai?: string | null
	/** label ids */
	lb?: string[]
	/** entity name */
	en?: string | null
	/** platform */
	pl?: string
	/** hidden */
	hb?: boolean
	/** entity category index */
	ec?: number
}

interface ListForDisplayResult {
	entity_categories: Record<string, string>
	entities: EntityIndexEntry[]
}

export interface EntityIndex {
	/** Registered entities by id. Empty if the registry could not be loaded. */
	registry: Map<string, EntityIndexEntry>
	/** Every entity id known to HA (registered or not), if it could be loaded */
	allIds: string[]
	/** False if the registry could not be fetched, in which case filtering must fall back to unfiltered */
	ok: boolean
}

const ALL_IDS_TEMPLATE = "{{ states | map(attribute='entity_id') | list }}"
const TEMPLATE_TIMEOUT_MS = 10000

/**
 * `render_template` is a subscription: subscribe, take the first result, then unsubscribe.
 * Used to discover entities which are not in the registry (eg YAML entities without a unique_id)
 */
export async function fetchAllEntityIds(conn: Connection): Promise<string[]> {
	return new Promise<string[]>((resolve, reject) => {
		let done = false
		let unsub: (() => Promise<void>) | undefined
		const finish = (err: unknown, value?: string[]): void => {
			if (done) return
			done = true
			clearTimeout(timer)
			void unsub?.().catch(() => null)
			if (err) reject(err instanceof Error ? err : new Error(JSON.stringify(err)))
			else resolve(value ?? [])
		}
		const timer = setTimeout(() => finish(new Error('render_template timed out')), TEMPLATE_TIMEOUT_MS)

		conn
			.subscribeMessage<{ result?: unknown; error?: string }>(
				(msg) => {
					if (msg.error) return finish(new Error(msg.error))
					if (Array.isArray(msg.result)) return finish(null, msg.result.map(String))
				},
				{ type: 'render_template', template: ALL_IDS_TEMPLATE, report_errors: true },
			)
			.then((u) => {
				unsub = u
				// The first result may have been delivered before we had the unsubscribe function
				if (done) void u().catch(() => null)
			})
			.catch((e) => finish(e))
	})
}

export async function fetchEntityIndex(conn: Connection): Promise<EntityIndex> {
	const [registryRes, idsRes] = await Promise.allSettled([
		conn.sendMessagePromise<ListForDisplayResult>({ type: 'config/entity_registry/list_for_display' }),
		fetchAllEntityIds(conn),
	])

	const registry = new Map<string, EntityIndexEntry>()
	if (registryRes.status === 'fulfilled') {
		for (const entry of registryRes.value.entities ?? []) registry.set(entry.ei, entry)
	}

	// Without the template result, fall back to the registered entities only
	const allIds = idsRes.status === 'fulfilled' ? idsRes.value : Array.from(registry.keys())

	return { registry, allIds, ok: registryRes.status === 'fulfilled' }
}

/** Collection which refetches the index when the entity registry changes */
export const entityIndexColl = (conn: Connection): Collection<EntityIndex> =>
	getCollection<EntityIndex>(conn, '_ent_index', fetchEntityIndex, async (c: Connection, store: Store<EntityIndex>) =>
		c.subscribeEvents(() => {
			void fetchEntityIndex(c).then((idx) => store.setState(idx, true))
		}, 'entity_registry_updated'),
	)
