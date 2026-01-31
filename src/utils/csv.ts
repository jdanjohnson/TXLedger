import { NormalizedTransaction, AwakenCsvRow } from '../types';

export const formatDateForAwaken = (isoDate: string): string => {
  const date = new Date(isoDate);
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const year = date.getUTCFullYear();
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${month}/${day}/${year} ${hours}:${minutes}:${seconds}`;
};

export const transactionToAwakenRow = (tx: NormalizedTransaction): AwakenCsvRow => {
  return {
    Date: formatDateForAwaken(tx.datetimeUtc),
    Asset: tx.asset,
    Amount: tx.amount,
    Fee: tx.fee,
    'P&L': tx.pnl || '0',
    'Payment Token': tx.feeAsset,
    ID: tx.hash.slice(0, 16),
    Notes: tx.notes || `${tx.type} - ${tx.direction}`,
    Tag: tx.tag || '',
    'Transaction Hash': tx.hash,
  };
};

export const generateAwakenCsv = (transactions: NormalizedTransaction[]): string => {
  const headers = [
    'Date',
    'Asset',
    'Amount',
    'Fee',
    'P&L',
    'Payment Token',
    'ID',
    'Notes',
    'Tag',
    'Transaction Hash',
  ];

  const rows = transactions.map(tx => {
    const row = transactionToAwakenRow(tx);
    return headers.map(header => {
      const value = row[header as keyof AwakenCsvRow] || '';
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',');
  });

  return [headers.join(','), ...rows].join('\n');
};

export const downloadCsv = (content: string, filename: string): void => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
