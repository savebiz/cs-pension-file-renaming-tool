# CS Pension File Renaming Tool

A robust, efficient file renaming and management tool with a modern UI. This Electron-based desktop app allows you to preview and perform bulk file/folder renaming and organization according to specific rules for PEN-based pension files.

## Features
- **PEN Prefix Renaming:** Moves the PEN part to the beginning of filenames containing "_PEN".
- **Folder Renaming by PEN:** Renames folders based on unique PEN numbers found in PDF files within each folder.
- **PDF Separation by PEN:** Sorts multiple PDFs into subfolders based on their PEN numbers.
- **Preview Mode:** See what changes will be made before executing.
- **Modern, responsive UI.**

## Installation
1. **Install [Node.js](https://nodejs.org/)** (if not already installed).
2. Download or clone this repository to your computer.
3. Open a terminal/command prompt and navigate to the project directory:
   ```
   cd "C:\Users\victor.sabo\Radix Renaming"
   ```
4. Install dependencies:
   ```
   npm install
   ```

## Running the App (Development Mode)
1. In your project directory, run:
   ```
   npm start
   ```
2. The Electron app will launch. Use the interface to select a root directory and perform file/folder operations.

## Packaging as a Windows Executable
1. In your project directory, run:
   ```
   npm run package
   ```
2. The packaged app will appear in a folder like `CS-Pension-File-Renaming-Tool-win32-x64`. Inside, run `CS-Pension-File-Renaming-Tool.exe`.

## PowerShell Execution Policy Troubleshooting
If you see errors about scripts being disabled, open PowerShell as Administrator and run:
```
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force
```
Then restart your terminal.

## Usage
1. Select a root directory (folder) containing the files you want to manage.
2. Choose an operation (Folder Renaming, File Naming, PDF Separation).
3. Click **Preview Changes** to see what will happen.
4. Click **Execute Operation** to perform the changes.
5. Use **Clear Results** to reset the interface.

## App Icon
You can customize the app icon by replacing the icon file and updating the Electron packaging script. (See the `img/` folder for assets.)

## Customization
You can extend the renaming and management logic in `main.js` to add more rules as needed.

---
**Created by Victor Sabo** 