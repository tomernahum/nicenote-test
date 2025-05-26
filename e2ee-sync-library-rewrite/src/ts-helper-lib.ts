// basically utils

export function createObservable<T>(initialValue: T) {
    let value = initialValue
    const subscribers = new Set<(newValue: T, oldValue: T) => void>()

    return {
        get: getVal,
        set: setVal,
        subscribe,
        onChange: subscribe,

        onValueBecomes,
        onValueChangesFrom,

        whileValueIs,

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
        const oldValue = value
        value = newValue
        subscribers.forEach((callback) => callback(newValue, oldValue))
    }
    // function updateVal(fn: (oldValue: T) => T) {
    //     setVal(fn(value))
    // }

    function subscribe(callback: (newValue: T, oldValue: T) => void) {
        subscribers.add(callback)
        return () => {
            subscribers.delete(callback)
        }
    }

    function onceChange(callback: (newValue: T, oldValue: T) => void) {
        const unsub = subscribe((newValue, oldValue) => {
            unsub()
            callback(newValue, oldValue)
        })
    }

    function onValueBecomes(
        valueItBecomes: T,
        callback: (oldValue: T) => void
    ) {
        const internalCallback = (newValue: T, oldValue: T) => {
            if (newValue === valueItBecomes) {
                callback(oldValue)
            }
        }
        return subscribe(internalCallback)
    }
    function onValueChangesFrom(
        valueItChangesFrom: T,
        callback: (newValue: T) => void
    ) {
        const internalCallback = (newValue: T, oldValue: T) => {
            if (oldValue === valueItChangesFrom) {
                callback(newValue)
            }
        }
        return subscribe(internalCallback)
    }

    /**
     * Registers a callback that runs when the value becomes a specific value, or runs immediately if the value is already the target value
     * the function returned by that callback is run when the value stops being the specific value
     */
    function whileValueIs(
        targetValue: T,
        callback: () => (newValueItBecame: T) => void
    ) {
        function handleEntry() {
            const cleanUpFunc = callback()

            const removeCleanUpListener = onValueChangesFrom(
                targetValue,
                (newValueItBecame) => {
                    cleanUpFunc(newValueItBecame)
                    removeCleanUpListener() // this should work...  makes this run once.
                }
            )
        }

        // if we are already the target value
        if (value === targetValue) {
            handleEntry()
        }

        // register callback
        const removeStart = onValueBecomes(targetValue, handleEntry)

        return removeStart
    }
}

/**
 * Draft
 * You can return from your object the on function to support event listeners on your object
 * and internally to your object, use emit to emit events
 */
export function createEventsHelper<
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
