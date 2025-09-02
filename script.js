import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js';
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
  setDoc,
  enableMultiTabIndexedDbPersistence,
} from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';

// ===== Variáveis Globais de Sessão e Estado =====
let operadorLogado = null;
let isAdmin = false;
const SENHA_SECRETA_ADMIN = 'usco123';

// ===== Configuração do Firebase =====
const firebaseConfig = {
  apiKey: 'AIzaSyCVLmT9ze8br21yZc7w3x6RyImy0_34NOk',
  authDomain: 'irrigac-dc6ca.firebaseapp.com',
  projectId: 'irrigac-dc6ca',
  storageBucket: 'irrigac-dc6ca.firebasestorage.app',
  messagingSenderId: '410561274798',
  appId: '1:410561274798:web:4b2a494aefad676262de3f',
  measurementId: 'G-9C2SDV3NNR',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ===== Persistência Offline =====
enableMultiTabIndexedDbPersistence(db).catch(err => {
  if (err.code === 'failed-precondition')
    console.warn(
      'Persistência offline não habilitada: múltiplas abas abertas.'
    );
  else if (err.code === 'unimplemented')
    console.warn('O navegador não suporta persistência offline.');
  else console.warn('Erro ao habilitar persistência offline:', err);
});

// ===== Funções utilitárias =====
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const fatorCarreador = 0.006;

function showMessage(text, type = 'success') {
  const msgEl = $('#mensagem');
  msgEl.textContent = text;
  const styles = {
    success: 'bg-green-100 text-green-700 border border-green-400',
    error: 'bg-red-100 text-red-700 border border-red-400',
    sync: 'bg-blue-100 text-blue-700 border border-blue-400',
  };
  msgEl.className = `p-3 rounded mb-4 ${styles[type] || styles.success}`;
  msgEl.classList.remove('hidden');

  clearTimeout(showMessage._t);
  if (type !== 'sync') {
    showMessage._t = setTimeout(() => msgEl.classList.add('hidden'), 5000);
  }
}

// LISTAS DE DADOS ESTÁTICOS
const codigosParada = [
  '937 - AGUARDANDO ELETRICISTA',
  '957 - AGURDANDO MECÂNICO INTERNO',
  '903 - AGUARDANDO MECÂNICO',
  '961 - ENTUPIMENTO',
  '913 - FALTA DE COMB. / LUBRIF.',
  '960 - FALTA ENERGIA',
  '919 - HORÁRIO PONTA',
  '921 - FALTA DE ÁGUA',
  '922 - FALTA DE VINHAÇA',
  '911 - FALTA CAMINHÃO',
  '963 - PARADA APLIC.ADUBO/HERB.',
  '924 - FALTA DE OPERADOR',
  '964 - FALTA TUBULAÇÃO',
  '975 - FALTA ÁREA',
  '959 - LIMPEZA LAVAGEM DO EQP.',
  '976 - PIVOTAGEM',
  '977 - PARADA CONSERTO EXTERNO',
  '978 - DESLIGAMENTO QUEIMA',
  '979 - AGUARDANDO LIBERAÇÃO ÁREA/CARREGAMENTO',
  '948 - AGUARDANDO CARREGAR',
  '982 - AGUARDANDO RECOLHimento CARRETEL',
  '962 - DESCARREGANDO VINHAÇA',
  '909 - ENTUPIMENTO/EMBUCHAMENTO',
  '917 - REFEIÇÃO',
  '942 - PARADA INDÚSTRIA',
  '907 - CLIMA',
  '904 - AGUARDANDO ORDENS',
  '967 - AGUARDANDO P/MUDANÇA',
  '945 - REPARO ADUTORA',
  '926 - FALTA TRATOR/TRANSBORDO',
  '968 - TEMPO DE AVANÇO',
  '969 - LIMPEZA TUBULAÇÃO',
  '970 - ASPERSÃO COMPLEMENTAR',
  '972 - TEMPO APLIC.EXCEDIDO',
  '974 - CARREGAMENTO VINHAÇA',
  '929 - PARADA PROGRAMADA',
  '916 - MUDANÇA DE ÁREA',
  '973 - SOLICITAÇÃO EQP. CARREGAMENTO',
  '966 - AGUARDANDO ORDENS USINA',
];
const problemasOpcoes = [
  'mangueira desacoplada',
  'mangueira rasgada/furada',
  'mangueira curta',
  'torre rachada',
  'girar torre',
  'torre sem abrir/fechar',
  'torre trocar pino',
  'torre trocar junta',
  'barulho no motor',
  'barulho na bomba',
  'vazamento na gaxeta',
  'vazamento no corpo da bomba',
  'eletro sem ligar/desligar',
  'botoeira quebrada',
  'desarmado',
  'pega pressão e desliga',
  'taboca arriada',
  'cabo descascado',
  'eletro em curto',
  'taboca saindo faísca',
  'transformador sem fase',
  'correia do acoplamento quebrada',
  'rolamento da bomba',
  'rolamento do motor',
  'pneu furado/baixo',
  'mudança de transformador',
];

function todayYMD() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}
function toISOFromDatetimeLocal(v) {
  if (!v) return null;
  return new Date(v).toISOString();
}
function fromISOToDatetimeLocal(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
function formatDateTime(d) {
  try {
    return new Date(d).toLocaleString('pt-BR');
  } catch {
    return '-';
  }
}

function updateConnUI() {
  const online = navigator.onLine;
  $('#dotConexao').className =
    'inline-block w-3 h-3 rounded-full ' +
    (online ? 'bg-green-500' : 'bg-orange-500');
  $('#txtConexao').textContent = online ? 'Conectado' : 'Offline';
}
window.addEventListener('online', updateConnUI);
window.addEventListener('offline', updateConnUI);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('./sw.js')
    .catch(err => console.warn('SW falhou:', err));
}

// ===== Seletores de DOM principais =====
const COLLECTION = 'Areas';
const loginScreen = $('#loginScreen');
const mainContent = $('main');
const loginError = $('#loginError');
const header = $('header');
const sections = {
  projetos: $('#content-projetos'),
  cadastro: $('#content-cadastro'),
  operador: $('#content-operador'),
  relatorios: $('#content-relatorios'),
};
const selectProjeto = $('#projeto');
const filtroProjetoCadastro = $('#filtroProjetoCadastro');
const filtroProjetoOperador = $('#filtroProjetoOperador');
const filtroProjetoRel = $('#filtroProjetoRel');
const listaAreasCadastro = $('#listaAreasCadastro');
const listaAreasOperador = $('#listaAreasOperador');
const filtroDataOperador = $('#filtroDataOperador');
const filtroDataRel = $('#filtroDataRel');
const filtroAreaIndividual = $('#filtroAreaIndividual');

// --- LÓGICA DE NAVEGAÇÃO E ABAS ---
const navContainer = $('#navContainer');
const menuBtn = $('#menuAbasBtn');
const menu = $('#menuAbas');
const menuIcon = menuBtn.querySelector('.menu-icon');
const desktopTabButtons = $$('nav[aria-label="Tabs"] > .tab-btn');

menuBtn.addEventListener('click', () => {
  menu.classList.toggle('hidden');
  requestAnimationFrame(() => {
    menu.classList.toggle('show');
    menuIcon.classList.toggle('open');
  });
});
document.addEventListener('click', e => {
  if (!menu.contains(e.target) && !menuBtn.contains(e.target)) {
    menu.classList.remove('show');
    menuIcon.classList.remove('open');
    setTimeout(() => menu.classList.add('hidden'), 200);
  }
});

function atualizarMenuMobile(activeTabName) {
  const menuContainer = $('#menuAbas');
  const menuLabel = $('#menuAbasLabel');
  let menuHTML = '';
  let activeLabelHTML = '';
  desktopTabButtons.forEach(btn => {
    const tabName = btn.dataset.tab;
    const isBloqueada = btn.classList.contains('aba-bloqueada');
    const btnContent = btn.innerHTML;
    if (tabName === activeTabName) activeLabelHTML = btnContent;
    else
      menuHTML += `<button data-tab="${tabName}" class="tab-btn ${
        isBloqueada ? 'aba-bloqueada' : ''
      } block w-full text-left px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">${btnContent}</button>`;
  });
  menuLabel.innerHTML = activeLabelHTML;
  menuContainer.innerHTML = menuHTML;
}

navContainer.addEventListener('click', e => {
  const tabButton = e.target.closest('.tab-btn');
  if (tabButton && !tabButton.classList.contains('aba-bloqueada')) {
    const tabName = tabButton.dataset.tab;
    switchTab(tabName);
    if (menu.classList.contains('show')) {
      menu.classList.remove('show');
      menuIcon.classList.remove('open');
      setTimeout(() => menu.classList.add('hidden'), 200);
    }
  }
});

function switchTab(name) {
  Object.entries(sections).forEach(([k, sec]) =>
    sec.classList.toggle('hidden', k !== name)
  );
  $$('.tab-btn').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.tab === name)
  );
  atualizarMenuMobile(name);
  if (operadorLogado || isAdmin) observarAreas();
}

let editDocId = null;
let isSyncing = false;
let syncNotificationShown = false;
filtroDataOperador.value = todayYMD();
filtroDataRel.value = todayYMD();

// ===== LÓGICA DE PROJETOS =====
// REMOVIDO: Não precisamos mais de um ID de documento fixo. (william -02/08)
// const PROJ_DOC_ID = "6YqsO6D3ATYKiBNvuP9s";
// const projetoDocRef = doc(db, "Projeto", PROJ_DOC_ID);

// MODIFICADO: A referência agora é para a coleção inteira.
const projetosCollectionRef = collection(db, 'Projeto');
let projetosCache = []; // O cache agora irá armazenar objetos { id, nome }

// MODIFICADO: A lógica do onSnapshot foi alterada para ler uma coleção.
onSnapshot(
  query(projetosCollectionRef, orderBy('nome')),
  snapshot => {
    try {
      // Mapeia os documentos para o cache, armazenando o ID e o nome.
      projetosCache = snapshot.docs
        .map(doc => ({
          id: doc.id,
          nome: String(doc.data().nome || '').trim(),
        }))
        .filter(p => p.nome); // Filtra projetos sem nome

      preencherSelectsProjeto();
    } catch (e) {
      console.error('onSnapshot projetos:', e);
      showMessage('Erro ao observar projetos.', 'error');
    }
  },
  err => {
    console.error('Snapshot projetos falhou:', err);
    showMessage('Erro ao carregar projetos.', 'error');
  }
);

function preencherSelectsProjeto() {
  const optsCadastro = ['<option value="">-- Selecione um Projeto --</option>'];
  const optsFiltro = ['<option value="">-- Todos os Projetos --</option>'];
  // MODIFICADO: Itera sobre o cache de objetos
  projetosCache.forEach(p => {
    optsCadastro.push(`<option value="${p.nome}">${p.nome}</option>`);
    optsFiltro.push(`<option value="${p.nome}">${p.nome}</option>`);
  });
  selectProjeto.innerHTML = optsCadastro.join('');
  filtroProjetoCadastro.innerHTML = optsFiltro.join('');
  filtroProjetoOperador.innerHTML = optsFiltro.join('');
  filtroProjetoRel.innerHTML = optsFiltro.join('');
  renderListaProjetosUI();
}

const listaProjetosEl = $('#listaProjetos');
function renderListaProjetosUI() {
  listaProjetosEl.innerHTML = '';
  if (!projetosCache.length) {
    listaProjetosEl.innerHTML = `<li class="text-sm text-gray-600">Nenhum projeto cadastrado.</li>`;
    return;
  }
  // MODIFICADO: Usa o objeto do cache que contém id e nome.
  projetosCache.forEach(projeto => {
    const li = document.createElement('li');
    li.className = 'flex items-center justify-between border rounded px-3 py-2';
    // Armazena o ID do documento nos botões
    li.innerHTML = `<span>${projeto.nome}</span> <div class="flex gap-2"> <button class="btnRenomear bg-yellow-400 px-2 py-1 rounded text-sm" data-id="${projeto.id}" data-nome-atual="${projeto.nome}">Renomear</button> <button class="btnRemover bg-red-500 text-white px-2 py-1 rounded text-sm" data-id="${projeto.id}">Remover</button> </div>`;
    listaProjetosEl.appendChild(li);
  });

  // MODIFICADO: Lógica para Renomear um documento
  listaProjetosEl.querySelectorAll('.btnRenomear').forEach(btn => {
    btn.addEventListener('click', async () => {
      const docId = btn.dataset.id;
      const nomeAtual = btn.dataset.nomeAtual;
      const novoNome = prompt('Novo nome do projeto:', nomeAtual);
      if (!novoNome || !novoNome.trim() || novoNome.trim() === nomeAtual)
        return;

      try {
        // Atualiza o campo 'nome' do documento específico
        await updateDoc(doc(db, 'Projeto', docId), { nome: novoNome.trim() });
        showMessage('Projeto renomeado.');
      } catch (err) {
        console.error('Erro ao renomear projeto:', err);
        showMessage('Erro ao renomear o projeto.', 'error');
      }
    });
  });

  // MODIFICADO: Lógica para Remover um documento
  listaProjetosEl.querySelectorAll('.btnRemover').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Remover este projeto da lista?')) return;
      const docId = btn.dataset.id;
      try {
        // Deleta o documento específico da coleção
        await deleteDoc(doc(db, 'Projeto', docId));
        showMessage('Projeto removido.');
      } catch (err) {
        console.error('Erro ao remover projeto:', err);
        showMessage('Erro ao remover o projeto.', 'error');
      }
    });
  });
}


// MODIFICADO: O formulário agora adiciona um novo documento.
$('#formProjeto').addEventListener('submit', async e => {
  e.preventDefault();
  const nome = $('#novoProjeto').value.trim();
  if (!nome) return showMessage('Informe o nome do projeto.', 'error');

  // Verifica se o projeto já existe para evitar duplicatas
  if (projetosCache.some(p => p.nome.toLowerCase() === nome.toLowerCase())) {
    return showMessage('Este projeto já existe.', 'error');
  }

  try {
    // Adiciona um novo documento à coleção 'Projeto'
    await addDoc(collection(db, 'Projeto'), {
      nome: nome,
      criadoEm: serverTimestamp(), // Opcional: para saber quando foi criado
    });
    $('#novoProjeto').value = '';
    showMessage('Projeto adicionado.');
  } catch (err) {
    console.error(err);
    showMessage('Erro ao salvar projeto.', 'error');
  }
});

// ===== Lógica de Cálculo e Campos Dinâmicos (Cadastro) =====
const horasPlanejadasInput = $('#horasPlanejadas'),
  velocidadeCarretelInput = $('#velocidadeCarretel'),
  metrosLinearesInput = $('#metrosLineares'),
  quantidadeCarreteisInput = $('#quantidadeCarreteis');
function calcularMetrosLineares() {
  const metros =
    (parseFloat(horasPlanejadasInput.value) || 0) *
    (parseFloat(velocidadeCarretelInput.value) || 0) *
    (parseInt(quantidadeCarreteisInput.value, 10) || 0);
  metrosLinearesInput.value = metros.toFixed(2);
}
horasPlanejadasInput.addEventListener('input', calcularMetrosLineares);
velocidadeCarretelInput.addEventListener('input', calcularMetrosLineares);
quantidadeCarreteisInput.addEventListener('input', calcularMetrosLineares);

const carreteisContainer = $('#carreteisContainer');
quantidadeCarreteisInput.addEventListener('input', () => {
  carreteisContainer.innerHTML = '';
  for (
    let i = 1;
    i <= (parseInt(quantidadeCarreteisInput.value, 10) || 0);
    i++
  ) {
    const div = document.createElement('div');
    div.innerHTML = `<label for="numeroCarretel_${i}" class="block text-sm font-semibold mb-1">N° Carretel ${i}</label><input id="numeroCarretel_${i}" data-index="${i}" required class="w-full border rounded px-3 py-2 numero-carretel-dinamico" placeholder="Ex: 13800${i}" />`;
    carreteisContainer.appendChild(div);
  }
});

// MODIFICADO: (william - 28/08)
// ===== Lógica Principal de Dados (Áreas) =====
let unsubscribeAreas = null;
function observarAreas() {
  if (unsubscribeAreas) unsubscribeAreas();

  // MODIFICADO: A referência base à coleção.
  let areasQuery = collection(db, COLLECTION);

  // MODIFICADO: Adiciona o filtro de segurança se o usuário não for admin.
  // Ele só buscará documentos onde o campo 'projeto' está na lista de projetos do operador.
  if (
    operadorLogado &&
    !isAdmin &&
    Array.isArray(operadorLogado.projetos) &&
    operadorLogado.projetos.length > 0
  ) {
    areasQuery = query(
      areasQuery,
      where('projeto', 'in', operadorLogado.projetos)
    );
  } else if (operadorLogado && !isAdmin) {
    // Se o operador não tem projetos listados, não damos acesso a nada por segurança.
    // Criamos uma consulta que nunca retornará resultados.
    areasQuery = query(
      areasQuery,
      where('projeto', '==', 'acesso_negado_sem_projeto_definido')
    );
  }
  // Se for admin, a consulta original sem filtros é usada, retornando tudo.

  unsubscribeAreas = onSnapshot(
    areasQuery,
    snapshot => {
      // A consulta filtrada é usada aqui
      const hasPending = snapshot.metadata.hasPendingWrites;
      const fromCache = snapshot.metadata.fromCache;
      if (hasPending) {
        showMessage('Alterações salvas localmente. Sincronizando...', 'sync');
        isSyncing = true;
        syncNotificationShown = false;
      } else if (isSyncing && !fromCache && !syncNotificationShown) {
        showMessage('Dados sincronizados com sucesso! ✔️', 'success');
        isSyncing = false;
        syncNotificationShown = true;
      }

      const areasData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      popularFiltroAreaIndividual(areasData);

      // As funções abaixo agora receberão apenas os dados já filtrados pelo snapshot
      if (!sections.cadastro.classList.contains('hidden'))
        listarAreasCadastro(snapshot);
      if (!sections.operador.classList.contains('hidden'))
        listarAreasOperador();
    },
    err => {
      console.error('Falha ao observar áreas:', err);
      showMessage('Não foi possível carregar os dados.', 'error');
    }
  );
}

async function toggleFinalizadaStatus(docId, newStatus) {
  const isFinalizing = newStatus === true;
  const today = new Date().toLocaleDateString('pt-BR');
  if (
    !confirm(
      isFinalizing
        ? 'Finalizar a irrigação para esta área?'
        : 'Reativar a irrigação para esta área?'
    )
  )
    return;

  const dateInput = prompt(
    isFinalizing
      ? 'Insira a data de fechamento:'
      : 'Insira a data de reabertura:',
    today
  );
  if (!dateInput) {
    showMessage('Ação cancelada.', 'error');
    return;
  }

  const payload = { finalizada: newStatus };
  if (isFinalizing) {
    payload.dataFechamento = dateInput;
    payload.dataAbertura = null;
  } else {
    payload.dataAbertura = dateInput;
    payload.dataFechamento = null;
  }

  try {
    await updateDoc(doc(db, COLLECTION, docId), payload);
    showMessage(isFinalizing ? 'Área finalizada.' : 'Área reativada.');
  } catch (e) {
    console.error(e);
    showMessage('Erro ao alterar status da área.', 'error');
  }
}

async function listarAreasCadastro(snapshot) {
  listaAreasCadastro.innerHTML = `<div class="text-sm text-gray-600">Carregando...</div>`;
  try {
    const snap = snapshot || (await getDocs(collection(db, COLLECTION)));
    const filtro = (filtroProjetoCadastro.value || '').trim();
    const frag = document.createDocumentFragment();
    let count = 0;

    snap.forEach(docSnap => {
      const data = docSnap.data();
      if (
        operadorLogado &&
        !isAdmin &&
        operadorLogado.projetos &&
        !operadorLogado.projetos.includes(data.projeto)
      )
        return;
      if (filtro && data.projeto !== filtro) return;

      const isFinalizada = data.finalizada === true;
      const card = document.createElement('div');
      card.className = `bg-white rounded shadow p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
        isFinalizada ? 'opacity-60 bg-gray-50' : ''
      }`;
      const carreteisStr = Array.isArray(data.carreteis)
        ? data.carreteis.join(', ')
        : data.numeroCarretel || '-';
      const buttonsHTML = isFinalizada
        ? `<button class="btnReativar w-full bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600" data-id="${docSnap.id}">Reativar</button><button class="btnEditar bg-yellow-400 text-white px-3 py-1 rounded hover:bg-yellow-400" data-id="${docSnap.id}">Editar</button>`
        : `<button class="btnEditar bg-yellow-400 text-white px-3 py-1 rounded hover:bg-yellow-400" data-id="${docSnap.id}">Editar</button><button class="btnFinalizar bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600" data-id="${docSnap.id}">Finalizar</button>`;
      let statusDateHTML = '';
      if (isFinalizada && data.dataFechamento)
        statusDateHTML = `<div class="text-xs text-red-700 font-medium mt-1"><strong>Fechado em:</strong> ${data.dataFechamento}</div>`;
      else if (!isFinalizada && data.dataAbertura)
        statusDateHTML = `<div class="text-xs text-green-700 font-medium mt-1"><strong>Aberto em:</strong> ${data.dataAbertura}</div>`;
      card.innerHTML = `<div class="flex-1 flex flex-col gap-1 text-sm"><div class="flex items-center gap-4"><span class="font-semibold text-base text-blue-900">${
        data.bloco || '-'
      }</span>${
        isFinalizada
          ? '<span class="text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded-full">FINALIZADA</span>'
          : ''
      }</div>${statusDateHTML}<div><strong>Projeto:</strong> ${
        data.projeto || '-'
      }</div><div><strong>Bombeamento:</strong> ${
        data.bombeamento || '-'
      }</div><div><strong>Carretel(éis):</strong> ${carreteisStr}</div><div><strong>Velocidade:</strong> ${
        data.velocidadeCarretel || '-'
      } m/h</div><div><strong>ML (Plano):</strong> ${
        data.metrosLineares || '-'
      } m</div><div><strong>Vazão:</strong> ${
        data.vazao || '-'
      }</div><div><strong>Croqui:</strong> ${
        data.numeroCroqui || '-'
      }</div><div><strong>Próx. Bloco:</strong> ${
        data.proxBloco || '-'
      }</div></div><div class="flex flex-col gap-2 w-full md:w-auto self-stretch justify-end">${buttonsHTML}<button class="btnExcluir bg-red-400 text-white px-3 py-1 rounded hover:bg-gray-500" data-id="${
        docSnap.id
      }">Excluir</button></div>`;
      frag.appendChild(card);
      count++;
    });
    listaAreasCadastro.innerHTML = '';
    listaAreasCadastro.appendChild(frag);
    listaAreasCadastro
      .querySelectorAll('.btnFinalizar')
      .forEach(b =>
        b.addEventListener('click', () =>
          toggleFinalizadaStatus(b.dataset.id, true)
        )
      );
    listaAreasCadastro
      .querySelectorAll('.btnReativar')
      .forEach(b =>
        b.addEventListener('click', () =>
          toggleFinalizadaStatus(b.dataset.id, false)
        )
      );
    listaAreasCadastro
      .querySelectorAll('.btnEditar')
      .forEach(b =>
        b.addEventListener('click', () => carregarParaEdicao(b.dataset.id))
      );
    listaAreasCadastro.querySelectorAll('.btnExcluir').forEach(b =>
      b.addEventListener('click', async () => {
        if (!confirm('EXCLUIR esta área? A ação não pode ser desfeita.'))
          return;
        try {
          await deleteDoc(doc(db, COLLECTION, b.dataset.id));
          showMessage('Área excluída.');
        } catch (e) {
          console.error(e);
          showMessage('Erro ao excluir área.', 'error');
        }
      })
    );
    if (!count)
      listaAreasCadastro.innerHTML = `<div class="text-sm text-gray-600">Nenhuma área para o filtro.</div>`;
  } catch (e) {
    console.error(e);
    listaAreasCadastro.innerHTML = `<div class="text-sm text-red-600">Erro ao carregar áreas.</div>`;
  }
}



async function carregarParaEdicao(id) {
  try {
    const snap = await getDoc(doc(db, COLLECTION, id));
    if (!snap.exists()) return showMessage('Área não encontrada.', 'error');
    const d = snap.data();
    $('#formArea').reset();
    carreteisContainer.innerHTML = '';
    $('#projeto').value = d.projeto || '';
    $('#bombeamento').value = d.bombeamento || '';
    $('#bloco').value = d.bloco || '';
    $("#areaHectares").value = d.areaHectares || "";
    $("#talhao").value = d.talhao || "";
    $('#proxBloco').value = d.proxBloco || '';
    $('#numeroEletrobomba').value = d.numeroEletrobomba || '';
    $('#redeEletrica').value = d.redeEletrica || '';
    const qtdCarreteis =
      d.quantidadeCarreteis ||
      (Array.isArray(d.carreteis) ? d.carreteis.length : 1);
    quantidadeCarreteisInput.value = qtdCarreteis;
    quantidadeCarreteisInput.dispatchEvent(new Event('input'));
    setTimeout(() => {
      if (Array.isArray(d.carreteis))
        d.carreteis.forEach((num, index) => {
          const input = $(`#numeroCarretel_${index + 1}`);
          if (input) input.value = num;
        });
      else if (d.numeroCarretel) {
        const input = $(`#numeroCarretel_1`);
        if (input) input.value = d.numeroCarretel;
      }
    }, 0);
    $('#tipoArea').value = d.tipoArea || '';
    $('#tipoIrrigacao').value = d.tipoIrrigacao || '';
    $('#tipoProduto').value = d.tipoProduto || '';
    $('#horasPlanejadas').value = Number(d.horasPlanejadas || 0);
    $('#velocidadeCarretel').value = Number(d.velocidadeCarretel || 0);
    $('#numeroCroqui').value = d.numeroCroqui || '';
    $('#vazao').value = d.vazao || '';
    calcularMetrosLineares();
    editDocId = id;
    $('#cancelarEdicao').classList.remove('hidden');
    switchTab('cadastro');
    showMessage('Área carregada para edição.');
  } catch (e) {
    console.error(e);
    showMessage('Erro ao carregar área.', 'error');
  }
}

$('#cancelarEdicao').addEventListener('click', () => {
  editDocId = null;
  $('#formArea').reset();
  carreteisContainer.innerHTML = '';
  $('#cancelarEdicao').classList.add('hidden');
});

$('#formArea').addEventListener('submit', async e => {
  e.preventDefault();
  const carreteis = $$('.numero-carretel-dinamico').map(input =>
    input.value.trim()
  );
  if (carreteis.some(c => !c))
    return showMessage('Preencha o número de todos os carretéis.', 'error');

  const payload = {
    projeto: $('#projeto').value.trim(),
    bombeamento: $('#bombeamento').value.trim(),
    bloco: $('#bloco').value.trim(),
    areaHectares: Number($("#areaHectares").value || 0), 
    talhao: $("#talhao").value.trim(),
    proxBloco: $('#proxBloco').value.trim(),
    numeroEletrobomba: $('#numeroEletrobomba').value.trim(),
    redeEletrica: $('#redeEletrica').value.trim(),
    quantidadeCarreteis: Number(quantidadeCarreteisInput.value || 0),
    carreteis: carreteis,
    tipoArea: $('#tipoArea').value.trim(),
    tipoIrrigacao: $('#tipoIrrigacao').value.trim(),
    tipoProduto: $('#tipoProduto').value.trim(),
    horasPlanejadas: Number($('#horasPlanejadas').value || 0),
    velocidadeCarretel: Number($('#velocidadeCarretel').value || 0),
    metrosLineares: Number($('#metrosLineares').value || 0),
    numeroCroqui: $('#numeroCroqui').value.trim(),
    vazao: $('#vazao').value.trim(),
    atualizadoEm: new Date().toISOString(),
  };
  delete payload.numeroCarretel; // Remove campo antigo
  if (
    Array.from($('#formArea').querySelectorAll('[required]')).some(
      i => !i.value.trim()
    )
  )
    return showMessage('Preencha todos os campos obrigatórios.', 'error');

  try {
    if (editDocId) {
      await updateDoc(doc(db, COLLECTION, editDocId), payload);
      showMessage('Área atualizada.');
    } else {
      payload.criadoEm = new Date().toISOString();
      payload.finalizada = false;
      await addDoc(collection(db, COLLECTION), payload);
      showMessage('Área cadastrada.');
    }
    editDocId = null;
    $('#formArea').reset();
    carreteisContainer.innerHTML = '';
    $('#cancelarEdicao').classList.add('hidden');
  } catch (e) {
    console.error(e);
    showMessage('Erro ao salvar área.', 'error');
  }
});

filtroProjetoCadastro.addEventListener('change', () => listarAreasCadastro());

$('#btnFiltrarOperador').addEventListener('click', listarAreasOperador);

async function listarAreasOperador() {
  listaAreasOperador.innerHTML = `<div class="text-sm text-gray-600">Carregando...</div>`;
  try {
    const ymd = filtroDataOperador.value || todayYMD();
    const snap = await getDocs(collection(db, COLLECTION));
    const filtroProj = (filtroProjetoOperador.value || '').trim();
    const cards = [];
    snap.forEach(docSnap => {
      const data = docSnap.data();
      if (
        operadorLogado &&
        !isAdmin &&
        operadorLogado.projetos &&
        !operadorLogado.projetos.includes(data.projeto)
      )
        return;
      if (data.finalizada === true) return;
      if (filtroProj && data.projeto !== filtroProj) return;
      cards.push({ id: docSnap.id, ...data });
    });

    if (cards.length === 0) {
      listaAreasOperador.innerHTML = `<div class="text-sm text-gray-600">Nenhuma área ativa para os filtros.</div>`;
      return;
    }

    const frag = document.createDocumentFragment();
    for (const area of cards) {
      const card = document.createElement('div');
      card.className =
        'bg-white rounded shadow p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4';
      const statusEl = document.createElement('div');
      statusEl.className = 'text-xs';
      statusEl.textContent = 'verificando...';
      (async () => {
        const st = await getStatusDia(area.id, ymd);
        const badge = document.createElement('span');
        badge.className =
          'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium';
        if (st === 'com_parada') {
          badge.className += ' bg-red-100 text-red-800';
          badge.textContent = 'Com parada';
        } else if (st === 'sem_parada') {
          badge.className += ' bg-green-100 text-green-800';
          badge.textContent = 'Sem parada';
        } else if (st === 'com_complementar') {
          badge.className += ' bg-sky-100 text-sky-800';
          badge.textContent = 'Com Irrig. Complementar';
        } else {
          badge.className += ' bg-gray-100 text-gray-800';
          badge.textContent = 'Sem registros';
        }
        statusEl.innerHTML = '';
        statusEl.appendChild(badge);
      })();
      const carreteisStr = Array.isArray(area.carreteis)
        ? area.carreteis.join(', ')
        : area.numeroCarretel || '-';
      card.innerHTML = `<div class="text-sm"><div class="font-semibold text-base text-blue-900">${
        area.bloco || '-'
      }</div><div><strong>Projeto:</strong> ${
        area.projeto || '-'
      }</div><div><strong>Bombeamento:</strong> ${
        area.bombeamento || '-'
      }</div><div><strong>Carretel(éis):</strong> ${carreteisStr}</div><div><strong>Velocidade:</strong> ${
        area.velocidadeCarretel || '-'
      } m/h</div><div><strong>ML (Plano):</strong> ${
        area.metrosLineares || '-'
      } m</div><div><strong>Vazão:</strong> ${
        area.vazao || '-'
      }</div><div><strong>H. Plan.:</strong> ${Number(
        area.horasPlanejadas || 0
      )}</div><div><strong>Croqui:</strong> ${
        area.numeroCroqui || '-'
      }</div><div><strong>Próx. Bloco:</strong> ${
        area.proxBloco || '-'
      }</div></div><div class="flex flex-col md:items-end gap-2 w-full md:w-auto"><div class="mb-1" id="statusWrap"></div><button class="btnAddParada bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 w-full md:w-auto">+ Registrar Atividade</button><button class="btnVerHistorico bg-gray-200 px-4 py-2 rounded hover:bg-gray-300 w-full md:w-auto">Histórico (${ymd})</button></div>`;
      card.querySelector('#statusWrap').appendChild(statusEl);
      card
        .querySelector('.btnAddParada')
        .addEventListener('click', () => abrirModal(area));
      card
        .querySelector('.btnVerHistorico')
        .addEventListener('click', () => abrirModal(area));
      frag.appendChild(card);
    }
    listaAreasOperador.innerHTML = '';
    listaAreasOperador.appendChild(frag);
  } catch (e) {
    console.error(e);
    listaAreasOperador.innerHTML = `<div class="text-sm text-red-600">Erro ao carregar áreas.</div>`;
  }
}

// ===== MODAL DE REGISTRO DE ATIVIDADE =====
const modalParada = $('#modalParada'),
  closeModalBtn = $('#closeModal'),
  cancelarParadaBtn = $('#cancelarParada'),
  formParada = $('#formParada'),
  camposRegistro = $('#camposRegistro'),
  detalhesParada = $('#detalhesParada'),
  detalhesComplementar = $('#detalhesComplementar'),
  duracaoParadaEl = $('#duracaoParada'),
  overlapAlert = $('#alertOverlap'),
  selecaoCarretelParadaDiv = $('#selecaoCarretelParada'),
  infoRedeEletricaDiv = $('#infoRedeEletrica'),
  codParadaSelect = $('#codParada');
let areaAtual = null,
  editParadaId = null;

formParada.querySelectorAll('input[name="tipoRegistro"]').forEach(r =>
  r.addEventListener('change', ev => {
    const val = ev.target.value;
    camposRegistro.classList.toggle('hidden', val === 'sem_parada');
    detalhesParada.classList.toggle('hidden', val !== 'parada');
    detalhesComplementar.classList.toggle('hidden', val !== 'complementar');
  })
);

codParadaSelect.addEventListener('change', e => {
  const selection = e.target.value,
    input = $('#equipamentoProblemaModal');
  selecaoCarretelParadaDiv.classList.add('hidden');
  infoRedeEletricaDiv.classList.add('hidden');
  input.value = '';
  if (selection === 'E') {
    if (areaAtual?.numeroEletrobomba) {
      infoRedeEletricaDiv.innerHTML = `<strong>N° Eletrobomba:</strong> ${areaAtual.numeroEletrobomba}`;
      input.value = areaAtual.numeroEletrobomba;
      infoRedeEletricaDiv.classList.remove('hidden');
    }
  } else if (selection === 'R') {
    if (areaAtual?.redeEletrica) {
      infoRedeEletricaDiv.innerHTML = `<strong>Rede Elétrica:</strong> ${areaAtual.redeEletrica}`;
      input.value = areaAtual.redeEletrica;
      infoRedeEletricaDiv.classList.remove('hidden');
    }
  } else if (selection === 'C') {
    selecaoCarretelParadaDiv.classList.remove('hidden');
  }
});

$('#numeroCarretelParada').addEventListener('change', e => {
  $('#equipamentoProblemaModal').value = e.target.value;
});

function calcularDuracaoModal() {
  overlapAlert.classList.add('hidden');
  const di = new Date($('#inicioParada').value),
    df = new Date($('#fimParada').value);
  if (isNaN(di) || isNaN(df) || df <= di) {
    duracaoParadaEl.textContent = '-';
    return 0;
  }
  const min = (df - di) / 60000;
  duracaoParadaEl.textContent = `${min.toFixed(0)} min (${(min / 60).toFixed(
    2
  )} h)`;
  return min / 60;
}
$('#inicioParada').addEventListener('input', calcularDuracaoModal);
$('#fimParada').addEventListener('input', calcularDuracaoModal);

const problemaOutroCheckbox = $('#problemaOutro'),
  descricaoProblemaOutroTextarea = $('#descricaoProblemaOutro');
problemaOutroCheckbox.addEventListener('change', () => {
  descricaoProblemaOutroTextarea.classList.toggle(
    'hidden',
    !problemaOutroCheckbox.checked
  );
});

function abrirModal(areaDoc, paradaParaEditar = null) {
  areaAtual = areaDoc;
  editParadaId = paradaParaEditar ? paradaParaEditar.id : null;
  $('#modalTitle').textContent = editParadaId
    ? 'Editar Registro'
    : 'Registrar Atividade Diária';
  $('#submitParadaBtn').textContent = editParadaId
    ? 'Salvar Alterações'
    : 'Salvar';
  $('#modalInfoArea').innerHTML = `<div><strong>Projeto:</strong> ${
    areaDoc.projeto || '-'
  }</div><div><strong>Bloco:</strong> ${areaDoc.bloco || '-'}</div>`;
  formParada.reset();
  selecaoCarretelParadaDiv.classList.add('hidden');
  infoRedeEletricaDiv.classList.add('hidden');
  $('input[name="tipoRegistro"][value="sem_parada"]').checked = true;
  descricaoProblemaOutroTextarea.value = '';
  descricaoProblemaOutroTextarea.classList.add('hidden');
  camposRegistro.classList.add('hidden');
  detalhesParada.classList.add('hidden');
  detalhesComplementar.classList.add('hidden');
  duracaoParadaEl.textContent = '-';
  overlapAlert.classList.add('hidden');

  const selCarretelParada = $('#numeroCarretelParada'),
    selCarretelComp = $('#numeroCarretelComplementar');
  selCarretelParada.innerHTML =
    '<option value="">Selecione o Carretel</option>';
  selCarretelComp.innerHTML = '<option value="">Nenhum (opcional)</option>';
  if (Array.isArray(areaDoc.carreteis) && areaDoc.carreteis.length > 0) {
    areaDoc.carreteis.forEach((num, index) => {
      const option = document.createElement('option');
      option.value = num;
      option.textContent = `Carretel ${index + 1}: ${num}`;
      selCarretelParada.appendChild(option.cloneNode(true));
      selCarretelComp.appendChild(option.cloneNode(true));
    });
  }

  if (paradaParaEditar) {
    const p = paradaParaEditar;
    const tipo = p.tipoRegistro || (p.houveParada ? 'parada' : 'sem_parada');
    $('input[name="tipoRegistro"][value="' + tipo + '"]').checked = true;
    if (tipo !== 'sem_parada') {
      camposRegistro.classList.remove('hidden');
      detalhesParada.classList.toggle('hidden', tipo !== 'parada');
      detalhesComplementar.classList.toggle('hidden', tipo !== 'complementar');
      $('#inicioParada').value = fromISOToDatetimeLocal(p.inicioParada);
      $('#fimParada').value = fromISOToDatetimeLocal(p.fimParada);
      calcularDuracaoModal();
      if (tipo === 'parada') {
        $('#codParada').value = p.codParada || '';
        if (p.codParada === 'C') {
          selecaoCarretelParadaDiv.classList.remove('hidden');
          $('#numeroCarretelParada').value = p.numeroCarretelParado || '';
        }
        $('#horimetroInicial').value = p.horimetroInicial || '';
        $('#horimetroFinal').value = p.horimetroFinal || '';
        $('#equipamentoProblemaModal').value = p.equipamentoProblema || '';
        $('#descricaoParadaCodigoSelect').value = p.descricaoParadaCodigo || '';
        $$('input[name="problema"]').forEach(cb => (cb.checked = false));
        if (Array.isArray(p.descricaoProblema))
          p.descricaoProblema.forEach(prob => {
            const cb = $(`input[name="problema"][value="${prob}"]`);
            if (cb) cb.checked = true;
          });
        if (p.descricaoProblemaOutro) {
          problemaOutroCheckbox.checked = true;
          descricaoProblemaOutroTextarea.value = p.descricaoProblemaOutro;
          descricaoProblemaOutroTextarea.classList.remove('hidden');
        }
      } else if (tipo === 'complementar') {
        $('#numeroCarretelComplementar').value = p.numeroCarretelParado || '';
      }
    }
  } else {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const in30 = new Date(now);
    in30.setMinutes(in30.getMinutes() + 30);
    $('#inicioParada').value = now.toISOString().slice(0, 16);
    $('#fimParada').value = in30.toISOString().slice(0, 16);
  }
  modalParada.classList.remove('hidden');
  modalParada.classList.add('flex');
  carregarHistoricoParadas(areaDoc.id, filtroDataOperador.value);
}

function fecharModal() {
  modalParada.classList.add('hidden');
  modalParada.classList.remove('flex');
  areaAtual = null;
  editParadaId = null;
}
closeModalBtn.addEventListener('click', fecharModal);
cancelarParadaBtn.addEventListener('click', fecharModal);
modalParada.addEventListener('click', e => {
  if (e.target === modalParada) fecharModal();
});

async function carregarHistoricoParadas(areaId, ymd) {
  const cont = $('#historicoParadas');
  cont.innerHTML = `<div class="text-gray-600 text-sm">Carregando...</div>`;
  try {
    const ref = collection(doc(db, COLLECTION, areaId), 'paradas');
    const qy = query(
      ref,
      where('inicioParada', '>=', `${ymd}T00:00:00`),
      where('inicioParada', '<=', `${ymd}T23:59:59`),
      orderBy('inicioParada', 'asc')
    );
    const snap = await getDocs(qy);
    if (snap.empty) {
      cont.innerHTML = `<div class="text-gray-600 text-sm">Sem registros para o dia.</div>`;
      return [];
    }

    const itens = snap.docs.map(s => ({ id: s.id, ...s.data() }));
    const frag = document.createDocumentFragment();
    itens.forEach(p => {
      const linha = document.createElement('div');
      const durh =
        p.duracaoHoras != null ? Number(p.duracaoHoras).toFixed(2) : '-';
      const tipo = p.tipoRegistro || (p.houveParada ? 'parada' : 'sem_parada');
      let tipoLabel = '';
      if (tipo === 'parada')
        tipoLabel = '<strong class="text-red-600">Parada</strong>';
      else if (tipo === 'complementar')
        tipoLabel =
          '<strong class="text-cyan-600">Irrigação Complementar</strong>';
      else tipoLabel = '<strong>Operação Normal</strong>';
      let detalhesHTML = '';
      if (tipo === 'parada') {
        const descricoes =
          (Array.isArray(p.descricaoProblema) && p.descricaoProblema.length > 0
            ? p.descricaoProblema.join(', ')
            : 'N/A') +
          (p.descricaoProblemaOutro
            ? `; Outro: ${p.descricaoProblemaOutro}`
            : '');
        const equipamento =
          p.codParada === 'C'
            ? `Carretel ${p.numeroCarretelParado || ''}`
            : `${p.codParada || '-'} ${
                p.equipamentoProblema ? '• ' + p.equipamentoProblema : ''
              }`;
        detalhesHTML = `<div><strong>Equip.:</strong> ${equipamento}</div><div><strong>Cód. Parada:</strong> ${
          p.descricaoParadaCodigo || '-'
        }</div><div><strong>Problema(s):</strong> ${descricoes}</div><div><strong>Início:</strong> ${formatDateTime(
          p.inicioParada
        )} • <strong>Fim:</strong> ${formatDateTime(
          p.fimParada
        )}</div><div><strong>Duração:</strong> ${durh} h</div><div><strong>Horímetro:</strong> ${
          p.horimetroInicial || '-'
        } até ${p.horimetroFinal || '-'}</div>`;
      } else if (tipo === 'complementar') {
        detalhesHTML = `${
          p.numeroCarretelParado
            ? `<div><strong>Carretel Substituto:</strong> ${p.numeroCarretelParado}</div>`
            : ''
        }<div><strong>Início:</strong> ${formatDateTime(
          p.inicioParada
        )} • <strong>Fim:</strong> ${formatDateTime(
          p.fimParada
        )}</div><div><strong>Duração:</strong> ${durh} h</div>`;
      }
      const infoRegistro =
        p.operadorNome && p.operadorMatricula
          ? `<div class="text-xs text-gray-500"><em>Registrado por: ${p.operadorNome} (${p.operadorMatricula})</em></div>`
          : '';
      const adminButtons = isAdmin
        ? `<div class="flex gap-2 mt-2"><button class="btnEditarParada text-xs bg-yellow-400 text-white px-2 py-1 rounded" data-parada-id="${p.id}">Editar</button><button class="btnExcluirParada text-xs bg-red-500 text-white px-2 py-1 rounded" data-parada-id="${p.id}">Excluir</button></div>`
        : '';
      linha.className = 'border rounded p-2';
      linha.innerHTML = `<div><strong>Tipo:</strong> ${tipoLabel}</div>${detalhesHTML}<div class="text-xs text-gray-500"><em>Registrado em:</em> ${
        p.createdAt?.seconds
          ? new Date(p.createdAt.seconds * 1000).toLocaleString('pt-BR')
          : '-'
      }</div>${infoRegistro}${adminButtons}`;
      frag.appendChild(linha);
    });
    cont.innerHTML = '';
    cont.appendChild(frag);
    cont.querySelectorAll('.btnEditarParada').forEach(btn =>
      btn.addEventListener('click', () => {
        const p = itens.find(item => item.id === btn.dataset.paradaId);
        if (p) abrirModal(areaAtual, p);
      })
    );
    cont
      .querySelectorAll('.btnExcluirParada')
      .forEach(btn =>
        btn.addEventListener('click', () =>
          excluirParada(areaId, btn.dataset.paradaId)
        )
      );
    return itens;
  } catch (e) {
    console.error(e);
    cont.innerHTML = `<div class="text-red-600 text-sm">Erro ao carregar histórico.</div>`;
    return [];
  }
}

async function excluirParada(areaId, paradaId) {
  if (!confirm('Excluir este registro?')) return;
  try {
    await deleteDoc(doc(db, COLLECTION, areaId, 'paradas', paradaId));
    showMessage('Registro excluído.');
    carregarHistoricoParadas(areaId, filtroDataOperador.value);
  } catch (e) {
    console.error('Erro ao excluir registro:', e);
    showMessage('Erro ao excluir.', 'error');
  }
}

function existeSobreposicao(
  registros,
  novoInicioIso,
  novoFimIso,
  idSendoEditado
) {
  const ni = new Date(novoInicioIso).getTime(),
    nf = new Date(novoFimIso).getTime();
  return registros.some(r => {
    if (r.id === idSendoEditado || !r.inicioParada) return false;
    const ri = new Date(r.inicioParada).getTime(),
      rf = new Date(r.fimParada).getTime();
    return ni < rf && nf > ri;
  });
}

formParada.addEventListener('submit', async e => {
  e.preventDefault();
  if (!areaAtual?.id) return showMessage('Área inválida.', 'error');
  const submitBtn = $('#submitParadaBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Salvando...';

  try {
    const tipoRegistro = formParada.querySelector(
      'input[name="tipoRegistro"]:checked'
    ).value;
    let payload = { createdAt: serverTimestamp(), tipoRegistro };
    if (operadorLogado) {
      payload.operadorNome = operadorLogado.nome;
      payload.operadorMatricula = operadorLogado.matricula;
    }

    if (tipoRegistro === 'sem_parada') {
      payload.houveParada = false;
    } else {
      const ymdFiltro = $('#filtroDataOperador').value;
      const horaInicio = $('#inicioParada').value.split('T')[1],
        horaFim = $('#fimParada').value.split('T')[1];
      const inicioCorreto = `${ymdFiltro}T${horaInicio}`,
        fimCorreto = `${ymdFiltro}T${horaFim}`;
      const di = new Date(inicioCorreto),
        df = new Date(fimCorreto);
      if (isNaN(di) || isNaN(df) || df <= di)
        throw new Error('Verifique os horários de início e término.');

      const inicioIso = toISOFromDatetimeLocal(inicioCorreto),
        fimIso = toISOFromDatetimeLocal(fimCorreto);
      const historico = await carregarHistoricoParadas(areaAtual.id, ymdFiltro);
      if (existeSobreposicao(historico, inicioIso, fimIso, editParadaId)) {
        overlapAlert.classList.remove('hidden');
        throw new Error('Intervalo sobrepõe registro existente.');
      }

      payload = {
        ...payload,
        houveParada: tipoRegistro === 'parada',
        inicioParada: inicioIso,
        fimParada: fimIso,
        duracaoHoras: Number(((df - di) / 3600000).toFixed(2)),
      };

      if (tipoRegistro === 'parada') {
        if ($('#codParada').value === 'C' && !$('#numeroCarretelParada').value)
          throw new Error('Selecione o carretel com parada.');
        const descricoes = Array.from($$('input[name="problema"]:checked')).map(
          cb => cb.value
        );
        const outro = problemaOutroCheckbox.checked
          ? descricaoProblemaOutroTextarea.value.trim()
          : '';
        if (!$('#codParada').value || !$('#descricaoParadaCodigoSelect').value)
          throw new Error('Verifique tipo de equipamento e código da parada.');
        if (descricoes.length === 0 && !outro)
          throw new Error("Selecione um problema ou descreva em 'Outro'.");
        payload = {
          ...payload,
          codParada: $('#codParada').value,
          numeroCarretelParado: $('#numeroCarretelParada').value || null,
          descricaoParadaCodigo: $('#descricaoParadaCodigoSelect').value,
          descricaoProblema: descricoes,
          descricaoProblemaOutro: outro,
          equipamentoProblema: $('#equipamentoProblemaModal').value.trim(),
          horimetroInicial: $('#horimetroInicial').value.trim() || null,
          horimetroFinal: $('#horimetroFinal').value.trim() || null,
        };
      } else if (tipoRegistro === 'complementar') {
        payload.numeroCarretelParado =
          $('#numeroCarretelComplementar').value || null;
      }
    }

    if (editParadaId)
      await updateDoc(
        doc(db, COLLECTION, areaAtual.id, 'paradas', editParadaId),
        payload
      );
    else
      await addDoc(
        collection(doc(db, COLLECTION, areaAtual.id), 'paradas'),
        payload
      );

    showMessage(
      navigator.onLine
        ? editParadaId
          ? 'Registro atualizado!'
          : 'Registro salvo!'
        : 'Salvo localmente! Sincronizando...',
      navigator.onLine ? 'success' : 'sync'
    );
    fecharModal();
  } catch (e) {
    console.error(e);
    showMessage(e.message || 'Erro ao salvar registro.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = editParadaId ? 'Salvar Alterações' : 'Salvar';
  }
});

async function getStatusDia(areaId, ymd) {
  try {
    const ref = collection(doc(db, COLLECTION, areaId), 'paradas');
    const qy = query(
      ref,
      where('inicioParada', '>=', `${ymd}T00:00:00`),
      where('inicioParada', '<=', `${ymd}T23:59:59`)
    );
    const snap = await getDocs(qy);
    if (snap.empty) return 'sem_registro';
    let comParada = false,
      comComplementar = false;
    snap.forEach(s => {
      const d = s.data();
      if (d.houveParada) comParada = true;
      if (d.tipoRegistro === 'complementar') comComplementar = true;
    });
    if (comParada) return 'com_parada';
    if (comComplementar) return 'com_complementar';
    return 'sem_parada';
  } catch (e) {
    console.error('status dia erro:', e);
    return 'sem_registro';
  }
}

// ===== EXPORTAÇÕES (CSV/PDF) =====
$('#btnExportCSV').addEventListener('click', async () => {
  const ymd = filtroDataOperador.value || todayYMD();
  const dados = await coletarParadasDia(ymd);
  downloadBlob(
    new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), toCSV(dados, true)], {
      type: 'text/csv;charset=utf-8;',
    }),
    `paradas_${ymd}.csv`
  );
});
$('#btnExportPDF').addEventListener('click', async () => {
  const ymd = filtroDataOperador.value || todayYMD();
  const dados = await coletarParadasDia(ymd);
  gerarPDF(dados, ymd, 'Relatório de Paradas');
});

async function coletarParadasDia(ymd) {
  const start = new Date(ymd + 'T00:00:00.000Z'),
    end = new Date(ymd + 'T23:59:59.999Z');

  // MODIFICADO: Início da construção da consulta
  let areasQuery = collection(db, COLLECTION);
  if (
    operadorLogado &&
    !isAdmin &&
    Array.isArray(operadorLogado.projetos) &&
    operadorLogado.projetos.length > 0
  ) {
    areasQuery = query(
      areasQuery,
      where('projeto', 'in', operadorLogado.projetos)
    );
  } else if (operadorLogado && !isAdmin) {
    areasQuery = query(
      areasQuery,
      where('projeto', '==', 'acesso_negado_sem_projeto_definido')
    );
  }
  const areasSnap = await getDocs(areasQuery); // Usa a consulta filtrada
  // FIM DA MODIFICAÇÃO

  const all = [];
  for (const areaDoc of areasSnap.docs) {
    const area = areaDoc.data();
    // A verificação abaixo se torna redundante, mas podemos manter por segurança extra.
    if (
      operadorLogado &&
      !isAdmin &&
      operadorLogado.projetos &&
      !operadorLogado.projetos.includes(area.projeto)
    )
      continue;
    const ref = collection(doc(db, COLLECTION, areaDoc.id), 'paradas');
    const qy = query(
      ref,
      where('inicioParada', '>=', start.toISOString()),
      where('inicioParada', '<=', end.toISOString()),
      orderBy('inicioParada', 'asc')
    );
    const paradasSnap = await getDocs(qy);
    const carreteisStr = Array.isArray(area.carreteis)
      ? area.carreteis.join('; ')
      : area.numeroCarretel || '';
    if (paradasSnap.empty) {
      all.push({
        projeto: area.projeto || '',
        bloco: area.bloco || '',
        bombeamento: area.bombeamento || '',
        numeroEletrobomba: area.numeroEletrobomba || '',
        numeroCarreteis: carreteisStr,
        descricaoCompletaParada: 'Sem registro de atividade',
      });
    } else {
      paradasSnap.forEach(p => {
        const d = p.data();
        let desc = 'Operação Normal';
        if (d.tipoRegistro === 'parada')
          desc = `PARADA: ${
            d.codParada === 'C' ? `Carretel ${d.numeroCarretelParado}` : ''
          } ${d.descricaoParadaCodigo || ''} (${
            Array.isArray(d.descricaoProblema)
              ? d.descricaoProblema.join('; ')
              : ''
          }${
            d.descricaoProblemaOutro
              ? `; Outro: ${d.descricaoProblemaOutro}`
              : ''
          })`;
        else if (d.tipoRegistro === 'complementar')
          desc = `IRRIGAÇÃO COMPLEMENTAR${
            d.numeroCarretelParado
              ? ` (substituindo ${d.numeroCarretelParado})`
              : ''
          }`;
        all.push({
          projeto: area.projeto || '',
          bloco: area.bloco || '',
          bombeamento: area.bombeamento || '',
          numeroEletrobomba: area.numeroEletrobomba || '',
          numeroCarreteis: carreteisStr,
          velocidadeCarretel: area.velocidadeCarretel || '',
          metrosLinearesPlano: area.metrosLineares || '',
          vazao: area.vazao || '',
          tipoArea: area.tipoArea || '',
          tipoIrrigacao: area.tipoIrrigacao || '',
          tipoProduto: area.tipoProduto || '',
          horasPlanejadas: Number(area.horasPlanejadas || 0).toFixed(2),
          numeroCroqui: area.numeroCroqui || '',
          proxBloco: area.proxBloco || '',
          descricaoCompletaParada: desc,
          inicioParada: formatDateTime(d.inicioParada),
          fimParada: formatDateTime(d.fimParada),
          duracaoHoras:
            d.duracaoHoras != null ? Number(d.duracaoHoras).toFixed(2) : '',
          registradoEm: d.createdAt?.seconds
            ? new Date(d.createdAt.seconds * 1000).toLocaleString('pt-BR')
            : '',
        });
      });
    }
  }
  return all;
}

function toCSV(dados, useSemicolon = false) {
  if (!dados.length) return 'Sem dados';
  const sep = useSemicolon ? ';' : ',';
  const header = Object.keys(dados[0]).join(sep);
  const linhas = dados.map(row =>
    Object.keys(dados[0])
      .map(c => `"${(row[c] ?? '').toString().replace(/"/g, '""')}"`)
      .join(sep)
  );
  return header + '\n' + linhas.join('\n');
}
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function gerarPDF(dados, ymd, titulo = 'Relatório') {
  if (!dados.length) {
    showMessage('Sem dados para exportar.', 'error');
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(14);
  doc.text(`${titulo} - ${ymd}`, 14, 15);
  const colunas = Object.keys(dados[0]);
  const linhas = dados.map(d => colunas.map(c => d[c] || ''));
  doc.autoTable({
    head: [colunas],
    body: linhas,
    startY: 20,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [37, 99, 235] },
  });
  doc.save(`${titulo.replaceAll(' ', '_').toLowerCase()}_${ymd}.pdf`);
}

// ===== RELATÓRIOS CONSOLIDADOS =====
$('#btnGerarRelatorio').addEventListener('click', gerarRelatoriosUI);
$('#btnExportCSVRel').addEventListener('click', async () => {
  const { ymd, linhas } = await calcularRelatorio();
  downloadBlob(
    new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), toCSV(linhas, true)], {
      type: 'text/csv;charset=utf-8;',
    }),
    `relatorio_${ymd}.csv`
  );
});
$('#btnExportPDFRel').addEventListener('click', async () => {
  const { ymd, linhas } = await calcularRelatorio();
  gerarPDF(linhas, ymd, 'Relatório Consolidado');
});

async function calcularRelatorio() {
  const ymd = filtroDataRel.value || todayYMD();
  const filtroProj = (filtroProjetoRel.value || '').trim();

  let areasQuery = collection(db, COLLECTION);

  if (
    operadorLogado &&
    !isAdmin &&
    Array.isArray(operadorLogado.projetos) &&
    operadorLogado.projetos.length > 0
  ) {
    areasQuery = query(
      areasQuery,
      where('projeto', 'in', operadorLogado.projetos)
    );
  } else if (operadorLogado && !isAdmin) {
    areasQuery = query(
      areasQuery,
      where('projeto', '==', 'acesso_negado_sem_projeto_definido')
    );
  }

  if (filtroProj) {
    areasQuery = query(areasQuery, where('projeto', '==', filtroProj));
  }

  const areasSnap = await getDocs(areasQuery);
  const areas = areasSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const linhas = [];
  let totalPlan = 0,
    totalParSistema = 0,
    totalMetrosPlano = 0,
    totalMetrosReal = 0,
    totalHectaresPlano = 0,
    totalHectaresRealDoDia = 0,
    totalMetrosHorimetro = 0,
    totalComplementar = 0,
    totalRodadasEficiencia = 0,
    totalAreaCadastradaHectares = 0,
    totalHectaresReaisAcumulados = 0; // Novo: para o total geral acumulado

  for (const area of areas) {
    totalAreaCadastradaHectares += Number(area.areaHectares || 0);

    // --- NOVO: Lógica para buscar o histórico de irrigação da área ---
    const irrigacoesRef = collection(db, "Areas", area.id, "irrigacoes");
    const qIrrigacoes = query(irrigacoesRef, where("dataIrrigacao", "<=", ymd));
    const irrigacoesSnap = await getDocs(qIrrigacoes);

    let hectaresAcumuladosParaEstaArea = 0;
    irrigacoesSnap.forEach(irrigacaoDoc => {
        hectaresAcumuladosParaEstaArea += Number(irrigacaoDoc.data().hectaresReal || 0);
    });
    totalHectaresReaisAcumulados += hectaresAcumuladosParaEstaArea;
    // --- FIM DA NOVA LÓGICA ---

    const paradasRef = collection(doc(db, COLLECTION, area.id), 'paradas');
    const qParadas = query(
      paradasRef,
      where('inicioParada', '>=', `${ymd}T00:00:00`),
      where('inicioParada', '<=', `${ymd}T23:59:59`)
    );
    const paradasSnap = await getDocs(qParadas);

    let horasParadasSistema = 0,
      horasComplementar = 0,
      horasHorimetro = 0;
    const paradasPorCarretel = {};

    paradasSnap.forEach(s => {
      const p = s.data();
      const duracao = Number(p.duracaoHoras) || 0;
      if (p.houveParada) {
        if (p.codParada === 'E' || p.codParada === 'R') {
          horasParadasSistema += duracao;
        } else if (p.codParada === 'C' && p.numeroCarretelParado) {
          paradasPorCarretel[p.numeroCarretelParado] =
            (paradasPorCarretel[p.numeroCarretelParado] || 0) + duracao;
        }
      }
      if (p.tipoRegistro === 'complementar') {
        horasComplementar += duracao;
        if (p.numeroCarretelParado) {
          paradasPorCarretel[p.numeroCarretelParado] =
            (paradasPorCarretel[p.numeroCarretelParado] || 0) + duracao;
        }
      }
      if (p.horimetroFinal && p.horimetroInicial) {
        horasHorimetro +=
          Number(String(p.horimetroFinal).replace(',', '.')) -
          Number(String(p.horimetroInicial).replace(',', '.'));
      }
    });

    const planejadas = Number(area.horasPlanejadas || 0);
    const velocidade = Number(area.velocidadeCarretel || 0);
    const qtdCarreteis = Number(area.quantidadeCarreteis || 1);
    const carreteis = Array.isArray(area.carreteis) ? area.carreteis : [];

    let metrosRealArea = 0;
    for (const numCarretel of carreteis) {
      const paradasDoCarretel = paradasPorCarretel[numCarretel] || 0;
      const horasRodadasCarretel = Math.max(
        0,
        planejadas - horasParadasSistema - paradasDoCarretel
      );
      metrosRealArea += horasRodadasCarretel * velocidade;
    }

    const horasRodadasParaEficiencia = Math.max(0, planejadas - horasParadasSistema);
    const efic = planejadas > 0 ? (horasRodadasParaEficiencia / planejadas) * 100 : 0;
    const metrosPlano = planejadas * velocidade * qtdCarreteis;
    const hectaresPlano = metrosPlano * fatorCarreador;
    const hectaresRealDoDia = metrosRealArea * fatorCarreador;
    const metrosRealHorimetro = horasHorimetro * velocidade * qtdCarreteis;

    totalPlan += planejadas;
    totalParSistema += horasParadasSistema;
    totalComplementar += horasComplementar;
    totalMetrosPlano += metrosPlano;
    totalMetrosReal += metrosRealArea;
    totalHectaresPlano += hectaresPlano;
    totalHectaresRealDoDia += hectaresRealDoDia;
    totalMetrosHorimetro += metrosRealHorimetro;
    totalRodadasEficiencia += horasRodadasParaEficiencia;

    linhas.push({
      areaId: area.id,
      numeroCroqui: area.numeroCroqui || '',
      projeto: area.projeto || '',
      bloco: area.bloco || '',
      bombeamento: area.bombeamento || '',
      eletrobomba: area.numeroEletrobomba || '',
      carretel: carreteis.join(', '),
      horasPlanejadas: planejadas.toFixed(2),
      horasParadas: horasParadasSistema.toFixed(2),
      horasComplementar: horasComplementar.toFixed(2),
      horasRodadas: horasRodadasParaEficiencia.toFixed(2),
      eficiencia: `${efic.toFixed(1)}%`,
      metrosLinearesPlano: metrosPlano.toFixed(2),
      metrosLinearesReal: metrosRealArea.toFixed(2),
      hectaresPlano: hectaresPlano.toFixed(2),
      hectaresReal: hectaresRealDoDia.toFixed(2),
    });
  }

  return {
    ymd,
    sum: {
      totalPlan,
      totalPar: totalParSistema,
      rodadasTot: totalRodadasEficiencia,
      eficTot: totalPlan > 0 ? (totalRodadasEficiencia / totalPlan) * 100 : 0,
      totalMetrosPlano,
      totalMetrosReal,
      totalHectaresPlano,
      totalHectaresRealDoDia, // Total de hectares irrigados apenas no dia selecionado
      totalHectaresIrrigados: totalHectaresReaisAcumulados, // Total de hectares acumulado
      totalMetrosHorimetro,
      totalComplementar,
      totalAreaCadastrada: totalAreaCadastradaHectares,
      qtdeConjuntos: linhas.length,
    },
    linhas,
  };
}

async function gerarRelatoriosUI() {
    const sumPlane = $('#sumPlanejadas'),
        sumPar = $('#sumParadas'),
        sumRod = $('#sumRodadas'),
        sumEf = $('#sumEficiencia'),
        sumMetrosPlanoEl = $('#sumMetrosPlano'),
        sumMetrosRealEl = $('#sumMetrosReal'),
        sumHectaresPlanoEl = $('#sumHectaresPlano'),
        sumHectaresRealEl = $('#sumHectaresReal'), // Card de performance do dia
        sumMetrosHorimetroEl = $('#sumMetrosHorimetro'),
        sumComplementarEl = $('#sumComplementar'),
        sumQtdeConjuntosEl = $('#sumQtdeConjuntos'),
        sumAreaTotalEl = $('#sumAreaTotal'), // Card de progresso (acumulado)
        sumAreaIrrigadaEl = $('#sumAreaIrrigada'), // Card de progresso (acumulado)
        sumAreaRestanteEl = $('#sumAreaRestante'), // Card de progresso (acumulado)
        tabelaRel = $('#tabelaRel');

    tabelaRel.innerHTML = `<div class="text-sm text-gray-600">Calculando e salvando...</div>`;

    try {
        const { sum, linhas, ymd } = await calcularRelatorio();

        // Atualiza os cards de performance do DIA
        sumPlane.textContent = sum.totalPlan.toFixed(2);
        sumPar.textContent = sum.totalPar.toFixed(2);
        sumRod.textContent = sum.rodadasTot.toFixed(2);
        sumEf.textContent = `${sum.eficTot.toFixed(1)}%`;
        sumMetrosPlanoEl.textContent = sum.totalMetrosPlano.toFixed(2);
        sumMetrosRealEl.textContent = sum.totalMetrosReal.toFixed(2);
        sumHectaresPlanoEl.textContent = sum.totalHectaresPlano.toFixed(2);
        sumHectaresRealEl.textContent = sum.totalHectaresRealDoDia.toFixed(2); // Mostra o realizado do dia
        sumMetrosHorimetroEl.textContent = sum.totalMetrosHorimetro.toFixed(2);
        sumComplementarEl.textContent = sum.totalComplementar.toFixed(2);
        sumQtdeConjuntosEl.textContent = sum.qtdeConjuntos;
        
        // Atualiza os cards de progresso com os totais ACUMULADOS
        const areaRestanteAcumulada = sum.totalAreaCadastrada - sum.totalHectaresIrrigados;
        sumAreaTotalEl.textContent = sum.totalAreaCadastrada.toFixed(2);
        sumAreaIrrigadaEl.textContent = sum.totalHectaresIrrigados.toFixed(2); // Mostra o total acumulado
        sumAreaRestanteEl.textContent = areaRestanteAcumulada.toFixed(2);

        // Salva os dados na subcoleção "irrigacoes" de cada área
        if (linhas.length > 0) {
            const savePromises = linhas.map(linha => {
                const irrigacaoPayload = {
                    dataIrrigacao: ymd,
                    hectaresPlano: parseFloat(linha.hectaresPlano),
                    hectaresReal: parseFloat(linha.hectaresReal),
                    horasRodadas: parseFloat(linha.horasRodadas),
                    eficiencia: linha.eficiencia,
                    geradoEm: serverTimestamp()
                };
                const irrigacaoDocRef = doc(db, "Areas", linha.areaId, "irrigacoes", ymd);
                return setDoc(irrigacaoDocRef, irrigacaoPayload, { merge: true });
            });

            await Promise.all(savePromises);
            showMessage('Relatório gerado e dados de irrigação salvos para cada bloco.', 'success');
        }

        if (!linhas.length) {
            tabelaRel.innerHTML = `<div class="text-sm text-gray-600">Sem dados para os filtros na data de hoje.</div>`;
            return;
        }

        const headers = [
            'Croqui', 'Projeto', 'Bloco', 'Bomb.', 'Eletro.', 'Carretel(éis)',
            'H. Plan', 'H. Par', 'H. Compl.', 'H. Rod', 'Efic.',
            'ML Plan', 'ML Real', 'HA Plan', 'HA Real (Dia)',
        ];
        const thead = `<thead><tr>${headers.map(h => `<th class="px-3 py-2 border-b bg-gray-50 text-left text-sm font-semibold">${h}</th>`).join('')}</tr></thead>`;
        const tbody = `<tbody>${linhas.map(l =>
            `<tr class="hover:bg-gray-50">
                <td class="px-3 py-2 text-sm">${l.numeroCroqui}</td>
                <td class="px-3 py-2 text-sm">${l.projeto}</td>
                <td class="px-3 py-2 text-sm">${l.bloco}</td>
                <td class="px-3 py-2 text-sm">${l.bombeamento}</td>
                <td class="px-3 py-2 text-sm">${l.eletrobomba}</td>
                <td class="px-3 py-2 text-sm">${l.carretel}</td>
                <td class="px-3 py-2 text-sm">${l.horasPlanejadas}</td>
                <td class="px-3 py-2 text-sm text-amber-800">${l.horasParadas}</td>
                <td class="px-3 py-2 text-sm text-sky-800">${l.horasComplementar}</td>
                <td class="px-3 py-2 text-sm text-emerald-800">${l.horasRodadas}</td>
                <td class="px-3 py-2 text-sm font-semibold">${l.eficiencia}</td>
                <td class="px-3 py-2 text-sm">${l.metrosLinearesPlano}</td>
                <td class="px-3 py-2 text-sm font-semibold text-teal-800">${l.metrosLinearesReal}</td>
                <td class="px-3 py-2 text-sm font-semibold text-green-800">${l.hectaresPlano}</td>
                <td class="px-3 py-2 text-sm font-semibold text-green-800">${l.hectaresReal}</td>
            </tr>`
        ).join('')}</tbody>`;
        tabelaRel.innerHTML = `<div class="overflow-auto"><table class="min-w-full">${thead}${tbody}</table></div>`;

    } catch (err) {
        console.error("Erro ao gerar relatório ou salvar irrigação:", err);
        tabelaRel.innerHTML = `<div class="text-sm text-red-600">Erro ao processar o relatório.</div>`;
        showMessage('Erro ao processar o relatório.', 'error');
    }
}


// ===== RELATÓRIO INDIVIDUAL =====
async function popularFiltroAreaIndividual(areas) {
  const select = $('#filtroAreaIndividual');
  select.innerHTML = `<option value="">-- Selecione uma Área --</option>`;
  const areasAtivas = areas.filter(
    a =>
      a.finalizada !== true &&
      (!operadorLogado ||
        isAdmin ||
        (operadorLogado.projetos &&
          operadorLogado.projetos.includes(a.projeto)))
  );
  areasAtivas.sort((a, b) => (a.bloco || '').localeCompare(b.bloco || ''));
  areasAtivas.forEach(area => {
    const option = document.createElement('option');
    option.value = area.id;
    option.textContent = `${area.bloco} (${area.projeto})`;
    select.appendChild(option);
  });
}

$('#btnGerarRelatorioIndividual').addEventListener(
  'click',
  gerarRelatorioIndividualUI
);

async function gerarRelatorioIndividualUI() {
  const areaId = $('#filtroAreaIndividual').value,
    ymd = $('#filtroDataRel').value || todayYMD();
  const tabelaInd = $('#tabelaRelIndividual');
  
  // Limpa resultados anteriores
  tabelaInd.innerHTML = '';
  const progressoDiv = $('#progressoIndividual');
  if (progressoDiv) progressoDiv.remove();

  if (!areaId) {
    showMessage('Selecione uma área.', 'error');
    return;
  }
  
  tabelaInd.innerHTML = `<div class="text-sm text-gray-600">Calculando...</div>`;
  const areaDoc = await getDoc(doc(db, COLLECTION, areaId));
  if (!areaDoc.exists()) {
    showMessage('Área não encontrada.', 'error');
    tabelaInd.innerHTML = '';
    return;
  }
  const area = areaDoc.data();

  // --- LÓGICA CUMULATIVA PARA O RELATÓRIO INDIVIDUAL ---
  const irrigacoesRef = collection(db, "Areas", areaId, "irrigacoes");
  const qIrrigacoes = query(irrigacoesRef, where("dataIrrigacao", "<=", ymd));
  const irrigacoesSnap = await getDocs(qIrrigacoes);
  
  let hectaresAcumulados = 0;
  irrigacoesSnap.forEach(irrigacaoDoc => {
      hectaresAcumulados += Number(irrigacaoDoc.data().hectaresReal || 0);
  });
  
  const areaTotalDoBloco = Number(area.areaHectares || 0);
  const areaRestante = areaTotalDoBloco - hectaresAcumulados;

  const summaryDiv = document.createElement('div');
  summaryDiv.id = 'progressoIndividual';
  summaryDiv.className = 'grid grid-cols-1 md:grid-cols-3 gap-4 my-4 p-4 bg-gray-50 rounded-lg border';
  summaryDiv.innerHTML = `
    <div class="text-center">
      <div class="text-xs font-semibold text-gray-700 uppercase">Área Total do Bloco (ha)</div>
      <div class="text-2xl font-bold text-gray-900">${areaTotalDoBloco.toFixed(2)}</div>
    </div>
    <div class="text-center">
      <div class="text-xs font-semibold text-green-700 uppercase">Total Irrigado (ha)</div>
      <div class="text-2xl font-bold text-green-900">${hectaresAcumulados.toFixed(2)}</div>
    </div>
    <div class="text-center">
      <div class="text-xs font-semibold text-red-700 uppercase">Área Restante (ha)</div>
      <div class="text-2xl font-bold text-red-900">${areaRestante.toFixed(2)}</div>
    </div>
  `;
  $('#sumarioRelIndividual').after(summaryDiv);
  // --- FIM DA LÓGICA CUMULATIVA ---

  const ref = collection(doc(db, COLLECTION, areaId), 'paradas');
  const qy = query(
    ref,
    where('inicioParada', '>=', `${ymd}T00:00:00`),
    where('inicioParada', '<=', `${ymd}T23:59:59`),
    orderBy('inicioParada', 'asc')
  );
  const snap = await getDocs(qy);
  let horasParadasSistema = 0,
    horasHorimetro = 0,
    horasComplementar = 0;
  const paradasPorCarretel = {},
    paradasTabela = [];
  snap.forEach(s => {
    const p = s.data(),
      duracao = Number(p.duracaoHoras) || 0,
      tipo = p.tipoRegistro || (p.houveParada ? 'parada' : 'sem_parada');
    if (p.houveParada) {
      if (p.codParada === 'E' || p.codParada === 'R')
        horasParadasSistema += duracao;
      else if (p.codParada === 'C' && p.numeroCarretelParado)
        paradasPorCarretel[p.numeroCarretelParado] =
          (paradasPorCarretel[p.numeroCarretelParado] || 0) + duracao;
    }
    if (tipo === 'complementar') {
      horasComplementar += duracao;
      if (p.numeroCarretelParado)
        paradasPorCarretel[p.numeroCarretelParado] =
          (paradasPorCarretel[p.numeroCarretelParado] || 0) + duracao;
    }
    if (p.horimetroFinal && p.horimetroInicial)
      horasHorimetro +=
        Number(String(p.horimetroFinal).replace(',', '.')) -
        Number(String(p.horimetroInicial).replace(',', '.'));
    let tipoLabel = 'Op. Normal',
      problema = '-';
    if (tipo === 'parada') {
      tipoLabel = `Parada (${p.codParada === 'C' ? 'Carretel' : 'Sistema'})`;
      problema =
        (Array.isArray(p.descricaoProblema)
          ? p.descricaoProblema.join(', ')
          : '') +
        (p.descricaoProblemaOutro
          ? ` (Outro: ${p.descricaoProblemaOutro})`
          : '');
    }
    if (tipo === 'complementar') {
      tipoLabel = 'Irrig. Compl.';
      if (p.numeroCarretelParado)
        problema = `Substituindo ${p.numeroCarretelParado}`;
    }
    paradasTabela.push({
      tipoRegistro: tipoLabel,
      problema: problema,
      carretel: p.numeroCarretelParado || '-',
      inicio: formatDateTime(p.inicioParada),
      fim: formatDateTime(p.fimParada),
      duracao: duracao.toFixed(2),
      horimetroInicial: p.horimetroInicial || '-',
      horimetroFinal: p.horimetroFinal || '-',
      descricaoCompleta: p.descricaoParadaCodigo || '-',
    });
  });
  const planejadas = Number(area.horasPlanejadas || 0),
    velocidade = Number(area.velocidadeCarretel || 0),
    qtdCarreteis = Number(area.quantidadeCarreteis || 1),
    carreteis = Array.isArray(area.carreteis) ? area.carreteis : [];
  let metrosRealArea = 0;
  for (const numCarretel of carreteis) {
    const paradasDoCarretel = paradasPorCarretel[numCarretel] || 0;
    const horasRodadasCarretel = Math.max(
      0,
      planejadas - horasParadasSistema - paradasDoCarretel
    );
    metrosRealArea += horasRodadasCarretel * velocidade;
  }
  const rodadas = Math.max(0, planejadas - horasParadasSistema),
    efic = planejadas > 0 ? (rodadas / planejadas) * 100 : 0;
  const metrosPlano = planejadas * velocidade * qtdCarreteis,
    hectaresPlano = metrosPlano * fatorCarreador,
    hectaresReal = metrosRealArea * fatorCarreador,
    metrosRealHorimetro = horasHorimetro * velocidade * qtdCarreteis;
  $('#sumPlanejadasInd').textContent = planejadas.toFixed(2);
  $('#sumParadasInd').textContent = horasParadasSistema.toFixed(2);
  $('#sumRodadasInd').textContent = rodadas.toFixed(2);
  $('#sumEficienciaInd').textContent = `${efic.toFixed(1)}%`;
  $('#sumMetrosPlanoInd').textContent = metrosPlano.toFixed(2);
  $('#sumMetrosRealInd').textContent = metrosRealArea.toFixed(2);
  $('#sumHectaresPlanoInd').textContent = hectaresPlano.toFixed(2);
  $('#sumHectaresRealInd').textContent = hectaresReal.toFixed(2);
  $('#sumMetrosHorimetroInd').textContent = metrosRealHorimetro.toFixed(2);
  $('#sumComplementarInd').textContent = horasComplementar.toFixed(2);
  if (!paradasTabela.length) {
    tabelaInd.innerHTML = `<div class="text-sm text-gray-600">Nenhum registro de atividade para o dia.</div>`;
    return;
  }
  const headers = [
    'Tipo',
    'Carretel',
    'Problema',
    'Início',
    'Fim',
    'Duração (h)',
    'Hor. Inicial',
    'Hor. Final',
    'Cód. Parada',
  ];
  const thead = `<thead><tr>${headers
    .map(
      h =>
        `<th class="px-3 py-2 border-b bg-gray-50 text-left text-sm font-semibold">${h}</th>`
    )
    .join('')}</tr></thead>`;
  const tbody = `<tbody>${paradasTabela
    .map(
      p =>
        `<tr class="hover:bg-gray-50"><td class="px-3 py-2 text-sm">${p.tipoRegistro}</td><td class="px-3 py-2 text-sm">${p.carretel}</td><td class="px-3 py-2 text-sm">${p.problema}</td><td class="px-3 py-2 text-sm">${p.inicio}</td><td class="px-3 py-2 text-sm">${p.fim}</td><td class="px-3 py-2 text-sm">${p.duracao}</td><td class="px-3 py-2 text-sm">${p.horimetroInicial}</td><td class="px-3 py-2 text-sm">${p.horimetroFinal}</td><td class="px-3 py-2 text-sm">${p.descricaoCompleta}</td></tr>`
    )
    .join('')}</tbody>`;
  tabelaInd.innerHTML = `<div class="overflow-auto"><table class="min-w-full">${thead}${tbody}</table></div>`;
}

// ===== LÓGICA DE ADMIN =====
function verificarSenhaAdmin() {
  if (isAdmin) {
    isAdmin = false;
    showMessage('Acesso de administrador encerrado.', 'sync');
    if (operadorLogado) listarAreasOperador(); // Recarrega a view com permissões normais
    return;
  }
  const senha = prompt('Digite a senha de administrador:');
  if (senha === SENHA_SECRETA_ADMIN) {
    isAdmin = true;
    liberarTodasAbas();
    showMessage('Acesso de administrador liberado!', 'success');
    if (operadorLogado) listarAreasOperador(); // Recarrega a view com permissões de admin
  } else if (senha) {
    showMessage('Senha incorreta.', 'error');
  }
}

function liberarTodasAbas() {
  $$('.aba-bloqueada').forEach(aba => aba.classList.remove('aba-bloqueada'));
  const activeTab = $('.tab-btn.active')?.dataset.tab || 'operador';
  atualizarMenuMobile(activeTab);
}

// ===== LÓGICA DE LOGIN E SESSÃO =====
async function handleLoginOperador(e) {
  e.preventDefault();
  const matricula = $('#loginMatricula').value.trim();
  const nome = $('#loginNome').value.trim();
  if (!matricula || !nome) {
    loginError.textContent = 'Preencha todos os campos.';
    loginError.classList.remove('hidden');
    return;
  }
  try {
    const q = query(
      collection(db, 'operadores'),
      where('matricula', '==', matricula)
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      loginError.textContent = 'Matrícula não encontrada.';
      loginError.classList.remove('hidden');
      return;
    }
    const opDoc = snap.docs[0],
      opData = opDoc.data();
    if (opData.nome.toLowerCase() === nome.toLowerCase()) {
      operadorLogado = { id: opDoc.id, ...opData };
      sessionStorage.setItem('operadorLogado', JSON.stringify(operadorLogado));
      iniciarSessao();
    } else {
      loginError.textContent = 'Nome não corresponde à matrícula.';
      loginError.classList.remove('hidden');
    }
  } catch (err) {
    console.error('Erro no login:', err);
    loginError.textContent = 'Erro ao tentar fazer login.';
    loginError.classList.remove('hidden');
  }
}

function iniciarSessao() {
  loginScreen.classList.add('hidden');
  mainContent.classList.remove('hidden');
  // Libera apenas as abas de operador e relatórios por padrão para o operador
  $$('.tab-btn[data-tab="operador"], .tab-btn[data-tab="relatorios"]').forEach(
    aba => aba.classList.remove('aba-bloqueada')
  );
  const activeTab = $('.tab-btn.active')?.dataset.tab || 'operador';
  atualizarMenuMobile(activeTab);

  const welcome = document.createElement('div');
  welcome.id = 'welcomeMessage';
  welcome.className = 'text-sm text-gray-700';
  welcome.textContent = `Sessão: ${operadorLogado.nome} (${operadorLogado.matricula})`;
  header.insertAdjacentElement('afterend', welcome);
  observarAreas();
}

function handleLogout() {
  if (confirm('Deseja encerrar a sessão?')) {
    operadorLogado = null;
    isAdmin = false;
    sessionStorage.removeItem('operadorLogado');
    mainContent.classList.add('hidden');
    loginScreen.classList.remove('hidden');
    $('#formLoginOperador').reset();
    loginError.classList.add('hidden');
    const welcome = $('#welcomeMessage');
    if (welcome) welcome.remove();
    // Bloqueia as abas novamente
    $$('.tab-btn').forEach(aba => {
      if (aba.dataset.tab !== 'operador') aba.classList.add('aba-bloqueada');
    });
    switchTab('operador');
  }
}

function verificarSessao() {
  const sessaoSalva = sessionStorage.getItem('operadorLogado');
  if (sessaoSalva) {
    operadorLogado = JSON.parse(sessaoSalva);
    iniciarSessao();
  }
}

// ===== INICIALIZAÇÃO =====
(function popularSelectsEstaticos() {
  const selCodigos = $('#descricaoParadaCodigoSelect');
  selCodigos.innerHTML = `<option value="">Selecione um código</option>`;
  codigosParada.forEach(c => {
    selCodigos.innerHTML += `<option value="${c}">${c}</option>`;
  });
  const contProblemas = $('#listaProblemas');
  problemasOpcoes.forEach(p => {
    const label = document.createElement('label');
    label.className =
      'flex items-center p-1 hover:bg-gray-100 rounded cursor-pointer';
    label.innerHTML = `<input type="checkbox" name="problema" value="${p}" class="form-checkbox h-4 w-4 text-blue-600"><span class="ml-2 text-sm text-gray-700">${p}</span>`;
    contProblemas.appendChild(label);
  });
})();

document.addEventListener('DOMContentLoaded', () => {
  updateConnUI();
  $('#formLoginOperador').addEventListener('submit', handleLoginOperador);
  $('#btnAdminLogin').addEventListener('click', verificarSenhaAdmin);
  $('#btnSessao').addEventListener('click', handleLogout);
  switchTab('operador');
  verificarSessao();
});