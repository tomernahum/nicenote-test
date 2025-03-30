export class SlowObservableList<T> {
    private subscribers: ((state: T[]) => void)[] = []
    private itemSubscribers: ((newItem: T, fullState: T[]) => void)[] = []

    private items: T[] = []
    private latency = 0

    constructor({
        latency = 0,
        initialItems = [],
    }: { latency?: number; initialItems?: T[] } = {}) {
        this.latency = latency
        this.items = initialItems
    }

    // Subscribe to full list updates.
    subscribe(callback: (state: T[]) => void) {
        this.subscribers.push(callback)
        callback(this.items) // Initial call with current state
        return () => {
            // Unsubscribe function.
            this.subscribers = this.subscribers.filter((cb) => cb !== callback)
        }
    }

    // Subscribe to notifications for each new item added.
    // The callback gets the new item and the full state of the list.
    subscribeItem(callback: (newItem: T, fullState: T[]) => void) {
        this.itemSubscribers.push(callback)
        return () => {
            this.itemSubscribers = this.itemSubscribers.filter(
                (cb) => cb !== callback
            )
        }
    }

    private notifySubscribers() {
        this.subscribers.forEach((callback) => callback(this.items))
    }

    async push(...newItems: T[]) {
        await new Promise((resolve) => setTimeout(resolve, this.latency))
        this.items.push(...newItems)
        this.notifySubscribers()
        // Notify each new item subscriber separately for every new item added.
        newItems.forEach((item) => {
            this.itemSubscribers.forEach((callback) =>
                callback(item, this.items)
            )
        })
    }

    pop(): T | undefined {
        const item = this.items.pop()
        this.notifySubscribers()
        return item
    }

    remove(filterFn: (item: T) => boolean): T[] {
        const removedItems: T[] = []
        this.items = this.items.filter((item) => {
            if (filterFn(item)) {
                removedItems.push(item)
                return false
            }
            return true
        })
        if (removedItems.length > 0) {
            this.notifySubscribers()
        }
        return removedItems
    }

    clear() {
        this.items = []
        this.notifySubscribers()
    }

    get length(): number {
        return this.items.length
    }

    get(index: number): T | undefined {
        return this.items[index]
    }

    toArray(): T[] {
        return [...this.items]
    }
}
