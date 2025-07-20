const Database = require('better-sqlite3');
const path = require('path');

class ProductivityDB {
    constructor() {
        // Create database in app data directory
        const dbPath = path.join(__dirname, 'productivity.db');
        this.db = new Database(dbPath);
        this.initializeTables();
    }

    initializeTables() {
        // Create daily data table with hourly slots
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS daily_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT UNIQUE NOT NULL,
                day_name TEXT NOT NULL,
                slot_5_6_am INTEGER DEFAULT 0,
                slot_6_7_am INTEGER DEFAULT 0,
                slot_7_8_am INTEGER DEFAULT 0,
                slot_8_9_am INTEGER DEFAULT 0,
                slot_9_10_am INTEGER DEFAULT 0,
                slot_10_11_am INTEGER DEFAULT 0,
                slot_11_12_am INTEGER DEFAULT 0,
                slot_12_1_pm INTEGER DEFAULT 0,
                slot_1_2_pm INTEGER DEFAULT 0,
                slot_2_3_pm INTEGER DEFAULT 0,
                slot_3_4_pm INTEGER DEFAULT 0,
                slot_4_5_pm INTEGER DEFAULT 0,
                slot_5_6_pm INTEGER DEFAULT 0,
                slot_6_7_pm INTEGER DEFAULT 0,
                slot_7_8_pm INTEGER DEFAULT 0,
                slot_8_9_pm INTEGER DEFAULT 0,
                other_time INTEGER DEFAULT 0,
                total_minutes INTEGER DEFAULT 0,
                notes TEXT DEFAULT '',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create weekly data table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS weekly_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                week_number INTEGER NOT NULL,
                year INTEGER NOT NULL,
                date_range TEXT NOT NULL,
                total_minutes INTEGER DEFAULT 0,
                total_hours_formatted TEXT DEFAULT '0H 0M',
                rank INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(week_number, year)
            )
        `);

        // Create settings table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                setting_name TEXT UNIQUE NOT NULL,
                setting_value TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Insert default settings
        this.insertDefaultSettings();
    }

    insertDefaultSettings() {
        const defaultSettings = [
            ['app_pin', '1234'],
            ['alarm_times', '3:59,4:59,5:59,6:59,7:59,8:59,9:59,10:59,11:59,12:59,13:59,14:59,15:59,16:59,17:59,18:59,19:59,20:59,21:59,22:59'],
            ['silent_mode', 'false'],
            ['alarm_sound', 'default']
        ];

        const insertSetting = this.db.prepare(`
            INSERT OR IGNORE INTO settings (setting_name, setting_value) 
            VALUES (?, ?)
        `);

        defaultSettings.forEach(([name, value]) => {
            insertSetting.run(name, value);
        });
    }

    // Get today's data
    getTodayData() {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        const stmt = this.db.prepare('SELECT * FROM daily_data WHERE date = ?');
        return stmt.get(today);
    }

    // Create today's record if it doesn't exist
    initializeTodayRecord() {
        const today = new Date().toISOString().split('T')[0];
        const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
        
        const stmt = this.db.prepare(`
            INSERT OR IGNORE INTO daily_data (date, day_name) 
            VALUES (?, ?)
        `);
        
        return stmt.run(today, dayName);
    }

    // Add time to specific hour slot
    addTimeToSlot(slotName, minutes) {
        const today = new Date().toISOString().split('T')[0];
        this.initializeTodayRecord();

        const stmt = this.db.prepare(`
            UPDATE daily_data 
            SET ${slotName} = ${slotName} + ?, 
                total_minutes = total_minutes + ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE date = ?
        `);
        
        return stmt.run(minutes, minutes, today);
    }

    // Update notes for today
    updateTodayNotes(notes) {
        const today = new Date().toISOString().split('T')[0];
        this.initializeTodayRecord();

        const stmt = this.db.prepare(`
            UPDATE daily_data 
            SET notes = ?, updated_at = CURRENT_TIMESTAMP
            WHERE date = ?
        `);
        
        return stmt.run(notes, today);
    }

    // Get current week data
    getCurrentWeekData() {
        const now = new Date();
        const year = now.getFullYear();
        const weekNumber = this.getWeekNumber(now);
        
        const stmt = this.db.prepare('SELECT * FROM weekly_data WHERE week_number = ? AND year = ?');
        return stmt.get(weekNumber, year);
    }

    // Calculate week number
    // Calculate week number (Monday-based, 1-52/53)
getWeekNumber(date) {
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
    const weekNum = Math.ceil((((d - yearFirstThursday) / 86400000) + 1) / 7);
    return weekNum;
}

    // Get setting value
    getSetting(name) {
        const stmt = this.db.prepare('SELECT setting_value FROM settings WHERE setting_name = ?');
        const result = stmt.get(name);
        return result ? result.setting_value : null;
    }

    // Update setting
    updateSetting(name, value) {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO settings (setting_name, setting_value, updated_at) 
            VALUES (?, ?, CURRENT_TIMESTAMP)
        `);
        return stmt.run(name, value);
    }

    // Get all weekly data for ranking
    getAllWeeksData() {
        const stmt = this.db.prepare('SELECT * FROM weekly_data ORDER BY year DESC, week_number DESC');
        return stmt.all();
    }

    // Calculate and update weekly totals
// Calculate and update weekly totals (optimized)
updateWeeklyData(forceRankingUpdate = false) {
    const now = new Date();
    const year = now.getFullYear();
    const weekNumber = this.getWeekNumber(now);
    
    // Get start and end dates for current week
    const weekDates = this.getWeekDateRange(now);
    
    // Calculate total minutes for this week from daily data
    const stmt = this.db.prepare(`
        SELECT SUM(total_minutes) as week_total 
        FROM daily_data 
        WHERE date >= ? AND date <= ?
    `);
    
    const result = stmt.get(weekDates.start, weekDates.end);
    const totalMinutes = result.week_total || 0;
    const totalHoursFormatted = this.formatMinutesToHours(totalMinutes);
    
    // Get previous total for this week
    const prevWeekData = this.db.prepare(`
        SELECT total_minutes FROM weekly_data 
        WHERE week_number = ? AND year = ?
    `).get(weekNumber, year);
    
    const prevTotal = prevWeekData ? prevWeekData.total_minutes : 0;
    
    // Insert or update weekly record
    const insertWeekStmt = this.db.prepare(`
        INSERT OR REPLACE INTO weekly_data 
        (week_number, year, date_range, total_minutes, total_hours_formatted, updated_at) 
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    
    insertWeekStmt.run(
        weekNumber, 
        year, 
        `${weekDates.startFormatted} to ${weekDates.endFormatted}`,
        totalMinutes,
        totalHoursFormatted
    );
    
    // Only update rankings if total changed significantly or forced
    if (forceRankingUpdate || Math.abs(totalMinutes - prevTotal) >= 30) { // 30+ minute change
        this.updateAllWeekRankings();
        console.log(`Updated rankings - week total changed from ${prevTotal} to ${totalMinutes} minutes`);
    }
    
    return {
        weekNumber,
        year,
        totalMinutes,
        totalHoursFormatted,
        dateRange: `${weekDates.startFormatted} to ${weekDates.endFormatted}`
    };
}

// Update rankings for all weeks
updateAllWeekRankings() {
    // Get all weeks ordered by total minutes (descending)
    const allWeeks = this.db.prepare(`
        SELECT id, total_minutes, week_number, year
        FROM weekly_data 
        WHERE total_minutes > 0
        ORDER BY total_minutes DESC
    `).all();
    
    // Update rank for each week
    const updateRankStmt = this.db.prepare(`
        UPDATE weekly_data 
        SET rank = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `);
    
    allWeeks.forEach((week, index) => {
        const rank = index + 1; // Rank starts from 1
        updateRankStmt.run(rank, week.id);
    });
    
    console.log(`Updated rankings for ${allWeeks.length} weeks`);
}

// Get week date range
// Get week date range (Monday to Sunday)
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

// Format minutes to hours display
formatMinutesToHours(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}H ${mins}M`;
}

// Get weekly ranking data for charts
getWeeklyRankingData(limit = 15) {
    const stmt = this.db.prepare(`
        SELECT week_number, year, date_range, total_minutes, 
               total_hours_formatted, rank
        FROM weekly_data 
        WHERE total_minutes > 0
        ORDER BY year DESC, week_number DESC 
        LIMIT ?
    `);
    
    return stmt.all(limit);
}

// Get current week rank
getCurrentWeekRank() {
    const now = new Date();
    const year = now.getFullYear();
    const weekNumber = this.getWeekNumber(now);
    
    const stmt = this.db.prepare(`
        SELECT rank, total_minutes, total_hours_formatted
        FROM weekly_data 
        WHERE week_number = ? AND year = ?
    `);
    
    return stmt.get(weekNumber, year);
}

// Get week statistics
getWeekStats() {
    const totalWeeks = this.db.prepare('SELECT COUNT(*) as count FROM weekly_data WHERE total_minutes > 0').get();
    const bestWeek = this.db.prepare('SELECT * FROM weekly_data WHERE rank = 1').get();
    const avgMinutes = this.db.prepare('SELECT AVG(total_minutes) as avg FROM weekly_data WHERE total_minutes > 0').get();
    
    return {
        totalWeeks: totalWeeks.count,
        bestWeek: bestWeek,
        averageMinutes: Math.round(avgMinutes.avg || 0),
        averageFormatted: this.formatMinutesToHours(Math.round(avgMinutes.avg || 0))
    };
}

// Get today's hourly breakdown
getTodayHourlyBreakdown() {
    const today = new Date().toISOString().split('T')[0];
    const todayData = this.getTodayData();
    
    if (!todayData) return [];
    
    const slots = [
        { name: '5-6 AM', field: 'slot_5_6_am', minutes: todayData.slot_5_6_am || 0 },
        { name: '6-7 AM', field: 'slot_6_7_am', minutes: todayData.slot_6_7_am || 0 },
        { name: '7-8 AM', field: 'slot_7_8_am', minutes: todayData.slot_7_8_am || 0 },
        { name: '8-9 AM', field: 'slot_8_9_am', minutes: todayData.slot_8_9_am || 0 },
        { name: '9-10 AM', field: 'slot_9_10_am', minutes: todayData.slot_9_10_am || 0 },
        { name: '10-11 AM', field: 'slot_10_11_am', minutes: todayData.slot_10_11_am || 0 },
        { name: '11-12 PM', field: 'slot_11_12_am', minutes: todayData.slot_11_12_am || 0 },
        { name: '12-1 PM', field: 'slot_12_1_pm', minutes: todayData.slot_12_1_pm || 0 },
        { name: '1-2 PM', field: 'slot_1_2_pm', minutes: todayData.slot_1_2_pm || 0 },
        { name: '2-3 PM', field: 'slot_2_3_pm', minutes: todayData.slot_2_3_pm || 0 },
        { name: '3-4 PM', field: 'slot_3_4_pm', minutes: todayData.slot_3_4_pm || 0 },
        { name: '4-5 PM', field: 'slot_4_5_pm', minutes: todayData.slot_4_5_pm || 0 },
        { name: '5-6 PM', field: 'slot_5_6_pm', minutes: todayData.slot_5_6_pm || 0 },
        { name: '6-7 PM', field: 'slot_6_7_pm', minutes: todayData.slot_6_7_pm || 0 },
        { name: '7-8 PM', field: 'slot_7_8_pm', minutes: todayData.slot_7_8_pm || 0 },
        { name: '8-9 PM', field: 'slot_8_9_pm', minutes: todayData.slot_8_9_pm || 0 },
        { name: 'Other', field: 'other_time', minutes: todayData.other_time || 0 }
    ];
    
    return slots.filter(slot => slot.minutes > 0); // Only return slots with data
}

// Get current time slot name
getCurrentTimeSlot() {
    const now = new Date();
    const hour = now.getHours();
    
    const slotMap = {
        5: '5-6 AM', 6: '6-7 AM', 7: '7-8 AM', 8: '8-9 AM',
        9: '9-10 AM', 10: '10-11 AM', 11: '11-12 PM', 12: '12-1 PM',
        13: '1-2 PM', 14: '2-3 PM', 15: '3-4 PM', 16: '4-5 PM',
        17: '5-6 PM', 18: '6-7 PM', 19: '7-8 PM', 20: '8-9 PM'
    };
    
    return slotMap[hour] || 'Other';
}

// Export all data to CSV format
exportAllDataToCSV() {
    try {
        // Export daily data
        const dailyData = this.db.prepare(`
            SELECT date, day_name, 
                   slot_5_6_am, slot_6_7_am, slot_7_8_am, slot_8_9_am,
                   slot_9_10_am, slot_10_11_am, slot_11_12_am, slot_12_1_pm,
                   slot_1_2_pm, slot_2_3_pm, slot_3_4_pm, slot_4_5_pm,
                   slot_5_6_pm, slot_6_7_pm, slot_7_8_pm, slot_8_9_pm,
                   other_time, total_minutes, notes
            FROM daily_data 
            ORDER BY date DESC
        `).all();
        
        // Export weekly data
        const weeklyData = this.db.prepare(`
            SELECT week_number, year, date_range, total_minutes, 
                   total_hours_formatted, rank
            FROM weekly_data 
            ORDER BY year DESC, week_number DESC
        `).all();
        
        return {
            dailyData,
            weeklyData,
            exportDate: new Date().toISOString(),
            totalRecords: {
                daily: dailyData.length,
                weekly: weeklyData.length
            }
        };
    } catch (error) {
        console.error('Export error:', error);
        throw error;
    }
}

// Convert daily data to CSV string
dailyDataToCSV(dailyData) {
    if (!dailyData || dailyData.length === 0) {
        return 'No daily data to export';
    }
    
    // CSV headers matching your Google Sheets format
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
            `Week ${row.week_number}`,
            row.year,
            `"${row.date_range}"`,
            row.total_minutes,
            `"${row.total_hours_formatted}"`,
            row.rank || 'Unranked'
        ];
        csv += csvRow.join(',') + '\n';
    });
    
    return csv;
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
    
    // Prepare insert statement
    const insertStmt = this.db.prepare(`
        INSERT OR REPLACE INTO daily_data 
        (date, day_name, slot_5_6_am, slot_6_7_am, slot_7_8_am, slot_8_9_am,
         slot_9_10_am, slot_10_11_am, slot_11_12_am, slot_12_1_pm,
         slot_1_2_pm, slot_2_3_pm, slot_3_4_pm, slot_4_5_pm,
         slot_5_6_pm, slot_6_7_pm, slot_7_8_pm, slot_8_9_pm,
         other_time, total_minutes, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    for (let i = 1; i < lines.length; i++) {
        try {
            const values = this.parseCSVLine(lines[i]);
            if (values.length < 20) continue; // Skip incomplete rows
            
            // Calculate total minutes from hourly slots
            let totalMinutes = 0;
            for (let j = 2; j <= 18; j++) { // Skip date, day, and notes columns
                totalMinutes += parseInt(values[j]) || 0;
            }
            
            insertStmt.run(
                values[0], // date
                values[1], // day
                parseInt(values[2]) || 0,  // 5-6 AM
                parseInt(values[3]) || 0,  // 6-7 AM
                parseInt(values[4]) || 0,  // 7-8 AM
                parseInt(values[5]) || 0,  // 8-9 AM
                parseInt(values[6]) || 0,  // 9-10 AM
                parseInt(values[7]) || 0,  // 10-11 AM
                parseInt(values[8]) || 0,  // 11-12 PM
                parseInt(values[9]) || 0,  // 12-1 PM
                parseInt(values[10]) || 0, // 1-2 PM
                parseInt(values[11]) || 0, // 2-3 PM
                parseInt(values[12]) || 0, // 3-4 PM
                parseInt(values[13]) || 0, // 4-5 PM
                parseInt(values[14]) || 0, // 5-6 PM
                parseInt(values[15]) || 0, // 6-7 PM
                parseInt(values[16]) || 0, // 7-8 PM
                parseInt(values[17]) || 0, // 8-9 PM
                parseInt(values[18]) || 0, // Other
                totalMinutes,
                values[21] || '' // notes
            );
            
            importedCount++;
        } catch (error) {
            console.error(`Error importing row ${i}:`, error);
            errorCount++;
        }
    }
    
    // Recalculate weekly data after import
    this.recalculateAllWeeklyData();
    
    return {
        importedCount,
        errorCount,
        totalRows: lines.length - 1
    };
}

// Parse CSV line handling quotes and commas
parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    
    result.push(current.trim());
    return result;
}

// Recalculate all weekly data
recalculateAllWeeklyData() {
    // Get all unique weeks from daily data
    const weekQuery = this.db.prepare(`
        SELECT DISTINCT strftime('%Y', date) as year,
               strftime('%W', date) as week
        FROM daily_data
        ORDER BY year, week
    `);
    
    const weeks = weekQuery.all();
    
    weeks.forEach(week => {
        // Force update each week
        const tempDate = new Date(week.year, 0, 1 + (week.week * 7));
        this.updateWeeklyData(true); // Force ranking update
    });
}

// Save CSV to file
saveCSVToFile(csvData, filename) {
    const fs = require('fs');
    const path = require('path');
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
    const fs = require('fs');
    return fs.readFileSync(filePath, 'utf8');
}

    // Close database connection
    close() {
        this.db.close();
    }
}

module.exports = ProductivityDB;