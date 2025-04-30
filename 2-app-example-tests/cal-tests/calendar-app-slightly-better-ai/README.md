# Calendar App

A modern, responsive calendar application built with React, TypeScript, and Tailwind CSS.

## Features

-   **Multiple Calendar Views**: Switch between Day, Week, and Month views
-   **Event Management**: Add, edit, and delete calendar events
-   **Event Details**: Each event includes title, description, start/end times, and color coding
-   **Interactive UI**: Click on days to quickly navigate to Day view
-   **Responsive Design**: Works on desktop and mobile devices

## Getting Started

### Prerequisites

-   Node.js (v14 or later)
-   pnpm (v7 or later)

### Installation

1. Clone the repository
2. Install dependencies:

```bash
pnpm install
```

3. Start the development server:

```bash
pnpm dev
```

4. Open your browser to [http://localhost:5173](http://localhost:5173)

## Project Structure

-   `src/components/`: UI components for the calendar
    -   `CalendarHeader.tsx`: Header with navigation and view switching
    -   `DayView.tsx`: Day view component
    -   `WeekView.tsx`: Week view component
    -   `MonthView.tsx`: Month view component
    -   `EventItem.tsx`: Event display component
    -   `EventForm.tsx`: Form for adding/editing events
-   `src/data.ts`: Data management and utilities

## Data Management

Currently, the app uses hardcoded data stored in `data.ts`. In a future update, this will be connected to a backend API.

## Technologies Used

-   **React**: UI library
-   **TypeScript**: Type safety
-   **Tailwind CSS**: Styling
-   **Vite**: Build tool and development server

## Future Enhancements

-   Backend integration for persistent storage
-   Recurring events
-   Drag and drop event management
-   Calendar sharing and collaboration
-   Notifications and reminders
