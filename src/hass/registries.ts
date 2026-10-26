import { getCollection, type Connection, type UnsubscribeFunc } from 'home-assistant-js-websocket'
import { Store } from 'home-assistant-js-websocket/dist/store.js'
import { atLeastHaVersion } from 'home-assistant-js-websocket/dist/util.js'

export interface AreaEntry {
	area_id: string
	name: string
	floor_id?: string | null
	labels?: string[]
}
export interface FloorEntry {
	floor_id: string
	name: string
	level?: number | null
}
export interface LabelEntry {
	label_id: string
	name: string
}
export interface DeviceEntry {
	id: string
	name?: string | null
	name_by_user?: string | null
	area_id?: string | null
	labels?: string[]
}

type RegistryKind = 'area' | 'floor' | 'label' | 'device'

/** Floors and labels were added to HA in 2024.4 */
export function supportsFloorsAndLabels(haVersion: string | undefined): boolean {
	return !!haVersion && atLeastHaVersion(haVersion, 2024, 4)
}

function registryCollection<T>(conn: Connection, kind: RegistryKind, onUpdate: (items: T[]) => void): UnsubscribeFunc {
	const fetch = async (c: Connection): Promise<T[]> =>
		c.sendMessagePromise<T[]>({ type: `config/${kind}_registry/list` })

	const coll = getCollection<T[]>(
		conn,
		`_${kind}_registry`,
		fetch,
		// Refetch the whole (small) registry on any change
		async (c: Connection, store: Store<T[]>) =>
			c.subscribeEvents(() => {
				void fetch(c).then((items) => store.setState(items, true))
			}, `${kind}_registry_updated`),
	)
	return coll.subscribe(onUpdate)
}

/**
 * Areas, floors and labels (always loaded, small) and devices (lazy, can be large).
 * Rebuilds triggered by registry changes are the responsibility of the onChange handler (which should debounce).
 */
export class Registries {
	#conn: Connection | undefined
	#unsubs: UnsubscribeFunc[] = []
	#deviceUnsub: UnsubscribeFunc | undefined
	readonly #deviceOwners = new Set<string>()

	#areas: AreaEntry[] = []
	#floors: FloorEntry[] = []
	#labels: LabelEntry[] = []
	#devices: DeviceEntry[] = []
	#deviceMap: Record<string, DeviceEntry> = {}

	constructor(private readonly onChange: () => void) {}

	public start(conn: Connection): void {
		this.stop()
		this.#conn = conn

		this.#unsubs.push(
			registryCollection<AreaEntry>(conn, 'area', (items) => {
				this.#areas = items
				this.onChange()
			}),
		)
		if (supportsFloorsAndLabels(conn.haVersion)) {
			this.#unsubs.push(
				registryCollection<FloorEntry>(conn, 'floor', (items) => {
					this.#floors = items
					this.onChange()
				}),
				registryCollection<LabelEntry>(conn, 'label', (items) => {
					this.#labels = items
					this.onChange()
				}),
			)
		}
		this.#syncDevices()
	}

	public stop(): void {
		for (const unsub of this.#unsubs) unsub()
		this.#unsubs = []
		this.#stopDevices()
		this.#conn = undefined
		this.#areas = []
		this.#floors = []
		this.#labels = []
	}

	/**
	 * The device registry can be large, so is only loaded while at least one owner needs it
	 * (eg an action with a device target, or an area filter in the config)
	 */
	public requireDevices(owner: string, needed: boolean): void {
		const changed = needed ? !this.#deviceOwners.has(owner) : this.#deviceOwners.has(owner)
		if (!changed) return
		if (needed) this.#deviceOwners.add(owner)
		else this.#deviceOwners.delete(owner)
		this.#syncDevices()
	}

	public setDeviceOwners(prefix: string, owners: Iterable<string>): void {
		const wanted = new Set(Array.from(owners, (o) => `${prefix}${o}`))
		for (const owner of Array.from(this.#deviceOwners)) {
			if (owner.startsWith(prefix) && !wanted.has(owner)) this.#deviceOwners.delete(owner)
		}
		for (const owner of wanted) this.#deviceOwners.add(owner)
		this.#syncDevices()
	}

	#syncDevices(): void {
		if (!this.#conn) return
		if (this.#deviceOwners.size > 0) {
			if (this.#deviceUnsub) return
			this.#deviceUnsub = registryCollection<DeviceEntry>(this.#conn, 'device', (items) => {
				this.#devices = items
				this.#deviceMap = Object.fromEntries(items.map((d) => [d.id, d]))
				this.onChange()
			})
		} else {
			this.#stopDevices()
		}
	}

	#stopDevices(): void {
		this.#deviceUnsub?.()
		this.#deviceUnsub = undefined
		this.#devices = []
		this.#deviceMap = {}
	}

	public supportsFloorsAndLabels(): boolean {
		return supportsFloorsAndLabels(this.#conn?.haVersion)
	}
	public devicesLoaded(): boolean {
		return !!this.#deviceUnsub
	}

	public getAreaEntries(): AreaEntry[] {
		return this.#areas
	}
	public getAreas(): { id: string; name: string }[] {
		return this.#areas.map((a) => ({ id: a.area_id, name: a.name }))
	}
	public getFloors(): { id: string; name: string }[] {
		return this.#floors.map((f) => ({ id: f.floor_id, name: f.name }))
	}
	public getLabels(): { id: string; name: string }[] {
		return this.#labels.map((l) => ({ id: l.label_id, name: l.name }))
	}
	public getDevices(): { id: string; name: string }[] {
		return this.#devices.map((d) => ({ id: d.id, name: d.name_by_user || d.name || d.id }))
	}
	public getDeviceMap(): Record<string, DeviceEntry> {
		return this.#deviceMap
	}
}
