const { app, BrowserWindow, ipcMain, Menu, Tray, dialog, Notification, nativeImage } = require('electron');
const ProductivityJSONDB = require('./json-database');
const path = require('path');

// Database initialization function
async function initializeDatabase() {
  try {
    console.log('🗄️ Initializing JSON database...');
    global.db = new ProductivityJSONDB();
    console.log('✅ JSON database initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ JSON database initialization failed:', error);
    throw error;
  }
}

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
  console.log('🚀 Creating window...');
  
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    show: true, // Show immediately for now
    center: true,
    resizable: true,
    minimizable: true,
    maximizable: true
  });

  console.log('✅ Window created');

  // Initialize database with error handling
  // Database should already be initialized by now
  console.log('📊 Database status:', global.db ? 'Ready' : 'Not available');

  // Load the app
  console.log('📄 Loading HTML file...');
  mainWindow.loadFile('index.html').then(() => {
    console.log('✅ HTML loaded successfully');
  }).catch((error) => {
    console.error('❌ HTML load failed:', error);
  });

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    console.log('✅ Window ready to show');
    mainWindow.show();
    mainWindow.focus();
  });

  // Handle close button - ask for PIN
  mainWindow.on('close', (event) => {
    if (isAppClosing) {
      return;
    }
    
    event.preventDefault();
    console.log('🔐 Close requested - showing PIN dialog');
    mainWindow.webContents.send('request-pin-for-close');
  });

  // Add error handling for webContents
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('❌ Page failed to load:', errorCode, errorDescription);
  });

  // Temporary: Open DevTools to see any renderer errors
  mainWindow.webContents.openDevTools();
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
app.whenReady().then(async () => {
  // Always setup IPC handlers first to prevent "no handler" errors
  setupIPCHandlers();
  
  try {
    // Initialize database
    await initializeDatabase();
    console.log('✅ Database initialization successful');
    
    // Create window and tray
    createWindow();
    createTray();
    
    // Setup alarms after everything is ready
    setupHourlyAlarms();
    console.log('⏰ Alarms setup completed');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    console.log('🔄 Continuing with limited functionality...');
    
    // Create window anyway but with limited functionality
    createWindow();
    createTray();
    
    // Try to reinitialize database after a delay
    setTimeout(async () => {
      try {
        console.log('🔄 Attempting database recovery...');
        await initializeDatabase();
        console.log('✅ Database recovery successful');
      } catch (retryError) {
        console.error('❌ Database recovery failed:', retryError);
      }
    }, 2000);
  }

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

// Setup all IPC handlers - called after database is ready
function setupIPCHandlers() {
  console.log('🔌 Setting up IPC handlers...');

  // Helper function to provide fallback data when database is unavailable
  const dbFallback = (handlerName, fallbackValue = null) => {
    return () => {
      if (!global.db) {
        console.warn(`⚠️ Database not available for ${handlerName} - using fallback`);
        return fallbackValue;
      }
      try {
        return global.db[handlerName]();
      } catch (error) {
        console.error(`Error in ${handlerName}:`, error);
        return fallbackValue;
      }
    };
  };
  
  // Basic app handlers
  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  // Database IPC handlers with better error handling
  ipcMain.handle('get-today-data', dbFallback('getTodayData', {
    date: new Date().toISOString().split('T')[0],
    total_minutes: 0,
    notes: ''
  }));

  ipcMain.handle('get-current-week-data', () => {
    try {
      if (!global.db) {
        console.error('❌ Database not available for get-current-week-data');
        return null;
      }
      return global.db.getCurrentWeekData();
    } catch (error) {
      console.error('Error getting week data:', error);
      return null;
    }
  });

  ipcMain.handle('add-time-to-slot', (event, slotName, minutes) => {
    try {
      if (!global.db) {
        console.error('❌ Database not available for add-time-to-slot');
        return null;
      }
      return global.db.addTimeToSlot(slotName, minutes);
    } catch (error) {
      console.error('Error adding time to slot:', error);
      return null;
    }
  });

  ipcMain.handle('update-slot-time', (event, slotName, newMinutes) => {
    try {
      if (!global.db) {
        console.error('❌ Database not available for update-slot-time');
        return null;
      }
      return global.db.updateSlotTime(slotName, newMinutes);
    } catch (error) {
      console.error('Error updating slot time:', error);
      return null;
    }
  });

  ipcMain.handle('update-today-notes', (event, notes) => {
    try {
      if (!global.db) {
        console.error('❌ Database not available for update-today-notes');
        return null;
      }
      return global.db.updateTodayNotes(notes);
    } catch (error) {
      console.error('Error updating notes:', error);
      return null;
    }
  });

  ipcMain.handle('get-setting', (event, settingName) => {
    try {
      if (!global.db) {
        console.error('❌ Database not available for get-setting');
        return settingName === 'app_pin' ? '1234' : null;
      }
      return global.db.getSetting(settingName);
    } catch (error) {
      console.error('Error getting setting:', error);
      return settingName === 'app_pin' ? '1234' : null;
    }
  });

  ipcMain.handle('update-setting', (event, settingName, settingValue) => {
    try {
      if (!global.db) {
        console.error('❌ Database not available for update-setting');
        return null;
      }
      return global.db.updateSetting(settingName, settingValue);
    } catch (error) {
      console.error('Error updating setting:', error);
      return null;
    }
  });

  // Weekly ranking IPC handlers
  ipcMain.handle('update-weekly-data', dbFallback('updateWeeklyData', null));

  ipcMain.handle('get-weekly-ranking-data', (event, limit) => {
    try {
      if (!global.db) {
        console.error('❌ Database not available for get-weekly-ranking-data');
        return [];
      }
      return global.db.getWeeklyRankingData(limit);
    } catch (error) {
      console.error('Error getting weekly ranking data:', error);
      return [];
    }
  });

  ipcMain.handle('get-current-week-rank', () => {
    try {
      if (!global.db) {
        console.error('❌ Database not available for get-current-week-rank');
        return null;
      }
      return global.db.getCurrentWeekRank();
    } catch (error) {
      console.error('Error getting current week rank:', error);
      return null;
    }
  });

  ipcMain.handle('get-week-stats', () => {
    try {
      if (!global.db) {
        console.error('❌ Database not available for get-week-stats');
        return null;
      }
      return global.db.getWeekStats();
    } catch (error) {
      console.error('Error getting week stats:', error);
      return null;
    }
  });

  // Current slot and hourly breakdown IPC handlers
  ipcMain.handle('get-today-hourly-breakdown', dbFallback('getTodayHourlyBreakdown', []));

  ipcMain.handle('get-current-time-slot', () => {
    if (!global.db) {
      const hour = new Date().getHours();
      return hour >= 5 && hour <= 20 ? `${hour}-${hour+1} ${hour < 12 ? 'AM' : 'PM'}` : 'Other Time';
    }
    try {
      const result = global.db.getCurrentTimeSlot();
      return result && result.currentSlot ? result.currentSlot : 'Unknown';
    } catch (error) {
      console.error('Error getting current time slot:', error);
      return 'Unknown';
    }
  });

  // Export/Import IPC handlers
  ipcMain.handle('export-all-data', async () => {
    try {
      if (!global.db) {
        console.error('❌ Database not available for export-all-data');
        return { success: false, error: 'Database not available' };
      }
      
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
        data: {
          daily: data.dailyData.length,
          weekly: data.weeklyData.length
        }
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
      if (!global.db) {
        console.error('❌ Database not available for import-daily-data');
        return { success: false, error: 'Database not available' };
      }
      
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

  // PIN protection IPC handlers
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
      if (!global.db) {
        console.error('❌ Database not available for PIN validation');
        return enteredPIN === '1234'; // Fallback to default PIN
      }
      
      return global.db.validatePIN(enteredPIN);
      
    } catch (error) {
      console.error('PIN validation error:', error);
      return enteredPIN === '1234'; // Default PIN fallback
    }
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

  // History IPC handlers - converted to work with JSON database
  ipcMain.handle('get-daily-data-for-month', async (event, year, month) => {
    try {
      if (!global.db) {
        console.error('❌ Database not available for get-daily-data-for-month');
        return [];
      }
      return global.db.getDailyDataForMonth(year, month + 1); // JSON DB expects 1-based month
    } catch (error) {
      console.error('Error getting daily data for month:', error);
      return [];
    }
  });

  ipcMain.handle('get-day-detail-data', async (event, dateString) => {
    try {
      if (!global.db) {
        console.error('❌ Database not available for get-day-detail-data');
        return null;
      }
      return global.db.getDataForDate(dateString);
    } catch (error) {
      console.error('Error getting day detail data:', error);
      return null;
    }
  });

  ipcMain.handle('get-month-summary', async (event, year, month) => {
    try {
      if (!global.db) {
        console.error('❌ Database not available for get-month-summary');
        return null;
      }
      return global.db.getMonthSummary(year, month + 1); // JSON DB expects 1-based month
    } catch (error) {
      console.error('Error getting month summary:', error);
      return null;
    }
  });

  // Statistics IPC handler
  ipcMain.handle('get-data-statistics', () => {
    try {
      if (!global.db) {
        console.error('❌ Database not available for get-data-statistics');
        return { totalDays: 0, totalMinutes: 0, totalHours: '0H 0M' };
      }
      return global.db.getDataStatistics();
    } catch (error) {
      console.error('Error getting data statistics:', error);
      return { totalDays: 0, totalMinutes: 0, totalHours: '0H 0M' };
    }
  });

  console.log('✅ All IPC handlers registered');
}

// Add cleanup on app quit
app.on('before-quit', () => {
    console.log('🧹 App before-quit - cleaning up...');
    
    // Clear alarms
    clearAllAlarms();
    
    // Close database if still open
    if (global.db && !isAppClosing) {
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
    
    if (global.db) {
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
    
    if (global.db) {
        try {
            global.db.close();
        } catch (error) {
            console.error('Error closing database on SIGTERM:', error);
        }
    }
    
    process.exit(0);
});