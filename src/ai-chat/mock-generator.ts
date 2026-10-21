import { fields, validateDraft } from './draft';
import { AIFormDraft, clone, Generator } from './types';

export const examplePrompts = [
  '生成姓名、手机号组成的登记表',
  '添加备注字段',
  '添加邮箱字段',
  '将姓名设为必填',
  '取消姓名必填',
  '删除备注字段',
  '将表单标题改为：活动报名',
];

const fieldDefinitions: Record<string, { key: string; title: string }> = {
  姓名: { key: 'name', title: '姓名' },
  手机号: { key: 'phone', title: '手机号' },
  邮箱: { key: 'email', title: '邮箱' },
  备注: { key: 'remark', title: '备注' },
};

const delay = (signal: AbortSignal, ms: number) => new Promise<void>((resolve, reject) => {
  const abort = () => {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
    reject(new DOMException('已停止生成', 'AbortError'));
  };
  const timer = setTimeout(() => {
    signal.removeEventListener('abort', abort);
    resolve();
  }, ms);
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) {
    abort();
  }
});

export const simulateDraft = (message: string, source: AIFormDraft): AIFormDraft | null => {
  const draft = clone(source);
  const text = message.trim().replace(/[。！!]+$/, '');
  const titleMatch = text.match(/^(?:将|把)?表单标题改为[：:]\s*(.+)$/);
  if (titleMatch) {
    draft.title = titleMatch[1].trim();
  } else if (/^(?:生成|创建)(?:姓名[、，,和及\s]*手机号组成的)?登记表$/.test(text)) {
    const add = (label: string) => addField(draft, label);
    add('姓名');
    add('手机号');
    draft.title = draft.title === '新表单' ? '登记表' : draft.title;
  } else {
    const addMatch = text.match(/^(?:添加|新增)(邮箱|备注)(?:字段)?$/);
    const removeMatch = text.match(/^删除(姓名|手机号|邮箱|备注)(?:字段)?$/);
    const requiredMatch = text.match(/^(?:将|把)?(姓名|手机号|邮箱|备注)(?:字段)?(?:设为|设置为|改为)必填$/);
    const optionalMatch = text.match(/^取消(姓名|手机号|邮箱|备注)(?:字段)?必填$/);
    if (addMatch) {
      addField(draft, addMatch[1]);
    } else if (removeMatch || requiredMatch || optionalMatch) {
      const label = (removeMatch || requiredMatch || optionalMatch)![1];
      const matches = fields(draft.schema).filter(({ node }) => node.title === label);
      if (!matches.length) {
        throw new Error(`找不到“${label}”字段，请先生成或添加该字段`);
      }
      if (matches.length > 1) {
        throw new Error(`存在多个“${label}”字段，请在搭建器中精确修改`);
      }
      const { node, parent, key } = matches[0];
      if (removeMatch) {
        delete parent.properties![key];
      } else {
        node.required = Boolean(requiredMatch);
      }
    } else {
      return null;
    }
  }
  validateDraft(draft);
  return draft;
};

const addField = (draft: AIFormDraft, label: string) => {
  if (fields(draft.schema).some(({ node }) => node.title === label)) {
    return;
  }
  if (!draft.componentLocks.Input) {
    throw new Error('当前起步配置没有可用 Input，请发布组件及配置，或选择包含 Input 的模板');
  }
  const definition = fieldDefinitions[label];
  const properties = draft.schema.properties!;
  let key = definition.key;
  let index = 1;
  while (properties[key]) {
    key = `${definition.key}_${index++}`;
  }
  const initial = draft.componentLocks.Input.defaultFieldSchema;
  properties[key] = {
    ...(initial ? clone(initial) : {}),
    type: 'string',
    title: definition.title,
    required: false,
    'x-component': 'Input',
    'x-decorator': 'FormItem',
    'x-index': Math.max(-1, ...Object.values(properties).map((node) => node['x-index'] ?? 0)) + 1,
    'x-component-props': { placeholder: `请输入${definition.title}` },
  };
};

export const generate: Generator = async function* (input, signal) {
  yield { type: 'status', text: '正在模拟生成…' };
  await delay(signal, 260);
  const draft = simulateDraft(input.message, input.currentDraft);
  const reply = draft
    ? '模拟修改已完成，右侧已准备好新的表单候选版本。保存后可继续在搭建器中编辑。'
    : '这是模拟模式，仅支持下方示例指令。此次未修改表单，请选择示例继续体验。';
  for (let index = 0; index < reply.length; index += 5) {
    await delay(signal, 28);
    yield { type: 'text_delta', text: reply.slice(index, index + 5) };
  }
  if (draft) {
    yield { type: 'status', text: '正在检查表单配置…' };
    await delay(signal, 120);
    yield { type: 'draft', draft };
  }
  yield { type: 'done' };
};
