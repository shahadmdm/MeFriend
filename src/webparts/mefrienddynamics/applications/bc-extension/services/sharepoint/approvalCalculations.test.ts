import type { IApprovalTask } from '../../models/requests';
import type { IApprovalWorkflowStep } from '../../models/settings/IAppAccessModels';
import {
  evaluateLevelCompletion,
  getEffectiveRequiredApprovals,
  groupActiveWorkflowLevels,
  isEffectivelyFinalLevel
} from './approvalCalculations';

const step = (
  id: number,
  levelNumber: number,
  approverId: number,
  approvalMode: 'Any' | 'All',
  requiredApprovals: number,
  isFinalLevel: boolean
): IApprovalWorkflowStep => ({
  id,
  title: `step-${id}`,
  workflowId: 1,
  levelNumber,
  stepName: `Level ${levelNumber}`,
  approverId,
  approvalMode,
  requiredApprovals,
  isFinalLevel,
  sequence: levelNumber,
  isActive: true
});

const task = (id: number, taskStatus: IApprovalTask['taskStatus']): IApprovalTask => ({
  id,
  title: `task-${id}`,
  taskNumber: `task-${id}`,
  requestType: 'Customer',
  requestNumber: 'REQ-1',
  requestItemId: 1,
  workflowId: 1,
  workflowStepId: id,
  levelNumber: 1,
  approvalCycle: 1,
  approverId: id,
  approverEmail: `approver${id}@example.com`,
  taskStatus,
  isCurrent: taskStatus === 'Pending'
});

describe('approval calculations', () => {
  it('completes Any mode when its configured threshold is reached', () => {
    const workflowLevel = groupActiveWorkflowLevels([
      step(1, 1, 1, 'Any', 2, true),
      step(2, 1, 2, 'Any', 2, true),
      step(3, 1, 3, 'Any', 2, true)
    ])[0];

    expect(evaluateLevelCompletion(workflowLevel, [task(1, 'Approved'), task(2, 'Approved'), task(3, 'Pending')])).toEqual({
      requiredApprovals: 2,
      approvedCount: 2,
      isComplete: true,
      shouldSkipRemaining: true
    });
  });

  it('always requires every approver for All mode even if persisted threshold data is stale', () => {
    const workflowLevel = groupActiveWorkflowLevels([
      step(1, 1, 1, 'All', 1, true),
      step(2, 1, 2, 'All', 1, true)
    ])[0];

    expect(getEffectiveRequiredApprovals(workflowLevel)).toBe(2);
    expect(evaluateLevelCompletion(workflowLevel, [task(1, 'Approved'), task(2, 'Pending')]).isComplete).toBe(false);
    expect(evaluateLevelCompletion(workflowLevel, [task(1, 'Approved'), task(2, 'Approved')]).isComplete).toBe(true);
  });

  it('recognizes the actual last level as final', () => {
    const levels = groupActiveWorkflowLevels([
      step(1, 1, 1, 'Any', 1, true),
      step(2, 2, 2, 'Any', 1, false)
    ]);

    expect(levels.map(level => level.isFinalLevel)).toEqual([false, true]);
    expect(isEffectivelyFinalLevel(levels, 1)).toBe(false);
    expect(isEffectivelyFinalLevel(levels, 2)).toBe(true);
  });
});
