// Arquivo: src/utils/stateHelpers.js - VERSÃO FINAL

// Função para criar um novo advogado
export const createAdvogadoObject = () => ({
    id: crypto.randomUUID(),
    nome: '',
    oab: ''
});

// Função para criar um novo herdeiro (usada recursivamente)
export const createHeirObject = () => ({
    id: crypto.randomUUID(),
    nome: '',
    parentesco: '',
    documentos: '',
    estado: 'Capaz',
    estadoCivil: 'Solteiro(a)',
    isMeeiro: false,
    idProcuracao: '',
    advogadoId: '', // ID do advogado que representa o herdeiro
    curador: { 
        nome: '', 
        idTermo: '',
        advogadoId: '' // ID do advogado que representa o curador
    },
    idCertidaoObito: '',
    conjuge: {
        nome: '',
        idProcuracao: '',
        regimeDeBens: 'Comunhão Parcial de Bens',
        advogadoId: '' // ID do advogado que representa o cônjuge
    },
    representantes: []
});

export const createCessionarioObject = () => ({
    id: crypto.randomUUID(),
    nome: '',
    documentos: '',
    idProcuracao: ''
});

// Função para criar um estado inicial limpo
export const createInitialState = () => ({
    processo: {
        numero: '',
        cumulativo: false,
        responsavel: { nome: '', cargo: '' },
        advogados: [] // Array de advogados do processo
    },
    falecidos: [],
    inventariante: {
        nome: '',
        parentesco: '',
        documentos: '',
        idProcuracao: '',
        idTermoCompromisso: '',
        advogadoId: '' // ID do advogado que representa o inventariante
    },
    herdeiros: [],
    renuncia: {
        houveRenuncia: false,
        renunciantes: []
    },
    cessao: {
        houveCessao: false,
        idEscritura: '',
        cessionarios: []
    },
    bens: {
        imoveis: [],
        veiculos: [],
        semoventes: [],
        outrosBens: [],
        valoresResiduais: [],
        dividas: [],
        alvaras: []
    },
    documentosProcessuais: {
        primeirasDeclaracoes: { status: 'Não Apresentada', id: '' },
        edital: { determinado: 'Não', status: 'Não Expedido', id: '', prazoDecorrido: 'Não', idDecursoPrazo: '' },
        ultimasDeclaracoes: { status: 'Não Apresentada', id: '' },
        testamentosCensec: [],
        sentenca: { status: 'Não Proferida', id: '' },
        transito: { status: 'Não Ocorrido', id: '' },
        manifestacaoMP: { necessaria: false, status: 'Não Manifestado', id: '' }
    },
    custas: {
        situacao: 'Ao final',
        calculada: 'Não',
        idCalculo: '',
        paga: 'Não',
        idPagamento: ''
    },
    documentacaoTributaria: [],
    observacoes: []
});

// Função para criar um novo falecido
export const createFalecido = () => ({
    id: crypto.randomUUID(),
    nome: '',
    dataFalecimento: '',
    documentos: '',
    idCertidaoObito: '',
    regimeCasamento: 'Não se aplica',
    deixouTestamento: false
});

// Função para criar uma nova observação
export const createObservacao = () => ({
    id: crypto.randomUUID(),
    titulo: '',
    conteudo: '',
    relevancia: 'Média' // Pode ser 'Baixa', 'Média', 'Alta'
});

// Função para criar um novo bem imóvel
export const createImovel = () => ({
    descricao: '',
    matricula: '',
    tipo: 'Urbano',
    avaliado: false,
    idAvaliacao: '',
    idMatricula: '', // ID do documento da matrícula
    // Para imóvel urbano
    iptu: {
        determinado: false,
        id: ''
    },
    // Para imóvel rural
    itr: {
        determinado: false,
        id: ''
    },
    ccir: {
        determinado: false,
        id: ''
    },
    car: {
        determinado: false,
        id: ''
    }
});

// Função para criar um novo veículo
export const createVeiculo = () => ({
    descricao: '',
    placa: '',
    renavam: '',
    avaliado: false,
    idAvaliacao: '',
    idCRLV: '' // ID do documento CRLV
});

// Função para criar um novo semovente
export const createSemovente = () => ({
    descricao: '',
    quantidade: '',
    valor: '',
    avaliado: false,
    idAvaliacao: '',
    idDocumento: '' // ID do documento comprobatório
});

// Função para criar outro bem
export const createOutroBem = () => ({
    descricao: '',
    quantidade: '',
    valor: '',
    avaliado: false,
    idAvaliacao: '',
    idDocumento: '' // ID do documento comprobatório
});