// api/generate-pdf.js - VERSÃO COM LOGS DE DEPURAÇÃO

import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import fs from 'fs/promises';
import path from 'path';

// --- SUAS FUNÇÕES AUXILIARES (NÃO MUDARAM) ---
function formatDate(dateString) { if (!dateString) return 'Não informado'; try { const date = new Date(dateString + 'T00:00:00'); if (isNaN(date.getTime())) return dateString; return date.toLocaleDateString('pt-BR'); } catch (e) { return dateString; } }
function getHeirNameById(heirId, allHeirs) { const findHeir = (heirs) => { for (const heir of heirs) { if (heir.id === heirId) return heir.nome; if (heir.representantes && heir.representantes.length > 0) { const found = findHeir(heir.representantes); if (found) return found; } } return null; }; return findHeir(allHeirs) || 'Herdeiro não encontrado'; }
function generateHeirsHtml(heirs, level = 0) { if (!heirs || heirs.length === 0) return ''; return heirs.map(h => `<div class="preview-card" style="margin-left: ${level * 20}px;"><p><strong>${h.isMeeiro ? 'Meeiro(a):' : (level > 0 ? 'Representante:' : 'Herdeiro(a):')}</strong><span>${h.nome || 'Não informado'} ${h.parentesco ? `(${h.parentesco})` : ''}</span></p><p><strong>Condição:</strong> <span>${h.estado || 'Não informado'}</span></p><p><strong>Documentos Pessoais:</strong> <span>${h.documentos || 'Não informado'}</span></p>${h.idProcuracao ? `<div class="info-procuracao"><p><strong>Procuração (ID):</strong> <span>${h.idProcuracao}</span></p></div>` : ''}${h.estado === 'Incapaz' ? `<div class="preview-sub-card warning"><p><strong>Curador(a):</strong> <span>${h.curador.nome || 'Não informado'}</span></p><p><strong>Termo de Curador (ID):</strong> <span>${h.curador.idTermo || 'Não informado'}</span></p></div>` : ''}${(h.estadoCivil === 'Casado(a)' || h.estadoCivil === 'União Estável') ? `<div class="preview-sub-card spouse"><p><strong>Cônjuge/Comp.:</strong> <span>${h.conjuge.nome || 'Não informado'}</span></p><p><strong>Regime de Bens:</strong> <span>${h.conjuge.regimeDeBens || 'Não informado'}</span></p></div>` : ''}${(h.estado === 'Falecido' && h.representantes && h.representantes.length > 0) ? `<div class="preview-sub-card danger"><p><strong>Certidão de Óbito (ID):</strong> <span>${h.idCertidaoObito || 'Não informado'}</span></p><p><strong>Sucessão de Herdeiro Falecido:</strong></p>${generateHeirsHtml(h.representantes, level + 1)}</div>` : ''}</div>`).join(''); }
function getEditalStatus(edital) { if (edital.determinado === 'Não') return 'Não determinada a expedição.'; if (edital.status === 'Não Expedido') return 'Expedição pendente.'; if (edital.prazoDecorrido === 'Não') return `Expedido (ID: ${edital.id || 'N/A'}), aguardando decurso de prazo.`; return `Expedido (ID: ${edital.id || 'N/A'}), prazo decorrido (ID: ${edital.idDecursoPrazo || 'N/A'}).`; }
function getCustasStatus(custas) { if (custas.situacao === 'Isenção') return 'Isento de custas.'; if (custas.situacao === 'Ao final') return 'Custas a serem pagas ao final do processo.'; if (custas.situacao === 'Devidas') { const calculo = custas.calculada === 'Sim' ? `Calculada (ID: ${custas.idCalculo || 'N/A'})` : 'Cálculo pendente'; const pagamento = custas.paga === 'Sim' ? `Pagas (ID: ${custas.idPagamento || 'N/A'})` : 'Pagamento pendente'; return `${calculo}, ${pagamento}.`; } return 'Situação não informada.'; }


export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    let browser = null;
    try {
        // --- LOG DE DEPURAÇÃO 1: VERIFICAR DADOS RECEBIDOS ---
        console.log("Corpo da Requisição Recebido:", JSON.stringify(req.body, null, 2));

        const { state: data, bensSections, pendencies } = req.body;

        // --- LOG DE DEPURAÇÃO 2: VERIFICAR CAMINHO E LEITURA DO CSS ---
        let css = '';
        try {
            const cssPath = path.join(process.cwd(), 'src', 'assets', 'main.css');
            console.log("Tentando ler o arquivo CSS do caminho:", cssPath);
            css = await fs.readFile(cssPath, 'utf8');
            console.log("Arquivo CSS lido com sucesso! Tamanho:", css.length, "caracteres.");
        } catch (cssError) {
            console.error("ERRO CRÍTICO: Não foi possível ler o arquivo CSS.", cssError);
            // Mesmo com erro de CSS, vamos tentar gerar o PDF sem estilo
        }

        browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
        });

        const page = await browser.newPage();
        
        // --- LOG DE DEPURAÇÃO 3: VERIFICAR O HTML ANTES DE GERAR ---
        const htmlContent = `...`; // Seu HTML completo aqui...
        // COLE AQUI SEU BLOCO GIGANTE DE `htmlContent` que está no seu arquivo atual
        
        console.log("HTML gerado, prestes a criar o PDF. Tamanho do HTML:", htmlContent.length, "caracteres.");

        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' } });
        
        res.setHeader('Content-Type', 'application/pdf');
        res.status(200).send(pdfBuffer);
        
        console.log('PDF gerado e enviado com sucesso!');

    } catch (error) {
        console.error('Ocorreu um erro ao gerar o PDF:', error);
        res.status(500).json({ message: 'Erro ao gerar o PDF.', error: error.message });
    } finally {
        if (browser !== null) {
            await browser.close();
        }
    }
}