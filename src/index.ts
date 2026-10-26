import {
	Connection,
	createConnection,
	UnsubscribeFunc,
	subscribeServices,
	HassServices,
	createLongLivedTokenAuth,
	HassEntity,
	HassEntities,
} from 'home-assistant-js-websocket'
import { GetActionsList } from './actions.js'
import { atLeastHaVersion } from 'home-assistant-js-websocket/dist/util.js'
import { type DeviceConfig, DeviceSecrets, GetConfigFields, type LastFilterCounts } from './config.js'
import { GetFeedbacksList } from './feedback.js'
import { createSocket, hassErrorToString } from './hass-socket.js'
import { GetPresetsList } from './presets.js'
import { InitVariables, updateVariables } from './variables.js'
import { InstanceBase, InstanceStatus, SomeCompanionConfigField } from '@companion-module/base'
import { UpgradeScripts } from './upgrades.js'
import { stripTrailingSlash } from './util.js'
import { HassEntitiesWithChanges, entitiesColl } from './hass/entities.js'
import { EntitySubscriptions } from './state.js'
import debounceFn from 'debounce-fn'
import type { HassSchema } from './schema.js'
import {
	compileFilter,
	computeFilterBreakdown,
	hasAnyFilter,
	hasTaxonomyFilter,
	resolveFilteredIds,
	type EntityFilter,
} from './filter.js'
import { Registries } from './hass/registries.js'
import { entityIndexColl, type EntityIndex } from './hass/entityIndex.js'
import type { DomainContext } from './domains/types.js'
import { entityDomain } from './filter.js'

const RECONNECT_INTERVAL = 5000

const VALID_ENTITY_ID = /^[a-z0-9_]+\.[a-z0-9_]+$/
/** HA may treat an empty `entity_ids` as "everything", so never send an empty list */
const NO_ENTITIES_PLACEHOLDER = 'homeassistant.companion_no_entities'

export { UpgradeScripts }

export default class ControllerInstance extends InstanceBase<HassSchema> {
	public needsReconnect: boolean

	private config: DeviceConfig
	private secrets: DeviceSecrets
	private state: HassEntity[]
	private stateObj: HassEntities
	private services: HassServices
	private entitySubscriptions = new EntitySubscriptions()
	private client: Connection | undefined
	private connecting: boolean
	private unsubscribeEntities: UnsubscribeFunc | undefined
	private unsubscribeServices: UnsubscribeFunc | undefined

	private pendingState: HassEntitiesWithChanges | undefined

	private baseFilter: EntityFilter = () => false
	private entityFilter: EntityFilter = (id) => (this.resolvedIds ? this.resolvedIds.has(id) : this.baseFilter(id))
	private exposeAttributes = false
	private lastFilterCounts: LastFilterCounts | undefined

	private readonly registries = new Registries(() => this.#debouncedRegistriesChanged())
	private readonly domainContext: DomainContext = {
		getState: () => this.state,
		getStateObj: () => this.stateObj,
		getServices: () => this.services,
		getClient: () => this.client,
		getRegistries: () => this.registries,
		subs: this.entitySubscriptions,
	}

	/** Registry index of all entities, only loaded while server-side filtering is active */
	private entityIndex: EntityIndex | undefined
	private unsubscribeIndex: UnsubscribeFunc | undefined
	/** Entities matching the filter, resolved from the registries. Undefined = no server-side filtering */
	private resolvedIds: Set<string> | undefined
	/** Key of the entity set currently subscribed in HA. '*' = everything */
	private subscribedKey: string | undefined
	private activeEntitySub: object | undefined
	private pendingEntitySub: object | undefined

	constructor(internal: unknown) {
		super(internal)

		this.config = {}
		this.secrets = {}

		this.connecting = false
		this.state = []
		this.stateObj = {}
		this.services = {}
		this.needsReconnect = false

		this.entitySubscriptions.onNewEntity = (entityId) => {
			// Keep entities referenced by buttons subscribed, even if the filter would drop them
			if (this.resolvedIds && !this.resolvedIds.has(entityId)) this.#debouncedRecompute()
		}
	}

	/**
	 * Main initialization function called once the module
	 * is OK to start doing things.
	 */
	public async init(config: DeviceConfig, _isFirst: boolean, secrets: DeviceSecrets): Promise<void> {
		await this.configUpdated(config, secrets)

		this.applyVariableDefinitions()
		this.applyDefinitions()
		// updateVariables(this, this.state) No need, there are no entities
	}

	/**
	 * Process an updated configuration array.
	 */
	public async configUpdated(config: DeviceConfig, secrets: DeviceSecrets): Promise<void> {
		this.config = config
		this.secrets = secrets

		this.baseFilter = compileFilter(config)
		this.resolvedIds = undefined
		this.exposeAttributes = !!config.expose_attributes

		if (this.connecting) {
			this.needsReconnect = true
			return
		}

		this.#stopEntities()
		if (this.unsubscribeServices) {
			this.unsubscribeServices()
		}
		this.registries.stop()
		this.entityIndex = undefined

		try {
			if (this.client) {
				this.client.close()
			}
		} catch (_e) {
			// Ignore
		}
		this.client = undefined

		this.state = []
		this.stateObj = {}
		this.services = {}
		// updateVariables(this, this.state) No need, there are no entities

		this.tryConnect()

		// Re-init the subscriptions
		this.entitySubscriptions.clear()
		this.checkAllFeedbacks()
	}

	/**
	 * Creates the configuration fields for web config.
	 */
	public getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields(this.#allEntityIds(), this.lastFilterCounts, this.registries)
	}

	/**
	 * Clean up the instance before it is destroyed.
	 */
	public async destroy(): Promise<void> {
		try {
			this.#stopEntities()
			this.registries.stop()
			if (this.unsubscribeServices) {
				this.unsubscribeServices()
				this.unsubscribeServices = undefined
			}

			if (this.client) {
				this.client.close()
			}
		} catch (_e) {
			// Ignore
		}
		this.client = undefined

		this.needsReconnect = false
		this.state = []
		this.stateObj = {}
		this.services = {}

		this.log('debug', `destroy ${this.id}`)
	}

	private tryConnect(): void {
		if (this.connecting || this.client) {
			return
		}

		this.connecting = true
		this.needsReconnect = false

		const auth = createLongLivedTokenAuth(stripTrailingSlash(this.config.url || ''), this.secrets.access_token || '')

		createConnection({
			auth,
			createSocket: async () => createSocket(auth, this.config.ignore_certificates || false, this),
		})
			.then((connection) => {
				this.connecting = false

				// Need reconnection already?
				if (this.needsReconnect) {
					try {
						connection.close()
					} catch (_e) {
						// Ignore
					}
					// Restart the process with the new url
					setImmediate(() => this.tryConnect())
					return
				}

				this.client = connection
				this.updateStatus(InstanceStatus.Ok)

				this.log('info', `Connected to v${connection.haVersion}`)

				connection.addEventListener('disconnected', () => {
					this.connecting = true
					this.updateStatus(InstanceStatus.Disconnected, 'Lost connection')
					this.log('info', `Lost connection`)
				})
				connection.addEventListener('ready', () => {
					this.connecting = false
					this.updateStatus(InstanceStatus.Ok)
					this.log('info', `Reconnected to v${connection.haVersion}`)
				})
				connection.addEventListener('reconnect-error', () => {
					this.connecting = false
					this.client = undefined
					this.updateStatus(InstanceStatus.ConnectionFailure, 'Reconnect failed')
					this.log('info', `Reconnect failed`)
					try {
						connection.close()
					} catch (_e) {
						// Ignore
					}
					setTimeout(() => this.tryConnect(), RECONNECT_INTERVAL)
				})

				this.registries.start(connection)
				this.unsubscribeServices = subscribeServices(connection, this.processServicesChange.bind(this))
				this.#startEntities(connection)
			})
			.catch((e) => {
				this.connecting = false
				this.client = undefined

				if (this.needsReconnect) {
					// Restart the process with the new url
					setImmediate(() => this.tryConnect())
					return
				}

				let errorMsg: string
				if (typeof e === 'number') {
					errorMsg = hassErrorToString(e)
				} else if (e instanceof Error) {
					errorMsg = e.message
				} else if (typeof e === 'string') {
					errorMsg = e
				} else {
					errorMsg = JSON.stringify(e)
				}

				this.client = undefined
				this.updateStatus(InstanceStatus.UnknownError, errorMsg)
				this.log('error', `Connect failed: ${errorMsg}`)

				// Try and reset connection
				setTimeout(() => this.tryConnect(), RECONNECT_INTERVAL)
			})
	}

	private deboundProcessStateChange = (newState: HassEntitiesWithChanges): void => {
		if (!this.pendingState) {
			this.pendingState = newState
		} else {
			// Perform an intelligent merge of the changes, factoring in how multiple updates should compound

			this.pendingState.entities = newState.entities

			for (const id of newState.added) {
				this.pendingState.added.add(id)
				this.pendingState.removed.delete(id)
				this.pendingState.contentChanged.delete(id)
				this.pendingState.friendlyNameChange.delete(id)
			}

			for (const id of newState.removed) {
				this.pendingState.contentChanged.delete(id)
				this.pendingState.friendlyNameChange.delete(id)
				this.pendingState.added.delete(id)
				this.pendingState.removed.add(id) // Be safe and always mark as removed, should be cheap to do this
			}

			for (const id of newState.contentChanged) {
				if (!this.pendingState.added.has(id)) {
					this.pendingState.contentChanged.add(id)
					this.pendingState.removed.delete(id)
				}
			}
			for (const id of newState.friendlyNameChange) {
				if (!this.pendingState.added.has(id)) {
					this.pendingState.friendlyNameChange.add(id)
					this.pendingState.removed.delete(id)
				}
			}
		}

		this.processStateChange()
	}

	/**
	 * Handle state changes
	 * Note: This must not be debounced directly, as then the added/changed/removed will be incorrect
	 */
	private processStateChange = debounceFn(
		(): void => {
			const newState = this.pendingState
			this.pendingState = undefined
			if (!newState) return

			const newEntities = Object.values(newState.entities).sort((a, b) => a.entity_id.localeCompare(b.entity_id))
			this.state = newEntities
			this.stateObj = newState.entities

			const entitiesChanged =
				newState.added.size > 0 || newState.removed.size > 0 || newState.friendlyNameChange.size > 0
			if (entitiesChanged) {
				this.scheduleDefinitions()
				this.applyVariableDefinitions()
			}

			if (this.config.enable_variables !== false) {
				updateVariables(this, newState, this.entityFilter, this.exposeAttributes)
			}

			this.#checkAffectedFeedbacks(newState)
		},
		{
			wait: 10,
			maxWait: 50,
			before: false,
			after: true,
		},
	)

	#checkAffectedFeedbacks(newState: HassEntitiesWithChanges) {
		const changedFeedbackInstanceIds = new Set<string>()

		const checkEntityIds = (entityIds: Set<string>) => {
			for (const entityId of entityIds) {
				const instanceIds = this.entitySubscriptions.getFeedbackInstanceIds(entityId)
				for (const instanceId of instanceIds) {
					changedFeedbackInstanceIds.add(instanceId)
				}
			}
		}

		checkEntityIds(newState.added)
		checkEntityIds(newState.contentChanged)
		checkEntityIds(newState.removed)
		// No feedback based on the friendly name

		if (changedFeedbackInstanceIds.size > 0) {
			this.checkFeedbacksById(...changedFeedbackInstanceIds)
		}
	}

	private processServicesChange(services: HassServices): void {
		this.services = services

		this.scheduleDefinitions()
	}

	/** Definition rebuilds are debounced, as they are expensive on large installs and triggered by many sources */
	private scheduleDefinitions = debounceFn(() => this.applyDefinitions(), {
		wait: 100,
		maxWait: 500,
		before: false,
		after: true,
	})

	private applyDefinitions(): void {
		const present = this.#presentDomains()
		const ctx = this.domainContext
		// Presets are limited to the entities which pass the filter
		const presetCtx: DomainContext = { ...ctx, getState: () => this.filteredState() }

		this.setPresetDefinitions(...GetPresetsList(presetCtx, present))
		this.setFeedbackDefinitions(GetFeedbacksList(ctx, present))
		this.setActionDefinitions(GetActionsList(ctx, present))
	}

	/** Domains which have at least one entity in HA. Undefined while unknown, which registers everything. */
	#presentDomains(): Set<string> | undefined {
		const ids = this.#allEntityIds()
		if (ids.length === 0) return undefined
		return new Set(ids.map(entityDomain))
	}

	/** All entity ids in HA when known from the registry index, otherwise those currently in the state */
	#allEntityIds(): string[] {
		if (this.entityIndex?.ok) return this.entityIndex.allIds
		return this.state.map((e) => e.entity_id)
	}

	#stopEntities(): void {
		this.unsubscribeIndex?.()
		this.unsubscribeIndex = undefined
		this.unsubscribeEntities?.()
		this.unsubscribeEntities = undefined
		this.subscribedKey = undefined
		this.activeEntitySub = undefined
		this.pendingEntitySub = undefined
		this.#debouncedRecompute.cancel()
		this.#debouncedRegistriesChanged.cancel()
	}

	#startEntities(conn: Connection): void {
		// Server-side entity_ids needs HA 2022.4+ (the legacy path streams every state_changed event)
		const filterInHa = hasAnyFilter(this.config) && atLeastHaVersion(conn.haVersion, 2022, 4, 0)
		if (!filterInHa) {
			this.#applySubscription(conn, undefined)
			return
		}

		if (hasTaxonomyFilter(this.config)) this.registries.setDeviceOwners('filter:', ['config'])
		this.unsubscribeIndex = entityIndexColl(conn).subscribe((index) => {
			this.entityIndex = index
			if (!index.ok)
				this.log('warn', 'Could not read the entity registry, so entities are not filtered in Home Assistant')
			this.#recompute()
		})
	}

	/** Resolve the filter against the registries and (re)subscribe if the wanted set of entities changed */
	#recompute(): void {
		const conn = this.client
		if (!conn) return

		let wanted: string[] | undefined
		const index = this.entityIndex
		if (index?.ok && hasAnyFilter(this.config)) {
			this.resolvedIds = resolveFilteredIds(
				{
					entityIds: index.allIds,
					registry: index.registry,
					devices: this.registries.getDeviceMap(),
					areas: this.registries.getAreaEntries(),
				},
				this.config,
			)

			const ids = new Set(this.resolvedIds)
			for (const id of this.entitySubscriptions.getReferencedEntityIds()) {
				if (VALID_ENTITY_ID.test(id)) ids.add(id)
			}
			wanted = ids.size > 0 ? Array.from(ids) : [NO_ENTITIES_PLACEHOLDER]
		} else {
			// Unfiltered fallback: the current behaviour
			this.resolvedIds = undefined
		}

		this.#applySubscription(conn, wanted)
		this.scheduleDefinitions()
	}

	#debouncedRecompute = debounceFn(() => this.#recompute(), { wait: 750, maxWait: 3000, before: false, after: true })

	#debouncedRegistriesChanged = debounceFn(
		() => {
			if (this.entityIndex) this.#recompute()
			else this.scheduleDefinitions()
		},
		{ wait: 300, maxWait: 2000, before: false, after: true },
	)

	/**
	 * Subscribe to the given entities (undefined = all). A changed set creates a new subscription whose initial
	 * state is diffed into the existing state, and then drops the old subscription.
	 */
	#applySubscription(conn: Connection, wanted: string[] | undefined): void {
		const key = wanted ? wanted.slice().sort().join(',') : '*'
		if (key === this.subscribedKey) return
		this.subscribedKey = key

		const previousUnsub = this.unsubscribeEntities
		const sub = {}
		this.pendingEntitySub = sub

		this.unsubscribeEntities = entitiesColl(conn, wanted).subscribe((ev) => {
			if (this.pendingEntitySub === sub) {
				// First state of this subscription: anything we had which is not in it has been removed
				this.pendingEntitySub = undefined
				this.activeEntitySub = sub
				const current = this.pendingState?.entities ?? this.stateObj
				for (const id of Object.keys(current)) {
					if (!(id in ev.entities)) ev.removed.add(id)
				}
				previousUnsub?.()
			} else if (this.activeEntitySub !== sub) {
				return
			}

			this.deboundProcessStateChange(ev)
		})
	}

	private filteredState(): HassEntity[] {
		return this.state.filter((e) => this.entityFilter(e.entity_id))
	}

	private applyVariableDefinitions(): void {
		if (this.config.enable_variables === false) {
			this.setVariableDefinitions({})
			this.lastFilterCounts = undefined
			this.log('info', 'HA variables disabled — feedbacks/actions/presets still active.')
			if (this.state.length > 0) {
				this.updateStatus(InstanceStatus.Ok, 'Variables disabled')
			}
			return
		}

		const breakdown = computeFilterBreakdown(this.#allEntityIds(), this.config)
		const counts = InitVariables(this, this.state, this.entityFilter, this.exposeAttributes)
		this.lastFilterCounts = {
			entitiesMatched: counts.entitiesMatched,
			variablesCount: counts.variablesCount,
			exposeAttributes: this.exposeAttributes,
			breakdown,
		}

		const summary = [
			`HA filter applied:`,
			`  total entities:         ${breakdown.totalCount}`,
			`  after domains:          ${breakdown.afterDomains}`,
			`  after include patterns: ${breakdown.afterIncludes}`,
			`  after exclude patterns: ${breakdown.afterExcludes}`,
			`  variables registered:   ${counts.variablesCount} (attrs ${this.exposeAttributes ? 'on' : 'off'})`,
		].join('\n')
		this.log('info', summary)

		if (this.state.length > 0) {
			this.updateStatus(
				InstanceStatus.Ok,
				`${counts.entitiesMatched}/${this.#allEntityIds().length} entities, ${counts.variablesCount} vars`,
			)
		}
	}
}
