const { app, BrowserWindow, ipcMain, Menu, Tray, dialog, Notification } = require('electron');
const ProductivityDB = require('./database');
const path = require('path');

let mainWindow;
let tray = null;
let appPin = '1234'; // Default PIN, will be configurable later

let alarmIntervals = [];
let isAlarmsEnabled = true;

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
    event.preventDefault();
    // We'll implement PIN dialog later
    // For now, just minimize to tray
    mainWindow.hide();
  });

  // Open DevTools in development
  // mainWindow.webContents.openDevTools();
}

function createTray() {
  // We'll add proper icon later, for now use default
  tray = new Tray(path.join(__dirname, 'assets/tray-icon.png'));
  
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
        // We'll implement PIN dialog here later
        app.quit();
      }
    }
  ]);

  tray.setToolTip('Productivity Timer');
  tray.setContextMenu(contextMenu);
  
  // Show window on tray click
  tray.on('click', () => {
    mainWindow.show();
  });
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