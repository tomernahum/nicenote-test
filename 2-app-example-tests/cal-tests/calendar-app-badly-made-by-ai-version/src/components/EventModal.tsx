import { useState, useEffect } from "react"
import { format } from "date-fns"
import type { CalendarEvent } from "../types"

interface EventModalProps {
    isOpen: boolean
    onClose: () => void
    event?: CalendarEvent
    selectedDate?: Date
    onSave: (event: Omit<CalendarEvent, "id"> | CalendarEvent) => void
    onDelete?: (eventId: string) => void
}

const DEFAULT_COLORS = [
    "#4f46e5", // indigo
    "#10b981", // emerald
    "#f59e0b", // amber
    "#ef4444", // red
    "#8b5cf6", // violet
    "#0ea5e9", // sky
    "#f97316", // orange
    "#0891b2", // cyan
]

export const EventModal = ({
    isOpen,
    onClose,
    event,
    selectedDate,
    onSave,
    onDelete,
}: EventModalProps) => {
    const [title, setTitle] = useState("")
    const [description, setDescription] = useState("")
    const [startDate, setStartDate] = useState("")
    const [startTime, setStartTime] = useState("")
    const [endDate, setEndDate] = useState("")
    const [endTime, setEndTime] = useState("")
    const [allDay, setAllDay] = useState(false)
    const [color, setColor] = useState(DEFAULT_COLORS[0])

    // Initialize form values when event or selectedDate changes
    useEffect(() => {
        if (event) {
            // Edit existing event
            setTitle(event.title)
            setDescription(event.description || "")

            const start = new Date(event.start)
            const end = new Date(event.end)

            setStartDate(format(start, "yyyy-MM-dd"))
            setEndDate(format(end, "yyyy-MM-dd"))
            setAllDay(!!event.allDay)

            if (!event.allDay) {
                setStartTime(format(start, "HH:mm"))
                setEndTime(format(end, "HH:mm"))
            } else {
                setStartTime("09:00")
                setEndTime("17:00")
            }

            setColor(event.color || DEFAULT_COLORS[0])
        } else if (selectedDate) {
            // New event with selected date
            const date = format(selectedDate, "yyyy-MM-dd")
            setTitle("")
            setDescription("")
            setStartDate(date)
            setEndDate(date)
            setStartTime("09:00")
            setEndTime("10:00")
            setAllDay(false)
            setColor(DEFAULT_COLORS[0])
        }
    }, [event, selectedDate])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()

        // Form validation
        if (!title.trim()) return

        // Create event object
        const eventData: Omit<CalendarEvent, "id"> = {
            title: title.trim(),
            description: description.trim() || undefined,
            start: allDay
                ? `${startDate}T00:00:00.000Z`
                : `${startDate}T${startTime}:00.000Z`,
            end: allDay
                ? `${endDate}T23:59:59.999Z`
                : `${endDate}T${endTime}:00.000Z`,
            allDay,
            color,
        }

        // If editing existing event, include id
        if (event) {
            onSave({ ...eventData, id: event.id })
        } else {
            onSave(eventData)
        }

        onClose()
    }

    const handleDelete = () => {
        if (event && onDelete) {
            onDelete(event.id)
            onClose()
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                <h2 className="text-xl font-bold mb-6">
                    {event ? "Edit Event" : "Create Event"}
                </h2>

                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Title
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Description
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 h-24"
                            />
                        </div>

                        <div className="flex items-center">
                            <input
                                type="checkbox"
                                id="allDay"
                                checked={allDay}
                                onChange={() => setAllDay(!allDay)}
                                className="mr-2"
                            />
                            <label
                                htmlFor="allDay"
                                className="text-sm font-medium text-gray-700"
                            >
                                All day
                            </label>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Start Date
                                </label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) =>
                                        setStartDate(e.target.value)
                                    }
                                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                            </div>

                            {!allDay && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Start Time
                                    </label>
                                    <input
                                        type="time"
                                        value={startTime}
                                        onChange={(e) =>
                                            setStartTime(e.target.value)
                                        }
                                        className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        required
                                    />
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    End Date
                                </label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                            </div>

                            {!allDay && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        End Time
                                    </label>
                                    <input
                                        type="time"
                                        value={endTime}
                                        onChange={(e) =>
                                            setEndTime(e.target.value)
                                        }
                                        className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        required
                                    />
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Color
                            </label>
                            <div className="flex space-x-2">
                                {DEFAULT_COLORS.map((c) => (
                                    <div
                                        key={c}
                                        className={`w-8 h-8 rounded-full cursor-pointer ${
                                            c === color
                                                ? "ring-2 ring-offset-2 ring-gray-400"
                                                : ""
                                        }`}
                                        style={{ backgroundColor: c }}
                                        onClick={() => setColor(c)}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 flex justify-between">
                        <div>
                            {event && onDelete && (
                                <button
                                    type="button"
                                    onClick={handleDelete}
                                    className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded"
                                >
                                    Delete
                                </button>
                            )}
                        </div>

                        <div className="flex space-x-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 text-sm text-white bg-blue-600 rounded"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    )
}
