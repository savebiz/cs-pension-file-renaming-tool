// Complete Client-Side renderer.js
// All DOM operations and file handling moved to renderer process

// Global variables
let selectedOperation = null;
let selectedFiles = [];
let previewResults = [];
let conflictResolution = 'skip';

// --- PEN extraction logic (client-side) ---
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

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    // Operation selection
    document.querySelectorAll('.operation-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.operation-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            selectedOperation = card.dataset.option;
            updateExecuteButton();
            showNotification(`Selected operation: ${getOperationName(selectedOperation)}`, 'info');
        });
    });

    // Set default conflict resolution
    const defaultConflictBtn = document.querySelector('[data-action="skip"]');
    if (defaultConflictBtn) {
        defaultConflictBtn.click();
    }

    // Handle folder selection
    const folderInput = document.getElementById('folderInput');
    if (folderInput) {
        folderInput.addEventListener('change', handleFolderSelection);
    }

    // Conflict resolution handlers
    document.querySelectorAll('.conflict-btn').forEach(btn => {
        btn.addEventListener('click', handleConflictResolution);
    });

    // Initialize buttons
    updateExecuteButton();
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
    
    showNotification('Application initialized', 'success');
}

function handleFolderSelection(e) {
    try {
        selectedFiles = Array.from(e.target.files);
        updateExecuteButton();
        
        if (selectedFiles.length > 0) {
            const folderPath = selectedFiles[0].webkitRelativePath.split('/')[0];
            const pdfCount = selectedFiles.filter(f => f.name.toLowerCase().endsWith('.pdf')).length;
            const otherCount = selectedFiles.length - pdfCount;
            
            updateFileInfo(folderPath, selectedFiles.length, pdfCount, otherCount);
            showNotification(`Loaded ${selectedFiles.length} files from ${folderPath}`, 'success');
        } else {
            hideFileInfo();
        }
    } catch (error) {
        console.error('Error handling folder selection:', error);
        showNotification('Error loading folder: ' + error.message, 'error');
    }
}

function updateFileInfo(folderPath, totalFiles, pdfCount, otherCount) {
    const fileInfo = document.getElementById('fileInfo');
    if (fileInfo) {
        fileInfo.style.display = 'block';
        fileInfo.innerHTML = `
            <div class="file-info-container">
                <div class="info-row">
                    <strong>📁 Selected Folder:</strong> <span class="folder-name">${folderPath}</span>
                </div>
                <div class="info-row">
                    <strong>📄 Total Files:</strong> <span class="file-count">${totalFiles}</span>
                </div>
                <div class="info-row">
                    <strong>📕 PDF Files:</strong> <span class="pdf-count">${pdfCount}</span>
                </div>
                ${otherCount > 0 ? `<div class="info-row"><strong>📋 Other Files:</strong> <span class="other-count">${otherCount}</span></div>` : ''}
            </div>
        `;
    }
}

function hideFileInfo() {
    const fileInfo = document.getElementById('fileInfo');
    if (fileInfo) {
        fileInfo.style.display = 'none';
    }
}

function handleConflictResolution(e) {
    const btn = e.target;
    document.querySelectorAll('.conflict-btn').forEach(b => {
        b.style.background = 'white';
        b.style.color = '';
        b.classList.remove('active');
    });
    
    btn.style.background = '#ffc107';
    btn.style.color = 'white';
    btn.classList.add('active');
    conflictResolution = btn.dataset.action;
    
    showNotification(`Conflict resolution set to: ${conflictResolution}`, 'info');
}

function handleKeyboardShortcuts(e) {
    if (e.ctrlKey || e.metaKey) {
        switch(e.key) {
            case 'p':
                e.preventDefault();
                if (!isPreviewDisabled()) {
                    previewOperation();
                }
                break;
            case 'e':
                e.preventDefault();
                if (!isExecuteDisabled()) {
                    executeOperation();
                }
                break;
            case 'r':
                e.preventDefault();
                resetApplication();
                break;
            case 'c':
                e.preventDefault();
                clearResults();
                break;
        }
    }
}

function updateExecuteButton() {
    const executeBtn = document.getElementById('executeBtn');
    const previewBtn = document.getElementById('previewBtn');
    
    const canOperate = selectedOperation && selectedFiles.length > 0;
    
    if (executeBtn) {
        executeBtn.disabled = !canOperate || previewResults.length === 0;
    }
    
    if (previewBtn) {
        previewBtn.disabled = !canOperate;
    }
}

function isPreviewDisabled() {
    return !selectedOperation || selectedFiles.length === 0;
}

function isExecuteDisabled() {
    return !selectedOperation || selectedFiles.length === 0 || previewResults.length === 0;
}

function getOperationName(operation) {
    const names = {
        'folder-rename': 'Folder Renaming by PEN',
        'file-rename': 'File Renaming Convention',
        'pdf-separation': 'PDF Separation by PEN'
    };
    return names[operation] || operation;
}

function getFolderOperationResults() {
    const results = [];
    const folderMap = new Map();
    
    // Group files by folder
    selectedFiles.forEach(file => {
        const pathParts = file.webkitRelativePath.split('/');
        if (pathParts.length > 1) {
            const folderPath = pathParts.slice(0, -1).join('/');
            if (!folderMap.has(folderPath)) {
                folderMap.set(folderPath, []);
            }
            folderMap.get(folderPath).push(file);
        }
    });
    
    // Analyze each folder
    folderMap.forEach((files, folderPath) => {
        const pdfFiles = files.filter(f => f.name.toLowerCase().endsWith('.pdf'));
        const penNumbers = new Set();
        
        pdfFiles.forEach(file => {
            const pen = extractPenNumber(file.name);
            if (pen) penNumbers.add(pen);
        });
        
        const pathParts = folderPath.split('/');
        const currentFolderName = pathParts[pathParts.length - 1];
        
        if (penNumbers.size === 1) {
            const penNumber = Array.from(penNumbers)[0];
            if (currentFolderName !== penNumber) {
                const newFolderPath = pathParts.slice(0, -1).concat([penNumber]).join('/');
                results.push({
                    type: 'folder-rename',
                    original: folderPath,
                    new: newFolderPath,
                    status: 'rename',
                    message: `📁 ${currentFolderName} → ${penNumber}`,
                    folderName: currentFolderName,
                    penNumber: penNumber
                });
            } else {
                results.push({
                    type: 'folder-rename',
                    original: folderPath,
                    new: folderPath,
                    status: 'skip',
                    message: `✅ Already correctly named: ${currentFolderName}`
                });
            }
        } else if (penNumbers.size > 1) {
            results.push({
                type: 'folder-rename',
                original: folderPath,
                new: folderPath,
                status: 'conflict',
                message: `⚠️ Multiple PEN numbers found: ${Array.from(penNumbers).join(', ')}`,
                penNumbers: Array.from(penNumbers)
            });
        } else {
            results.push({
                type: 'folder-rename',
                original: folderPath,
                new: folderPath,
                status: 'skip',
                message: `⏭️ No PEN numbers found in PDF files`
            });
        }
    });
    
    return results;
}

function getFileOperationResults() {
    const results = [];
    
    selectedFiles.forEach(file => {
        if (file.name.toLowerCase().endsWith('.pdf')) {
            const pen = extractPenNumber(file.name);
            
            if (pen && file.name.includes('_PEN')) {
                const parts = file.name.split('_PEN');
                if (parts.length === 2) {
                    const penPart = pen; // Already formatted as PEN123456789012
                    const docType = parts[0];
                    const newName = `${penPart}_${docType}.pdf`;
                    
                    if (newName !== file.name) {
                        results.push({
                            type: 'file-rename',
                            original: file.name,
                            new: newName,
                            status: 'rename',
                            message: `📄 ${file.name} → ${newName}`,
                            path: file.webkitRelativePath,
                            penNumber: pen,
                            docType: docType
                        });
                    } else {
                        results.push({
                            type: 'file-rename',
                            original: file.name,
                            new: file.name,
                            status: 'skip',
                            message: `✅ Already correctly named: ${file.name}`
                        });
                    }
                }
            } else if (pen) {
                results.push({
                    type: 'file-rename',
                    original: file.name,
                    new: file.name,
                    status: 'skip',
                    message: `⏭️ No naming convention match: ${file.name}`
                });
            }
        }
    });
    
    return results;
}

function getSeparationResults() {
    const results = [];
    const folderMap = new Map();
    
    // Group files by folder
    selectedFiles.forEach(file => {
        const pathParts = file.webkitRelativePath.split('/');
        if (pathParts.length > 1) {
            const folderPath = pathParts.slice(0, -1).join('/');
            if (!folderMap.has(folderPath)) {
                folderMap.set(folderPath, []);
            }
            folderMap.get(folderPath).push(file);
        }
    });
    
    // Analyze each folder for separation opportunities
    folderMap.forEach((files, folderPath) => {
        const pdfFiles = files.filter(f => f.name.toLowerCase().endsWith('.pdf'));
        const penGroups = new Map();
        
        pdfFiles.forEach(file => {
            const pen = extractPenNumber(file.name);
            if (pen) {
                if (!penGroups.has(pen)) {
                    penGroups.set(pen, []);
                }
                penGroups.get(pen).push(file);
            }
        });
        
        if (penGroups.size > 1) {
            penGroups.forEach((files, penNumber) => {
                files.forEach(file => {
                    const newPath = `${folderPath}/${penNumber}/${file.name}`;
                    results.push({
                        type: 'pdf-separation',
                        original: file.webkitRelativePath,
                        new: newPath,
                        status: 'move',
                        message: `📁 Move ${file.name} → /${penNumber}/`,
                        penNumber: penNumber,
                        fileName: file.name
                    });
                });
            });
        } else if (penGroups.size === 1) {
            const penNumber = Array.from(penGroups.keys())[0];
            results.push({
                type: 'pdf-separation',
                original: folderPath,
                new: folderPath,
                status: 'skip',
                message: `⏭️ Only one PEN number (${penNumber}) found in folder`
            });
        } else {
            results.push({
                type: 'pdf-separation',
                original: folderPath,
                new: folderPath,
                status: 'skip',
                message: `⏭️ No PEN numbers found in PDF files`
            });
        }
    });
    
    return results;
}

function previewOperation() {
    if (!selectedOperation || selectedFiles.length === 0) {
        showNotification('Please select a folder and operation first.', 'warning');
        return;
    }
    
    try {
        showProgress('Analyzing files...');
        
        let results = [];
        
        switch(selectedOperation) {
            case 'folder-rename':
                results = getFolderOperationResults();
                break;
            case 'file-rename':
                results = getFileOperationResults();
                break;
            case 'pdf-separation':
                results = getSeparationResults();
                break;
            default:
                throw new Error(`Unknown operation: ${selectedOperation}`);
        }
        
        previewResults = results;
        
        // Check for conflicts
        const conflicts = results.filter(r => r.status === 'conflict');
        const conflictResolver = document.getElementById('conflictResolver');
        
        if (conflicts.length > 0 && conflictResolver) {
            conflictResolver.style.display = 'block';
            showNotification(`Found ${conflicts.length} conflicts. Please review.`, 'warning');
        } else if (conflictResolver) {
            conflictResolver.style.display = 'none';
        }
        
        hideProgress();
        displayResults(results, true);
        updateExecuteButton();
        
        const actionCount = results.filter(r => r.status !== 'skip').length;
        showNotification(`Preview complete: ${actionCount} operations found`, 'success');
        
    } catch (error) {
        console.error('Preview operation failed:', error);
        hideProgress();
        showNotification('Preview failed: ' + error.message, 'error');
    }
}

function executeOperation() {
    if (previewResults.length === 0) {
        showNotification('Please preview the changes first.', 'warning');
        return;
    }
    
    const actionItems = previewResults.filter(r => r.status !== 'skip');
    if (actionItems.length === 0) {
        showNotification('No operations to execute.', 'info');
        return;
    }
    
    if (!confirm(`Are you sure you want to execute ${actionItems.length} operations? This is a simulation and won't actually modify files.`)) {
        return;
    }
    
    try {
        showProgress('Executing operations...');
        
        let processed = 0;
        const total = actionItems.length;
        const results = [];
        
        previewResults.forEach((item, index) => {
            setTimeout(() => {
                if (item.status !== 'skip') {
                    // Simulate the operation
                    results.push({
                        ...item,
                        success: true,
                        message: `✅ ${item.message.replace(/^[📁📄⚠️]/, 'Completed:')}`
                    });
                    processed++;
                    updateProgress((processed / total) * 100);
                } else {
                    results.push({
                        ...item,
                        success: null,
                        message: `⏭️ ${item.message}`
                    });
                }
                
                if (index === previewResults.length - 1) {
                    hideProgress();
                    displayResults(results, false);
                    showNotification(`Execution complete: ${processed} operations processed`, 'success');
                    
                    // Clear preview results after execution
                    previewResults = [];
                    updateExecuteButton();
                }
            }, index * 50);
        });
        
    } catch (error) {
        console.error('Execute operation failed:', error);
        hideProgress();
        showNotification('Execution failed: ' + error.message, 'error');
    }
}

function showProgress(message = 'Processing...') {
    const progressDiv = document.getElementById('progressDiv');
    const resultsDiv = document.getElementById('resultsDiv');
    
    if (progressDiv) {
        progressDiv.style.display = 'block';
        const progressText = document.getElementById('progressText');
        if (progressText) {
            progressText.textContent = message;
        }
    }
    
    if (resultsDiv) {
        resultsDiv.style.display = 'none';
    }
}

function hideProgress() {
    const progressDiv = document.getElementById('progressDiv');
    if (progressDiv) {
        progressDiv.style.display = 'none';
    }
}

function updateProgress(percentage) {
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    if (progressFill) {
        progressFill.style.width = percentage + '%';
    }
    
    if (progressText) {
        progressText.textContent = `Processing... ${Math.round(percentage)}%`;
    }
}

function displayResults(results, isPreview) {
    const resultsDiv = document.getElementById('resultsDiv');
    if (!resultsDiv) return;
    
    resultsDiv.style.display = 'block';
    
    const title = isPreview ? '👁️ Preview Results' : '✅ Execution Results';
    const operationNames = {
        'folder-rename': 'Folder Renaming',
        'file-rename': 'File Renaming',
        'pdf-separation': 'PDF Separation'
    };
    
    const opName = operationNames[selectedOperation] || 'Operation';
    const actionCount = results.filter(r => r.status !== 'skip').length;
    const skipCount = results.filter(r => r.status === 'skip').length;
    const conflictCount = results.filter(r => r.status === 'conflict').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    
    let html = `
        <div class="results-header">
            <h3>${title} - ${opName}</h3>
            <div class="results-summary">
                <span class="summary-item success">✅ ${actionCount} operations</span>
                <span class="summary-item skip">⏭️ ${skipCount} skipped</span>
                ${conflictCount > 0 ? `<span class="summary-item conflict">⚠️ ${conflictCount} conflicts</span>` : ''}
                ${errorCount > 0 ? `<span class="summary-item error">❌ ${errorCount} errors</span>` : ''}
            </div>
        </div>
        <div class="results-content">
    `;
    
    if (results.length === 0) {
        html += '<div class="result-item skip">No files found matching the selected operation criteria.</div>';
    } else {
        results.forEach((item, index) => {
            let className = 'result-item';
            switch(item.status) {
                case 'skip':
                    className += ' skip';
                    break;
                case 'error':
                    className += ' error';
                    break;
                case 'conflict':
                    className += ' warning';
                    break;
                default:
                    className += ' success';
            }
            
            html += `<div class="${className}" data-index="${index}">${item.message}</div>`;
        });
    }
    
    html += '</div>';
    resultsDiv.innerHTML = html;
}

function clearResults() {
    const resultsDiv = document.getElementById('resultsDiv');
    const conflictResolver = document.getElementById('conflictResolver');
    
    if (resultsDiv) {
        resultsDiv.style.display = 'none';
        resultsDiv.innerHTML = '';
    }
    
    if (conflictResolver) {
        conflictResolver.style.display = 'none';
    }
    
    previewResults = [];
    updateExecuteButton();
    showNotification('Results cleared', 'info');
}

function resetApplication() {
    // Reset all global variables
    selectedOperation = null;
    selectedFiles = [];
    previewResults = [];
    conflictResolution = 'skip';
    
    // Clear UI selections
    document.querySelectorAll('.operation-card').forEach(c => c.classList.remove('selected'));
    document.querySelectorAll('.conflict-btn').forEach(b => {
        b.style.background = 'white';
        b.style.color = '';
        b.classList.remove('active');
    });
    
    // Reset folder input
    const folderInput = document.getElementById('folderInput');
    if (folderInput) {
        folderInput.value = '';
    }
    
    // Hide info panels
    hideFileInfo();
    
    // Clear results
    clearResults();
    
    // Reset conflict resolution to default
    const defaultConflictBtn = document.querySelector('[data-action="skip"]');
    if (defaultConflictBtn) {
        defaultConflictBtn.click();
    }
    
    // Update buttons
    updateExecuteButton();
    
    showNotification('Application reset successfully', 'success');
}

// Notification system
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <span class="notification-message">${message}</span>
        <button class="notification-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
}

// Expose functions to global scope for button onclick
window.previewOperation = previewOperation;
window.executeOperation = executeOperation;
window.clearResults = clearResults;
window.resetApplication = resetApplication;

// Export for potential module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        previewOperation,
        executeOperation,
        clearResults,
        resetApplication,
        extractPenNumber
    };
}