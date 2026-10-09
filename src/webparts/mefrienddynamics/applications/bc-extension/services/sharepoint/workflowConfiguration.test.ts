import type { IWorkflowLevel } from '../../models/settings/IAppAccessModels';
import { normalizeWorkflowLevels, renumberWorkflowLevels } from './workflowConfiguration';

const level = (
  localId: string,
  approverIds: readonly number[],
  approvalMode: 'Any' | 'All' = 'Any',
  requiredApprovals: number = 1
): IWorkflowLevel => ({
  localId,
  levelNumber: 99,
  stepName: `${localId} approval`,
  approvalMode,
  requiredApprovals,
  sequence: 99,
  approverIds
});

describe('workflow configuration normalization', () => {
  it('renumbers levels after removing the middle level', () => {
    const result = renumberWorkflowLevels([level('one', [1]), level('three', [3])]);

    expect(result.map(item => [item.localId, item.levelNumber, item.sequence])).toEqual([
      ['one', 1, 1],
      ['three', 2, 2]
    ]);
  });

  it('preserves reordered level content while rebuilding sequence', () => {
    const result = normalizeWorkflowLevels([level('third', [3]), level('first', [1]), level('second', [2])]);

    expect(result.map(item => item.localId)).toEqual(['third', 'first', 'second']);
    expect(result.map(item => item.levelNumber)).toEqual([1, 2, 3]);
    expect(result.map(item => item.sequence)).toEqual([1, 2, 3]);
    expect(result.map(item => item.isFinalLevel)).toEqual([false, false, true]);
    expect(result.every(item => item.isActive)).toBe(true);
  });

  it('derives All mode from the approver count and preserves a valid Any threshold', () => {
    const result = normalizeWorkflowLevels([
      level('any', [1, 2, 3, 4], 'Any', 2),
      level('all', [5, 6, 7], 'All', 1)
    ]);

    expect(result[0].requiredApprovals).toBe(2);
    expect(result[1].requiredApprovals).toBe(3);
  });

  it('rejects duplicate or invalid approvers and contradictory thresholds', () => {
    expect(() => normalizeWorkflowLevels([level('duplicate', [1, 1])])).toThrow('same approver');
    expect(() => normalizeWorkflowLevels([level('invalid', [0])])).toThrow('invalid approver');
    expect(() => normalizeWorkflowLevels([level('threshold', [1, 2], 'Any', 3)])).toThrow('invalid required approval');
  });
});
