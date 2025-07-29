const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

// Função para criar a janela principal
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      // Para segurança, idealmente usaríamos um 'preload.js',
      // mas para simplificar, vamos começar assim.
      nodeIntegration: true,
      contextIsolation: false,
    }
  });

  // Carrega o resultado do 'build' do seu app Vue
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

// AQUI VAI A LÓGICA DE GERAR PDF (adaptada)
ipcMain.handle('generate-pdf', async (event, data) => {
    // A lógica do seu antigo 'generate-pdf.js' viria aqui.
    // Ele usaria o puppeteer para gerar o PDF e salvá-lo localmente.
    // Por enquanto, isso é um placeholder.
    console.log("Recebido pedido para gerar PDF com os dados:", data);
    // Retorna um caminho fictício por enquanto
    return { success: true, filePath: 'C:/Users/SeuUsuario/Documents/Certidao.pdf' };
});
