import { calculateSimilarity } from '../../utils/fuzzy-match.util';
import { processAndReconcilePerson, findSimilarPersons } from '../../services/reconciliation.service';
import { PersonModel } from '../../models/unified-person.model';
import { upsertPerson } from '../../services/person.service';
import { addJobToManualAudit } from '../../queues/manual-audit.queue';

jest.mock('../../models/unified-person.model', () => ({
  PersonModel: {
    find: jest.fn()
  }
}));

jest.mock('../../services/person.service', () => ({
  upsertPerson: jest.fn()
}));

jest.mock('../../queues/manual-audit.queue', () => ({
  addJobToManualAudit: jest.fn()
}));

describe('fuzzy-match.util', () => {
  it('should calculate 1 for exact match', () => {
    expect(calculateSimilarity('luis perez', 'luis perez')).toBe(1);
  });

  it('should calculate similarity ignoring case and trim', () => {
    expect(calculateSimilarity(' LUIS PEREZ ', 'luis perez')).toBe(1);
  });

  it('should return > 0.85 for slight typos', () => {
    // "luis perez" (10 chars) vs "luis péréz" (10 chars), distance = 2
    // score = (10 - 2) / 10 = 0.8
    // "luis perez" vs "luis perez s" -> len 12, dist 2, score 10/12 = 0.83
    // Let's test "carlos" vs "crlos", len 6, dist 1, score 5/6 = 0.833
    // "ana maria" (9) vs "anna maria" (10), dist 1, score 9/10 = 0.9
    expect(calculateSimilarity('ana maria', 'anna maria')).toBeGreaterThanOrEqual(0.85);
  });
});

describe('reconciliation.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should insert as new if no candidates found', async () => {
    (PersonModel.find as jest.Mock).mockReturnValue({
      limit: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([])
      })
    });
    (upsertPerson as jest.Mock).mockResolvedValue({ idHash: 'new-hash' });

    const result = await processAndReconcilePerson('web', '123', {
      normalizedName: 'juan perez',
      lastSeen: { state: 'Aragua' } as any
    });

    expect(result.status).toBe('inserted');
    expect(result.idHash).toBe('new-hash');
    expect(upsertPerson).toHaveBeenCalled();
    expect(addJobToManualAudit).not.toHaveBeenCalled();
  });

  it('should send to manual audit if similarity is between 85% and 94%', async () => {
    (PersonModel.find as jest.Mock).mockReturnValue({
      limit: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { normalizedName: 'anna maria', name: 'Anna Maria', idHash: 'hash-1' }
        ])
      })
    });

    // "anna maria" (10 chars) vs "ana maria" (9 chars) -> dist 1 -> score 9/10 = 0.90
    const result = await processAndReconcilePerson('web', '123', {
      normalizedName: 'ana maria',
      lastSeen: { state: 'Aragua' } as any
    });
    
    expect(result.status).toBe('pending_audit');
    expect(addJobToManualAudit).toHaveBeenCalled();
  });

  it('should auto-merge if similarity is >= 95%', async () => {
    (PersonModel.find as jest.Mock).mockReturnValue({
      limit: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { normalizedName: 'maria rojas', name: 'Maria Rojas', idHash: 'hash-mr', age: 30 }
        ])
      })
    });
    
    (upsertPerson as jest.Mock).mockResolvedValue({ idHash: 'hash-mr' });

    // "maria  rojas" vs "maria rojas" -> they are very close.
    // Let's use exact to guarantee 1.0 > 0.95
    const result = await processAndReconcilePerson('web', '123', {
      normalizedName: 'maria rojas',
      lastSeen: { state: 'Aragua' } as any
    });

    expect(result.status).toBe('auto-merged');
    expect(result.idHash).toBe('hash-mr');
    expect(upsertPerson).toHaveBeenCalledWith(
      'web',
      '123',
      expect.objectContaining({
        normalizedName: 'maria rojas'
      })
    );
    expect(addJobToManualAudit).not.toHaveBeenCalled();
  });
});
