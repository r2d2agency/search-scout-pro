document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const statusDiv = document.getElementById('status');
  
  // Carregar configs salvas
  chrome.storage.local.get(['evoUrl', 'evoKey', 'backendUrl', 'targetProfile', 'searchTerm', 'searchState', 'userEmail', 'maxLeads', 'safetyDelay'], (result) => {
    if (result.evoUrl) document.getElementById('evoUrl').value = result.evoUrl;
    if (result.evoKey) document.getElementById('evoKey').value = result.evoKey;
    if (result.backendUrl) document.getElementById('backendUrl').value = result.backendUrl;
    if (result.targetProfile) document.getElementById('targetProfile').value = result.targetProfile;
    if (result.searchTerm) document.getElementById('searchTerm').value = result.searchTerm;
    if (result.userEmail) document.getElementById('userEmail').value = result.userEmail;
    if (result.maxLeads) document.getElementById('maxLeads').value = result.maxLeads;
    if (result.safetyDelay) document.getElementById('safetyDelay').value = result.safetyDelay;

    // Check if search is active
    if (result.searchState && result.searchState.active) {
        const count = result.searchState.count || 0;
        const total = result.searchState.total || result.maxLeads || '∞';
        
        statusDiv.textContent = `Rodando: ${result.searchState.term || result.searchState.target}`;
        startBtn.style.display = 'none';
        stopBtn.style.display = 'block';
        
        // Show progress
        document.getElementById('progressContainer').style.display = 'block';
        document.getElementById('progressCount').textContent = `${count}/${total}`;
        
        if (total !== '∞') {
            const pct = Math.min((count / total) * 100, 100);
            document.getElementById('progressBar').style.width = `${pct}%`;
        }
        
        // Select search mode if needed
        if (result.searchState.mode === 'search') {
            const searchRadio = document.querySelector('input[value="search"]');
            if (searchRadio) {
                searchRadio.checked = true;
                setTimeout(() => searchRadio.dispatchEvent(new Event('change')), 100);
            }
        }
    }
  });

  // Listener para updates de progresso do content script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === "UPDATE_PROGRESS") {
          const count = request.count;
          const total = request.total || '∞';
          
          document.getElementById('progressCount').textContent = `${count}/${total}`;
          if (total !== '∞' && total > 0) {
              const pct = Math.min((count / total) * 100, 100);
              document.getElementById('progressBar').style.width = `${pct}%`;
          }
      } else if (request.action === "SCRAPE_COMPLETE") {
          statusDiv.textContent = 'Concluído!';
          startBtn.style.display = 'block';
          stopBtn.style.display = 'none';
          document.getElementById('progressContainer').style.display = 'none';
          chrome.storage.local.remove(['searchState']);
      }
  });

  // Toggle Mode
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

  // Salvar Configs
  document.getElementById('saveConfig').addEventListener('click', () => {
    const config = {
      evoUrl: document.getElementById('evoUrl').value,
      evoKey: document.getElementById('evoKey').value,
      backendUrl: document.getElementById('backendUrl').value,
      userEmail: document.getElementById('userEmail').value,
      maxLeads: document.getElementById('maxLeads').value,
      safetyDelay: document.getElementById('safetyDelay').value
    };
    chrome.storage.local.set(config, () => {
      statusDiv.textContent = 'Configurações salvas!';
      setTimeout(() => statusDiv.textContent = 'Aguardando...', 2000);
    });
  });

  // Iniciar Scraping
  startBtn.addEventListener('click', () => {
    const userEmail = document.getElementById('userEmail').value;
    if (!userEmail) return alert('Configure seu Email primeiro!');

    const mode = document.querySelector('input[name="mode"]:checked').value;
    const maxLeads = parseInt(document.getElementById('maxLeads').value) || 50;
    const safetyDelay = parseInt(document.getElementById('safetyDelay').value) || 5;
    
    let message = { 
        maxLeads, 
        safetyDelay,
        userEmail 
    };

    if (mode === 'profile') {
      const target = document.getElementById('targetProfile').value;
      if (!target) return alert('Digite um perfil alvo!');
      chrome.storage.local.set({ targetProfile: target });
      message = { ...message, action: "START_SCRAPE", target: target.replace('@', '') };
    } else {
      const term = document.getElementById('searchTerm').value;
      if (!term) return alert('Digite um termo de pesquisa!');
      chrome.storage.local.set({ searchTerm: term });
      message = { ...message, action: "START_SEARCH", term: term };
    }
    
    // UI Update
    document.getElementById('progressContainer').style.display = 'block';
    document.getElementById('progressCount').textContent = `0/${maxLeads}`;
    document.getElementById('progressBar').style.width = `0%`;

    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      const activeTab = tabs[0];
      if (!activeTab.url.includes('instagram.com')) {
        return alert('Por favor, abra o Instagram na aba atual!');
      }

      // Enviar mensagem para o content script
      chrome.tabs.sendMessage(activeTab.id, message, (response) => {
        if (chrome.runtime.lastError) {
          statusDiv.textContent = 'Erro: Recarregue a página do Instagram!';
        } else {
          statusDiv.textContent = 'Iniciando... Verifique o console da página.';
          startBtn.style.display = 'none';
          stopBtn.style.display = 'block';
        }
      });
    });
  });

  stopBtn.addEventListener('click', () => {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: "STOP_SCRAPE" });
      statusDiv.textContent = 'Parando...';
      startBtn.style.display = 'block';
      stopBtn.style.display = 'none';
    });
  });
});