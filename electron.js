// electron.js - Arquivo principal para a aplicação desktop

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
// As dependências do puppeteer agora são usadas aqui, no backend local
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

// --- INÍCIO DAS FUNÇÕES AUXILIARES "TRANSPLANTADAS" ---

function formatDate(d) {
    if (!d) return 'Não informado';
    try {
        const dt = new Date(d + 'T00:00:00');
        return dt.toLocaleDateString('pt-BR');
    } catch (e) {
        return d;
    }
}

function getAdvogadoById(id, advogados) {
    if (!id || !advogados) return null;
    return advogados.find(a => a.id === id);
}

function getHeirNameById(id, allHeirs) {
    const find = (heirs) => {
        for (const h of heirs) {
            if (h.id === id) return h.nome;
            if (h.representantes) {
                const found = find(h.representantes);
                if (found) return found;
            }
        }
        return null;
    };
    return find(allHeirs) || 'Não encontrado';
}

function getEditalStatus(edital) {
    if (edital.determinado === 'Não') return 'Não determinada a expedição.';
    if (edital.status === 'Não Expedido') return 'Expedição pendente.';
    if (edital.prazoDecorrido === 'Não') return `Expedido (ID: ${edital.id || 'N/A'}), aguardando decurso de prazo.`;
    return `Expedido (ID: ${edital.id || 'N/A'}), prazo decorrido (ID: ${edital.idDecursoPrazo || 'N/A'}).`;
}

function getCustasStatus(custas) {
    if (custas.situacao === 'Isenção') return 'Isento de custas.';
    if (custas.situacao === 'Ao final') return 'Custas a serem pagas ao final do processo.';
    if (custas.situacao === 'Devidas') {
        const c = custas.calculada === 'Sim' ? `Calculada (ID: ${custas.idCalculo || 'N/A'})` : 'Cálculo pendente';
        const p = custas.paga === 'Sim' ? `Pagas (ID: ${custas.idPagamento || 'N/A'})` : 'Pagamento pendente';
        return `${c}, ${p}.`;
    }
    return 'Situação não informada.';
}

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
// --- LÓGICA PRINCIPAL DO ELECTRON ---

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    icon: path.join(__dirname, 'public/favicon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// --- FUNÇÃO DE GERAR PDF (COM LÓGICA TRANSPLANTADA) ---
ipcMain.handle('generate-pdf', async (event, { state, pendencies }) => {
  const { filePath } = await dialog.showSaveDialog({
    title: 'Salvar Certidão em PDF',
    defaultPath: `Certidao-${state.processo.numero || 'NOVO'}.pdf`,
    filters: [{ name: 'Arquivos PDF', extensions: ['pdf'] }]
  });

  if (!filePath) {
    return { success: false, message: 'Operação cancelada pelo usuário.' };
  }

  try {
    
    const css = `
        /* COLE AQUI EXATAMENTE O MESMO CSS GIGANTE DO SEU generate-pdf.js */
        :root { --primary-color: #2c3e50; /* ... etc ... */ }
        body { font-family: var(--font-serif); /* ... etc ... */ }
        /* ... todo o resto do seu CSS ... */
    `;

    const herdeirosValidos = state.herdeiros.filter(h => h.nome && h.nome.trim() !== '');
    const hasBens = Object.values(state.bens).some(arr => Array.isArray(arr) && arr.length > 0);
    const hasIncapaz = herdeirosValidos.some(h => h.estado === 'Incapaz' || (h.representantes && h.representantes.some(r => r.estado === 'Incapaz')));

    let sectionCounter = 0;
    let htmlSections = '';
    
    // TODA A LÓGICA DE `if (state.processo.numero) { ... }`, `if (state.falecidos.length > 0) { ... }` VEM AQUI
    // SUBSTITUINDO 'data.' POR 'state.'
    // Exemplo:
    if (state.processo.numero) {
        sectionCounter++;
        htmlSections += `<div class="preview-section"><h3>${sectionCounter}. Dados do Processo</h3><div class="preview-card"><p><strong>Número:</strong><span>${state.processo.numero}</span></p>${state.processo.cumulativo ? `<p><strong>Tipo:</strong><span>Inventário Cumulativo</span></p>` : ''}${state.processo.advogados.length > 0 ? `<div class="info-advogado" style="margin-top: 1rem;"><p style="margin:0;"><strong>Advogados:</strong></p><ul style="list-style: none; padding-left: 10px; margin-top: 5px;">${state.processo.advogados.map(adv => `<li>- ${adv.nome} (OAB: ${adv.oab})</li>`).join('')}</ul></div>` : ''}</div></div>`;
    }
    // ... continue com todas as outras seções (falecidos, herdeiros, bens, etc.) ...
     if (state.falecidos.length > 0) {
            sectionCounter++;
            htmlSections += `<div class="preview-section"><h3>${sectionCounter}. De Cujus</h3>${state.falecidos.map(f => `<div class="preview-card"><p><strong>Nome:</strong><span>${f.nome}</span></p><p><strong>Data do Óbito:</strong><span>${formatDate(f.dataFalecimento)}</span></p><p><strong>Docs. Pessoais (ID):</strong><span>${f.documentos || 'Não informado'}</span></p><p><strong>Cert. Óbito (ID):</strong><span>${f.idCertidaoObito || 'Não informado'}</span></p></div>`).join('')}</div>`;
        }
        if (state.inventariante.nome || herdeirosValidos.length > 0) {
            sectionCounter++;
            const inventarianteAdvogado = getAdvogadoById(state.inventariante.advogadoId, state.processo.advogados);
            htmlSections += `<div class="preview-section"><h3>${sectionCounter}. Inventariante, Herdeiros e Sucessores</h3>${state.inventariante.nome ? `<div class="preview-card"><h4>Inventariante</h4><p><strong>Nome:</strong><span>${state.inventariante.nome}</span></p><p><strong>Parentesco:</strong><span>${state.inventariante.parentesco || 'Não informado'}</span></p><p><strong>Docs. Pessoais (ID):</strong><span>${state.inventariante.documentos || 'Não informado'}</span></p><p><strong>Termo de Comp. (ID):</strong><span>${state.inventariante.idTermoCompromisso || 'Não informado'}</span></p>${state.inventariante.idProcuracao ? `<div class="info-procuracao"><p><strong>Procuração (ID):</strong><span>${state.inventariante.idProcuracao}</span></p></div>` : ''}${inventarianteAdvogado ? `<div class="info-advogado"><p><strong>Advogado(a):</strong><span>${inventarianteAdvogado.nome} (OAB: ${inventarianteAdvogado.oab})</span></p></div>` : ''}</div>` : ''}${generateHeirsHtml(herdeirosValidos, state.processo.advogados)}</div>`;
        }
        if (state.renuncia.houveRenuncia && state.renuncia.renunciantes.length > 0) {
            sectionCounter++;
            htmlSections += `<div class="preview-section"><h3>${sectionCounter}. Renúncia de Direitos</h3>${state.renuncia.renunciantes.map(r => `<div class="preview-card"><p><strong>Renunciante:</strong><span>${getHeirNameById(r.herdeiroId, herdeirosValidos)}</span></p><p><strong>Tipo:</strong><span>${r.tipo}</span></p><p><strong>Escritura/Termo (ID):</strong><span>${r.idEscritura || 'Não informado'}</span></p></div>`).join('')}</div>`;
        }
        if (state.cessao.houveCessao && state.cessao.cessionarios.length > 0) {
            sectionCounter++;
            const cessionariosHtml = state.cessao.cessionarios.map(c => {
                const advogado = getAdvogadoById(c.advogadoId, state.processo.advogados);
                return `<div class="preview-sub-card"><p><strong>Cessionário:</strong><span>${c.nome || 'Não informado'}</span></p><p><strong>Docs. Pessoais (ID):</strong><span>${c.documentos || 'Não informado'}</span></p>${c.idProcuracao ? `<div class="info-procuracao"><p><strong>Procuração (ID):</strong><span>${c.idProcuracao}</span></p></div>` : ''}${advogado ? `<div class="info-advogado"><p><strong>Advogado(a):</strong><span>${advogado.nome} (OAB: ${advogado.oab})</span></p></div>` : ''}</div>`;
            }).join('');
            htmlSections += `<div class="preview-section"><h3>${sectionCounter}. Cessão de Direitos</h3><div class="preview-card"><p><strong>Escritura de Cessão (ID):</strong><span>${state.cessao.idEscritura || 'Não informado'}</span></p>${cessionariosHtml}</div></div>`;
        }
        if (hasBens) {
            sectionCounter++;
            htmlSections += `<div class="preview-section"><h3>${sectionCounter}. Relação de Bens, Direitos e Dívidas</h3>
                ${state.bens.imoveis.length > 0 ? `<h4>Bens Imóveis</h4>${state.bens.imoveis.map(item => `<div class="preview-card-small"><p><strong>Descrição:</strong> <span>${item.descricao || 'N/A'} (Matrícula: ${item.matricula || 'N/A'})</span></p><p><strong>ID da Matrícula:</strong> <span>${item.idMatricula || 'Pendente'}</span></p>${item.tipo === 'Urbano' && item.iptu.determinado ? `<p><strong>IPTU:</strong> <span>${ item.iptu.id ? `Juntado (ID: ${item.iptu.id})` : 'Pendente' }</span></p>` : ''}${item.tipo === 'Rural' ? `${ item.itr.determinado ? `<p><strong>ITR:</strong> <span>${ item.itr.id ? `Juntado (ID: ${item.itr.id})` : 'Pendente' }</span></p>` : ''}${ item.ccir.determinado ? `<p><strong>CCIR:</strong> <span>${ item.ccir.id ? `Juntado (ID: ${item.ccir.id})` : 'Pendente' }</span></p>` : ''}${ item.car.determinado ? `<p><strong>CAR:</strong> <span>${ item.car.id ? `Juntado (ID: ${item.car.id})` : 'Pendente' }</span></p>` : ''}` : ''}${hasIncapaz && !item.avaliado ? `<p class="warning-text"><strong>Avaliação Judicial:</strong> <span>Pendente</span></p>` : ''}${hasIncapaz && item.avaliado ? `<p class="success-text"><strong>Avaliação Judicial:</strong> <span>Realizada (ID: ${item.idAvaliacao || 'Pendente'})</span></p>`: ''}</div>`).join('')}` : ''}
                ${state.bens.veiculos.length > 0 ? `<h4>Veículos</h4>${state.bens.veiculos.map(item => `<div class="preview-card-small"><p><strong>Descrição:</strong> <span>${item.descricao || 'N/A'}</span></p><p><strong>Placa:</strong> <span>${item.placa || 'N/A'}</span></p><p><strong>Renavam:</strong> <span>${item.renavam || 'N/A'}</span></p><p><strong>ID do CRLV:</strong> <span>${item.idCRLV || 'Pendente'}</span></p>${hasIncapaz && !item.avaliado ? `<p class="warning-text"><strong>Avaliação Judicial:</strong> <span>Pendente</span></p>` : ''}${hasIncapaz && item.avaliado ? `<p class="success-text"><strong>Avaliação Judicial:</strong> <span>Realizada (ID: ${item.idAvaliacao || 'Pendente'})</span></p>`: ''}</div>`).join('')}` : ''}
                ${state.bens.semoventes.length > 0 ? `<h4>Semoventes</h4>${state.bens.semoventes.map(item => `<div class="preview-card-small"><p><strong>Descrição:</strong><span>${item.descricao}</span></p><p><strong>Doc. (ID):</strong><span>${item.idDocumento || 'Pendente'}</span></p>${hasIncapaz && !item.avaliado ? `<p class="warning-text"><strong>Avaliação Judicial:</strong> <span>Pendente</span></p>` : ''}${hasIncapaz && item.avaliado ? `<p class="success-text"><strong>Avaliação Judicial:</strong> <span>Realizada (ID: ${item.idAvaliacao || 'Pendente'})</span></p>`: ''}</div>`).join('')}`: ''}
                ${state.bens.valoresResiduais.length > 0 ? `<h4>Valores Residuais</h4>${state.bens.valoresResiduais.map(item => `<div class="preview-card-small"><p><strong>Tipo:</strong><span>${item.tipo}</span></p><p><strong>Instituição:</strong><span>${item.instituicao || 'N/A'}</span></p><p><strong>Valor (R$):</strong><span>${item.valor || 'N/A'}</span></p><p><strong>Doc. (ID):</strong><span>${item.idDocumento || 'Pendente'}</span></p></div>`).join('')}`: ''}
                ${state.bens.dividas.length > 0 ? `<h4>Dívidas do Espólio</h4>${state.bens.dividas.map(item => `<div class="preview-card-small"><p><strong>Credor:</strong><span>${item.credor}</span></p><p><strong>Tipo:</strong><span>${item.tipo}</span></p><p><strong>Valor (R$):</strong><span>${item.valor}</span></p><p><strong>Doc. (ID):</strong><span>${item.idDocumento || 'Pendente'}</span></p></div>`).join('')}`: ''}
                ${state.bens.houvePedidoAlvara && state.bens.alvaras.length > 0 ? `<h4>Alvarás</h4>${state.bens.alvaras.map(item => `<div class="preview-card-small"><p><strong>Finalidade:</strong><span>${item.finalidade}</span></p><p><strong>Requerimento:</strong><span>${item.idRequerimento ? `ID: ${item.idRequerimento}`:'Não requerido'}</span></p>${item.idRequerimento ? `<p><strong>Status:</strong><span>${item.statusDeferimento}</span></p>`:''}${item.statusDeferimento === 'Deferido' ? `<p><strong>Expedição:</strong><span>${item.idExpedicao || 'Pendente'}</span></p>`:''}${item.idExpedicao ? `<p><strong>Prestou Contas:</strong><span>${item.prestouContas}</span></p>`:''}</div>`).join('')}`: ''}
            </div>`;
        }
        sectionCounter++;
        htmlSections += `<div class="preview-section"><h3>${sectionCounter}. Documentos Processuais</h3><div class="preview-card"><p><strong>Primeiras Declarações:</strong> <span>${state.documentosProcessuais.primeirasDeclaracoes.status === 'Apresentada' ? `Apresentada (ID: ${state.documentosProcessuais.primeirasDeclaracoes.id || 'N/A'})` : 'Não Apresentada'}</span></p>${state.documentosProcessuais.testamentosCensec.map(item => `<p><strong>${item.deixouTestamento ? `Testamento (${item.nomeFalecido})` : `Certidão CENSEC (${item.nomeFalecido})`}:</strong><span>${item.id ? `Apresentado (ID: ${item.id})` : 'Pendente'}</span></p>`).join('')}<p><strong>Edital:</strong> <span>${getEditalStatus(state.documentosProcessuais.edital)}</span></p><p><strong>Últimas Declarações:</strong> <span>${state.documentosProcessuais.ultimasDeclaracoes.status === 'Apresentada' ? `Apresentada (ID: ${state.documentosProcessuais.ultimasDeclaracoes.id || 'N/A'})` : 'Não Apresentada'}</span></p>${hasIncapaz ? `<p><strong>Manifestação do MP:</strong> <span>${state.documentosProcessuais.manifestacaoMP.status === 'Manifestado' ? `Manifestado (ID: ${state.documentosProcessuais.manifestacaoMP.id || 'N/A'})` : 'Pendente'}</span></p>` : ''}<p><strong>Sentença:</strong> <span>${state.documentosProcessuais.sentenca.status === 'Proferida' ? `Proferida (ID: ${state.documentosProcessuais.sentenca.id || 'N/A'})` : 'Não Proferida'}</span></p><p><strong>Trânsito em Julgado:</strong> <span>${state.documentosProcessuais.transito.status === 'Ocorrido' ? `Ocorrido (ID: ${state.documentosProcessuais.transito.id || 'N/A'})` : 'Não Ocorrido'}</span></p></div></div>`;
        
        if (state.documentacaoTributaria.length > 0 || (state.custas && state.custas.situacao)) {
            sectionCounter++;
            htmlSections += `<div class="preview-section"><h3>${sectionCounter}. Regularidade Tributária e Custas</h3>
            ${state.documentacaoTributaria.map(trib => `<div class="preview-card"><h4>Tributos de: <strong>${trib.nomeFalecido}</strong></h4><p><strong>Status ITCD:</strong><span>${trib.statusItcd}</span></p><p><strong>CND Municipal:</strong><span>${trib.cndMunicipal.status === 'Juntada' ? `Juntada (ID: ${trib.cndMunicipal.id || 'N/A'})` : 'Não Juntada'}</span></p><p><strong>CND Estadual:</strong><span>${trib.cndEstadual.status === 'Juntada' ? `Juntada (ID: ${trib.cndEstadual.id || 'N/A'})` : 'Não Juntada'}</span></p><p><strong>CND Federal:</strong><span>${trib.cndFederal.status === 'Juntada' ? `Juntada (ID: ${trib.cndFederal.id || 'N/A'})` : 'Não Juntada'}</span></p></div>`).join('')}
            ${state.custas ? `<div class="preview-card"><h4>Custas Processuais</h4><p><strong>Situação:</strong><span>${getCustasStatus(state.custas)}</span></p></div>` : ''}
            </div>`;
        }
        if (state.observacoes.length > 0) {
          sectionCounter++;
          htmlSections += `<div class="preview-section"><h3>${sectionCounter}. Observações Adicionais</h3>${state.observacoes.map(obs => `<div class="preview-card obs-${obs.relevancia.toLowerCase()}"><p><strong>${obs.titulo || 'Observação'}</strong></p><p class="obs-content"><span>${obs.conteudo}</span></p></div>`).join('')}</div>`;
        }


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
                        <div class="header-text"><p>PODER JUDICIÁRIO DO ESTADO DE MINAS GERAIS</p><p class="comarca">VARA ÚNICA DA COMARCA DE NOVA RESENDE/MG</p></div>
                        <h1>CERTIDÃO DE REGULARIDADE</h1><h2 class="subtitle">INVENTÁRIO</h2>
                    </div>
                    <div class="preview-content">
                        ${pendencies && pendencies.length > 0 ? `<div class="preview-section pendencies-section"><h3>PENDÊNCIAS</h3><ul class="pendencies-list">${pendencies.map(p => `<li>${p}</li>`).join('')}</ul></div>` : ''}
                        ${htmlSections}
                    </div>
                    <div class="main-footer">
                        <div class="signature-line">
                            <p class="signature-name">${state.processo.responsavel.nome || '________________________________'}</p>
                            <p class="signature-title">${state.processo.responsavel.cargo || 'Cargo do Responsável'}</p>
                        </div>
                    </div>
                </div>
            </body>
        </html>`;

    const browser = await puppeteer.launch({
        executablePath: await chromium.executablePath(),
        headless: true
    });
    const page = await browser.newPage();
    await page.setContent(finalHtml, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '2cm', right: '1.5cm', bottom: '2cm', left: '1.5cm' },
      displayHeaderFooter: true,
      footerTemplate: footerTemplate
    });
    await browser.close();

    fs.writeFileSync(filePath, pdfBuffer);

    return { success: true, filePath };

  } catch (error) {
    console.error('Erro ao gerar o PDF localmente:', error);
    return { success: false, message: error.message };
  }
});
