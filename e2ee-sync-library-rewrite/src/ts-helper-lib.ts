// basically utils

function createObservable<T>(initialValue: T) {
    let value = initialValue
    const subscribers = new Set<(newValue: T) => void>()

    return {
        getVal,
        setVal,
        updateVal,
        subscribe,

        get value() {
            return value
        },
        set value(newValue: T) {
            setVal(newValue)
        },
    }
    function getVal() {
        return value
    }
    function setVal(newValue: T) {
        value = newValue
        subscribers.forEach((callback) => callback(newValue))
    }
    function updateVal(fn: (oldValue: T) => T) {
        setVal(fn(value))
    }

    function subscribe(callback: (newValue: T) => void) {
        subscribers.add(callback)
        return () => {
            subscribers.delete(callback)
        }
    }
}

/**
 * Draft
 * You can return from your object the on function to support event listeners on your object
 * and internally to your object, use emit to emit events
 */
function createEventsHelper<
    Event extends {
        [key: string]: any
    }
>() {
    type EventName = keyof Event

    const listenerCallbacks = new Map<
        EventName,
        Set<(eventData: Event[EventName]) => void>
    >()
    return {
        emit: (event: EventName, data: Event[EventName]) => {
            listenerCallbacks.get(event)?.forEach((callback) => callback(data))
        },
        on: (
            event: EventName,
            callback: (eventData: Event[EventName]) => void
        ) => {
            const callbacks = listenerCallbacks.get(event) ?? new Set()
            callbacks.add(callback)
            listenerCallbacks.set(event, callbacks)
            return () => {
                callbacks.delete(callback)
                if (callbacks.size === 0) {
                    listenerCallbacks.delete(event)
                }
            }
        },
    }
}
