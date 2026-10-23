import type { Response } from 'express';
import type { Request } from 'express';
import { PaymentTransaction, type PaymentStatus } from '../../models/PaymentTransaction';

const STATUSES: PaymentStatus[] = ['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED'];

function parseDate(value: unknown): Date | undefined | null {
  if (typeof value !== 'string' || !value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Paginated admin ledger plus period totals, grouped by currency to avoid
 * adding amounts that have different units together. */
export async function listAdminTransactions(req: Request, res: Response) {
  const from = parseDate(req.query.from);
  const to = parseDate(req.query.to);
  const status = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : 'ALL';
  const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit || '25'), 10) || 25));

  if (from === null || to === null || (from && to && from > to)) {
    return res.status(400).json({ success: false, message: 'Période invalide.' });
  }
  if (status !== 'ALL' && !STATUSES.includes(status as PaymentStatus)) {
    return res.status(400).json({ success: false, message: 'Statut de paiement invalide.' });
  }

  const period: { $gte?: Date; $lte?: Date } = {};
  if (from) period.$gte = from;
  if (to) period.$lte = to;
  const periodMatch = Object.keys(period).length ? { createdAt: period } : {};
  const query: {
    createdAt?: { $gte?: Date; $lte?: Date };
    status?: PaymentStatus;
  } = {};
  if (from || to) query.createdAt = period;
  if (status !== 'ALL') query.status = status as PaymentStatus;

  try {
    const [items, total, summary] = await Promise.all([
      PaymentTransaction.find(query)
        .select('-msisdn -checkoutUrl -instructions -idempotencyKey -lastError')
        .populate('userId', 'username email')
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      PaymentTransaction.countDocuments(query),
      PaymentTransaction.aggregate([
        { $match: periodMatch },
        {
          $facet: {
            totalsByCurrency: [
              { $match: { status: 'SUCCESS' } },
              { $group: { _id: '$currency', amount: { $sum: '$amount' }, count: { $sum: 1 } } },
              { $sort: { _id: 1 } },
            ],
            statusCounts: [
              { $group: { _id: '$status', count: { $sum: 1 } } },
            ],
            daily: [
              { $match: { status: 'SUCCESS' } },
              {
                $group: {
                  _id: { day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Africa/Douala' } }, currency: '$currency' },
                  amount: { $sum: '$amount' },
                },
              },
              { $sort: { '_id.day': 1 } },
            ],
          },
        },
      ]),
    ]);

    const buckets = summary[0] || { totalsByCurrency: [], statusCounts: [], daily: [] };
    const statusCounts: Record<string, number> = { PENDING: 0, SUCCESS: 0, FAILED: 0, CANCELLED: 0 };
    for (const row of buckets.statusCounts) statusCounts[row._id] = row.count;

    return res.json({
      success: true,
      data: {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        summary: { totalsByCurrency: buckets.totalsByCurrency, statusCounts },
        daily: buckets.daily.map((row: { _id: { day: string; currency: string }; amount: number }) => ({
          day: row._id.day,
          currency: row._id.currency,
          amount: row.amount,
        })),
      },
    });
  } catch (error) {
    console.error('[Admin] list transactions error:', error);
    return res.status(500).json({ success: false, message: 'Impossible de charger les transactions.' });
  }
}
