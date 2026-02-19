// R2D2 - TNS
// Content Script for Instagram Extension - Follower Extraction v3
if (window.instaleadScoutLoaded) {
    // Already loaded
} else {
    window.instaleadScoutLoaded = true;
}

let isScraping = false;
let config = {};
let scrapedCount = 0;
let processedCache = new Set();

// Contadores detalhados
let stats = {
  found: 0,        // Total encontrados na lista
  processed: 0,    // Total analisados (perfis visitados)
  withContact: 0,  // Com telefone/WhatsApp
  withoutContact: 0, // Sem contato
  errors: 0,       // Perfis inacessíveis
  sentToBackend: 0  // Enviados ao backend
};

// Carregar configurações e cache persistente
chrome.storage.local.get(['evoUrl', 'evoKey', 'backendUrl', 'searchState', 'userEmail', 'processedUsers'], (result) => {
  config = result;
  if (result.processedUsers) {
      processedCache = new Set(result.processedUsers);
  }
  
  if (result.searchState && result.searchState.active) {
      if (result.searchState.mode === 'search' && window.location.href.includes('/explore/search/')) {
          console.log("[Scout] Resuming search for:", result.searchState.term);
          isScraping = true;
          scrapedCount = result.searchState.count || 0;
          config.maxLeads = result.searchState.maxLeads || 50;
          startSearchScraping(result.searchState.term);
      }
  }
});

function checkLoginStatus() {
    if (document.querySelector('input[name="username"]') || document.querySelector('input[name="password"]')) {
        return false;
    }
    return true; 
}

// ==================== UI OVERLAY (MELHORADO) ====================
let overlayEl = null;
let overlayLog = null;

function createOverlay() {
    if (overlayEl) return;

    overlayEl = document.createElement('div');
    overlayEl.id = 'scout-overlay';
    overlayEl.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 520px;
        background: #0b0b0f;
        border: 1px solid #00FFFF33;
        border-radius: 16px;
        z-index: 2147483647;
        box-shadow: 0 0 60px rgba(0,255,255,0.1), 0 0 20px rgba(0,0,0,0.8);
        color: #f2f2f2;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        padding: 24px;
        display: flex;
        flex-direction: column;
    `;

    // Drag handle
    const header = document.createElement('div');
    header.style.cssText = `display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid #2a2a30; padding-bottom: 12px; cursor: move;`;
    header.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 10px; height: 10px; border-radius: 50%; background: #00FFFF; box-shadow: 0 0 8px #00FFFF88;"></div>
            <span style="font-size: 16px; font-weight: bold; color: #00FFFF; text-transform: uppercase; letter-spacing: 2px;">Instalead Scout</span>
        </div>
        <button id="scout-close" style="background: none; border: none; color: #666; cursor: pointer; font-size: 22px; line-height: 1;">&times;</button>
    `;

    // Barra de pesquisa / Info do alvo
    const searchInfo = document.createElement('div');
    searchInfo.id = 'scout-search-info';
    searchInfo.style.cssText = `
        background: #121217;
        border: 1px solid #2a2a30;
        border-radius: 10px;
        padding: 12px 16px;
        margin-bottom: 16px;
        display: flex;
        align-items: center;
        gap: 12px;
    `;
    searchInfo.innerHTML = `
        <div style="font-size: 24px;">🔍</div>
        <div style="flex: 1;">
            <div id="scout-target" style="font-size: 14px; font-weight: 600; color: #fff;">Aguardando...</div>
            <div id="scout-target-detail" style="font-size: 11px; color: #888; margin-top: 2px;">Nenhuma pesquisa ativa</div>
        </div>
        <div id="scout-status-badge" style="font-size: 11px; padding: 4px 10px; border-radius: 20px; background: #333; color: #aaa; font-weight: 500;">IDLE</div>
    `;

    // Stats cards
    const statsArea = document.createElement('div');
    statsArea.style.cssText = `display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px;`;
    statsArea.innerHTML = `
        <div style="background: #121217; border: 1px solid #2a2a30; border-radius: 8px; padding: 10px; text-align: center;">
            <div id="scout-stat-found" style="font-size: 20px; font-weight: bold; color: #00FFFF; font-family: monospace;">0</div>
            <div style="font-size: 10px; color: #888; text-transform: uppercase; margin-top: 2px;">Encontrados</div>
        </div>
        <div style="background: #121217; border: 1px solid #2a2a30; border-radius: 8px; padding: 10px; text-align: center;">
            <div id="scout-stat-processed" style="font-size: 20px; font-weight: bold; color: #9933FF; font-family: monospace;">0</div>
            <div style="font-size: 10px; color: #888; text-transform: uppercase; margin-top: 2px;">Analisados</div>
        </div>
        <div style="background: #121217; border: 1px solid #2a2a30; border-radius: 8px; padding: 10px; text-align: center;">
            <div id="scout-stat-contact" style="font-size: 20px; font-weight: bold; color: #00ff55; font-family: monospace;">0</div>
            <div style="font-size: 10px; color: #888; text-transform: uppercase; margin-top: 2px;">Com Contato</div>
        </div>
        <div style="background: #121217; border: 1px solid #2a2a30; border-radius: 8px; padding: 10px; text-align: center;">
            <div id="scout-stat-nocontact" style="font-size: 20px; font-weight: bold; color: #ff6644; font-family: monospace;">0</div>
            <div style="font-size: 10px; color: #888; text-transform: uppercase; margin-top: 2px;">Sem Contato</div>
        </div>
    `;

    // Progress bar
    const progressArea = document.createElement('div');
    progressArea.style.cssText = `margin-bottom: 16px;`;
    progressArea.innerHTML = `
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 12px;">
            <span id="scout-status-text" style="color: #aaa;">Aguardando...</span>
            <span id="scout-count" style="color: #00FFFF; font-weight: bold; font-family: monospace;">0/${config.maxLeads || '∞'}</span>
        </div>
        <div style="width: 100%; height: 8px; background: #1a1a1f; border-radius: 4px; overflow: hidden; position: relative;">
            <div id="scout-progress" style="width: 0%; height: 100%; background: linear-gradient(90deg, #9933FF, #00FFFF); transition: width 0.5s ease; border-radius: 4px; position: relative;">
                <div style="position: absolute; inset: 0; background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%); animation: shimmer 2s infinite;"></div>
            </div>
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: 4px; font-size: 10px; color: #666;">
            <span id="scout-pct">0%</span>
            <span id="scout-eta">--</span>
        </div>
    `;

    // Add shimmer animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(200%); } }
        #scout-overlay::-webkit-scrollbar { width: 4px; }
        #scout-overlay::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
    `;
    document.head.appendChild(style);

    // Terminal log
    const terminal = document.createElement('div');
    terminal.id = 'scout-terminal';
    terminal.style.cssText = `
        background: #000;
        border: 1px solid #222;
        border-radius: 8px;
        padding: 10px;
        height: 180px;
        overflow-y: auto;
        font-family: 'Courier New', monospace;
        font-size: 11px;
        color: #0f0;
        display: flex;
        flex-direction: column;
        gap: 3px;
        margin-bottom: 16px;
    `;
    overlayLog = terminal;

    // Actions
    const actions = document.createElement('div');
    actions.style.cssText = `display: flex; gap: 8px;`;
    actions.innerHTML = `
        <button id="scout-stop" style="flex: 1; background: #ff0055; color: white; border: none; padding: 10px 16px; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">⏹ Parar</button>
        <button id="scout-minimize" style="background: #1a1a1f; color: #888; border: 1px solid #333; padding: 10px 16px; border-radius: 8px; cursor: pointer; font-size: 12px;">Minimizar</button>
    `;

    overlayEl.appendChild(header);
    overlayEl.appendChild(searchInfo);
    overlayEl.appendChild(statsArea);
    overlayEl.appendChild(progressArea);
    overlayEl.appendChild(terminal);
    overlayEl.appendChild(actions);
    document.body.appendChild(overlayEl);

    // Drag support
    let isDragging = false, dragOffsetX = 0, dragOffsetY = 0;
    header.addEventListener('mousedown', (e) => {
        isDragging = true;
        const rect = overlayEl.getBoundingClientRect();
        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;
        overlayEl.style.transition = 'none';
    });
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        overlayEl.style.left = (e.clientX - dragOffsetX) + 'px';
        overlayEl.style.top = (e.clientY - dragOffsetY) + 'px';
        overlayEl.style.transform = 'none';
    });
    document.addEventListener('mouseup', () => { isDragging = false; });

    document.getElementById('scout-close').addEventListener('click', () => {
        overlayEl.remove();
        overlayEl = null;
        overlayLog = null;
    });

    document.getElementById('scout-stop').addEventListener('click', () => {
        stopScraping();
    });

    document.getElementById('scout-minimize').addEventListener('click', () => {
        const terminal = document.getElementById('scout-terminal');
        if (terminal.style.display === 'none') {
            terminal.style.display = 'flex';
            overlayEl.style.width = '520px';
        } else {
            terminal.style.display = 'none';
            overlayEl.style.width = '400px';
        }
    });
}

function setSearchTarget(target, detail) {
    if (!overlayEl) return;
    const el = document.getElementById('scout-target');
    const detailEl = document.getElementById('scout-target-detail');
    if (el) el.textContent = `@${target}`;
    if (detailEl) detailEl.textContent = detail || 'Extraindo seguidores...';
}

function setStatusBadge(text, color) {
    if (!overlayEl) return;
    const badge = document.getElementById('scout-status-badge');
    if (badge) {
        badge.textContent = text;
        badge.style.background = color === 'green' ? '#00ff5522' : color === 'yellow' ? '#ffaa0022' : color === 'red' ? '#ff005522' : '#333';
        badge.style.color = color === 'green' ? '#00ff55' : color === 'yellow' ? '#ffaa00' : color === 'red' ? '#ff0055' : '#aaa';
    }
}

function updateOverlayStats() {
    if (!overlayEl) return;
    const els = {
        found: document.getElementById('scout-stat-found'),
        processed: document.getElementById('scout-stat-processed'),
        contact: document.getElementById('scout-stat-contact'),
        nocontact: document.getElementById('scout-stat-nocontact'),
    };
    if (els.found) els.found.textContent = stats.found;
    if (els.processed) els.processed.textContent = stats.processed;
    if (els.contact) els.contact.textContent = stats.withContact;
    if (els.nocontact) els.nocontact.textContent = stats.withoutContact;
}

function updateOverlayLog(msg) {
    if (!overlayLog) return;
    const entry = document.createElement('div');
    entry.style.cssText = 'border-bottom: 1px solid #111; padding-bottom: 2px;';
    const time = new Date().toLocaleTimeString().split(' ')[0];
    
    // Color code messages
    let color = '#0f0';
    if (msg.includes('✅')) color = '#00ff55';
    else if (msg.includes('❌') || msg.includes('⚠️')) color = '#ff5555';
    else if (msg.includes('📱')) color = '#00FFFF';
    else if (msg.includes('⬇️') || msg.includes('🔄')) color = '#9933FF';
    
    entry.innerHTML = `<span style="color: #444;">[${time}]</span> <span style="color: ${color};">${msg}</span>`;
    overlayLog.prepend(entry);
    if (overlayLog.children.length > 150) overlayLog.removeChild(overlayLog.lastChild);
}

function updateOverlayProgress(count, total) {
    if (!overlayEl) return;
    const countEl = document.getElementById('scout-count');
    const progressEl = document.getElementById('scout-progress');
    const pctEl = document.getElementById('scout-pct');
    if (countEl) countEl.textContent = `${count}/${total || '∞'}`;
    if (progressEl && total && total !== '∞') {
        const pct = Math.min((count / total) * 100, 100);
        progressEl.style.width = `${pct}%`;
        if (pctEl) pctEl.textContent = `${Math.round(pct)}%`;
    }
}

// ==================== MESSAGE HANDLER ====================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.maxLeads) config.maxLeads = request.maxLeads;
  if (request.safetyDelay) config.safetyDelay = request.safetyDelay;
  if (request.userEmail) config.userEmail = request.userEmail;
  if (request.backendUrl) config.backendUrl = request.backendUrl;

  if (request.action === "OPEN_OVERLAY") {
      createOverlay();
      sendStatus("Painel Flutuante Ativado");
      if (isScraping) {
          updateOverlayProgress(scrapedCount, config.maxLeads);
          updateOverlayStats();
      }
      sendResponse({ status: "opened" });
  }

  if (request.action === "START_SCRAPE" || request.action === "START_SEARCH") {
      if (!checkLoginStatus()) {
          sendStatus("⚠️ ERRO: Você não está logado no Instagram!");
          alert("Por favor, faça login no Instagram antes de iniciar.");
          sendResponse({ status: "error", message: "not_logged_in" });
          return;
      }
  }

  if (request.action === "START_SCRAPE") {
    isScraping = true;
    scrapedCount = 0;
    stats = { found: 0, processed: 0, withContact: 0, withoutContact: 0, errors: 0, sentToBackend: 0 };
    processedCache.clear();
    const target = request.target.replace('@', '').trim();
    sendStatus(`🚀 Iniciando extração de seguidores de: @${target}`);
    
    chrome.storage.local.set({ 
        searchState: { 
            active: true, 
            target: target,
            mode: 'profile',
            maxLeads: config.maxLeads,
            count: 0
        } 
    });
    
    startFollowerExtraction(target);
    sendResponse({ status: "started" });
  } else if (request.action === "START_SEARCH") {
    isScraping = true;
    scrapedCount = 0;
    stats = { found: 0, processed: 0, withContact: 0, withoutContact: 0, errors: 0, sentToBackend: 0 };
    const term = request.term;
    
    chrome.storage.local.set({ 
        searchState: { 
            active: true, 
            term: term, 
            mode: 'search',
            maxLeads: config.maxLeads 
        } 
    }, () => {
        window.location.href = `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(term)}`;
    });
    sendResponse({ status: "redirecting" });
  } else if (request.action === "STOP_SCRAPE") {
    stopScraping();
    sendResponse({ status: "stopped" });
  }
});

// ==================== CORE FUNCTIONS ====================

function stopScraping() {
    isScraping = false;
    chrome.storage.local.remove(['searchState']);
    console.log("[Scout] Parando...");
    sendStatus(`⏹️ Extração parada. Processados: ${stats.processed} | Com contato: ${stats.withContact} | Sem contato: ${stats.withoutContact}`);
    setStatusBadge('PARADO', 'red');
    chrome.runtime.sendMessage({ action: "SCRAPE_COMPLETE", stats });
}

function sendStatus(msg) {
    chrome.runtime.sendMessage({ action: "UPDATE_STATUS", message: msg });
    if (overlayEl) {
        const el = document.getElementById('scout-status-text');
        if (el) el.textContent = msg;
        updateOverlayLog(msg);
    }
}

async function updateProgress() {
    chrome.runtime.sendMessage({ 
        action: "UPDATE_PROGRESS", 
        count: scrapedCount, 
        total: config.maxLeads,
        stats: stats
    });
    updateOverlayProgress(scrapedCount, config.maxLeads);
    updateOverlayStats();
}

// ==================== FOLLOWER EXTRACTION ====================

async function startFollowerExtraction(targetUsername) {
    createOverlay();
    setSearchTarget(targetUsername, `Extraindo seguidores (máx: ${config.maxLeads})`);
    setStatusBadge('ATIVO', 'green');
    
    sendStatus(`📍 Navegando para @${targetUsername}...`);
    const profileUrl = `https://www.instagram.com/${targetUsername}/`;
    
    if (!window.location.href.includes(`/${targetUsername}/`)) {
        window.location.href = profileUrl;
        chrome.storage.local.set({ 
            searchState: { 
                active: true, 
                target: targetUsername,
                mode: 'profile',
                maxLeads: config.maxLeads,
                count: 0,
                step: 'open_followers'
            } 
        });
        return;
    }
    
    await sleep(3000);
    
    sendStatus(`👥 Abrindo lista de seguidores...`);
    setStatusBadge('ABRINDO LISTA', 'yellow');
    const followersOpened = await openFollowersList(targetUsername);
    
    if (!followersOpened) {
        sendStatus("❌ Não foi possível abrir a lista de seguidores. Conta pode ser privada.");
        setStatusBadge('ERRO', 'red');
        stopScraping();
        return;
    }
    
    await sleep(2000);
    
    setStatusBadge('EXTRAINDO', 'green');
    sendStatus(`🔄 Extraindo seguidores...`);
    await scrollAndExtractFollowers(targetUsername);
}

async function openFollowersList(targetUsername) {
    const selectors = [
        `a[href="/${targetUsername}/followers/"]`,
        `a[href="/${targetUsername}/followers"]`,
    ];
    
    for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) {
            el.click();
            await sleep(2000);
            const dialog = document.querySelector('div[role="dialog"]');
            if (dialog) return true;
        }
    }
    
    const allLinks = document.querySelectorAll('a');
    for (const link of allLinks) {
        const href = link.getAttribute('href') || '';
        const text = link.textContent || '';
        if (href.includes('followers') || text.toLowerCase().includes('seguidores') || text.toLowerCase().includes('followers')) {
            link.click();
            await sleep(2000);
            const dialog = document.querySelector('div[role="dialog"]');
            if (dialog) return true;
        }
    }
    
    sendStatus("Tentando abrir seguidores via URL...");
    window.location.href = `https://www.instagram.com/${targetUsername}/followers/`;
    await sleep(3000);
    
    const dialog = document.querySelector('div[role="dialog"]');
    return !!dialog;
}

async function scrollAndExtractFollowers(targetUsername) {
    const dialog = document.querySelector('div[role="dialog"]');
    if (!dialog) {
        sendStatus("❌ Dialog de seguidores não encontrado!");
        stopScraping();
        return;
    }
    
    let scrollContainer = null;
    const scrollableDivs = dialog.querySelectorAll('div[style*="overflow"]');
    if (scrollableDivs.length > 0) {
        scrollContainer = scrollableDivs[scrollableDivs.length - 1];
    }
    
    if (!scrollContainer) {
        const allDivs = dialog.querySelectorAll('div');
        for (const div of allDivs) {
            if (div.scrollHeight > div.clientHeight && div.clientHeight > 100) {
                scrollContainer = div;
                break;
            }
        }
    }
    
    if (!scrollContainer) {
        sendStatus("⚠️ Container de scroll não encontrado. Tentando scroll no dialog...");
        scrollContainer = dialog;
    }
    
    const extractedFollowers = new Map();
    let noNewCount = 0;
    
    while (isScraping && scrapedCount < config.maxLeads) {
        // Extrair usernames visíveis
        const followerLinks = dialog.querySelectorAll('a[href^="/"]');
        let newFound = 0;
        
        for (const link of followerLinks) {
            const href = link.getAttribute('href') || '';
            const username = href.replace(/\//g, '');
            
            if (!username || 
                username === targetUsername ||
                username.includes('explore') ||
                username.includes('p') ||
                username.includes('reels') ||
                username.includes('stories') ||
                username.includes('direct') ||
                username.includes('accounts') ||
                username.includes('legal') ||
                username.includes('about') ||
                username.includes('.') === false && username.length < 2 ||
                extractedFollowers.has(username)) {
                continue;
            }
            
            if (!/^[\w.]+$/.test(username)) continue;
            
            let displayName = '';
            const parentLi = link.closest('div[role="dialog"] div') || link.parentElement;
            if (parentLi) {
                const spans = parentLi.querySelectorAll('span');
                for (const span of spans) {
                    const text = span.textContent.trim();
                    if (text && text !== username && text !== 'Seguir' && text !== 'Follow' && 
                        text !== 'Seguindo' && text !== 'Following' && text !== 'Remover' && 
                        text !== 'Remove' && !text.includes('Verificado') && text.length > 1 &&
                        text.length < 60) {
                        displayName = text;
                        break;
                    }
                }
            }
            
            extractedFollowers.set(username, { displayName });
            newFound++;
            stats.found++;
        }
        
        if (newFound > 0) {
            noNewCount = 0;
            sendStatus(`📋 ${extractedFollowers.size} seguidores na lista | Analisados: ${stats.processed}/${config.maxLeads}`);
            updateOverlayStats();
        } else {
            noNewCount++;
        }
        
        // Processar seguidores não processados
        const unprocessed = [];
        for (const [username, data] of extractedFollowers) {
            if (!processedCache.has(username)) {
                unprocessed.push({ username, ...data });
            }
        }
        
        // Processar cada seguidor
        for (const follower of unprocessed) {
            if (!isScraping || scrapedCount >= config.maxLeads) break;
            
            processedCache.add(follower.username);
            
            sendStatus(`🔍 Analisando @${follower.username}...`);
            setStatusBadge(`${stats.processed + 1}/${config.maxLeads}`, 'green');
            const profileData = await fetchProfileData(follower.username);
            
            if (profileData) {
                const bio = profileData.biography || "";
                const externalUrl = profileData.external_url || "";
                const fullName = profileData.full_name || follower.displayName || "";
                const phones = extractPhones(bio + " " + externalUrl);
                
                scrapedCount++;
                stats.processed++;
                
                const leadData = {
                    username: follower.username,
                    fullName,
                    bio,
                    externalUrl,
                    phones,
                    source: 'extension_followers',
                    sourceProfile: targetUsername,
                    hasContact: phones.length > 0
                };
                
                if (phones.length > 0) {
                    stats.withContact++;
                    sendStatus(`✅ @${follower.username} - ${fullName} - 📱 ${phones.join(', ')}`);
                } else {
                    stats.withoutContact++;
                    sendStatus(`⚪ @${follower.username} - ${fullName} - sem contato`);
                }
                
                // ENVIAR TODOS ao backend (com e sem contato)
                if (config.backendUrl) {
                    await sendToBackend(leadData);
                    stats.sentToBackend++;
                }
                
                updateProgress();
                
                // Salvar cache periodicamente
                if (scrapedCount % 10 === 0) {
                    chrome.storage.local.set({ 
                        processedUsers: Array.from(processedCache),
                        leadsTotal: scrapedCount,
                        searchState: {
                            active: true,
                            target: targetUsername,
                            mode: 'profile',
                            maxLeads: config.maxLeads,
                            count: scrapedCount,
                            step: 'extracting'
                        }
                    });
                }
                
                // Delay de segurança
                const delay = (config.safetyDelay || 5) * 1000;
                await sleep(delay + Math.random() * 2000);
            } else {
                stats.errors++;
                stats.processed++;
                scrapedCount++;
                sendStatus(`⚠️ @${follower.username} - perfil inacessível`);
                updateProgress();
                await sleep(1000);
            }
        }
        
        if (noNewCount >= 5) {
            sendStatus(`📊 Fim da lista! ${stats.processed} analisados | ${stats.withContact} com contato | ${stats.withoutContact} sem contato`);
            break;
        }
        
        sendStatus("⬇️ Carregando mais seguidores...");
        scrollContainer.scrollTop += 600;
        await sleep(2000 + Math.random() * 1500);
    }
    
    // Finalizar
    sendStatus(`🏁 Concluído! Processados: ${stats.processed} | Com contato: ${stats.withContact} | Sem: ${stats.withoutContact} | Enviados: ${stats.sentToBackend}`);
    setStatusBadge('CONCLUÍDO', 'green');
    chrome.storage.local.set({ 
        processedUsers: Array.from(processedCache),
        leadsTotal: scrapedCount
    });
    stopScraping();
}

// ==================== SEARCH MODE ====================

async function startSearchScraping(term) {
    createOverlay();
    setSearchTarget(term, 'Pesquisando perfis...');
    setStatusBadge('PESQUISANDO', 'yellow');
    
    sendStatus("Aguardando carregamento dos resultados...");
    await sleep(5000); 

    const processedInSession = new Set();
    let noNewItemsAttempts = 0;
    let lastScrollHeight = 0;
    
    while (isScraping) {
        if (scrapedCount >= config.maxLeads) {
            sendStatus("Limite de leads atingido!");
            stopScraping();
            break;
        }

        const currentScrollHeight = document.body.scrollHeight;
        if (currentScrollHeight === lastScrollHeight) {
            noNewItemsAttempts++;
            sendStatus(`Sem novos itens... tentativa ${noNewItemsAttempts}/5`);
            if (noNewItemsAttempts > 5) {
                sendStatus("Fim dos resultados. Parando.");
                stopScraping();
                break;
            }
        } else {
            noNewItemsAttempts = 0;
            lastScrollHeight = currentScrollHeight;
        }

        const links = Array.from(document.querySelectorAll('a[href^="/"]'));
        let foundNewInBatch = false;
        
        for (let link of links) {
            if (!isScraping || scrapedCount >= config.maxLeads) break;
            
            const href = link.getAttribute('href');
            if (href.match(/^\/[\w\.]+\/$/) && 
                !href.startsWith('/explore/') && 
                !href.startsWith('/p/') && 
                !href.startsWith('/reels/') && 
                !href.startsWith('/stories/') &&
                !href.startsWith('/direct/') &&
                !href.startsWith('/accounts/') &&
                !href.includes('legal') && 
                !href.includes('about')) {
                
                const username = href.replace(/\//g, '');
                
                if (!processedInSession.has(username) && !processedCache.has(username)) {
                    processedInSession.add(username);
                    foundNewInBatch = true;
                    stats.found++;
                    sendStatus(`Verificando perfil: ${username}`);
                    
                    const success = await processUser(username);
                    stats.processed++;
                    if (success) {
                        scrapedCount++;
                        stats.withContact++;
                        updateProgress();
                        processedCache.add(username);
                        chrome.storage.local.set({ processedUsers: Array.from(processedCache) });
                        
                        const delay = (config.safetyDelay || 5) * 1000;
                        await sleep(delay + Math.random() * 2000);
                    } else {
                        stats.withoutContact++;
                        updateProgress();
                    }
                }
            }
        }

        window.scrollBy(0, 1000);
        await sleep(3000 + Math.random() * 3000);
    }
}

// ==================== PROFILE DATA & UTILS ====================

async function processUser(username) {
  try {
    await sleep(2000 + Math.random() * 3000);
    const profileData = await fetchProfileData(username);
    
    if (!profileData) {
      stats.errors++;
      return false;
    }

    const bio = profileData.biography || "";
    const externalUrl = profileData.external_url || "";
    const fullName = profileData.full_name || "";
    const phones = extractPhones(bio + " " + externalUrl);
    
    // Enviar TODOS ao backend (com e sem contato)
    if (config.backendUrl) {
      await sendToBackend({
        username,
        fullName,
        bio,
        externalUrl,
        phones,
        source: 'extension_direct',
        hasContact: phones.length > 0
      });
      stats.sentToBackend++;
    }
    
    if (phones.length > 0) {
      sendStatus(`✅ ${username} - 📱 ${phones.join(', ')}`);
      return true;
    } else {
      sendStatus(`⚪ ${username} - ${fullName || 'sem nome'} - sem contato`);
      return false;
    }
  } catch (e) {
    console.error(`Erro ao processar ${username}:`, e);
    stats.errors++;
    return false;
  }
}

async function fetchProfileData(username) {
  try {
    const response = await fetch(`https://www.instagram.com/${username}/`, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'X-Requested-With': 'XMLHttpRequest'
      },
      credentials: 'include'
    });
    
    if (!response.ok) {
      console.log(`[Scout] Perfil ${username} retornou ${response.status}`);
      return null;
    }
    
    const html = await response.text();
    
    // Método 1: JSON embarcado
    const bioMatch = html.match(/"biography":"(.*?)"/);
    const urlMatch = html.match(/"external_url":"(.*?)"/);
    const nameMatch = html.match(/"full_name":"(.*?)"/);
    
    if (bioMatch || nameMatch) {
      return {
        biography: bioMatch ? JSON.parse(`"${bioMatch[1]}"`) : "",
        external_url: urlMatch ? JSON.parse(`"${urlMatch[1]}"`) : "",
        full_name: nameMatch ? JSON.parse(`"${nameMatch[1]}"`) : ""
      };
    }
    
    // Método 2: Meta tags
    const metaDesc = html.match(/<meta property="og:description" content="([^"]+)"/);
    const metaTitle = html.match(/<meta property="og:title" content="([^"]+)"/);
    
    if (metaDesc) {
      return {
        biography: metaDesc[1] || "",
        external_url: "",
        full_name: metaTitle ? metaTitle[1].split('(')[0].trim() : ""
      };
    }
    
    // Método 3: API interna GraphQL
    try {
      const apiResp = await fetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`, {
        headers: {
          'X-IG-App-ID': '936619743392459',
          'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'include'
      });
      
      if (apiResp.ok) {
        const apiData = await apiResp.json();
        const user = apiData?.data?.user;
        if (user) {
          return {
            biography: user.biography || "",
            external_url: user.external_url || "",
            full_name: user.full_name || ""
          };
        }
      }
    } catch (apiErr) {
      console.log(`[Scout] API fallback falhou para ${username}`);
    }
    
    return null;
  } catch (e) {
    console.error("Erro no fetchProfileData:", e);
    return null;
  }
}

function extractPhones(text) {
  if (!text) return [];
  const phones = [];
  
  // Links de WhatsApp
  const waRegex = /(?:wa\.me|api\.whatsapp\.com\/send\?phone=)(\d+)/g;
  let match;
  while ((match = waRegex.exec(text)) !== null) {
    phones.push(match[1]);
  }
  
  // Telefones brasileiros
  const phoneRegex = /(?:\+?55\s?)?(?:\(?0?\d{2}\)?[\s.-]?)?\d{4,5}[\s.-]?\d{4}/g;
  while ((match = phoneRegex.exec(text)) !== null) {
    let cleanNumber = match[0].replace(/\D/g, '');
    if (cleanNumber.length >= 10 && cleanNumber.length <= 11) {
      cleanNumber = '55' + cleanNumber;
    }
    if (!phones.includes(cleanNumber)) {
      phones.push(cleanNumber);
    }
  }

  // Internacionais
  const intlPhoneRegex = /\+\d{1,3}[\s.-]?\d{2,4}[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g;
  while ((match = intlPhoneRegex.exec(text)) !== null) {
      let cleanNumber = match[0].replace(/\D/g, '');
      if (cleanNumber.length >= 10 && !phones.includes(cleanNumber)) {
          phones.push(cleanNumber);
      }
  }
  
  return phones;
}

async function sendToBackend(data) {
  try {
    const response = await fetch(config.backendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, userEmail: config.userEmail })
    });
    console.log(`📤 Enviado ${data.username}:`, response.status);
  } catch (e) {
    console.error("Erro ao enviar para backend:", e);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== AUTO-RESUME ON PAGE LOAD ====================
setTimeout(() => {
    chrome.storage.local.get(['searchState', 'userEmail', 'backendUrl', 'maxLeads', 'safetyDelay'], (result) => {
        if (result.searchState && result.searchState.active && result.searchState.mode === 'profile') {
            const target = result.searchState.target;
            config.userEmail = result.userEmail;
            config.backendUrl = result.backendUrl;
            config.maxLeads = result.searchState.maxLeads || result.maxLeads || 50;
            config.safetyDelay = result.safetyDelay || 5;
            
            if (window.location.href.includes(`/${target}/`)) {
                if (result.searchState.step === 'open_followers') {
                    console.log(`[Scout] Retomando: abrindo seguidores de @${target}`);
                    isScraping = true;
                    scrapedCount = result.searchState.count || 0;
                    
                    setTimeout(async () => {
                        createOverlay();
                        setSearchTarget(target, 'Retomando extração...');
                        setStatusBadge('RETOMANDO', 'yellow');
                        sendStatus(`📍 Na página de @${target}, abrindo seguidores...`);
                        
                        const opened = await openFollowersList(target);
                        if (opened) {
                            await sleep(2000);
                            await scrollAndExtractFollowers(target);
                        } else {
                            sendStatus("❌ Não foi possível abrir seguidores. Conta pode ser privada.");
                            stopScraping();
                        }
                    }, 3000);
                }
            }
        }
    });
}, 2000);
