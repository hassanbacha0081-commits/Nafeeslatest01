import { db, type PrintedTag, type SalesItem, type StockItem } from '../db';

export function normalizeItemName(name: string): string {
  return (name || '')
    .trim()
    .replace(/\s*#\d+$/, '')
    .trim()
    .toLowerCase();
}

export function findMatchingStockItem(
  allStocks: StockItem[],
  item: { name: string; stockItemId?: number | null }
): StockItem | undefined {
  if (item.stockItemId) {
    const byId = allStocks.find(s => s.id === item.stockItemId);
    if (byId) return byId;
  }

  const rawLower = (item.name || '').trim().toLowerCase();
  if (!rawLower) return undefined;

  const exact = allStocks.find(s => (s.name || '').trim().toLowerCase() === rawLower);
  if (exact) return exact;

  const baseLower = normalizeItemName(item.name);
  if (!baseLower) return undefined;

  return allStocks.find(s => normalizeItemName(s.name) === baseLower);
}

export interface StockSyncResult {
  deducted: Array<{ name: string; remainingQty: number; remainingPieces: number; unit: string }>;
  soldTagCodes: string[];
}

export async function applySaleStockAndTagUpdates(
  items: SalesItem[],
  saleId: number
): Promise<StockSyncResult> {
  const deducted: StockSyncResult['deducted'] = [];
  const soldTagCodes: string[] = [];

  try {
    const allStocks = await db.stock.toArray();
    const allTags = db.printedTags ? await db.printedTags.toArray() : [];

    for (const item of items) {
      const isOldGold = item.t < 0;

      // 1. Mark matching PrintedTag as Sold
      if (!isOldGold && db.printedTags) {
        let matchedTag: PrintedTag | undefined;
        if (item.printedTagId) {
          matchedTag = allTags.find(t => t.id === item.printedTagId);
        }
        if (!matchedTag && item.tagCode) {
          const upper = item.tagCode.trim().toUpperCase();
          matchedTag = allTags.find(t => t.tagCode.trim().toUpperCase() === upper);
        }
        if (matchedTag && matchedTag.id) {
          await db.printedTags.update(matchedTag.id, {
            status: 'sold',
            soldAt: new Date().toISOString(),
            saleId,
          });
          matchedTag.status = 'sold';
          matchedTag.saleId = saleId;
          soldTagCodes.push(matchedTag.tagCode);
        }
      }

      // 2. Deduct (or add back for old gold) in Stock
      const targetStock = findMatchingStockItem(allStocks, {
        name: item.n,
        stockItemId: item.stockItemId,
      });

      if (targetStock && targetStock.id) {
        const piecesSold = item.p || 1;
        if (targetStock.type === 'Item') {
          const pieceDiff = isOldGold ? piecesSold : -piecesSold;
          const newQty = Math.max(0, Number((targetStock.quantity + pieceDiff).toFixed(3)));
          const newPieces = Math.max(0, (targetStock.pieces ?? targetStock.quantity) + pieceDiff);
          await db.stock.update(targetStock.id, {
            quantity: newQty,
            pieces: newPieces,
          });
          targetStock.quantity = newQty;
          targetStock.pieces = newPieces;
          deducted.push({
            name: targetStock.name,
            remainingQty: newQty,
            remainingPieces: newPieces,
            unit: targetStock.unit || 'pcs',
          });
        } else {
          // Gold weight stock (grams) + optional pieces
          const weightDiff = isOldGold ? item.w : -item.w;
          const pieceDiff = isOldGold ? (item.p || 0) : -(item.p || 1);
          const newQty = Math.max(0, Number((targetStock.quantity + weightDiff).toFixed(3)));
          const newPieces = Math.max(0, (targetStock.pieces || 0) + pieceDiff);
          await db.stock.update(targetStock.id, {
            quantity: newQty,
            pieces: newPieces,
          });
          targetStock.quantity = newQty;
          targetStock.pieces = newPieces;
          deducted.push({
            name: targetStock.name,
            remainingQty: newQty,
            remainingPieces: newPieces,
            unit: targetStock.unit || 'g',
          });
        }
      }
    }
  } catch (err) {
    console.error('applySaleStockAndTagUpdates error:', err);
  }

  return { deducted, soldTagCodes };
}

export async function revertSaleStockAndTagUpdates(
  items: SalesItem[],
  saleId?: number
): Promise<void> {
  try {
    const allStocks = await db.stock.toArray();

    for (const item of items) {
      const isOldGold = item.t < 0;
      const targetStock = findMatchingStockItem(allStocks, {
        name: item.n,
        stockItemId: item.stockItemId,
      });

      if (targetStock && targetStock.id) {
        const piecesSold = item.p || 1;
        if (targetStock.type === 'Item') {
          const pieceDiff = isOldGold ? -piecesSold : piecesSold;
          const newQty = Math.max(0, Number((targetStock.quantity + pieceDiff).toFixed(3)));
          const newPieces = Math.max(0, (targetStock.pieces ?? targetStock.quantity) + pieceDiff);
          await db.stock.update(targetStock.id, {
            quantity: newQty,
            pieces: newPieces,
          });
          targetStock.quantity = newQty;
          targetStock.pieces = newPieces;
        } else {
          const weightDiff = isOldGold ? -item.w : item.w;
          const pieceDiff = isOldGold ? -(item.p || 0) : (item.p || 1);
          const newQty = Math.max(0, Number((targetStock.quantity + weightDiff).toFixed(3)));
          const newPieces = Math.max(0, (targetStock.pieces || 0) + pieceDiff);
          await db.stock.update(targetStock.id, {
            quantity: newQty,
            pieces: newPieces,
          });
          targetStock.quantity = newQty;
          targetStock.pieces = newPieces;
        }
      }
    }

    // Re-open any PrintedTags tied to this sale
    if (db.printedTags) {
      if (saleId) {
        const tagsBySale = await db.printedTags.where('saleId').equals(saleId).toArray();
        for (const tag of tagsBySale) {
          if (tag.id) {
            await db.printedTags.update(tag.id, {
              status: 'available',
              soldAt: undefined,
              saleId: undefined,
            });
          }
        }
      }

      for (const item of items) {
        if (item.printedTagId) {
          await db.printedTags.update(item.printedTagId, {
            status: 'available',
            soldAt: undefined,
            saleId: undefined,
          });
        }
      }
    }
  } catch (err) {
    console.error('revertSaleStockAndTagUpdates error:', err);
  }
}
