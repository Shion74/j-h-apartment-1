/**
 * Authentication utility functions
 */

// Check if user is authenticated
function isAuthenticated() {
  const user = localStorage.getItem('user');
  const token = localStorage.getItem('token');
  return user && token;
}

// Redirect to login if not authenticated
function requireAuth() {
  if (!isAuthenticated()) {
    window.location.href = '/';
    return false;
  }
  return true;
}

// Get current user
function getCurrentUser() {
  const userString = localStorage.getItem('user');
  return userString ? JSON.parse(userString) : null;
}

// Get auth token
function getToken() {
  return localStorage.getItem('token');
}

// Get auth headers for API requests
function getAuthHeaders() {
  const token = getToken();
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

// Logout user
async function logout() {
  try {
    await fetch('/api/auth/logout');
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = '/';
  } catch (error) {
    console.error('Logout error:', error);
  }
}

// Format currency
function formatCurrency(amount) {
  return '₱' + (parseFloat(amount) || 0).toFixed(2);
}

// Format date
function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString();
}

// Check if user is admin
function isAdmin() {
  const user = getCurrentUser();
  return user && user.role === 'admin';
}

// Show error message
function showError(message, container) {
  const alert = document.createElement('div');
  alert.className = 'alert alert-danger alert-dismissible fade show';
  alert.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
  container.prepend(alert);
  
  // Auto dismiss after 5 seconds
  setTimeout(() => {
    const bsAlert = new bootstrap.Alert(alert);
    bsAlert.close();
  }, 5000);
}

// Show success message
function showSuccess(message, container) {
  const alert = document.createElement('div');
  alert.className = 'alert alert-success alert-dismissible fade show';
  alert.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
  container.prepend(alert);
  
  // Auto dismiss after 5 seconds
  setTimeout(() => {
    const bsAlert = new bootstrap.Alert(alert);
    bsAlert.close();
  }, 5000);
} 