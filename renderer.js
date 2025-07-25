// Global variables
let timerInterval = null;
let isRunning = false;
let startTime = null;
let elapsedTime = 0;
let currentHourSlot = null;

// NEW: Enhanced session tracking
let currentSessionStartTime = null; // When current hour session started
let hourBoundaryMonitor = null; // For automatic hour boundary detection
let lastProcessedHour = new Date().getHours(); // Track processed hours

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

// Initialize app code deleted due to duplication


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
    if (isRunning && currentSessionStartTime) {
        // Calculate time since current session started (current hour only)
        const currentTime = Date.now();
        const sessionDuration = currentTime - currentSessionStartTime;
        
        const totalSeconds = Math.floor(sessionDuration / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        // Display only current hour progress (max 59:59)
        const displayHours = Math.min(hours, 0); // Always show 0 hours for hourly tracking
        const displayMinutes = Math.min(minutes, 59); // Max 59 minutes per hour
        
        const timeString = `${displayHours.toString().padStart(2, '0')}:${displayMinutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        timerDisplay.textContent = timeString;
    } else {
        timerDisplay.textContent = '00:00:00';
    }
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
// Update the existing alarm listener
// Listen for alarm triggers from main process
// Listen for alarm triggers from main process
ipcRenderer.on('show-alarm-dialog', async (event, timeString) => {
    // Just handle the alarm display - automatic splitting runs independently
    await handleHourlyTransition(timeString);
    
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

// Enhanced populateSlotsGrid function with better error handling
function populateSlotsGrid(hourlyBreakdown) {
    console.log('📊 Populating slots grid with data:', hourlyBreakdown);
    
    const slotsGrid = document.getElementById('slotsGrid');
    
    if (!slotsGrid) {
        console.error('❌ Slots grid element not found');
        return;
    }
    
    if (!hourlyBreakdown || hourlyBreakdown.length === 0) {
        slotsGrid.innerHTML = `
            <div class="no-slots-message">
                <p>No recorded time slots for today yet.</p>
                <p>Start your timer to begin tracking!</p>
                <button id="addManualEntryBtn" class="btn btn-manual">➕ Add Manual Entry</button>
            </div>
        `;
        
        setupManualEntryButton();
        return;
    }
    
    // Sort slots chronologically
    const slotOrder = {
        'slot_5_6_am': 1, 'slot_6_7_am': 2, 'slot_7_8_am': 3, 'slot_8_9_am': 4,
        'slot_9_10_am': 5, 'slot_10_11_am': 6, 'slot_11_12_am': 7, 'slot_12_1_pm': 8,
        'slot_1_2_pm': 9, 'slot_2_3_pm': 10, 'slot_3_4_pm': 11, 'slot_4_5_pm': 12,
        'slot_5_6_pm': 13, 'slot_6_7_pm': 14, 'slot_7_8_pm': 15, 'slot_8_9_pm': 16,
        'other_time': 17
    };
    
    const sortedSlots = hourlyBreakdown.sort((a, b) => {
        return (slotOrder[a.field] || 99) - (slotOrder[b.field] || 99);
    });
    
    slotsGrid.innerHTML = sortedSlots.map((slot, index) => `
        <div class="slot-card" data-slot="${slot.field}">
            <div class="slot-name">${slot.name}</div>
            <div class="slot-duration slot-clickable" 
                 data-slot="${slot.field}" 
                 data-minutes="${slot.minutes}" 
                 data-name="${slot.name}"
                 title="Click to edit">${formatTime(slot.minutes)}</div>
            <div class="slot-progress">
                <div class="progress-bar" style="width: ${Math.min((slot.minutes / 60) * 100, 100)}%"></div>
            </div>
            <button class="edit-slot-btn" 
                    data-slot="${slot.field}" 
                    data-minutes="${slot.minutes}" 
                    data-name="${slot.name}"
                    title="Edit time">✏️</button>
        </div>
    `).join('') + `
        <div class="slot-card add-entry-card">
            <button id="addManualEntryBtn" class="btn btn-manual">➕ Add Manual Entry</button>
        </div>
    `;
    
    // Setup event listeners after DOM update
    setTimeout(() => {
        setupSlotEditListeners();
        setupManualEntryButton();
    }, 100);
    
    console.log('✅ Slots grid populated successfully');
}

// Fixed editSlotTime function with proper error handling
// Updated editSlotTime using custom prompt
window.editSlotTime = async function(slotField, currentMinutes, slotName) {
    console.log('🔧 editSlotTime called with:', { slotField, currentMinutes, slotName });
    
    try {
        const newMinutes = await customPrompt(
            `Edit time for ${slotName}\n\nCurrent: ${formatTime(currentMinutes)}\n\nEnter new duration in minutes:`,
            currentMinutes.toString()
        );
        
        console.log('User entered:', newMinutes);
        
        if (newMinutes === null || newMinutes === '') {
            console.log('User cancelled');
            return;
        }
        
        const minutes = parseInt(newMinutes);
        if (isNaN(minutes) || minutes < 0) {
            console.error('Invalid input:', newMinutes);
            await customPrompt('Please enter a valid number of minutes (0 or greater)', '');
            return;
        }
        
        console.log(`Updating ${slotField} to ${minutes} minutes`);
        
        // Update via IPC
        const result = await ipcRenderer.invoke('update-slot-time', slotField, minutes);
        console.log('IPC result:', result);
        
        // Refresh displays
        await updateStatsDisplay();
        await updateMainSlotsDisplay();
        
        // If today modal is open, refresh it
        const todayModal = document.getElementById('todayModal');
        if (todayModal && todayModal.style.display === 'flex') {
            const hourlyBreakdown = await ipcRenderer.invoke('get-today-hourly-breakdown');
            populateSlotsGrid(hourlyBreakdown);
        }
        
        console.log('✅ editSlotTime completed successfully');
        showNotification('Time Updated!', `${slotName}: ${formatTime(currentMinutes)} → ${formatTime(minutes)}`, 'success');
        
    } catch (error) {
        console.error('❌ Error in editSlotTime:', error);
        showNotification('Error', `Failed to update time: ${error.message}`, 'error');
    }
};

// Updated showManualEntryDialog using custom dialogs
window.showManualEntryDialog = async function() {
    console.log('📝 showManualEntryDialog called');
    
    try {
        // Show slot selection dialog
        const selectedSlot = await customSlotSelection();
        
        if (!selectedSlot) {
            console.log('User cancelled slot selection');
            return;
        }
        
        console.log('Selected slot:', selectedSlot);
        
        // Ask for minutes
        const minutes = await customPrompt(
            `⏱️ How many minutes would you like to add to ${selectedSlot.display}?\n\n(Time will be added to existing time for this slot)`,
            '30'
        );
        
        console.log('User entered minutes:', minutes);
        
        if (!minutes || minutes === '') {
            console.log('User cancelled minutes entry');
            return;
        }
        
        const addMinutes = parseInt(minutes);
        if (isNaN(addMinutes) || addMinutes <= 0) {
            console.error('Invalid minutes:', minutes);
            await customPrompt('Please enter a valid number of minutes (greater than 0)', '');
            return;
        }
        
        console.log(`Adding ${addMinutes} minutes to ${selectedSlot.field}`);
        
        // Add time via IPC
        const result = await ipcRenderer.invoke('add-time-to-slot', selectedSlot.field, addMinutes);
        console.log('IPC result:', result);
        
        // Refresh displays
        await updateStatsDisplay();
        await updateMainSlotsDisplay();
        
        // If today modal is open, refresh it
        const todayModal = document.getElementById('todayModal');
        if (todayModal && todayModal.style.display === 'flex') {
            const hourlyBreakdown = await ipcRenderer.invoke('get-today-hourly-breakdown');
            populateSlotsGrid(hourlyBreakdown);
        }
        
        console.log('✅ showManualEntryDialog completed successfully');
        showNotification('Time Added!', `Added ${addMinutes} minutes to ${selectedSlot.display}`, 'success');
        
    } catch (error) {
        console.error('❌ Error in showManualEntryDialog:', error);
        showNotification('Error', `Failed to add time: ${error.message}`, 'error');
    }
};

// Fixed slot edit listeners setup
function setupSlotEditListeners() {
    console.log('🔧 Setting up slot edit listeners');
    
    // Edit buttons
    document.querySelectorAll('.edit-slot-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const slotField = btn.getAttribute('data-slot');
            const minutes = parseInt(btn.getAttribute('data-minutes'));
            const slotName = btn.getAttribute('data-name');
            
            console.log(`Edit button clicked: ${slotField}, ${minutes}, ${slotName}`);
            editSlotTime(slotField, minutes, slotName);
        });
    });
    
    // Clickable durations
    document.querySelectorAll('.slot-clickable').forEach(duration => {
        duration.addEventListener('click', (e) => {
            const slotField = duration.getAttribute('data-slot');
            const minutes = parseInt(duration.getAttribute('data-minutes'));
            const slotName = duration.getAttribute('data-name');
            
            console.log(`Duration clicked: ${slotField}, ${minutes}, ${slotName}`);
            editSlotTime(slotField, minutes, slotName);
        });
    });
    
    console.log('✅ Slot edit listeners setup complete');
}

// Fixed manual entry button setup
function setupManualEntryButton() {
    console.log('🔧 Setting up manual entry button');
    
    const addBtn = document.getElementById('addManualEntryBtn');
    if (addBtn) {
        // Remove existing listeners and add new one
        addBtn.replaceWith(addBtn.cloneNode(true));
        const newAddBtn = document.getElementById('addManualEntryBtn');
        
        newAddBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Manual entry button clicked');
            showManualEntryDialog();
        });
        
        console.log('✅ Manual entry button setup complete');
    } else {
        // Don't log error, the button might not exist yet
        console.log('⏳ Manual entry button not found - will retry later');
        
        // Retry after a short delay
        setTimeout(setupManualEntryButton, 500);
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

async function handleHourlyTransition(alarmTimeString) {
    console.log(`⏰ Alarm triggered at ${alarmTimeString}`);
    
    // The automatic hour boundary processing handles the session splitting
    // This function now just logs the alarm - no session management needed
    // because processHourBoundary() handles it automatically
    
    console.log('ℹ️ Hour boundary handled automatically by background monitor');
}

// Enhanced alarm handling with auto-recording
ipcRenderer.on('show-alarm-dialog', async (event, timeString) => {
    if (!isAlarmDialogOpen) {
        await handleHourlyTransition(timeString);
        showAlarmDialog(timeString);
    }
});



// Hour boundary auto-splitting functionality

let hourBoundaryInterval = null;
let sessionStartTime = null;
let currentSessionSlot = null;

// Enhanced start timer with session tracking
// Enhanced startTimerEnhanced with better session tracking
async function startTimerEnhanced() {
    if (!isRunning) {
        // Start session for current hour
        currentSessionStartTime = Date.now();
        determineCurrentHourSlot();
        
        // Start timer display update
        timerInterval = setInterval(updateTimerDisplay, 1000);
        
        // Start automatic hour boundary monitoring (check every 30 seconds)
        if (!hourBoundaryMonitor) {
            hourBoundaryMonitor = setInterval(processHourBoundary, 30000);
        }
        
        isRunning = true;
        lastProcessedHour = new Date().getHours();
        
        // Update button states
        startBtn.disabled = true;
        pauseBtn.disabled = false;
        stopBtn.disabled = false;
        
        console.log(`⏰ Timer started at ${new Date().toLocaleTimeString()}`);
        console.log(`📍 Current hour slot: ${currentHourSlot}`);
        console.log(`🕐 Monitoring hour: ${lastProcessedHour}`);
    }
}

// Test function to verify session tracking
window.debugSessionInfo = function() {
    console.log('🔍 Current Session Debug Info:');
    console.log('- Is Running:', isRunning);
    console.log('- Current Hour Slot:', currentHourSlot);
    console.log('- Current Session Slot:', currentSessionSlot);
    console.log('- Session Start Time:', sessionStartTime ? new Date(sessionStartTime).toLocaleTimeString() : 'None');
    console.log('- Elapsed Time:', elapsedTime);
    console.log('- Last Checked Hour:', lastCheckedHour);
    console.log('- Current Hour:', new Date().getHours());
};


// Enhanced stop timer with better slot handling
// Enhanced stop timer with proper session handling
async function stopTimerEnhanced() {
    if (isRunning) {
        // Save current session before stopping
        await saveCurrentHourSession();
        
        // Stop all timers
        clearInterval(timerInterval);
        clearInterval(hourBoundaryMonitor);
        hourBoundaryMonitor = null;
        
        isRunning = false;
        currentSessionStartTime = null;
        
        // Update button states
        startBtn.disabled = false;
        pauseBtn.disabled = true;
        stopBtn.disabled = true;
        
        // Reset display
        timerDisplay.textContent = '00:00:00';
        
        console.log('⏹️ Timer stopped and final session saved');
    }
}

// Enhanced pause timer
async function pauseTimerEnhanced() {
    if (isRunning) {
        // Save current session before pausing
        await saveCurrentHourSession();
        
        // Stop timers
        clearInterval(timerInterval);
        clearInterval(hourBoundaryMonitor);
        hourBoundaryMonitor = null;
        
        isRunning = false;
        
        // Update button states
        startBtn.disabled = false;
        pauseBtn.disabled = true;
        stopBtn.disabled = false;
        
        console.log('⏸️ Timer paused and current session saved');
    }
}

// Save session up to hour boundary
// Fixed saveSessionUpToHourBoundary function


// Save current session (for pause/stop)
// Fixed saveCurrentSession function  


// Show hour transition notification
// Enhanced showHourTransitionNotification function
function showHourTransitionNotification(newHour, oldSlot, newSlot) {
    if (!Notification.isSupported()) return;
    
    const oldSlotName = getSlotDisplayName(oldSlot);
    const newSlotName = getSlotDisplayName(newSlot);
    
    const notification = new Notification('Productivity Timer', {
        body: `Session saved to ${oldSlotName}. Now tracking ${newSlotName}`,
        icon: path.join(__dirname, 'assets/icon.png'),
        silent: true,
        requireInteraction: false
    });
    
    // Auto-close after 10 seconds
    setTimeout(() => {
        notification.close();
    }, 10000);
    
    // Show in-app notification too
    showNotification('Hour Transition', 
        `Previous session saved to ${oldSlotName}.\nNow tracking: ${newSlotName}`, 
        'info'
    );
}

// Helper function to get display name from slot field
function getSlotDisplayName(slotField) {
    const slotMap = {
        'slot_5_6_am': '5-6 AM',
        'slot_6_7_am': '6-7 AM', 
        'slot_7_8_am': '7-8 AM',
        'slot_8_9_am': '8-9 AM',
        'slot_9_10_am': '9-10 AM',
        'slot_10_11_am': '10-11 AM',
        'slot_11_12_am': '11-12 PM',
        'slot_12_1_pm': '12-1 PM',
        'slot_1_2_pm': '1-2 PM',
        'slot_2_3_pm': '2-3 PM',
        'slot_3_4_pm': '3-4 PM',
        'slot_4_5_pm': '4-5 PM',
        'slot_5_6_pm': '5-6 PM',
        'slot_6_7_pm': '6-7 PM',
        'slot_7_8_pm': '7-8 PM',
        'slot_8_9_pm': '8-9 PM',
        'other_time': 'Other Time'
    };
    
    return slotMap[slotField] || 'Unknown Slot';
}

// Get current time slot name for given hour
function getCurrentTimeSlotName(hour) {
    const slotMap = {
        5: '5-6 AM', 6: '6-7 AM', 7: '7-8 AM', 8: '8-9 AM',
        9: '9-10 AM', 10: '10-11 AM', 11: '11-12 PM', 12: '12-1 PM',
        13: '1-2 PM', 14: '2-3 PM', 15: '3-4 PM', 16: '4-5 PM',
        17: '5-6 PM', 18: '6-7 PM', 19: '7-8 PM', 20: '8-9 PM'
    };
    
    return slotMap[hour] || 'Other Time';
}

// Enhanced alarm handling with auto-dismiss
function showAlarmDialog(timeString) {
    if (isAlarmDialogOpen) return;
    
    isAlarmDialogOpen = true;
    
    // Create alarm dialog overlay
    const overlay = document.createElement('div');
    overlay.className = 'alarm-overlay';
    overlay.innerHTML = `
        <div class="alarm-dialog">
            <div class="alarm-icon">⏰</div>
            <h2>Hourly Check-in</h2>
            <p>Time: ${timeString}</p>
            <p>Session automatically saved!</p>
            <div class="alarm-actions">
                <button id="alarmOkBtn" class="btn btn-primary">OK - Continue</button>
                <button id="alarmSnoozeBtn" class="btn btn-secondary">Snooze 5min</button>
            </div>
            <div style="margin-top: 15px; font-size: 0.9rem; color: #7f8c8d;">
                Auto-closing in <span id="countdown">10</span> seconds...
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Countdown timer
    let countdown = 10;
    const countdownElement = overlay.querySelector('#countdown');
    const countdownInterval = setInterval(() => {
        countdown--;
        countdownElement.textContent = countdown;
        
        if (countdown <= 0) {
            clearInterval(countdownInterval);
            if (document.body.contains(overlay)) {
                closeAlarmDialog(overlay, timeString);
            }
        }
    }, 1000);
    
    // Handle OK button
    overlay.querySelector('#alarmOkBtn').addEventListener('click', () => {
        clearInterval(countdownInterval);
        closeAlarmDialog(overlay, timeString);
    });
    
    // Handle Snooze button
    overlay.querySelector('#alarmSnoozeBtn').addEventListener('click', () => {
        clearInterval(countdownInterval);
        closeAlarmDialog(overlay, timeString);
        // Schedule snooze
        setTimeout(() => {
            if (!isAlarmDialogOpen) {
                showAlarmDialog(timeString + ' (Snoozed)');
            }
        }, 5 * 60 * 1000);
    });
    
    // Play alarm sound
    playAlarmSound();
}

// Update existing event listeners to use enhanced functions
function setupEventListeners() {
    startBtn.addEventListener('click', startTimerEnhanced);
    pauseBtn.addEventListener('click', pauseTimerEnhanced);
    stopBtn.addEventListener('click', stopTimerEnhanced);
}

// Check for hour boundary transitions
// Fixed checkHourBoundary function
// Fixed checkHourBoundary function - simplified to only handle slot updates


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
    setupSlotEditListeners();
    setupManualEntryButton();
    updateMainSlotsDisplay();
    setupHistoryFeatures();
    
    // Update stats every minute
    // Update stats every minute and also after any data changes
setInterval(updateStatsDisplay, 60000);

// Also update stats after any timer operations
const originalStopTimer = stopTimerEnhanced;
const originalPauseTimer = pauseTimerEnhanced;

stopTimerEnhanced = async function() {
    await originalStopTimer();
    await updateStatsDisplay(); // Refresh stats after stopping
};

pauseTimerEnhanced = async function() {
    await originalPauseTimer();
    await updateStatsDisplay(); // Refresh stats after pausing
};
    
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

// Enhanced updateMainSlotsDisplay with click functionality
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
            <div class="main-slot-card" 
                 onclick="editSlotTime('${slot.field}', ${slot.minutes}, '${slot.name.replace(/'/g, "\\'")}')"
                 title="Click to edit ${slot.name}">
                <div class="main-slot-name">${slot.name}</div>
                <div class="main-slot-time">${formatTime(slot.minutes)}</div>
            </div>
        `).join('');
        
        console.log('✅ Main slots display updated successfully');
        
    } catch (error) {
        console.error('Error updating main slots display:', error);
    }
}

// Custom prompt function using modal
function customPrompt(message, defaultValue = '') {
    return new Promise((resolve) => {
        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'custom-prompt-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10003;
            backdrop-filter: blur(5px);
        `;
        
        // Create modal content
        const modal = document.createElement('div');
        modal.style.cssText = `
            background: white;
            border-radius: 15px;
            padding: 30px;
            max-width: 400px;
            width: 90%;
            text-align: center;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        `;
        
        modal.innerHTML = `
            <h3 style="color: #2c3e50; margin-bottom: 20px;">Input Required</h3>
            <p style="color: #7f8c8d; margin-bottom: 20px; white-space: pre-line;">${message}</p>
            <input type="text" id="promptInput" 
                   style="width: 100%; padding: 12px; border: 2px solid #ecf0f1; border-radius: 8px; font-size: 1rem; margin-bottom: 20px;" 
                   value="${defaultValue}">
            <div style="display: flex; gap: 10px; justify-content: center;">
                <button id="promptOk" style="background: linear-gradient(45deg, #27ae60, #2ecc71); color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer;">OK</button>
                <button id="promptCancel" style="background: linear-gradient(45deg, #95a5a6, #7f8c8d); color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer;">Cancel</button>
            </div>
        `;
        
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        
        const input = modal.querySelector('#promptInput');
        const okBtn = modal.querySelector('#promptOk');
        const cancelBtn = modal.querySelector('#promptCancel');
        
        // Focus input and select text
        setTimeout(() => {
            input.focus();
            input.select();
        }, 100);
        
        // Handle OK button
        okBtn.addEventListener('click', () => {
            const value = input.value.trim();
            document.body.removeChild(overlay);
            resolve(value || null);
        });
        
        // Handle Cancel button
        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(overlay);
            resolve(null);
        });
        
        // Handle Enter key
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                okBtn.click();
            }
        });
        
        // Handle Escape key
        document.addEventListener('keydown', function escapeHandler(e) {
            if (e.key === 'Escape') {
                document.removeEventListener('keydown', escapeHandler);
                cancelBtn.click();
            }
        });
    });
}

// Custom slot selection dialog
function customSlotSelection() {
    return new Promise((resolve) => {
        const slotOptions = [
            { display: '5-6 AM', field: 'slot_5_6_am' },
            { display: '6-7 AM', field: 'slot_6_7_am' },
            { display: '7-8 AM', field: 'slot_7_8_am' },
            { display: '8-9 AM', field: 'slot_8_9_am' },
            { display: '9-10 AM', field: 'slot_9_10_am' },
            { display: '10-11 AM', field: 'slot_10_11_am' },
            { display: '11-12 PM', field: 'slot_11_12_am' },
            { display: '12-1 PM', field: 'slot_12_1_pm' },
            { display: '1-2 PM', field: 'slot_1_2_pm' },
            { display: '2-3 PM', field: 'slot_2_3_pm' },
            { display: '3-4 PM', field: 'slot_3_4_pm' },
            { display: '4-5 PM', field: 'slot_4_5_pm' },
            { display: '5-6 PM', field: 'slot_5_6_pm' },
            { display: '6-7 PM', field: 'slot_6_7_pm' },
            { display: '7-8 PM', field: 'slot_7_8_pm' },
            { display: '8-9 PM', field: 'slot_8_9_pm' },
            { display: 'Other Time', field: 'other_time' }
        ];
        
        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'custom-slot-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10003;
            backdrop-filter: blur(5px);
        `;
        
        // Create modal content
        const modal = document.createElement('div');
        modal.style.cssText = `
            background: white;
            border-radius: 15px;
            padding: 30px;
            max-width: 500px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            text-align: center;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        `;
        
        const buttonsHtml = slotOptions.map((slot, index) => `
            <button class="slot-option-btn" data-field="${slot.field}" data-display="${slot.display}"
                    style="width: 100%; margin: 5px 0; padding: 12px; background: linear-gradient(45deg, #3498db, #2980b9); 
                           color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 1rem; transition: all 0.3s ease;">
                ${slot.display}
            </button>
        `).join('');
        
        modal.innerHTML = `
            <h3 style="color: #2c3e50; margin-bottom: 20px;">📋 Select Time Slot</h3>
            <p style="color: #7f8c8d; margin-bottom: 20px;">Choose which time slot to add minutes to:</p>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin-bottom: 20px;">
                ${buttonsHtml}
            </div>
            <button id="slotCancel" style="background: linear-gradient(45deg, #95a5a6, #7f8c8d); color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer;">Cancel</button>
        `;
        
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        
        // Add hover effects
        const slotBtns = modal.querySelectorAll('.slot-option-btn');
        slotBtns.forEach(btn => {
            btn.addEventListener('mouseenter', () => {
                btn.style.transform = 'translateY(-2px)';
                btn.style.boxShadow = '0 5px 15px rgba(52, 152, 219, 0.4)';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.transform = 'translateY(0)';
                btn.style.boxShadow = 'none';
            });
            btn.addEventListener('click', () => {
                const field = btn.getAttribute('data-field');
                const display = btn.getAttribute('data-display');
                document.body.removeChild(overlay);
                resolve({ field, display });
            });
        });
        
        // Handle Cancel button
        const cancelBtn = modal.querySelector('#slotCancel');
        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(overlay);
            resolve(null);
        });
        
        // Handle Escape key
        document.addEventListener('keydown', function escapeHandler(e) {
            if (e.key === 'Escape') {
                document.removeEventListener('keydown', escapeHandler);
                cancelBtn.click();
            }
        });
    });
}

// History Features JavaScript

// Global variables for history
let currentHistoryMonth = new Date().getMonth();
let currentHistoryYear = new Date().getFullYear();

// Setup history functionality
function setupHistoryFeatures() {
    console.log('🔧 Setting up history features');
    
    const showDailyBtn = document.getElementById('showDailyHistoryBtn');
    const showWeeklyBtn = document.getElementById('showWeeklyOverviewBtn');
    const dailyModal = document.getElementById('dailyHistoryModal');
    const weeklyModal = document.getElementById('weeklyOverviewModal');
    const dayDetailModal = document.getElementById('dayDetailModal');
    
    // Daily History Modal
    const closeDailyBtn = document.getElementById('closeDailyHistoryBtn');
    const monthSelect = document.getElementById('monthSelect');
    const yearSelect = document.getElementById('yearSelect');
    
    // Weekly Overview Modal
    const closeWeeklyBtn = document.getElementById('closeWeeklyOverviewBtn');
    
    // Day Detail Modal
    const closeDayDetailBtn = document.getElementById('closeDayDetailBtn');
    
    // Event listeners
    showDailyBtn.addEventListener('click', showDailyHistory);
    showWeeklyBtn.addEventListener('click', showWeeklyOverview);
    
    closeDailyBtn.addEventListener('click', () => {
        dailyModal.style.display = 'none';
    });
    
    closeWeeklyBtn.addEventListener('click', () => {
        weeklyModal.style.display = 'none';
    });
    
    closeDayDetailBtn.addEventListener('click', () => {
        dayDetailModal.style.display = 'none';
    });
    
    // Month/Year selector change
    monthSelect.addEventListener('change', (e) => {
        currentHistoryMonth = parseInt(e.target.value);
        loadDailyHistoryData();
    });
    
    yearSelect.addEventListener('change', (e) => {
        currentHistoryYear = parseInt(e.target.value);
        loadDailyHistoryData();
    });
    
    // Close modals when clicking outside
    dailyModal.addEventListener('click', (e) => {
        if (e.target === dailyModal) {
            dailyModal.style.display = 'none';
        }
    });
    
    weeklyModal.addEventListener('click', (e) => {
        if (e.target === weeklyModal) {
            weeklyModal.style.display = 'none';
        }
    });
    
    dayDetailModal.addEventListener('click', (e) => {
        if (e.target === dayDetailModal) {
            dayDetailModal.style.display = 'none';
        }
    });
    
    console.log('✅ History features setup complete');
}

// Show Daily History Modal
async function showDailyHistory() {
    console.log('📅 Opening daily history');
    
    try {
        const dailyModal = document.getElementById('dailyHistoryModal');
        
        // Setup month/year selectors
        setupMonthYearSelectors();
        
        // Load data for current month
        await loadDailyHistoryData();
        
        // Show modal
        dailyModal.style.display = 'flex';
        
    } catch (error) {
        console.error('Error showing daily history:', error);
        showNotification('Error', 'Failed to load daily history', 'error');
    }
}

// Setup Month and Year Selectors
function setupMonthYearSelectors() {
    const monthSelect = document.getElementById('monthSelect');
    const yearSelect = document.getElementById('yearSelect');
    
    // Populate months
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    monthSelect.innerHTML = months.map((month, index) => 
        `<option value="${index}" ${index === currentHistoryMonth ? 'selected' : ''}>${month}</option>`
    ).join('');
    
    // Populate years (current year and 2 years back)
    const currentYear = new Date().getFullYear();
    const years = [currentYear, currentYear - 1, currentYear - 2];
    
    yearSelect.innerHTML = years.map(year => 
        `<option value="${year}" ${year === currentHistoryYear ? 'selected' : ''}>${year}</option>`
    ).join('');
}

// Load Daily History Data
// Updated loadDailyHistoryData function
async function loadDailyHistoryData() {
    console.log(`📊 Loading daily data for ${currentHistoryMonth + 1}/${currentHistoryYear}`);
    
    try {
        // Get daily data for the selected month/year
        const dailyData = await getDailyDataForMonth(currentHistoryYear, currentHistoryMonth);
        
        // Populate timeline
        populateDailyTimeline(dailyData);
        
        // Add month summary if data exists
        if (dailyData.length > 0) {
            await loadMonthSummary();
        }
        
    } catch (error) {
        console.error('Error loading daily history data:', error);
        showNotification('Error', 'Failed to load daily data', 'error');
    }
}

// Get Daily Data for Specific Month (simulate IPC call)
// Replace the getDailyDataForMonth function
async function getDailyDataForMonth(year, month) {
    try {
        console.log(`📊 Loading real daily data for ${year}-${month + 1}`);
        
        // Use real IPC call now
        const data = await ipcRenderer.invoke('get-daily-data-for-month', year, month);
        
        console.log(`✅ Loaded ${data.length} days of real data`);
        return data;
        
    } catch (error) {
        console.error('Error getting daily data:', error);
        return [];
    }
}

// Populate Daily Timeline
function populateDailyTimeline(dailyData) {
    const timeline = document.getElementById('dailyTimeline');
    
    if (!dailyData || dailyData.length === 0) {
        timeline.innerHTML = `
            <div class="no-data">
                <h3>No Data Available</h3>
                <p>No productivity data found for this month.</p>
            </div>
        `;
        return;
    }
    
    // Sort by date (newest first)
    const sortedData = dailyData.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    timeline.innerHTML = sortedData.map(day => {
        const date = new Date(day.date);
        const hours = Math.floor(day.total_minutes / 60);
        const minutes = day.total_minutes % 60;
        const timeStr = `${hours}H ${minutes}M`;
        
        // Determine productivity level and color
        const level = getProductivityLevel(day.total_minutes);
        
        return `
            <div class="day-item ${level.class}" onclick="showDayDetail('${day.date}')">
                <div class="day-info">
                    <div class="day-date">${date.toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        day: 'numeric', 
                        month: 'long',
                        year: 'numeric'
                    })}</div>
                    <div class="day-summary">${day.notes ? 'Has notes' : 'No notes'}</div>
                </div>
                <div class="day-stats">
                    <div class="day-hours">${timeStr}</div>
                    <div class="day-level level-${level.class}">${level.label}</div>
                </div>
            </div>
        `;
    }).join('');
}

// Get Productivity Level
function getProductivityLevel(totalMinutes) {
    const hours = totalMinutes / 60;
    
    if (hours >= 5) return { class: 'excellent', label: 'Excellent' };
    if (hours >= 4) return { class: 'good', label: 'Good' };
    if (hours >= 2) return { class: 'average', label: 'Average' };
    if (hours >= 1) return { class: 'below', label: 'Below' };
    return { class: 'poor', label: 'Poor' };
}

// Show Day Detail Modal
async function showDayDetail(dateString) {
    console.log(`📋 Opening day detail for ${dateString}`);
    
    try {
        // Get detailed data for the specific day
        const dayData = await getDayDetailData(dateString);
        
        if (!dayData) {
            showNotification('Error', 'No data found for this day', 'error');
            return;
        }
        
        // Populate day detail modal
        populateDayDetail(dayData);
        
        // Show modal
        const dayDetailModal = document.getElementById('dayDetailModal');
        dayDetailModal.style.display = 'flex';
        
    } catch (error) {
        console.error('Error showing day detail:', error);
        showNotification('Error', 'Failed to load day details', 'error');
    }
}

// Get Day Detail Data
async function getDayDetailData(dateString) {
    try {
        console.log(`📋 Loading real day detail for ${dateString}`);
        
        // Use real IPC call now
        const data = await ipcRenderer.invoke('get-day-detail-data', dateString);
        
        console.log(`✅ Loaded real day detail:`, data);
        return data;
        
    } catch (error) {
        console.error('Error getting day detail data:', error);
        return null;
    }
}

// Populate Day Detail Modal
function populateDayDetail(dayData) {
    const date = new Date(dayData.date);
    const hours = Math.floor(dayData.total_minutes / 60);
    const minutes = dayData.total_minutes % 60;
    const level = getProductivityLevel(dayData.total_minutes);
    
    // Populate header
    const header = document.getElementById('dayDetailHeader');
    header.innerHTML = `
        <div class="day-detail-title">${date.toLocaleDateString('en-US', { 
            weekday: 'long', 
            day: 'numeric', 
            month: 'long',
            year: 'numeric'
        })}</div>
        <div class="day-detail-stats">
            <div class="detail-stat">
                <div class="detail-stat-value">${hours}H ${minutes}M</div>
                <div class="detail-stat-label">Total Time</div>
            </div>
            <div class="detail-stat">
                <div class="detail-stat-value">${level.label}</div>
                <div class="detail-stat-label">Productivity</div>
            </div>
            <div class="detail-stat">
                <div class="detail-stat-value">${dayData.slots.length}</div>
                <div class="detail-stat-label">Active Slots</div>
            </div>
        </div>
    `;
    
    // Populate slots
    const slotsContainer = document.getElementById('dayDetailSlots');
    slotsContainer.innerHTML = dayData.slots.map(slot => `
        <div class="detail-slot">
            <span>${slot.name}</span>
            <span>${Math.floor(slot.minutes / 60)}H ${slot.minutes % 60}M</span>
        </div>
    `).join('');
    
    // Populate notes
    const notesContainer = document.getElementById('dayDetailNotes');
    notesContainer.textContent = dayData.notes || 'No notes recorded for this day.';
}

// Show Weekly Overview Modal
async function showWeeklyOverview() {
    console.log('📈 Opening weekly overview');
    
    try {
        const weeklyModal = document.getElementById('weeklyOverviewModal');
        
        // Load weekly data
        await loadWeeklyOverviewData();
        
        // Show modal
        weeklyModal.style.display = 'flex';
        
    } catch (error) {
        console.error('Error showing weekly overview:', error);
        showNotification('Error', 'Failed to load weekly overview', 'error');
    }
}

// Load Weekly Overview Data
async function loadWeeklyOverviewData() {
    console.log('📊 Loading weekly overview data');
    
    try {
        // Get weekly ranking data (using existing function)
        const weeklyData = await ipcRenderer.invoke('get-weekly-ranking-data', 20);
        
        // Populate timeline
        populateWeeklyTimeline(weeklyData);
        
    } catch (error) {
        console.error('Error loading weekly data:', error);
        showNotification('Error', 'Failed to load weekly data', 'error');
    }
}

// Populate Weekly Timeline
function populateWeeklyTimeline(weeklyData) {
    const timeline = document.getElementById('weeklyTimeline');
    
    if (!weeklyData || weeklyData.length === 0) {
        timeline.innerHTML = `
            <div class="no-data">
                <h3>No Weekly Data</h3>
                <p>No weekly productivity data available yet.</p>
            </div>
        `;
        return;
    }
    
    timeline.innerHTML = weeklyData.map(week => {
        const hours = Math.floor(week.total_minutes / 60);
        const minutes = week.total_minutes % 60;
        const timeStr = `${hours}H ${minutes}M`;
        
        return `
            <div class="week-item">
                <div class="week-info">
                    <div class="week-title">Week ${week.week_number}, ${week.year}</div>
                    <div class="week-dates">${week.date_range}</div>
                </div>
                <div class="week-stats">
                    <div class="week-hours">${timeStr}</div>
                    <div class="week-rank">Rank #${week.rank}</div>
                </div>
            </div>
        `;
    }).join('');
}

// Make showDayDetail globally accessible
window.showDayDetail = showDayDetail;

// Add month summary to daily history
async function loadMonthSummary() {
    try {
        const summary = await ipcRenderer.invoke('get-month-summary', currentHistoryYear, currentHistoryMonth);
        
        if (!summary || summary.total_days === 0) return;
        
        const avgHours = Math.floor(summary.avg_minutes / 60);
        const avgMins = Math.round(summary.avg_minutes % 60);
        const totalHours = Math.floor(summary.total_minutes / 60);
        const totalMins = Math.round(summary.total_minutes % 60);
        
        // Add summary to timeline (you can customize this)
        const timeline = document.getElementById('dailyTimeline');
        const summaryHtml = `
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 15px; margin-bottom: 20px;">
                <h3 style="margin: 0 0 15px 0;">📊 Month Summary</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 15px;">
                    <div style="text-align: center;">
                        <div style="font-size: 1.2rem; font-weight: bold;">${summary.total_days}</div>
                        <div style="opacity: 0.9;">Active Days</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 1.2rem; font-weight: bold;">${totalHours}H ${totalMins}M</div>
                        <div style="opacity: 0.9;">Total Time</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 1.2rem; font-weight: bold;">${avgHours}H ${avgMins}M</div>
                        <div style="opacity: 0.9;">Daily Average</div>
                    </div>
                </div>
            </div>
        `;
        
        timeline.insertAdjacentHTML('afterbegin', summaryHtml);
        
    } catch (error) {
        console.error('Error loading month summary:', error);
    }
}

// AUTOMATIC HOUR BOUNDARY PROCESSING
async function processHourBoundary() {
    const currentHour = new Date().getHours();
    
    // Check if hour has changed
    if (currentHour !== lastProcessedHour && isRunning) {
        console.log(`🕐 HOUR BOUNDARY: ${lastProcessedHour}:xx → ${currentHour}:xx`);
        
        // Save session for the completed hour
        await saveCurrentHourSession();
        
        // Start new session for new hour
        startNewHourSession();
        
        // Update tracking
        lastProcessedHour = currentHour;
        
        console.log(`✅ Automatic hour split completed: now tracking ${currentHourSlot}`);
    }
}

// SAVE CURRENT HOUR SESSION
async function saveCurrentHourSession() {
    if (!currentSessionStartTime || !currentHourSlot) {
        console.log('⚠️ No active session to save');
        return;
    }
    
    try {
        // Calculate minutes worked in current session
        const sessionEndTime = Date.now();
        const sessionDuration = sessionEndTime - currentSessionStartTime;
        const sessionMinutes = Math.floor(sessionDuration / (1000 * 60));
        
        // Only save if there are minutes to save
        if (sessionMinutes > 0) {
            // Ensure max 60 minutes per slot (safety check)
            const minutesToSave = Math.min(sessionMinutes, 60);
            
            console.log(`💾 Saving ${minutesToSave} minutes to ${currentHourSlot}`);
            
            await ipcRenderer.invoke('add-time-to-slot', currentHourSlot, minutesToSave);
            
            // Update displays
            updateStatsDisplay();
            updateMainSlotsDisplay();
            
            console.log(`✅ Saved: ${minutesToSave} minutes to ${currentHourSlot}`);
        } else {
            console.log('⚠️ Session too short to save (< 1 minute)');
        }
    } catch (error) {
        console.error('❌ Error saving session:', error);
    }
}

// START NEW HOUR SESSION
function startNewHourSession() {
    // Reset session for new hour
    currentSessionStartTime = Date.now();
    
    // Update to new hour slot
    const previousSlot = currentHourSlot;
    determineCurrentHourSlot();
    
    console.log(`🔄 New hour session: ${previousSlot} → ${currentHourSlot}`);
    
    // Update UI
    updateCurrentSlot();
    
    // Show transition notification
    showHourTransitionNotification(previousSlot, currentHourSlot);
}

// HOUR TRANSITION NOTIFICATION
function showHourTransitionNotification(oldSlot, newSlot) {
    const oldSlotName = getSlotDisplayName(oldSlot);
    const newSlotName = getSlotDisplayName(newSlot);
    
    // Show in-app notification
    showNotification('⏰ Hour Changed', 
        `Session saved to: ${oldSlotName}\nNow tracking: ${newSlotName}`, 
        'info'
    );
    
    console.log(`📢 Hour transition: ${oldSlotName} → ${newSlotName}`);
}