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
            
            // Clean up any inconsistent slot data
            // Clean up any inconsistent slot data
            this.cleanupSlotData();
            
            // Recalculate week data with proper Monday-Sunday logic
            this.recalculateAllWeekData();
            this.fixWeekNumbers();
            
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
    // Fix getTodayData to return proper format for renderer
    getTodayData() {
        const todayData = this.initializeTodayData();
        
        // Return format that matches what renderer expects
        return {
            date: this.getTodayDateString(),
            day_name: todayData.dayName,
            total_minutes: todayData.totalMinutes,
            notes: todayData.notes,
            // Add individual slot data for compatibility
            slot_5_6_am: todayData.slots['5-6am'] || 0,
            slot_6_7_am: todayData.slots['6-7am'] || 0,
            slot_7_8_am: todayData.slots['7-8am'] || 0,
            slot_8_9_am: todayData.slots['8-9am'] || 0,
            slot_9_10_am: todayData.slots['9-10am'] || 0,
            slot_10_11_am: todayData.slots['10-11am'] || 0,
            slot_11_12_am: todayData.slots['11-12pm'] || 0,
            slot_12_1_pm: todayData.slots['12-1pm'] || 0,
            slot_1_2_pm: todayData.slots['1-2pm'] || 0,
            slot_2_3_pm: todayData.slots['2-3pm'] || 0,
            slot_3_4_pm: todayData.slots['3-4pm'] || 0,
            slot_4_5_pm: todayData.slots['4-5pm'] || 0,
            slot_5_6_pm: todayData.slots['5-6pm'] || 0,
            slot_6_7_pm: todayData.slots['6-7pm'] || 0,
            slot_7_8_pm: todayData.slots['7-8pm'] || 0,
            slot_8_9_pm: todayData.slots['8-9pm'] || 0,
            other_time: todayData.slots['other'] || 0
        };
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
    

    // Format minutes to hours
    formatMinutesToHours(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    }

    // Update weekly data
    updateWeeklyData() {
    console.log('🔄 Updating weekly data...');
    
    // Get current week data
    const currentWeek = this.getCurrentWeekNumber();
    const currentYear = new Date().getFullYear();
    
    console.log(`📅 Updating data for week ${currentWeek} of ${currentYear}`);
    
    // Calculate week totals using consistent date calculation
    const weekDates = this.getWeekDates(currentYear, currentWeek);
    let weekTotal = 0;
    let daysWithData = 0;

    console.log('📊 Week dates:', weekDates);

    weekDates.forEach(dateStr => {
        if (this.data.dailyData[dateStr]) {
            const dayMinutes = this.data.dailyData[dateStr].totalMinutes || 0;
            weekTotal += dayMinutes;
            if (dayMinutes > 0) {
                daysWithData++;
            }
            console.log(`📊 ${dateStr}: ${dayMinutes} minutes`);
        }
    });
    
    console.log(`📈 Week total: ${weekTotal} minutes from ${daysWithData} days`);
    
    // Update or create week entry
    const weekIndex = this.data.weeklyData.findIndex(w => 
        w.weekNumber === currentWeek && w.year === currentYear
    );
    
    const weekData = {
        weekNumber: currentWeek,
        year: currentYear,
        dateRange: this.getWeekDateRangeString(weekDates),
        totalMinutes: weekTotal,
        totalHours: this.formatMinutesToHours(weekTotal),
        daysWithData: daysWithData,
        rank: 0 // Will be calculated in ranking update
    };
    
    if (weekIndex >= 0) {
        console.log('📝 Updating existing week entry');
        this.data.weeklyData[weekIndex] = weekData;
    } else {
        console.log('📝 Creating new week entry');
        this.data.weeklyData.push(weekData);
    }
    
    // Update rankings
    this.updateWeeklyRankings();
    this.saveData();
    
    console.log('✅ Weekly data updated successfully');
}

    // Get current week number (Monday-Sunday) - Fixed calculation with SQLite logic
getCurrentWeekNumber() {
    const today = new Date();
    
    // Use the standardized week calculation
    return this.getWeekNumberForDate(today);
}

    
    // Helper function to get week number for any date (ISO week standard)
getWeekNumberForDate(date) {
    const d = new Date(date);
    
    // Set to nearest Thursday: current date + 4 - current day number
    // Make Sunday's day number 7
    const dayNum = d.getDay() || 7;
    d.setDate(d.getDate() + 4 - dayNum);
    
    // Get first Thursday of year
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const yearFirstThursday = new Date(yearStart);
    const yearFirstThursdayDayNum = yearFirstThursday.getDay() || 7;
    yearFirstThursday.setDate(yearFirstThursday.getDate() + 4 - yearFirstThursdayDayNum);
    
    // Calculate week number
    const weekNumber = Math.ceil((((d - yearFirstThursday) / 86400000) + 1) / 7);
    
    console.log(`📅 Week calculation for ${date.toDateString()}: Week ${weekNumber}`);
    return weekNumber;
}

    // Get dates for a specific week (Monday-Sunday) - Fixed calculation
getWeekDates(year, weekNumber) {
    // Find January 4th (always in week 1)
    const jan4 = new Date(year, 0, 4);
    
    // Find Monday of week 1 (3 days before Thursday Jan 4th)
    const firstMonday = new Date(jan4);
    firstMonday.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7) + 1);
    
    // Calculate target Monday for the given week number
    const targetMonday = new Date(firstMonday);
    targetMonday.setDate(firstMonday.getDate() + (weekNumber - 1) * 7);
    
    // Generate 7 days starting from Monday
    const dates = [];
    for (let i = 0; i < 7; i++) {
        const date = new Date(targetMonday);
        date.setDate(targetMonday.getDate() + i);
        dates.push(date.toISOString().split('T')[0]);
    }
    
    console.log(`📅 Week ${weekNumber}, ${year}: ${dates[0]} (Mon) to ${dates[6]} (Sun)`);
    return dates;
}

// Get week date range (Monday to Sunday) - matches SQLite version logic
getWeekDateRange(date) {
    const d = new Date(date);
    const day = d.getDay();
    
    // Calculate Monday (start of week)
    const mondayOffset = day === 0 ? -6 : 1 - day; // Handle Sunday as day 0
    const monday = new Date(d);
    monday.setDate(d.getDate() + mondayOffset);
    
    // Calculate Sunday (end of week)
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    return {
        start: monday.toISOString().split('T')[0],
        end: sunday.toISOString().split('T')[0],
        startFormatted: monday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        endFormatted: sunday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    };
}

    // Get week date range string
    getWeekDateRangeString(weekDates) {
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

    // Fix getWeeklyRankingData to return proper format
    getWeeklyRankingData(limit = 10) {
        // Update rankings first
        this.updateWeeklyRankings();
        
        return this.data.weeklyData
            .sort((a, b) => b.totalMinutes - a.totalMinutes)
            .slice(0, limit)
            .map(week => ({
                week_number: week.weekNumber,
                year: week.year,
                date_range: week.dateRange,
                total_minutes: week.totalMinutes,
                total_hours_formatted: week.totalHours,
                rank: week.rank
            }));
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
    console.log('📊 Getting current week rank...');
    
    // Ensure weekly data is up to date
    this.updateWeeklyData();
    
    const currentWeek = this.getCurrentWeekNumber();
    const currentYear = new Date().getFullYear();
    
    console.log(`📊 Looking for rank of week ${currentWeek}, ${currentYear}`);
    
    // Find current week data
    const currentWeekData = this.data.weeklyData.find(w => 
        w.weekNumber === currentWeek && w.year === currentYear
    );
    
    if (currentWeekData) {
        console.log('📊 Current week rank data:', currentWeekData);
        
        return {
            rank: currentWeekData.rank,
            week_number: currentWeekData.weekNumber,
            year: currentWeekData.year,
            total_minutes: currentWeekData.totalMinutes,
            total_hours_formatted: currentWeekData.totalHours,
            total: this.data.weeklyData.length
        };
    }
    
    console.log('⚠️ No current week data found for ranking');
    return { 
        rank: 1, 
        week_number: currentWeek,
        year: currentYear,
        total_minutes: 0,
        total_hours_formatted: '0H 0M',
        total: 1 
    };
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

    // Missing functions for complete functionality

    // Update specific slot time (replace, not add)
    updateSlotTime(slotField, newMinutes) {
        const today = this.getTodayDateString();
        this.initializeTodayData();
        
        // Convert display names to internal names if needed
        const slotMapping = {
            '5-6 AM': '5-6am', '6-7 AM': '6-7am', '7-8 AM': '7-8am', '8-9 AM': '8-9am',
            '9-10 AM': '9-10am', '10-11 AM': '10-11am', '11-12 AM': '11-12pm', '12-1 PM': '12-1pm',
            '1-2 PM': '1-2pm', '2-3 PM': '2-3pm', '3-4 PM': '3-4pm', '4-5 PM': '4-5pm',
            '5-6 PM': '5-6pm', '6-7 PM': '6-7pm', '7-8 PM': '7-8pm', '8-9 PM': '8-9pm',
            'Other': 'other',
            // Also handle internal names directly
            'slot_5_6_am': '5-6am', 'slot_6_7_am': '6-7am', 'slot_7_8_am': '7-8am', 'slot_8_9_am': '8-9am',
            'slot_9_10_am': '9-10am', 'slot_10_11_am': '10-11am', 'slot_11_12_am': '11-12pm', 'slot_12_1_pm': '12-1pm',
            'slot_1_2_pm': '1-2pm', 'slot_2_3_pm': '2-3pm', 'slot_3_4_pm': '3-4pm', 'slot_4_5_pm': '4-5pm',
            'slot_5_6_pm': '5-6pm', 'slot_6_7_pm': '6-7pm', 'slot_7_8_pm': '7-8pm', 'slot_8_9_pm': '8-9pm',
            'other_time': 'other'
        };
        
        const internalSlotName = slotMapping[slotField] || slotField;
        
        // Set the exact time (replace, not add)
        this.data.dailyData[today].slots[internalSlotName] = newMinutes;
        
        // Recalculate total
        this.data.dailyData[today].totalMinutes = Object.values(this.data.dailyData[today].slots)
            .reduce((sum, val) => sum + val, 0);
        
        this.saveData();
        this.updateWeeklyData();
        
        return this.data.dailyData[today];
    }

    // Update today's notes
    updateTodayNotes(notes) {
        const today = this.getTodayDateString();
        this.initializeTodayData();
        
        this.data.dailyData[today].notes = notes || '';
        this.saveData();
        
        return this.data.dailyData[today];
    }

    // Get setting value
    getSetting(settingName) {
        if (settingName === 'app_pin') {
            return this.data.settings.appPin || '1234';
        }
        return this.data.settings[settingName] || null;
    }

    // Update setting value
    updateSetting(settingName, settingValue) {
        if (settingName === 'app_pin') {
            this.data.settings.appPin = settingValue;
        } else {
            this.data.settings[settingName] = settingValue;
        }
        
        this.saveData();
        return this.data.settings;
    }

    // Get month summary for history features
    getMonthSummary(year, month) {
        const monthData = this.getDailyDataForMonth(year, month);
        
        if (monthData.length === 0) {
            return {
                total_days: 0,
                total_minutes: 0,
                avg_minutes: 0,
                best_day: 0,
                worst_day: 0
            };
        }
        
        const totalMinutes = monthData.reduce((sum, day) => sum + day.total_minutes, 0);
        const avgMinutes = Math.round(totalMinutes / monthData.length);
        const bestDay = Math.max(...monthData.map(day => day.total_minutes));
        const worstDay = Math.min(...monthData.map(day => day.total_minutes));
        
        return {
            total_days: monthData.length,
            total_minutes: totalMinutes,
            avg_minutes: avgMinutes,
            best_day: bestDay,
            worst_day: worstDay
        };
    }

    // Fix getCurrentTimeSlot to return proper format
    getCurrentTimeSlot() {
        const now = new Date();
        const hour = now.getHours();
        
        const slotMap = {
            5: '5-6 AM', 6: '6-7 AM', 7: '7-8 AM', 8: '8-9 AM',
            9: '9-10 AM', 10: '10-11 AM', 11: '11-12 PM', 12: '12-1 PM',
            13: '1-2 PM', 14: '2-3 PM', 15: '3-4 PM', 16: '4-5 PM',
            17: '5-6 PM', 18: '6-7 PM', 19: '7-8 PM', 20: '8-9 PM'
        };
        
        return {
            currentSlot: slotMap[hour] || 'Other Time',
            hour: hour,
            displayTime: now.toLocaleTimeString()
        };
    }

    // Fix getTodayHourlyBreakdown to return proper format
    // Fix getTodayHourlyBreakdown to return proper display names
    getTodayHourlyBreakdown() {
        const todayData = this.getTodayData();
        const breakdown = [];
        
        const slotLabels = {
            '5-6am': '5-6 AM', '6-7am': '6-7 AM', '7-8am': '7-8 AM', '8-9am': '8-9 AM',
            '9-10am': '9-10 AM', '10-11am': '10-11 AM', '11-12pm': '11-12 PM', '12-1pm': '12-1 PM',
            '1-2pm': '1-2 PM', '2-3pm': '2-3 PM', '3-4pm': '3-4 PM', '4-5pm': '4-5 PM',
            '5-6pm': '5-6 PM', '6-7pm': '6-7 PM', '7-8pm': '7-8 PM', '8-9pm': '8-9 PM',
            'other': 'Other Time'
        };
        
        const slotFields = {
            '5-6am': 'slot_5_6_am', '6-7am': 'slot_6_7_am', '7-8am': 'slot_7_8_am', '8-9am': 'slot_8_9_am',
            '9-10am': 'slot_9_10_am', '10-11am': 'slot_10_11_am', '11-12pm': 'slot_11_12_am', '12-1pm': 'slot_12_1_pm',
            '1-2pm': 'slot_1_2_pm', '2-3pm': 'slot_2_3_pm', '3-4pm': 'slot_3_4_pm', '4-5pm': 'slot_4_5_pm',
            '5-6pm': 'slot_5_6_pm', '6-7pm': 'slot_6_7_pm', '7-8pm': 'slot_7_8_pm', '8-9pm': 'slot_8_9_pm',
            'other': 'other_time'
        };
        
        // Use the internal data structure
        const internalData = this.data.dailyData[this.getTodayDateString()];
        if (internalData && internalData.slots) {
            Object.entries(internalData.slots).forEach(([slot, minutes]) => {
                if (minutes > 0) {
                    breakdown.push({
                        name: slotLabels[slot] || slot,
                        field: slotFields[slot] || slot,
                        minutes: minutes,
                        hours: this.formatMinutesToHours(minutes)
                    });
                }
            });
        }
        
        return breakdown;
    }

    // Fix getCurrentWeekData to return proper format
    getCurrentWeekData() {
    console.log('🗓️ Getting current week data...');
    
    // Force update weekly data first
    this.updateWeeklyData();
    
    const currentWeek = this.getCurrentWeekNumber();
    const currentYear = new Date().getFullYear();
    
    console.log(`📅 Looking for week ${currentWeek} of ${currentYear}`);
    
    // Find week data in the array
    let weekData = this.data.weeklyData.find(w => 
        w.weekNumber === currentWeek && w.year === currentYear
    );
    
    // If no week data exists, calculate it manually from daily data
    if (!weekData) {
        console.log('📊 No existing week data, calculating from daily data...');
        
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
        
        // Create new week data entry
        weekData = {
            weekNumber: currentWeek,
            year: currentYear,
            dateRange: this.getWeekDateRangeString(weekDates),
            totalMinutes: weekTotal,
            totalHours: this.formatMinutesToHours(weekTotal),
            daysWithData: daysWithData,
            rank: 1 // Default rank
        };
        
        // Add to weekly data array
        this.data.weeklyData.push(weekData);
        this.updateWeeklyRankings();
        this.saveData();
        
        console.log('📊 Created new week data:', weekData);
    }
    
    console.log('✅ Current week data:', weekData);
    
    // Return in the format expected by renderer
    return {
        week_number: weekData.weekNumber,
        year: weekData.year,
        date_range: weekData.dateRange,
        total_minutes: weekData.totalMinutes,
        total_hours_formatted: weekData.totalHours,
        rank: weekData.rank,
        days_with_data: weekData.daysWithData
    };
}

    // Fix getWeekStats to return proper format
    // Fix getWeekStats to return proper format
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
           averageFormatted: this.formatMinutesToHours(Math.round(averageMinutes)),
           bestWeek: totalWeeks > 0 ? this.data.weeklyData[0] : null // First in sorted array
       };
   }

   // Fix addTimeToSlot to handle both display names and internal names
   addTimeToSlot(slotName, minutesToAdd) {
       const today = this.getTodayDateString();
       this.initializeTodayData();
       
       // Enhanced slot mapping to handle all possible input formats
       const slotMapping = {
           // Display names from UI
           '5-6 AM': '5-6am', '6-7 AM': '6-7am', '7-8 AM': '7-8am', '8-9 AM': '8-9am',
           '9-10 AM': '9-10am', '10-11 AM': '10-11am', '11-12 PM': '11-12pm', '12-1 PM': '12-1pm',
           '1-2 PM': '1-2pm', '2-3 PM': '2-3pm', '3-4 PM': '3-4pm', '4-5 PM': '4-5pm',
           '5-6 PM': '5-6pm', '6-7 PM': '6-7pm', '7-8 PM': '7-8pm', '8-9 PM': '8-9pm',
           'Other Time': 'other',
           // Database field names from old system
           'slot_5_6_am': '5-6am', 'slot_6_7_am': '6-7am', 'slot_7_8_am': '7-8am', 'slot_8_9_am': '8-9am',
           'slot_9_10_am': '9-10am', 'slot_10_11_am': '10-11am', 'slot_11_12_am': '11-12pm', 'slot_12_1_pm': '12-1pm',
           'slot_1_2_pm': '1-2pm', 'slot_2_3_pm': '2-3pm', 'slot_3_4_pm': '3-4pm', 'slot_4_5_pm': '4-5pm',
           'slot_5_6_pm': '5-6pm', 'slot_6_7_pm': '6-7pm', 'slot_7_8_pm': '7-8pm', 'slot_8_9_pm': '8-9pm',
           'other_time': 'other',
           // Direct internal names (pass through)
           '5-6am': '5-6am', '6-7am': '6-7am', '7-8am': '7-8am', '8-9am': '8-9am',
           '9-10am': '9-10am', '10-11am': '10-11am', '11-12pm': '11-12pm', '12-1pm': '12-1pm',
           '1-2pm': '1-2pm', '2-3pm': '2-3pm', '3-4pm': '3-4pm', '4-5pm': '4-5pm',
           '5-6pm': '5-6pm', '6-7pm': '6-7pm', '7-8pm': '7-8pm', '8-9pm': '8-9pm',
           'other': 'other'
       };
       
       const internalSlotName = slotMapping[slotName] || slotName;
       
       console.log(`🕐 Adding ${minutesToAdd} minutes to slot: ${slotName} -> ${internalSlotName}`);
       
       // Add time to the slot
       this.data.dailyData[today].slots[internalSlotName] = 
           (this.data.dailyData[today].slots[internalSlotName] || 0) + minutesToAdd;
       
       // Recalculate total
       this.data.dailyData[today].totalMinutes = Object.values(this.data.dailyData[today].slots)
           .reduce((sum, val) => sum + val, 0);
       
       this.saveData();
       this.updateWeeklyData();
       
       console.log(`✅ Updated ${internalSlotName}: now ${this.data.dailyData[today].slots[internalSlotName]} minutes`);
       
       return this.data.dailyData[today];
   }

   // Fix getDailyDataForMonth to return proper format
   getDailyDataForMonth(year, month) {
       const monthData = [];
       const startDate = new Date(year, month - 1, 1);
       const endDate = new Date(year, month, 0); // Last day of month
       
       for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
           const dateStr = d.toISOString().split('T')[0];
           const dayData = this.data.dailyData[dateStr];
           
           if (dayData && dayData.totalMinutes > 0) {
               monthData.push({
                   date: dateStr,
                   day_name: dayData.dayName,
                   total_minutes: dayData.totalMinutes,
                   total_hours: this.formatMinutesToHours(dayData.totalMinutes),
                   notes: dayData.notes || ''
               });
           }
       }
       
       return monthData;
   }

   // Fix getDataForDate to return proper format for day detail
   getDataForDate(date) {
       if (this.data.dailyData[date]) {
           const dayData = this.data.dailyData[date];
           
           // Convert slots to display format for day detail
           const slots = [];
           const slotLabels = {
               '5-6am': '5-6 AM', '6-7am': '6-7 AM', '7-8am': '7-8 AM', '8-9am': '8-9 AM',
               '9-10am': '9-10 AM', '10-11am': '10-11 AM', '11-12pm': '11-12 PM', '12-1pm': '12-1 PM',
               '1-2pm': '1-2 PM', '2-3pm': '2-3 PM', '3-4pm': '3-4 PM', '4-5pm': '4-5 PM',
               '5-6pm': '5-6 PM', '6-7pm': '6-7 PM', '7-8pm': '7-8 PM', '8-9pm': '8-9 PM',
               'other': 'Other Time'
           };
           
           Object.entries(dayData.slots).forEach(([slot, minutes]) => {
               if (minutes > 0) {
                   slots.push({
                       name: slotLabels[slot] || slot,
                       minutes: minutes
                   });
               }
           });
           
           return {
               date: date,
               day_name: dayData.dayName,
               total_minutes: dayData.totalMinutes,
               notes: dayData.notes || '',
               slots: slots
           };
       }
       return null;
   }

   // Add function to get statistics for data management
    getDataStatistics() {
        const totalDays = Object.keys(this.data.dailyData).length;
        const totalMinutes = Object.values(this.data.dailyData)
            .reduce((sum, day) => sum + (day.totalMinutes || 0), 0);
        
        return {
            totalDays: totalDays,
            totalMinutes: totalMinutes,
            totalHours: this.formatMinutesToHours(totalMinutes)
        };
    }

    // Add this function to clean up inconsistent slot data
    // Add this function to clean up inconsistent slot data
    cleanupSlotData() {
        console.log('🧹 Cleaning up slot data inconsistencies...');
        
        let globalNeedsUpdate = false; // Move variable to proper scope
        
        Object.keys(this.data.dailyData).forEach(dateKey => {
            const dayData = this.data.dailyData[dateKey];
            let dayNeedsUpdate = false; // Local variable for this day
            
            // Check for any database field names in slots and convert them
            const slotsToFix = {
                'slot_5_6_am': '5-6am',
                'slot_6_7_am': '6-7am', 
                'slot_7_8_am': '7-8am',
                'slot_8_9_am': '8-9am',
                'slot_9_10_am': '9-10am',
                'slot_10_11_am': '10-11am',
                'slot_11_12_am': '11-12pm',
                'slot_12_1_pm': '12-1pm',
                'slot_1_2_pm': '1-2pm',
                'slot_2_3_pm': '2-3pm',
                'slot_3_4_pm': '3-4pm',
                'slot_4_5_pm': '4-5pm',
                'slot_5_6_pm': '5-6pm',
                'slot_6_7_pm': '6-7pm',
                'slot_7_8_pm': '7-8pm',
                'slot_8_9_pm': '8-9pm',
                'other_time': 'other'
            };
            
            Object.entries(slotsToFix).forEach(([oldKey, newKey]) => {
                if (dayData.slots && dayData.slots[oldKey] !== undefined) {
                    console.log(`🔄 Converting ${oldKey} to ${newKey} for ${dateKey}`);
                    
                    // Move the value to correct key
                    if (!dayData.slots[newKey]) {
                        dayData.slots[newKey] = dayData.slots[oldKey];
                    } else {
                        // If both exist, add them together
                        dayData.slots[newKey] += dayData.slots[oldKey];
                    }
                    
                    // Remove old key
                    delete dayData.slots[oldKey];
                    dayNeedsUpdate = true;
                    globalNeedsUpdate = true;
                }
            });
            
            if (dayNeedsUpdate) {
                // Recalculate total for this day
                dayData.totalMinutes = Object.values(dayData.slots).reduce((sum, val) => sum + val, 0);
            }
        });
        
        if (globalNeedsUpdate) {
            this.saveData();
            console.log('✅ Slot data cleanup completed');
        } else {
            console.log('✅ No slot data cleanup needed');
        }
    }

    // Recalculate all week data with new Monday-Sunday logic
    recalculateAllWeekData() {
        console.log('🔄 Recalculating all week data with Monday-Sunday logic...');
        
        // Clear existing week data
        this.data.weeklyData = [];
        
        // Get all dates that have data
        const allDates = Object.keys(this.data.dailyData)
            .filter(date => this.data.dailyData[date].totalMinutes > 0)
            .sort();
        
        if (allDates.length === 0) {
            console.log('📝 No data to recalculate');
            return;
        }
        
        // Group dates by week
        const weekGroups = {};
        
        allDates.forEach(dateStr => {
    const date = new Date(dateStr + 'T00:00:00');
    const year = date.getFullYear();
    
    // Use consistent week number calculation
    const weekNumber = this.getWeekNumberForDate(date);
            
            const weekKey = `${year}-W${weekNumber}`;
            
            if (!weekGroups[weekKey]) {
                weekGroups[weekKey] = {
                    year: year,
                    weekNumber: weekNumber,
                    dates: [],
                    totalMinutes: 0
                };
            }
            
            weekGroups[weekKey].dates.push(dateStr);
            weekGroups[weekKey].totalMinutes += this.data.dailyData[dateStr].totalMinutes;
        });
        
        // Convert groups to week data
        Object.values(weekGroups).forEach(group => {
            const weekDates = this.getWeekDates(group.year, group.weekNumber);
            
            const weekData = {
                weekNumber: group.weekNumber,
                year: group.year,
                dateRange: this.getWeekDateRangeString(weekDates),
                totalMinutes: group.totalMinutes,
                totalHours: this.formatMinutesToHours(group.totalMinutes),
                daysWithData: group.dates.length,
                rank: 0 // Will be calculated in ranking update
            };
            
            this.data.weeklyData.push(weekData);
        });
        
        // Update rankings
        this.updateWeeklyRankings();
        this.saveData();
        
        console.log(`✅ Recalculated ${this.data.weeklyData.length} weeks`);
    }

    // Temporary function to fix week numbers - call once to clean up data
fixWeekNumbers() {
    console.log('🔧 Fixing existing week numbers...');
    
    // Clear all week data and recalculate
    this.data.weeklyData = [];
    
    // Recalculate all weeks with fixed logic
    this.recalculateAllWeekData();
    
    console.log('✅ Week numbers fixed');
   
}



}

module.exports = ProductivityJSONDB;