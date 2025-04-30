# Calendar App

A fully interactive calendar application built with React, TypeScript, and Tailwind CSS. This application allows you to view, create, edit, and delete events in different calendar views (month, week, and day).

## Features

-   Month, week, and day views for the calendar
-   Create, edit, and delete events
-   Local storage persistence for saving calendar events
-   Customizable event colors
-   All-day events support
-   Responsive design

## Technologies Used

-   React 19
-   TypeScript
-   Tailwind CSS 4
-   date-fns for date manipulation
-   Vite for fast development and building

## Getting Started

### Prerequisites

-   Node.js (version 18 or higher recommended)
-   pnpm (version 8 or higher)

### Installation

1. Clone this repository or download the source code
2. Navigate to the project directory
3. Install dependencies:

```bash
pnpm install
```

### Development

To run the development server:

```bash
pnpm dev
```

This will start the development server at http://localhost:5173 (or another port if 5173 is in use).

### Building for Production

To build the application for production:

```bash
pnpm build
```

The build artifacts will be placed in the `dist` directory.

### Preview Production Build

To preview the production build locally:

```bash
pnpm preview
```

## Project Structure

-   `src/components/` - Contains all React components
-   `src/hooks/` - Custom React hooks
-   `src/types/` - TypeScript type definitions
-   `src/utils/` - Utility functions

## Backend Integration

This application is designed to work with a local storage backend by default. To integrate with a custom backend:

1. Replace the `useEvents` hook in `src/hooks/useEvents.ts` with your own implementation
2. Ensure your implementation provides the same interface: `{ events, isLoading, addEvent, updateEvent, deleteEvent }`

## License

MIT
