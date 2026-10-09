jest.mock('@microsoft/sp-http', () => ({
  SPHttpClient: { configurations: { v1: {} } },
  SPHttpClientResponse: class {}
}));

import { mefriendListTitles } from '../../config/sharePointConfig';
import type { IApprovalWorkflow, IWorkflowLevel } from '../../models/settings/IAppAccessModels';
import type { SharePointRestClient } from '../../../../shared/services/sharepoint/sharePointRestClient';
import { ApprovalWorkflowService } from './approvalWorkflowService';

type StoredItem = Record<string, unknown> & { Id: number };

class InMemorySharePointClient {
  private readonly records: Record<string, StoredItem[]> = {
    [mefriendListTitles.approvalWorkflows]: [],
    [mefriendListTitles.approvalWorkflowSteps]: []
  };
  private nextId: number = 1;

  public async readItems<T>(listTitle: string, options: { filter?: string } = {}): Promise<readonly T[]> {
    let items = (this.records[listTitle] || []).slice();
    const filter = options.filter || '';
    const idMatch = /(?:^|\s)Id eq (\d+)/.exec(filter);
    const workflowIdMatch = /WorkflowId eq (\d+)/.exec(filter);

    if (idMatch) {
      items = items.filter(item => item.Id === Number(idMatch[1]));
    }

    if (workflowIdMatch) {
      items = items.filter(item => item.WorkflowId === Number(workflowIdMatch[1]));
    }

    if (/IsActive eq 1/.test(filter)) {
      items = items.filter(item => item.IsActive === true);
    }

    return items.map(item => ({ ...item })) as unknown as readonly T[];
  }

  public async createItem<TPayload extends Record<string, unknown>, TResult>(listTitle: string, payload: TPayload): Promise<TResult> {
    this.ensureUniqueWorkflowCode(listTitle, payload.WorkflowCode);
    const item = { ...payload, Id: this.nextId++ } as StoredItem;
    this.records[listTitle].push(item);
    return { ...item } as unknown as TResult;
  }

  public async updateItem<TPayload extends Record<string, unknown>>(listTitle: string, id: number, payload: TPayload): Promise<void> {
    const item = this.records[listTitle].filter(record => record.Id === id)[0];

    if (!item) {
      throw new Error(`Missing ${listTitle} item ${id}.`);
    }

    this.ensureUniqueWorkflowCode(listTitle, payload.WorkflowCode, id);
    Object.assign(item, payload);
  }

  public async deleteItem(listTitle: string, id: number): Promise<void> {
    this.records[listTitle] = this.records[listTitle].filter(item => item.Id !== id);
  }

  public getItems(listTitle: string): readonly StoredItem[] {
    return this.records[listTitle].map(item => ({ ...item }));
  }

  private ensureUniqueWorkflowCode(listTitle: string, workflowCode: unknown, excludedId?: number): void {
    if (listTitle !== mefriendListTitles.approvalWorkflows || typeof workflowCode !== 'string') {
      return;
    }

    const duplicate = this.records[listTitle].some(item =>
      item.Id !== excludedId && String(item.WorkflowCode).toLowerCase() === workflowCode.toLowerCase()
    );

    if (duplicate) {
      throw new Error('Duplicate WorkflowCode.');
    }
  }
}

const workflow = (): IApprovalWorkflow => ({
  title: 'Customer Approval',
  workflowCode: 'CUSTOMER-APPROVAL',
  entityType: 'Customer',
  version: 1,
  isActive: true,
  allowRejection: true,
  allowResubmission: true,
  finalAction: 'ApproveOnly'
});

const level = (
  localId: string,
  approverIds: readonly number[],
  approvalMode: 'Any' | 'All' = 'Any',
  requiredApprovals: number = 1
): IWorkflowLevel => ({
  localId,
  levelNumber: 1,
  stepName: localId,
  approvalMode,
  requiredApprovals,
  sequence: 1,
  approverIds
});

const createService = (): { service: ApprovalWorkflowService; client: InMemorySharePointClient } => {
  const client = new InMemorySharePointClient();
  const service = new ApprovalWorkflowService({
    restClient: client as unknown as SharePointRestClient
  });
  return { service, client };
};

describe('ApprovalWorkflowService persistence', () => {
  it('replaces a three-level workflow with exactly one new level and approver', async () => {
    const { service, client } = createService();
    const first = await service.saveWorkflow(workflow(), [
      level('Level 1', [1, 2]),
      level('Level 2', [3]),
      level('Level 3', [4])
    ]);
    const saved = await service.saveWorkflow(first, [level('Level 1', [5])]);
    const reloaded = service.toLevels(await service.getWorkflowSteps(saved.id || 0));

    expect(reloaded).toHaveLength(1);
    expect(reloaded[0].levelNumber).toBe(1);
    expect(reloaded[0].approverIds).toEqual([5]);

    const currentSteps = client.getItems(mefriendListTitles.approvalWorkflowSteps)
      .filter(item => item.WorkflowId === saved.id);
    expect(currentSteps).toHaveLength(1);
    expect(currentSteps[0].ApproverId).toBe(5);
    expect(currentSteps[0].IsFinalLevel).toBe(true);
    expect(currentSteps[0].IsActive).toBe(true);

    const oldSteps = client.getItems(mefriendListTitles.approvalWorkflowSteps)
      .filter(item => item.WorkflowId === first.id);
    expect(oldSteps).toHaveLength(4);
    expect(oldSteps.every(item => item.IsActive === true)).toBe(true);
    expect(await service.getWorkflowSteps(first.id || 0)).toHaveLength(4);
    expect((await service.getWorkflowById(first.id || 0))?.isActive).toBe(false);

    const workflowVersions = client.getItems(mefriendListTitles.approvalWorkflows);
    expect(workflowVersions.filter(item => item.IsActive === true).map(item => item.Id)).toEqual([saved.id]);
    expect(workflowVersions.filter(item => item.Id === first.id)[0].IsActive).toBe(false);
    expect(workflowVersions.filter(item => item.Id === first.id)[0].WorkflowCode).toBe(`__MFH-${first.id}-V${first.version}`);
    expect(workflowVersions.filter(item => item.Id === saved.id)[0].WorkflowCode).toBe('CUSTOMER-APPROVAL');
  });

  it('supports expansion, middle removal, reorder, approver removal, and full replacement', async () => {
    const { service } = createService();
    let saved = await service.saveWorkflow(workflow(), [level('One', [1])]);

    saved = await service.saveWorkflow(saved, [level('One', [1]), level('Two', [2]), level('Three', [3])]);
    let reloaded = service.toLevels(await service.getWorkflowSteps(saved.id || 0));
    expect(reloaded.map(item => item.stepName)).toEqual(['One', 'Two', 'Three']);

    saved = await service.saveWorkflow(saved, [reloaded[2], reloaded[0]]);
    reloaded = service.toLevels(await service.getWorkflowSteps(saved.id || 0));
    expect(reloaded.map(item => [item.levelNumber, item.stepName])).toEqual([[1, 'Three'], [2, 'One']]);

    saved = await service.saveWorkflow(saved, [level('Approvers', [10, 11, 12], 'Any', 2)]);
    saved = await service.saveWorkflow(saved, [level('Approvers', [10, 12], 'Any', 2)]);
    reloaded = service.toLevels(await service.getWorkflowSteps(saved.id || 0));
    expect(reloaded[0].approverIds).toEqual([10, 12]);

    saved = await service.saveWorkflow(saved, [level('Approvers', [20, 21], 'All')]);
    reloaded = service.toLevels(await service.getWorkflowSteps(saved.id || 0));
    expect(reloaded[0].approverIds).toEqual([20, 21]);
    expect(reloaded[0].requiredApprovals).toBe(2);
  });

  it('does not create duplicate current steps when the same configuration is saved repeatedly', async () => {
    const { service, client } = createService();
    const first = await service.saveWorkflow(workflow(), [level('One', [1, 2])]);
    const second = await service.saveWorkflow(first, service.toLevels(await service.getWorkflowSteps(first.id || 0)));
    const saved = await service.saveWorkflow(second, service.toLevels(await service.getWorkflowSteps(second.id || 0)));

    const currentSteps = client.getItems(mefriendListTitles.approvalWorkflowSteps)
      .filter(item => item.WorkflowId === saved.id && item.IsActive === true);
    const currentWorkflows = await service.getWorkflows();

    expect(currentSteps.map(item => item.ApproverId)).toEqual([1, 2]);
    expect(currentWorkflows).toHaveLength(1);
    expect(currentWorkflows[0].id).toBe(saved.id);
    expect(client.getItems(mefriendListTitles.approvalWorkflows)).toHaveLength(1);
  });

  it('never reconstructs legacy inactive rows into the editable workflow', async () => {
    const { service, client } = createService();
    const saved = await service.saveWorkflow(workflow(), [level('Current', [5])]);

    await client.createItem<Record<string, unknown>, StoredItem>(mefriendListTitles.approvalWorkflowSteps, {
      Title: '2-Obsolete-99',
      WorkflowId: saved.id,
      LevelNumber: 2,
      StepName: 'Obsolete',
      ApproverId: 99,
      ApprovalMode: 'Any',
      RequiredApprovals: 1,
      IsFinalLevel: true,
      Sequence: 2,
      IsActive: false
    });

    const reloaded = service.toLevels(await service.getWorkflowSteps(saved.id || 0));

    expect(reloaded).toHaveLength(1);
    expect(reloaded[0].stepName).toBe('Current');
    expect(reloaded[0].approverIds).toEqual([5]);
  });
});
