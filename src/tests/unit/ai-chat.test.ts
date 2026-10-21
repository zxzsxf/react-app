import { api, ApiError, ComponentItem, Snapshot } from '../../lowcode/api';
import { loadBlankCatalog, loadStartingDraft } from '../../ai-chat/catalog';
import { prepareDraft, validateDraft } from '../../ai-chat/draft';
import { generate, simulateDraft } from '../../ai-chat/mock-generator';
import { createSaveAttempt, saveNewDraft } from '../../ai-chat/save';
import { AIFormDraft, clone, GenerationEvent } from '../../ai-chat/types';

const draft: AIFormDraft = {
  title: '新表单',
  schema: { type: 'object', properties: {} },
  componentLocks: {
    Input: { remoteName: 'input', version: '1.0.0', configVersion: 2, defaultFieldSchema: { type: 'string', 'x-component': 'Input' } },
    Card: { remoteName: 'card', version: '2.0.0', configVersion: 3 },
  },
};

const component = (name: string, version: string, schemaComponent: string): ComponentItem => ({
  componentName: name,
  version,
  manifest: {
    schemaComponent,
    displayName: schemaComponent,
    kind: schemaComponent === 'Card' ? 'container' : 'field',
    allowedProps: [],
    defaultFieldSchema: { type: 'string', 'x-component': schemaComponent },
  },
});

const snapshot = (version: number): Snapshot => ({
  id: 'config', title: '配置', version,
  schema: { type: 'object', properties: {} }, componentLocks: {}, bindings: {},
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test('blank catalog intersects exact active versions and excludes unpublished configurations', async () => {
  jest.spyOn(api, 'activeComponents').mockResolvedValue([
    { componentName: 'input', version: '1.0.0' },
    { componentName: 'card', version: '2.0.0' },
    { componentName: 'button', version: '1.0.0' },
  ]);
  jest.spyOn(api, 'components').mockResolvedValue([
    component('input', '0.9.0', 'Input'),
    component('input', '1.0.0', 'Input'),
    component('card', '2.0.0', 'Card'),
    component('button', '1.0.0', 'Button'),
    component('select', '1.0.0', 'Select'),
  ]);
  const published = jest.spyOn(api, 'published').mockImplementation(async (_kind, id) => {
    if (id.startsWith('card:')) {
      throw new ApiError('尚未发布', 404);
    }
    return snapshot(7);
  });
  const result = await loadBlankCatalog();
  expect(result.locks.Input).toMatchObject({ remoteName: 'input', version: '1.0.0', configVersion: 7 });
  expect(result.locks.Button.configVersion).toBe(7);
  expect(result.locks.Card).toBeUndefined();
  expect(result.warnings.join('')).toContain('Card 不可用');
  expect(published).not.toHaveBeenCalledWith('component-configs', 'input:0.9.0');
});

test('catalog exposes authentication failures instead of treating them as missing configurations', async () => {
  jest.spyOn(api, 'activeComponents').mockResolvedValue([{ componentName: 'input', version: '1' }]);
  jest.spyOn(api, 'components').mockResolvedValue([component('input', '1', 'Input')]);
  jest.spyOn(api, 'published').mockRejectedValue(new ApiError('登录已失效', 401));
  await expect(loadBlankCatalog()).rejects.toMatchObject({ status: 401 });
});

test('published templates preserve pinned and bundled configs without changing the source snapshot', async () => {
  const template = snapshot(4);
  template.title = '客户登记';
  template.componentLocks = {
    Input: {
      remoteName: 'input', version: 'old', configVersion: 0,
      configSchema: { type: 'object', properties: {} },
      configBindings: {},
      defaultFieldSchema: { type: 'string', 'x-component': 'Input' },
    },
  };
  template.schema.properties = { customer: { type: 'string', title: '姓名', 'x-component': 'Input' } };
  jest.spyOn(api, 'published').mockResolvedValue(template);
  const result = await loadStartingDraft({ mode: 'template', templateId: 'customer' }, { locks: draft.componentLocks, warnings: [] });
  expect(api.published).toHaveBeenCalledWith('templates', 'customer');
  expect(result.componentLocks.Input.version).toBe('old');
  expect(result.schema['x-component-configs']?.Input.schema).toEqual(template.componentLocks.Input.configSchema);
  result.schema.properties!.customer.title = '新姓名';
  expect(template.schema.properties!.customer.title).toBe('姓名');
});

test('multiple rounds preserve unrelated fields and keys and do not mutate earlier drafts', () => {
  const source = clone(draft);
  source.schema.properties = {
    existing: { type: 'string', title: '姓名', 'x-component': 'Input' },
  };
  const registration = simulateDraft('生成姓名、手机号组成的登记表', source)!;
  const added = simulateDraft('添加备注字段', registration)!;
  const required = simulateDraft('将姓名设为必填', added)!;
  const optional = simulateDraft('取消姓名必填', required)!;
  const renamed = simulateDraft('将表单标题改为：活动报名', optional)!;
  const removed = simulateDraft('删除备注字段', renamed)!;
  expect(Object.keys(registration.schema.properties!)).toEqual(['existing', 'phone']);
  expect(required.schema.properties!.existing.required).toBe(true);
  expect(optional.schema.properties!.existing.required).toBe(false);
  expect(removed.schema.properties!.remark).toBeUndefined();
  expect(removed.schema.properties!.phone).toEqual(registration.schema.properties!.phone);
  expect(removed.title).toBe('活动报名');
  expect(source.schema.properties!.existing.required).toBeUndefined();
});

test('unknown instructions leave the candidate unchanged and missing Input cannot create fields', () => {
  expect(simulateDraft('帮我自动生成任何复杂页面', draft)).toBeNull();
  expect(() => simulateDraft('添加邮箱字段', { ...draft, componentLocks: {} })).toThrow('没有可用 Input');
  expect(() => simulateDraft('删除备注字段', draft)).toThrow('找不到');
});

test('saving strips unused locks but preserves unused bundled definitions', () => {
  const value = simulateDraft('生成登记表', draft)!;
  value.componentLocks.Button = {
    remoteName: 'button', version: '1', configVersion: 0,
    configSchema: { type: 'object', properties: {} },
    defaultFieldSchema: { type: 'void', 'x-component': 'Button' },
  };
  const prepared = prepareDraft(value);
  expect(prepared.componentLocks.Card).toBeUndefined();
  expect(prepared.componentLocks.Button).toBeDefined();
  expect(prepared.schema['x-component-configs']?.Button).toBeDefined();
  expect(value.componentLocks.Card).toBeDefined();
});

test('validation rejects unsupported components, scripts and missing configuration locks', () => {
  const value = simulateDraft('添加邮箱字段', draft)!;
  expect(() => validateDraft({ ...value, title: ' ' })).toThrow('表单名称');
  value.schema.properties!.email['x-component'] = 'Select';
  expect(() => validateDraft(value)).toThrow('缺少可用组件');
  value.schema.properties!.email['x-component'] = 'Input';
  value.schema.properties!.email.title = '{{execute()}}';
  expect(() => validateDraft(value)).toThrow('表达式');
  value.schema.properties!.email.title = '邮箱';
  value.componentLocks.Input.configVersion = 0;
  expect(() => validateDraft(value)).toThrow('已发布配置');
});

test('save preparation retains a component lock used on the root schema', () => {
  const source = clone(draft);
  source.schema['x-component'] = 'Card';
  expect(prepareDraft(source).componentLocks.Card.version).toBe('2.0.0');
});

test('simulation stops its timer and never emits a completed candidate after cancellation', async () => {
  jest.useFakeTimers();
  const controller = new AbortController();
  const events: GenerationEvent[] = [];
  const running = (async () => {
    for await (const event of generate({ message: '生成登记表', currentDraft: draft }, controller.signal)) {
      events.push(event);
    }
  })();
  await Promise.resolve();
  controller.abort();
  await expect(running).rejects.toMatchObject({ name: 'AbortError' });
  expect(events.map((event) => event.type)).toEqual(['status']);
  expect(jest.getTimerCount()).toBe(0);
});

test('save uses the generated schema and reconciles an ambiguous response without creating twice', async () => {
  const originalCrypto = globalThis.crypto;
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { randomUUID: () => 'abc123-123456-abcdef' } });
  try {
    const generated = simulateDraft('生成登记表', draft)!;
    const attempt = createSaveAttempt(generated);
    const create = jest.spyOn(api, 'create').mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const get = jest.spyOn(api, 'get').mockResolvedValue({ id: `form:${attempt.id}` } as any);
    await expect(saveNewDraft(attempt)).rejects.toThrow('Failed to fetch');
    await expect(saveNewDraft(attempt)).resolves.toBe(attempt.id);
    expect(create).toHaveBeenCalledTimes(1);
    const body = create.mock.calls[0][1] as any;
    expect(body.schema.properties.phone.title).toBe('手机号');
    expect(body.templateId).toBeUndefined();
    expect(body.componentLocks.Card).toBeUndefined();
    expect(get).toHaveBeenCalledWith('forms', attempt.id);
  } finally {
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: originalCrypto });
  }
});

test('save retries the same ID only after a confirmed 404; failed reconciliation keeps the attempt', async () => {
  const attempt = { id: 'fstable', draft: prepareDraft(simulateDraft('生成登记表', draft)!), attempted: true };
  const get = jest.spyOn(api, 'get').mockRejectedValueOnce(new ApiError('未登录', 401));
  const create = jest.spyOn(api, 'create').mockResolvedValue({} as any);
  await expect(saveNewDraft(attempt)).rejects.toMatchObject({ status: 401 });
  expect(attempt.attempted).toBe(true);
  expect(create).not.toHaveBeenCalled();
  get.mockRejectedValueOnce(new ApiError('不存在', 404));
  await expect(saveNewDraft(attempt)).resolves.toBe('fstable');
  expect(create).toHaveBeenCalledWith('forms', expect.objectContaining({ id: 'fstable' }));
});
