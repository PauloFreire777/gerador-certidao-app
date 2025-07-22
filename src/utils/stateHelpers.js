// Arquivo: src/utils/stateHelpers.js

// Função para criar um novo herdeiro (usada recursivamente)
export const createHeirObject = () => ({
    id: crypto.randomUUID(), // ID único para reatividade
    nome: '',
    parentesco: '',
    documentos: '',
    estado: 'Capaz',
    estadoCivil: 'Solteiro(a)',
    isMeeiro: false,
    idProcuracao: '',
    curador: { nome: '', idTermo: '' },
    idCertidaoObito: '',
    conjuge: { nome: '', idProcuracao: '', regimeDeBens: 'Comunhão Parcial de Bens' },
    representantes: []
});

export const createCessionarioObject = () => ({
    id: crypto.randomUUID(),
    nome: '',
    documentos: '',
    idProcuracao: ''
});

// Função para criar um estado inicial limpo (VERSÃO ATUALIZADA)
export const createInitialState = () => ({
    processo: {
        numero: '',
        cumulativo: false,
        responsavel: { nome: '', cargo: '' }
    },
    falecidos: [],
    inventariante: {
        nome: '',
        parentesco: '',
        documentos: '',
        idProcuracao: '',
        idTermoCompromisso: ''
    },
    herdeiros: [],
    renuncia: {
        houveRenuncia: false,
        renunciantes: [] // Array of { herdeiroId: '...', tipo: 'Abdicativa', idEscritura: '' }
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
        alvaras: [],
        idLaudoAvaliacaoIncapaz: ''
    },
    documentosProcessuais: {
        primeirasDeclaracoes: { status: 'Não Apresentada', id: '' },
        edital: { determinado: 'Não', status: 'Não Expedido', id: '', prazoDecorrido: 'Não', idDecursoPrazo: '' },
        ultimasDeclaracoes: { status: 'Não Apresentada', id: '' },
        testamentosCensec: [], 
        sentenca: { status: 'Não Proferida', id: '' },
        transito: { status: 'Não Ocorrido', id: '' }
    },
    custas: {
        situacao: 'Ao final', // 'Ao final', 'Isenção', 'Devidas'
        calculada: 'Não', // 'Sim', 'Não'
        idCalculo: '',
        paga: 'Não', // 'Sim', 'Não'
        idPagamento: ''
    },
    documentacaoTributaria: [],
    observacoes: []
});

// Função para criar um novo falecido (VERSÃO ATUALIZADA)
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
    relevancia: 'Média'
});