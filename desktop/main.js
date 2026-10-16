'use strict';

/* ============================================================
   COTA — desktop/main.js
   Aplicativo desktop (Electron) do COTA — Formação CNC
   Janela dedicada, menu profissional e funcionamento offline.
   ============================================================ */

const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('path');

const APP_TITLE = 'COTA — do desenho à peça pronta';

function createWindow() {
    const win = new BrowserWindow({
        width: 1360,
        height: 900,
        minWidth: 980,
        minHeight: 640,
        title: APP_TITLE,
        icon: path.join(__dirname, '..', 'assets', 'icon.png'),
        backgroundColor: '#0B1017',
        show: false,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            spellcheck: true
        }
    });

    win.loadFile(path.join(__dirname, '..', 'index.html'));
    win.once('ready-to-show', () => win.show());

    // links externos abrem no navegador do sistema
    win.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('http')) shell.openExternal(url);
        return { action: 'deny' };
    });
}

function buildMenu() {
    const template = [
        {
            label: 'Arquivo',
            submenu: [
                {
                    label: 'Imprimir…',
                    accelerator: 'CmdOrCtrl+P',
                    click: (item, win) => { if (win) win.webContents.print({ silent: false }); }
                },
                { type: 'separator' },
                { label: 'Sair', role: 'quit' }
            ]
        },
        {
            label: 'Exibir',
            submenu: [
                { label: 'Recarregar', role: 'reload' },
                { type: 'separator' },
                { label: 'Ampliar', role: 'zoomIn' },
                { label: 'Reduzir', role: 'zoomOut' },
                { label: 'Tamanho padrão', role: 'resetZoom' },
                { type: 'separator' },
                { label: 'Tela cheia', role: 'togglefullscreen' }
            ]
        },
        {
            label: 'Ferramentas',
            submenu: [
                { label: 'Ferramentas do desenvolvedor', role: 'toggleDevTools' }
            ]
        },
        {
            label: 'Ajuda',
            submenu: [
                {
                    label: 'Sobre o COTA',
                    click: () => {
                        dialog.showMessageBox({
                            type: 'info',
                            title: 'Sobre o COTA',
                            message: 'COTA — do desenho à peça pronta',
                            detail: 'Versão ' + app.getVersion() + '\n' +
                                'Formação em CAD + CNC: 10 exemplos de usinagem com código ISO e paramétrico,\n' +
                                'trilha de 64h, kit de fichas de avaliação e certificado de conclusão.\n\n' +
                                '© 2026 COTA Formação',
                            buttons: ['Fechar'],
                            icon: path.join(__dirname, '..', 'assets', 'icon.png')
                        });
                    }
                }
            ]
        }
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
    buildMenu();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
