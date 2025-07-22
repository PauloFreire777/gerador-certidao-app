<script>
// 1. IMPORTS NO TOPO
import { createIcons, icons } from 'lucide';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import HeirFormComponent from './components/HeirFormComponent.vue';
import HeirPreviewComponent from './components/HeirPreviewComponent.vue';
import { createInitialState, createHeirObject, createCessionarioObject, createFalecido, createObservacao } from './utils/stateHelpers.js';

// 2. DEFINIÇÃO DO COMPONENTE
export default {

  components: {
    'heir-form-group': HeirFormComponent,
    'heir-preview-group': HeirPreviewComponent
  },

  data() {
    return {
      state: createInitialState(),
      activeTab: 0,
      tabs: [
        'Processo', 'Falecidos', 'Inventariante', 'Herdeiros',
        'Bens', 'Docs Processuais', 'Docs Tributários', 'Observações'
      ],
      isLoading: false,
      showAutosaveIndicator: false,
      theme: 'light',
      bensSections: [
        { key: 'imoveis', title: 'Bens Imóveis', singular: 'Imóvel', fields: [
            { label: 'Descrição', model: 'descricao' }, { label: 'Matrícula', model: 'matricula' },
            { label: 'Tipo', model: 'tipo', options: ['Rural', 'Urbano'] }, { label: 'Documentos (IPTU, ITR, etc.)', model: 'docs' }
        ]},
        { key: 'veiculos', title: 'Veículos', singular: 'Veículo', fields: [
            { label: 'Descrição (Marca/Modelo)', model: 'descricao' }, { label: 'Placa', model: 'placa' }, { label: 'Renavam', model: 'renavam' }
        ]},
        { key: 'semoventes', title: 'Semoventes', singular: 'Semovente', fields: [
            { label: 'Descrição', model: 'descricao' }, { label: 'Quantidade', model: 'quantidade' }, { label: 'Valor Estimado (R$)', model: 'valor' }
        ]},
        { key: 'outrosBens', title: 'Outros Bens', singular: 'Bem', fields: [
            { label: 'Descrição', model: 'descricao' }, { label: 'Quantidade', model: 'quantidade' }, { label: 'Valor Estimado (R$)', model: 'valor' }
        ]},
        { key: 'valoresResiduais', title: 'Valores Residuais', singular: 'Valor', fields: [
            { label: 'Tipo', model: 'tipo', options: ['Conta Bancária', 'FGTS', 'PIS/PASEP', 'Ações'] },
            { label: 'Instituição', model: 'instituicao' }, { label: 'Valor (R$)', model: 'valor' }
        ]},
        { key: 'dividas', title: 'Dívidas do Espólio', singular: 'Dívida', fields: [
            { label: 'Credor', model: 'credor' }, { label: 'Tipo', model: 'tipo', options: ['Tributária', 'Contratual', 'Alimentar'] }, { label: 'Valor (R$)', model: 'valor' }
        ]},
        { key: 'alvaras', title: 'Alvarás Expedidos', singular: 'Alvará', fields: [
            { label: 'Finalidade', model: 'finalidade' }, { label: 'Status', model: 'status', options: ['Requerido', 'Deferido', 'Cumprido'] }
        ]}
      ]
    };
  },

  computed: {
    hasIncapaz() {
      const checkIncapaz = (heirs) => {
        if (!heirs) return false;
        return heirs.some(h => h.estado === 'Incapaz' || checkIncapaz(h.representantes));
      };
      return checkIncapaz(this.state.herdeiros);
    },
    hasBens() {
      return Object.values(this.state.bens).some(arr => Array.isArray(arr) ? arr.length > 0 : false);
    },
    emissionDate() {
      return new Date().toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    },
    pendencies() {
      const items = [];
      const { inventariante, herdeiros, documentacaoTributaria, bens, documentosProcessuais, cessao, renuncia, custas } = this.state;

      // Inventariante
      if (!inventariante.documentos) items.push('Documentos pessoais do Inventariante pendentes.');
      if (!inventariante.idProcuracao) items.push('Procuração do Inventariante pendente.');

      // Herdeiros (recursivo)
      const checkHerdeiro = (heir, path) => {
        if (!heir.documentos) items.push(`Documentos pessoais de ${path} pendentes.`);
        
        if (heir.estado === 'Capaz' && !heir.idProcuracao) {
          items.push(`Procuração de ${path} pendente.`);
        }
        if (heir.estado === 'Incapaz' && !heir.curador.idTermo) {
          items.push(`Termo de Compromisso do Curador de ${path} pendente.`);
        }
        if (heir.estado === 'Falecido' && !heir.idCertidaoObito) {
          items.push(`Certidão de Óbito de ${path} pendente.`);
        }
        if ((heir.estadoCivil === 'Casado(a)' || heir.estadoCivil === 'União Estável') && !heir.conjuge.idProcuracao) {
          items.push(`Procuração do cônjuge de ${path} pendente.`);
        }

        if (heir.representantes && heir.representantes.length > 0) {
          heir.representantes.forEach((rep, i) => checkHerdeiro(rep, `${path} -> Representante ${i+1} (${rep.nome || 'sem nome'})`));
        }
      };
      herdeiros.forEach((h, i) => checkHerdeiro(h, `Herdeiro ${i+1} (${h.nome || 'sem nome'})`));
      
      // Cessão de Direitos
      if (cessao.houveCessao) {
        if (!cessao.idEscritura) items.push('ID da Escritura de Cessão de Direitos pendente.');
        cessao.cessionarios.forEach((c, i) => {
          if (!c.nome) items.push(`Nome do Cessionário ${i+1} pendente.`);
          if (!c.documentos) items.push(`Documentos do Cessionário ${c.nome || i+1} pendentes.`);
          if (!c.idProcuracao) items.push(`Procuração do Cessionário ${c.nome || i+1} pendente.`);
        });
      }

      // Renúncia de Direitos
      if (renuncia.houveRenuncia) {
        if (renuncia.renunciantes.length === 0) {
          items.push('Nenhum herdeiro selecionado como renunciante.');
        } else {
          renuncia.renunciantes.forEach(r => {
            const heirName = this.getHeirNameById(r.herdeiroId);
            if (!r.idEscritura) {
              items.push(`ID da Escritura/Termo de Renúncia para ${heirName} pendente.`);
            }
          });
        }
      }

      // Documentação Tributária
      documentacaoTributaria.forEach(trib => {
        if (trib.cndMunicipal.status === 'Não Juntada') items.push(`CND Municipal de ${trib.nomeFalecido} não juntada.`);
        if (trib.cndEstadual.status === 'Não Juntada') items.push(`CND Estadual de ${trib.nomeFalecido} não juntada.`);
        if (trib.cndFederal.status === 'Não Juntada') items.push(`CND Federal de ${trib.nomeFalecido} não juntada.`);
      });
      
      // Custas Processuais
      if (custas.situacao === 'Devidas') {
        if (custas.calculada === 'Não') items.push('Cálculo das custas processuais pendente.');
        if (custas.paga === 'Não') items.push('Pagamento das custas processuais pendente.');
      }

      // Avaliação de Bens para Incapazes
      if (this.hasIncapaz) {
        ['imoveis', 'veiculos', 'semoventes', 'outrosBens'].forEach(key => {
          bens[key].forEach((bem, i) => {
            if (!bem.avaliado) {
              items.push(`Avaliação judicial pendente para o item: ${bem.descricao || `${key.slice(0, -1)} ${i+1}`}.`);
            }
          });
        });
      }

      // Documentos Processuais
      if (documentosProcessuais.edital.determinado === 'Sim' && documentosProcessuais.edital.status === 'Não Expedido') {
        items.push('Expedição do Edital pendente.');
      }
      
      documentosProcessuais.testamentosCensec.forEach(item => {
        if (!item.id) {
          const docType = item.deixouTestamento ? 'Testamento' : 'Certidão CENSEC';
          const article = docType === 'Testamento' ? 'o' : 'a';
          items.push(`ID d${article} ${docType} para ${item.nomeFalecido || 'falecido sem nome'} pendente.`);
        }
      });

      return items;
    }
  },

  watch: {
    state: {
      handler(newState) { this.saveStateToLocalStorage(newState); },
      deep: true
    },
    'state.falecidos': {
      handler(newFalecidos) {
        const newTributos = newFalecidos.map(f => {
          const existing = this.state.documentacaoTributaria.find(t => t.falecidoId === f.id);
          if (existing) {
            existing.nomeFalecido = f.nome;
            return existing;
          }
          return {
            falecidoId: f.id,
            nomeFalecido: f.nome,
            statusItcd: 'Não Declarado',
            cndMunicipal: { status: 'Não Juntada', id: '' },
            cndEstadual: { status: 'Não Juntada', id: '' },
            cndFederal: { status: 'Não Juntada', id: '' }
          };
        });
        this.state.documentacaoTributaria = newTributos.filter(t => newFalecidos.some(f => f.id === t.falecidoId));

        const newTestamentos = newFalecidos.map(f => {
          const existing = this.state.documentosProcessuais.testamentosCensec.find(t => t.falecidoId === f.id);
          if (existing) {
            existing.nomeFalecido = f.nome;
            existing.deixouTestamento = f.deixouTestamento;
            return existing;
          }
          return {
            falecidoId: f.id,
            nomeFalecido: f.nome,
            deixouTestamento: f.deixouTestamento,
            id: ''
          };
        });
        this.state.documentosProcessuais.testamentosCensec = newTestamentos.filter(t => newFalecidos.some(f => f.id === t.falecidoId));
      },
      deep: true,
      immediate: true
    }
  },
  
  methods: {
    nextTab() { if (this.activeTab < this.tabs.length - 1) this.activeTab++; },
    prevTab() { if (this.activeTab > 0) this.activeTab--; },
    addFalecido() { this.state.falecidos.push(createFalecido()); },
    removeFalecido(index) { this.state.falecidos.splice(index, 1); },
    addHerdeiro() { this.state.herdeiros.push(createHeirObject()); },
    removeHerdeiro(index) { this.state.herdeiros.splice(index, 1); },
    addCessionario() { this.state.cessao.cessionarios.push(createCessionarioObject()); },
    removeCessionario(index) { this.state.cessao.cessionarios.splice(index, 1); },
    addBem(sectionKey) {
        const newBem = { avaliado: false };
        const section = this.bensSections.find(s => s.key === sectionKey);
        if (section) {
            section.fields.forEach(field => { newBem[field.model] = ''; });
            this.state.bens[sectionKey].push(newBem);
        }
    },
    removeBem(sectionKey, index) { this.state.bens[sectionKey].splice(index, 1); },
    addObservacao() { this.state.observacoes.push(createObservacao()); },
    removeObservacao(index) { this.state.observacoes.splice(index, 1); },
    isRenunciante(heirId) {
        return this.state.renuncia.renunciantes.some(r => r.herdeiroId === heirId);
    },
    getRenuncia(heirId) {
        return this.state.renuncia.renunciantes.find(r => r.herdeiroId === heirId);
    },
    toggleRenunciante(heirId) {
        const index = this.state.renuncia.renunciantes.findIndex(r => r.herdeiroId === heirId);
        if (index > -1) {
            this.state.renuncia.renunciantes.splice(index, 1);
        } else {
            this.state.renuncia.renunciantes.push({ herdeiroId: heirId, tipo: 'Abdicativa', idEscritura: '' });
        }
    },
    getHeirNameById(id) {
        const heir = this.state.herdeiros.find(h => h.id === id);
        return heir ? heir.nome : 'Herdeiro não encontrado';
    },
    saveStateToLocalStorage(state) {
        try { localStorage.setItem('certidaoInventarioState', JSON.stringify(state)); } 
        catch (e) { console.error("Erro ao salvar no localStorage:", e); }
    },
    loadStateFromLocalStorage() {
        const savedState = localStorage.getItem('certidaoInventarioState');
        if (savedState) {
            try {
                const parsedState = JSON.parse(savedState);
                this.state = this.hydrateState(parsedState);
                console.log("Estado carregado do localStorage.");
            } catch (e) {
                console.error("Erro ao carregar estado do localStorage:", e);
                this.state = createInitialState();
            }
        } else {
             this.state = createInitialState();
        }
    },
    hydrateState(loadedState) {
        const freshState = createInitialState();
        const merge = (target, source) => {
            for (const key in target) {
                if (source && typeof source[key] !== 'undefined') {
                    if (typeof target[key] === 'object' && target[key] !== null && !Array.isArray(target[key])) {
                        target[key] = merge(target[key], source[key]);
                    } else {
                        target[key] = source[key];
                    }
                }
            }
            return target;
        };
        return merge(freshState, loadedState);
    },
    resetForm() {
        if (confirm('Tem certeza que deseja limpar todos os campos e começar uma nova certidão?')) {
            this.state = createInitialState();
            this.activeTab = 0;
        }
    },
    exportState() {
        const stateJson = JSON.stringify(this.state, null, 2);
        const blob = new Blob([stateJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Certidao_Regularidade-${this.state.processo.numero || 'NOVO'}.json`;
        a.click();
        URL.revokeObjectURL(url);
    },
    triggerFileInput() { this.$refs.fileInput.click(); },
    importState(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedState = JSON.parse(e.target.result);
                if (importedState.processo && importedState.herdeiros) {
                    this.state = this.hydrateState(importedState);
                    alert('Certidão carregada com sucesso!');
                    this.activeTab = 0;
                } else {
                    throw new Error('Arquivo JSON inválido ou não corresponde à estrutura esperada.');
                }
            } catch (error) {
                console.error("Erro ao importar arquivo:", error);
                alert(`Erro ao carregar o arquivo: ${error.message}`);
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    },
    async generatePdf() {
    console.log("Enviando dados para o servidor de PDF...");
    this.isLoading = true;
    try {
        const apiUrl = import.meta.env.VITE_API_URL;
        const response = await fetch(`${apiUrl}/generate-pdf`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // A correção está na linha abaixo
            body: JSON.stringify({
                state: this.state,
                bensSections: this.bensSections, 
                pendencies: this.pendencies
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            const errorMessage = errorData ? errorData.message : response.statusText;
            throw new Error(`O servidor respondeu com um erro: ${errorMessage}`);
        }

        const pdfBlob = await response.blob();
        const url = window.URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
a.href = url;
        a.download = `Certidao-${this.state.processo.numero || 'NOVO'}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);

    } catch (error) {
        console.error("Erro ao gerar o PDF:", error);
        alert(`Não foi possível gerar o PDF. Detalhe: ${error.message}`);
    } finally {
        this.isLoading = false;
    }
},
    formatDate(dateString) {
        if (!dateString) return 'Não informado';
        try {
            const date = new Date(dateString + 'T00:00:00');
            if (isNaN(date.getTime())) return dateString;
            return date.toLocaleDateString('pt-BR');
        } catch (e) {
            return dateString;
        }
    },
    getEditalStatus() {
        const edital = this.state.documentosProcessuais.edital;
        if (edital.determinado === 'Não') return 'Não determinada a expedição.';
        if (edital.status === 'Não Expedido') return 'Expedição pendente.';
        if (edital.prazoDecorrido === 'Não') return `Expedido (ID: ${edital.id || 'N/A'}), aguardando decurso de prazo.`;
        return `Expedido (ID: ${edital.id || 'N/A'}), prazo decorrido (ID: ${edital.idDecursoPrazo || 'N/A'}).`;
    },
    getCustasStatus() {
        const custas = this.state.custas;
        if (custas.situacao === 'Isenção') return 'Isento de custas.';
        if (custas.situacao === 'Ao final') return 'Custas a serem pagas ao final do processo.';
        if (custas.situacao === 'Devidas') {
            const calculo = custas.calculada === 'Sim' ? `Calculada (ID: ${custas.idCalculo || 'N/A'})` : 'Cálculo pendente';
            const pagamento = custas.paga === 'Sim' ? `Pagas (ID: ${custas.idPagamento || 'N/A'})` : 'Pagamento pendente';
            return `${calculo}, ${pagamento}.`;
        }
        return 'Situação não informada.';
    },
    toggleTheme() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', this.theme);
        localStorage.setItem('certidaoTheme', this.theme);
    }
  },

  mounted() {
    this.loadStateFromLocalStorage();
    this.$nextTick(() => {
      createIcons({ icons }); 
    });
    setInterval(() => {
      this.saveStateToLocalStorage(this.state);
      this.showAutosaveIndicator = true;
      setTimeout(() => { this.showAutosaveIndicator = false; }, 2000);
    }, 30000);
  },

  updated() {
    this.$nextTick(() => {
     createIcons({ icons });
    });
  }
}
</script>

<template>
  <div class="app-container" :class="{ 'loading': isLoading }">
    <!-- Cabeçalho Fixo -->
    <header class="main-header">
        <div class="logo">
            <div class="logo-graphic">
                <span class="logo-text-main">Certidão</span><span class="logo-text-pro">PRO</span>
            </div>
            <p class="comarca-text">VARA ÚNICA DA COMARCA DE NOVA RESENDE/MG</p>
        </div>
        <div class="toolbar">
            <button @click="resetForm" class="btn-tertiary" title="Nova Certidão"><i data-lucide="file-plus-2"></i> Nova</button>
            <button @click="exportState" class="btn-secondary" title="Salvar Certidão como JSON"><i data-lucide="save"></i> Salvar</button>
            <button @click="triggerFileInput" class="btn-secondary" title="Carregar Certidão de um arquivo JSON"><i data-lucide="folder-open"></i> Carregar</button>
            <input type="file" ref="fileInput" @change="importState" accept=".json" style="display: none;">
            <button @click="generatePdf" class="btn-primary" title="Gerar PDF Final"><i data-lucide="printer"></i> Gerar PDF</button>
            <span class="autosave-indicator" :class="{ 'visible': showAutosaveIndicator }">Salvo!</span>
        </div>
    </header>

    <main class="main-content">
        <!-- Painel do Formulário (Esquerda) -->
        <div class="form-panel">
            <div class="tabs-container">
                <div class="tabs-nav">
                    <button v-for="(tab, index) in tabs" :key="index" @click="activeTab = index" :class="{ 'active': activeTab === index }">
                       <span class="tab-number">{{ index + 1 }}</span> {{ tab }}
                    </button>
                </div>
                <div class="tabs-content">
                    <!-- Aba 1: Dados do Processo -->
                    <div v-show="activeTab === 0" class="tab-pane">
                        <h2>1. Dados do Processo</h2>
                        <div class="form-group">
                            <label>Número do Processo <span class="required">*</span></label>
                            <input type="text" v-model="state.processo.numero" placeholder="xxxxxxx-xx.xxxx.x.xx.xxxx">
                        </div>
                        <div class="form-group checkbox-group">
                            <input type="checkbox" id="cumulativo" v-model="state.processo.cumulativo">
                            <label for="cumulativo">Inventário Cumulativo</label>
                        </div>
                        <fieldset>
                            <legend>Responsável pela Certidão</legend>
                            <div class="form-group">
                                <label>Nome Completo <span class="required">*</span></label>
                                <input type="text" v-model="state.processo.responsavel.nome" placeholder="Nome de quem emite">
                            </div>
                            <div class="form-group">
                                <label>Cargo <span class="required">*</span></label>
                                <select v-model="state.processo.responsavel.cargo">
                                    <option disabled value="">Selecione o cargo</option>
                                    <option>Oficial(a) Judiciário(a)</option>
                                    <option>Estagiário(a)</option>
                                    <option>Assistente Administrativo(a)</option>
                                </select>
                            </div>
                        </fieldset>
                    </div>

                    <!-- Aba 2: Falecidos -->
                    <div v-show="activeTab === 1" class="tab-pane">
                        <h2>2. Dados dos Falecidos</h2>
                        <div v-for="(falecido, index) in state.falecidos" :key="falecido.id" class="dynamic-card">
                            <h4 class="card-title">Falecido(a) {{ index + 1 }}</h4>
                            <button @click="removeFalecido(index)" class="btn-remove" title="Remover Falecido">×</button>
                            <div class="grid-2">
                                <div class="form-group">
                                    <label>Nome Completo <span class="required">*</span></label>
                                    <input type="text" v-model="falecido.nome" placeholder="Nome do de cujus">
                                </div>
                                <div class="form-group">
                                    <label>Data do Falecimento <span class="required">*</span></label>
                                    <input type="date" v-model="falecido.dataFalecimento">
                                </div>
                            </div>
                            <div class="form-group">
                                <label>Documentos Pessoais (CPF/RG)</label>
                                <input type="text" v-model="falecido.documentos" placeholder="CPF e RG">
                            </div>
                            <div class="grid-2">
                                <div class="form-group">
                                    <label>ID da Certidão de Óbito <span class="required">*</span></label>
                                    <input type="text" v-model="falecido.idCertidaoObito" placeholder="ID do documento no sistema">
                                </div>
                                <div class="form-group">
                                    <label>Regime de Casamento</label>
                                    <select v-model="falecido.regimeCasamento">
                                        <option>Não se aplica</option>
                                        <option>Comunhão Parcial de Bens</option>
                                        <option>Comunhão Universal de Bens</option>
                                        <option>Separação Total de Bens</option>
                                        <option>Participação Final nos Aquestos</option>
                                    </select>
                                </div>
                            </div>
                            <div class="form-group checkbox-group">
                                <input type="checkbox" :id="'testamento_' + falecido.id" v-model="falecido.deixouTestamento">
                                <label :for="'testamento_' + falecido.id">Deixou testamento?</label>
                            </div>
                        </div>
                        <button @click="addFalecido" class="btn-add"><i data-lucide="plus"></i> Adicionar Falecido</button>
                    </div>
                    
                    <!-- Aba 3: Inventariante -->
                    <div v-show="activeTab === 2" class="tab-pane">
                        <h2>3. Inventariante</h2>
                         <div class="dynamic-card">
                            <div class="form-group">
                                <label>Nome Completo <span class="required">*</span></label>
                                <input type="text" v-model="state.inventariante.nome">
                            </div>
                            <div class="form-group">
                                <label>Parentesco <span class="required">*</span></label>
                                <input type="text" v-model="state.inventariante.parentesco" placeholder="Ex: Cônjuge, Filho(a)">
                            </div>
                            <div class="form-group">
                                <label>Documentos Pessoais (CPF/RG) <span class="required">*</span></label>
                                <input type="text" v-model="state.inventariante.documentos">
                            </div>
                            <div class="grid-2">
                                <div class="form-group">
                                    <label>ID da Procuração</label>
                                    <input type="text" v-model="state.inventariante.idProcuracao" placeholder="ID do documento">
                                </div>
                                <div class="form-group">
                                    <label>ID do Termo de Compromisso <span class="required">*</span></label>
                                    <input type="text" v-model="state.inventariante.idTermoCompromisso" placeholder="ID do documento">
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Aba 4: Herdeiros -->
                    <div v-show="activeTab === 3" class="tab-pane">
                        <h2>4. Herdeiros e Sucessores</h2>
                        <heir-form-group
                            v-for="(herdeiro, hIndex) in state.herdeiros"
                            :key="herdeiro.id"
                            :heir="herdeiro"
                            :index="hIndex"
                            :is-representative="false"
                            @remove="removeHerdeiro(hIndex)">
                        </heir-form-group>
                        <button @click="addHerdeiro" class="btn-add"><i data-lucide="plus"></i> Adicionar Herdeiro</button>
                        <hr>
                        <!-- Renúncia de Direitos -->
                        <fieldset>
                            <legend>Renúncia de Direitos Hereditários</legend>
                            <div class="form-group checkbox-group">
                                <input type="checkbox" id="houveRenuncia" v-model="state.renuncia.houveRenuncia">
                                <label for="houveRenuncia">Houve Renúncia de Direitos?</label>
                            </div>
                            <div v-if="state.renuncia.houveRenuncia" class="conditional-section">
                                <h4>Herdeiros Renunciantes</h4>
                                <div v-for="heir in state.herdeiros" :key="heir.id" class="checkbox-group-vertical">
                                    <div class="checkbox-line">
                                        <input type="checkbox" :id="'renuncia_' + heir.id" :checked="isRenunciante(heir.id)" @change="toggleRenunciante(heir.id)">
                                        <label :for="'renuncia_' + heir.id">{{ heir.nome || 'Herdeiro sem nome' }}</label>
                                    </div>
                                    <div v-if="isRenunciante(heir.id)" class="conditional-input">
                                         <div class="form-group">
                                             <label>Tipo de Renúncia</label>
                                             <select v-model="getRenuncia(heir.id).tipo">
                                                <option>Abdicativa</option>
                                                <option>Translativa</option>
                                             </select>
                                         </div>
                                         <div class="form-group">
                                            <label>ID da Escritura/Termo de Renúncia</label>
                                            <input type="text" v-model="getRenuncia(heir.id).idEscritura" placeholder="ID do documento">
                                         </div>
                                    </div>
                                </div>
                            </div>
                        </fieldset>
                        <!-- Cessão de Direitos -->
                        <fieldset>
                            <legend>Cessão de Direitos Hereditários</legend>
                            <div class="form-group checkbox-group">
                                <input type="checkbox" id="houveCessao" v-model="state.cessao.houveCessao">
                                <label for="houveCessao">Houve Cessão de Direitos?</label>
                            </div>
                            <div v-if="state.cessao.houveCessao" class="conditional-section">
                                <div class="form-group">
                                    <label>ID da Escritura de Cessão</label>
                                    <input type="text" v-model="state.cessao.idEscritura" placeholder="ID do documento">
                                </div>
                                <h4>Cessionários</h4>
                                <div v-for="(cessionario, cIndex) in state.cessao.cessionarios" :key="cessionario.id" class="dynamic-card sub-card">
                                    <button @click="removeCessionario(cIndex)" class="btn-remove" title="Remover Cessionário">×</button>
                                    <div class="form-group">
                                        <label>Nome do Cessionário</label>
                                        <input type="text" v-model="cessionario.nome">
                                    </div>
                                    <div class="form-group">
                                        <label>Documentos do Cessionário</label>
                                        <input type="text" v-model="cessionario.documentos">
                                    </div>
                                    <div class="form-group">
                                        <label>Procuração do Cessionário (ID)</label>
                                        <input type="text" v-model="cessionario.idProcuracao">
                                    </div>
                                </div>
                                <button @click="addCessionario" class="btn-add-small"><i data-lucide="plus"></i> Adicionar Cessionário</button>
                            </div>
                        </fieldset>
                    </div>
                    
                    <!-- Aba 5: Bens e Valores -->
                    <div v-show="activeTab === 4" class="tab-pane">
                        <h2>5. Bens, Valores e Dívidas</h2>
                        <fieldset v-for="section in bensSections" :key="section.key">
                            <legend>{{ section.title }}</legend>
                            <div v-if="!state.bens[section.key]" class="placeholder-text">Carregando...</div>
                            <div v-else>
                                <div v-for="(item, index) in state.bens[section.key]" :key="index" class="dynamic-card">
                                    <button @click="removeBem(section.key, index)" class="btn-remove" title="Remover Item">×</button>
                                    <div v-for="field in section.fields" :key="field.model" class="form-group">
                                        <label>{{ field.label }}</label>
                                        <input v-if="!field.options" type="text" v-model="item[field.model]">
                                        <select v-else v-model="item[field.model]">
                                            <option v-for="opt in field.options" :key="opt">{{ opt }}</option>
                                        </select>
                                    </div>
                                    <div v-if="hasIncapaz && ['imoveis', 'veiculos', 'semoventes', 'outrosBens'].includes(section.key)" class="form-group checkbox-group">
                                        <input type="checkbox" :id="`avaliado_${section.key}_${index}`" v-model="item.avaliado">
                                        <label :for="`avaliado_${section.key}_${index}`">Avaliado Judicialmente</label>
                                    </div>
                                </div>
                                <button @click="addBem(section.key)" class="btn-add-small"><i data-lucide="plus"></i> Adicionar {{ section.singular }}</button>
                            </div>
                        </fieldset>
                        <div v-if="hasIncapaz" class="conditional-section warning">
                            <label class="bold">Avaliação de Bens para Incapazes</label>
                            <div class="form-group">
                                <label>ID do Laudo de Avaliação Judicial</label>
                                <input type="text" v-model="state.bens.idLaudoAvaliacaoIncapaz" placeholder="ID do documento">
                            </div>
                        </div>
                    </div>

                    <!-- Aba 6: Documentos Processuais -->
                    <div v-show="activeTab === 5" class="tab-pane">
                        <h2>6. Documentos Processuais</h2>
                         <div class="dynamic-card">
                            <div class="form-group">
                                <label>Primeiras Declarações</label>
                                <select v-model="state.documentosProcessuais.primeirasDeclaracoes.status">
                                    <option>Apresentada</option>
                                    <option>Não Apresentada</option>
                                </select>
                                <input v-if="state.documentosProcessuais.primeirasDeclaracoes.status === 'Apresentada'" type="text" v-model="state.documentosProcessuais.primeirasDeclaracoes.id" placeholder="ID do documento" class="conditional-input">
                            </div>
                            <hr>
                            <div class="form-group">
                                <label>Edital</label>
                                 <select v-model="state.documentosProcessuais.edital.determinado">
                                    <option value="Sim">Determinado</option>
                                    <option value="Não">Não Determinado</option>
                                </select>
                            </div>
                            <div v-if="state.documentosProcessuais.edital.determinado === 'Sim'" class="conditional-section">
                                <div class="form-group">
                                    <label>Status do Edital</label>
                                    <select v-model="state.documentosProcessuais.edital.status">
                                        <option>Expedido</option>
                                        <option>Não Expedido</option>
                                    </select>
                                    <input v-if="state.documentosProcessuais.edital.status === 'Expedido'" type="text" v-model="state.documentosProcessuais.edital.id" placeholder="ID do Edital" class="conditional-input">
                                </div>
                                <div class="form-group">
                                    <label>Decurso de Prazo</label>
                                    <select v-model="state.documentosProcessuais.edital.prazoDecorrido">
                                        <option value="Sim">Sim</option>
                                        <option value="Não">Não</option>
                                    </select>
                                    <input v-if="state.documentosProcessuais.edital.prazoDecorrido === 'Sim'" type="text" v-model="state.documentosProcessuais.edital.idDecursoPrazo" placeholder="ID da Certidão de Decurso" class="conditional-input">
                                </div>
                            </div>
                            <hr>
                            <div class="form-group">
                                <label>Últimas Declarações</label>
                                <select v-model="state.documentosProcessuais.ultimasDeclaracoes.status">
                                    <option>Apresentada</option>
                                    <option>Não Apresentada</option>
                                </select>
                                <input v-if="state.documentosProcessuais.ultimasDeclaracoes.status === 'Apresentada'" type="text" v-model="state.documentosProcessuais.ultimasDeclaracoes.id" placeholder="ID do documento" class="conditional-input">
                            </div>
                            <hr>
                            <fieldset>
                                <legend>Testamentos e Certidões CENSEC</legend>
                                <div v-if="!state.falecidos.length" class="placeholder-text">
                                    Adicione um falecido na Aba 2 para ver as opções.
                                </div>
                                <div v-for="(item, index) in state.documentosProcessuais.testamentosCensec" :key="item.falecidoId" class="form-group">
                                    <label v-if="item.deixouTestamento">Testamento de <strong>{{ item.nomeFalecido || `Falecido ${index+1}` }}</strong></label>
                                    <label v-else>Certidão CENSEC de <strong>{{ item.nomeFalecido || `Falecido ${index+1}` }}</strong></label>
                                    <input type="text" v-model="item.id" :placeholder="item.deixouTestamento ? 'ID do Testamento' : 'ID da Certidão CENSEC'">
                                </div>
                            </fieldset>
                            <hr>
                            <div class="form-group">
                                <label>Sentença Homologatória</label>
                                <select v-model="state.documentosProcessuais.sentenca.status">
                                    <option>Proferida</option>
                                    <option>Não Proferida</option>
                                </select>
                                <input v-if="state.documentosProcessuais.sentenca.status === 'Proferida'" type="text" v-model="state.documentosProcessuais.sentenca.id" placeholder="ID da Sentença" class="conditional-input">
                            </div>
                            <hr>
                            <div class="form-group">
                                <label>Trânsito em Julgado</label>
                                <select v-model="state.documentosProcessuais.transito.status">
                                    <option>Ocorrido</option>
                                    <option>Não Ocorrido</option>
                                </select>
                                <input v-if="state.documentosProcessuais.transito.status === 'Ocorrido'" type="text" v-model="state.documentosProcessuais.transito.id" placeholder="ID da Certidão" class="conditional-input">
                            </div>
                        </div>
                    </div>

                    <!-- Aba 7: Documentação Tributária -->
                    <div v-show="activeTab === 6" class="tab-pane">
                        <h2>7. Documentação Tributária</h2>
                        <div v-if="!state.falecidos.length" class="placeholder-text">
                            Adicione um falecido na Aba 2 para ver as opções.
                        </div>
                        <div v-for="(falecido, index) in state.documentacaoTributaria" :key="index" class="dynamic-card">
                            <h4>Tributos de: <strong>{{ falecido.nomeFalecido || `Falecido ${index+1}` }}</strong></h4>
                            <div class="form-group">
                                <label>Status do ITCD <span class="required">*</span></label>
                                <select v-model="falecido.statusItcd">
                                    <option>Declarado e Pago</option>
                                    <option>Declarado e Parcelado</option>
                                    <option>Isento</option>
                                    <option>Não Declarado</option>
                                </select>
                            </div>
                            <fieldset>
                                <legend>Certidões Negativas de Débito (CND)</legend>
                                <div class="grid-3">
                                    <div class="form-group">
                                        <label>CND Municipal</label>
                                        <select v-model="falecido.cndMunicipal.status">
                                            <option>Juntada</option>
                                            <option>Não Juntada</option>
                                        </select>
                                        <input v-if="falecido.cndMunicipal.status === 'Juntada'" type="text" v-model="falecido.cndMunicipal.id" placeholder="ID/Link" class="conditional-input">
                                    </div>
                                    <div class="form-group">
                                        <label>CND Estadual</label>
                                        <select v-model="falecido.cndEstadual.status">
                                            <option>Juntada</option>
                                            <option>Não Juntada</option>
                                        </select>
                                        <input v-if="falecido.cndEstadual.status === 'Juntada'" type="text" v-model="falecido.cndEstadual.id" placeholder="ID/Link" class="conditional-input">
                                    </div>
                                    <div class="form-group">
                                        <label>CND Federal</label>
                                        <select v-model="falecido.cndFederal.status">
                                            <option>Juntada</option>
                                            <option>Não Juntada</option>
                                        </select>
                                        <input v-if="falecido.cndFederal.status === 'Juntada'" type="text" v-model="falecido.cndFederal.id" placeholder="ID/Link" class="conditional-input">
                                    </div>
                                </div>
                            </fieldset>
                        </div>
                        <fieldset>
                            <legend>Custas Processuais</legend>
                            <div class="form-group">
                                <label>Situação das Custas</label>
                                <select v-model="state.custas.situacao">
                                    <option>Ao final</option>
                                    <option>Isenção</option>
                                    <option>Devidas</option>
                                </select>
                            </div>
                            <div v-if="state.custas.situacao === 'Devidas'" class="conditional-section">
                                <div class="form-group">
                                    <label>Cálculo</label>
                                    <select v-model="state.custas.calculada">
                                        <option value="Sim">Calculada</option>
                                        <option value="Não">Não Calculada</option>
                                    </select>
                                    <input v-if="state.custas.calculada === 'Sim'" type="text" v-model="state.custas.idCalculo" placeholder="ID do Cálculo" class="conditional-input">
                                </div>
                                <div class="form-group">
                                    <label>Pagamento</label>
                                    <select v-model="state.custas.paga">
                                        <option value="Sim">Pago</option>
                                        <option value="Não">Não Pago</option>
                                    </select>
                                    <input v-if="state.custas.paga === 'Sim'" type="text" v-model="state.custas.idPagamento" placeholder="ID do Comprovante" class="conditional-input">
                                </div>
                            </div>
                        </fieldset>
                    </div>

                    <!-- Aba 8: Observações -->
                    <div v-show="activeTab === 7" class="tab-pane">
                        <h2>8. Observações Adicionais</h2>
                        <div v-for="(obs, index) in state.observacoes" :key="obs.id" class="dynamic-card">
                            <button @click="removeObservacao(index)" class="btn-remove" title="Remover Observação">×</button>
                            <div class="grid-2">
                                <div class="form-group">
                                    <label>Título/Assunto</label>
                                    <input type="text" v-model="obs.titulo">
                                </div>
                                <div class="form-group">
                                    <label>Relevância</label>
                                    <select v-model="obs.relevancia">
                                        <option>Baixa</option>
                                        <option>Média</option>
                                        <option>Alta</option>
                                    </select>
                                </div>
                            </div>
                            <div class="form-group">
                                <label>Conteúdo <span class="required">*</span></label>
                                <textarea v-model="obs.conteudo" rows="3"></textarea>
                            </div>
                        </div>
                        <button @click="addObservacao" class="btn-add"><i data-lucide="plus"></i> Adicionar Observação</button>
                    </div>
                </div>
            </div>

            <div class="tab-navigation">
                <button v-show="activeTab > 0" @click="prevTab" class="btn-nav"><i data-lucide="arrow-left"></i> Anterior</button>
                <div class="spacer"></div>
                <button v-show="activeTab < tabs.length - 1" @click="nextTab" class="btn-nav-primary">Próximo <i data-lucide="arrow-right"></i></button>
            </div>
        </div>

        <!-- Painel de Pré-visualização (Direita) -->
        <div class="preview-panel-container">
            <div id="preview-panel" class="preview-panel">
                <div class="preview-header">
                    <div class="header-text">
                        <p>PODER JUDICIÁRIO DO ESTADO DE MINAS GERAIS</p>
                        <p class="comarca">VARA ÚNICA DA COMARCA DE NOVA RESENDE/MG</p>
                    </div>
                    <h1>CERTIDÃO DE REGULARIDADE</h1>
                </div>
                <div class="preview-content">
                    <!-- Seção de Pendências -->
                    <div class="preview-section pendencies-section" v-if="pendencies.length > 0">
                        <h3><i data-lucide="alert-triangle"></i> PENDÊNCIAS</h3>
                        <div class="preview-card">
                            <ul class="pendencies-list">
                                <li v-for="(pendency, index) in pendencies" :key="index">{{ pendency }}</li>
                            </ul>
                        </div>
                    </div>

                    <!-- Seção 1: Dados do Processo -->
                    <div class="preview-section" v-if="state.processo.numero">
                        <h3><i data-lucide="folder-kanban"></i> 1. Dados do Processo</h3>
                        <div class="preview-card">
                            <p><strong>Número do Processo:</strong><span>{{ state.processo.numero }}</span></p>
                            <p v-if="state.processo.cumulativo"><strong>Tipo:</strong><span>Inventário Cumulativo</span></p>
                        </div>
                    </div>

                    <!-- Seção 2: Falecidos -->
                    <div class="preview-section" v-if="state.falecidos.length">
                        <h3><i data-lucide="user-minus"></i> 2. De Cujus (Falecido/a/s)</h3>
                        <div v-for="(f, i) in state.falecidos" :key="f.id" class="preview-card">
                            <p><strong>Nome:</strong><span>{{ f.nome || 'Não informado' }}</span></p>
                            <p><strong>Data do Falecimento:</strong><span>{{ formatDate(f.dataFalecimento) }}</span></p>
                            <p><strong>Certidão de Óbito (ID):</strong><span>{{ f.idCertidaoObito || 'Não informado' }}</span></p>
                        </div>
                    </div>

                    <!-- Seção 3: Inventariante -->
                    <div class="preview-section" v-if="state.inventariante.nome">
                        <h3><i data-lucide="user-check"></i> 3. Inventariante</h3>
                        <div class="preview-card">
                            <p><strong>Nome:</strong><span>{{ state.inventariante.nome }}</span></p>
                            <p><strong>Parentesco:</strong><span>{{ state.inventariante.parentesco || 'Não informado' }}</span></p>
                            <p><strong>Termo de Compromisso (ID):</strong><span>{{ state.inventariante.idTermoCompromisso || 'Não informado' }}</span></p>
                            <div v-if="state.inventariante.idProcuracao" class="info-procuracao">
                                <p><strong>Procuração (ID):</strong><span>{{ state.inventariante.idProcuracao }}</span></p>
                            </div>
                        </div>
                    </div>

                    <!-- Seção 4: Herdeiros -->
                    <div class="preview-section" v-if="state.herdeiros.length">
                        <h3><i data-lucide="users"></i> 4. Herdeiros e Sucessores</h3>
                        <heir-preview-group :heirs="state.herdeiros" :level="0"></heir-preview-group>
                    </div>
                    
                    <!-- Seção de Renúncia de Direitos -->
                    <div class="preview-section" v-if="state.renuncia.houveRenuncia">
                        <h3><i data-lucide="file-x-2"></i> Renúncia de Direitos</h3>
                        <div v-for="r in state.renuncia.renunciantes" :key="r.herdeiroId" class="preview-card">
                            <p><strong>Renunciante:</strong><span>{{ getHeirNameById(r.herdeiroId) }}</span></p>
                            <p><strong>Tipo de Renúncia:</strong><span>{{ r.tipo }}</span></p>
                            <p><strong>ID da Escritura/Termo:</strong><span>{{ r.idEscritura || 'Não informado' }}</span></p>
                        </div>
                    </div>

                    <!-- Seção de Cessão de Direitos -->
                    <div class="preview-section" v-if="state.cessao.houveCessao">
                        <h3><i data-lucide="arrow-right-left"></i> Cessão de Direitos</h3>
                        <div class="preview-card">
                            <p><strong>Escritura de Cessão (ID):</strong><span>{{ state.cessao.idEscritura || 'Não informado' }}</span></p>
                            <div v-for="c in state.cessao.cessionarios" :key="c.id" class="preview-sub-card">
                                <p><strong>Cessionário:</strong><span>{{ c.nome }}</span></p>
                                <p><strong>Documentos:</strong><span>{{ c.documentos }}</span></p>
                                <div v-if="c.idProcuracao" class="info-procuracao">
                                    <p><strong>Procuração (ID):</strong><span>{{ c.idProcuracao }}</span></p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Seção 5: Bens -->
                    <div class="preview-section" v-if="hasBens">
                        <h3><i data-lucide="gem"></i> 5. Relação de Bens, Direitos e Dívidas</h3>
                        <div v-for="section in bensSections" :key="section.key">
                            <div v-if="state.bens[section.key] && state.bens[section.key].length">
                                <h4>{{ section.title }}</h4>
                                <div v-for="(item, i) in state.bens[section.key]" :key="i" class="preview-card-small">
                                   <p v-for="field in section.fields" :key="field.model">
                                       <strong>{{ field.label }}:</strong> <span>{{ item[field.model] || 'N/A' }}</span>
                                   </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Seção 6: Documentos Processuais -->
                    <div class="preview-section">
                        <h3><i data-lucide="file-text"></i> 6. Documentos Processuais</h3>
                        <div class="preview-card">
                            <p><strong>Primeiras Declarações:</strong> <span>{{ state.documentosProcessuais.primeirasDeclaracoes.status === 'Apresentada' ? `Apresentada (ID: ${state.documentosProcessuais.primeirasDeclaracoes.id || 'N/A'})` : 'Não Apresentada' }}</span></p>
                            <p><strong>Edital:</strong> <span>{{ getEditalStatus() }}</span></p>
                            <p><strong>Últimas Declarações:</strong> <span>{{ state.documentosProcessuais.ultimasDeclaracoes.status === 'Apresentada' ? `Apresentada (ID: ${state.documentosProcessuais.ultimasDeclaracoes.id || 'N/A'})` : 'Não Apresentada' }}</span></p>
                            
                            <div v-for="item in state.documentosProcessuais.testamentosCensec" :key="item.falecidoId">
                                <p v-if="item.deixouTestamento">
                                    <strong>Testamento ({{ item.nomeFalecido }}):</strong> 
                                    <span>{{ item.id ? `Apresentado (ID: ${item.id})` : 'Pendente' }}</span>
                                </p>
                                <p v-else>
                                    <strong>Certidão CENSEC ({{ item.nomeFalecido }}):</strong> 
                                    <span>{{ item.id ? `Apresentada (ID: ${item.id})` : 'Pendente' }}</span>
                                </p>
                            </div>

                            <p><strong>Sentença:</strong> <span>{{ state.documentosProcessuais.sentenca.status === 'Proferida' ? `Proferida (ID: ${state.documentosProcessuais.sentenca.id || 'N/A'})` : 'Não Proferida' }}</span></p>
                            <p><strong>Trânsito em Julgado:</strong> <span>{{ state.documentosProcessuais.transito.status === 'Ocorrido' ? `Ocorrido (ID: ${state.documentosProcessuais.transito.id || 'N/A'})` : 'Não Ocorrido' }}</span></p>
                        </div>
                    </div>

                    <!-- Seção 7: Documentação Tributária -->
                    <div class="preview-section" v-if="state.documentacaoTributaria.length || state.custas.situacao">
                        <h3><i data-lucide="landmark"></i> 7. Regularidade Tributária e Custas</h3>
                        <div v-for="(trib, i) in state.documentacaoTributaria" :key="i" class="preview-card">
                            <p><strong>Referente a:</strong><span>{{ trib.nomeFalecido }}</span></p>
                            <p><strong>Status ITCD:</strong><span>{{ trib.statusItcd }}</span></p>
                            <p><strong>CND Municipal:</strong><span>{{ trib.cndMunicipal.status === 'Juntada' ? `Juntada (ID: ${trib.cndMunicipal.id || 'N/A'})` : 'Não Juntada' }}</span></p>
                            <p><strong>CND Estadual:</strong><span>{{ trib.cndEstadual.status === 'Juntada' ? `Juntada (ID: ${trib.cndEstadual.id || 'N/A'})` : 'Não Juntada' }}</span></p>
                            <p><strong>CND Federal:</strong><span>{{ trib.cndFederal.status === 'Juntada' ? `Juntada (ID: ${trib.cndFederal.id || 'N/A'})` : 'Não Juntada' }}</span></p>
                        </div>
                         <div class="preview-card">
                             <p><strong>Custas Processuais:</strong><span>{{ getCustasStatus() }}</span></p>
                         </div>
                    </div>

                    <!-- Seção 8: Observações -->
                    <div class="preview-section" v-if="state.observacoes.length">
                        <h3><i data-lucide="message-square-plus"></i> 8. Observações Adicionais</h3>
                        <div v-for="(obs, i) in state.observacoes" :key="obs.id" class="preview-card">
                            <p><strong>{{ obs.titulo || 'Observação' }} (Relevância: {{ obs.relevancia }})</strong></p>
                            <p class="obs-content"><span>{{ obs.conteudo }}</span></p>
                        </div>
                    </div>
                </div>
                <div class="preview-footer">
                    <div class="signature-area">
                        <div class="signature-line">
                            <p class="signature-name">{{ state.processo.responsavel.nome || '_________________________________________' }}</p>
                            <p class="signature-title">{{ state.processo.responsavel.cargo || 'Cargo do Responsável' }}</p>
                        </div>
                    </div>
                    <div class="footer-info">
                        <p>Este documento foi gerado eletronicamente pelo Sistema de Gerenciamento de Certidões.</p>
                        <p>Data de Emissão: {{ emissionDate }}</p>
                    </div>
                </div>
            </div>
        </div>
    </main>
    
    <!-- Overlay de Carregamento -->
    <div v-if="isLoading" class="loading-overlay">
        <div class="spinner"></div>
        <p>Gerando PDF, por favor aguarde...</p>
    </div>
</div>
</template>

<style>
/* --- Reset e Configurações Globais --- */
:root {
    --primary-color: #2c3e50; /* Azul Ardósia */
    --accent-color: #f39c12; /* Laranja (da logo) */
    --accent-color-hover: #e67e22;
    --success-color: #27ae60; /* Verde Esmeralda */
    --bg-color: #f4f7f9; /* Fundo principal mais claro */
    --surface-color: #ffffff;
    --text-color: #34495e; /* Azul Ardósia Escuro */
    --text-light-color: #7f8c8d; /* Cinza Médio */
    --border-color: #dee2e6;
    --danger-color: #c0392b;
    --warning-color: #f39c12;
    --preview-panel-bg: #e9edf0; /* Fundo do painel direito */

    --border-radius: 8px;
    --box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
    --box-shadow-hover: 0 8px 25px rgba(0, 0, 0, 0.08);
    --font-sans: 'Inter', sans-serif;
    --font-serif: 'Lora', serif;
}

* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

html, body {
    font-family: var(--font-sans);
    background-color: var(--bg-color);
    color: var(--text-color);
    line-height: 1.6;
    font-size: 15px;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
}

/* --- Estrutura Principal --- */
.app-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
}

.main-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 2rem;
    background-color: var(--surface-color);
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
    box-shadow: 0 2px 8px rgba(0,0,0,0.07);
}

.main-header .logo {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.logo-graphic {
    font-family: 'Lora', serif;
    font-size: 1.6rem;
    font-weight: 600;
    display: flex;
    align-items: baseline;
    line-height: 1;
}
.logo-text-main {
    color: #2c3e50;
    padding-right: 2px;
}
.logo-text-pro {
    font-family: 'Inter', sans-serif;
    font-weight: 800;
    font-size: 1.5rem;
    background-color: var(--accent-color);
    color: white;
    padding: 0.2rem 0.6rem;
    border-radius: 5px;
    text-transform: uppercase;
    letter-spacing: -0.5px;
}

.main-header .comarca-text {
    font-size: 0.85rem;
    color: var(--text-light-color);
    font-weight: 500;
    line-height: 1.2;
    border-left: 2px solid var(--border-color);
    padding-left: 1rem;
    margin-left: 1rem;
}


.main-content {
    display: flex;
    flex-grow: 1;
    overflow: hidden;
}

.form-panel {
    width: 55%;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    background-color: var(--surface-color);
}

.tabs-container {
    padding: 1.5rem 2rem;
    flex-grow: 1;
}

.preview-panel-container {
    width: 45%;
    padding: 2rem;
    overflow-y: auto;
    background-color: var(--preview-panel-bg);
    border-left: 1px solid var(--border-color);
    transition: background-color 0.3s ease, border-color 0.3s ease;
}

/* --- Barra de Ferramentas e Botões --- */
.toolbar { display: flex; align-items: center; gap: 0.5rem; }

.toolbar button {
    padding: 0.5rem 1rem;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    cursor: pointer;
    transition: all 0.2s ease;
    font-weight: 500;
    font-size: 0.9rem;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background-color: var(--surface-color);
    color: var(--text-light-color);
}
.toolbar button i {
    width: 16px;
    height: 16px;
}

.btn-primary { 
    background-color: var(--primary-color); 
    color: white; 
    border-color: var(--primary-color); 
    box-shadow: 0 2px 5px rgba(44, 62, 80, 0.3);
}
.btn-primary:hover { 
    background-color: #34495e; 
    border-color: #34495e;
    transform: translateY(-1px);
}

.btn-secondary:hover { background-color: #f8f9f9; border-color: var(--primary-color); color: var(--primary-color); }

.btn-tertiary { background: none; border: none; }
.btn-tertiary:hover { background-color: var(--bg-color); }

.autosave-indicator { color: var(--success-color); font-weight: 500; opacity: 0; transition: opacity 0.5s ease; font-size: 0.85rem; }
.autosave-indicator.visible { opacity: 1; }

/* --- Sistema de Abas --- */
.tabs-nav {
    display: flex;
    flex-wrap: wrap;
    border-bottom: 2px solid var(--bg-color);
    margin-bottom: 2rem;
    padding-bottom: 0.5rem;
}

.tabs-nav button {
    padding: 0.75rem 1.25rem;
    border: none;
    background: none;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-light-color);
    position: relative;
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    white-space: nowrap;
}
.tab-number {
    background-color: var(--bg-color);
    color: var(--text-light-color);
    border-radius: 50%;
    width: 22px;
    height: 22px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 700;
    transition: all 0.2s ease;
}
.tabs-nav button.active { color: var(--accent-color); border-bottom-color: var(--accent-color); }
.tabs-nav button.active .tab-number { background-color: var(--accent-color); color: white; }

.tab-pane h2 { font-size: 1.5rem; color: var(--primary-color); margin-bottom: 1.5rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--bg-color); font-weight: 600; }

/* --- Navegação entre Abas (Próximo/Anterior) --- */
.tab-navigation {
    display: flex;
    justify-content: space-between;
    padding: 1rem 2rem;
    border-top: 1px solid var(--border-color);
    background-color: var(--surface-color);
    flex-shrink: 0;
}
.tab-navigation .spacer { flex-grow: 1; }
.btn-nav, .btn-nav-primary {
    padding: 0.6rem 1.5rem;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    cursor: pointer;
    transition: all 0.2s ease;
    font-weight: 600;
    font-size: 0.95rem;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
}
.btn-nav-primary {
    background-color: var(--accent-color);
    color: white;
    border-color: var(--accent-color);
}
.btn-nav-primary:hover {
    background-color: var(--accent-color-hover);
    border-color: var(--accent-color-hover);
    transform: translateY(-1px);
}
.btn-nav {
    background-color: transparent;
    color: var(--text-light-color);
}
.btn-nav:hover {
    background-color: var(--bg-color);
    color: var(--primary-color);
}

/* --- Formulários --- */
.form-group { margin-bottom: 1.25rem; }
.form-group label, fieldset legend { display: block; margin-bottom: 0.5rem; font-weight: 500; color: var(--text-light-color); font-size: 0.9rem; }
.form-group label .required { color: var(--danger-color); margin-left: 2px; }

.form-group input[type="text"], .form-group input[type="date"], .form-group input[type="number"], .form-group select, .form-group textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    font-size: 1rem;
    font-family: var(--font-sans);
    transition: border-color 0.2s, box-shadow 0.2s;
    background-color: var(--surface-color);
    color: var(--text-color);
}
.form-group input:focus, .form-group select:focus, .form-group textarea:focus {
    outline: none;
    border-color: var(--accent-color);
    box-shadow: 0 0 0 3px rgba(243, 156, 18, 0.2);
}
.form-group textarea { resize: vertical; min-height: 80px; }

.checkbox-group input[type="checkbox"] { width: 1.15em; height: 1.15em; accent-color: var(--primary-color); }
.checkbox-group label { margin-bottom: 0; font-weight: 500; }
.checkbox-group-vertical { display: flex; flex-direction: column; gap: 0.5rem; }
.checkbox-line { display: flex; align-items: center; gap: 0.5rem; }


.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; }

fieldset { border: 1px solid var(--border-color); padding: 1.5rem; border-radius: var(--border-radius); margin: 1.5rem 0; }
fieldset legend { padding: 0 0.5rem; font-weight: 600; }

/* --- Cartões Dinâmicos (Herdeiros, Bens, etc.) --- */
.dynamic-card { 
    background-color: var(--surface-color); 
    border: 1px solid var(--border-color); 
    border-radius: var(--border-radius); 
    padding: 1.5rem; 
    margin-bottom: 1.5rem; 
    position: relative; 
    box-shadow: var(--box-shadow);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.dynamic-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--box-shadow-hover);
}
.dynamic-card .card-title { margin-bottom: 1rem; color: var(--primary-color); font-weight: 600; }

.btn-add { display: flex; align-items: center; justify-content: center; gap: 0.5rem; width: 100%; padding: 0.75rem; border-radius: var(--border-radius); cursor: pointer; font-weight: 600; transition: all 0.2s; background-color: rgba(39, 174, 96, 0.1); color: var(--success-color); border: 1px dashed var(--success-color); margin-top: 1rem; }
.btn-add:hover { background-color: rgba(39, 174, 96, 0.2); border-style: solid; }
.btn-add i { width: 18px; height: 18px; }

.btn-remove { background-color: transparent; color: var(--border-color); border: none; position: absolute; top: 0.75rem; right: 0.75rem; font-weight: bold; cursor: pointer; font-size: 1.5rem; line-height: 1; padding: 0.25rem; }
.btn-remove:hover { color: var(--danger-color); }

.btn-add-small { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; border-radius: var(--border-radius); cursor: pointer; font-weight: 500; transition: all 0.2s; border: 1px solid var(--success-color); background-color: #fff; color: var(--success-color); font-size: 0.9rem; }
.btn-add-small:hover { background-color: var(--success-color); color: #fff; }
.btn-add-small i { width: 16px; height: 16px; }

/* --- Seções Condicionais --- */
.conditional-section { border-left: 3px solid var(--primary-color); padding: 1rem; margin-top: 1rem; background-color: #f8f9fa; border-radius: 0 var(--border-radius) var(--border-radius) 0; }
.conditional-section.warning { border-left-color: var(--warning-color); background-color: rgba(241, 196, 15, 0.05); }
.conditional-section.danger { border-left-color: var(--danger-color); background-color: rgba(231, 76, 60, 0.05); }
.conditional-section .bold { font-weight: 600; display: block; margin-bottom: 1rem; }
.sub-card { background-color: #f8f9fa; margin-top: 1rem; border-left-color: var(--secondary-color); }
.sub-card .card-title { font-size: 1rem; }
.conditional-input { margin-top: 0.5rem; }

/* --- NOVO DESIGN PROFISSIONAL PARA O PREVIEW --- */
.preview-panel { 
    background-color: var(--surface-color); 
    padding: 1rem;
    color: #1a1a1a; 
    font-family: var(--font-serif);
    border: 1px solid var(--border-color);
    box-shadow: var(--box-shadow);
}
.preview-header, .preview-section, .preview-footer {
    padding: 1rem 1.5rem;
    margin-bottom: 0.5rem;
}
.preview-header { 
    text-align: center; 
    background-color: #2c3e50;
    color: white;
    padding: 1.5rem;
    margin: -1rem -1rem 0.5rem -1rem;
    border-radius: 8px 8px 0 0;
}
.header-text p {
    font-family: var(--font-sans);
    font-weight: 500;
    margin: 0;
    line-height: 1.3;
    font-size: 10pt;
    letter-spacing: 0.5px;
    opacity: 0.9;
}
.header-text .comarca {
    font-size: 12pt;
    font-weight: 700;
    opacity: 1;
}
.preview-header h1 { 
    font-family: var(--font-sans);
    font-size: 1.6rem; 
    font-weight: 700; 
    color: white; 
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid rgba(255,255,255,0.2);
    width: 100%;
    text-shadow: 1px 1px 2px rgba(0,0,0,0.2);
}

.preview-section h3 { 
    font-family: var(--font-sans); 
    font-size: 1.2rem; 
    font-weight: 600; 
    color: var(--primary-color);
    padding-bottom: 0.5rem; 
    margin: 1rem 0; 
    border-bottom: 2px solid var(--primary-color);
    display: flex;
    align-items: center;
    gap: 0.75rem;
}
.preview-section h3 i {
    width: 20px;
    height: 20px;
    color: var(--primary-color);
}

.pendencies-section h3 {
    color: var(--danger-color);
    border-bottom-color: var(--danger-color);
}
.pendencies-section h3 i {
    color: var(--danger-color);
}
.pendencies-list {
    list-style-type: none;
    padding-left: 0;
}
.pendencies-list li {
    background-color: rgba(192, 57, 43, 0.05);
    padding: 0.5rem 1rem;
    border-left: 3px solid var(--danger-color);
    margin-bottom: 0.5rem !important;
    border-radius: 4px;
    font-family: var(--font-sans);
    font-size: 10pt;
}


.preview-section h4 { 
    font-family: var(--font-sans); 
    font-size: 1rem; 
    font-weight: 600; 
    color: #444; 
    margin-top: 1.5rem; 
    margin-bottom: 0.5rem; 
}

.preview-card, .preview-card-small { 
    page-break-inside: avoid;
    background-color: #fff; 
    border: 1px solid #e0e0e0; 
    padding: 1.25rem; 
    margin-bottom: 1rem; 
    border-radius: var(--border-radius); 
}
.preview-card p, .preview-card-small p, .preview-card li { 
    margin-bottom: 0.75rem; 
    line-height: 1.6; 
    font-size: 11pt; 
    display: flex;
    align-items: flex-start;
}
.preview-card p:last-child, .preview-card-small p:last-child { margin-bottom: 0; }
.preview-card strong { 
    font-weight: 600;
    font-family: var(--font-sans);
    color: #555;
    margin-right: 8px;
    min-width: 150px; /* Alinhamento das chaves */
}
.preview-card p span, .preview-card li span {
    flex: 1;
    color: #333;
}

.info-procuracao {
    font-size: 10pt !important;
    color: var(--success-color);
    background-color: rgba(39, 174, 96, 0.07);
    padding: 0.75rem;
    border-radius: 4px;
    margin-top: 0.5rem;
    border-left: 3px solid var(--success-color);
}
.info-procuracao p {
    font-size: 10pt !important;
    margin: 0;
}
.info-procuracao strong {
    color: var(--success-color);
}

.preview-sub-card { 
    margin-top: 0.75rem; 
    padding: 0.75rem; 
    border-radius: 4px; 
    border-left: 3px solid var(--border-color); 
}
.preview-sub-card.warning { border-left-color: var(--warning-color); background-color: rgba(241, 196, 15, 0.05); }
.preview-sub-card.danger { border-left-color: var(--danger-color); background-color: rgba(231, 76, 60, 0.05); }
.preview-sub-card.spouse { border-left-color: #e91e63; background-color: rgba(233, 30, 99, 0.05); }
.doc-list {
    list-style-type: '✓  ';
    padding-left: 1.5rem;
}
.obs-content strong {
    min-width: 0 !important;
}
.no-items-message {
    font-style: italic;
    color: var(--text-light-color);
    padding: 1rem;
    text-align: center;
    background-color: var(--bg-color);
    border-radius: var(--border-radius);
}

.preview-footer { 
    padding-top: 2rem; 
    border-top: 1px solid #ccc; 
}
.signature-area { display: flex; justify-content: center; text-align: center; margin-bottom: 2rem; }
.signature-line { border-top: 1px solid #000; width: 350px; padding-top: 0.5rem; }
.signature-name { font-weight: 600; font-size: 11pt; }
.signature-title { font-size: 10pt; color: #555; }
.footer-info {
    font-family: var(--font-sans);
    text-align: center;
    font-size: 9pt;
    color: #777;
}

.placeholder-text { color: var(--secondary-color); text-align: center; padding: 2rem; background-color: var(--bg-color); border-radius: var(--border-radius); }

/* --- Overlay de Carregamento --- */
.loading-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(255, 255, 255, 0.8); backdrop-filter: blur(4px); display: flex; flex-direction: column; justify-content: center; align-items: center; z-index: 1000; color: var(--text-color); }
.spinner { border: 6px solid var(--bg-color); border-top: 6px solid var(--primary-color); border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; }
.loading-overlay p { margin-top: 1rem; font-size: 1.1rem; font-weight: 500; }

@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

/* --- Responsividade --- */
@media (max-width: 1200px) {
    .main-content { flex-direction: column; }
    .form-panel, .preview-panel-container { width: 100%; border-right: none; }
    .preview-panel-container { border-top: 2px solid #e0e0e0; }
}
@media (max-width: 768px) {
    .main-header { flex-direction: column; gap: 1rem; padding: 1rem; }
    .toolbar { flex-wrap: wrap; justify-content: center; }
    .grid-2, .grid-3 { grid-template-columns: 1fr; }
    .tabs-container { padding: 1rem; }
    .preview-panel-container { padding: 1rem; }
    .preview-panel { padding: 1.5rem; }
}

</style>
