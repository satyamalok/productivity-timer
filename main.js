const { app, BrowserWindow, ipcMain, Menu, Tray, dialog, Notification, nativeImage } = require('electron');
const ProductivityDB = require('./database');
const path = require('path');

let mainWindow;
let tray = null;
let appPin = '1234'; // Default PIN, will be configurable later

let alarmIntervals = [];
let isAlarmsEnabled = true;
let isAppClosing = false; // Add flag to prevent multiple close attempts

function setupHourlyAlarms() {
  // Clear any existing alarms
  clearAllAlarms();
  
  // Get alarm times from database (default times if not set)
  const alarmTimes = [
    '03:59', '04:59', '05:59', '06:59', '07:59', '08:59', 
    '09:59', '10:59', '11:59', '12:59', '13:59', '14:59', 
    '15:59', '16:59', '17:59', '18:59', '19:59', '20:59', 
    '21:59', '22:59'
  ];
  
  alarmTimes.forEach(time => {
    scheduleAlarm(time);
  });
  
  console.log('Hourly alarms scheduled for:', alarmTimes);
}

function scheduleAlarm(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  
  function setAlarmForToday() {
    const now = new Date();
    const alarmTime = new Date();
    alarmTime.setHours(hours, minutes, 0, 0);
    
    // If alarm time has passed today, schedule for tomorrow
    if (alarmTime <= now) {
      alarmTime.setDate(alarmTime.getDate() + 1);
    }
    
    const timeUntilAlarm = alarmTime.getTime() - now.getTime();
    
    const timeoutId = setTimeout(() => {
      triggerAlarm(timeString);
      // Schedule next alarm for tomorrow
      setAlarmForToday();
    }, timeUntilAlarm);
    
    alarmIntervals.push(timeoutId);
    
    console.log(`Alarm scheduled for ${timeString} in ${Math.round(timeUntilAlarm / 1000 / 60)} minutes`);
  }
  
  setAlarmForToday();
}

function triggerAlarm(timeString) {
  if (!isAlarmsEnabled) return;
  
  console.log(`🔔 Alarm triggered at ${timeString}`);
  
  // Show notification
  if (Notification.isSupported()) {
    new Notification({
      title: 'Productivity Timer',
      body: `Hourly check-in time! (${timeString})`,
      icon: path.join(__dirname, 'assets/icon.png'),
      silent: false
    }).show();
  }
  
  // Send to renderer process to show dialog
  if (mainWindow) {
    mainWindow.webContents.send('show-alarm-dialog', timeString);
    
    // Bring window to front
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
  }
}

function clearAllAlarms() {
  alarmIntervals.forEach(intervalId => {
    clearTimeout(intervalId);
  });
  alarmIntervals = [];
}

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    icon: path.join(__dirname, 'assets/icon.png'), // We'll add icon later
    show: false // Don't show initially
  });

  // Initialize database
  global.db = new ProductivityDB();

  // Setup hourly alarms
  setupHourlyAlarms();

  // Load the app
  mainWindow.loadFile('index.html');

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Handle close button - ask for PIN
  mainWindow.on('close', (event) => {
    if (isAppClosing) {
      // Allow actual close if we're in closing process
      return;
    }
    
    event.preventDefault();
    console.log('🔐 Close requested - showing PIN dialog');
    // Send request to renderer for PIN
    mainWindow.webContents.send('request-pin-for-close');
  });

  // Open DevTools in development
  // mainWindow.webContents.openDevTools();
}

function createTray() {
    try {
        // Try to create tray with icon, fall back to default if missing
        let trayIconPath;
        try {
            trayIconPath = path.join(__dirname, 'assets/tray-icon.png');
            // Test if file exists
            require('fs').accessSync(trayIconPath);
        } catch {
            // Use default system icon if custom icon missing
            trayIconPath = null;
        }
        
        tray = trayIconPath ? new Tray(trayIconPath) : new Tray(nativeImage.createEmpty());
        
        const contextMenu = Menu.buildFromTemplate([
            {
                label: 'Show App',
                click: () => {
                    mainWindow.show();
                }
            },
            {
                label: 'Quit',
                click: () => {
                    // Send PIN request
                    mainWindow.webContents.send('request-pin-for-close');
                }
            }
        ]);

        tray.setToolTip('Productivity Timer');
        tray.setContextMenu(contextMenu);
        
        // Show window on tray click
        tray.on('click', () => {
            mainWindow.show();
        });
        
        console.log('✅ Tray created successfully');
    } catch (error) {
        console.log('⚠️ Tray creation failed, continuing without tray:', error.message);
        // App can continue without tray
    }
}

// App event handlers
app.whenReady().then(() => {
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Keep app running in background on Windows/Linux
  if (process.platform !== 'darwin') {
    // Don't quit, keep in tray
  }
});

// IPC handlers (we'll add more later)
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// Database IPC handlers
ipcMain.handle('get-today-data', () => {
  return global.db.getTodayData();
});

ipcMain.handle('get-current-week-data', () => {
  return global.db.getCurrentWeekData();
});

ipcMain.handle('add-time-to-slot', (event, slotName, minutes) => {
  return global.db.addTimeToSlot(slotName, minutes);
});

ipcMain.handle('update-today-notes', (event, notes) => {
  return global.db.updateTodayNotes(notes);
});

ipcMain.handle('get-setting', (event, settingName) => {
  return global.db.getSetting(settingName);
});

// Alarm IPC handlers
ipcMain.handle('toggle-alarms', (event, enabled) => {
  isAlarmsEnabled = enabled;
  console.log(`Alarms ${enabled ? 'enabled' : 'disabled'}`);
  return isAlarmsEnabled;
});

ipcMain.handle('get-alarm-status', () => {
  return isAlarmsEnabled;
});

ipcMain.handle('alarm-acknowledged', (event, timeString) => {
  console.log(`Alarm acknowledged for ${timeString}`);
  // You can add additional logic here if needed
});

// Weekly ranking IPC handlers
ipcMain.handle('update-weekly-data', () => {
  return global.db.updateWeeklyData();
});

ipcMain.handle('get-weekly-ranking-data', (event, limit) => {
  return global.db.getWeeklyRankingData(limit);
});

ipcMain.handle('get-current-week-rank', () => {
  return global.db.getCurrentWeekRank();
});

ipcMain.handle('get-week-stats', () => {
  return global.db.getWeekStats();
});

// Current slot and hourly breakdown IPC handlers
ipcMain.handle('get-today-hourly-breakdown', () => {
  return global.db.getTodayHourlyBreakdown();
});

ipcMain.handle('get-current-time-slot', () => {
  return global.db.getCurrentTimeSlot();
});

// Export/Import IPC handlers
ipcMain.handle('export-all-data', async () => {
  try {
    const data = global.db.exportAllDataToCSV();
    
    // Create CSV files
    const dailyCSV = global.db.dailyDataToCSV(data.dailyData);
    const weeklyCSV = global.db.weeklyDataToCSV(data.weeklyData);
    
    // Save files
    const timestamp = new Date().toISOString().split('T')[0];
    const dailyPath = global.db.saveCSVToFile(dailyCSV, `daily-data-${timestamp}.csv`);
    const weeklyPath = global.db.saveCSVToFile(weeklyCSV, `weekly-data-${timestamp}.csv`);
    
    return {
      success: true,
      files: {
        daily: dailyPath,
        weekly: weeklyPath
      },
      data: data.totalRecords
    };
  } catch (error) {
    console.error('Export error:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('import-daily-data', async (event, filePath) => {
  try {
    const csvData = global.db.readCSVFromFile(filePath);
    const result = global.db.importDailyDataFromCSV(csvData);
    
    return {
      success: true,
      ...result
    };
  } catch (error) {
    console.error('Import error:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('show-file-dialog', async (event, options) => {
  const { dialog } = require('electron');
  const result = await dialog.showOpenDialog(mainWindow, options);
  return result;
});

ipcMain.handle('show-save-dialog', async (event, options) => {
  const { dialog } = require('electron');
  const result = await dialog.showSaveDialog(mainWindow, options);
  return result;
});

// PIN protection IPC handlers - FIXED VERSION
ipcMain.handle('close-app-confirmed', async () => {
    console.log('✅ PIN validated - closing app');
    
    // Set closing flag to prevent further close events
    isAppClosing = true;
    
    try {
        // Clear any pending alarms
        clearAllAlarms();
        
        // Close database connection
        if (global.db) {
            global.db.close();
            global.db = null; // Clear the reference
        }
        
        // Give a small delay to ensure cleanup
        setTimeout(() => {
            app.quit();
        }, 100);
        
    } catch (error) {
        console.error('Error during app closure:', error);
        // Force quit even if there's an error
        app.quit();
    }
});

ipcMain.handle('validate-pin', async (event, enteredPIN) => {
    try {
        // Check if database is still available
        if (!global.db || !global.db.db) {
            console.error('❌ Database not available for PIN validation');
            return false;
        }
        
        const storedPIN = global.db.getSetting('app_pin');
        console.log(`🔐 Validating PIN: entered=${enteredPIN}, stored=${storedPIN}`);
        
        return enteredPIN === storedPIN;
        
    } catch (error) {
        console.error('PIN validation error:', error);
        
        // If database error, fall back to default PIN
        if (error.message && error.message.includes('database connection is not open')) {
            console.log('🔄 Database closed, using fallback PIN validation');
            return enteredPIN === '1234'; // Default PIN fallback
        }
        
        return false;
    }
});

// Add cleanup on app quit
app.on('before-quit', () => {
    console.log('🧹 App before-quit - cleaning up...');
    
    // Clear alarms
    clearAllAlarms();
    
    // Close database if still open
    if (global.db && global.db.db && !isAppClosing) {
        try {
            global.db.close();
        } catch (error) {
            console.error('Error closing database on quit:', error);
        }
    }
});

// Handle process termination
process.on('SIGINT', () => {
    console.log('🛑 SIGINT received - cleaning up...');
    
    clearAllAlarms();
    
    if (global.db && global.db.db) {
        try {
            global.db.close();
        } catch (error) {
            console.error('Error closing database on SIGINT:', error);
        }
    }
    
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received - cleaning up...');
    
    clearAllAlarms();
    
    if (global.db && global.db.db) {
        try {
            global.db.close();
        } catch (error) {
            console.error('Error closing database on SIGTERM:', error);
        }
    }
    
    process.exit(0);
});