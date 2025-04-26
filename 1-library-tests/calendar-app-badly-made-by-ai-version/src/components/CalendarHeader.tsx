import { format } from "date-fns"
import { getNavigationFunctions } from "../utils/calendarUtils"

interface CalendarHeaderProps {
    currentDate: Date
    view: "month" | "week" | "day"
    onViewChange: (view: "month" | "week" | "day") => void
    onDateChange: (date: Date) => void
    onAddEvent: () => void
}

export const CalendarHeader = ({
    currentDate,
    view,
    onViewChange,
    onDateChange,
    onAddEvent,
}: CalendarHeaderProps) => {
    const { next, prev, today } = getNavigationFunctions(view)

    const handlePrev = () => {
        onDateChange(prev(currentDate))
    }

    const handleNext = () => {
        onDateChange(next(currentDate))
    }

    const handleToday = () => {
        onDateChange(today())
    }

    const getFormattedDate = () => {
        switch (view) {
            case "month":
                return format(currentDate, "MMMM yyyy")
            case "week":
                return `Week of ${format(currentDate, "MMMM d, yyyy")}`
            case "day":
                return format(currentDate, "EEEE, MMMM d, yyyy")
            default:
                return ""
        }
    }

    return (
        <header className="bg-white py-4 px-6 flex items-center justify-between shadow border-b">
            <div className="flex items-center space-x-4">
                <h1 className="text-xl font-bold">Calendar</h1>

                <div className="flex space-x-1">
                    <button
                        onClick={handleToday}
                        className="px-3 py-1 text-sm bg-white border rounded hover:bg-gray-50"
                    >
                        Today
                    </button>

                    <button
                        onClick={handlePrev}
                        className="p-1 rounded hover:bg-gray-100"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                        >
                            <path
                                fillRule="evenodd"
                                d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                                clipRule="evenodd"
                            />
                        </svg>
                    </button>

                    <button
                        onClick={handleNext}
                        className="p-1 rounded hover:bg-gray-100"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                        >
                            <path
                                fillRule="evenodd"
                                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                                clipRule="evenodd"
                            />
                        </svg>
                    </button>
                </div>

                <h2 className="text-xl font-semibold">{getFormattedDate()}</h2>
            </div>

            <div className="flex items-center space-x-4">
                <div className="flex border rounded overflow-hidden">
                    <button
                        onClick={() => onViewChange("month")}
                        className={`px-3 py-1 text-sm ${
                            view === "month"
                                ? "bg-blue-500 text-white"
                                : "bg-white hover:bg-gray-50"
                        }`}
                    >
                        Month
                    </button>
                    <button
                        onClick={() => onViewChange("week")}
                        className={`px-3 py-1 text-sm ${
                            view === "week"
                                ? "bg-blue-500 text-white"
                                : "bg-white hover:bg-gray-50"
                        }`}
                    >
                        Week
                    </button>
                    <button
                        onClick={() => onViewChange("day")}
                        className={`px-3 py-1 text-sm ${
                            view === "day"
                                ? "bg-blue-500 text-white"
                                : "bg-white hover:bg-gray-50"
                        }`}
                    >
                        Day
                    </button>
                </div>

                <button
                    onClick={onAddEvent}
                    className="flex items-center px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 mr-1"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                    >
                        <path
                            fillRule="evenodd"
                            d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
                            clipRule="evenodd"
                        />
                    </svg>
                    Add Event
                </button>
            </div>
        </header>
    )
}
