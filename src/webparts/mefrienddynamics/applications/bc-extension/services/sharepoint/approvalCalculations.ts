import type { MefriendApprovalMode } from '../../config/sharePointConfig';
import type { IApprovalTask } from '../../models/requests';
import type { IApprovalWorkflowStep } from '../../models/settings/IAppAccessModels';

export interface IApprovalLevelDefinition {
  levelNumber: number;
  stepName: string;
  approvalMode: MefriendApprovalMode;
  requiredApprovals: number;
  isFinalLevel: boolean;
  steps: readonly IApprovalWorkflowStep[];
}

export interface IApprovalLevelCompletion {
  requiredApprovals: number;
  approvedCount: number;
  isComplete: boolean;
  shouldSkipRemaining: boolean;
}

export const groupActiveWorkflowLevels = (
  steps: readonly IApprovalWorkflowStep[]
): readonly IApprovalLevelDefinition[] => {
  const activeSteps = steps.filter(step => step.isActive && step.approverId > 0 && step.id);
  const levelNumbers = activeSteps
    .map(step => step.levelNumber)
    .filter((levelNumber, index, all) => all.indexOf(levelNumber) === index)
    .sort((left, right) => left - right);

  return levelNumbers.map((levelNumber, index) => {
    const levelSteps = activeSteps
      .filter(step => step.levelNumber === levelNumber)
      .sort((left, right) => left.sequence - right.sequence);
    const firstStep = levelSteps[0];

    if (!firstStep) {
      throw new Error(`Workflow level ${levelNumber} has no active approvers.`);
    }

    const inconsistentStep = levelSteps.filter(step =>
      step.stepName !== firstStep.stepName ||
      step.approvalMode !== firstStep.approvalMode ||
      step.requiredApprovals !== firstStep.requiredApprovals
    )[0];
    const approverIds = levelSteps.map(step => step.approverId);
    const hasDuplicateApprover = approverIds.some((approverId, approverIndex) =>
      approverIds.indexOf(approverId) !== approverIndex
    );

    if (inconsistentStep) {
      throw new Error(`Workflow level ${levelNumber} has inconsistent approval settings.`);
    }

    if (hasDuplicateApprover) {
      throw new Error(`Workflow level ${levelNumber} contains duplicate approvers.`);
    }

    return {
      levelNumber,
      stepName: firstStep.stepName,
      approvalMode: firstStep.approvalMode,
      requiredApprovals: firstStep.requiredApprovals,
      isFinalLevel: index === levelNumbers.length - 1,
      steps: levelSteps
    };
  });
};

export const getEffectiveRequiredApprovals = (level: IApprovalLevelDefinition): number => {
  const activeApproverCount = level.steps.length;

  if (level.approvalMode === 'All') {
    return activeApproverCount;
  }

  if (level.requiredApprovals >= 1 && level.requiredApprovals <= activeApproverCount) {
    return level.requiredApprovals;
  }

  return 1;
};

export const evaluateLevelCompletion = (
  level: IApprovalLevelDefinition,
  levelTasks: readonly IApprovalTask[]
): IApprovalLevelCompletion => {
  const requiredApprovals = getEffectiveRequiredApprovals(level);
  const approvedCount = levelTasks.filter(task => task.taskStatus === 'Approved').length;
  const isComplete = approvedCount >= requiredApprovals;

  return {
    requiredApprovals,
    approvedCount,
    isComplete,
    shouldSkipRemaining: isComplete && requiredApprovals < level.steps.length
  };
};

export const getNextApprovalLevel = (
  levels: readonly IApprovalLevelDefinition[],
  currentLevelNumber: number
): IApprovalLevelDefinition | undefined =>
  levels.filter(level => level.levelNumber > currentLevelNumber)[0];

export const isEffectivelyFinalLevel = (
  levels: readonly IApprovalLevelDefinition[],
  currentLevelNumber: number
): boolean => !getNextApprovalLevel(levels, currentLevelNumber);
