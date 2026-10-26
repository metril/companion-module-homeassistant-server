export type SubscriptionType = string

/**
 * Tracks which feedback/action instances reference which entities.
 * Used to re-check feedbacks on change, and to keep referenced entities in the HA subscription.
 */
export class EntitySubscriptions {
	// Map<entityId, Map<instanceId, type>>
	private readonly data: Map<string, Map<string, SubscriptionType>>
	// Map<instanceId, Set<entityId>>
	private readonly byInstance: Map<string, Set<string>>

	/** Called when an entity is referenced which was not referenced by anything before */
	public onNewEntity: ((entityId: string) => void) | undefined

	constructor() {
		this.data = new Map()
		this.byInstance = new Map()
	}

	public getFeedbackInstanceIds(entityId: string): string[] {
		const entries = this.data.get(entityId)
		if (entries) {
			// Actions are tracked too (to keep their entities subscribed), but are not feedbacks
			return Array.from(entries.entries())
				.filter(([, type]) => !type.startsWith('action:'))
				.map(([instanceId]) => instanceId)
		} else {
			return []
		}
	}

	/** All entities currently referenced by at least one instance */
	public getReferencedEntityIds(): Set<string> {
		const ids = new Set<string>()
		for (const [entityId, entries] of this.data) {
			if (entries.size > 0) ids.add(entityId)
		}
		return ids
	}

	/** Reference one or more entities from an instance, replacing any previous references of that instance */
	public subscribe(entityIds: string | string[], instanceId: string, type: SubscriptionType): void {
		const wanted = new Set(Array.isArray(entityIds) ? entityIds : [entityIds])
		const previous = this.byInstance.get(instanceId)
		if (previous) {
			for (const entityId of previous) {
				if (!wanted.has(entityId)) this.#remove(entityId, instanceId)
			}
		}
		this.byInstance.set(instanceId, wanted)

		for (const entityId of wanted) {
			let entries = this.data.get(entityId)
			const isNew = !entries || entries.size === 0
			if (!entries) {
				entries = new Map()
				this.data.set(entityId, entries)
			}
			entries.set(instanceId, type)
			if (isNew) this.onNewEntity?.(entityId)
		}
	}

	/** Drop all references of an instance. The entityId argument is kept for backwards compatibility */
	public unsubscribe(_entityId: string | undefined, instanceId: string): void {
		const previous = this.byInstance.get(instanceId)
		if (!previous) return
		for (const entityId of previous) this.#remove(entityId, instanceId)
		this.byInstance.delete(instanceId)
	}

	#remove(entityId: string, instanceId: string): void {
		const entries = this.data.get(entityId)
		if (!entries) return
		entries.delete(instanceId)
		if (entries.size === 0) this.data.delete(entityId)
	}

	public clear(): void {
		this.data.clear()
		this.byInstance.clear()
	}
}
