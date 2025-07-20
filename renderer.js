// Global variables
let timerInterval = null;
let isRunning = false;
let startTime = null;
let elapsedTime = 0;
let currentHourSlot = null;

// DOM elements
const timerDisplay = document.getElementById('timerDisplay');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const stopBtn = document.getElementById('stopBtn');
const currentDate = document.getElementById('currentDate');
const todayTotal = document.getElementById('todayTotal');
const weekTotal = document.getElementById('weekTotal');

// IPC communication helper
const { ipcRenderer } = require('electron');

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    updateDateDisplay();
    updateStatsDisplay();
    setupEventListeners();
    setupRankingModal();
    setupEnhancedUI();
    setupDataManagement();
    setupPINProtection(); // ADD THIS LINE - was missing!
    determineCurrentHourSlot();
    
    // Update stats every minute
    setInterval(updateStatsDisplay, 60000);
});

function setupEventListeners() {
    startBtn.addEventListener('click', startTimer);
    pauseBtn.addEventListener('click', pauseTimer);
    stopBtn.addEventListener('click', stopTimer);
}

function updateDateDisplay() {
    const now = new Date();
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    currentDate.textContent = now.toLocaleDateString('en-US', options);
}

function determineCurrentHourSlot() {
    const now = new Date();
    const hour = now.getHours();
    
    // Map hours to database column names
    const hourSlotMap = {
        5: 'slot_5_6_am',
        6: 'slot_6_7_am',
        7: 'slot_7_8_am',
        8: 'slot_8_9_am',
        9: 'slot_9_10_am',
        10: 'slot_10_11_am',
        11: 'slot_11_12_am',
        12: 'slot_12_1_pm',
        13: 'slot_1_2_pm',
        14: 'slot_2_3_pm',
        15: 'slot_3_4_pm',
        16: 'slot_4_5_pm',
        17: 'slot_5_6_pm',
        18: 'slot_6_7_pm',
        19: 'slot_7_8_pm',
        20: 'slot_8_9_pm'
    };
    
    currentHourSlot = hourSlotMap[hour] || 'other_time';
    console.log(`Current hour slot: ${currentHourSlot} (Hour: ${hour})`);
}

async function startTimer() {
    if (!isRunning) {
        startTime = Date.now() - elapsedTime;
        timerInterval = setInterval(updateTimerDisplay, 1000);
        isRunning = true;
        
        // Update button states
        startBtn.disabled = true;
        pauseBtn.disabled = false;
        stopBtn.disabled = false;
        
        console.log('Timer started');
    }
}

async function pauseTimer() {
    if (isRunning) {
        clearInterval(timerInterval);
        isRunning = false;
        
        // Update button states
        startBtn.disabled = false;
        pauseBtn.disabled = true;
        stopBtn.disabled = false;
        
        console.log('Timer paused');
    }
}

async function stopTimer() {
    await stopTimerEnhanced();
}

function updateTimerDisplay() {
    if (isRunning) {
        elapsedTime = Date.now() - startTime;
    }
    
    const totalSeconds = Math.floor(elapsedTime / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    timerDisplay.textContent = timeString;
}

async function updateStatsDisplay() {
    try {
        // Get today's data
        const todayData = await ipcRenderer.invoke('get-today-data');
        const todayMinutes = todayData ? todayData.total_minutes : 0;
        
        // Get current week data
        const weekData = await ipcRenderer.invoke('get-current-week-data');
        const weekMinutes = weekData ? weekData.total_minutes : 0;
        
        // Update display
        todayTotal.textContent = formatTime(todayMinutes);
        weekTotal.textContent = formatTime(weekMinutes);
        
    } catch (error) {
        console.error('Error updating stats:', error);
        todayTotal.textContent = 'Error';
        weekTotal.textContent = 'Error';
    }

    // Update main slots display
updateMainSlotsDisplay();

}

// Format time for display
function formatTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}H ${mins}M`;
}

// Update hour slot when hour changes
setInterval(() => {
    const previousSlot = currentHourSlot;
    determineCurrentHourSlot();
    
    if (previousSlot !== currentHourSlot) {
        console.log(`Hour changed! New slot: ${currentHourSlot}`);
        // If timer is running, we might want to handle hour transition
        // For now, just log it
    }
}, 60000); // Check every minute

// Alarm system
let isAlarmDialogOpen = false;

// Listen for alarm triggers from main process
ipcRenderer.on('show-alarm-dialog', (event, timeString) => {
  if (!isAlarmDialogOpen) {
    showAlarmDialog(timeString);
  }
});

function showAlarmDialog(timeString) {
  isAlarmDialogOpen = true;
  
  // Create alarm dialog overlay
  const overlay = document.createElement('div');
  overlay.className = 'alarm-overlay';
  overlay.innerHTML = `
    <div class="alarm-dialog">
      <div class="alarm-icon">⏰</div>
      <h2>Hourly Check-in</h2>
      <p>Time: ${timeString}</p>
      <p>How was your productivity this hour?</p>
      <div class="alarm-actions">
        <button id="alarmOkBtn" class="btn btn-primary">OK - Recorded</button>
        <button id="alarmSnoozeBtn" class="btn btn-secondary">Snooze 5min</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // Play alarm sound (we'll use a simple beep for now)
  playAlarmSound();
  
  // Handle OK button
  document.getElementById('alarmOkBtn').addEventListener('click', () => {
    closeAlarmDialog(overlay, timeString);
  });
  
  // Handle Snooze button
  document.getElementById('alarmSnoozeBtn').addEventListener('click', () => {
    closeAlarmDialog(overlay, timeString);
    // Schedule snooze (5 minutes)
    setTimeout(() => {
      if (!isAlarmDialogOpen) {
        showAlarmDialog(timeString + ' (Snoozed)');
      }
    }, 5 * 60 * 1000); // 5 minutes
  });
  
  // Auto-close after 30 seconds if no interaction
  setTimeout(() => {
    if (document.body.contains(overlay)) {
      closeAlarmDialog(overlay, timeString);
    }
  }, 30000);
}

function closeAlarmDialog(overlay, timeString) {
  isAlarmDialogOpen = false;
  document.body.removeChild(overlay);
  
  // Notify main process that alarm was acknowledged
  ipcRenderer.invoke('alarm-acknowledged', timeString);
  
  // Update stats display
  updateStatsDisplay();
}

function playAlarmSound() {
  // Create a simple beep sound using Web Audio API
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 1);
  } catch (error) {
    console.log('Could not play alarm sound:', error);
  }
}

// Weekly ranking functionality
async function updateWeeklyRanking() {
    try {
        // Update weekly data in database
        await ipcRenderer.invoke('update-weekly-data');
        
        // Get current week rank
        const currentWeekRank = await ipcRenderer.invoke('get-current-week-rank');
        const weekStats = await ipcRenderer.invoke('get-week-stats');
        
        // Update week total display with rank
        if (currentWeekRank && weekStats) {
            const rankText = currentWeekRank.rank ? `#${currentWeekRank.rank}` : '#1';
            const totalWeeks = weekStats.totalWeeks || 1;
            weekTotal.textContent = `${currentWeekRank.total_hours_formatted || '0H 0M'} (Rank ${rankText}/${totalWeeks})`;
        }
        
        console.log('📊 Weekly ranking updated');
    } catch (error) {
        console.error('Error updating weekly ranking:', error);
    }
}

// Call weekly ranking update whenever stats are updated
const originalUpdateStatsDisplay = updateStatsDisplay;
updateStatsDisplay = async function() {
    await originalUpdateStatsDisplay();
    await updateWeeklyRanking();
};

// Modal functionality
function setupRankingModal() {
    const showRankingBtn = document.getElementById('showRankingBtn');
    const rankingModal = document.getElementById('rankingModal');
    const closeRankingBtn = document.getElementById('closeRankingBtn');
    
    showRankingBtn.addEventListener('click', async () => {
        await showWeeklyRanking();
    });
    
    closeRankingBtn.addEventListener('click', () => {
        rankingModal.style.display = 'none';
    });
    
    // Close modal when clicking outside
    rankingModal.addEventListener('click', (e) => {
        if (e.target === rankingModal) {
            rankingModal.style.display = 'none';
        }
    });
}

async function showWeeklyRanking() {
    try {
        const rankingModal = document.getElementById('rankingModal');
        
        // Get week stats
        const weekStats = await ipcRenderer.invoke('get-week-stats');
        const currentWeekRank = await ipcRenderer.invoke('get-current-week-rank');
        
        // Update stats display
        document.getElementById('currentRank').textContent = currentWeekRank?.rank ? `#${currentWeekRank.rank}` : 'Unranked';
        document.getElementById('totalWeeks').textContent = weekStats.totalWeeks;
        document.getElementById('averageWeek').textContent = weekStats.averageFormatted;
        
        // Show modal
        rankingModal.style.display = 'flex';
        
        // Load chart after modal is visible
        setTimeout(() => {
            loadWeeklyChart();
        }, 100);
        
        console.log('Weekly ranking modal opened with chart');
        
    } catch (error) {
        console.error('Error showing weekly ranking:', error);
    }
}

// Chart functionality
let weeklyChart = null;

async function loadWeeklyChart() {
    try {
        // Get weekly ranking data
        const weeklyData = await ipcRenderer.invoke('get-weekly-ranking-data', 15);
        
        if (!weeklyData || weeklyData.length === 0) {
            showNoDataMessage();
            return;
        }
        
        // Prepare chart data
        const chartData = prepareChartData(weeklyData);
        
        // Create or update chart
        createWeeklyChart(chartData);
        
    } catch (error) {
        console.error('Error loading weekly chart:', error);
        showChartError();
    }
}

function prepareChartData(weeklyData) {
    // Sort data by week (oldest first for chronological display)
    const sortedData = weeklyData.reverse();
    
    const labels = sortedData.map(week => {
        return `Week ${week.week_number}`;
    });
    
    const hours = sortedData.map(week => {
        return Math.round(week.total_minutes / 60 * 100) / 100; // Convert to hours with 2 decimal places
    });
    
    const ranks = sortedData.map(week => week.rank);
    
    // Create colors based on performance (green for good weeks, red for poor weeks)
    const backgroundColors = hours.map(hour => {
        if (hour >= 40) return 'rgba(46, 204, 113, 0.8)'; // Green for 40+ hours
        if (hour >= 30) return 'rgba(52, 152, 219, 0.8)'; // Blue for 30-40 hours
        if (hour >= 20) return 'rgba(241, 196, 15, 0.8)'; // Yellow for 20-30 hours
        if (hour >= 10) return 'rgba(230, 126, 34, 0.8)'; // Orange for 10-20 hours
        return 'rgba(231, 76, 60, 0.8)'; // Red for <10 hours
    });
    
    const borderColors = backgroundColors.map(color => color.replace('0.8', '1'));
    
    return {
        labels,
        hours,
        ranks,
        backgroundColors,
        borderColors
    };
}

function createWeeklyChart(chartData) {
    const ctx = document.getElementById('weeklyChart');
    
    // Destroy existing chart if it exists
    if (weeklyChart) {
        weeklyChart.destroy();
    }
    
    weeklyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: chartData.labels,
            datasets: [{
                label: 'Hours Worked',
                data: chartData.hours,
                backgroundColor: chartData.backgroundColors,
                borderColor: chartData.borderColors,
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Weekly Productivity Trend',
                    font: {
                        size: 16,
                        weight: 'bold'
                    },
                    color: '#2c3e50'
                },
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const weekIndex = context.dataIndex;
                            const hours = context.parsed.y;
                            const rank = chartData.ranks[weekIndex];
                            return [
                                `Hours: ${hours}H`,
                                `Rank: #${rank}`,
                                getPerformanceComment(hours)
                            ];
                        }
                    },
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    titleColor: 'white',
                    bodyColor: 'white',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Hours',
                        font: {
                            weight: 'bold'
                        }
                    },
                    grid: {
                        color: 'rgba(0,0,0,0.1)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Weeks',
                        font: {
                            weight: 'bold'
                        }
                    },
                    grid: {
                        display: false
                    }
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeInOutQuart'
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
}

function getPerformanceComment(hours) {
    if (hours >= 45) return "🔥 Outstanding week!";
    if (hours >= 40) return "⭐ Excellent productivity!";
    if (hours >= 35) return "👍 Great work!";
    if (hours >= 30) return "✅ Good progress";
    if (hours >= 20) return "📈 Room for improvement";
    if (hours >= 10) return "⚠️ Below target";
    return "❌ Needs attention";
}

function showNoDataMessage() {
    const chartContainer = document.querySelector('.ranking-chart');
    chartContainer.innerHTML = `
        <div class="no-data-message">
            <div class="no-data-icon">📊</div>
            <h3>No Data Yet</h3>
            <p>Start tracking your productivity to see your weekly ranking chart!</p>
        </div>
    `;
}

function showChartError() {
    const chartContainer = document.querySelector('.ranking-chart');
    chartContainer.innerHTML = `
        <div class="chart-error">
            <div class="error-icon">⚠️</div>
            <h3>Chart Error</h3>
            <p>Unable to load chart data. Please try again.</p>
        </div>
    `;
}

// Enhanced UI functionality
let currentSlotUpdateInterval = null;

function setupEnhancedUI() {
    // Setup today's slots modal
    const showTodayBtn = document.getElementById('showTodayBtn');
    const todayModal = document.getElementById('todayModal');
    const closeTodayBtn = document.getElementById('closeTodayBtn');
    
    showTodayBtn.addEventListener('click', showTodaySlots);
    closeTodayBtn.addEventListener('click', () => {
        todayModal.style.display = 'none';
    });
    
    // Close modal when clicking outside
    todayModal.addEventListener('click', (e) => {
        if (e.target === todayModal) {
            todayModal.style.display = 'none';
        }
    });
    
    // Update current slot display
    updateCurrentSlot();
    currentSlotUpdateInterval = setInterval(updateCurrentSlot, 30000); // Update every 30 seconds
    
    // Update week label with week number
    updateWeekLabel();

    // Setup settings modal
const showSettingsBtn = document.getElementById('showSettingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');

showSettingsBtn.addEventListener('click', showSettingsModal);
closeSettingsBtn.addEventListener('click', () => {
    settingsModal.style.display = 'none';
});

// Close modal when clicking outside
settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
        settingsModal.style.display = 'none';
    }
});
}

async function updateCurrentSlot() {
    try {
        const currentSlot = await ipcRenderer.invoke('get-current-time-slot');
        document.getElementById('currentSlot').textContent = currentSlot;
    } catch (error) {
        console.error('Error updating current slot:', error);
    }
}

async function updateWeekLabel() {
    try {
        const now = new Date();
        const weekNumber = getWeekNumber(now);
        document.getElementById('weekLabel').textContent = `This Week (${weekNumber}):`;
    } catch (error) {
        console.error('Error updating week label:', error);
    }
}

function getWeekNumber(date) {
    const d = new Date(date);
    const dayNum = d.getDay() || 7;
    d.setDate(d.getDate() + 4 - dayNum);
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const yearFirstThursday = new Date(yearStart);
    const yearFirstThursdayDayNum = yearFirstThursday.getDay() || 7;
    yearFirstThursday.setDate(yearFirstThursday.getDate() + 4 - yearFirstThursdayDayNum);
    return Math.ceil((((d - yearFirstThursday) / 86400000) + 1) / 7);
}

async function showTodaySlots() {
    try {
        const todayModal = document.getElementById('todayModal');
        
        // Get today's data
        const currentSlot = await ipcRenderer.invoke('get-current-time-slot');
        const todayData = await ipcRenderer.invoke('get-today-data');
        const hourlyBreakdown = await ipcRenderer.invoke('get-today-hourly-breakdown');
        
        // Update modal content
        document.getElementById('modalCurrentSlot').textContent = currentSlot;
        document.getElementById('modalTodayTotal').textContent = formatTime(todayData?.total_minutes || 0);
        
        // Load existing notes
        const notesTextarea = document.getElementById('todayNotes');
        notesTextarea.value = todayData?.notes || '';
        
        // Setup notes save button
        setupNotesSaving();
        
        // Populate slots grid
        populateSlotsGrid(hourlyBreakdown);
        
        // Show modal
        todayModal.style.display = 'flex';
        
    } catch (error) {
        console.error('Error showing today slots:', error);
    }
}

function setupNotesSaving() {
    const saveNotesBtn = document.getElementById('saveNotesBtn');
    const notesTextarea = document.getElementById('todayNotes');
    
    // Remove existing listeners
    saveNotesBtn.replaceWith(saveNotesBtn.cloneNode(true));
    const newSaveBtn = document.getElementById('saveNotesBtn');
    
    newSaveBtn.addEventListener('click', async () => {
        try {
            const notes = notesTextarea.value.trim();
            
            // Save notes to database
            await ipcRenderer.invoke('update-today-notes', notes);
            
            // Visual feedback
            newSaveBtn.textContent = '✅ Saved!';
            newSaveBtn.classList.add('notes-saved');
            
            setTimeout(() => {
                newSaveBtn.textContent = '💾 Save Notes';
                newSaveBtn.classList.remove('notes-saved');
            }, 2000);
            
            console.log('📝 Notes saved successfully');
            
        } catch (error) {
            console.error('Error saving notes:', error);
            showNotification('Error', 'Failed to save notes', 'error');
        }
    });
}

function populateSlotsGrid(hourlyBreakdown) {
    const slotsGrid = document.getElementById('slotsGrid');
    
    if (!hourlyBreakdown || hourlyBreakdown.length === 0) {
        slotsGrid.innerHTML = `
            <div class="no-slots-message">
                <p>No recorded time slots for today yet.</p>
                <p>Start your timer to begin tracking!</p>
                <button id="addManualEntryBtn" class="btn btn-manual">➕ Add Manual Entry</button>
            </div>
        `;
        
        // Setup manual entry button
        document.getElementById('addManualEntryBtn').addEventListener('click', showManualEntryDialog);
        return;
    }
    
    slotsGrid.innerHTML = hourlyBreakdown.map(slot => `
        <div class="slot-card" data-slot="${slot.field}">
            <div class="slot-name">${slot.name}</div>
            <div class="slot-duration" onclick="editSlotTime('${slot.field}', ${slot.minutes}, '${slot.name}')">${formatTime(slot.minutes)}</div>
            <div class="slot-progress">
                <div class="progress-bar" style="width: ${Math.min((slot.minutes / 60) * 100, 100)}%"></div>
            </div>
            <button class="edit-slot-btn" onclick="editSlotTime('${slot.field}', ${slot.minutes}, '${slot.name}')">✏️</button>
        </div>
    `).join('') + `
        <div class="slot-card add-entry-card">
            <button id="addManualEntryBtn" class="btn btn-manual">➕ Add Manual Entry</button>
        </div>
    `;
    
    // Setup manual entry button
    document.getElementById('addManualEntryBtn').addEventListener('click', showManualEntryDialog);
}

async function editSlotTime(slotField, currentMinutes, slotName) {
    const newMinutes = prompt(
        `Edit time for ${slotName}\n\nCurrent: ${formatTime(currentMinutes)}\n\nEnter new duration in minutes:`,
        currentMinutes.toString()
    );
    
    if (newMinutes === null) return; // User cancelled
    
    const minutes = parseInt(newMinutes);
    if (isNaN(minutes) || minutes < 0) {
        showNotification('Invalid Input', 'Please enter a valid number of minutes', 'error');
        return;
    }
    
    try {
        // Get current data
        const todayData = await ipcRenderer.invoke('get-today-data');
        const oldMinutes = currentMinutes;
        const difference = minutes - oldMinutes;
        
        // Update the specific slot
        await ipcRenderer.invoke('update-slot-time', slotField, minutes);
        
        // Refresh the display
        const hourlyBreakdown = await ipcRenderer.invoke('get-today-hourly-breakdown');
        populateSlotsGrid(hourlyBreakdown);
        
        // Update stats
        updateStatsDisplay();
        
        showNotification('Time Updated!', 
            `${slotName}: ${formatTime(oldMinutes)} → ${formatTime(minutes)}\nDifference: ${difference > 0 ? '+' : ''}${difference} minutes`, 
            'success'
        );
        
    } catch (error) {
        console.error('Error updating slot time:', error);
        showNotification('Error', 'Failed to update time', 'error');
    }
}

async function showManualEntryDialog() {
    // Create time slots array for selection
    const timeSlots = [
        { value: 'slot_5_6_am', label: '5-6 AM' },
        { value: 'slot_6_7_am', label: '6-7 AM' },
        { value: 'slot_7_8_am', label: '7-8 AM' },
        { value: 'slot_8_9_am', label: '8-9 AM' },
        { value: 'slot_9_10_am', label: '9-10 AM' },
        { value: 'slot_10_11_am', label: '10-11 AM' },
        { value: 'slot_11_12_am', label: '11-12 PM' },
        { value: 'slot_12_1_pm', label: '12-1 PM' },
        { value: 'slot_1_2_pm', label: '1-2 PM' },
        { value: 'slot_2_3_pm', label: '2-3 PM' },
        { value: 'slot_3_4_pm', label: '3-4 PM' },
        { value: 'slot_4_5_pm', label: '4-5 PM' },
        { value: 'slot_5_6_pm', label: '5-6 PM' },
        { value: 'slot_6_7_pm', label: '6-7 PM' },
        { value: 'slot_7_8_pm', label: '7-8 PM' },
        { value: 'slot_8_9_pm', label: '8-9 PM' },
        { value: 'other_time', label: 'Other Time' }
    ];
    
    // Create selection dialog
    const slotOptions = timeSlots.map((slot, index) => `${index + 1}. ${slot.label}`).join('\n');
    
    const slotChoice = prompt(
        `Select time slot:\n\n${slotOptions}\n\nEnter slot number (1-${timeSlots.length}):`
    );
    
    if (slotChoice === null) return;
    
    const slotIndex = parseInt(slotChoice) - 1;
    if (isNaN(slotIndex) || slotIndex < 0 || slotIndex >= timeSlots.length) {
        showNotification('Invalid Selection', 'Please enter a valid slot number', 'error');
        return;
    }
    
    const selectedSlot = timeSlots[slotIndex];
    
    const minutes = prompt(
        `Add time to ${selectedSlot.label}\n\nEnter minutes to add:`,
        '30'
    );
    
    if (minutes === null) return;
    
    const addMinutes = parseInt(minutes);
    if (isNaN(addMinutes) || addMinutes <= 0) {
        showNotification('Invalid Input', 'Please enter a valid number of minutes', 'error');
        return;
    }
    
    try {
        // Add time to the selected slot
        await ipcRenderer.invoke('add-time-to-slot', selectedSlot.value, addMinutes);
        
        // Refresh the display
        const hourlyBreakdown = await ipcRenderer.invoke('get-today-hourly-breakdown');
        populateSlotsGrid(hourlyBreakdown);
        
        // Update stats
        updateStatsDisplay();
        
        showNotification('Time Added!', 
            `Added ${addMinutes} minutes to ${selectedSlot.label}`, 
            'success'
        );
        
    } catch (error) {
        console.error('Error adding manual time:', error);
        showNotification('Error', 'Failed to add time', 'error');
    }
}

// Data Management functionality
function setupDataManagement() {
    const exportBtn = document.getElementById('exportBtn');
    const importBtn = document.getElementById('importBtn');
    const backupBtn = document.getElementById('backupBtn');
    
    exportBtn.addEventListener('click', exportData);
    importBtn.addEventListener('click', importData);
    backupBtn.addEventListener('click', createBackup);
    
    // Update data statistics
    updateDataStatistics();
}

async function exportData() {
    try {
        exportBtn.disabled = true;
        exportBtn.textContent = '📤 Exporting...';
        
        const result = await ipcRenderer.invoke('export-all-data');
        
        if (result.success) {
            showNotification('Success!', 
                `Data exported successfully!\n\nDaily Data: ${result.files.daily}\nWeekly Data: ${result.files.weekly}\n\nTotal Records: ${result.data.daily} days, ${result.data.weekly} weeks`, 
                'success'
            );
        } else {
            showNotification('Export Failed', `Error: ${result.error}`, 'error');
        }
    } catch (error) {
        console.error('Export error:', error);
        showNotification('Export Failed', `Unexpected error: ${error.message}`, 'error');
    } finally {
        exportBtn.disabled = false;
        exportBtn.textContent = '📤 Export Data';
    }
}

async function importData() {
    try {
        // Show file dialog to select CSV
        const result = await ipcRenderer.invoke('show-file-dialog', {
            title: 'Select Daily Data CSV File',
            filters: [
                { name: 'CSV Files', extensions: ['csv'] },
                { name: 'All Files', extensions: ['*'] }
            ],
            properties: ['openFile']
        });
        
        if (result.canceled || !result.filePaths.length) {
            return;
        }
        
        const filePath = result.filePaths[0];
        
        importBtn.disabled = true;
        importBtn.textContent = '📥 Importing...';
        
        const importResult = await ipcRenderer.invoke('import-daily-data', filePath);
        
        if (importResult.success) {
            showNotification('Import Successful!', 
                `Imported ${importResult.importedCount} records successfully!\n\nErrors: ${importResult.errorCount}\nTotal processed: ${importResult.totalRows}`, 
                'success'
            );
            
            // Refresh all displays
            updateStatsDisplay();
            updateDataStatistics();
        } else {
            showNotification('Import Failed', `Error: ${importResult.error}`, 'error');
        }
    } catch (error) {
        console.error('Import error:', error);
        showNotification('Import Failed', `Unexpected error: ${error.message}`, 'error');
    } finally {
        importBtn.disabled = false;
        importBtn.textContent = '📥 Import Data';
    }
}

async function createBackup() {
    try {
        backupBtn.disabled = true;
        backupBtn.textContent = '💾 Creating...';
        
        const result = await ipcRenderer.invoke('export-all-data');
        
        if (result.success) {
            showNotification('Backup Created!', 
                `Backup files created in your Documents folder:\n\n📁 Productivity Timer Exports\n\nFiles:\n• ${result.files.daily.split('\\').pop()}\n• ${result.files.weekly.split('\\').pop()}`, 
                'success'
            );
        } else {
            showNotification('Backup Failed', `Error: ${result.error}`, 'error');
        }
    } catch (error) {
        console.error('Backup error:', error);
        showNotification('Backup Failed', `Unexpected error: ${error.message}`, 'error');
    } finally {
        backupBtn.disabled = false;
        backupBtn.textContent = '💾 Backup';
    }
}

async function updateDataStatistics() {
    try {
        const todayData = await ipcRenderer.invoke('get-today-data');
        const weeklyData = await ipcRenderer.invoke('get-weekly-ranking-data', 100); // Get all weeks
        
        // Calculate total days with data
        const totalDays = weeklyData ? weeklyData.reduce((sum, week) => {
            // Estimate days per week (rough calculation)
            return sum + Math.min(7, Math.ceil(week.total_minutes / 60 / 8)); // 8 hours per day estimate
        }, 0) : 0;
        
        // Calculate total hours
        const totalMinutes = weeklyData ? weeklyData.reduce((sum, week) => sum + week.total_minutes, 0) : 0;
        
        document.getElementById('totalDays').textContent = totalDays;
        document.getElementById('totalHours').textContent = formatTime(totalMinutes);
        
    } catch (error) {
        console.error('Error updating data statistics:', error);
        document.getElementById('totalDays').textContent = 'Error';
        document.getElementById('totalHours').textContent = 'Error';
    }
}

// Enhanced notification system
function showNotification(title, message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <div class="notification-header">
                <span class="notification-icon">${getNotificationIcon(type)}</span>
                <span class="notification-title">${title}</span>
                <button class="notification-close">&times;</button>
            </div>
            <div class="notification-message">${message.replace(/\n/g, '<br>')}</div>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Close button functionality
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
        notification.remove();
    });
    
    // Auto-remove after 8 seconds for success, 15 for errors
    const autoRemoveTime = type === 'success' ? 8000 : 15000;
    setTimeout(() => {
        if (document.body.contains(notification)) {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }
    }, autoRemoveTime);
    
    // Animate in
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(0)';
    }, 100);
}

function getNotificationIcon(type) {
    switch (type) {
        case 'success': return '✅';
        case 'error': return '❌';
        case 'warning': return '⚠️';
        default: return 'ℹ️';
    }
}

// Enhanced alarm handling with auto-recording
ipcRenderer.on('show-alarm-dialog', async (event, timeString) => {
    if (!isAlarmDialogOpen) {
        await handleHourlyTransition(timeString);
        showAlarmDialog(timeString);
    }
});

async function handleHourlyTransition(alarmTimeString) {
    console.log(`🔄 Hourly transition triggered at ${alarmTimeString}`);
    
    // If timer is running, we need to save the current session and reset
    if (isRunning && elapsedTime > 0) {
        const currentSessionMinutes = Math.floor(elapsedTime / (1000 * 60));
        
        if (currentSessionMinutes > 0) {
            try {
                // Save current session to the PREVIOUS hour slot
                await ipcRenderer.invoke('add-time-to-slot', currentHourSlot, currentSessionMinutes);
                console.log(`💾 Auto-saved ${currentSessionMinutes} minutes to ${currentHourSlot}`);
                
                // Reset timer for new hour
                elapsedTime = 0;
                startTime = Date.now(); // Reset start time for new hour
                
                // Update to new hour slot
                const previousSlot = currentHourSlot;
                determineCurrentHourSlot();
                
                console.log(`🕐 Switched from ${previousSlot} to ${currentHourSlot}`);
                
                // Update displays
                updateStatsDisplay();
                updateCurrentSlot();
                
            } catch (error) {
                console.error('Error during hourly transition:', error);
            }
        }
    } else {
        // Timer not running, just update current slot
        determineCurrentHourSlot();
        updateCurrentSlot();
    }
}

// Enhanced stop timer with better slot handling
async function stopTimerEnhanced() {
    if (isRunning || elapsedTime > 0) {
        clearInterval(timerInterval);
        isRunning = false;
        
        // Save the elapsed time to database if there was any
        if (elapsedTime > 0) {
            const minutes = Math.floor(elapsedTime / (1000 * 60));
            if (minutes > 0) {
                try {
                    await ipcRenderer.invoke('add-time-to-slot', currentHourSlot, minutes);
                    console.log(`💾 Manual save: ${minutes} minutes to ${currentHourSlot}`);
                    
                    // Update stats display
                    updateStatsDisplay();
                } catch (error) {
                    console.error('Error saving time:', error);
                }
            }
        }
        
        elapsedTime = 0;
        
        // Update button states
        startBtn.disabled = false;
        pauseBtn.disabled = true;
        stopBtn.disabled = true;
        
        // Reset display
        timerDisplay.textContent = '00:00:00';
        
        console.log('⏹️ Timer stopped and data saved');
    }
}

// PIN Protection functionality
function setupPINProtection() {
    const pinModal = document.getElementById('pinModal');
    const pinInput = document.getElementById('pinInput');
    const pinSubmitBtn = document.getElementById('pinSubmitBtn');
    const pinCancelBtn = document.getElementById('pinCancelBtn');
    const pinError = document.getElementById('pinError');
    
    if (!pinModal || !pinInput || !pinSubmitBtn || !pinCancelBtn || !pinError) {
        console.error('❌ PIN modal elements not found in DOM');
        return;
    }
    
    pinSubmitBtn.addEventListener('click', validatePIN);
    pinCancelBtn.addEventListener('click', () => {
        pinModal.style.display = 'none';
        pinInput.value = '';
        pinError.style.display = 'none';
    });
    
    // Enter key to submit PIN
    pinInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            validatePIN();
        }
    });
    
    // Auto-focus and clear error on input
    pinInput.addEventListener('input', () => {
        pinError.style.display = 'none';
    });
    
    console.log('✅ PIN protection setup complete');
}

async function showPINDialog() {
    const pinModal = document.getElementById('pinModal');
    const pinInput = document.getElementById('pinInput');
    
    if (!pinModal || !pinInput) {
        console.error('❌ PIN modal elements not found');
        return;
    }
    
    console.log('🔐 Showing PIN dialog');
    pinModal.style.display = 'flex';
    setTimeout(() => {
        pinInput.focus();
    }, 100);
}

async function validatePIN() {
    const pinInput = document.getElementById('pinInput');
    const pinError = document.getElementById('pinError');
    const enteredPIN = pinInput.value.trim();
    
    console.log(`🔐 Attempting to validate PIN: ${enteredPIN}`);
    
    if (enteredPIN.length !== 4 || !/^\d{4}$/.test(enteredPIN)) {
        pinError.textContent = 'PIN must be 4 digits';
        pinError.style.display = 'block';
        pinInput.focus();
        return;
    }
    
    try {
        console.log('🔍 Validating PIN with main process...');
        const isPINValid = await ipcRenderer.invoke('validate-pin', enteredPIN);
        
        if (isPINValid) {
            // PIN correct - save data and close
            console.log('✅ PIN correct - preparing to close app');
            pinError.style.display = 'none';
            
            // Show closing message
            pinError.textContent = 'PIN correct! Closing app...';
            pinError.style.color = '#27ae60';
            pinError.style.display = 'block';
            
            await saveDataBeforeClose();
            await ipcRenderer.invoke('close-app-confirmed');
        } else {
            // PIN incorrect
            console.log('❌ PIN incorrect');
            pinError.textContent = 'Incorrect PIN. Try again.';
            pinError.style.color = '#e74c3c';
            pinError.style.display = 'block';
            pinInput.value = '';
            pinInput.focus();
        }
    } catch (error) {
        console.error('PIN validation error:', error);
        pinError.textContent = 'Error validating PIN. Please try again.';
        pinError.style.color = '#e74c3c';
        pinError.style.display = 'block';
    }
}

async function saveDataBeforeClose() {
    console.log('💾 Saving data before closing...');
    
    // Stop timer and save any running session
    if (isRunning) {
        await stopTimerEnhanced();
    }
    
    // Update weekly data one final time
    try {
        await ipcRenderer.invoke('update-weekly-data');
        console.log('📊 Weekly data updated before close');
    } catch (error) {
        console.error('Error updating weekly data before close:', error);
    }
    
    console.log('💾 Data saved before closing');
}

// Listen for close request from main process
ipcRenderer.on('request-pin-for-close', () => {
    console.log('🔐 Received PIN request from main process');
    showPINDialog();
});

// Enhanced hour transition detection
let lastCheckedHour = new Date().getHours();

setInterval(async () => {
    const currentHour = new Date().getHours();
    
    if (currentHour !== lastCheckedHour) {
        console.log(`🕐 Hour changed from ${lastCheckedHour} to ${currentHour}`);
        
        // If timer is running during hour change, handle transition
        if (isRunning) {
            const sessionMinutes = Math.floor(elapsedTime / (1000 * 60));
            if (sessionMinutes > 0) {
                // Save to previous hour slot
                await ipcRenderer.invoke('add-time-to-slot', currentHourSlot, sessionMinutes);
                console.log(`🔄 Auto-transition save: ${sessionMinutes} minutes to ${currentHourSlot}`);
                
                // Reset for new hour
                elapsedTime = 0;
                startTime = Date.now();
                
                // Update current slot
                determineCurrentHourSlot();
                updateCurrentSlot();
                updateStatsDisplay();
            }
        } else {
            // Just update slot if timer not running
            determineCurrentHourSlot();
            updateCurrentSlot();
        }
        
        lastCheckedHour = currentHour;
    }
}, 30000); // Check every 30 seconds

// Error handling for missing DOM elements
function checkDOMElements() {
    const requiredElements = [
        'timerDisplay', 'startBtn', 'pauseBtn', 'stopBtn',
        'currentDate', 'todayTotal', 'weekTotal', 'currentSlot',
        'pinModal', 'pinInput', 'pinSubmitBtn', 'pinCancelBtn', 'pinError'
    ];
    
    const missingElements = requiredElements.filter(id => !document.getElementById(id));
    
    if (missingElements.length > 0) {
        console.error('❌ Missing DOM elements:', missingElements);
        return false;
    }
    
    console.log('✅ All required DOM elements found');
    return true;
}

// Add DOM check to initialization
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM Content Loaded - Initializing app...');
    
    if (!checkDOMElements()) {
        console.error('❌ Cannot initialize app - missing DOM elements');
        return;
    }
    
    updateDateDisplay();
    updateStatsDisplay();
    setupEventListeners();
    setupRankingModal();
    setupEnhancedUI();
    setupDataManagement();
    setupPINProtection(); // This was the missing line!
    determineCurrentHourSlot();
    
    // Update stats every minute
    setInterval(updateStatsDisplay, 60000);
    
    console.log('✅ App initialization complete');
});

async function showSettingsModal() {
    try {
        const settingsModal = document.getElementById('settingsModal');
        
        // Update data statistics
        await updateDataStatistics();
        
        // Setup data management buttons (move from old location)
        setupDataManagementInSettings();
        
        // Setup PIN change functionality
        setupPINChange();
        
        // Show modal
        settingsModal.style.display = 'flex';
        
    } catch (error) {
        console.error('Error showing settings modal:', error);
    }
}

function setupDataManagementInSettings() {
    const exportBtn = document.getElementById('exportBtn');
    const importBtn = document.getElementById('importBtn');
    const backupBtn = document.getElementById('backupBtn');
    
    // Remove existing listeners and add new ones
    exportBtn.replaceWith(exportBtn.cloneNode(true));
    importBtn.replaceWith(importBtn.cloneNode(true));
    backupBtn.replaceWith(backupBtn.cloneNode(true));
    
    document.getElementById('exportBtn').addEventListener('click', exportData);
    document.getElementById('importBtn').addEventListener('click', importData);
    document.getElementById('backupBtn').addEventListener('click', createBackup);
}

function setupPINChange() {
    const changePinBtn = document.getElementById('changePinBtn');
    const newPinInput = document.getElementById('newPin');
    
    changePinBtn.addEventListener('click', async () => {
        const newPin = newPinInput.value.trim();
        
        if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
            showNotification('Invalid PIN', 'PIN must be exactly 4 digits', 'error');
            return;
        }
        
        try {
            await ipcRenderer.invoke('update-setting', 'app_pin', newPin);
            
            showNotification('PIN Updated!', 'Your app PIN has been changed successfully', 'success');
            newPinInput.value = '';
            
        } catch (error) {
            console.error('Error updating PIN:', error);
            showNotification('Error', 'Failed to update PIN', 'error');
        }
    });
    
    // Enter key support
    newPinInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            changePinBtn.click();
        }
    });
}

async function updateMainSlotsDisplay() {
    try {
        const hourlyBreakdown = await ipcRenderer.invoke('get-today-hourly-breakdown');
        const mainSlotsContainer = document.getElementById('mainSlotsContainer');
        
        if (!hourlyBreakdown || hourlyBreakdown.length === 0) {
            mainSlotsContainer.innerHTML = `
                <div class="no-slots-today">
                    <p>No time recorded yet today</p>
                </div>
            `;
            return;
        }
        
        // Sort slots in chronological order
        const sortedSlots = hourlyBreakdown.sort((a, b) => {
            const orderMap = {
                'slot_5_6_am': 1, 'slot_6_7_am': 2, 'slot_7_8_am': 3, 'slot_8_9_am': 4,
                'slot_9_10_am': 5, 'slot_10_11_am': 6, 'slot_11_12_am': 7, 'slot_12_1_pm': 8,
                'slot_1_2_pm': 9, 'slot_2_3_pm': 10, 'slot_3_4_pm': 11, 'slot_4_5_pm': 12,
                'slot_5_6_pm': 13, 'slot_6_7_pm': 14, 'slot_7_8_pm': 15, 'slot_8_9_pm': 16,
                'other_time': 17
            };
            return (orderMap[a.field] || 99) - (orderMap[b.field] || 99);
        });
        
        mainSlotsContainer.innerHTML = sortedSlots.map(slot => `
            <div class="main-slot-card" onclick="editSlotTime('${slot.field}', ${slot.minutes}, '${slot.name}')">
                <div class="main-slot-name">${slot.name}</div>
                <div class="main-slot-time">${formatTime(slot.minutes)}</div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error updating main slots display:', error);
    }
}