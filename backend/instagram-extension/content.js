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

// Escutar mensagens do Popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Atualizar config com dados da mensagem
  if (request.maxLeads) config.maxLeads = request.maxLeads;
  if (request.safetyDelay) config.safetyDelay = request.safetyDelay;
  if (request.userEmail) config.userEmail = request.userEmail;

  if (request.action === "START_SCRAPE") {
    isScraping = true;
    scrapedCount = 0;
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

async function updateProgress() {
    chrome.runtime.sendMessage({ 
        action: "UPDATE_PROGRESS", 
        count: scrapedCount, 
        total: config.maxLeads 
    });
    
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
    console.log("Aguardando carregamento dos resultados...");
    await sleep(5000); 

    const processedInSession = new Set();
    
    while (isScraping) {
        if (scrapedCount >= config.maxLeads) {
            console.log("Limite atingido!");
            stopScraping();
            break;
        }

        const links = Array.from(document.querySelectorAll('a[href^="/"]'));
        
        for (let link of links) {
            if (!isScraping) break;
            if (scrapedCount >= config.maxLeads) break;
            
            const href = link.getAttribute('href');
            if (href.match(/^\/[\w\.]+\/$/) && 
                !href.startsWith('/explore/') && 
                !href.startsWith('/p/') && 
                !href.startsWith('/reels/') && 
                !href.startsWith('/stories/') &&
                !href.startsWith('/direct/')) {
                
                const username = href.replace(/\//g, '');
                
                // Dedup check (Session + Persistent)
                if (!processedInSession.has(username) && !processedCache.has(username)) {
                    processedInSession.add(username);
                    console.log(`[Search] Encontrado: ${username}`);
                    
                    const success = await processUser(username);
                    if (success) {
                        scrapedCount++;
                        updateProgress();
                        
                        // Add to persistent cache
                        processedCache.add(username);
                        chrome.storage.local.set({ processedUsers: Array.from(processedCache) });
                        
                        // Safety Delay
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

async function startScraping(targetProfile) {
  // Navegar para a lista de seguidores (Isso requer que o usuário já esteja na página ou que a gente redirecione)
  // Nota: A navegação automática pode disparar flags do Instagram.
  // O ideal é o usuário abrir a lista de "Seguidores" e clicar em "Iniciar".
  
  console.log("Certifique-se de estar com a lista de SEGUIDORES aberta!");
  
  const scrollBox = document.querySelector('div[role="dialog"] div[style*="overflow"]');
  
  if (!scrollBox) {
    alert("Abra a lista de seguidores/seguindo antes de iniciar!");
    isScraping = false;
    return;
  }

  // Loop principal de Scraping
  while (isScraping) {
    // Pegar todos os itens da lista visível
    const items = document.querySelectorAll('div[role="dialog"] a[href^="/"]');
    
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
      console.log(`Encontrado: ${username}`);
      
      // Enviar para validação (Simulação)
      await processUser(username);
    }

    // Scroll para carregar mais
    scrollBox.scrollTop += 500;
    await sleep(3000 + Math.random() * 3000); // Pausa maior para evitar bloqueio
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
      return;
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
    } else {
      console.log(`⚪ Sem contatos visíveis em ${username}`);
    }

  } catch (e) {
    console.error(`Erro ao processar ${username}:`, e);
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
  const phoneRegex = /(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?(?:9\d{4}[-\s]?\d{4})/g;
  
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