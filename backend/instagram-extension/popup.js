document.addEventListener('DOMContentLoaded', () => {
  // Elements - Screens
  const loginScreen = document.getElementById('loginScreen');
  const mainScreen = document.getElementById('mainScreen');
  
  // Elements - Login
  const loginBtn = document.getElementById('loginBtn');
  const loginEmail = document.getElementById('loginEmail');
  const loginError = document.getElementById('loginError');

  // Elements - Main
  const logoutBtn = document.getElementById('logoutBtn');
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const statusDiv = document.getElementById('status');
  const toggleSettings = document.getElementById('toggleSettings');
  const settingsPanel = document.getElementById('settingsPanel');
  
  // Load User State
  chrome.storage.local.get(['userEmail', 'leadsToday', 'leadsTotal'], (result) => {
    if (result.userEmail) {
      showMainScreen(result.userEmail);
      updateStats(result.leadsToday || 0, result.leadsTotal || 0);
    } else {
      showLoginScreen();
    }
  });

  // Login Logic
  loginBtn.addEventListener('click', async () => {
    const email = loginEmail.value.trim();
    if (!email) {
      showError('Por favor, digite seu e-mail.');
      return;
    }
    if (!email.includes('@')) {
      showError('E-mail inválido.');
      return;
    }

    loginBtn.textContent = "Validando...";
    loginBtn.disabled = true;

    // Get backend URL (default or stored)
    chrome.storage.local.get(['backendUrl'], async (res) => {
        let backendUrl = res.backendUrl || 'https://backlead.gleego.com.br/api/leads/extension';
        
        // Remove trailing slash if present
        if (backendUrl.endsWith('/')) {
            backendUrl = backendUrl.slice(0, -1);
        }

        let authUrl;
        if (backendUrl.includes('/api/leads/extension')) {
             authUrl = backendUrl.replace('/leads/extension', '/auth/extension-login');
        } else if (backendUrl.includes('/api')) {
             // Assume it's base API url
             authUrl = `${backendUrl}/auth/extension-login`;
        } else {
             // Assume it's base domain
             authUrl = `${backendUrl}/api/auth/extension-login`;
        }
        
        // Clean up double slashes just in case (except protocol)
        authUrl = authUrl.replace(/([^:]\/)\/+/g, "$1");
        
        console.log(`[Popup] Tentando login em: ${authUrl}`);

        try {
            const response = await fetch(authUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                 const text = await response.text();
                 throw new Error(`Resposta inválida do servidor (HTML/Texto): ${text.substring(0, 100)}...`);
            }

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Erro ao validar usuário');
            }

            // Success
            chrome.storage.local.set({ 
                userEmail: email,
                userPlan: data.user.planName,
                userRole: data.user.role
            }, () => {
                showMainScreen(email);
                // Update stats if available
                chrome.storage.local.get(['leadsToday', 'leadsTotal'], (res) => {
                    updateStats(res.leadsToday || 0, res.leadsTotal || 0);
                });
            });

        } catch (error) {
            showError(error.message);
        } finally {
            loginBtn.textContent = "Entrar no Sistema";
            loginBtn.disabled = false;
        }
    });
  });

  // Logout Logic
  logoutBtn.addEventListener('click', () => {
    chrome.storage.local.remove('userEmail', () => {
      showLoginScreen();
    });
  });

  // Screen Switching Helpers
  function showLoginScreen() {
    loginScreen.classList.remove('hidden');
    mainScreen.classList.add('hidden');
    loginError.style.display = 'none';
    loginEmail.value = '';
  }

  function showMainScreen(email) {
    loginScreen.classList.add('hidden');
    mainScreen.classList.remove('hidden');
    // Load other configs when showing main screen
    loadConfigs();
  }

  function showError(msg) {
    loginError.textContent = msg;
    loginError.style.display = 'block';
  }

  function updateStats(today, total) {
    document.getElementById('leadsToday').textContent = today;
    document.getElementById('leadsTotal').textContent = total;
  }

  // Toggle Settings
  toggleSettings.addEventListener('click', () => {
    settingsPanel.classList.toggle('hidden');
    toggleSettings.textContent = settingsPanel.classList.contains('hidden') 
      ? 'Configurações Avançadas' 
      : 'Ocultar Configurações';
  });

  // Load Configs Implementation
  function loadConfigs() {
    chrome.storage.local.get(['evoUrl', 'evoKey', 'backendUrl', 'targetProfile', 'searchTerm', 'searchState', 'maxLeads', 'safetyDelay'], (result) => {
      if (result.evoUrl) document.getElementById('evoUrl').value = result.evoUrl;
      if (result.evoKey) document.getElementById('evoKey').value = result.evoKey;
      
      // Use stored backend URL only if it's not the old localhost default
      if (result.backendUrl && !result.backendUrl.includes('localhost:3000')) {
        document.getElementById('backendUrl').value = result.backendUrl;
      }
      
      if (result.targetProfile) document.getElementById('targetProfile').value = result.targetProfile;
      if (result.searchTerm) document.getElementById('searchTerm').value = result.searchTerm;
      if (result.maxLeads) document.getElementById('maxLeads').value = result.maxLeads;
      if (result.safetyDelay) document.getElementById('safetyDelay').value = result.safetyDelay;

      // Check active state
      if (result.searchState && result.searchState.active) {
          const count = result.searchState.count || 0;
          const total = result.searchState.total || result.maxLeads || '∞';
          
          statusDiv.textContent = `Rodando: ${result.searchState.term || result.searchState.target}`;
          startBtn.style.display = 'none';
          stopBtn.style.display = 'block';
          
          document.getElementById('progressContainer').style.display = 'block';
          document.getElementById('progressCount').textContent = `${count}/${total}`;
          
          if (total !== '∞') {
              const pct = Math.min((count / total) * 100, 100);
              document.getElementById('progressBar').style.width = `${pct}%`;
          }
          
          if (result.searchState.mode === 'search') {
              const searchRadio = document.querySelector('input[value="search"]');
              if (searchRadio) {
                  searchRadio.checked = true;
                  setTimeout(() => searchRadio.dispatchEvent(new Event('change')), 100);
              }
          }
      }
    });
  }

  // --- EXISTING LOGIC BELOW (Adapted) ---

  // Listener for progress updates
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === "UPDATE_PROGRESS") {
          const count = request.count;
          const total = request.total || '∞';
          
          document.getElementById('progressCount').textContent = `${count}/${total}`;
          if (total !== '∞' && total > 0) {
              const pct = Math.min((count / total) * 100, 100);
              document.getElementById('progressBar').style.width = `${pct}%`;
          }
          
          // Update local stats display optimistically
          // In a real app, you might sync this with the backend response
          chrome.storage.local.get(['leadsToday', 'leadsTotal'], (res) => {
            const currentTotal = res.leadsTotal || 0;
            // This is a simple increment, logic might need refinement based on exact backend response
            // For now, we trust the count from content script is the session count
          });

      } else if (request.action === "SCRAPE_COMPLETE") {
          statusDiv.textContent = 'Concluído!';
          startBtn.style.display = 'block';
          stopBtn.style.display = 'none';
          // Keep progress visible for a moment
          setTimeout(() => {
            document.getElementById('progressContainer').style.display = 'none';
          }, 3000);
          chrome.storage.local.remove(['searchState']);
      }
  });

  // Toggle Mode (Profile vs Search)
  const radios = document.getElementsByName('mode');
  const profileGroup = document.getElementById('profileInputGroup');
  const searchGroup = document.getElementById('searchInputGroup');

  radios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.value === 'profile') {
        profileGroup.style.display = 'block';
        searchGroup.style.display = 'none';
      } else {
        profileGroup.style.display = 'none';
        searchGroup.style.display = 'block';
      }
    });
  });

  // Save Configs
  document.getElementById('saveConfig').addEventListener('click', () => {
    // Get userEmail from storage since it's not in the form anymore
    chrome.storage.local.get(['userEmail'], (res) => {
      const config = {
        evoUrl: document.getElementById('evoUrl').value,
        evoKey: document.getElementById('evoKey').value,
        backendUrl: document.getElementById('backendUrl').value,
        userEmail: res.userEmail, // Use stored email
        maxLeads: document.getElementById('maxLeads').value,
        safetyDelay: document.getElementById('safetyDelay').value
      };
      chrome.storage.local.set(config, () => {
        const btn = document.getElementById('saveConfig');
        const originalText = btn.textContent;
        btn.textContent = 'Salvo!';
        setTimeout(() => btn.textContent = originalText, 2000);
      });
    });
  });

  // Start Scraping
  startBtn.addEventListener('click', () => {
    chrome.storage.local.get(['userEmail'], (res) => {
      const mode = document.querySelector('input[name="mode"]:checked').value;
      const targetProfile = document.getElementById('targetProfile').value;
      const searchTerm = document.getElementById('searchTerm').value;
      const maxLeads = document.getElementById('maxLeads').value;
      const safetyDelay = document.getElementById('safetyDelay').value;
      const backendUrl = document.getElementById('backendUrl').value;
      const userEmail = res.userEmail;

      if (!userEmail) {
        alert('Erro: E-mail não encontrado. Faça login novamente.');
        return;
      }

      if (mode === 'profile' && !targetProfile) {
        alert('Por favor, insira o perfil alvo.');
        return;
      }
      if (mode === 'search' && !searchTerm) {
        alert('Por favor, insira o termo de pesquisa.');
        return;
      }

      // Save current config before starting
      chrome.storage.local.set({
        targetProfile,
        searchTerm,
        maxLeads,
        safetyDelay,
        backendUrl
      });

      // Update UI
      startBtn.style.display = 'none';
      stopBtn.style.display = 'block';
      statusDiv.textContent = 'Iniciando...';
      document.getElementById('progressContainer').style.display = 'block';
      document.getElementById('progressBar').style.width = '0%';

      // Determine Action and Payload
      const action = mode === 'search' ? 'START_SEARCH' : 'START_SCRAPE';
      const payload = {
        action: action,
        target: targetProfile,
        term: searchTerm,
        maxLeads: parseInt(maxLeads),
        safetyDelay: parseInt(safetyDelay),
        userEmail: userEmail,
        backendUrl: backendUrl
      };

      // Send message to content script
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, payload);
        } else {
            statusDiv.textContent = "Erro: Nenhuma aba ativa encontrada.";
            startBtn.style.display = 'block';
            stopBtn.style.display = 'none';
        }
      });
    });
  });

  // Stop Scraping
  stopBtn.addEventListener('click', () => {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "STOP_SCRAPE" });
        statusDiv.textContent = 'Parando...';
        setTimeout(() => {
            statusDiv.textContent = 'Parado pelo usuário.';
            startBtn.style.display = 'block';
            stopBtn.style.display = 'none';
            document.getElementById('progressContainer').style.display = 'none';
        }, 1000);
      }
    });
  });
});