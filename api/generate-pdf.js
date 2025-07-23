// api/generate-pdf.js - VERSÃO FINAL COM LAYOUT E LÓGICA DE DOCUMENTOS AJUSTADOS

import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

// --- ESTILOS CSS EMBUTIDOS ---
const css = `
    :root {
        --primary-color: #2c3e50; --accent-color: #f39c12; --accent-color-hover: #e67e22;
        --success-color: #27ae60; --bg-color: #f4f7f9; --surface-color: #ffffff;
        --text-color: #34495e; --text-light-color: #7f8c8d; --border-color: #dee2e6;
        --danger-color: #c0392b; --warning-color: #f39c12; --preview-panel-bg: #e9edf0;
        --border-radius: 8px; --box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
        --font-sans: 'Inter', sans-serif; --font-serif: 'Lora', serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: var(--font-serif); color: #1a1a1a; line-height: 1.6; font-size: 10pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    #pdf-container { background-color: var(--surface-color); }
    .preview-header { text-align: center; background-color: #2c3e50; color: white; padding: 1.5rem; border-radius: 8px 8px 0 0; }
    .header-text p { font-family: var(--font-sans); font-weight: 500; margin: 0; line-height: 1.3; font-size: 10pt; letter-spacing: 0.5px; opacity: 0.9; }
    .header-text .comarca { font-size: 12pt; font-weight: 700; opacity: 1; }
    .preview-header h1 { font-family: var(--font-sans); font-size: 1.6rem; font-weight: 700; color: white; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.2); width: 100%; text-shadow: 1px 1px 2px rgba(0,0,0,0.2); }
    .preview-section { padding: 0 1.5rem; margin-bottom: 0.5rem; page-break-inside: avoid; }
    
    .pendencies-section { page-break-inside: auto !important; }

    .preview-section h3 { font-family: var(--font-sans); font-size: 1.2rem; font-weight: 600; color: var(--primary-color); padding-bottom: 0.5rem; margin: 1rem 0; border-bottom: 2px solid var(--primary-color); page-break-after: avoid; }
    .pendencies-section h3 { color: var(--danger-color); border-bottom-color: var(--danger-color); }
    .pendencies-list { list-style-type: none; padding-left: 0; margin: 0; }
    .pendencies-list li { background-color: rgba(192, 57, 43, 0.05); padding: 0.75rem 1rem; border-left: 3px solid var(--danger-color); margin-bottom: 0.5rem !important; border-radius: 4px; font-family: var(--font-sans); font-size: 10pt; }
    .preview-section h4 { font-family: var(--font-sans); font-size: 1rem; font-weight: 600; color: #444; margin-top: 1rem; margin-bottom: 1rem; padding-bottom: 0.25rem; border-bottom: 1px solid #eee; }
    .preview-card, .preview-card-small { page-break-inside: avoid; background-color: #fff; border: 1px solid #e0e0e0; padding: 1.25rem; margin-bottom: 1rem; border-radius: var(--border-radius); }
    .preview-card p, .preview-card-small p { margin-bottom: 0.75rem; line-height: 1.6; font-size: 11pt; display: flex; align-items: flex-start; }
    .preview-card p:last-child, .preview-card-small p:last-child { margin-bottom: 0; }
    .preview-card strong { font-weight: 600; font-family: var(--font-sans); color: #555; margin-right: 8px; min-width: 150px; }
    .preview-card p span { flex: 1; color: #333; }
    .info-procuracao { font-size: 10pt !important; color: var(--success-color); background-color: rgba(39, 174, 96, 0.07); padding: 0.75rem; border-radius: 4px; margin-top: 0.5rem; border-left: 3px solid var(--success-color); }
    .info-procuracao p { font-size: 10pt !important; margin: 0; }
    .info-procuracao strong { color: var(--success-color); }
    .preview-sub-card { margin-top: 0.75rem; padding: 0.75rem; border-radius: 4px; border-left: 3px solid var(--border-color); page-break-inside: avoid; }
    .preview-sub-card.warning { border-left-color: var(--warning-color); background-color: rgba(241, 196, 15, 0.05); }
    .preview-sub-card.danger { border-left-color: var(--danger-color); background-color: rgba(231, 76, 60, 0.05); }
    .preview-sub-card.spouse { border-left-color: #e91e63; background-color: rgba(233, 30, 99, 0.05); }
    .preview-footer { padding: 2rem 1.5rem 0 1.5rem; border-top: 1px solid #ccc; margin-top: 2rem; page-break-before: auto; }
    .signature-area { display: flex; justify-content: center; text-align: center; }
    .signature-line { border-top: 1px solid #000; width: 350px; padding-top: 0.5rem; }
    .signature-name { font-weight: 600; font-size: 11pt; }
    .signature-title { font-size: 10pt; color: #555; }
`;

// --- FUNÇÕES AUXILIARES DE FORMATAÇÃO ---
function formatDate(dateString) { if (!dateString) return 'Não informado'; try { const date = new Date(dateString + 'T00:00:00'); if (isNaN(date.getTime())) return dateString; return date.toLocaleDateString('pt-BR'); } catch (e) { return dateString; } }
function getHeirNameById(heirId, allHeirs) { const findHeir = (heirs) => { for (const heir of heirs) { if (heir.id === heirId) return heir.nome; if (heir.representantes && heir.representantes.length > 0) { const found = findHeir(heir.representantes); if (found) return found; } } return null; }; return findHeir(allHeirs) || 'Herdeiro não encontrado'; }
function generateHeirsHtml(heirs, level = 0) { if (!heirs || heirs.length === 0) return ''; return `<h4>Herdeiros e Sucessores</h4>` + heirs.map(h => `<div class="preview-card" style="margin-left: ${level * 20}px;"><p><strong>${h.isMeeiro ? 'Meeiro(a):' : (level > 0 ? 'Representante:' : 'Herdeiro(a):')}</strong><span>${h.nome || 'Não informado'} ${h.parentesco ? `(${h.parentesco})` : ''}</span></p><p><strong>Condição:</strong> <span>${h.estado || 'Não informado'}</span></p><p><strong>ID dos Documentos Pessoais:</strong> <span>${h.documentos || 'Não informado'}</span></p>${h.idProcuracao ? `<div class="info-procuracao"><p><strong>Procuração (ID):</strong> <span>${h.idProcuracao}</span></p></div>` : ''}${h.estado === 'Incapaz' ? `<div class="preview-sub-card warning"><p><strong>Curador(a):</strong> <span>${h.curador.nome || 'Não informado'}</span></p><p><strong>Termo de Curador (ID):</strong> <span>${h.curador.idTermo || 'Não informado'}</span></p></div>` : ''}${(h.estadoCivil === 'Casado(a)' || h.estadoCivil === 'União Estável') ? `<div class="preview-sub-card spouse"><p><strong>Cônjuge/Comp.:</strong> <span>${h.conjuge.nome || 'Não informado'}</span></p><p><strong>Regime de Bens:</strong> <span>${h.conjuge.regimeDeBens || 'Não informado'}</span></p></div>` : ''}${(h.estado === 'Falecido' && h.representantes && h.representantes.length > 0) ? `<div class="preview-sub-card danger"><p><strong>Certidão de Óbito (ID):</strong> <span>${h.idCertidaoObito || 'Não informado'}</span></p><p><strong>Sucessão de Herdeiro Falecido:</strong></p>${generateHeirsHtml(h.representantes, level + 1)}</div>` : ''}</div>`).join(''); }
function getEditalStatus(edital) { if (edital.determinado === 'Não') return 'Não determinada a expedição.'; if (edital.status === 'Não Expedido') return 'Expedição pendente.'; if (edital.prazoDecorrido === 'Não') return `Expedido (ID: ${edital.id || 'N/A'}), aguardando decurso de prazo.`; return `Expedido (ID: ${edital.id || 'N/A'}), prazo decorrido (ID: ${edital.idDecursoPrazo || 'N/A'}).`; }
function getCustasStatus(custas) { if (custas.situacao === 'Isenção') return 'Isento de custas.'; if (custas.situacao === 'Ao final') return 'Custas a serem pagas ao final do processo.'; if (custas.situacao === 'Devidas') { const calculo = custas.calculada === 'Sim' ? `Calculada (ID: ${custas.idCalculo || 'N/A'})` : 'Cálculo pendente'; const pagamento = custas.paga === 'Sim' ? `Pagas (ID: ${custas.idPagamento || 'N/A'})` : 'Pagamento pendente'; return `${calculo}, ${pagamento}.`; } return 'Situação não informada.'; }

// --- FUNÇÃO PRINCIPAL DA API (HANDLER) ---
export default async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        return res.status(200).end();
    }
    res.setHeader('Access-Control-Allow-Origin', '*');

    let browser = null;
    try {
        const { state: data, bensSections, pendencies } = req.body;
        const herdeirosValidos = data.herdeiros.filter(h => h.nome && h.nome.trim() !== '');

        browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
        });

        const page = await browser.newPage();
        
        const htmlContent = `
          <html>
            <head><meta charset="UTF-8"><style>${css}</style></head>
            <body>
              <div id="pdf-container">
                <div class="preview-header">
                  <div class="header-text">
                    <p>PODER JUDICIÁRIO DO ESTADO DE MINAS GERAIS</p>
                    <p class="comarca">VARA ÚNICA DA COMARCA DE NOVA RESENDE/MG</p>
                  </div>
                  <h1>CERTIDÃO DE REGULARIDADE</h1>
                </div>
                <div class="preview-content">
                  ${pendencies && pendencies.length > 0 ? `<div class="preview-section pendencies-section"><h3>PENDÊNCIAS</h3><ul class="pendencies-list">${pendencies.map(p => `<li>${p}</li>`).join('')}</ul></div>` : ''}
                  ${data.processo.numero ? `<div class="preview-section"><h3>1. Dados do Processo</h3><div class="preview-card"><p><strong>Número do Processo:</strong><span>${data.processo.numero}</span></p>${data.processo.cumulativo ? `<p><strong>Tipo:</strong><span>Inventário Cumulativo</span></p>` : ''}</div></div>` : ''}
                  ${data.falecidos.length > 0 ? `<div class="preview-section"><h3>2. De Cujus (Falecido/a/s)</h3>${data.falecidos.map(f => `<div class="preview-card"><p><strong>Nome:</strong><span>${f.nome || 'Não informado'}</span></p><p><strong>Data do Falecimento:</strong><span>${formatDate(f.dataFalecimento)}</span></p><p><strong>ID dos Documentos Pessoais:</strong><span>${f.documentos || 'Não informado'}</span></p><p><strong>Certidão de Óbito (ID):</strong><span>${f.idCertidaoObito || 'Não informado'}</span></p></div>`).join('')}</div>` : ''}
                  
                  ${(data.inventariante.nome || herdeirosValidos.length > 0) ? `
                    <div class="preview-section">
                        <h3>3. Inventariante, Herdeiros e Sucessores</h3>
                        ${data.inventariante.nome ? `
                            <div class="preview-card">
                                <h4>Inventariante</h4>
                                <p><strong>Nome:</strong><span>${data.inventariante.nome}</span></p>
                                <p><strong>Parentesco:</strong><span>${data.inventariante.parentesco || 'Não informado'}</span></p>
                                <p><strong>ID dos Documentos Pessoais:</strong><span>${data.inventariante.documentos || 'Não informado'}</span></p>
                                <p><strong>Termo de Compromisso (ID):</strong><span>${data.inventariante.idTermoCompromisso || 'Não informado'}</span></p>
                                ${data.inventariante.idProcuracao ? `<div class="info-procuracao"><p><strong>Procuração (ID):</strong><span>${data.inventariante.idProcuracao}</span></p></div>` : ''}
                            </div>
                        ` : ''}
                        ${herdeirosValidos.length > 0 ? generateHeirsHtml(herdeirosValidos) : ''}
                    </div>
                  ` : ''}
                  
                  ${data.renuncia.houveRenuncia && data.renuncia.renunciantes.length > 0 ? `<div class="preview-section"><h3>4. Renúncia de Direitos</h3>${data.renuncia.renunciantes.map(r => `<div class="preview-card"><p><strong>Renunciante:</strong><span>${getHeirNameById(r.herdeiroId, herdeirosValidos)}</span></p><p><strong>Tipo de Renúncia:</strong><span>${r.tipo}</span></p><p><strong>ID da Escritura/Termo:</strong><span>${r.idEscritura || 'Não informado'}</span></p></div>`).join('')}</div>` : ''}
                  ${data.cessao.houveCessao && data.cessao.cessionarios.length > 0 ? `<div class="preview-section"><h3>5. Cessão de Direitos</h3><div class="preview-card"><p><strong>Escritura de Cessão (ID):</strong><span>${data.cessao.idEscritura || 'Não informado'}</span></p>${data.cessao.cessionarios.map(c => `<div class="preview-sub-card"><p><strong>Cessionário:</strong><span>${c.nome || 'Não informado'}</span></p><p><strong>ID dos Documentos:</strong><span>${c.documentos || 'Não informado'}</span></p>${c.idProcuracao ? `<div class="info-procuracao"><p><strong>ID da Procuração:</strong><span>${c.idProcuracao}</span></p></div>` : ''}</div>`).join('')}</div></div>` : ''}
                  ${Object.values(data.bens).some(arr => Array.isArray(arr) && arr.length > 0) ? `<div class="preview-section"><h3>6. Relação de Bens, Direitos e Dívidas</h3>${bensSections.map(section => { if (data.bens[section.key] && data.bens[section.key].length > 0) { return `<h4>${section.title}</h4>${data.bens[section.key].map(item => `<div class="preview-card-small">${section.fields.map(field => `<p><strong>${field.label}:</strong> <span>${item[field.model] || 'N/A'}</span></p>`).join('')}</div>`).join('')}`; } return ''; }).join('')}</div>` : ''}
                  <div class="preview-section"><h3>7. Documentos Processuais</h3><div class="preview-card"><p><strong>Primeiras Declarações:</strong> <span>${data.documentosProcessuais.primeirasDeclaracoes.status === 'Apresentada' ? `Apresentada (ID: ${data.documentosProcessuais.primeirasDeclaracoes.id || 'N/A'})` : 'Não Apresentada'}</span></p><p><strong>Edital:</strong> <span>${getEditalStatus(data.documentosProcessuais.edital)}</span></p><p><strong>Últimas Declarações:</strong> <span>${data.documentosProcessuais.ultimasDeclaracoes.status === 'Apresentada' ? `Apresentada (ID: ${data.documentosProcessuais.ultimasDeclaracoes.id || 'N/A'})` : 'Não Apresentada'}</span></p>${data.documentosProcessuais.testamentosCensec.map(item => `<p><strong>${item.deixouTestamento ? `Testamento (${item.nomeFalecido})` : `Certidão CENSEC (${item.nomeFalecido})`}:</strong><span>${item.id ? `Apresentado (ID: ${item.id})` : 'Pendente'}</span></p>`).join('')}<p><strong>Sentença:</strong> <span>${data.documentosProcessuais.sentenca.status === 'Proferida' ? `Proferida (ID: ${data.documentosProcessuais.sentenca.id || 'N/A'})` : 'Não Proferida'}</span></p><p><strong>Trânsito em Julgado:</strong> <span>${data.documentosProcessuais.transito.status === 'Ocorrido' ? `Ocorrido (ID: ${data.documentosProcessuais.transito.id || 'N/A'})` : 'Não Ocorrido'}</span></p></div></div>
                  <div class="preview-section"><h3>8. Regularidade Tributária e Custas</h3>${data.documentacaoTributaria.map(trib => `<div class="preview-card"><p><strong>Referente a:</strong><span>${trib.nomeFalecido}</span></p><p><strong>Status ITCD:</strong><span>${trib.statusItcd}</span></p><p><strong>CND Municipal:</strong><span>${trib.cndMunicipal.status === 'Juntada' ? `Juntada (ID: ${trib.cndMunicipal.id || 'N/A'})` : 'Não Juntada'}</span></p><p><strong>CND Estadual:</strong><span>${trib.cndEstadual.status === 'Juntada' ? `Juntada (ID: ${trib.cndEstadual.id || 'N/A'})` : 'Não Juntada'}</span></p><p><strong>CND Federal:</strong><span>${trib.cndFederal.status === 'Juntada' ? `Juntada (ID: ${trib.cndFederal.id || 'N/A'})` : 'Não Juntada'}</span></p></div>`).join('')}<div class="preview-card"><p><strong>Custas Processuais:</strong><span>${getCustasStatus(data.custas)}</span></p></div></div>
                  ${data.observacoes.length > 0 ? `<div class="preview-section"><h3>9. Observações Adicionais</h3>${data.observacoes.map(obs => `<div class="preview-card"><p><strong>${obs.titulo || 'Observação'} (Relevância: ${obs.relevancia})</strong></p><p class="obs-content"><span>${obs.conteudo}</span></p></div>`).join('')}</div>` : ''}
                </div>
                <div class="preview-footer">
                    <div class="signature-area">
                        <div class="signature-line">
                            <p class="signature-name">${data.processo.responsavel.nome || '_________________________________________'}</p>
                            <p class="signature-title">${data.processo.responsavel.cargo || 'Cargo do Responsável'}</p>
                        </div>
                    </div>
                </div>
              </div>
            </body>
          </html>
        `;

        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '1.5cm', right: '1.5cm', bottom: '2cm', left: '1.5cm' },
            displayHeaderFooter: true,
            headerTemplate: '<div></div>',
            footerTemplate: `
              <div style="font-family: Arial, sans-serif; font-size: 9px; text-align: center; color: #777; width: 100%; margin: 0 1.5cm;">
                <p style="margin: 0;">Este documento foi gerado eletronicamente pelo Sistema CertidãoPRO</p>
                <p style="margin: 5px 0 0 0;">Data de Emissão: ${new Date().toLocaleDateString('pt-BR')} - Página <span class="pageNumber"></span> de <span class="totalPages"></span></p>
              </div>
            `,
        });
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Length', pdfBuffer.length);
        res.setHeader('Content-Disposition', 'attachment; filename="Certidao-PRO.pdf"');
        res.status(200).end(pdfBuffer); 
        
    } catch (error) {
        console.error('Ocorreu um erro ao gerar o PDF:', error);
        res.status(500).json({ message: 'Erro ao gerar o PDF.', error: error.message });
    } finally {
        if (browser !== null) {
            await browser.close();
        }
    }
}
