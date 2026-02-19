// R2D2 - TNS
// Content Script for Instagram Extension - Follower Extraction v2
if (window.instaleadScoutLoaded) {
    // Already loaded
} else {
    window.instaleadScoutLoaded = true;
}

let isScraping = false;
let config = {};
let scrapedCount = 0;
let processedCache = new Set();

// Carregar configurações e cache persistente
chrome.storage.local.get(['evoUrl', 'evoKey', 'backendUrl', 'searchState', 'userEmail', 'processedUsers'], (result) => {
  config = result;
  if (result.processedUsers) {
      processedCache = new Set(result.processedUsers);
  }
  
  // Resume Search if active
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

// ==================== UI OVERLAY ====================
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
        width: 500px;
        background: #0b0b0f;
        border: 1px solid #2a2a30;
        border-radius: 12px;
        z-index: 2147483647;
        box-shadow: 0 0 50px rgba(0,0,0,0.9);
        color: #f2f2f2;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        padding: 20px;
        display: flex;
        flex-direction: column;
    `;

    const header = document.createElement('div');
    header.style.cssText = `display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px solid #2a2a30; padding-bottom: 10px;`;
    header.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 18px; font-weight: bold; color: #00FFFF; text-transform: uppercase; letter-spacing: 1px;">Instalead Scout</span>
        </div>
        <button id="scout-close" style="background: none; border: none; color: #666; cursor: pointer; font-size: 20px;">&times;</button>
    `;

    const statusArea = document.createElement('div');
    statusArea.innerHTML = `
        <div style="display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 12px; color: #aaa;">
            <span id="scout-status-text">Aguardando...</span>
            <span id="scout-count">0/0</span>
        </div>
        <div style="width: 100%; height: 6px; background: #1a1a1f; border-radius: 3px; overflow: hidden; margin-bottom: 15px;">
            <div id="scout-progress" style="width: 0%; height: 100%; background: linear-gradient(90deg, #9933FF, #00FFFF); transition: width 0.3s;"></div>
        </div>
    `;

    const terminal = document.createElement('div');
    terminal.id = 'scout-terminal';
    terminal.style.cssText = `
        background: #000;
        border: 1px solid #333;
        border-radius: 4px;
        padding: 10px;
        height: 200px;
        overflow-y: auto;
        font-family: 'Courier New', monospace;
        font-size: 11px;
        color: #0f0;
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-bottom: 15px;
    `;
    overlayLog = terminal;

    const actions = document.createElement('div');
    actions.style.textAlign = 'right';
    actions.innerHTML = `
        <button id="scout-stop" style="background: #ff0055; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: bold;">PARAR EXTRAÇÃO</button>
    `;

    overlayEl.appendChild(header);
    overlayEl.appendChild(statusArea);
    overlayEl.appendChild(terminal);
    overlayEl.appendChild(actions);
    document.body.appendChild(overlayEl);

    document.getElementById('scout-close').addEventListener('click', () => {
        overlayEl.remove();
        overlayEl = null;
        overlayLog = null;
    });

    document.getElementById('scout-stop').addEventListener('click', () => {
        stopScraping();
    });
}

function updateOverlayLog(msg) {
    if (!overlayLog) return;
    const entry = document.createElement('div');
    entry.style.borderBottom = '1px solid #111';
    entry.style.paddingBottom = '2px';
    const time = new Date().toLocaleTimeString().split(' ')[0];
    entry.innerHTML = `<span style="color: #666;">[${time}]</span> ${msg}`;
    overlayLog.prepend(entry);
    if (overlayLog.children.length > 100) overlayLog.removeChild(overlayLog.lastChild);
}

function updateOverlayProgress(count, total) {
    if (!overlayEl) return;
    const countEl = document.getElementById('scout-count');
    const progressEl = document.getElementById('scout-progress');
    if (countEl) countEl.textContent = `${count}/${total || '∞'}`;
    if (progressEl && total && total !== '∞') {
        const pct = Math.min((count / total) * 100, 100);
        progressEl.style.width = `${pct}%`;
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
    processedCache.clear(); // Limpa cache para nova extração
    const target = request.target.replace('@', '').trim();
    sendStatus(`🚀 Iniciando extração de seguidores de: @${target}`);
    console.log(`[Scout] Iniciando extração de seguidores: @${target}`);
    
    // Salvar estado
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
    const term = request.term;
    console.log(`[Scout] Iniciando pesquisa por: ${term}`);
    
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
    sendStatus("⏹️ Extração parada.");
    chrome.runtime.sendMessage({ action: "SCRAPE_COMPLETE" });
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
        total: config.maxLeads 
    });
    updateOverlayProgress(scrapedCount, config.maxLeads);
}

// ==================== FOLLOWER EXTRACTION (NEW) ====================

async function startFollowerExtraction(targetUsername) {
    createOverlay(); // Sempre abrir overlay para acompanhar
    
    // Step 1: Navegar para o perfil alvo
    sendStatus(`📍 Navegando para @${targetUsername}...`);
    const profileUrl = `https://www.instagram.com/${targetUsername}/`;
    
    if (!window.location.href.includes(`/${targetUsername}/`)) {
        window.location.href = profileUrl;
        // Aguardar navegação - o script será recarregado
        // Salvar estado para retomar após reload
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
    
    // Step 2: Clicar no botão "seguidores"
    sendStatus(`👥 Abrindo lista de seguidores...`);
    const followersOpened = await openFollowersList(targetUsername);
    
    if (!followersOpened) {
        sendStatus("❌ Não foi possível abrir a lista de seguidores. Conta pode ser privada.");
        stopScraping();
        return;
    }
    
    await sleep(2000);
    
    // Step 3: Scrollar a lista e extrair seguidores
    sendStatus(`🔄 Extraindo seguidores...`);
    await scrollAndExtractFollowers(targetUsername);
}

async function openFollowersList(targetUsername) {
    // Tentar encontrar o link/botão de seguidores
    // Instagram usa diferentes seletores dependendo da versão
    const selectors = [
        `a[href="/${targetUsername}/followers/"]`,
        `a[href="/${targetUsername}/followers"]`,
        // Fallback: procurar por texto
    ];
    
    for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) {
            el.click();
            await sleep(2000);
            // Verificar se o dialog abriu
            const dialog = document.querySelector('div[role="dialog"]');
            if (dialog) return true;
        }
    }
    
    // Fallback: buscar links que contenham "followers" no texto ou aria-label
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
    
    // Último fallback: navegar diretamente para URL de seguidores
    sendStatus("Tentando abrir seguidores via URL...");
    window.location.href = `https://www.instagram.com/${targetUsername}/followers/`;
    await sleep(3000);
    
    const dialog = document.querySelector('div[role="dialog"]');
    return !!dialog;
}

async function scrollAndExtractFollowers(targetUsername) {
    // Encontrar o container scrollável dentro do dialog de seguidores
    const dialog = document.querySelector('div[role="dialog"]');
    if (!dialog) {
        sendStatus("❌ Dialog de seguidores não encontrado!");
        stopScraping();
        return;
    }
    
    // Encontrar a div com scroll dentro do dialog
    let scrollContainer = null;
    const scrollableDivs = dialog.querySelectorAll('div[style*="overflow"]');
    if (scrollableDivs.length > 0) {
        scrollContainer = scrollableDivs[scrollableDivs.length - 1]; // Último é geralmente o correto
    }
    
    // Fallback: procurar qualquer div scrollável no dialog
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
    
    const extractedFollowers = new Map(); // username -> data
    let noNewCount = 0;
    let lastCount = 0;
    
    while (isScraping && scrapedCount < config.maxLeads) {
        // Extrair usernames visíveis na lista
        const followerLinks = dialog.querySelectorAll('a[href^="/"]');
        let newFound = 0;
        
        for (const link of followerLinks) {
            const href = link.getAttribute('href') || '';
            const username = href.replace(/\//g, '');
            
            // Filtrar links que não são perfis
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
            
            // Verificar se parece um username válido (alfanumérico, ponto, underscore)
            if (!/^[\w.]+$/.test(username)) continue;
            
            // Pegar o nome que geralmente aparece perto do link
            let displayName = '';
            const parentLi = link.closest('div[role="dialog"] div') || link.parentElement;
            if (parentLi) {
                // Buscar spans com texto (nome completo geralmente é o segundo texto)
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
        }
        
        if (newFound > 0) {
            noNewCount = 0;
            sendStatus(`📋 ${extractedFollowers.size} seguidores encontrados na lista (processados: ${scrapedCount}/${config.maxLeads})`);
        } else {
            noNewCount++;
        }
        
        // Processar seguidores não processados em lote
        const unprocessed = [];
        for (const [username, data] of extractedFollowers) {
            if (!processedCache.has(username)) {
                unprocessed.push({ username, ...data });
            }
        }
        
        // Processar cada seguidor (buscar bio/WhatsApp)
        for (const follower of unprocessed) {
            if (!isScraping || scrapedCount >= config.maxLeads) break;
            
            processedCache.add(follower.username);
            
            sendStatus(`🔍 Analisando @${follower.username}...`);
            const profileData = await fetchProfileData(follower.username);
            
            if (profileData) {
                const bio = profileData.biography || "";
                const externalUrl = profileData.external_url || "";
                const fullName = profileData.full_name || follower.displayName || "";
                const phones = extractPhones(bio + " " + externalUrl);
                
                scrapedCount++;
                updateProgress();
                
                if (phones.length > 0) {
                    sendStatus(`✅ @${follower.username} - ${fullName} - 📱 ${phones.join(', ')}`);
                    
                    if (config.backendUrl) {
                        await sendToBackend({
                            username: follower.username,
                            fullName,
                            bio,
                            externalUrl,
                            phones,
                            source: 'extension_followers',
                            sourceProfile: targetUsername
                        });
                    }
                } else {
                    sendStatus(`⚪ @${follower.username} - ${fullName} - sem contato`);
                }
                
                // Salvar cache periodicamente
                if (scrapedCount % 10 === 0) {
                    chrome.storage.local.set({ 
                        processedUsers: Array.from(processedCache),
                        leadsTotal: scrapedCount
                    });
                }
                
                // Delay de segurança entre perfis
                const delay = (config.safetyDelay || 5) * 1000;
                await sleep(delay + Math.random() * 2000);
            } else {
                sendStatus(`⚠️ @${follower.username} - perfil inacessível`);
                await sleep(1000);
            }
        }
        
        // Parar se já processou tudo e não tem novos
        if (noNewCount >= 5) {
            sendStatus(`📊 Fim da lista! ${scrapedCount} seguidores processados.`);
            break;
        }
        
        // Scroll para carregar mais seguidores na lista
        sendStatus("⬇️ Carregando mais seguidores...");
        scrollContainer.scrollTop += 600;
        await sleep(2000 + Math.random() * 1500);
    }
    
    // Finalizar
    sendStatus(`🏁 Extração concluída! Total: ${scrapedCount} seguidores processados.`);
    chrome.storage.local.set({ 
        processedUsers: Array.from(processedCache),
        leadsTotal: scrapedCount
    });
    stopScraping();
}

// ==================== SEARCH MODE (existing) ====================

async function startSearchScraping(term) {
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
                    sendStatus(`Verificando perfil: ${username}`);
                    
                    const success = await processUser(username);
                    if (success) {
                        scrapedCount++;
                        updateProgress();
                        processedCache.add(username);
                        chrome.storage.local.set({ processedUsers: Array.from(processedCache) });
                        
                        const delay = (config.safetyDelay || 5) * 1000;
                        await sleep(delay + Math.random() * 2000);
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
      return false;
    }

    const bio = profileData.biography || "";
    const externalUrl = profileData.external_url || "";
    const fullName = profileData.full_name || "";
    const phones = extractPhones(bio + " " + externalUrl);
    
    if (phones.length > 0) {
      sendStatus(`✅ ${username} - 📱 ${phones.join(', ')}`);
      if (config.backendUrl) {
        await sendToBackend({
          username,
          fullName,
          bio,
          externalUrl,
          phones,
          source: 'extension_direct'
        });
      }
      return true;
    }
    return false;
  } catch (e) {
    console.error(`Erro ao processar ${username}:`, e);
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
      credentials: 'include' // Usar cookies da sessão logada
    });
    
    if (!response.ok) {
      console.log(`[Scout] Perfil ${username} retornou ${response.status}`);
      return null;
    }
    
    const html = await response.text();
    
    // Método 1: Extrair do JSON embarcado no HTML
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
    
    // Método 2: Fallback via meta tags
    const metaDesc = html.match(/<meta property="og:description" content="([^"]+)"/);
    const metaTitle = html.match(/<meta property="og:title" content="([^"]+)"/);
    
    if (metaDesc) {
      return {
        biography: metaDesc[1] || "",
        external_url: "",
        full_name: metaTitle ? metaTitle[1].split('(')[0].trim() : ""
      };
    }
    
    // Método 3: Tentar API interna do Instagram (graphql)
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
// Se o script carregou em uma página de perfil e temos estado salvo, retomar
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
                    
                    // Aguardar página carregar e abrir seguidores
                    setTimeout(async () => {
                        createOverlay();
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
