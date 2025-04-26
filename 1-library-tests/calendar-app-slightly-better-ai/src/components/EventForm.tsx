import { useState, useEffect } from "react"
import { Event } from "../data"

interface EventFormProps {
    event?: Event
    onSave: (event: Omit<Event, "id"> | Event) => void
    onCancel: () => void
}

const colorOptions = [
    { value: "#4f46e5", label: "Indigo" },
    { value: "#0891b2", label: "Cyan" },
    { value: "#dc2626", label: "Red" },
    { value: "#15803d", label: "Green" },
    { value: "#9333ea", label: "Purple" },
    { value: "#ea580c", label: "Orange" },
    { value: "#0369a1", label: "Blue" },
    { value: "#4d7c0f", label: "Lime" },
]

export default function EventForm({ event, onSave, onCancel }: EventFormProps) {
    const [title, setTitle] = useState("")
    const [description, setDescription] = useState("")
    const [startDate, setStartDate] = useState("")
    const [startTime, setStartTime] = useState("")
    const [endDate, setEndDate] = useState("")
    const [endTime, setEndTime] = useState("")
    const [allDay, setAllDay] = useState(false)
    const [color, setColor] = useState(colorOptions[0].value)

    useEffect(() => {
        if (event) {
            setTitle(event.title)
            setDescription(event.description)
            setStartDate(formatDateForInput(event.start))
            setStartTime(formatTimeForInput(event.start))
            setEndDate(formatDateForInput(event.end))
            setEndTime(formatTimeForInput(event.end))
            setAllDay(event.allDay)
            setColor(event.color)
        } else {
            // Set default values for new event
            const now = new Date()
            const oneHourLater = new Date(now)
            oneHourLater.setHours(oneHourLater.getHours() + 1)

            setStartDate(formatDateForInput(now))
            setStartTime(formatTimeForInput(now))
            setEndDate(formatDateForInput(oneHourLater))
            setEndTime(formatTimeForInput(oneHourLater))
            setAllDay(false)
            setColor(colorOptions[0].value)
        }
    }, [event])

    const formatDateForInput = (date: Date): string => {
        return date.toISOString().split("T")[0]
    }

    const formatTimeForInput = (date: Date): string => {
        return date.toISOString().split("T")[1].substring(0, 5)
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()

        const startDateTime = new Date(`${startDate}T${startTime}`)
        const endDateTime = new Date(`${endDate}T${endTime}`)

        const newEvent: Omit<Event, "id"> = {
            title,
            description,
            start: startDateTime,
            end: endDateTime,
            color,
            allDay,
        }

        if (event) {
            onSave({ ...newEvent, id: event.id })
        } else {
            onSave(newEvent)
        }
    }

    return (
        <div className="fixed inset-0 z-10 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                <div
                    className="fixed inset-0 transition-opacity"
                    aria-hidden="true"
                >
                    <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
                </div>
                <span
                    className="hidden sm:inline-block sm:align-middle sm:h-screen"
                    aria-hidden="true"
                >
                    &#8203;
                </span>
                <div className="inline-block px-4 pt-5 pb-4 overflow-hidden text-left align-bottom transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
                    <div className="absolute top-0 right-0 pt-4 pr-4">
                        <button
                            type="button"
                            className="text-gray-400 bg-white rounded-md hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            onClick={onCancel}
                        >
                            <span className="sr-only">Close</span>
                            <svg
                                className="w-6 h-6"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                aria-hidden="true"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            </svg>
                        </button>
                    </div>
                    <form onSubmit={handleSubmit}>
                        <div className="sm:flex sm:items-start">
                            <div className="mt-3 w-full">
                                <h3 className="text-lg font-medium leading-6 text-gray-900">
                                    {event ? "Edit Event" : "Create New Event"}
                                </h3>
                                <div className="mt-4">
                                    <label
                                        htmlFor="title"
                                        className="block text-sm font-medium text-gray-700"
                                    >
                                        Title
                                    </label>
                                    <div className="mt-1">
                                        <input
                                            type="text"
                                            name="title"
                                            id="title"
                                            required
                                            className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                            value={title}
                                            onChange={(e) =>
                                                setTitle(e.target.value)
                                            }
                                        />
                                    </div>
                                </div>
                                <div className="mt-3">
                                    <label
                                        htmlFor="description"
                                        className="block text-sm font-medium text-gray-700"
                                    >
                                        Description
                                    </label>
                                    <div className="mt-1">
                                        <textarea
                                            id="description"
                                            name="description"
                                            rows={3}
                                            className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                            value={description}
                                            onChange={(e) =>
                                                setDescription(e.target.value)
                                            }
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center mt-3">
                                    <input
                                        id="allDay"
                                        name="allDay"
                                        type="checkbox"
                                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                        checked={allDay}
                                        onChange={(e) =>
                                            setAllDay(e.target.checked)
                                        }
                                    />
                                    <label
                                        htmlFor="allDay"
                                        className="block ml-2 text-sm font-medium text-gray-700"
                                    >
                                        All Day
                                    </label>
                                </div>
                                <div className="grid grid-cols-2 gap-4 mt-3">
                                    <div>
                                        <label
                                            htmlFor="startDate"
                                            className="block text-sm font-medium text-gray-700"
                                        >
                                            Start Date
                                        </label>
                                        <div className="mt-1">
                                            <input
                                                type="date"
                                                name="startDate"
                                                id="startDate"
                                                required
                                                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                                value={startDate}
                                                onChange={(e) =>
                                                    setStartDate(e.target.value)
                                                }
                                            />
                                        </div>
                                    </div>
                                    {!allDay && (
                                        <div>
                                            <label
                                                htmlFor="startTime"
                                                className="block text-sm font-medium text-gray-700"
                                            >
                                                Start Time
                                            </label>
                                            <div className="mt-1">
                                                <input
                                                    type="time"
                                                    name="startTime"
                                                    id="startTime"
                                                    required
                                                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                                    value={startTime}
                                                    onChange={(e) =>
                                                        setStartTime(
                                                            e.target.value
                                                        )
                                                    }
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-4 mt-3">
                                    <div>
                                        <label
                                            htmlFor="endDate"
                                            className="block text-sm font-medium text-gray-700"
                                        >
                                            End Date
                                        </label>
                                        <div className="mt-1">
                                            <input
                                                type="date"
                                                name="endDate"
                                                id="endDate"
                                                required
                                                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                                value={endDate}
                                                onChange={(e) =>
                                                    setEndDate(e.target.value)
                                                }
                                            />
                                        </div>
                                    </div>
                                    {!allDay && (
                                        <div>
                                            <label
                                                htmlFor="endTime"
                                                className="block text-sm font-medium text-gray-700"
                                            >
                                                End Time
                                            </label>
                                            <div className="mt-1">
                                                <input
                                                    type="time"
                                                    name="endTime"
                                                    id="endTime"
                                                    required
                                                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                                    value={endTime}
                                                    onChange={(e) =>
                                                        setEndTime(
                                                            e.target.value
                                                        )
                                                    }
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="mt-3">
                                    <label
                                        htmlFor="color"
                                        className="block text-sm font-medium text-gray-700"
                                    >
                                        Color
                                    </label>
                                    <div className="mt-1">
                                        <div className="flex flex-wrap gap-2">
                                            {colorOptions.map((option) => (
                                                <div
                                                    key={option.value}
                                                    className={`w-8 h-8 rounded-full cursor-pointer border-2 ${
                                                        color === option.value
                                                            ? "border-gray-800"
                                                            : "border-transparent"
                                                    }`}
                                                    style={{
                                                        backgroundColor:
                                                            option.value,
                                                    }}
                                                    onClick={() =>
                                                        setColor(option.value)
                                                    }
                                                    title={option.label}
                                                ></div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                            <button
                                type="submit"
                                className="inline-flex justify-center w-full px-4 py-2 text-base font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
                            >
                                {event ? "Update" : "Create"}
                            </button>
                            <button
                                type="button"
                                className="inline-flex justify-center w-full px-4 py-2 mt-3 text-base font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
                                onClick={onCancel}
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
