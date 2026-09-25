import { describe, expect, it } from 'vitest';
import { normalizeDownloadFilename } from './fileSave';

describe('normalizeDownloadFilename', () => {
  it('adds the extension when missing', () => {
    expect(normalizeDownloadFilename('report', '.pdf', 'document')).toBe('report.pdf');
  });

  it('keeps an existing extension regardless of case', () => {
    expect(normalizeDownloadFilename('Report.PDF', '.pdf', 'document')).toBe('Report.PDF');
  });

  it('accepts an extension without a leading dot', () => {
    expect(normalizeDownloadFilename('images', 'zip', 'download')).toBe('images.zip');
  });

  it('drops directory parts', () => {
    expect(normalizeDownloadFilename('../secret/plan.pdf', '.pdf', 'document')).toBe('plan.pdf');
    expect(normalizeDownloadFilename('C:\\Users\\me\\plan.pdf', '.pdf', 'document')).toBe('plan.pdf');
  });

  it('replaces characters that are invalid in file names', () => {
    expect(normalizeDownloadFilename('a<b>:c"d|e?f*\u0001', '.pdf', 'document'))
      .toBe('a_b__c_d_e_f__.pdf');
  });

  it('removes trailing dots and spaces', () => {
    expect(normalizeDownloadFilename('notes. . ', '.pdf', 'document')).toBe('notes.pdf');
  });

  it('falls back when nothing usable is left', () => {
    expect(normalizeDownloadFilename('   ', '.pdf', 'document')).toBe('document.pdf');
    expect(normalizeDownloadFilename('.pdf', '.pdf', 'document')).toBe('document.pdf');
  });

  it('keeps Chinese file names', () => {
    expect(normalizeDownloadFilename('合約 最終版', '.pdf', 'document')).toBe('合約 最終版.pdf');
  });
});
