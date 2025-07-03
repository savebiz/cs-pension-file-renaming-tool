const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  folderRenameByPEN: (root) => ipcRenderer.invoke('operation:folderRenameByPEN', root),
  fileRenameConvention: (root) => ipcRenderer.invoke('operation:fileRenameConvention', root),
  pdfSeparationByPEN: (root) => ipcRenderer.invoke('operation:pdfSeparationByPEN', root)
}); 