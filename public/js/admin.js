// ===================================================
// PAINEL DA MAMÃE DO NOAH - JAVASCRIPT
// ===================================================

let adminToken = sessionStorage.getItem('noah_admin_token');
let dashboardData = null;
let giftCategoryFilter = 'all';
let giftStatusFilter = 'all';
let giftSearchTerm = '';

document.addEventListener('DOMContentLoaded', () => {
  initAdminAuth();
  initTableSearch();
  initManualAdd();
  initSettingsForm();
  initGiftManagement();
});

// 1. Autenticação do Admin
async function initAdminAuth() {
  const loginWrapper = document.getElementById('adminLoginWrapper');
  const dashboardWrapper = document.getElementById('adminDashboardWrapper');
  const loginForm = document.getElementById('adminLoginForm');
  const pinInput = document.getElementById('adminPinInput');
  const logoutBtn = document.getElementById('btnLogout');
  const exportBtn = document.getElementById('btnExportCsv');

  // Garante que o input comece limpo
  if (pinInput) {
    pinInput.value = '';
  }

  // Se houver token na sessão, valida no servidor antes de liberar a tela
  if (adminToken) {
    try {
      const res = await fetch('/api/admin/dashboard', {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      if (res.ok) {
        showDashboard();
      } else {
        sessionStorage.removeItem('noah_admin_token');
        adminToken = null;
        loginWrapper.style.display = 'flex';
        dashboardWrapper.style.display = 'none';
      }
    } catch (err) {
      sessionStorage.removeItem('noah_admin_token');
      adminToken = null;
      loginWrapper.style.display = 'flex';
      dashboardWrapper.style.display = 'none';
    }
  } else {
    loginWrapper.style.display = 'flex';
    dashboardWrapper.style.display = 'none';
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pin = pinInput.value.trim();

      if (!pin) {
        alert('⚠️ Por favor, digite a senha.');
        pinInput.focus();
        return;
      }

      try {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin })
        });
        const data = await res.json();

        if (res.ok && data.success) {
          adminToken = data.token;
          sessionStorage.setItem('noah_admin_token', adminToken);
          showDashboard();
        } else {
          alert('❌ ' + (data.error || 'Senha incorreta.'));
          pinInput.value = '';
          pinInput.focus();
        }
      } catch (err) {
        alert('Erro ao tentar conectar.');
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      sessionStorage.removeItem('noah_admin_token');
      adminToken = null;
      dashboardWrapper.style.display = 'none';
      loginWrapper.style.display = 'flex';
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      if (!adminToken) return;
      window.location.href = `/api/admin/export-csv`;
    });
  }
}

function showDashboard() {
  const loginWrapper = document.getElementById('adminLoginWrapper');
  const dashboardWrapper = document.getElementById('adminDashboardWrapper');
  loginWrapper.style.display = 'none';
  dashboardWrapper.style.display = 'block';
  loadDashboardData();
}

// 2. Carregar Dados Completos do Dashboard
async function loadDashboardData() {
  if (!adminToken) return;

  try {
    const res = await fetch('/api/admin/dashboard', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    if (res.status === 401) {
      sessionStorage.removeItem('noah_admin_token');
      adminToken = null;
      location.reload();
      return;
    }

    dashboardData = await res.json();
    renderDashboard(dashboardData);
  } catch (err) {
    console.error('Error fetching dashboard:', err);
  }
}

function renderDashboard(data) {
  // 1. Cards Principais
  document.getElementById('statTotalGuests').textContent = data.totalGuests || 0;
  document.getElementById('statTotalResponses').textContent = `${data.totalResponses || 0} respostas registradas`;

  const totalViews = (data.metrics && data.metrics.views) || 0;
  const uniqueViews = (data.metrics && data.metrics.uniqueVisitors) || 0;
  document.getElementById('statTotalViews').textContent = totalViews;
  document.getElementById('statUniqueVisitors').textContent = `${uniqueViews} pessoas únicas`;

  const clicks = (data.metrics && data.metrics.clicks) || {};
  const totalClicksCount = Object.values(clicks).reduce((a, b) => a + b, 0);
  document.getElementById('statTotalClicks').textContent = totalClicksCount;

  document.getElementById('statGiftsCount').textContent = `${data.reservedGiftsCount || 0} de ${data.totalGiftsCount || 0}`;

  // 2. Detalhamento de Cliques
  document.getElementById('clickCountRsvp').textContent = clicks['btn_rsvp'] || 0;
  document.getElementById('clickCountLocation').textContent = clicks['btn_local'] || 0;
  document.getElementById('clickCountGifts').textContent = clicks['btn_presentes'] || 0;
  document.getElementById('clickCountPix').textContent = clicks['btn_pix'] || 0;
  if (document.getElementById('clickCountInvite')) {
    document.getElementById('clickCountInvite').textContent = clicks['btn_ver_convite'] || 0;
  }
  document.getElementById('clickCountWaze').textContent = (clicks['btn_waze'] || 0) + (clicks['btn_maps'] || 0);

  // 3. Tabela de Convidados
  renderGuestsTable(data.rsvps || []);

  // 4. Gerenciador de Presentes
  updateGiftCounters(data.gifts || []);
  renderAllGifts();

  // 5. Configurações
  if (data.settings) {
    if (document.getElementById('settingPixKey')) document.getElementById('settingPixKey').value = data.settings.pixKey || '';
    if (document.getElementById('settingMomPhone')) {
      const rawMom = (data.settings.momPhone || '').replace(/\D/g, '');
      let formattedMom = data.settings.momPhone || '';
      if (rawMom.startsWith('55') && (rawMom.length === 12 || rawMom.length === 13)) {
        const dddAndNumber = rawMom.substring(2);
        if (dddAndNumber.length === 11) {
          formattedMom = dddAndNumber.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
        } else {
          formattedMom = dddAndNumber.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
        }
      } else if (rawMom.length === 11) {
        formattedMom = rawMom.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
      } else if (rawMom.length === 10) {
        formattedMom = rawMom.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
      }
      document.getElementById('settingMomPhone').value = formattedMom;
    }
    if (document.getElementById('settingVenueName')) document.getElementById('settingVenueName').value = data.settings.locationName || '';
    if (document.getElementById('settingVenueAddress')) document.getElementById('settingVenueAddress').value = data.settings.locationAddress || '';
    if (document.getElementById('settingNotice')) document.getElementById('settingNotice').value = data.settings.locationNotice || '';
    if (document.getElementById('settingAdminPin')) document.getElementById('settingAdminPin').value = data.settings.adminPin || '';
  }
}

// 3. Tabela de Convidados e Filtro de Busca
function renderGuestsTable(rsvps) {
  const tbody = document.getElementById('guestsTableBody');
  const countBadge = document.getElementById('guestsCountBadge');
  if (!tbody) return;

  if (countBadge) countBadge.textContent = `${rsvps.length} convidados`;

  if (rsvps.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem; color: #777;">Nenhuma confirmação recebida ainda. Compartilhe o link do convite!</td></tr>`;
    return;
  }

  tbody.innerHTML = rsvps.map(r => {
    const rawPhone = (r.phone || '').replace(/\D/g, '');
    const cleanPhone = rawPhone.length === 11 ? `55${rawPhone}` : rawPhone;
    const dateFormatted = new Date(r.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    const waText = encodeURIComponent(`Olá ${r.name}! Tudo bem? Vi que você confirmou presença no Chá do Noah. Ficamos muito felizes! ❤️👶`);
    const waLink = `https://wa.me/${cleanPhone}?text=${waText}`;

    return `
      <tr>
        <td class="guest-name-cell">${escapeHtml(r.name)}</td>
        <td>
          ${rawPhone ? `
            <a href="${waLink}" target="_blank" class="btn-whatsapp-chat" title="Abrir conversa no WhatsApp">
              <span>💬</span> ${escapeHtml(r.phone)}
            </a>
          ` : 'Não informado'}
        </td>
        <td>
          <span class="badge-guests-count">${r.guestsCount || 1} pessoa(s)</span>
        </td>
        <td class="guest-msg-cell" title="${escapeHtml(r.message || '')}">
          ${escapeHtml(r.message) || '<span style="color:#aaa;">Sem recado</span>'}
        </td>
        <td style="color:#777; font-size:0.8rem;">${dateFormatted}</td>
        <td>
          <button class="btn-delete-rsvp" onclick="deleteRsvp('${r.id}', '${escapeHtml(r.name)}')" title="Excluir confirmação">
            🗑️
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function initTableSearch() {
  const searchInput = document.getElementById('searchGuestsInput');
  if (!searchInput) return;

  searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    if (!dashboardData || !dashboardData.rsvps) return;

    const filtered = dashboardData.rsvps.filter(r => 
      (r.name && r.name.toLowerCase().includes(term)) ||
      (r.phone && r.phone.toLowerCase().includes(term)) ||
      (r.message && r.message.toLowerCase().includes(term))
    );

    renderGuestsTable(filtered);
  });
}

// Excluir RSVP
window.deleteRsvp = async function(id, name) {
  if (!confirm(`Tem certeza que deseja remover a confirmação de "${name}"?`)) return;

  try {
    const res = await fetch(`/api/admin/rsvp/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    if (res.ok) {
      loadDashboardData();
    } else {
      alert('Erro ao excluir presença.');
    }
  } catch (err) {
    alert('Erro de conexão.');
  }
};

// 4. Adicionar Convidado Manualmente
function initManualAdd() {
  const btn = document.getElementById('btnAddManualGuest');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const name = prompt('Nome completo do convidado:');
    if (!name || !name.trim()) return;

    const phone = prompt('WhatsApp do convidado (opcional):', '(11) ') || '';
    const guestsCount = prompt('Quantas pessoas no total com ele(a)?', '1') || '1';
    const message = prompt('Observação/recado (opcional):', 'Confirmado pessoalmente com a mamãe') || '';

    try {
      const res = await fetch('/api/admin/rsvp/manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ name, phone, guestsCount, message })
      });

      if (res.ok) {
        alert('✅ Convidado adicionado com sucesso!');
        loadDashboardData();
      } else {
        alert('Erro ao cadastrar convidado.');
      }
    } catch (err) {
      alert('Erro de conexão.');
    }
  });
}

// 5. Gerenciamento de Presentes
function getCategoryIcon(category) {
  const cat = (category || '').toLowerCase();
  if (cat.includes('fralda')) return '🍼';
  if (cat.includes('higiene') || cat.includes('sabonete') || cat.includes('óleo') || cat.includes('pomada') || cat.includes('termômetro') || cat.includes('manicure')) return '🧴';
  if (cat.includes('enxoval') || cat.includes('toalha') || cat.includes('manta') || cat.includes('pano') || cat.includes('babador')) return '🧸';
  if (cat.includes('roup') || cat.includes('body') || cat.includes('macacão')) return '👶';
  if (cat.includes('quart') || cat.includes('berço') || cat.includes('lençol')) return '🛏️';
  if (cat.includes('aliment') || cat.includes('mamad') || cat.includes('copo') || cat.includes('prato')) return '🥣';
  if (cat.includes('brinqued') || cat.includes('morded') || cat.includes('chocalho')) return '🧩';
  return '🎁';
}

function updateGiftCounters(gifts) {
  const totalItems = gifts.length;
  const totalUnits = gifts.reduce((acc, g) => acc + (parseInt(g.quantity, 10) || 1), 0);
  const reservedUnits = gifts.reduce((acc, g) => acc + ((g.reservations && g.reservations.length) || (g.reserved ? 1 : 0)), 0);
  const availableUnits = Math.max(0, totalUnits - reservedUnits);

  const countBadge = document.getElementById('giftsCountBadge');
  if (countBadge) countBadge.textContent = `${totalUnits} un. (${totalItems} itens)`;

  const sumTotal = document.getElementById('sumGiftsTotal');
  if (sumTotal) sumTotal.textContent = totalUnits;

  const sumAvail = document.getElementById('sumGiftsAvailable');
  if (sumAvail) sumAvail.textContent = availableUnits;

  const sumRes = document.getElementById('sumGiftsReserved');
  if (sumRes) sumRes.textContent = reservedUnits;

  const statCard = document.getElementById('statGiftsCount');
  if (statCard) statCard.textContent = `${reservedUnits} de ${totalUnits}`;
}

function renderAllGifts() {
  const container = document.getElementById('allGiftsContainer');
  if (!container) return;

  const gifts = (dashboardData && dashboardData.gifts) || [];

  const filtered = gifts.filter(g => {
    const totalQty = parseInt(g.quantity, 10) || 1;
    const reservedCount = (g.reservations ? g.reservations.length : (g.reserved ? 1 : 0));

    // Category filter
    if (giftCategoryFilter !== 'all') {
      const gCat = (g.category || '').toLowerCase();
      if (giftCategoryFilter === 'Outros') {
        if (['fraldas', 'higiene', 'enxoval'].includes(gCat)) return false;
      } else if (gCat !== giftCategoryFilter.toLowerCase()) {
        return false;
      }
    }

    // Status filter
    if (giftStatusFilter === 'available' && reservedCount >= totalQty) return false;
    if (giftStatusFilter === 'reserved' && reservedCount === 0) return false;

    // Search term
    if (giftSearchTerm) {
      const term = giftSearchTerm.toLowerCase();
      const matchTitle = (g.title || '').toLowerCase().includes(term);
      const matchBrand = (g.brand || '').toLowerCase().includes(term);
      const matchGuest = (g.reservations || []).some(r => (r.name || '').toLowerCase().includes(term)) ||
                         (g.reservedBy && (g.reservedBy.name || '').toLowerCase().includes(term));
      if (!matchTitle && !matchBrand && !matchGuest) return false;
    }

    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="gifts-empty-state">
        <div class="empty-icon">🎁</div>
        <h4>Nenhum presente encontrado</h4>
        <p>Tente ajustar os filtros ou adicione novos presentes usando o botão acima.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(g => {
    const totalQty = parseInt(g.quantity, 10) || 1;
    const reservations = g.reservations || (g.reserved && g.reservedBy ? [g.reservedBy] : []);
    const reservedCount = reservations.length;
    const isFullyReserved = reservedCount >= totalQty;
    const isPartiallyReserved = reservedCount > 0 && reservedCount < totalQty;
    const icon = getCategoryIcon(g.category);

    let statusBadgeHtml = '';
    if (isFullyReserved) {
      statusBadgeHtml = `<span class="gift-admin-status-badge reserved">🎁 Completo (${reservedCount}/${totalQty})</span>`;
    } else if (isPartiallyReserved) {
      statusBadgeHtml = `<span class="gift-admin-status-badge partial">🟡 Parcial (${reservedCount}/${totalQty})</span>`;
    } else {
      statusBadgeHtml = `<span class="gift-admin-status-badge available">🟢 Disponível (0/${totalQty})</span>`;
    }

    return `
      <div class="gift-admin-card ${isFullyReserved ? 'is-reserved' : (isPartiallyReserved ? 'is-partial' : 'is-available')}" id="gift-card-${g.id}">
        <div class="gift-admin-header">
          <span class="gift-admin-category-badge">${icon} ${escapeHtml(g.category || 'Geral')}</span>
          ${statusBadgeHtml}
        </div>

        <div class="gift-admin-body">
          <h4 class="gift-admin-title">${escapeHtml(g.title)}</h4>
          <p class="gift-admin-brand">
            <strong>Sugestão/Marca:</strong> ${escapeHtml(g.brand || 'À sua escolha')}
          </p>
          <div class="gift-admin-qty-meta">
            <span>🎯 <strong>Meta:</strong> ${totalQty} unidade(s)</span>
            <span class="gift-qty-avail">${Math.max(0, totalQty - reservedCount)} restante(s)</span>
          </div>

          ${reservedCount > 0 ? `
            <div class="gift-admin-reserved-list">
              <div class="reserved-list-header">
                <span>👤 Escolhido por (${reservedCount}):</span>
                ${reservedCount > 1 ? `
                  <button type="button" class="btn-clear-all-reservations" onclick="unreserveGift('${g.id}', null)" title="Liberar todas as reservas">
                    Liberar todos
                  </button>
                ` : ''}
              </div>
              <ul class="reserved-guests-items">
                ${reservations.map((r, idx) => `
                  <li class="reserved-guest-row">
                    <span class="reserved-guest-name">
                      ${escapeHtml(r.name || 'Convidado')}
                      ${r.phone ? `<small class="reserved-guest-phone">(${escapeHtml(r.phone)})</small>` : ''}
                    </span>
                    <button type="button" class="btn-cancel-single-res" onclick="unreserveGift('${g.id}', '${r.id || ''}')" title="Liberar esta unidade">
                      ✕
                    </button>
                  </li>
                `).join('')}
              </ul>
            </div>
          ` : ''}
        </div>

        <div class="gift-admin-actions">
          <button class="btn-action-pill btn-edit" onclick="openGiftModal('${g.id}')" title="Editar informações do presente">
            <span>✏️</span> Editar
          </button>
          ${reservedCount === 1 ? `
            <button class="btn-action-pill btn-unreserve" onclick="unreserveGift('${g.id}', '${reservations[0].id || ''}')" title="Liberar este presente para outros convidados">
              <span>🔓</span> Liberar
            </button>
          ` : ''}
          <button class="btn-action-pill btn-delete" onclick="deleteGift('${g.id}', '${escapeHtml(g.title).replace(/'/g, "\\'")}', ${reservedCount > 0 ? 'true' : 'false'})" title="Remover este presente da lista">
            <span>🗑️</span> Excluir
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function initGiftManagement() {
  const btnOpen = document.getElementById('btnOpenAddGiftModal');
  const btnClose = document.getElementById('btnCloseGiftModal');
  const btnCancel = document.getElementById('btnCancelGiftModal');
  const overlay = document.getElementById('giftModalOverlay');
  const form = document.getElementById('giftModalForm');
  const searchInput = document.getElementById('searchGiftsInput');
  const catPills = document.querySelectorAll('#giftsCategoryPills .cat-pill');
  const summaryItems = document.querySelectorAll('.gifts-summary-item');

  if (btnOpen) {
    btnOpen.addEventListener('click', () => openGiftModal());
  }

  if (btnClose) {
    btnClose.addEventListener('click', closeGiftModal);
  }

  if (btnCancel) {
    btnCancel.addEventListener('click', closeGiftModal);
  }

  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeGiftModal();
    });
  }

  // Filtro de Categorias
  catPills.forEach(pill => {
    pill.addEventListener('click', () => {
      catPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      giftCategoryFilter = pill.getAttribute('data-category') || 'all';
      renderAllGifts();
    });
  });

  // Filtro de Status (Abas de resumo: Todos, Disponíveis, Reservados)
  summaryItems.forEach(item => {
    item.addEventListener('click', () => {
      summaryItems.forEach(s => s.classList.remove('active'));
      item.classList.add('active');
      giftStatusFilter = item.getAttribute('data-status-filter') || 'all';
      renderAllGifts();
    });
  });

  // Campo de Busca
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      giftSearchTerm = e.target.value.trim();
      renderAllGifts();
    });
  }

  // Formulário do Modal (Cadastrar ou Editar)
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const giftId = document.getElementById('modalGiftId').value;
      const title = document.getElementById('modalGiftTitle').value.trim();
      const category = document.getElementById('modalGiftCategory').value;
      const brand = document.getElementById('modalGiftBrand').value.trim();
      const quantity = parseInt(document.getElementById('modalGiftQuantity').value, 10) || 1;

      if (!title) {
        alert('⚠️ Por favor, digite o nome do presente.');
        return;
      }

      const submitBtn = document.getElementById('btnSaveGiftSubmit');
      if (submitBtn) submitBtn.disabled = true;

      try {
        const isEdit = !!giftId;
        const url = isEdit ? `/api/admin/gifts/${giftId}` : '/api/admin/gifts';
        const method = isEdit ? 'PUT' : 'POST';

        const res = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
          },
          body: JSON.stringify({ title, category, brand, quantity })
        });

        const result = await res.json();
        if (res.ok && result.success) {
          closeGiftModal();
          await loadDashboardData();
        } else {
          alert('❌ ' + (result.error || 'Erro ao salvar o presente.'));
        }
      } catch (err) {
        alert('Erro ao conectar com o servidor.');
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }
}

window.openGiftModal = function(giftId = null) {
  const overlay = document.getElementById('giftModalOverlay');
  const titleElem = document.getElementById('giftModalTitle');
  const form = document.getElementById('giftModalForm');
  const idInput = document.getElementById('modalGiftId');
  const titleInput = document.getElementById('modalGiftTitle');
  const catInput = document.getElementById('modalGiftCategory');
  const brandInput = document.getElementById('modalGiftBrand');
  const qtyInput = document.getElementById('modalGiftQuantity');

  if (!overlay || !form) return;

  if (giftId) {
    const gift = dashboardData && dashboardData.gifts && dashboardData.gifts.find(g => g.id === giftId);
    if (gift) {
      titleElem.textContent = 'Editar Presente ✏️';
      idInput.value = gift.id;
      titleInput.value = gift.title || '';
      if (qtyInput) qtyInput.value = gift.quantity || 1;
      
      let found = false;
      for (let i = 0; i < catInput.options.length; i++) {
        if (catInput.options[i].value.toLowerCase() === (gift.category || '').toLowerCase()) {
          catInput.selectedIndex = i;
          found = true;
          break;
        }
      }
      if (!found) {
        catInput.value = 'Outros';
      }
      brandInput.value = gift.brand || '';
    }
  } else {
    titleElem.textContent = 'Adicionar Presente 🎁';
    form.reset();
    idInput.value = '';
    catInput.value = 'Fraldas';
    if (qtyInput) qtyInput.value = 1;
  }

  overlay.style.display = 'flex';
  titleInput.focus();
};

window.closeGiftModal = function() {
  const overlay = document.getElementById('giftModalOverlay');
  if (overlay) overlay.style.display = 'none';
};

window.deleteGift = async function(giftId, giftTitle, isReserved) {
  let msg = `Tem certeza que deseja excluir o presente "${giftTitle}"?`;
  if (isReserved) {
    msg = `⚠️ ATENÇÃO: Este presente ("${giftTitle}") já possui reservas feitas por convidados!\n\nSe você excluir agora, o presente será removido da lista do chá. Deseja realmente excluir?`;
  }

  if (!confirm(msg)) return;

  try {
    const res = await fetch(`/api/admin/gifts/${giftId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });

    const data = await res.json();
    if (res.ok && data.success) {
      await loadDashboardData();
    } else {
      alert('Erro ao excluir: ' + (data.error || 'Não foi possível remover o presente.'));
    }
  } catch (err) {
    alert('Erro de conexão ao tentar excluir.');
  }
};

window.unreserveGift = async function(giftId, reservationId = null) {
  const promptText = reservationId 
    ? 'Deseja liberar esta reserva para que outro convidado possa escolher?'
    : 'Deseja liberar todas as reservas deste presente?';

  if (!confirm(promptText)) return;

  try {
    const res = await fetch('/api/admin/gift/unreserve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ giftId, reservationId })
    });
    if (res.ok) {
      await loadDashboardData();
    }
  } catch (err) {
    alert('Erro de conexão.');
  }
};

// 6. Salvar Configurações
function initSettingsForm() {
  const form = document.getElementById('adminSettingsForm');
  const btnReset = document.getElementById('btnResetMetrics');
  const momPhoneInput = document.getElementById('settingMomPhone');

  // Máscara automática de telefone para o WhatsApp da mãe
  if (momPhoneInput) {
    momPhoneInput.addEventListener('input', (e) => {
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

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const pixKey = document.getElementById('settingPixKey').value.trim();
      const momPhone = momPhoneInput ? momPhoneInput.value.trim() : '';
      const locationName = document.getElementById('settingVenueName').value.trim();
      const locationAddress = document.getElementById('settingVenueAddress').value.trim();
      const locationNotice = document.getElementById('settingNotice').value.trim();
      const adminPin = document.getElementById('settingAdminPin').value.trim();

      try {
        const res = await fetch('/api/admin/settings', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
          },
          body: JSON.stringify({ pixKey, momPhone, locationName, locationAddress, locationNotice, adminPin })
        });

        if (res.ok) {
          alert('✅ Configurações salvas com sucesso!');
          if (adminPin !== adminToken) {
            adminToken = adminPin;
            sessionStorage.setItem('noah_admin_token', adminPin);
          }
          loadDashboardData();
        } else {
          alert('Erro ao salvar configurações.');
        }
      } catch (err) {
        alert('Erro de conexão.');
      }
    });
  }

  if (btnReset) {
    btnReset.addEventListener('click', async () => {
      if (!confirm('Tem certeza que deseja zerar os contadores de acessos e cliques de teste?')) return;

      try {
        const res = await fetch('/api/admin/metrics/reset', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        if (res.ok) {
          alert('✅ Métricas zeradas!');
          loadDashboardData();
        }
      } catch (err) {
        alert('Erro de conexão.');
      }
    });
  }
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
