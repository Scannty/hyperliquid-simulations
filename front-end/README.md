# Trace X Frontend

A React TypeScript frontend application for tracing Ethereum contract calls. This web interface allows users to input contract details and visualize transaction traces with syntax highlighting and detailed execution information.

## Features

- Interactive form for contract call tracing
- Support for multiple blockchain networks (Ethereum, Hyperliquid, etc.)
- Syntax-highlighted trace output with Tokyo Night theme
- Real-time trace execution with loading states
- Responsive design with modern UI components
- Error handling and validation

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Running backend service (trace-call-backend)

## Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd trace-call-frontend
```

2. Install dependencies:

```bash
npm install
```

## Usage

### Development

```bash
npm run dev
```

The development server will start on `http://localhost:5173`

### Build for production

```bash
npm run build
```

### Preview production build

```bash
npm run preview
```

### Linting

```bash
npm run lint
```

## Configuration

Make sure the backend service is running on `http://localhost:3001` or update the API endpoint in the source code.

## Tech Stack

- **React 19** - Frontend framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Axios** - HTTP client for API calls
- **CSS3** - Styling with Tokyo Night theme

## Project Structure

```
src/
├── components/          # React components
│   ├── BlockchainSelect.tsx
│   ├── TraceInput.tsx
│   └── TraceOutput.tsx
├── styles/             # CSS stylesheets
│   └── tokyonight.css
├── App.tsx            # Main application component
└── main.tsx           # Application entry point
```
