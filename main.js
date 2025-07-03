const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 900,
    resizable: true,
    title: 'CS Pension File Renaming Tool',
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  win.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// --- PEN extraction logic ---
const PEN_PATTERNS = [
  /PEN(\d{12})/,
  /_PEN(\d{12})/,
  /^(\d{12})/
];

function extractPenNumber(filename) {
  for (const pattern of PEN_PATTERNS) {
    const match = filename.match(pattern);
    if (match) return `PEN${match[1]}`;
  }
  return null;
}

// --- IPC Handlers ---
ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

ipcMain.handle('operation:folderRenameByPEN', async (event, root, commit = false) => {
  const results = [];
  async function walk(dir) {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const subdir = path.join(dir, entry.name);
        if (subdir === root) continue;
        const subentries = await fsp.readdir(subdir);
        const pdfs = subentries.filter(f => f.toLowerCase().endsWith('.pdf'));
        const penNumbers = new Set();
        for (const pdf of pdfs) {
          const pen = extractPenNumber(pdf);
          if (pen) penNumbers.add(pen);
        }
        const currentFolder = path.basename(subdir);
        if (penNumbers.size === 1) {
          const pen = Array.from(penNumbers)[0];
          if (currentFolder !== pen) {
            const newDir = path.join(path.dirname(subdir), pen);
            results.push({
              type: 'folder-rename',
              original: subdir,
              new: newDir,
              status: 'rename',
              message: `${currentFolder} → ${pen}`
            });
            if (commit) {
              try {
                if (!fs.existsSync(newDir)) {
                  await fsp.rename(subdir, newDir);
                  results[results.length - 1].message = `[RENAMED] ${currentFolder} → ${pen}`;
                } else {
                  results[results.length - 1].status = 'skip';
                  results[results.length - 1].message = `[SKIP] ${currentFolder}: Target folder already exists.`;
                }
              } catch (err) {
                results[results.length - 1].status = 'error';
                results[results.length - 1].message = `[ERROR] ${currentFolder}: ${err.message}`;
              }
            }
          }
        } else if (penNumbers.size > 1) {
          results.push({
            type: 'folder-rename',
            original: subdir,
            new: subdir,
            status: 'skip',
            message: `Skipped: Multiple PEN numbers found (${Array.from(penNumbers).join(', ')})`
          });
        } else {
          results.push({
            type: 'folder-rename',
            original: subdir,
            new: subdir,
            status: 'skip',
            message: `Skipped: No PEN numbers found in PDF files`
          });
        }
        await walk(subdir); // recurse
      }
    }
  }
  await walk(root);
  return results;
});

ipcMain.handle('operation:fileRenameConvention', async (event, root, commit = false) => {
  const results = [];
  async function walk(dir) {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        await walk(path.join(dir, entry.name));
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf') && entry.name.includes('_PEN')) {
        const parts = entry.name.split('_PEN');
        if (parts.length === 2) {
          const penPart = 'PEN' + parts[1].replace('.pdf', '');
          const docType = parts[0];
          const newName = `${penPart}_${docType}.pdf`;
          if (newName !== entry.name) {
            const oldPath = path.join(dir, entry.name);
            const newPath = path.join(dir, newName);
            results.push({
              type: 'file-rename',
              original: oldPath,
              new: newPath,
              status: 'rename',
              message: `${entry.name} → ${newName}`
            });
            if (commit) {
              try {
                if (!fs.existsSync(newPath)) {
                  await fsp.rename(oldPath, newPath);
                  results[results.length - 1].message = `[RENAMED] ${entry.name} → ${newName}`;
                } else {
                  results[results.length - 1].status = 'skip';
                  results[results.length - 1].message = `[SKIP] ${entry.name}: Target file already exists.`;
                }
              } catch (err) {
                results[results.length - 1].status = 'error';
                results[results.length - 1].message = `[ERROR] ${entry.name}: ${err.message}`;
              }
            }
          }
        }
      }
    }
  }
  await walk(root);
  return results;
});

ipcMain.handle('operation:pdfSeparationByPEN', async (event, root, commit = false) => {
  const results = [];
  async function walk(dir) {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        await walk(path.join(dir, entry.name));
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) {
        const pen = extractPenNumber(entry.name);
        if (pen) {
          const src = path.join(dir, entry.name);
          const penFolder = path.join(dir, pen);
          const dst = path.join(penFolder, entry.name);
          if (dir !== penFolder) {
            results.push({
              type: 'pdf-separation',
              original: src,
              new: dst,
              status: 'move',
              message: `Move ${entry.name} to /${pen}/ folder`
            });
            if (commit) {
              try {
                await fsp.mkdir(penFolder, { recursive: true });
                if (!fs.existsSync(dst)) {
                  await fsp.rename(src, dst);
                  results[results.length - 1].message = `[MOVED] ${entry.name} → /${pen}/`;
                } else {
                  results[results.length - 1].status = 'skip';
                  results[results.length - 1].message = `[SKIP] ${entry.name}: Target file already exists in /${pen}/.`;
                }
              } catch (err) {
                results[results.length - 1].status = 'error';
                results[results.length - 1].message = `[ERROR] ${entry.name}: ${err.message}`;
              }
            }
          }
        }
      }
    }
  }
  await walk(root);
  return results;
});