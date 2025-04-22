![Screenshot 2025-04-22 122332](https://github.com/user-attachments/assets/e5bb87e2-ac1b-4150-b80b-2280c10ccf04)# NexDark IDE



A lightweight, fast, and open-source Integrated Development Environment (IDE) built with modern web technologies, aiming to provide a streamlined alternative to editors like VS Code.

**Status:** 🚧 Work in Progress 🚧

## Overview

NexDark IDE is built from the ground up using Electron, React, and TypeScript. It leverages the power of the Monaco Editor (the core editor component used in VS Code) and Xterm.js to provide a familiar and powerful coding experience with an integrated terminal.

The goal is to create an efficient and pleasant development environment without the overhead of more feature-heavy IDEs.

## Features ✨

*   **Monaco Editor:** Core VS Code editor experience with syntax highlighting, basic IntelliSense (for configured languages), etc.
*   **Integrated Terminal:** Built-in terminal powered by Xterm.js and node-pty.
*   **File Explorer:** Browse and open files/folders from your project directory.
*   **Tabbed Interface:** Work with multiple files easily.
*   **Command Palette:** Quick access to common commands (Ctrl+Shift+P / Cmd+Shift+P).
*   **Search Across Files:** Find text within your project (Ctrl+Shift+F / Cmd+Shift+F).
*   **Resizable Panels:** Customize your layout using draggable resize handles.
*   **Status Bar:** Shows basic file info, encoding, line endings, zoom controls, and terminal/problem toggles.
*   **(Planned/Basic) Bottom Panel:** Space for Problems, Output, Debug Console (currently placeholders or basic implementations).

## Tech Stack 📚

*   **Framework:** Electron
*   **UI Library:** React
*   **Language:** TypeScript
*   **Build Tool:** Vite
*   **Styling:** Tailwind CSS
*   **Core Editor:** Monaco Editor
*   **Terminal:** Xterm.js & node-pty
*   **UI Components:** react-resizable-panels

## Screenshots 📸

![Screenshot 2025-04-22 122546](https://github.com/user-attachments/assets/e10f7d96-2733-480c-9851-f635d301be6a)
![Screenshot 2025-04-22 123430](https://github.com/user-attachments/assets/b138f938-2807-4c07-b79e-a1121ed05b00)
![Screenshot 2025-04-22 122731](https://github.com/user-attachments/assets/058382d3-f8ca-4b6b-abd1-3a212334d424)
![Screenshot 2025-04-22 122620](https://github.com/user-attachments/assets/5e27ae5c-e76e-4ffe-91a7-89d896d08340)






## Getting Started 🚀

These instructions will get you a copy of the project up and running on your local machine for development purposes.

### Prerequisites

*   Node.js (v18 or later recommended)
*   npm (usually comes with Node.js)
*   Git

### Installation & Running

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/MohammedSafwan10/nexdark_ide.git
    cd nexdark_ide
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Rebuild native modules (important for `node-pty`):**
    You might need Node's build tools installed (python, C++ build tools). If the command fails, follow `node-gyp` installation instructions for your OS.
    ```bash
    npm run rebuild
    ```
    *Note: If you encounter issues, especially on Windows, you might need to install `windows-build-tools` globally: `npm install --global --production windows-build-tools` (run in an Administrator PowerShell/CMD) before running `npm run rebuild`.*

4.  **Run the development server:**
    ```bash
    npm run dev
