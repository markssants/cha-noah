// ===================================================
// CHÁ DE BEBÊ DO NOAH - JAVASCRIPT PRINCIPAL
// ===================================================

document.addEventListener('DOMContentLoaded', () => {
  initVisitorTracking();
  loadPublicInfo();
  initCountdown();
  initModals();
  initRSVPForm();
  initGifts();
  initCopyButtons();
  initMusicBox();
});

let momPhoneNumber = '';

async function loadPublicInfo() {
  try {
    const res = await fetch('/api/info');
    if (res.ok) {
      const data = await res.json();
      if (data.momPhone) {
        momPhoneNumber = data.momPhone;
      }
    }
  } catch (err) {
    console.debug('Error loading public info:', err);
  }
}

function formatWhatsAppNumber(phone) {
  if (!phone) return '5511999999999';
  let digits = phone.replace(/\D/g, '');
  if (!digits) return '5511999999999';
  if (digits.length === 10 || digits.length === 11) {
    digits = '55' + digits;
  }
  return digits;
}

// 1. Rastreamento Silencioso de Visitas e Cliques
let visitorId = localStorage.getItem('noah_visitor_id');
if (!visitorId) {
  visitorId = 'v_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
  localStorage.setItem('noah_visitor_id', visitorId);
}

function initVisitorTracking() {
  // Rastrear visualização de página
  fetch('/api/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'page_view', visitorId })
  }).catch(err => console.debug('Track error:', err));
}

function trackClick(buttonName) {
  fetch('/api/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'click', button: buttonName, visitorId })
  }).catch(err => console.debug('Track error:', err));
}

// 2. Contador Regressivo para 15/11 às 12:00
function initCountdown() {
  // Data do evento: 15 de Novembro às 12h
  const now = new Date();
  let targetYear = now.getFullYear();
  let eventDate = new Date(`${targetYear}-11-15T12:00:00`);

  // Se já passou este ano, aponta para o próximo
  if (eventDate.getTime() < now.getTime()) {
    eventDate = new Date(`${targetYear + 1}-11-15T12:00:00`);
  }

  const daysEl = document.getElementById('countDays');
  const hoursEl = document.getElementById('countHours');
  const minutesEl = document.getElementById('countMinutes');
  const secondsEl = document.getElementById('countSeconds');

  function update() {
    const currentTime = new Date().getTime();
    const distance = eventDate.getTime() - currentTime;

    if (distance <= 0) {
      if (daysEl) daysEl.textContent = '00';
      if (hoursEl) hoursEl.textContent = '00';
      if (minutesEl) minutesEl.textContent = '00';
      if (secondsEl) secondsEl.textContent = '00';
      return;
    }

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    if (daysEl) daysEl.textContent = String(days).padStart(2, '0');
    if (hoursEl) hoursEl.textContent = String(hours).padStart(2, '0');
    if (minutesEl) minutesEl.textContent = String(minutes).padStart(2, '0');
    if (secondsEl) secondsEl.textContent = String(seconds).padStart(2, '0');
  }

  update();
  setInterval(update, 1000);
}

// 3. Gerenciamento de Modais
function initModals() {
  const modalTriggers = document.querySelectorAll('[data-modal-target]');
  const modalOverlays = document.querySelectorAll('.modal-overlay');
  const closeButtons = document.querySelectorAll('.modal-close-btn');

  modalTriggers.forEach(trigger => {
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = trigger.getAttribute('data-modal-target');
      const modal = document.getElementById(targetId);
      if (modal) {
        openModal(modal);
        if (targetId === 'modal-location') trackClick('btn_local');
        if (targetId === 'modal-gifts') trackClick('btn_presentes');
        if (targetId === 'modal-rsvp') trackClick('btn_rsvp');
        if (targetId === 'modal-view-invite') trackClick('btn_ver_convite');
      }
    });
  });

  closeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal-overlay');
      if (modal) closeModal(modal);
    });
  });

  modalOverlays.forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(overlay);
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      modalOverlays.forEach(overlay => {
        if (overlay.classList.contains('active')) closeModal(overlay);
      });
    }
  });
}

function openModal(modal) {
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal(modal) {
  modal.classList.remove('active');
  document.body.style.overflow = '';
}

// 4. Formulário de Confirmação de Presença (RSVP)
function initRSVPForm() {
  const rsvpForm = document.getElementById('rsvpForm');
  const phoneInput = document.getElementById('guestPhone');
  const rsvpSuccess = document.getElementById('rsvpSuccess');
  const whatsappNotifyBtn = document.getElementById('btnWhatsappNotify');

  // Máscara automática de telefone (DD) 9XXXX-XXXX
  if (phoneInput) {
    phoneInput.addEventListener('input', (e) => {
      let v = e.target.value.replace(/\D/g, '');
      if (v.length > 11) v = v.substring(0, 11);
      if (v.length > 10) {
        v = v.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
      } else if (v.length > 6) {
        v = v.replace(/^(\d{2})(\d{4})(\d{0,4})$/, '($1) $2-$3');
      } else if (v.length > 2) {
        v = v.replace(/^(\d{2})(\d{0,5})$/, '($1) $2');
      } else if (v.length > 0) {
        v = v.replace(/^(\d*)$/, '($1');
      }
      e.target.value = v;
    });
  }

  if (rsvpForm) {
    rsvpForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = document.getElementById('guestName').value.trim();
      const phone = phoneInput.value.trim();
      const guestsCount = document.getElementById('guestsCount').value;
      const message = document.getElementById('guestMessage').value.trim();
      const submitBtn = rsvpForm.querySelector('button[type="submit"]');

      if (!name || !phone) {
        showToast('⚠️ Por favor, preencha seu nome e telefone.');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>Enviando confirmação...</span>';

      try {
        const res = await fetch('/api/rsvp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, phone, guestsCount, message })
        });

        const data = await res.json();

        if (res.ok && data.success) {
          // Soltar confetes!
          fireConfetti();

          // Configurar link do WhatsApp da mãe
          if (whatsappNotifyBtn) {
            const encodedMsg = encodeURIComponent(
              `Oi! Acabei de confirmar presença no Chá de Bebê do Noah pelo site!\nNome: ${name}\nTotal de pessoas: ${guestsCount} pessoa(s)\nMal podemos esperar! ❤️👶`
            );
            const targetMomPhone = formatWhatsAppNumber(data.momPhone || momPhoneNumber);
            whatsappNotifyBtn.href = `https://api.whatsapp.com/send?phone=${targetMomPhone}&text=${encodedMsg}`;
          }

          // Alternar exibição do form para tela de sucesso
          rsvpForm.style.display = 'none';
          rsvpSuccess.style.display = 'block';

          showToast('🎉 Presença confirmada com sucesso!');
        } else {
          showToast('❌ ' + (data.error || 'Erro ao confirmar presença.'));
        }
      } catch (err) {
        console.error(err);
        showToast('❌ Erro na conexão. Tente novamente.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
          <span>Confirmar Minha Presença</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 13l4 4L19 7"/></svg>
        `;
      }
    });
  }
}

// Efeito de Confetes Festivos (Canvas-Confetti)
function fireConfetti() {
  if (typeof confetti === 'function') {
    // Explosão central e laterais
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#759268', '#dfba5d', '#CAA34A', '#FAF8F2', '#A3B899']
    });

    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#caa34a', '#7e9470', '#ffffff']
      });
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#caa34a', '#7e9470', '#ffffff']
      });
    }, 250);
  }
}

// 5. Sugestões de Presentes
let cachedGifts = [];

async function initGifts() {
  const giftsListContainer = document.getElementById('giftsListContainer');
  const categoryTabs = document.querySelectorAll('.category-tab-btn');

  try {
    const res = await fetch('/api/gifts');
    if (res.ok) {
      cachedGifts = await res.json();
      renderGifts('all');
    }
  } catch (err) {
    console.error('Error loading gifts:', err);
  }

  categoryTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      categoryTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const category = tab.getAttribute('data-category');
      renderGifts(category);
    });
  });
}

function renderGifts(category) {
  const container = document.getElementById('giftsListContainer');
  if (!container) return;

  const filtered = category === 'all' 
    ? cachedGifts 
    : cachedGifts.filter(g => g.category.toLowerCase() === category.toLowerCase());

  if (filtered.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding: 2rem; color: #777;">Nenhum item nesta categoria.</div>`;
    return;
  }

  container.innerHTML = filtered.map(gift => {
    const totalQty = parseInt(gift.quantity, 10) || 1;
    const reservedCount = (gift.reservations ? gift.reservations.length : (gift.reserved ? 1 : 0));
    const remaining = Math.max(0, totalQty - reservedCount);
    const isFullyReserved = reservedCount >= totalQty;

    let icon = '🍼';
    if (gift.category === 'Higiene') icon = '🧴';
    if (gift.category === 'Enxoval') icon = '🧸';

    return `
      <div class="gift-item-card ${isFullyReserved ? 'reserved' : ''}">
        <div class="gift-icon">${icon}</div>
        <div class="gift-info">
          <div class="gift-title">${escapeHtml(gift.title)}</div>
          <div class="gift-brand">Sugestão: ${escapeHtml(gift.brand || 'À sua escolha')}</div>
          ${totalQty > 1 ? `
            <div class="gift-quantity-badge ${isFullyReserved ? 'completed' : 'in-progress'}">
              ${isFullyReserved 
                ? `✓ Todas as ${totalQty} unidades já foram escolhidas` 
                : `🎁 ${reservedCount} de ${totalQty} escolhidos • Restam ${remaining}`
              }
            </div>
          ` : ''}
        </div>
        <div class="gift-action">
          ${isFullyReserved 
            ? `<span class="badge-reserved">✓ Já Escolhido</span>`
            : `<button class="btn-reserve-gift" onclick="reserveGiftPrompt('${gift.id}')">Presentear 🎁</button>`
          }
        </div>
      </div>
    `;
  }).join('');
}

window.reserveGiftPrompt = async function(giftId) {
  const gift = cachedGifts.find(g => g.id === giftId);
  if (!gift) return;

  const totalQty = parseInt(gift.quantity, 10) || 1;
  const reservedCount = (gift.reservations ? gift.reservations.length : (gift.reserved ? 1 : 0));
  const remaining = Math.max(0, totalQty - reservedCount);

  let promptMsg = `Que alegria! Você deseja escolher "${gift.title}" para o Noah?`;
  if (totalQty > 1) {
    promptMsg += `\n(A mamãe pediu ${totalQty} unidades deste item e ainda restam ${remaining})`;
  }
  promptMsg += `\n\nDigite seu nome completo para registrarmos seu carinho:`;

  const guestName = prompt(promptMsg);
  if (!guestName || !guestName.trim()) return;

  try {
    const res = await fetch('/api/gifts/reserve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ giftId, guestName: guestName.trim() })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      if (data.gift) {
        const idx = cachedGifts.findIndex(g => g.id === giftId);
        if (idx !== -1) cachedGifts[idx] = data.gift;
      } else {
        if (!gift.reservations) gift.reservations = [];
        gift.reservations.push({ name: guestName.trim() });
        gift.reserved = gift.reservations.length >= (gift.quantity || 1);
      }
      fireConfetti();
      showToast('🎁 Presente reservado com sucesso! Muito obrigado!');
      const activeTab = document.querySelector('.category-tab-btn.active');
      const currentCategory = activeTab ? activeTab.getAttribute('data-category') : 'all';
      renderGifts(currentCategory);
    } else {
      showToast('⚠️ ' + (data.error || 'Não foi possível reservar este item.'));
    }
  } catch (err) {
    console.error(err);
    showToast('❌ Erro na conexão.');
  }
};

// 6. Botões de Copiar (PIX e Endereço)
function initCopyButtons() {
  const copyPixBtn = document.getElementById('btnCopyPix');
  if (copyPixBtn) {
    copyPixBtn.addEventListener('click', () => {
      const pixKey = document.getElementById('pixKeyText').textContent.trim();
      navigator.clipboard.writeText(pixKey).then(() => {
        trackClick('btn_pix');
        showToast('📋 Chave PIX copiada para a área de transferência!');
      }).catch(() => {
        showToast('⚠️ Selecione e copie manualmente: ' + pixKey);
      });
    });
  }

  const copyAddressBtn = document.getElementById('btnCopyAddress');
  if (copyAddressBtn) {
    copyAddressBtn.addEventListener('click', () => {
      const address = document.getElementById('locationAddressText').textContent.trim();
      navigator.clipboard.writeText(address).then(() => {
        showToast('📍 Endereço copiado!');
      }).catch(() => {
        showToast('⚠️ ' + address);
      });
    });
  }

  // Tracking links externos
  const wazeLink = document.getElementById('linkWaze');
  if (wazeLink) {
    wazeLink.addEventListener('click', () => trackClick('btn_waze'));
  }

  const mapsLink = document.getElementById('linkMaps');
  if (mapsLink) {
    mapsLink.addEventListener('click', () => trackClick('btn_maps'));
  }
}

// 7. Caixinha de Música Suave (Web Audio API Nanar / Lullaby)
let audioCtx = null;
let isMusicPlaying = false;
let musicInterval = null;

function initMusicBox() {
  const musicToggleBtn = document.getElementById('musicToggleBtn');
  if (!musicToggleBtn) return;

  musicToggleBtn.addEventListener('click', () => {
    if (!isMusicPlaying) {
      startLullaby();
      musicToggleBtn.classList.add('playing');
      musicToggleBtn.title = 'Pausar música suave';
      showToast('🎵 Música de caixinha de música ativada!');
    } else {
      stopLullaby();
      musicToggleBtn.classList.remove('playing');
      musicToggleBtn.title = 'Ouvir música suave';
    }
  });
}

function startLullaby() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();
    isMusicPlaying = true;

    // Melodia doce de canção de ninar (Notas musicais em Hz)
    const melody = [
      { note: 261.63, dur: 0.6 }, // C4
      { note: 261.63, dur: 0.6 }, // C4
      { note: 392.00, dur: 0.8 }, // G4
      { note: 392.00, dur: 0.8 }, // G4
      { note: 440.00, dur: 0.8 }, // A4
      { note: 440.00, dur: 0.8 }, // A4
      { note: 392.00, dur: 1.4 }, // G4
      { note: 349.23, dur: 0.8 }, // F4
      { note: 349.23, dur: 0.8 }, // F4
      { note: 329.63, dur: 0.8 }, // E4
      { note: 329.63, dur: 0.8 }, // E4
      { note: 293.66, dur: 0.8 }, // D4
      { note: 293.66, dur: 0.8 }, // D4
      { note: 261.63, dur: 1.5 }  // C4
    ];

    let noteIdx = 0;

    function playNextNote() {
      if (!isMusicPlaying || !audioCtx) return;

      const item = melody[noteIdx];
      playChime(item.note, item.dur);

      noteIdx = (noteIdx + 1) % melody.length;
      musicInterval = setTimeout(playNextNote, (item.dur + 0.25) * 1000);
    }

    playNextNote();
  } catch (err) {
    console.debug('Audio error:', err);
  }
}

function playChime(freq, duration) {
  if (!audioCtx) return;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  // Tom doce de caixinha de música / glockenspiel
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq * 2, audioCtx.currentTime);

  gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.2, audioCtx.currentTime + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

function stopLullaby() {
  isMusicPlaying = false;
  if (musicInterval) clearTimeout(musicInterval);
  if (audioCtx) {
    audioCtx.close().catch(() => {});
    audioCtx = null;
  }
}

// 8. Mensagem Toast Flutuante
function showToast(message) {
  let toast = document.getElementById('siteToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'siteToast';
    toast.className = 'toast-notice';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function(m) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[m];
  });
}

// 9. Interação com os Blocos N-O-A-H
window.tapBlock = function(letter) {
  fireMiniConfetti();
  showToast(`✨ Noah: letrinha "${letter}" com amor! 💚`);
};

function fireMiniConfetti() {
  if (typeof confetti === 'function') {
    confetti({
      particleCount: 25,
      spread: 45,
      origin: { y: 0.85 },
      colors: ['#caa34a', '#759268', '#f7e6b5', '#ffffff']
    });
  }
}
