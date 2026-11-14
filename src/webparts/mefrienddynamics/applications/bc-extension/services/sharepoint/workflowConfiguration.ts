import type { IWorkflowLevel } from '../../models/settings/IAppAccessModels';

export interface INormalizedWorkflowLevel extends IWorkflowLevel {
  isActive: true;
  isFinalLevel: boolean;
}

export const renumberWorkflowLevels = (
  levels: readonly IWorkflowLevel[]
): readonly IWorkflowLevel[] => levels.map((level, index) => ({
  ...level,
  levelNumber: index + 1,
  sequence: index + 1
}));

export const normalizeWorkflowLevels = (
  levels: readonly IWorkflowLevel[]
): readonly INormalizedWorkflowLevel[] => {
  if (!levels.length) {
    throw new Error('A workflow must contain at least one approval level.');
  }

  const renumbered = renumberWorkflowLevels(levels);

  return renumbered.map((level, index) => {
    const stepName = level.stepName.trim();
    const approverIds = level.approverIds.map(approverId => Number(approverId));
    const uniqueApproverIds = approverIds.filter((approverId, approverIndex) =>
      approverIds.indexOf(approverId) === approverIndex
    );

    if (!stepName) {
      throw new Error(`Level ${index + 1} requires a step name.`);
    }

    if (!approverIds.length) {
      throw new Error(`Level ${index + 1} requires at least one approver.`);
    }

    if (approverIds.some(approverId => !Number.isInteger(approverId) || approverId <= 0)) {
      throw new Error(`Level ${index + 1} contains an invalid approver.`);
    }

    if (uniqueApproverIds.length !== approverIds.length) {
      throw new Error(`Level ${index + 1} contains the same approver more than once.`);
    }

    const requiredApprovals = level.approvalMode === 'All'
      ? approverIds.length
      : Math.floor(Number(level.requiredApprovals));

    if (!Number.isFinite(requiredApprovals) || requiredApprovals < 1 || requiredApprovals > approverIds.length) {
      throw new Error(`Level ${index + 1} has an invalid required approval count.`);
    }

    return {
      ...level,
      levelNumber: index + 1,
      stepName,
      requiredApprovals,
      sequence: index + 1,
      isActive: true,
      isFinalLevel: index === renumbered.length - 1,
      approverIds
    };
  });
};
