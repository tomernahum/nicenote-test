// slow to write only, not to read. may have been an oversight
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

    setLatency(latency: number) {
        this.latency = latency
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

    async remove(filterFn: (item: T) => boolean): Promise<T[]> {
        await new Promise((resolve) => setTimeout(resolve, this.latency))
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

    async clear() {
        await new Promise((resolve) => setTimeout(resolve, this.latency))
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

    async splice(
        start: number,
        deleteCount: number = 0,
        ...itemsToAdd: T[]
    ): Promise<T[]> {
        await new Promise((resolve) => setTimeout(resolve, this.latency))
        const deletedItems = this.items.splice(
            start,
            deleteCount,
            ...itemsToAdd
        )
        this.notifySubscribers()
        // Notify each new item subscriber separately for every new item added
        if (itemsToAdd.length > 0) {
            itemsToAdd.forEach((item) => {
                this.itemSubscribers.forEach((callback) =>
                    callback(item, this.items)
                )
            })
        }
        return deletedItems
    }
}

export function getRandomAnimal() {
    const animals = [
        "Aardvark",
        "Albatross",
        "Alligator",
        "Alpaca",
        "Ant",
        "Anteater",
        "Antelope",
        "Armadillo",
        "Axolotl",
        "Baboon",
        "Badger",
        "Bandicoot",
        "Barracuda",
        "Bat",
        "Bear",
        "Beaver",
        "Bee",
        "Binturong",
        "Bird",
        "Bison",
        "Boar",
        "Buffalo",
        "Butterfly",
        "Camel",
        "Capybara",
        "Caracal",
        "Caribou",
        "Cassowary",
        "Cat",
        "Caterpillar",
        "Catfish",
        "Centipede",
        "Chameleon",
        "Cheetah",
        "Chicken",
        "Chimpanzee",
        "Chinchilla",
        "Chipmunk",
        "Civet",
        "Clam",
        "Clownfish",
        "Cobra",
        "Cockroach",
        "Condor",
        "Cougar",
        "Cow",
        "Coyote",
        "Crab",
        "Crane",
        "Crawfish",
        "Crocodile",
        "Crow",
        "Cuckoo",
        "Cuttlefish",
        "Deer",
        "Dingo",
        "Dodo",
        "Dog",
        "Dolphin",
        "Donkey",
        "Dormouse",
        "Dove",
        "Dragonfly",
        "Duck",
        "Dugong",
        "Eagle",
        "Echidna",
        "Eel",
        "Egret",
        "Elephant",
        "Elk",
        "Emu",
        "Falcon",
        "Ferret",
        "Finch",
        "Firefly",
        "Fish",
        "Flamingo",
        "Flea",
        "Fly",
        "Fox",
        "Frog",
        "Gazelle",
        "Gecko",
        "Gerbil",
        "Giraffe",
        "Goat",
        "Goose",
        "Gopher",
        "Gorilla",
        "Grasshopper",
        "Hamster",
        "Hare",
        "Hawk",
        "Hedgehog",
        "Heron",
        "Hippopotamus",
        "Hornet",
        "Horse",
        "Hummingbird",
        "Hyena",
        "Iguana",
        "Impala",
        "Jackal",
        "Jaguar",
        "Jellyfish",
        "Kangaroo",
        "Kingfisher",
        "Kiwi",
        "Koala",
        "Koi",
        "KomodoDragon",
        "Krill",
        "Ladybug",
        "Lemur",
        "Leopard",
        "Lion",
        "Lizard",
        "Llama",
        "Lobster",
        "Locust",
        "Lynx",
        "Macaw",
        "Magpie",
        "Manatee",
        "Mandrill",
        "Mantis",
        "Marmot",
        "Meerkat",
        "Mink",
        "Mole",
        "Mongoose",
        "Monkey",
        "Moose",
        "Mosquito",
        "Moth",
        "Mouse",
        "Mule",
        "Narwhal",
        "Newt",
        "Nightingale",
        "Octopus",
        "Okapi",
        "Opossum",
        "Orangutan",
        "Orca",
        "Ostrich",
        "Otter",
        "Owl",
        "Ox",
        "Panda",
        "Panther",
        "Parrot",
        "Peacock",
        "Pelican",
        "Penguin",
        "Pheasant",
        "Pig",
        "Pigeon",
        "Platypus",
        "Porcupine",
        "Porpoise",
        "Possum",
        "PrairieDog",
        "Prawn",
        "Puffin",
        "Puma",
        "Quail",
        "Quokka",
        "Rabbit",
        "Raccoon",
        "Ram",
        "Rat",
        "Rattlesnake",
        "Raven",
        "RedPanda",
        "Reindeer",
        "Rhinoceros",
        "Roadrunner",
        "Rooster",
        "Salamander",
        "Salmon",
        "Sardine",
        "Scorpion",
        "Seahorse",
        "Seal",
        "Shark",
        "Sheep",
        "Shrimp",
        "Skunk",
        "Sloth",
        "Snail",
        "Snake",
        "Sparrow",
        "Spider",
        "Squid",
        "Squirrel",
        "Starfish",
        "Stingray",
        "Stork",
        "Swan",
        "Tapir",
        "Tarsier",
        "Termite",
        "Tiger",
        "Toad",
        "Tortoise",
        "Toucan",
        "Turkey",
        "Turtle",
        "Viper",
        "Vulture",
        "Wallaby",
        "Walrus",
        "Warthog",
        "Wasp",
        "Weasel",
        "Whale",
        "Wildcat",
        "Wolf",
        "Wolverine",
        "Wombat",
        "Woodpecker",
        "Worm",
        "Yak",
        "Zebra",
    ]
    return animals[Math.floor(Math.random() * animals.length)]
}
export function getRandomColor() {
    const someColors = [
        "#FF0000", // Red
        "#00FF00", // Lime
        "#0000FF", // Blue
        "#FFFF00", // Yellow
        "#FF00FF", // Magenta
        "#00FFFF", // Cyan
        "#800000", // Maroon
        "#008000", // Green
        "#000080", // Navy
        "#808000", // Olive
        "#800080", // Purple
        "#008080", // Teal
        "#FFA500", // Orange
        "#A52A2A", // Brown
        "#FFC0CB", // Pink
        "#40E0D0", // Turquoise
    ]
    const manyColors = [
        "#f0f8ff", // AliceBlue
        "#faebd7", // AntiqueWhite
        "#00ffff", // Aqua
        "#7fffd4", // Aquamarine
        "#f0ffff", // Azure
        "#f5f5dc", // Beige
        "#ffe4c4", // Bisque
        "#000000", // Black
        "#ffebcd", // BlanchedAlmond
        "#0000ff", // Blue
        "#8a2be2", // BlueViolet
        "#a52a2a", // Brown
        "#deb887", // BurlyWood
        "#5f9ea0", // CadetBlue
        "#7fff00", // Chartreuse
        "#d2691e", // Chocolate
        "#ff7f50", // Coral
        "#6495ed", // CornflowerBlue
        "#fff8dc", // Cornsilk
        "#dc143c", // Crimson
        "#00ffff", // Cyan
        "#00008b", // DarkBlue
        "#008b8b", // DarkCyan
        "#b8860b", // DarkGoldenRod
        "#a9a9a9", // DarkGray
        "#006400", // DarkGreen
        "#bdb76b", // DarkKhaki
        "#8b008b", // DarkMagenta
        "#556b2f", // DarkOliveGreen
        "#ff8c00", // DarkOrange
        "#9932cc", // DarkOrchid
        "#8b0000", // DarkRed
        "#e9967a", // DarkSalmon
        "#8fbc8f", // DarkSeaGreen
        "#483d8b", // DarkSlateBlue
        "#2f4f4f", // DarkSlateGray
        "#00ced1", // DarkTurquoise
        "#9400d3", // DarkViolet
        "#ff1493", // DeepPink
        "#00bfff", // DeepSkyBlue
        "#696969", // DimGray
        "#1e90ff", // DodgerBlue
        "#b22222", // FireBrick
        "#fffaf0", // FloralWhite
        "#228b22", // ForestGreen
        "#ff00ff", // Fuchsia
        "#dcdcdc", // Gainsboro
        "#f8f8ff", // GhostWhite
        "#ffd700", // Gold
        "#daa520", // GoldenRod
        "#808080", // Gray
        "#008000", // Green
        "#adff2f", // GreenYellow
        "#f0fff0", // HoneyDew
        "#ff69b4", // HotPink
        "#cd5c5c", // IndianRed
        "#4b0082", // Indigo
        "#fffff0", // Ivory
        "#f0e68c", // Khaki
        "#e6e6fa", // Lavender
        "#fff0f5", // LavenderBlush
        "#7cfc00", // LawnGreen
        "#fffacd", // LemonChiffon
        "#add8e6", // LightBlue
        "#f08080", // LightCoral
        "#e0ffff", // LightCyan
        "#fafad2", // LightGoldenRodYellow
        "#d3d3d3", // LightGray
        "#90ee90", // LightGreen
        "#ffb6c1", // LightPink
        "#ffa07a", // LightSalmon
        "#20b2aa", // LightSeaGreen
        "#87cefa", // LightSkyBlue
        "#778899", // LightSlateGray
        "#b0c4de", // LightSteelBlue
        "#ffffe0", // LightYellow
        "#00ff00", // Lime
        "#32cd32", // LimeGreen
        "#faf0e6", // Linen
        "#ff00ff", // Magenta
        "#800000", // Maroon
        "#66cdaa", // MediumAquaMarine
        "#0000cd", // MediumBlue
        "#ba55d3", // MediumOrchid
        "#9370db", // MediumPurple
        "#3cb371", // MediumSeaGreen
        "#7b68ee", // MediumSlateBlue
        "#00fa9a", // MediumSpringGreen
        "#48d1cc", // MediumTurquoise
        "#c71585", // MediumVioletRed
        "#191970", // MidnightBlue
        "#f5fffa", // MintCream
        "#ffe4e1", // MistyRose
        "#ffe4b5", // Moccasin
        "#ffdead", // NavajoWhite
        "#000080", // Navy
        "#fdf5e6", // OldLace
        "#808000", // Olive
        "#6b8e23", // OliveDrab
        "#ffa500", // Orange
        "#ff4500", // OrangeRed
        "#da70d6", // Orchid
        "#eee8aa", // PaleGoldenRod
        "#98fb98", // PaleGreen
        "#afeeee", // PaleTurquoise
        "#db7093", // PaleVioletRed
        "#ffefd5", // PapayaWhip
        "#ffdab9", // PeachPuff
        "#cd853f", // Peru
        "#ffc0cb", // Pink
        "#dda0dd", // Plum
        "#b0e0e6", // PowderBlue
        "#800080", // Purple
        "#ff0000", // Red
        "#bc8f8f", // RosyBrown
        "#4169e1", // RoyalBlue
        "#8b4513", // SaddleBrown
        "#fa8072", // Salmon
        "#f4a460", // SandyBrown
        "#2e8b57", // SeaGreen
        "#fff5ee", // SeaShell
        "#a0522d", // Sienna
        "#c0c0c0", // Silver
        "#87ceeb", // SkyBlue
        "#6a5acd", // SlateBlue
        "#708090", // SlateGray
        "#fffafa", // Snow
        "#00ff7f", // SpringGreen
        "#4682b4", // SteelBlue
        "#d2b48c", // Tan
        "#008080", // Teal
        "#d8bfd8", // Thistle
        "#ff6347", // Tomato
        "#40e0d0", // Turquoise
        "#ee82ee", // Violet
        "#f5deb3", // Wheat
        "#ffffff", // White
        "#f5f5f5", // WhiteSmoke
        "#ffff00", // Yellow
        "#9acd32", // YellowGreen
    ]
    const colors = [...someColors, ...manyColors]
    return colors[Math.floor(Math.random() * colors.length)]
}
