import Quill from "quill"
import { QuillBinding } from "y-quill"
import QuillCursors from "quill-cursors"
import * as Y from "yjs"
import { createRemoteDocProvider } from "./0-remote-provider"

// import "quill/dist/quill.snow.css"
import {
    getNonSecretHardCodedKeyForTestingSymmetricEncryption,
    type ProviderEncryptionConfig,
} from "./1-crypto-update-factory"

const QUILL_TOOLBAR = [
    // Font selection
    [{ font: [] }],

    // Header formatting (H1 to H6, plus normal text)
    // [{ header: [1, 2, 3, 4, 5, 6, false] }],

    // Font size (this might need a corresponding CSS configuration)
    [{ size: ["small", false, "large", "huge"] }],
    // [{ size: ['10px', '12px', '14px', '16px', '18px', '20px', '24px', '36px'] }],

    // Basic text formatting: Bold, Italic, Underline, Strike through.
    ["bold", "italic", "underline", "strike"],

    ["link", "formula"],

    // Subscript and superscript.
    [{ script: "sub" }, { script: "super" }],

    // Block formatting: Code Block and Blockquote.
    ["blockquote", "code-block"],

    // Color and background color pickers.
    [{ color: [] }, { background: [] }],

    // List options: Ordered and bullet lists.
    [{ list: "ordered" }, { list: "bullet" }],

    // Outdent and Indent.
    [{ indent: "-1" }, { indent: "+1" }],

    // Text alignment options.
    [{ align: [] }],

    // Media embeds: Link, Image, Video, Formula.
    // ["link", "image", "video", "formula"],
    ["image", "video"],

    // Clear formatting.
    ["clean"],

    // (Optional) Custom item example: Adding a horizontal rule.
    // You would need to implement a custom handler for this option.
    // [{ // This is a custom group that you can tie to a custom handler.
    //   handler: "insertHorizontalRule"
    // }],
]
function initializeQuillEditor(element: HTMLElement | string) {
    // TODO: don't rerun this if already registered
    Quill.register("modules/cursors", QuillCursors)

    const quillEditor = new Quill(element, {
        modules: {
            cursors: true,
            // cursors: {
            //     transformOnTextChange: true,
            // },
            toolbar: QUILL_TOOLBAR,
            history: {
                // Local undo shouldn't undo changes
                // from remote users
                userOnly: true,
            },
        },
        placeholder: "Start collaborating...",
        theme: "snow", // or 'bubble'
    })
    return quillEditor
}

/**
 * Creates a quill editor + sets up the yjs binding and remote provider. You can pass in your own function to initialize the quill editor. You can also call the parts for more control/customization, this is partially meant as a demo/starting point.
 * @param domElement element query selector or HTMLElement
 * @param encryptionParams WARNING: if not specified, currently defaults to using publicly known key in place of secret key (done this way for ease of testing)
 * you must call `import "quill/dist/quill.snow.css"` or equiv yourself!
 */
export async function createCollaborativeQuillEditor(
    // TODO: this should be one params object
    domElement: HTMLElement | string,
    remoteDocId: string,
    initializeQuillEditorFunc: (
        element: HTMLElement | string
    ) => Quill = initializeQuillEditor,
    onConnectError: (error: Error) => void = () => {
        // alert("sorry you may be offline")
        console.error("YOU MAY BE OFFLINE")
    },

    encryptionParams?: ProviderEncryptionConfig
) {
    const realDomElement =
        domElement instanceof HTMLElement
            ? domElement
            : document.querySelector(domElement)!
    const quillWrapperElem = document.createElement("div")
    quillWrapperElem.style.overflow = "visible"
    realDomElement.appendChild(quillWrapperElem)

    const yDoc = new Y.Doc()
    const yType = yDoc.getText("quill")

    // using our local-provider provider

    const realEncryptionParams = encryptionParams ?? {
        mainKey: await getNonSecretHardCodedKeyForTestingSymmetricEncryption(),
        validOldKeys: [],
        useWriteSignaturesForServer: true,
        useWriteSignaturesForClients: true,
    }
    const remoteDocYBindingProvider = await createRemoteDocProvider(yDoc, {
        remoteDocId,
        mergeInitialState: true,
        encryptionParams: realEncryptionParams,
    }).catch((error) => {
        console.error("App: Failed to create remote doc provider!", error)
        if (error instanceof Error) {
            if (error.message.includes("connect failed")) {
                onConnectError(error)
            }
        }
        throw error
    })

    // Specify awareness information for local user to integrate with quill-cursors
    remoteDocYBindingProvider.awareness.setLocalStateField("user", {
        name: `anonymous ${getRandomAnimal()}`,
        color: getRandomColor(),
    })

    const quillEditor = initializeQuillEditorFunc(quillWrapperElem)
    const quillBinding = new QuillBinding(
        yType,
        quillEditor,
        remoteDocYBindingProvider.awareness
    )

    async function deleteEditor() {
        await remoteDocYBindingProvider.disconnect()
        yDoc.destroy()

        // remove the dom element. Needs to be parent of the quillEditor container because the quill toolbars module is added next to the main quillEditor container
        // const realElement = domElement instanceof HTMLElement ? domElement : document.querySelector(domElement)
        const quillWrapperElem = quillEditor.container.parentElement
        quillWrapperElem?.remove()
    }
    return {
        yDoc,
        yType,
        quillEditor,
        quillBinding,
        yBindingProvider: remoteDocYBindingProvider,
        deleteEditor,
    }
}

// ------------

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
