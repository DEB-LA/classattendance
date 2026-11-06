/**
 * Class Attendance List App
 * Pure Vanilla JavaScript implementation with localStorage persistence
 */

// Storage Key
const STORAGE_KEY = 'class_attendance_records';

// State
let attendanceRecords = [];
let currentFilter = 'all';
let searchQuery = '';
let recordToDeleteId = null;

// DOM Elements
const form = document.getElementById('attendanceForm');
const formTitle = document.getElementById('formTitle');
const editingBadge = document.getElementById('editingBadge');
const recordIdInput = document.getElementById('recordId');
const studentNameInput = document.getElementById('studentName');
const attendanceDateInput = document.getElementById('attendanceDate');
const nameError = document.getElementById('nameError');
const dateError = document.getElementById('dateError');
const submitBtn = document.getElementById('submitBtn');
const submitBtnText = document.getElementById('submitBtnText');
const cancelEditBtn = document.getElementById('cancelEditBtn');

const attendanceList = document.getElementById('attendanceList');
const emptyState = document.getElementById('emptyState');
const noResultsState = document.getElementById('noResultsState');

const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const resetSearchBtn = document.getElementById('resetSearchBtn');
const filterChips = document.querySelectorAll('.filter-chip');

const totalCountEl = document.getElementById('totalCount');
const presentCountEl = document.getElementById('presentCount');
const absentCountEl = document.getElementById('absentCount');

// Modal Elements
const confirmModal = document.getElementById('confirmModal');
const modalMessage = document.getElementById('modalMessage');
const modalCancelBtn = document.getElementById('modalCancelBtn');
const modalConfirmBtn = document.getElementById('modalConfirmBtn');

/**
 * Initialize application
 */
function init() {
  setDefaultDate();
  loadRecords();
  setupEventListeners();
  render();
}

/**
 * Get current date in YYYY-MM-DD format (local timezone)
 */
function getTodayDateString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format date string (YYYY-MM-DD) for display
 */
function formatDateForDisplay(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  
  const [year, month, day] = parts;
  const dateObj = new Date(Number(year), Number(month) - 1, Number(day));
  
  // Format options: "Oct 24, 2026"
  return dateObj.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Set the default date in the date input to today
 */
function setDefaultDate() {
  attendanceDateInput.value = getTodayDateString();
}

/**
 * Load records from localStorage
 */
function loadRecords() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    attendanceRecords = stored ? JSON.parse(stored) : [];
  } catch (err) {
    console.error('Failed to load records from localStorage', err);
    attendanceRecords = [];
  }
}

/**
 * Save records to localStorage
 */
function saveRecords() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(attendanceRecords));
  } catch (err) {
    console.error('Failed to save records to localStorage', err);
  }
}

/**
 * Update the stats counter at the top
 */
function updateStats() {
  const total = attendanceRecords.length;
  const present = attendanceRecords.filter(r => r.status === 'Present').length;
  const absent = attendanceRecords.filter(r => r.status === 'Absent').length;

  totalCountEl.textContent = total;
  presentCountEl.textContent = present;
  absentCountEl.textContent = absent;
}

/**
 * Sanitize text to prevent HTML injection
 */
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Render attendance records list based on current filter & search query
 */
function render() {
  updateStats();

  const query = searchQuery.trim().toLowerCase();
  
  // Filter records
  const filtered = attendanceRecords.filter(record => {
    // Status filter
    if (currentFilter !== 'all' && record.status !== currentFilter) {
      return false;
    }
    // Search query matches student name or date
    if (query) {
      const nameMatch = record.studentName.toLowerCase().includes(query);
      const dateMatch = record.date.includes(query) || formatDateForDisplay(record.date).toLowerCase().includes(query);
      if (!nameMatch && !dateMatch) return false;
    }
    return true;
  });

  // Sort: most recent date first, then by creation date
  filtered.sort((a, b) => {
    if (b.date !== a.date) {
      return b.date.localeCompare(a.date);
    }
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  // Empty state handling
  if (attendanceRecords.length === 0) {
    attendanceList.innerHTML = '';
    emptyState.classList.remove('hidden');
    noResultsState.classList.add('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  if (filtered.length === 0) {
    attendanceList.innerHTML = '';
    noResultsState.classList.remove('hidden');
    return;
  }

  noResultsState.classList.add('hidden');

  const activeEditId = recordIdInput.value;

  // Render cards
  attendanceList.innerHTML = filtered.map(record => {
    const isEditing = record.id === activeEditId;
    const isPresent = record.status === 'Present';
    const badgeClass = isPresent ? 'badge-present' : 'badge-absent';
    const displayDate = formatDateForDisplay(record.date);

    return `
      <div class="record-item ${isEditing ? 'is-editing' : ''}" data-id="${record.id}" role="listitem">
        <div class="record-info">
          <div class="record-header-row">
            <span class="student-name">${escapeHTML(record.studentName)}</span>
            <span class="badge ${badgeClass}">${escapeHTML(record.status)}</span>
          </div>
          <span class="record-date">${escapeHTML(displayDate)}</span>
        </div>
        <div class="record-actions">
          <button type="button" class="action-btn edit-btn" onclick="startEditRecord('${record.id}')" aria-label="Edit record for ${escapeHTML(record.studentName)}">
            ✏️ Edit
          </button>
          <button type="button" class="action-btn delete-btn" onclick="promptDeleteRecord('${record.id}')" aria-label="Delete record for ${escapeHTML(record.studentName)}">
            🗑️ Delete
          </button>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Handle form submission (Add or Update)
 */
function handleFormSubmit(e) {
  e.preventDefault();
  
  // Clear previous errors
  nameError.textContent = '';
  dateError.textContent = '';
  studentNameInput.classList.remove('input-error');
  attendanceDateInput.classList.remove('input-error');

  const nameVal = studentNameInput.value.trim();
  const dateVal = attendanceDateInput.value;
  const statusEl = form.querySelector('input[name="attendanceStatus"]:checked');
  const statusVal = statusEl ? statusEl.value : 'Present';
  const editId = recordIdInput.value;

  let hasError = false;

  if (!nameVal) {
    nameError.textContent = 'Please enter a student name.';
    studentNameInput.classList.add('input-error');
    if (!hasError) studentNameInput.focus();
    hasError = true;
  }

  if (!dateVal) {
    dateError.textContent = 'Please select a valid date.';
    attendanceDateInput.classList.add('input-error');
    if (!hasError) attendanceDateInput.focus();
    hasError = true;
  }

  if (hasError) return;

  if (editId) {
    // Update existing record
    const index = attendanceRecords.findIndex(r => r.id === editId);
    if (index !== -1) {
      attendanceRecords[index] = {
        ...attendanceRecords[index],
        studentName: nameVal,
        date: dateVal,
        status: statusVal,
        updatedAt: Date.now()
      };
    }
    resetForm();
  } else {
    // Add new record
    const newRecord = {
      id: 'att_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      studentName: nameVal,
      date: dateVal,
      status: statusVal,
      createdAt: Date.now()
    };
    attendanceRecords.unshift(newRecord);
    resetForm();
  }

  saveRecords();
  render();
}

/**
 * Populate form for editing a record
 */
function startEditRecord(id) {
  const record = attendanceRecords.find(r => r.id === id);
  if (!record) return;

  recordIdInput.value = record.id;
  studentNameInput.value = record.studentName;
  attendanceDateInput.value = record.date;

  const radioToCheck = form.querySelector(`input[name="attendanceStatus"][value="${record.status}"]`);
  if (radioToCheck) {
    radioToCheck.checked = true;
  }

  // Switch UI to edit mode
  formTitle.textContent = 'Edit Attendance Record';
  submitBtnText.textContent = 'Save Changes';
  editingBadge.classList.remove('hidden');
  cancelEditBtn.classList.remove('hidden');

  // Clear errors
  nameError.textContent = '';
  dateError.textContent = '';
  studentNameInput.classList.remove('input-error');
  attendanceDateInput.classList.remove('input-error');

  // Scroll to form smoothly
  form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  studentNameInput.focus();

  render();
}

/**
 * Reset form back to Add mode
 */
function resetForm() {
  form.reset();
  recordIdInput.value = '';
  setDefaultDate();

  formTitle.textContent = 'Add Attendance Record';
  submitBtnText.textContent = 'Add Record';
  editingBadge.classList.add('hidden');
  cancelEditBtn.classList.add('hidden');

  nameError.textContent = '';
  dateError.textContent = '';
  studentNameInput.classList.remove('input-error');
  attendanceDateInput.classList.remove('input-error');
}

/**
 * Prompt user before deleting a record
 */
function promptDeleteRecord(id) {
  const record = attendanceRecords.find(r => r.id === id);
  if (!record) return;

  recordToDeleteId = id;
  const formattedDate = formatDateForDisplay(record.date);
  modalMessage.innerHTML = `Are you sure you want to delete the attendance record for <strong>${escapeHTML(record.studentName)}</strong> on <strong>${escapeHTML(formattedDate)}</strong>? This action cannot be undone.`;
  
  openModal();
}

/**
 * Confirm and delete the selected record
 */
function confirmDelete() {
  if (!recordToDeleteId) return;

  // If the record being deleted was currently being edited, reset the form
  if (recordIdInput.value === recordToDeleteId) {
    resetForm();
  }

  attendanceRecords = attendanceRecords.filter(r => r.id !== recordToDeleteId);
  recordToDeleteId = null;
  saveRecords();
  closeModal();
  render();
}

/**
 * Modal helpers
 */
function openModal() {
  confirmModal.classList.remove('hidden');
  modalConfirmBtn.focus();
}

function closeModal() {
  confirmModal.classList.add('hidden');
  recordToDeleteId = null;
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Form submit
  form.addEventListener('submit', handleFormSubmit);

  // Cancel edit button
  cancelEditBtn.addEventListener('click', () => {
    resetForm();
    render();
  });

  // Search input live filtering
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    if (searchQuery) {
      clearSearchBtn.classList.remove('hidden');
    } else {
      clearSearchBtn.classList.add('hidden');
    }
    render();
  });

  // Clear search button
  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    clearSearchBtn.classList.add('hidden');
    searchInput.focus();
    render();
  });

  // Reset search button (in empty search state)
  resetSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    clearSearchBtn.classList.add('hidden');
    currentFilter = 'all';
    filterChips.forEach(c => {
      c.classList.toggle('active', c.dataset.filter === 'all');
    });
    render();
  });

  // Status Filter Chips
  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilter = chip.dataset.filter;
      render();
    });
  });

  // Modal actions
  modalCancelBtn.addEventListener('click', closeModal);
  modalConfirmBtn.addEventListener('click', confirmDelete);

  // Close modal when clicking on backdrop
  confirmModal.addEventListener('click', (e) => {
    if (e.target === confirmModal) {
      closeModal();
    }
  });

  // Keyboard accessibility (Escape key to cancel/close)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!confirmModal.classList.contains('hidden')) {
        closeModal();
      } else if (recordIdInput.value) {
        resetForm();
        render();
      }
    }
  });
}

// Make functions accessible globally for inline onclick handlers
window.startEditRecord = startEditRecord;
window.promptDeleteRecord = promptDeleteRecord;

// Run on page load
document.addEventListener('DOMContentLoaded', init);

