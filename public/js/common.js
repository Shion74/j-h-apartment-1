/**
 * Common utility functions
 */

// Initialize sidebar toggle
function initSidebar() {
  const sidebarToggle = document.getElementById('sidebarToggle');
  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
      document.querySelector('.sidebar').classList.toggle('show');
      document.querySelector('.content').classList.toggle('sidebar-open');
    });
  }
}

// Initialize logout button
function initLogout() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await logout();
    });
  }
}

// Mark active menu item
function setActiveMenu() {
  const currentPath = window.location.pathname;
  const menuItems = document.querySelectorAll('.sidebar-menu a');
  
  menuItems.forEach(item => {
    if (item.getAttribute('href') === currentPath) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
}

// Set user name
function setUserName() {
  const userNameElement = document.getElementById('userName');
  if (userNameElement) {
    const user = getCurrentUser();
    if (user) {
      userNameElement.textContent = user.username;
    }
  }
}

// Initialize common elements
function initCommon() {
  if (!requireAuth()) return;
  
  setUserName();
  initSidebar();
  initLogout();
  setActiveMenu();
}

// Create confirmation modal
function createConfirmModal(id = 'confirmModal') {
  const modalHTML = `
    <div class="modal fade" id="${id}" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Confirm Action</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <p id="${id}-message">Are you sure you want to proceed?</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-danger" id="${id}-confirm">Confirm</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  if (!document.getElementById(id)) {
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }
  
  return {
    modal: new bootstrap.Modal(document.getElementById(id)),
    confirmBtn: document.getElementById(`${id}-confirm`),
    messageEl: document.getElementById(`${id}-message`)
  };
}

// Show confirmation modal
function showConfirmModal(message, callback) {
  const { modal, confirmBtn, messageEl } = createConfirmModal();
  
  messageEl.textContent = message;
  
  // Remove previous event listeners
  const newConfirmBtn = confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
  
  // Add new event listener
  newConfirmBtn.addEventListener('click', () => {
    modal.hide();
    callback();
  });
  
  modal.show();
}

// Handle API errors
function handleApiError(error, container) {
  console.error('API Error:', error);
  
  let errorMessage = 'An error occurred. Please try again.';
  
  if (error.response) {
    if (error.response.status === 401) {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      window.location.href = '/';
      return;
    }
    
    try {
      const data = error.response.json();
      errorMessage = data.message || errorMessage;
    } catch (e) {
      // Use default error message
    }
  }
  
  showError(errorMessage, container);
} 