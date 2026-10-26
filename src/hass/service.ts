import { callService, type Connection, type HassServiceTarget } from 'home-assistant-js-websocket'
import { OnOffToggle } from '../util.js'

export interface InvokeServiceParams {
	domain: string
	service: string
	data?: object
	target?: HassServiceTarget
	/** Ask HA to return the service response (only valid for services that support it) */
	returnResponse?: boolean
	/** Abort the wait for the response; the call may still complete in HA */
	signal?: AbortSignal
}

/**
 * Call a HA service. Throws when not connected, so that the error reaches the action result.
 */
export async function invokeService(client: Connection | undefined, params: InvokeServiceParams): Promise<unknown> {
	if (!client) throw new Error('Not connected to Home Assistant')

	const { domain, service, data, target, returnResponse, signal } = params
	signal?.throwIfAborted()

	const call = callService(client, domain, service, data, target, returnResponse || undefined)
	// HA rejects with plain objects ({code, message}); make sure callers always get an Error
	const toError = (e: unknown): Error =>
		e instanceof Error ? e : new Error((e as { message?: string } | undefined)?.message ?? JSON.stringify(e))
	if (!signal)
		return call.catch((e: unknown) => {
			throw toError(e)
		})

	return new Promise((resolve, reject) => {
		const onAbort = (): void => reject(toError(signal.reason ?? 'Aborted'))
		signal.addEventListener('abort', onAbort, { once: true })
		call.then(resolve, (e: unknown) => reject(toError(e))).finally(() => signal.removeEventListener('abort', onAbort))
	})
}

/** Map the on/off/toggle option to a `homeassistant` service and call it for the given entities */
export async function entityOnOff(
	client: Connection | undefined,
	options: { state?: unknown; entity_id?: unknown },
	signal?: AbortSignal,
): Promise<{ service: string; entity_id: string[] }> {
	let service: string
	switch (options.state as OnOffToggle) {
		case OnOffToggle.Off:
			service = 'turn_off'
			break
		case OnOffToggle.Toggle:
			service = 'toggle'
			break
		default:
			service = 'turn_on'
			break
	}

	await invokeService(client, {
		domain: 'homeassistant',
		service,
		data: { entity_id: options.entity_id },
		signal,
	})
	const ids = options.entity_id
	return {
		service: `homeassistant.${service}`,
		entity_id: Array.isArray(ids) ? ids.map(String) : typeof ids === 'string' && ids ? [ids] : [],
	}
}
