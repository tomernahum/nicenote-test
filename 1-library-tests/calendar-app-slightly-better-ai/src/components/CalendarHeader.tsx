import { CalendarView } from "../data"

interface CalendarHeaderProps {
    date: Date
    view: CalendarView
    views: CalendarView[]
    onViewChange: (view: CalendarView) => void
    onDateChange: (date: Date) => void
}

export default function CalendarHeader({
    date,
    view,
    views,
    onViewChange,
    onDateChange,
}: CalendarHeaderProps) {
    const formatDate = (date: Date, viewType: string) => {
        const options: Intl.DateTimeFormatOptions = {
            year: "numeric",
            month: "long",
        }

        if (viewType === "day") {
            options.day = "numeric"
        }

        return new Intl.DateTimeFormat("en-US", options).format(date)
    }

    const handlePrevious = () => {
        const newDate = new Date(date)
        if (view.type === "day") {
            newDate.setDate(date.getDate() - 1)
        } else if (view.type === "week") {
            newDate.setDate(date.getDate() - 7)
        } else if (view.type === "month") {
            newDate.setMonth(date.getMonth() - 1)
        }
        onDateChange(newDate)
    }

    const handleNext = () => {
        const newDate = new Date(date)
        if (view.type === "day") {
            newDate.setDate(date.getDate() + 1)
        } else if (view.type === "week") {
            newDate.setDate(date.getDate() + 7)
        } else if (view.type === "month") {
            newDate.setMonth(date.getMonth() + 1)
        }
        onDateChange(newDate)
    }

    const handleToday = () => {
        onDateChange(new Date())
    }

    return (
        <header className="flex items-center justify-between px-4 py-4 bg-white border-b border-gray-200">
            <div className="flex items-center space-x-4">
                <h1 className="text-xl font-semibold text-gray-800">
                    Calendar
                </h1>
                <div className="flex items-center space-x-2">
                    <button
                        className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
                        onClick={handleToday}
                    >
                        Today
                    </button>
                    <div className="flex items-center space-x-1">
                        <button
                            className="p-1 text-gray-400 rounded-full hover:bg-gray-100 hover:text-gray-500"
                            onClick={handlePrevious}
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="w-5 h-5"
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
                            className="p-1 text-gray-400 rounded-full hover:bg-gray-100 hover:text-gray-500"
                            onClick={handleNext}
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="w-5 h-5"
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
                    <h2 className="text-lg font-semibold text-gray-800">
                        {formatDate(date, view.type)}
                    </h2>
                </div>
            </div>
            <div className="flex">
                <div className="inline-flex rounded-md shadow-sm">
                    {views.map((v) => (
                        <button
                            key={v.id}
                            type="button"
                            className={`
                px-4 py-2 text-sm font-medium
                ${
                    v.id === view.id
                        ? "bg-indigo-600 text-white"
                        : "bg-white text-gray-700 hover:bg-gray-50"
                }
                ${
                    v.id === views[0].id
                        ? "rounded-l-md"
                        : v.id === views[views.length - 1].id
                        ? "rounded-r-md"
                        : ""
                }
                border border-gray-300
              `}
                            onClick={() => onViewChange(v)}
                        >
                            {v.name}
                        </button>
                    ))}
                </div>
            </div>
        </header>
    )
}
