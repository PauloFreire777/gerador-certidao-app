// api/generate-pdf.js - VERSÃO FINAL COM RODAPÉ, FLUIDEZ E CORREÇÕES

import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

// --- ESTILOS CSS PARA UM FLUXO SUAVE ---
const css = `
    :root {
        --primary-color: #2c3e50; --accent-color: #3498db; --success-color: #27ae60;
        --danger-color: #c0392b; --warning-color: #f39c12; --font-sans: 'Inter', sans-serif;
        --font-serif: 'Lora', serif; --border-radius: 8px;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
        font-family: var(--font-serif); color: #1a1a1a; line-height: 1.5; font-size: 10pt;
        -webkit-print-color-adjust: exact; print-color-adjust: exact;
        orphans: 3;
        widows: 3;
    }
    
    /* --- CONTROLE DE QUEBRA DE PÁGINA "SUAVE" --- */
    .preview-section h3, .preview-section h4 { break-after: avoid; }
    .preview-card, .preview-card-small, .preview-sub-card, .pendencies-list li { break-inside: avoid; }
    .preview-footer { break-before: avoid; }

    /* --- ESTILOS VISUAIS --- */
    .preview-header { text-align: center; background-color: #2c3e50; color: white; padding: 1.5rem; }
    .header-text p { font-family: var(--font-sans); font-weight: 500; margin: 0; line-height: 1.3; font-size: 10pt; }
    .header-text .comarca { font-size: 12pt; font-weight: 700; }
    .preview-header h1 { font-family: var(--font-sans); font-size: 1.6rem; font-weight: 700; color: white; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.2); }
    .preview-header h2.subtitle { font-family: var(--font-sans); font-size: 1.1rem; opacity: 0.8; font-weight: 400; margin-top: 0.25rem; }
    
    .preview-section { padding: 1rem 1.5rem 0.25rem 1.5rem; }
    .preview-section h3 { font-family: var(--font-sans); font-size: 1.2rem; font-weight: 600; color: var(--primary-color); padding-bottom: 0.5rem; margin: 1.5rem 0 1rem 0; border-bottom: 2px solid var(--primary-color); }
    .preview-section h4 { font-family: var(--font-sans); font-size: 1rem; font-weight: 600; color: #444; margin-top: 1.25rem; margin-bottom: 0.75rem; padding-bottom: 0.25rem; border-bottom: 1px solid #eee; }
    
    .pendencies-section { border: 1px solid var(--danger-color); background-color: rgba(192, 57, 43, 0.05); padding: 1.5rem; margin: 1rem 1.5rem; }
    .pendencies-section h3 { color: var(--danger-color); border-bottom-color: var(--danger-color); margin: 0 0 1rem 0; }
    
    /* CORRIGIDO: Voltando para uma coluna */
    .pendencies-list { list-style-type: none; padding-left: 0; margin: 0; columns: 1; }
    .pendencies-list li { padding: 0.25rem; margin-bottom: 0.25rem; font-family: var(--font-sans); font-size: 9pt; }
    
    .preview-card, .preview-card-small { border: 1px solid #e0e0e0; padding: 1rem; margin-bottom: 1rem; border-radius: var(--border-radius); }
    .preview-card p, .preview-card-small p { margin-bottom: 0.5rem; display: flex; align-items: flex-start; }
    .preview-card p:last-child, .preview-card-small p:last-child { margin-bottom: 0; }
    .preview-card strong, .preview-card-small strong { font-weight: 600; font-family: var(--font-sans); color: #555; margin-right: 8px; min-width: 180px; }
    .preview-card p span, .preview-card-small p span { flex: 1; color: #333; }
    
    .info-procuracao, .info-advogado { font-size: 9pt !important; padding: 0.75rem; border-radius: 4px; margin-top: 0.5rem; border-left-width: 3px; border-left-style: solid; }
    .info-procuracao { color: var(--success-color); background-color: rgba(39, 174, 96, 0.07); border-left-color: var(--success-color); }
    .info-advogado { color: #2980b9; background-color: rgba(52, 152, 219, 0.07); border-left-color: #3498db; }
    .info-procuracao p, .info-advogado p { margin: 0; }
    
    .preview-sub-card { margin-top: 0.75rem; padding: 0.75rem; border-radius: 4px; border-left: 3px solid #ccc; }
    .preview-sub-card.warning { border-left-color: var(--warning-color); background-color: rgba(241, 196, 15, 0.05); }
    .preview-sub-card.danger { border-left-color: var(--danger-color); background-color: rgba(231, 76, 60, 0.05); }
    
    .main-footer { padding: 2rem 1.5rem 0 1.5rem; border-top: 1px solid #ccc; margin-top: 2rem; text-align: center; }
    .signature-line { border-top: 1px solid #000; width: 350px; padding-top: 0.5rem; display: inline-block; }
    .signature-name { font-weight: 600; font-size: 11pt; overflow-wrap: break-word; }
    .signature-title { font-size: 10pt; color: #555; }
`;

// --- FUNÇÕES AUXILIARES DE GERAÇÃO DE HTML ---
function formatDate(d) { if (!d) return 'Não informado'; try { const dt = new Date(d + 'T00:00:00'); return dt.toLocaleDateString('pt-BR'); } catch (e) { return d; } }
function getAdvogadoById(id, advogados) { if (!id || !advogados) return null; return advogados.find(a => a.id === id); }
function getHeirNameById(id, allHeirs) { const find = (heirs) => { for(const h of heirs) { if(h.id === id) return h.nome; if(h.representantes) { const found = find(h.representantes); if(found) return found; } } return null; }; return find(allHeirs) || 'Não encontrado' }
function getEditalStatus(edital) { if (edital.determinado === 'Não') return 'Não determinada a expedição.'; if (edital.status === 'Não Expedido') return 'Expedição pendente.'; if (edital.prazoDecorrido === 'Não') return `Expedido (ID: ${edital.id || 'N/A'}), aguardando decurso de prazo.`; return `Expedido (ID: ${edital.id || 'N/A'}), prazo decorrido (ID: ${edital.idDecursoPrazo || 'N/A'}).`; }
function getCustasStatus(custas) { if (custas.situacao === 'Isenção') return 'Isento de custas.'; if (custas.situacao === 'Ao final') return 'Custas a serem pagas ao final do processo.'; if (custas.situacao === 'Devidas') { const c = custas.calculada === 'Sim' ? `Calculada (ID: ${custas.idCalculo || 'N/A'})` : 'Cálculo pendente'; const p = custas.paga === 'Sim' ? `Pagas (ID: ${custas.idPagamento || 'N/A'})` : 'Pagamento pendente'; return `${c}, ${p}.`; } return 'Situação não informada.'; }

function generateHeirsHtml(heirs, allAdvogados, level = 0) {
    if (!heirs || heirs.length === 0) return '';
    return heirs.map(h => {
        const advogado = getAdvogadoById(h.advogadoId, allAdvogados);
        const curadorAdvogado = getAdvogadoById(h.curador.advogadoId, allAdvogados);
        const conjugeAdvogado = getAdvogadoById(h.conjuge.advogadoId, allAdvogados);
        const procuracaoHtml = h.idProcuracao ? `<div class="info-procuracao"><p><strong>Procuração (ID):</strong> <span>${h.idProcuracao}</span></p></div>` : '';
        const advogadoHtml = advogado ? `<div class="info-advogado"><p><strong>Advogado(a):</strong> <span>${advogado.nome} (OAB: ${advogado.oab})</span></p></div>` : '';
        const incapazHtml = h.estado === 'Incapaz' ? `<div class="preview-sub-card warning"><p><strong>Curador(a):</strong> <span>${h.curador.nome || 'Não informado'}</span></p><p><strong>Termo de Curador (ID):</strong> <span>${h.curador.idTermo || 'Não informado'}</span></p>${h.curador.idProcuracao ? `<div class="info-procuracao" style="margin-top: 8px;"><p><strong>Procuração Curador (ID):</strong> <span>${h.curador.idProcuracao}</span></p></div>` : ''}${curadorAdvogado ? `<div class="info-advogado" style="margin-top: 8px;"><p><strong>Advogado(a) do Curador:</strong> <span>${curadorAdvogado.nome} (OAB: ${curadorAdvogado.oab})</span></p></div>` : ''}</div>` : '';
        const conjugeHtml = (h.estadoCivil === 'Casado(a)' || h.estadoCivil === 'União Estável') ? `<div class="preview-sub-card"><p><strong>Cônjuge/Comp.:</strong> <span>${h.conjuge.nome || 'Não informado'}</span></p>${h.conjuge.idProcuracao ? `<div class="info-procuracao" style="margin-top: 8px;"><p><strong>Procuração Cônjuge (ID):</strong> <span>${h.conjuge.idProcuracao}</span></p></div>` : ''}${conjugeAdvogado ? `<div class="info-advogado" style="margin-top: 8px;"><p><strong>Advogado(a) do Cônjuge:</strong> <span>${conjugeAdvogado.nome} (OAB: ${conjugeAdvogado.oab})</span></p></div>` : ''}</div>` : '';
        const falecidoHtml = (h.estado === 'Falecido') ? `<div class="preview-sub-card danger"><p><strong>Certidão de Óbito (ID):</strong> <span>${h.idCertidaoObito || 'Não informado'}</span></p>${(h.representantes && h.representantes.length > 0) ? `<p><strong>Sucessão de Herdeiro Falecido:</strong></p>${generateHeirsHtml(h.representantes, allAdvogados, level + 1)}` : ''}</div>` : '';
        return `<div class="preview-card" style="margin-left: ${level * 20}px;"><p><strong>${h.isMeeiro ? 'Meeiro(a):' : (level > 0 ? 'Representante:' : 'Herdeiro(a):')}</strong><span>${h.nome || 'Não informado'} ${h.parentesco ? `(${h.parentesco})` : ''}</span></p><p><strong>Docs. Pessoais (ID):</strong> <span>${h.documentos || 'Não informado'}</span></p>${procuracaoHtml}${advogadoHtml}${incapazHtml}${conjugeHtml}${falecidoHtml}</div>`;
    }).join('');
}


// --- FUNÇÃO PRINCIPAL DA API (HANDLER) ---
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).end();
    }
    let browser = null;
    try {
        const { state: data, pendencies } = req.body;
        const herdeirosValidos = data.herdeiros.filter(h => h.nome && h.nome.trim() !== '');
        const hasBens = Object.values(data.bens).some(arr => Array.isArray(arr) && arr.length > 0);
        const hasIncapaz = herdeirosValidos.some(h => h.estado === 'Incapaz' || (h.representantes && h.representantes.some(r => r.estado === 'Incapaz')));

        let sectionCounter = 0;
        let htmlSections = '';
        
        // Lógica de geração de seções (sem duplicação)
        if (data.processo.numero) {
            sectionCounter++;
            htmlSections += `<div class="preview-section"><h3>${sectionCounter}. Dados do Processo</h3><div class="preview-card"><p><strong>Número:</strong><span>${data.processo.numero}</span></p>${data.processo.cumulativo ? `<p><strong>Tipo:</strong><span>Inventário Cumulativo</span></p>` : ''}${data.processo.advogados.length > 0 ? `<div class="info-advogado" style="margin-top: 1rem;"><p style="margin:0;"><strong>Advogados:</strong></p><ul style="list-style: none; padding-left: 10px; margin-top: 5px;">${data.processo.advogados.map(adv => `<li>- ${adv.nome} (OAB: ${adv.oab})</li>`).join('')}</ul></div>` : ''}</div></div>`;
        }
        if (data.falecidos.length > 0) {
            sectionCounter++;
            htmlSections += `<div class="preview-section"><h3>${sectionCounter}. De Cujus</h3>${data.falecidos.map(f => `<div class="preview-card"><p><strong>Nome:</strong><span>${f.nome}</span></p><p><strong>Data do Óbito:</strong><span>${formatDate(f.dataFalecimento)}</span></p><p><strong>Docs. Pessoais (ID):</strong><span>${f.documentos || 'Não informado'}</span></p><p><strong>Cert. Óbito (ID):</strong><span>${f.idCertidaoObito || 'Não informado'}</span></p></div>`).join('')}</div>`;
        }
        if (data.inventariante.nome || herdeirosValidos.length > 0) {
            sectionCounter++;
            const inventarianteAdvogado = getAdvogadoById(data.inventariante.advogadoId, data.processo.advogados);
            htmlSections += `<div class="preview-section"><h3>${sectionCounter}. Inventariante, Herdeiros e Sucessores</h3>${data.inventariante.nome ? `<div class="preview-card"><h4>Inventariante</h4><p><strong>Nome:</strong><span>${data.inventariante.nome}</span></p><p><strong>Parentesco:</strong><span>${data.inventariante.parentesco || 'Não informado'}</span></p><p><strong>Docs. Pessoais (ID):</strong><span>${data.inventariante.documentos || 'Não informado'}</span></p><p><strong>Termo de Comp. (ID):</strong><span>${data.inventariante.idTermoCompromisso || 'Não informado'}</span></p>${data.inventariante.idProcuracao ? `<div class="info-procuracao"><p><strong>Procuração (ID):</strong><span>${data.inventariante.idProcuracao}</span></p></div>` : ''}${inventarianteAdvogado ? `<div class="info-advogado"><p><strong>Advogado(a):</strong><span>${inventarianteAdvogado.nome} (OAB: ${inventarianteAdvogado.oab})</span></p></div>` : ''}</div>` : ''}${generateHeirsHtml(herdeirosValidos, data.processo.advogados)}</div>`;
        }
        if (data.renuncia.houveRenuncia && data.renuncia.renunciantes.length > 0) {
            sectionCounter++;
            htmlSections += `<div class="preview-section"><h3>${sectionCounter}. Renúncia de Direitos</h3>${data.renuncia.renunciantes.map(r => `<div class="preview-card"><p><strong>Renunciante:</strong><span>${getHeirNameById(r.herdeiroId, herdeirosValidos)}</span></p><p><strong>Tipo:</strong><span>${r.tipo}</span></p><p><strong>Escritura/Termo (ID):</strong><span>${r.idEscritura || 'Não informado'}</span></p></div>`).join('')}</div>`;
        }
        if (data.cessao.houveCessao && data.cessao.cessionarios.length > 0) {
            sectionCounter++;
            const cessionariosHtml = data.cessao.cessionarios.map(c => {
                const advogado = getAdvogadoById(c.advogadoId, data.processo.advogados);
                return `<div class="preview-sub-card"><p><strong>Cessionário:</strong><span>${c.nome || 'Não informado'}</span></p><p><strong>Docs. Pessoais (ID):</strong><span>${c.documentos || 'Não informado'}</span></p>${c.idProcuracao ? `<div class="info-procuracao"><p><strong>Procuração (ID):</strong><span>${c.idProcuracao}</span></p></div>` : ''}${advogado ? `<div class="info-advogado"><p><strong>Advogado(a):</strong><span>${advogado.nome} (OAB: ${advogado.oab})</span></p></div>` : ''}</div>`;
            }).join('');
            htmlSections += `<div class="preview-section"><h3>${sectionCounter}. Cessão de Direitos</h3><div class="preview-card"><p><strong>Escritura de Cessão (ID):</strong><span>${data.cessao.idEscritura || 'Não informado'}</span></p>${cessionariosHtml}</div></div>`;
        }
        if (hasBens) {
            sectionCounter++;
            htmlSections += `<div class="preview-section"><h3>${sectionCounter}. Relação de Bens, Direitos e Dívidas</h3>
                ${data.bens.imoveis.length > 0 ? `<h4>Bens Imóveis</h4>${data.bens.imoveis.map(item => `<div class="preview-card-small"><p><strong>Descrição:</strong> <span>${item.descricao || 'N/A'} (Matrícula: ${item.matricula || 'N/A'})</span></p><p><strong>ID da Matrícula:</strong> <span>${item.idMatricula || 'Pendente'}</span></p>${item.tipo === 'Urbano' && item.iptu.determinado ? `<p><strong>IPTU:</strong> <span>${ item.iptu.id ? `Juntado (ID: ${item.iptu.id})` : 'Pendente' }</span></p>` : ''}${item.tipo === 'Rural' ? `${ item.itr.determinado ? `<p><strong>ITR:</strong> <span>${ item.itr.id ? `Juntado (ID: ${item.itr.id})` : 'Pendente' }</span></p>` : ''}${ item.ccir.determinado ? `<p><strong>CCIR:</strong> <span>${ item.ccir.id ? `Juntado (ID: ${item.ccir.id})` : 'Pendente' }</span></p>` : ''}${ item.car.determinado ? `<p><strong>CAR:</strong> <span>${ item.car.id ? `Juntado (ID: ${item.car.id})` : 'Pendente' }</span></p>` : ''}` : ''}${hasIncapaz && !item.avaliado ? `<p class="warning-text"><strong>Avaliação Judicial:</strong> <span>Pendente</span></p>` : ''}${hasIncapaz && item.avaliado ? `<p class="success-text"><strong>Avaliação Judicial:</strong> <span>Realizada (ID: ${item.idAvaliacao || 'Pendente'})</span></p>`: ''}</div>`).join('')}` : ''}
                ${data.bens.veiculos.length > 0 ? `<h4>Veículos</h4>${data.bens.veiculos.map(item => `<div class="preview-card-small"><p><strong>Descrição:</strong> <span>${item.descricao || 'N/A'}</span></p><p><strong>Placa:</strong> <span>${item.placa || 'N/A'}</span></p><p><strong>Renavam:</strong> <span>${item.renavam || 'N/A'}</span></p><p><strong>ID do CRLV:</strong> <span>${item.idCRLV || 'Pendente'}</span></p>${hasIncapaz && !item.avaliado ? `<p class="warning-text"><strong>Avaliação Judicial:</strong> <span>Pendente</span></p>` : ''}${hasIncapaz && item.avaliado ? `<p class="success-text"><strong>Avaliação Judicial:</strong> <span>Realizada (ID: ${item.idAvaliacao || 'Pendente'})</span></p>`: ''}</div>`).join('')}` : ''}
                ${data.bens.semoventes.length > 0 ? `<h4>Semoventes</h4>${data.bens.semoventes.map(item => `<div class="preview-card-small"><p><strong>Descrição:</strong><span>${item.descricao}</span></p><p><strong>Doc. (ID):</strong><span>${item.idDocumento || 'Pendente'}</span></p>${hasIncapaz && !item.avaliado ? `<p class="warning-text"><strong>Avaliação Judicial:</strong> <span>Pendente</span></p>` : ''}${hasIncapaz && item.avaliado ? `<p class="success-text"><strong>Avaliação Judicial:</strong> <span>Realizada (ID: ${item.idAvaliacao || 'Pendente'})</span></p>`: ''}</div>`).join('')}`: ''}
                ${data.bens.valoresResiduais.length > 0 ? `<h4>Valores Residuais</h4>${data.bens.valoresResiduais.map(item => `<div class="preview-card-small"><p><strong>Tipo:</strong><span>${item.tipo}</span></p><p><strong>Instituição:</strong><span>${item.instituicao || 'N/A'}</span></p><p><strong>Valor (R$):</strong><span>${item.valor || 'N/A'}</span></p><p><strong>Doc. (ID):</strong><span>${item.idDocumento || 'Pendente'}</span></p></div>`).join('')}`: ''}
                ${data.bens.dividas.length > 0 ? `<h4>Dívidas do Espólio</h4>${data.bens.dividas.map(item => `<div class="preview-card-small"><p><strong>Credor:</strong><span>${item.credor}</span></p><p><strong>Tipo:</strong><span>${item.tipo}</span></p><p><strong>Valor (R$):</strong><span>${item.valor}</span></p><p><strong>Doc. (ID):</strong><span>${item.idDocumento || 'Pendente'}</span></p></div>`).join('')}`: ''}
                ${data.bens.houvePedidoAlvara && data.bens.alvaras.length > 0 ? `<h4>Alvarás</h4>${data.bens.alvaras.map(item => `<div class="preview-card-small"><p><strong>Finalidade:</strong><span>${item.finalidade}</span></p><p><strong>Requerimento:</strong><span>${item.idRequerimento ? `ID: ${item.idRequerimento}`:'Não requerido'}</span></p>${item.idRequerimento ? `<p><strong>Status:</strong><span>${item.statusDeferimento}</span></p>`:''}${item.statusDeferimento === 'Deferido' ? `<p><strong>Expedição:</strong><span>${item.idExpedicao || 'Pendente'}</span></p>`:''}${item.idExpedicao ? `<p><strong>Prestou Contas:</strong><span>${item.prestouContas}</span></p>`:''}</div>`).join('')}`: ''}
            </div>`;
        }
        sectionCounter++;
        htmlSections += `<div class="preview-section"><h3>${sectionCounter}. Documentos Processuais</h3><div class="preview-card"><p><strong>Primeiras Declarações:</strong> <span>${data.documentosProcessuais.primeirasDeclaracoes.status === 'Apresentada' ? `Apresentada (ID: ${data.documentosProcessuais.primeirasDeclaracoes.id || 'N/A'})` : 'Não Apresentada'}</span></p>${data.documentosProcessuais.testamentosCensec.map(item => `<p><strong>${item.deixouTestamento ? `Testamento (${item.nomeFalecido})` : `Certidão CENSEC (${item.nomeFalecido})`}:</strong><span>${item.id ? `Apresentado (ID: ${item.id})` : 'Pendente'}</span></p>`).join('')}<p><strong>Edital:</strong> <span>${getEditalStatus(data.documentosProcessuais.edital)}</span></p><p><strong>Últimas Declarações:</strong> <span>${data.documentosProcessuais.ultimasDeclaracoes.status === 'Apresentada' ? `Apresentada (ID: ${data.documentosProcessuais.ultimasDeclaracoes.id || 'N/A'})` : 'Não Apresentada'}</span></p>${hasIncapaz ? `<p><strong>Manifestação do MP:</strong> <span>${data.documentosProcessuais.manifestacaoMP.status === 'Manifestado' ? `Manifestado (ID: ${data.documentosProcessuais.manifestacaoMP.id || 'N/A'})` : 'Pendente'}</span></p>` : ''}<p><strong>Sentença:</strong> <span>${data.documentosProcessuais.sentenca.status === 'Proferida' ? `Proferida (ID: ${data.documentosProcessuais.sentenca.id || 'N/A'})` : 'Não Proferida'}</span></p><p><strong>Trânsito em Julgado:</strong> <span>${data.documentosProcessuais.transito.status === 'Ocorrido' ? `Ocorrido (ID: ${data.documentosProcessuais.transito.id || 'N/A'})` : 'Não Ocorrido'}</span></p></div></div>`;
        
        if (data.documentacaoTributaria.length > 0 || (data.custas && data.custas.situacao)) {
            sectionCounter++;
            htmlSections += `<div class="preview-section"><h3>${sectionCounter}. Regularidade Tributária e Custas</h3>
            ${data.documentacaoTributaria.map(trib => `<div class="preview-card"><h4>Tributos de: <strong>${trib.nomeFalecido}</strong></h4><p><strong>Status ITCD:</strong><span>${trib.statusItcd}</span></p><p><strong>CND Municipal:</strong><span>${trib.cndMunicipal.status === 'Juntada' ? `Juntada (ID: ${trib.cndMunicipal.id || 'N/A'})` : 'Não Juntada'}</span></p><p><strong>CND Estadual:</strong><span>${trib.cndEstadual.status === 'Juntada' ? `Juntada (ID: ${trib.cndEstadual.id || 'N/A'})` : 'Não Juntada'}</span></p><p><strong>CND Federal:</strong><span>${trib.cndFederal.status === 'Juntada' ? `Juntada (ID: ${trib.cndFederal.id || 'N/A'})` : 'Não Juntada'}</span></p></div>`).join('')}
            ${data.custas ? `<div class="preview-card"><h4>Custas Processuais</h4><p><strong>Situação:</strong><span>${getCustasStatus(data.custas)}</span></p></div>` : ''}
            </div>`;
        }
        if (data.observacoes.length > 0) {
          sectionCounter++;
          htmlSections += `<div class="preview-section"><h3>${sectionCounter}. Observações Adicionais</h3>${data.observacoes.map(obs => `<div class="preview-card obs-${obs.relevancia.toLowerCase()}"><p><strong>${obs.titulo || 'Observação'}</strong></p><p class="obs-content"><span>${obs.conteudo}</span></p></div>`).join('')}</div>`;
        }

        browser = await puppeteer.launch({ args: chromium.args, defaultViewport: chromium.defaultViewport, executablePath: await chromium.executablePath(), headless: chromium.headless });
        const page = await browser.newPage();
        
        // NOVO: Template do Rodapé
        const footerTemplate = `
            <div style="font-family: 'Inter', sans-serif; font-size: 8pt; color: #777; width: 100%; display: flex; justify-content: space-between; padding: 0 1.5cm; box-sizing: border-box;">
                <span>Este documento foi gerado eletronicamente pelo Sistema CertidãoPRO</span>
                <span>
                    Data de Emissão: ${new Date().toLocaleDateString('pt-BR')} - 
                    Página <span class="pageNumber"></span> de <span class="totalPages"></span>
                </span>
            </div>
        `;
        
        const finalHtml = `
            <html>
                <head>
                    <meta charset="UTF-8">
                    <link rel="preconnect" href="https://fonts.googleapis.com">
                    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&family=Lora:wght@400;600&display=swap" rel="stylesheet">
                    <style>${css}</style>
                </head>
                <body>
                    <div id="pdf-container">
                        <div class="preview-header">
                            <div class="header-text">
                                <p>PODER JUDICIÁRIO DO ESTADO DE MINAS GERAIS</p>
                                <p class="comarca">VARA ÚNICA DA COMARCA DE NOVA RESENDE/MG</p>
                            </div>
                            <h1>CERTIDÃO DE REGULARIDADE</h1>
                            <h2 class="subtitle">INVENTÁRIO</h2>
                        </div>
                        <div class="preview-content">
                            ${pendencies && pendencies.length > 0 ? `<div class="preview-section pendencies-section"><h3>PENDÊNCIAS</h3><ul class="pendencies-list">${pendencies.map(p => `<li>${p}</li>`).join('')}</ul></div>` : ''}
                            ${htmlSections}
                        </div>
                        <div class="main-footer">
                            <div class="signature-line">
                                <p class="signature-name">${data.processo.responsavel.nome || '________________________________'}</p>
                                <p class="signature-title">${data.processo.responsavel.cargo || 'Cargo do Responsável'}</p>
                            </div>
                        </div>
                    </div>
                </body>
            </html>`;

        await page.setContent(finalHtml, { waitUntil: 'networkidle0' });
        await page.emulateMediaType('print'); 
        
        // CORRIGIDO: Opções do PDF com o novo rodapé
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { 
                top: '2cm', 
                right: '1.5cm', 
                bottom: '2cm', // Margem para dar espaço ao rodapé
                left: '1.5cm' 
            },
            displayHeaderFooter: true,
            footerTemplate: footerTemplate
        });
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Length', pdfBuffer.length);
        res.status(200).end(pdfBuffer);
        
    } catch (error) {
        console.error('Erro ao gerar o PDF:', error);
        res.status(500).json({ message: 'Erro ao gerar o PDF.', error: error.message });
    } finally {
        if (browser !== null) {
            await browser.close();
        }
    }
}
