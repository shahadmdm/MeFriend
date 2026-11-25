import type { PageContext } from '@microsoft/sp-page-context';
import type { SPHttpClient } from '@microsoft/sp-http';
import {
  mefriendFields,
  mefriendListTitles,
  type MefriendApprovalEntityType,
  type MefriendApprovalMode,
  type MefriendWorkflowFinalAction
} from '../../config/sharePointConfig';
import type {
  IApprovalWorkflow,
  IApprovalWorkflowStep,
  IWorkflowLevel
} from '../../models/settings/IAppAccessModels';
import { SharePointRestClient } from '../../../../shared/services/sharepoint/sharePointRestClient';
import { normalizeWorkflowLevels, type INormalizedWorkflowLevel } from './workflowConfiguration';

interface IWorkflowListItem {
  Id?: number;
  ID?: number;
  Title?: string;
  WorkflowCode?: string;
  EntityType?: string;
  Version?: number;
  IsActive?: boolean;
  AllowRejection?: boolean;
  AllowResubmission?: boolean;
  FinalAction?: string;
}

interface IWorkflowStepListItem {
  Id?: number;
  ID?: number;
  Title?: string;
  WorkflowId?: number;
  LevelNumber?: number;
  StepName?: string;
  ApproverId?: number;
  Approver?: {
    Title?: string;
    Email?: string;
  };
  ApprovalMode?: string;
  RequiredApprovals?: number;
  IsFinalLevel?: boolean;
  Sequence?: number;
  IsActive?: boolean;
}

export interface IApprovalWorkflowServiceOptions {
  pageContext?: PageContext;
  spHttpClient?: SPHttpClient;
  webAbsoluteUrl?: string;
  restClient?: SharePointRestClient;
}

const workflowSelect = [
  'Id',
  'ID',
  'Title',
  'WorkflowCode',
  'EntityType',
  'Version',
  'IsActive',
  'AllowRejection',
  'AllowResubmission',
  'FinalAction'
];

const workflowStepSelect = [
  'Id',
  'ID',
  'Title',
  'WorkflowId',
  'LevelNumber',
  'StepName',
  'ApproverId',
  'Approver/Title',
  'Approver/Email',
  'ApprovalMode',
  'RequiredApprovals',
  'IsFinalLevel',
  'Sequence',
  'IsActive'
];

export class ApprovalWorkflowService {
  private readonly restClient: SharePointRestClient;
  private saveInProgress: boolean = false;

  public constructor(options: IApprovalWorkflowServiceOptions) {
    this.restClient = options.restClient || new SharePointRestClient(options);
  }

  public async getWorkflows(): Promise<readonly IApprovalWorkflow[]> {
    const items = await this.restClient.readItems<IWorkflowListItem>(mefriendListTitles.approvalWorkflows, {
      select: workflowSelect,
      orderBy: 'EntityType asc, Version desc'
    });
    const workflows = items.map(this.mapWorkflow).filter(workflow => !!workflow.workflowCode);
    const entityTypes = workflows
      .map(workflow => workflow.entityType)
      .filter((entityType, index, all) => all.indexOf(entityType) === index);

    return entityTypes.map(entityType => {
      const versions = workflows
        .filter(workflow => workflow.entityType === entityType)
        .sort((left, right) => right.version - left.version || (right.id || 0) - (left.id || 0));
      const activeVersions = versions.filter(workflow => workflow.isActive);

      if (activeVersions.length > 1) {
        throw new Error(`Multiple active ${entityType} workflow versions exist. Resolve the SharePoint workflow records before continuing.`);
      }

      return activeVersions[0] || versions[0];
    }).filter((workflow): workflow is IApprovalWorkflow => !!workflow);
  }

  public async getWorkflowById(workflowId: number): Promise<IApprovalWorkflow | undefined> {
    const items = await this.restClient.readItems<IWorkflowListItem>(mefriendListTitles.approvalWorkflows, {
      select: workflowSelect,
      filter: `Id eq ${workflowId}`,
      top: 1
    });

    return items.length ? this.mapWorkflow(items[0]) : undefined;
  }

  public async getWorkflowSteps(workflowId: number): Promise<readonly IApprovalWorkflowStep[]> {
    const items = await this.restClient.readItems<IWorkflowStepListItem>(mefriendListTitles.approvalWorkflowSteps, {
      select: workflowStepSelect,
      expand: ['Approver'],
      filter: `WorkflowId eq ${workflowId} and IsActive eq 1`,
      orderBy: 'LevelNumber asc, Sequence asc'
    });

    return items.map(this.mapStep).filter(step => step.workflowId === workflowId && step.isActive);
  }

  public toLevels(steps: readonly IApprovalWorkflowStep[]): readonly IWorkflowLevel[] {
    const activeSteps = steps.filter(step => step.isActive && step.approverId > 0);
    const levelNumbers = activeSteps
      .map(step => step.levelNumber)
      .filter((levelNumber, index, all) => all.indexOf(levelNumber) === index)
      .sort((first, second) => first - second);

    const levels = levelNumbers.map((levelNumber, index) => {
      const levelSteps = activeSteps.filter(step => step.levelNumber === levelNumber);
      const firstStep = levelSteps[0];
      const approverIds = levelSteps.map(step => step.approverId);
      const duplicateApprover = approverIds.filter((approverId, approverIndex) =>
        approverIds.indexOf(approverId) !== approverIndex
      )[0];
      const inconsistentStep = levelSteps.filter(step =>
        step.stepName !== firstStep.stepName ||
        step.approvalMode !== firstStep.approvalMode ||
        step.requiredApprovals !== firstStep.requiredApprovals
      )[0];

      if (duplicateApprover) {
        throw new Error(`Workflow level ${levelNumber} contains duplicate persisted approvers.`);
      }

      if (inconsistentStep) {
        throw new Error(`Workflow level ${levelNumber} contains inconsistent persisted settings.`);
      }

      return {
        localId: `level-${levelNumber}-${firstStep.id || index}`,
        levelNumber: index + 1,
        stepName: firstStep.stepName,
        approvalMode: firstStep.approvalMode,
        requiredApprovals: firstStep.approvalMode === 'All' ? approverIds.length : firstStep.requiredApprovals,
        sequence: index + 1,
        approverIds
      };
    });

    return levels;
  }

  public async saveWorkflow(workflow: IApprovalWorkflow, levels: readonly IWorkflowLevel[]): Promise<IApprovalWorkflow> {
    if (this.saveInProgress) {
      throw new Error('This workflow is already being saved. Wait for the current save to finish.');
    }

    this.saveInProgress = true;

    try {
      const normalizedLevels = normalizeWorkflowLevels(levels);
      this.validateWorkflow(workflow, normalizedLevels);
      const currentWorkflows = await this.getWorkflows();
      const currentEntityWorkflow = currentWorkflows.filter(item => item.entityType === workflow.entityType)[0];
      const duplicateCode = currentWorkflows.filter(item =>
        item.workflowCode.toLowerCase() === workflow.workflowCode.trim().toLowerCase() &&
        item.entityType !== workflow.entityType
      )[0];

      if (duplicateCode) {
        throw new Error('Workflow code must be unique.');
      }

      if (!workflow.id && currentEntityWorkflow) {
        throw new Error(`${workflow.entityType} already has a workflow. Edit ${currentEntityWorkflow.title} instead of creating another flow for the same entity.`);
      }

      if (workflow.id && currentEntityWorkflow && currentEntityWorkflow.id !== workflow.id) {
        throw new Error('This workflow has been replaced by a newer version. Reload Approval Management before saving again.');
      }

      const sourceWorkflow = workflow.id ? await this.getWorkflowById(workflow.id) : undefined;

      if (workflow.id && !sourceWorkflow) {
        throw new Error('The workflow being edited no longer exists. Reload Approval Management.');
      }

      if (sourceWorkflow && sourceWorkflow.isActive && await this.isSameWorkflowConfiguration(sourceWorkflow, workflow, normalizedLevels)) {
        return sourceWorkflow;
      }

      return await this.createWorkflowSnapshot(workflow, normalizedLevels, sourceWorkflow);
    } finally {
      this.saveInProgress = false;
    }
  }

  public validateWorkflow(workflow: IApprovalWorkflow, levels: readonly INormalizedWorkflowLevel[]): void {
    if (!workflow.title.trim() || !workflow.workflowCode.trim()) {
      throw new Error('Workflow title and code are required.');
    }

    levels.forEach((level, index) => {
      if (level.levelNumber !== index + 1) {
        throw new Error('Level numbers must be sequential beginning at 1.');
      }

      if (level.requiredApprovals < 1 || level.requiredApprovals > level.approverIds.length) {
        throw new Error(`Level ${level.levelNumber} has an invalid required approval count.`);
      }

      if (level.isFinalLevel !== (index === levels.length - 1)) {
        throw new Error('The final approval level must be the last level.');
      }
    });
  }

  private async createLevelSnapshot(workflowId: number, levels: readonly INormalizedWorkflowLevel[]): Promise<readonly number[]> {
    const createdStepIds: number[] = [];
    try {
      for (const level of levels) {
        for (const approverId of level.approverIds) {
          const payload = {
            Title: `${level.levelNumber}-${level.stepName}-${approverId}`,
            [mefriendFields.approvalWorkflowSteps.workflowId]: workflowId,
            LevelNumber: level.levelNumber,
            StepName: level.stepName,
            [mefriendFields.approvalWorkflowSteps.approverId]: approverId,
            ApprovalMode: level.approvalMode,
            RequiredApprovals: level.requiredApprovals,
            IsFinalLevel: level.isFinalLevel,
            Sequence: level.sequence,
            IsActive: level.isActive
          };
          const created = await this.restClient.createItem<typeof payload, IWorkflowStepListItem>(mefriendListTitles.approvalWorkflowSteps, payload);
          const createdId = created.Id || created.ID;

          if (!createdId) {
            throw new Error(`SharePoint did not return an ID for the Level ${level.levelNumber} approval step.`);
          }

          createdStepIds.push(createdId);
        }
      }
    } catch (error) {
      const cleanupErrors: string[] = [];

      for (const stepId of createdStepIds) {
        try {
          await this.restClient.deleteItem(mefriendListTitles.approvalWorkflowSteps, stepId);
        } catch (cleanupError) {
          cleanupErrors.push(cleanupError instanceof Error ? cleanupError.message : `Unable to remove incomplete workflow step ${stepId}.`);
        }
      }

      const message = error instanceof Error ? error.message : 'Unknown SharePoint step error.';
      const cleanupMessage = cleanupErrors.length ? ` Step cleanup also reported: ${cleanupErrors.join(' ')}` : '';
      throw new Error(`${message}${cleanupMessage}`);
    }

    return createdStepIds;
  }

  private async createWorkflowSnapshot(
    workflow: IApprovalWorkflow,
    levels: readonly INormalizedWorkflowLevel[],
    sourceWorkflow?: IApprovalWorkflow
  ): Promise<IApprovalWorkflow> {
    const allWorkflowItems = await this.restClient.readItems<IWorkflowListItem>(mefriendListTitles.approvalWorkflows, {
      select: workflowSelect,
      orderBy: 'Version desc'
    });
    const highestVersion = allWorkflowItems
      .map(this.mapWorkflow)
      .filter(item => item.entityType === workflow.entityType)
      .reduce((highest, item) => Math.max(highest, item.version), 0);
    const nextVersion = highestVersion + 1;
    const pendingWorkflowCode = sourceWorkflow && sourceWorkflow.id
      ? `__MFP-${sourceWorkflow.id}-V${nextVersion}-${Date.now().toString(36)}`
      : workflow.workflowCode.trim();
    const archivedWorkflowCode = sourceWorkflow && sourceWorkflow.id
      ? `__MFH-${sourceWorkflow.id}-V${sourceWorkflow.version}`
      : undefined;
    const payload = {
      Title: workflow.title.trim(),
      WorkflowCode: pendingWorkflowCode,
      EntityType: workflow.entityType,
      Version: nextVersion,
      IsActive: false,
      AllowRejection: workflow.allowRejection,
      AllowResubmission: workflow.allowResubmission,
      FinalAction: workflow.finalAction
    };
    let snapshotId: number | undefined;
    let sourceArchived: boolean = false;
    let createdStepIds: readonly number[] = [];

    try {
      const created = await this.restClient.createItem<typeof payload, IWorkflowListItem>(
        mefriendListTitles.approvalWorkflows,
        payload
      );
      snapshotId = created.Id || created.ID;

      if (!snapshotId) {
        throw new Error('SharePoint did not return an ID for the new workflow version.');
      }

      createdStepIds = await this.createLevelSnapshot(snapshotId, levels);

      if (sourceWorkflow && sourceWorkflow.id && archivedWorkflowCode) {
        await this.restClient.updateItem(mefriendListTitles.approvalWorkflows, sourceWorkflow.id, {
          IsActive: false,
          WorkflowCode: archivedWorkflowCode
        });
        sourceArchived = true;
      }

      await this.restClient.updateItem(mefriendListTitles.approvalWorkflows, snapshotId, {
        IsActive: true,
        WorkflowCode: workflow.workflowCode.trim()
      });
    } catch (error) {
      const rollbackErrors: string[] = [];
      let snapshotSafeToDelete: boolean = true;

      if (snapshotId && sourceWorkflow) {
        try {
          await this.restClient.updateItem(mefriendListTitles.approvalWorkflows, snapshotId, {
            IsActive: false,
            WorkflowCode: pendingWorkflowCode
          });
        } catch (rollbackError) {
          snapshotSafeToDelete = false;
          rollbackErrors.push(rollbackError instanceof Error ? rollbackError.message : 'Unable to demote the incomplete workflow version.');
        }
      }

      if (snapshotSafeToDelete && sourceArchived && sourceWorkflow && sourceWorkflow.id) {
        try {
          await this.restClient.updateItem(mefriendListTitles.approvalWorkflows, sourceWorkflow.id, {
            IsActive: true,
            WorkflowCode: sourceWorkflow.workflowCode
          });
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError instanceof Error ? rollbackError.message : 'Unable to reactivate the previous workflow version.');
        }
      }

      if (snapshotSafeToDelete) {
        for (const stepId of createdStepIds) {
          try {
            await this.restClient.deleteItem(mefriendListTitles.approvalWorkflowSteps, stepId);
          } catch (rollbackError) {
            rollbackErrors.push(rollbackError instanceof Error ? rollbackError.message : `Unable to remove incomplete workflow step ${stepId}.`);
          }
        }

        if (snapshotId) {
          try {
            await this.restClient.deleteItem(mefriendListTitles.approvalWorkflows, snapshotId);
          } catch (rollbackError) {
            rollbackErrors.push(rollbackError instanceof Error ? rollbackError.message : 'Unable to remove the incomplete workflow version.');
          }
        }
      }

      const message = error instanceof Error ? error.message : 'Unknown SharePoint error.';
      const rollbackMessage = rollbackErrors.length ? ` Rollback also reported: ${rollbackErrors.join(' ')}` : '';
      throw new Error(`Workflow save failed; the new configuration was not activated. ${message}${rollbackMessage}`);
    }

    const savedWorkflow = snapshotId ? await this.getWorkflowById(snapshotId) : undefined;

    if (!savedWorkflow) {
      throw new Error('Workflow was saved, but SharePoint could not reload the active version. Refresh Approval Management.');
    }

    return savedWorkflow;
  }

  private async isSameWorkflowConfiguration(
    persistedWorkflow: IApprovalWorkflow,
    submittedWorkflow: IApprovalWorkflow,
    submittedLevels: readonly INormalizedWorkflowLevel[]
  ): Promise<boolean> {
    if (
      persistedWorkflow.title !== submittedWorkflow.title.trim() ||
      persistedWorkflow.workflowCode !== submittedWorkflow.workflowCode.trim() ||
      persistedWorkflow.entityType !== submittedWorkflow.entityType ||
      persistedWorkflow.allowRejection !== submittedWorkflow.allowRejection ||
      persistedWorkflow.allowResubmission !== submittedWorkflow.allowResubmission ||
      persistedWorkflow.finalAction !== submittedWorkflow.finalAction
    ) {
      return false;
    }

    const persistedLevels = normalizeWorkflowLevels(this.toLevels(
      await this.getWorkflowSteps(persistedWorkflow.id || 0)
    ));

    return persistedLevels.length === submittedLevels.length && persistedLevels.every((level, index) => {
      const submittedLevel = submittedLevels[index];

      return !!submittedLevel &&
        level.stepName === submittedLevel.stepName &&
        level.approvalMode === submittedLevel.approvalMode &&
        level.requiredApprovals === submittedLevel.requiredApprovals &&
        level.approverIds.length === submittedLevel.approverIds.length &&
        level.approverIds.every((approverId, approverIndex) => approverId === submittedLevel.approverIds[approverIndex]);
    });
  }

  private mapWorkflow(item: IWorkflowListItem): IApprovalWorkflow {
    return {
      id: item.Id || item.ID,
      title: item.Title || '',
      workflowCode: item.WorkflowCode || '',
      entityType: (item.EntityType || 'Customer') as MefriendApprovalEntityType,
      version: item.Version || 1,
      isActive: item.IsActive === true,
      allowRejection: item.AllowRejection !== false,
      allowResubmission: item.AllowResubmission !== false,
      finalAction: (item.FinalAction || 'ApproveOnly') as MefriendWorkflowFinalAction
    };
  }

  private mapStep(item: IWorkflowStepListItem): IApprovalWorkflowStep {
    return {
      id: item.Id || item.ID,
      title: item.Title || '',
      workflowId: item.WorkflowId || 0,
      levelNumber: item.LevelNumber || 1,
      stepName: item.StepName || '',
      approverId: item.ApproverId || 0,
      approverTitle: item.Approver ? item.Approver.Title : undefined,
      approverEmail: item.Approver ? item.Approver.Email : undefined,
      approvalMode: (item.ApprovalMode || 'Any') as MefriendApprovalMode,
      requiredApprovals: item.RequiredApprovals || 1,
      isFinalLevel: item.IsFinalLevel === true,
      sequence: item.Sequence || item.LevelNumber || 1,
      isActive: item.IsActive !== false
    };
  }
}
