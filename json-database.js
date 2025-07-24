const fs = require('fs');
const path = require('path');

class ProductivityJSONDB {
    constructor() {
        try {
            console.log('🗄️ Initializing JSON database...');
            
            // Set up data directory
            this.setupDataDirectory();
            
            // Initialize data structure
            this.data = {
                metadata: {
                    version: "2.0",
                    created: new Date().toISOString(),
                    lastModified: new Date().toISOString()
                },
                dailyData: {},
                weeklyData: [],
                settings: {
                    alarmTimes: [
                        '03:59', '04:59', '05:59', '06:59', '07:59', '08:59',
                        '09:59', '10:59', '11:59', '12:59', '13:59', '14:59',
                        '15:59', '16:59', '17:59', '18:59', '19:59', '20:59',
                        '21:59', '22:59'
                    ],
                    appPin: "1234",
                    backupEnabled: true
                }
            };
            
            // Load existing data
            this.loadData();
            
            console.log('✅ JSON database initialized successfully');
        } catch (error) {
            console.error('❌ JSON database initialization failed:', error);
            throw error;
        }
    }

    setupDataDirectory() {
        try {
            const { app } = require('electron');
            
            if (app && app.getPath) {
                this.userDataPath = app.getPath('userData');
            } else {
                // Development fallback
                this.userDataPath = __dirname;
            }
            
            this.dataFilePath = path.join(this.userDataPath, 'productivity-data.json');
            this.backupDir = path.join(this.userDataPath, 'backups');
            
            // Create backup directory if it doesn't exist
            if (!fs.existsSync(this.backupDir)) {
                fs.mkdirSync(this.backupDir, { recursive: true });
            }
            
            console.log('📍 Data file path:', this.dataFilePath);
        } catch (error) {
            console.error('❌ Failed to setup data directory:', error);
            throw error;
        }
    }

    loadData() {
        try {
            if (fs.existsSync(this.dataFilePath)) {
                const fileContent = fs.readFileSync(this.dataFilePath, 'utf8');
                const loadedData = JSON.parse(fileContent);
                
                // Merge with default structure to handle version updates
                this.data = { ...this.data, ...loadedData };
                console.log('✅ Existing data loaded successfully');
            } else {
                console.log('📝 No existing data file, starting fresh');
                this.saveData(); // Create initial file
            }
        } catch (error) {
            console.error('❌ Failed to load data:', error);
            console.log('🔄 Creating backup and starting fresh');
            this.createBackup();
            this.saveData();
        }
    }

    saveData() {
        try {
            this.data.metadata.lastModified = new Date().toISOString();
            const jsonData = JSON.stringify(this.data, null, 2);
            fs.writeFileSync(this.dataFilePath, jsonData, 'utf8');
            console.log('💾 Data saved successfully');
        } catch (error) {
            console.error('❌ Failed to save data:', error);
            throw error;
        }
    }

    createBackup() {
        try {
            if (fs.existsSync(this.dataFilePath)) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const backupPath = path.join(this.backupDir, `backup-${timestamp}.json`);
                fs.copyFileSync(this.dataFilePath, backupPath);
                console.log('📋 Backup created:', backupPath);
            }
        } catch (error) {
            console.error('⚠️ Failed to create backup:', error);
        }
    }

    // Get today's date in YYYY-MM-DD format
    getTodayDateString() {
        return new Date().toISOString().split('T')[0];
    }

    // Get day name from date string
    getDayName(dateString) {
        const date = new Date(dateString + 'T00:00:00');
        return date.toLocaleDateString('en-US', { weekday: 'long' });
    }

    // Initialize today's data if it doesn't exist
    initializeTodayData() {
        const today = this.getTodayDateString();
        
        if (!this.data.dailyData[today]) {
            this.data.dailyData[today] = {
                dayName: this.getDayName(today),
                slots: {
                    '5-6am': 0, '6-7am': 0, '7-8am': 0, '8-9am': 0,
                    '9-10am': 0, '10-11am': 0, '11-12pm': 0, '12-1pm': 0,
                    '1-2pm': 0, '2-3pm': 0, '3-4pm': 0, '4-5pm': 0,
                    '5-6pm': 0, '6-7pm': 0, '7-8pm': 0, '8-9pm': 0,
                    'other': 0
                },
                totalMinutes: 0,
                notes: ""
            };
            this.saveData();
        }
        
        return this.data.dailyData[today];
    }

    // Get today's data
    getTodayData() {
        return this.initializeTodayData();
    }

    // Update time slot
    updateTimeSlot(slotName, minutes) {
        const today = this.getTodayDateString();
        this.initializeTodayData();
        
        this.data.dailyData[today].slots[slotName] = minutes;
        
        // Recalculate total
        this.data.dailyData[today].totalMinutes = Object.values(this.data.dailyData[today].slots)
            .reduce((sum, val) => sum + val, 0);
        
        this.saveData();
        this.updateWeeklyData();
        
        return this.data.dailyData[today];
    }

    // Get current time slot based on current time
    getCurrentTimeSlot() {
        const now = new Date();
        const hour = now.getHours();
        
        const slotMap = {
            5: '5-6am', 6: '6-7am', 7: '7-8am', 8: '8-9am',
            9: '9-10am', 10: '10-11am', 11: '11-12pm', 12: '12-1pm',
            13: '1-2pm', 14: '2-3pm', 15: '3-4pm', 16: '4-5pm',
            17: '5-6pm', 18: '6-7pm', 19: '7-8pm', 20: '8-9pm'
        };
        
        return {
            currentSlot: slotMap[hour] || 'other',
            hour: hour,
            displayTime: now.toLocaleTimeString()
        };
    }

    // Get today's hourly breakdown
    getTodayHourlyBreakdown() {
        const todayData = this.getTodayData();
        const breakdown = [];
        
        const slotLabels = {
            '5-6am': '5-6 AM', '6-7am': '6-7 AM', '7-8am': '7-8 AM', '8-9am': '8-9 AM',
            '9-10am': '9-10 AM', '10-11am': '10-11 AM', '11-12pm': '11-12 AM', '12-1pm': '12-1 PM',
            '1-2pm': '1-2 PM', '2-3pm': '2-3 PM', '3-4pm': '3-4 PM', '4-5pm': '4-5 PM',
            '5-6pm': '5-6 PM', '6-7pm': '6-7 PM', '7-8pm': '7-8 PM', '8-9pm': '8-9 PM',
            'other': 'Other'
        };
        
        Object.entries(todayData.slots).forEach(([slot, minutes]) => {
            if (minutes > 0) {
                breakdown.push({
                    slot: slotLabels[slot] || slot,
                    minutes: minutes,
                    hours: this.formatMinutesToHours(minutes)
                });
            }
        });
        
        return breakdown;
    }

    // Format minutes to hours
    formatMinutesToHours(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    }

    // Update weekly data
    updateWeeklyData() {
        // Get current week data
        const currentWeek = this.getCurrentWeekNumber();
        const currentYear = new Date().getFullYear();
        
        // Calculate week totals
        const weekDates = this.getWeekDates(currentYear, currentWeek);
        let weekTotal = 0;
        let daysWithData = 0;
        
        weekDates.forEach(dateStr => {
            if (this.data.dailyData[dateStr]) {
                weekTotal += this.data.dailyData[dateStr].totalMinutes;
                if (this.data.dailyData[dateStr].totalMinutes > 0) {
                    daysWithData++;
                }
            }
        });
        
        // Update or create week entry
        const weekIndex = this.data.weeklyData.findIndex(w => 
            w.weekNumber === currentWeek && w.year === currentYear
        );
        
        const weekData = {
            weekNumber: currentWeek,
            year: currentYear,
            dateRange: this.getWeekDateRange(weekDates),
            totalMinutes: weekTotal,
            totalHours: this.formatMinutesToHours(weekTotal),
            daysWithData: daysWithData,
            rank: 0 // Will be calculated in ranking update
        };
        
        if (weekIndex >= 0) {
            this.data.weeklyData[weekIndex] = weekData;
        } else {
            this.data.weeklyData.push(weekData);
        }
        
        // Update rankings
        this.updateWeeklyRankings();
        this.saveData();
    }

    // Get current week number
    getCurrentWeekNumber() {
        const date = new Date();
        const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
        const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
        return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    }

    // Get dates for a specific week
    getWeekDates(year, weekNumber) {
        const firstDayOfYear = new Date(year, 0, 1);
        const daysOffset = (weekNumber - 1) * 7;
        const weekStart = new Date(firstDayOfYear.getTime() + daysOffset * 86400000);
        
        const dates = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(weekStart);
            date.setDate(weekStart.getDate() + i);
            dates.push(date.toISOString().split('T')[0]);
        }
        return dates;
    }

    // Get week date range string
    getWeekDateRange(weekDates) {
        const startDate = new Date(weekDates[0]);
        const endDate = new Date(weekDates[6]);
        
        const startStr = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const endStr = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        return `${startStr} - ${endStr}`;
    }

    // Update weekly rankings
    updateWeeklyRankings() {
        // Sort weeks by total minutes (descending)
        this.data.weeklyData.sort((a, b) => b.totalMinutes - a.totalMinutes);
        
        // Assign ranks
        this.data.weeklyData.forEach((week, index) => {
            week.rank = index + 1;
        });
    }

    // Get current week data
    getCurrentWeekData() {
        const currentWeek = this.getCurrentWeekNumber();
        const currentYear = new Date().getFullYear();
        
        return this.data.weeklyData.find(w => 
            w.weekNumber === currentWeek && w.year === currentYear
        ) || null;
    }

    // Get weekly ranking data
    getWeeklyRankingData(limit = 10) {
        return this.data.weeklyData
            .sort((a, b) => b.totalMinutes - a.totalMinutes)
            .slice(0, limit);
    }

    // Export data to CSV format
    exportAllDataToCSV() {
        return {
            dailyData: Object.entries(this.data.dailyData).map(([date, data]) => ({
                date: date,
                day_name: data.dayName,
                slot_5_6_am: data.slots['5-6am'],
                slot_6_7_am: data.slots['6-7am'],
                slot_7_8_am: data.slots['7-8am'],
                slot_8_9_am: data.slots['8-9am'],
                slot_9_10_am: data.slots['9-10am'],
                slot_10_11_am: data.slots['10-11am'],
                slot_11_12_am: data.slots['11-12pm'],
                slot_12_1_pm: data.slots['12-1pm'],
                slot_1_2_pm: data.slots['1-2pm'],
                slot_2_3_pm: data.slots['2-3pm'],
                slot_3_4_pm: data.slots['3-4pm'],
                slot_4_5_pm: data.slots['4-5pm'],
                slot_5_6_pm: data.slots['5-6pm'],
                slot_6_7_pm: data.slots['6-7pm'],
                slot_7_8_pm: data.slots['7-8pm'],
                slot_8_9_pm: data.slots['8-9pm'],
                other_time: data.slots['other'],
                total_minutes: data.totalMinutes,
                notes: data.notes || ''
            })),
            weeklyData: this.data.weeklyData
        };
    }

    // Convert daily data to CSV string
    dailyDataToCSV(dailyData) {
        if (!dailyData || dailyData.length === 0) {
            return 'No daily data to export';
        }
        
        const headers = [
            'Date', 'Day', '5-6 AM', '6-7 AM', '7-8 AM', '8-9 AM',
            '9-10 AM', '10-11 AM', '11-12 PM', '12-1 PM', '1-2 PM', '2-3 PM',
            '3-4 PM', '4-5 PM', '5-6 PM', '6-7 PM', '7-8 PM', '8-9 PM',
            'Other', 'Total Min', 'Total Hours', 'Notes'
        ];
        
        let csv = headers.join(',') + '\n';
        
        dailyData.forEach(row => {
            const totalHours = this.formatMinutesToHours(row.total_minutes);
            const csvRow = [
                row.date,
                row.day_name,
                row.slot_5_6_am || 0,
                row.slot_6_7_am || 0,
                row.slot_7_8_am || 0,
                row.slot_8_9_am || 0,
                row.slot_9_10_am || 0,
                row.slot_10_11_am || 0,
                row.slot_11_12_am || 0,
                row.slot_12_1_pm || 0,
                row.slot_1_2_pm || 0,
                row.slot_2_3_pm || 0,
                row.slot_3_4_pm || 0,
                row.slot_4_5_pm || 0,
                row.slot_5_6_pm || 0,
                row.slot_6_7_pm || 0,
                row.slot_7_8_pm || 0,
                row.slot_8_9_pm || 0,
                row.other_time || 0,
                row.total_minutes,
                `"${totalHours}"`,
                `"${(row.notes || '').replace(/"/g, '""')}"`
            ];
            csv += csvRow.join(',') + '\n';
        });
        
        return csv;
    }

    // Convert weekly data to CSV string
    weeklyDataToCSV(weeklyData) {
        if (!weeklyData || weeklyData.length === 0) {
            return 'No weekly data to export';
        }
        
        const headers = ['Week', 'Year', 'Date Range', 'Total Minutes', 'Total Hours', 'Rank'];
        let csv = headers.join(',') + '\n';
        
        weeklyData.forEach(row => {
            const csvRow = [
                `Week ${row.weekNumber}`,
                row.year,
                `"${row.dateRange}"`,
                row.totalMinutes,
                `"${row.totalHours}"`,
                row.rank || 'Unranked'
            ];
            csv += csvRow.join(',') + '\n';
        });
        
        return csv;
    }

    // Save CSV to file
    saveCSVToFile(csvData, filename) {
        const { app } = require('electron');
        
        // Get user's Documents folder
        const userDataPath = app.getPath('documents');
        const exportPath = path.join(userDataPath, 'Productivity Timer Exports');
        
        // Create exports folder if it doesn't exist
        if (!fs.existsSync(exportPath)) {
            fs.mkdirSync(exportPath, { recursive: true });
        }
        
        const filePath = path.join(exportPath, filename);
        fs.writeFileSync(filePath, csvData, 'utf8');
        
        return filePath;
    }

    // Read CSV from file
    readCSVFromFile(filePath) {
        return fs.readFileSync(filePath, 'utf8');
    }

    // Import daily data from CSV
    importDailyDataFromCSV(csvData) {
        const lines = csvData.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
            throw new Error('Invalid CSV format - no data rows found');
        }
        
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        let importedCount = 0;
        let errorCount = 0;
        
        for (let i = 1; i < lines.length; i++) {
            try {
                const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
                const dateStr = values[0];
                
                if (dateStr && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    this.data.dailyData[dateStr] = {
                        dayName: values[1] || this.getDayName(dateStr),
                        slots: {
                            '5-6am': parseInt(values[2]) || 0,
                            '6-7am': parseInt(values[3]) || 0,
                            '7-8am': parseInt(values[4]) || 0,
                            '8-9am': parseInt(values[5]) || 0,
                            '9-10am': parseInt(values[6]) || 0,
                            '10-11am': parseInt(values[7]) || 0,
                            '11-12pm': parseInt(values[8]) || 0,
                            '12-1pm': parseInt(values[9]) || 0,
                            '1-2pm': parseInt(values[10]) || 0,
                            '2-3pm': parseInt(values[11]) || 0,
                            '3-4pm': parseInt(values[12]) || 0,
                            '4-5pm': parseInt(values[13]) || 0,
                            '5-6pm': parseInt(values[14]) || 0,
                            '6-7pm': parseInt(values[15]) || 0,
                            '7-8pm': parseInt(values[16]) || 0,
                            '8-9pm': parseInt(values[17]) || 0,
                            'other': parseInt(values[18]) || 0
                        },
                        totalMinutes: parseInt(values[19]) || 0,
                        notes: values[21] || ''
                    };
                    importedCount++;
                }
            } catch (error) {
                console.error(`Error importing row ${i}:`, error);
                errorCount++;
            }
        }
        
        this.saveData();
        this.updateWeeklyData();
        
        return {
            importedCount,
            errorCount,
            totalRows: lines.length - 1
        };
    }

    // Export complete data as JSON
    exportToJSON() {
        return JSON.stringify(this.data, null, 2);
    }

    // Import from JSON
    importFromJSON(jsonData) {
        try {
            const importedData = JSON.parse(jsonData);
            
            // Merge with existing data
            if (importedData.dailyData) {
                this.data.dailyData = { ...this.data.dailyData, ...importedData.dailyData };
            }
            
            if (importedData.weeklyData) {
                // Merge weekly data, avoiding duplicates
                importedData.weeklyData.forEach(newWeek => {
                    const existingIndex = this.data.weeklyData.findIndex(w => 
                        w.weekNumber === newWeek.weekNumber && w.year === newWeek.year
                    );
                    
                    if (existingIndex >= 0) {
                        this.data.weeklyData[existingIndex] = newWeek;
                    } else {
                        this.data.weeklyData.push(newWeek);
                    }
                });
            }
            
            if (importedData.settings) {
                this.data.settings = { ...this.data.settings, ...importedData.settings };
            }
            
            this.updateWeeklyRankings();
            this.saveData();
            
            return {
                success: true,
                message: 'Data imported successfully'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Get app settings
    getSettings() {
        return this.data.settings;
    }

    // Update app settings
    updateSettings(newSettings) {
        this.data.settings = { ...this.data.settings, ...newSettings };
        this.saveData();
        return this.data.settings;
    }

    //new updates by satyam

    // Missing functions that need to be added to json-database.js

    // Get current week rank
    getCurrentWeekRank() {
        const currentWeek = this.getCurrentWeekData();
        return currentWeek ? { rank: currentWeek.rank, total: this.data.weeklyData.length } : { rank: 0, total: 0 };
    }

    // Get week statistics
    getWeekStats() {
        const totalWeeks = this.data.weeklyData.length;
        const currentWeek = this.getCurrentWeekData();
        const averageMinutes = totalWeeks > 0 ? 
            this.data.weeklyData.reduce((sum, week) => sum + week.totalMinutes, 0) / totalWeeks : 0;
        
        return {
            currentWeek: currentWeek,
            totalWeeks: totalWeeks,
            averageMinutes: Math.round(averageMinutes),
            averageHours: this.formatMinutesToHours(Math.round(averageMinutes)),
            bestWeek: totalWeeks > 0 ? this.data.weeklyData[0] : null // First in sorted array
        };
    }

    // Add time to specific slot
    addTimeToSlot(slotName, minutesToAdd) {
        const today = this.getTodayDateString();
        this.initializeTodayData();
        
        // Convert display slot names to internal slot names
        const slotMapping = {
            '5-6 AM': '5-6am',
            '6-7 AM': '6-7am',
            '7-8 AM': '7-8am',
            '8-9 AM': '8-9am',
            '9-10 AM': '9-10am',
            '10-11 AM': '10-11am',
            '11-12 AM': '11-12pm',
            '12-1 PM': '12-1pm',
            '1-2 PM': '1-2pm',
            '2-3 PM': '2-3pm',
            '3-4 PM': '3-4pm',
            '4-5 PM': '4-5pm',
            '5-6 PM': '5-6pm',
            '6-7 PM': '6-7pm',
            '7-8 PM': '7-8pm',
            '8-9 PM': '8-9pm',
            'Other': 'other'
        };
        
        const internalSlotName = slotMapping[slotName] || slotName;
        
        // Add time to the slot
        this.data.dailyData[today].slots[internalSlotName] = 
            (this.data.dailyData[today].slots[internalSlotName] || 0) + minutesToAdd;
        
        // Recalculate total
        this.data.dailyData[today].totalMinutes = Object.values(this.data.dailyData[today].slots)
            .reduce((sum, val) => sum + val, 0);
        
        this.saveData();
        this.updateWeeklyData();
        
        return this.data.dailyData[today];
    }

    // Get daily data for a specific month
    getDailyDataForMonth(year, month) {
        const monthData = [];
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0); // Last day of month
        
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            const dayData = this.data.dailyData[dateStr];
            
            if (dayData) {
                monthData.push({
                    date: dateStr,
                    day_name: dayData.dayName,
                    total_minutes: dayData.totalMinutes,
                    total_hours: this.formatMinutesToHours(dayData.totalMinutes)
                });
            }
        }
        
        return monthData;
    }

    // Validate PIN (from settings)
    validatePIN(inputPin) {
        return this.data.settings.appPin === inputPin;
    }

    // Update daily data with time slots
    updateDailyData(date, slotData) {
        if (!this.data.dailyData[date]) {
            this.data.dailyData[date] = {
                dayName: this.getDayName(date),
                slots: {
                    '5-6am': 0, '6-7am': 0, '7-8am': 0, '8-9am': 0,
                    '9-10am': 0, '10-11am': 0, '11-12pm': 0, '12-1pm': 0,
                    '1-2pm': 0, '2-3pm': 0, '3-4pm': 0, '4-5pm': 0,
                    '5-6pm': 0, '6-7pm': 0, '7-8pm': 0, '8-9pm': 0,
                    'other': 0
                },
                totalMinutes: 0,
                notes: ""
            };
        }
        
        // Update slots
        Object.keys(slotData.slots).forEach(slot => {
            this.data.dailyData[date].slots[slot] = slotData.slots[slot];
        });
        
        // Recalculate total
        this.data.dailyData[date].totalMinutes = Object.values(this.data.dailyData[date].slots)
            .reduce((sum, val) => sum + val, 0);
        
        // Update notes if provided
        if (slotData.notes !== undefined) {
            this.data.dailyData[date].notes = slotData.notes;
        }
        
        this.saveData();
        this.updateWeeklyData();
        
        return this.data.dailyData[date];
    }

    // Get data for a specific date
    getDataForDate(date) {
        if (this.data.dailyData[date]) {
            const dayData = this.data.dailyData[date];
            return {
                date: date,
                day_name: dayData.dayName,
                slot_5_6_am: dayData.slots['5-6am'] || 0,
                slot_6_7_am: dayData.slots['6-7am'] || 0,
                slot_7_8_am: dayData.slots['7-8am'] || 0,
                slot_8_9_am: dayData.slots['8-9am'] || 0,
                slot_9_10_am: dayData.slots['9-10am'] || 0,
                slot_10_11_am: dayData.slots['10-11am'] || 0,
                slot_11_12_am: dayData.slots['11-12pm'] || 0,
                slot_12_1_pm: dayData.slots['12-1pm'] || 0,
                slot_1_2_pm: dayData.slots['1-2pm'] || 0,
                slot_2_3_pm: dayData.slots['2-3pm'] || 0,
                slot_3_4_pm: dayData.slots['3-4pm'] || 0,
                slot_4_5_pm: dayData.slots['4-5pm'] || 0,
                slot_5_6_pm: dayData.slots['5-6pm'] || 0,
                slot_6_7_pm: dayData.slots['6-7pm'] || 0,
                slot_7_8_pm: dayData.slots['7-8pm'] || 0,
                slot_8_9_pm: dayData.slots['8-9pm'] || 0,
                other_time: dayData.slots['other'] || 0,
                total_minutes: dayData.totalMinutes,
                notes: dayData.notes || ''
            };
        }
        return null;
    }

    // Close function (for compatibility - JSON doesn't need closing)
    close() {
        console.log('📄 JSON database closed (no action needed)');
        // Create final backup before closing
        this.createBackup();
    }

    // Get recent daily data (last N days)
    getRecentDailyData(days = 7) {
        const recentData = [];
        const today = new Date();
        
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            
            const dayData = this.data.dailyData[dateStr];
            if (dayData) {
                recentData.push({
                    date: dateStr,
                    day_name: dayData.dayName,
                    total_minutes: dayData.totalMinutes,
                    total_hours: this.formatMinutesToHours(dayData.totalMinutes)
                });
            } else {
                recentData.push({
                    date: dateStr,
                    day_name: this.getDayName(dateStr),
                    total_minutes: 0,
                    total_hours: '0m'
                });
            }
        }
        
        return recentData;
    }

    // Add minutes to a specific time slot by slot key
    addMinutesToTimeSlot(slotKey, minutes) {
        const today = this.getTodayDateString();
        this.initializeTodayData();
        
        if (this.data.dailyData[today].slots.hasOwnProperty(slotKey)) {
            this.data.dailyData[today].slots[slotKey] = 
                (this.data.dailyData[today].slots[slotKey] || 0) + minutes;
            
            // Recalculate total
            this.data.dailyData[today].totalMinutes = Object.values(this.data.dailyData[today].slots)
                .reduce((sum, val) => sum + val, 0);
            
            this.saveData();
            this.updateWeeklyData();
            
            return this.data.dailyData[today];
        }
        
        throw new Error(`Invalid slot key: ${slotKey}`);
    }
}

module.exports = ProductivityJSONDB;