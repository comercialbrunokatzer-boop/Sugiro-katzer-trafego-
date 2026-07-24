/**
 * Google Apps Script — cole na planilha Katzer (Extensões → Apps Script).
 * Publique como Web App (executar como: eu · acesso: qualquer pessoa).
 * Cole a URL em Netlify env: GARIMPO_SHEETS_WEBHOOK
 *
 * Aba esperada: GARIMPO
 * Colunas: A Data | B Hora | C Responsável | D Quantidade | E Nome Cliente | F Telefone
 */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sh = ss.getSheetByName('GARIMPO');
    if (!sh) sh = ss.insertSheet('GARIMPO');
    if (sh.getLastRow() === 0) {
      sh.appendRow(['Data', 'Hora', 'Responsável', 'Quantidade', 'Nome Cliente', 'Telefone']);
    }
    const rows = body.rows || [];
    rows.forEach(function (r) {
      sh.appendRow([
        r.data || '',
        r.hora || '',
        r.responsavel || 'Michel',
        r.quantidade || '',
        r.nomeCliente || '',
        r.telefone || '',
      ]);
    });
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, n: rows.length }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, erro: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
