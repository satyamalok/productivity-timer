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
    setupRankingModal(); // Add this line
    setupEnhancedUI(); // Add this line
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
    if (isRunning || elapsedTime > 0) {
        clearInterval(timerInterval);
        isRunning = false;
        
        // Save the elapsed time to database if there was any
        if (elapsedTime > 0) {
            const minutes = Math.floor(elapsedTime / (1000 * 60));
            if (minutes > 0) {
                try {
                    await ipcRenderer.invoke('add-time-to-slot', currentHourSlot, minutes);
                    console.log(`Saved ${minutes} minutes to ${currentHourSlot}`);
                    
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
        
        console.log('Timer stopped and data saved');
    }
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
        
        // Update week total display with rank
        if (currentWeekRank) {
            weekTotal.textContent = `${currentWeekRank.total_hours_formatted} (Rank #${currentWeekRank.rank || 'Unranked'})`;
        }
        
        console.log('Weekly ranking updated');
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
        
        // Populate slots grid
        populateSlotsGrid(hourlyBreakdown);
        
        // Show modal
        todayModal.style.display = 'flex';
        
    } catch (error) {
        console.error('Error showing today slots:', error);
    }
}

function populateSlotsGrid(hourlyBreakdown) {
    const slotsGrid = document.getElementById('slotsGrid');
    
    if (!hourlyBreakdown || hourlyBreakdown.length === 0) {
        slotsGrid.innerHTML = `
            <div class="no-slots-message">
                <p>No recorded time slots for today yet.</p>
                <p>Start your timer to begin tracking!</p>
            </div>
        `;
        return;
    }
    
    slotsGrid.innerHTML = hourlyBreakdown.map(slot => `
        <div class="slot-card">
            <div class="slot-name">${slot.name}</div>
            <div class="slot-duration">${formatTime(slot.minutes)}</div>
            <div class="slot-progress">
                <div class="progress-bar" style="width: ${Math.min((slot.minutes / 60) * 100, 100)}%"></div>
            </div>
        </div>
    `).join('');
}