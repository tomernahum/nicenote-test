import { Event } from "../data"

interface EventItemProps {
    event: Event
    isCompact?: boolean
    onClick?: (event: Event) => void
}

export default function EventItem({
    event,
    isCompact = false,
    onClick,
}: EventItemProps) {
    const formatTime = (date: Date) => {
        return date.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        })
    }

    const handleClick = () => {
        if (onClick) {
            onClick(event)
        }
    }

    if (isCompact) {
        return (
            <div
                className="px-2 py-1 mb-1 text-xs font-medium text-white rounded cursor-pointer truncate"
                style={{ backgroundColor: event.color }}
                onClick={handleClick}
                title={`${event.title} - ${event.description}`}
            >
                {event.title}
            </div>
        )
    }

    return (
        <div
            className="p-2 mb-1 text-sm bg-white border rounded shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            onClick={handleClick}
        >
            <div className="flex items-center mb-1">
                <div
                    className="w-3 h-3 mr-2 rounded-full"
                    style={{ backgroundColor: event.color }}
                ></div>
                <div className="font-medium">{event.title}</div>
            </div>
            {!event.allDay && (
                <div className="text-xs text-gray-500">
                    {formatTime(event.start)} - {formatTime(event.end)}
                </div>
            )}
            {event.allDay && (
                <div className="text-xs text-gray-500">All day</div>
            )}
            <div className="mt-1 text-xs text-gray-600 truncate">
                {event.description}
            </div>
        </div>
    )
}
