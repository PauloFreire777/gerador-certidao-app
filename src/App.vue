<script>
// 1. IMPORTS NO TOPO
import { createIcons, icons } from 'lucide';
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
      if (inventariante.nome) {
          if (!inventariante.documentos) items.push('Documentos pessoais do Inventariante pendentes.');
          if (!inventariante.idProcuracao) items.push('Procuração do Inventariante pendente.');
      }

      // Herdeiros (recursivo)
      const checkHerdeiro = (heir, path) => {
        // CORREÇÃO: Pula a validação de herdeiros que não foram preenchidos
        if (!heir.nome || heir.nome.trim() === '') return;

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
        const findHeir = (heirs) => {
            for (const heir of heirs) {
                if (heir.id === id) return heir.nome;
                if (heir.representantes) {
                    const found = findHeir(heir.representantes);
                    if (found) return found;
                }
            }
            return null;
        };
        return findHeir(this.state.herdeiros) || 'Herdeiro não encontrado';
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
            localStorage.removeItem('certidaoInventarioState');
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
            const apiUrl = import.meta.env.PROD ? '/api/generate-pdf' : import.meta.env.VITE_API_URL;

            if (!apiUrl) {
                throw new Error("A URL da API não está configurada para o ambiente de desenvolvimento. Crie um arquivo .env e defina VITE_API_URL (ex: http://localhost:3000/api/generate-pdf).");
            }

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    state: this.state,
                    bensSections: this.bensSections, 
                    pendencies: this.pendencies
                }),
            });

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error(`Erro 404: A rota da API (${apiUrl}) não foi encontrada. Verifique se o arquivo da API está na pasta /api e se o deploy foi concluído com sucesso.`);
                }
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                throw new Error(`O servidor respondeu com erro ${response.status}: ${errorData.message}`);
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
    // Autosave a cada 30 segundos
    setInterval(() => {
      this.saveStateToLocalStorage(this.state);
      this.showAutosaveIndicator = true;
      setTimeout(() => { this.showAutosaveIndicator = false; }, 2000);
    }, 30000);
  },

  updated() {
    // Garante que os ícones sejam renderizados após mudanças no DOM
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
                                <div v-for="heir in state.herdeiros.filter(h => h.nome)" :key="heir.id" class="checkbox-group-vertical">
                                    <div class="checkbox-line">
                                        <input type="checkbox" :id="'renuncia_' + heir.id" :checked="isRenunciante(heir.id)" @change="toggleRenunciante(heir.id)">
                                        <label :for="'renuncia_' + heir.id">{{ heir.nome }}</label>
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
                        <ul class="pendencies-list">
                            <li v-for="(pendency, index) in pendencies" :key="index">{{ pendency }}</li>
                        </ul>
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
                    <div class="preview-section" v-if="state.herdeiros.filter(h => h.nome).length">
                        <h3><i data-lucide="users"></i> 4. Herdeiros e Sucessores</h3>
                        <heir-preview-group :heirs="state.herdeiros.filter(h => h.nome)" :level="0"></heir-preview-group>
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
/* O conteúdo do seu main.css vai aqui. 
   Copie e cole o conteúdo do arquivo src/assets/main.css que forneci anteriormente.
   Ele já contém todas as regras, incluindo a seção @media print. */
</style>
