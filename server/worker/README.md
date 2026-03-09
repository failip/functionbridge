# Vite Worker App

## Overview

This project is a simple Vite application that demonstrates the use of a web
worker. It includes a single HTML file that loads a JavaScript object defined
within the same file.

## Project Structure

```
vite-worker-app
├── worker.html       # The main HTML file that loads the JavaScript object
├── package.json      # Configuration file for npm
├── vite.config.js    # Configuration settings for Vite
└── README.md         # Documentation for the project
```

## Setup Instructions

1. **Clone the repository** (if applicable):

   ```
   git clone <repository-url>
   cd vite-worker-app
   ```

2. **Install dependencies**:

   ```
   npm install
   ```

3. **Run the development server**:

   ```
   npm run dev
   ```

4. **Build the project**:
   ```
   npm run build
   ```

## Usage

Open `worker.html` in your browser to see the web worker in action. The
JavaScript object is defined within the same file and can be utilized as needed.

### Using Modules

The example has been updated to demonstrate importing from a separate JavaScript
module. The `worker.html` file now uses a `<script type="module">` block that
imports `FunctionBridgeWorker` from `./src/main.js`. You can add additional
modules under `src/` and import them as needed; Vite will bundle everything
during the build.

## License

This project is licensed under the MIT License.
