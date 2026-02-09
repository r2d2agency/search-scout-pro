// R2D2 - TNS
// Content Script for Instagram Extension
if (window.instaleadScoutLoaded) {
    // Already loaded, just ensuring listeners are active (which they are)
    // We can return, but we might want to ensure variables are reset if needed.
    // For now, simple guard.
} else {
    window.instaleadScoutLoaded = true;
}

let isScraping = false;
let config = {};
let scrapedCount = 0;
let processedCache = new Set(); // Cache em memória para sessão atual

// Carregar configurações e cache persistente
chrome.storage.local.get(['evoUrl', 'evoKey', 'backendUrl', 'searchState', 'userEmail', 'processedUsers'], (result) => {
  config = result;
  if (result.processedUsers) {
      processedCache = new Set(result.processedUsers);
  }
  
  // Resume Search if active
  if (result.searchState && result.searchState.active) {
      if (window.location.href.includes('/explore/search/')) {
          console.log("[Scout] Resuming search for:", result.searchState.term);
          isScraping = true;
          scrapedCount = result.searchState.count || 0;
          config.maxLeads = result.searchState.maxLeads || 50;
          startSearchScraping(result.searchState.term);
      }
  }
});

function checkLoginStatus() {
    // Check for login fields
    if (document.querySelector('input[name="username"]') || document.querySelector('input[name="password"]')) {
        return false;
    }
    // Check for logged-in elements (like the nav bar or profile link)
    // Instagram layout changes often, but the "Search" SVG or common nav items usually exist
    if (document.querySelector('svg[aria-label="Search"]') || document.querySelector('svg[aria-label="Home"]') || document.querySelector('a[href="/accounts/edit/"]')) {
        return true;
    }
    // Fallback: assume logged in if no login inputs found, but warn
    return true; 
}

// UI OVERLAY IMPLEMENTATION
let overlayEl = null;
let overlayLog = null;

function createOverlay() {
    if (overlayEl) return;

    // Create Container
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
        z-index: 2147483647; /* Max Z-Index */
        box-shadow: 0 0 50px rgba(0,0,0,0.9);
        color: #f2f2f2;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        padding: 20px;
        display: flex;
        flex-direction: column;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px solid #2a2a30; padding-bottom: 10px;`;
    header.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 18px; font-weight: bold; color: #00FFFF; text-transform: uppercase; letter-spacing: 1px;">Instalead Scout</span>
        </div>
        <button id="scout-close" style="background: none; border: none; color: #666; cursor: pointer; font-size: 20px;">&times;</button>
    `;

    // Status Area
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

    // Terminal
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

    // Actions
    const actions = document.createElement('div');
    actions.style.textAlign = 'right';
    actions.innerHTML = `
        <button id="scout-stop" style="background: #ff0055; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: bold;">PARAR EXTRAÇÃO</button>
    `;

    // Append All
    overlayEl.appendChild(header);
    overlayEl.appendChild(statusArea);
    overlayEl.appendChild(terminal);
    overlayEl.appendChild(actions);
    document.body.appendChild(overlayEl);

    // Listeners
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
    if (overlayLog.children.length > 50) overlayLog.removeChild(overlayLog.lastChild);
}

function updateOverlayProgress(count, total) {
    if (!overlayEl) return;
    document.getElementById('scout-count').textContent = `${count}/${total || '∞'}`;
    if (total && total !== '∞') {
        const pct = Math.min((count / total) * 100, 100);
        document.getElementById('scout-progress').style.width = `${pct}%`;
    }
}

// Escutar mensagens do Popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Atualizar config com dados da mensagem
  if (request.maxLeads) config.maxLeads = request.maxLeads;
  if (request.safetyDelay) config.safetyDelay = request.safetyDelay;
  if (request.userEmail) config.userEmail = request.userEmail;

  if (request.action === "OPEN_OVERLAY") {
      createOverlay();
      sendStatus("Painel Flutuante Ativado");
      // Sync state if running
      if (isScraping) {
          updateOverlayProgress(scrapedCount, config.maxLeads);
      }
      sendResponse({ status: "opened" }); // Confirm receipt
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
    sendStatus(`Iniciando busca no perfil: ${request.target}`);
    console.log(`[Scout] Iniciando busca no perfil: ${request.target}`);
    startScraping(request.target);
    sendResponse({ status: "started" });
  } else if (request.action === "START_SEARCH") {
    isScraping = true;
    scrapedCount = 0;
    const term = request.term;
    console.log(`[Scout] Iniciando pesquisa por: ${term}`);
    
    // Save state and redirect
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

function stopScraping() {
    isScraping = false;
    chrome.storage.local.remove(['searchState']);
    console.log("[Scout] Parando...");
    chrome.runtime.sendMessage({ action: "SCRAPE_COMPLETE" });
}

function sendStatus(msg) {
    chrome.runtime.sendMessage({ action: "UPDATE_STATUS", message: msg });
    
    // Update Overlay if exists
    if (overlayEl) {
        document.getElementById('scout-status-text').textContent = msg;
        updateOverlayLog(msg);
    }
}

async function updateProgress() {
    chrome.runtime.sendMessage({ 
        action: "UPDATE_PROGRESS", 
        count: scrapedCount, 
        total: config.maxLeads 
    });
    
    // Update Overlay if exists
    updateOverlayProgress(scrapedCount, config.maxLeads);
    
    // Atualizar estado persistente se estiver em modo pesquisa
    if (config.searchState) {
        chrome.storage.local.set({ 
            searchState: { 
                ...config.searchState, 
                count: scrapedCount 
            } 
        });
    }
}

async function startSearchScraping(term) {
    sendStatus("Aguardando carregamento dos resultados...");
    console.log("Aguardando carregamento dos resultados...");
    await sleep(5000); 

    const processedInSession = new Set();
    let noNewItemsAttempts = 0;
    let lastScrollHeight = 0;
    
    while (isScraping) {
        if (scrapedCount >= config.maxLeads) {
            sendStatus("Limite de leads atingido!");
            console.log("Limite atingido!");
            stopScraping();
            break;
        }

        // Check if we are stuck or at the end
        const currentScrollHeight = document.body.scrollHeight;
        if (currentScrollHeight === lastScrollHeight) {
            noNewItemsAttempts++;
            sendStatus(`Sem novos itens... tentativa ${noNewItemsAttempts}/5`);
            console.log(`[Scout] Sem novos itens ou scroll travado (${noNewItemsAttempts}/5)`);
            if (noNewItemsAttempts > 5) {
                sendStatus("Fim dos resultados ou travado. Parando.");
                console.log("Fim dos resultados ou rolagem travada. Parando.");
                stopScraping();
                break;
            }
        } else {
            noNewItemsAttempts = 0;
            lastScrollHeight = currentScrollHeight;
        }

        const links = Array.from(document.querySelectorAll('a[href^="/"]'));
        let foundNewInBatch = false;
        
        sendStatus(`Analisando ${links.length} links na tela...`);
        
        for (let link of links) {
            if (!isScraping) break;
            if (scrapedCount >= config.maxLeads) break;
            
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
                    console.log(`[Search] Encontrado: ${username}`);
                    
                    const success = await processUser(username);
                    if (success) {
                        scrapedCount++;
                        updateProgress();
                        sendStatus(`✅ Sucesso: ${username} extraído!`);
                        
                        // Add to persistent cache
                        processedCache.add(username);
                        chrome.storage.local.set({ processedUsers: Array.from(processedCache) });
                        
                        // Safety Delay
                        const delay = (config.safetyDelay || 5) * 1000;
                        sendStatus(`Aguardando ${delay/1000}s de segurança...`);
                        await sleep(delay + Math.random() * 2000);
                    }
                }
            }
        }
        
        if (!foundNewInBatch) {
             sendStatus("Nenhum novo neste lote, rolando página...");
             console.log("Nenhum usuário novo neste lote, rolando...");
        } else {
             sendStatus("Rolando para carregar mais...");
        }

        window.scrollBy(0, 1000);
        await sleep(3000 + Math.random() * 3000);
    }
}

async function startScraping(targetProfile) {
  // Navegar para a lista de seguidores (Isso requer que o usuário já esteja na página ou que a gente redirecione)
  // Nota: A navegação automática pode disparar flags do Instagram.
  // O ideal é o usuário abrir a lista de "Seguidores" e clicar em "Iniciar".
  
  sendStatus("⚠️ Abra a lista de SEGUIDORES na tela!");
  console.log("Certifique-se de estar com a lista de SEGUIDORES aberta!");
  
  const scrollBox = document.querySelector('div[role="dialog"] div[style*="overflow"]');
  
  if (!scrollBox) {
    sendStatus("❌ Lista de seguidores não encontrada!");
    alert("Abra a lista de seguidores/seguindo antes de iniciar!");
    isScraping = false;
    return;
  }

  sendStatus("Lista encontrada! Iniciando extração...");

  // Loop principal de Scraping
  while (isScraping) {
    // Pegar todos os itens da lista visível
    const items = document.querySelectorAll('div[role="dialog"] a[href^="/"]');
    
    sendStatus(`Analisando ${items.length} itens visíveis...`);
    
    for (let item of items) {
      if (!isScraping) break;
      
      const username = item.getAttribute('href').replace(/\//g, '');
      if (username === targetProfile) continue; // Pular o próprio perfil

      // Aqui teríamos que visitar o perfil de CADA usuário para ver a Bio
      // Isso é MUITO lento e perigoso via navegador.
      // Abordagem alternativa: Extrair apenas o username e enviar para o backend processar via Firecrawl/Apify
      // OU
      // Tentar abrir em nova aba/iframe (bloqueado pelo Insta).
      
      // Vamos assumir a extração básica e validação visual por enquanto
      sendStatus(`Encontrado: ${username}`);
      console.log(`Encontrado: ${username}`);
      
      // Enviar para validação (Simulação)
      const success = await processUser(username);
      if (success) {
          sendStatus(`✅ Dados coletados: ${username}`);
      }
    }

    // Scroll para carregar mais
    sendStatus("Rolando lista para baixo...");
    scrollBox.scrollTop += 500;
    
    const delay = 3000 + Math.random() * 3000;
    sendStatus(`Aguardando ${Math.round(delay/1000)}s...`);
    await sleep(delay); // Pausa maior para evitar bloqueio
  }
}

async function processUser(username) {
  // NOVA ABORDAGEM: Buscar a Bio usando a própria sessão do usuário (sem Firecrawl)
  try {
    console.log(`🔍 Analisando perfil: ${username}...`);
    
    // Pequeno delay antes de buscar o perfil para não sobrecarregar
    await sleep(2000 + Math.random() * 3000);

    const profileData = await fetchProfileData(username);
    
    if (!profileData) {
      console.log(`❌ Não foi possível ler dados de ${username}`);
      return false;
    }

    const bio = profileData.biography || "";
    const externalUrl = profileData.external_url || "";
    const fullName = profileData.full_name || "";
    
    // Extrair telefones e links de WhatsApp
    const phones = extractPhones(bio + " " + externalUrl);
    
    if (phones.length > 0) {
      console.log(`✅ Encontrado Contato em ${username}:`, phones);
      
      // Enviar para o Backend apenas se tiver contato (ou se quiser salvar todos)
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
    } else {
      console.log(`⚪ Sem contatos visíveis em ${username}`);
      return false;
    }

  } catch (e) {
    console.error(`Erro ao processar ${username}:`, e);
    return false;
  }
}

async function fetchProfileData(username) {
  try {
    // Tenta buscar o HTML do perfil
    const response = await fetch(`https://www.instagram.com/${username}/`, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      }
    });
    
    if (!response.ok) return null;
    
    const html = await response.text();
    
    // Tenta extrair a Bio da meta tag description (método mais simples e seguro)
    // <meta property="og:description" content="... Bio do usuário ..." />
    const metaDescription = html.match(/<meta property="og:description" content="([^"]+)"/);
    
    if (metaDescription && metaDescription[1]) {
      // O conteúdo geralmente é "X Followers, Y Following, Z Posts - See Instagram photos and videos from Name (@user)"
      // A Bio as vezes não vem completa aqui, mas vamos tentar pegar o JSON embutido se falhar.
      
      // Tentativa 2: Buscar JSON compartilhado (mais arriscado de quebrar se o Insta mudar o layout, mas mais completo)
      // Procura por algo como: "biography":"..."
      const bioMatch = html.match(/"biography":"(.*?)"/);
      const urlMatch = html.match(/"external_url":"(.*?)"/);
      const nameMatch = html.match(/"full_name":"(.*?)"/);
      
      return {
        biography: bioMatch ? JSON.parse(`"${bioMatch[1]}"`) : "", // Decodificar unicode
        external_url: urlMatch ? JSON.parse(`"${urlMatch[1]}"`) : "",
        full_name: nameMatch ? JSON.parse(`"${nameMatch[1]}"`) : ""
      };
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
  
  // Regex para links de WhatsApp (wa.me, api.whatsapp.com, linktree, etc)
  const waRegex = /(?:wa\.me|api\.whatsapp\.com\/send\?phone=)(\d+)/g;
  let match;
  while ((match = waRegex.exec(text)) !== null) {
    phones.push(match[1]);
  }
  
  // Regex genérica para telefones celulares (Brasil e outros)
  // Aceita formatos como: (11) 99999-9999, 11 999999999, +55 11 ...
  const phoneRegex = /(?:\+?55\s?)?(?:\(?0?\d{2}\)?[\s.-]?)?\d{4,5}[\s.-]?\d{4}/g;
  
  while ((match = phoneRegex.exec(text)) !== null) {
    // Limpar caracteres não numéricos
    let cleanNumber = match[0].replace(/\D/g, '');
    
    // Se não tiver DDI (comprimento 11 ou 10), adicionar 55
    if (cleanNumber.length >= 10 && cleanNumber.length <= 11) {
      cleanNumber = '55' + cleanNumber;
    }
    
    if (!phones.includes(cleanNumber)) {
      phones.push(cleanNumber);
    }
  }

  // Regex para internacionais
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
      body: JSON.stringify(data)
    });
    console.log(`📤 Enviado ${data.username}:`, response.status);
  } catch (e) {
    console.error("Erro ao enviar para backend:", e);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}